import { randomUUID } from "node:crypto";
import { activeAegisSecretVersion } from "../lib/aegis";
import { buildLiveProductEvidence, type LiveProductEvidenceV1 } from "./liveProductEvidence";
import { createAndVerifyLiveFinalExact, type LiveAutomaticFinalVerificationResult } from "./liveAutomaticExactVerification";
import { validateLiveFmp4Fragment } from "./liveFmp4Validator";
import { loadLiveLocalSecretProvider } from "./liveLocalSecretProvider";
import { LivePlaybackGrantStore } from "./livePlaybackGrantStore";
import {
  appendLiveRollingSealReceipt,
  createLiveRollingSealMap,
  finalizeLiveRollingSealMap,
  validateLiveRollingSealMap,
  type LiveRollingSealMapV1,
} from "./liveRollingSealMap";
import {
  createLiveSessionSealBinding,
  resolveLiveSessionSealAuthority,
  type LiveSessionSealBindingV1,
} from "./liveSessionSealBinding";
import { LiveWatermarkWorkerManager, type LiveProtectedSampleVerificationResult } from "./liveWatermarkWorker";
import { LiveProductError, LiveProductStore, type LiveProductSegmentRecord, type LiveProductSession, type LiveProductStopReceipt, type LiveProtectionMode } from "./liveProductStore";

interface StartReceipt { schemaVersion: "tancmark-live-start-receipt-v1"; receiptId: string; keyHash: string; requestDigest: string; sessionId: string; startedAt: string }
interface CleanupPlan {
  schemaVersion: "tancmark-live-cleanup-plan-v1"; planId: string; keyHash: string; requestDigest: string; sessionId: string; sessionRevision: number;
  confirmationDigest: string; mediaOnly: true; metadataEvidenceAuditRetained: true; fileCount: number; totalBytes: number;
  artifacts: Array<{ relativePath: string; byteLength: number; sha256: string }>; createdAt: string; expiresAt: string;
}
interface CleanupReceipt { schemaVersion: "tancmark-live-cleanup-receipt-v1"; receiptId: string; keyHash: string; requestDigest: string; planId: string; sessionId: string; purgedAt: string; deletedFileCount: number; deletedBytes: number }

function keyHash(kind: string, key: string): string {
  if (key.length < 8 || key.length > 200) throw new LiveProductError("live_idempotency_key_invalid", 400);
  return LiveProductStore.sha256(`${kind}-key\0${key}`);
}

/** Frozen before acceptance runs: verify every third protected fragment. */
export const LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS = 3 as const;

interface LiveSampleVerificationLedger {
  schemaVersion: "tancmark-live-sample-verification-ledger-v1";
  fixedFrequencyFragments: typeof LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS;
  results: Array<LiveProtectedSampleVerificationResult & {
    bindingVerified: boolean;
    registryVerified: boolean;
    tenantVerified: boolean;
    accountVerified: boolean;
    signatureVerified: boolean;
    exactSampleVerified: boolean;
  }>;
}

export class LiveProductLifecycle {
  constructor(
    readonly store: LiveProductStore,
    readonly grants = new LivePlaybackGrantStore(store),
    readonly watermarkWorkers = new LiveWatermarkWorkerManager(),
  ) {}

  private appendSampleVerificationResult(
    tenantId: string,
    sessionId: string,
    result: LiveSampleVerificationLedger["results"][number],
  ): void {
    const empty: LiveSampleVerificationLedger = {
      schemaVersion: "tancmark-live-sample-verification-ledger-v1",
      fixedFrequencyFragments: LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS,
      results: [],
    };
    const existing = this.store.readPrivateJson<LiveSampleVerificationLedger>(tenantId, sessionId, "sample-verification.json");
    const next = { ...(existing ?? empty), results: [...(existing?.results ?? []), result] };
    if (existing) this.store.mutatePrivateJson(tenantId, sessionId, "sample-verification.json", existing, () => next);
    else this.store.writePrivateJsonOnce(tenantId, sessionId, "sample-verification.json", next);
  }

  private scheduleLiveSampleVerification(input: {
    tenantId: string;
    sessionId: string;
    sequence: number;
    protectedInit: Buffer;
    protectedFragment: Buffer;
    localChannelAFrameIdxs: number[];
    globalChannelAFrameIdxs: number[];
    exactIdHex: string;
    binding: LiveSessionSealBindingV1;
  }): void {
    void this.watermarkWorkers.verifyProtectedFragment({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      sequence: input.sequence,
      protectedInit: input.protectedInit,
      protectedFragment: input.protectedFragment,
      localChannelAFrameIdxs: input.localChannelAFrameIdxs,
      globalChannelAFrameIdxs: input.globalChannelAFrameIdxs,
      exactIdHex: input.exactIdHex,
      authenticatedAegisKeyVersion: input.binding.physicalAegisKeyVersion,
      jobRoot: this.store.createWatermarkJobPath(input.tenantId, input.sessionId),
    }).then((physical) => {
      const current = this.store.getSession(input.tenantId, input.sessionId);
      if (!current || !["RUNNING", "STOPPING"].includes(current.status)) return;
      let signatureVerified = false;
      try {
        resolveLiveSessionSealAuthority(input.binding, loadLiveLocalSecretProvider());
        signatureVerified = true;
      } catch { /* recorded as fail-closed below */ }
      const bindingVerified = current.bindingId === input.binding.bindingId && input.binding.state === "ACTIVE";
      const registryVerified = current.registryBindingState === "ACTIVE";
      const tenantVerified = input.binding.tenantId === input.tenantId;
      const accountVerified = current.accountBindingSha256 === LiveProductStore.sha256(`account\0${input.binding.tenantId}\0${input.binding.accountId}`);
      const exactSampleVerified = physical.physicalFrameExact && bindingVerified && registryVerified && tenantVerified && accountVerified && signatureVerified;
      const enriched = { ...physical, bindingVerified, registryVerified, tenantVerified, accountVerified, signatureVerified, exactSampleVerified };
      this.appendSampleVerificationResult(input.tenantId, input.sessionId, enriched);
      const liveVerificationState = exactSampleVerified ? "EXACT_VERIFIED" : physical.verdict === "PARTIAL" ? "PARTIAL" : "NOT_FOUND";
      const watermarkState = exactSampleVerified ? "LIVE_SAMPLE_EXACT_VERIFIED" : physical.verdict === "PARTIAL" ? "LIVE_SAMPLE_PARTIAL" : "LIVE_SAMPLE_NOT_FOUND";
      this.store.transitionSession(input.tenantId, input.sessionId, [current.status], current.status, {
        liveVerificationState,
        watermarkState,
      }, "watermark.live-sample.verified", {
        sequence: input.sequence,
        verdict: exactSampleVerified ? "EXACT_VERIFIED" : physical.verdict,
        rawIdDisclosed: false,
      });
    }).catch((error: unknown) => {
      const current = this.store.getSession(input.tenantId, input.sessionId);
      if (!current || !["RUNNING", "STOPPING"].includes(current.status)) return;
      this.store.transitionSession(input.tenantId, input.sessionId, [current.status], current.status, {
        liveVerificationState: "FAILED",
        watermarkState: "LIVE_VERIFICATION_FAILED",
      }, "watermark.live-sample.failed", {
        sequence: input.sequence,
        reason: error instanceof LiveProductError ? error.code : "live_sample_verification_failed",
      });
    });
  }

  createSession(input: { tenantId: string; accountId: string; legalHold?: boolean; protectionMode?: LiveProtectionMode }): LiveProductSession {
    const protectionMode = input.protectionMode ?? "PROTECTED_TANCMARK";
    if (protectionMode === "TRANSPORT_ONLY") {
      return this.store.createSession({ ...input, protectionMode, bindingId: null, serverOwnedExactIdHex: null });
    }
    const provider = loadLiveLocalSecretProvider();
    const sessionId = randomUUID();
    const bindingId = randomUUID();
    const binding = createLiveSessionSealBinding({
      sessionId,
      bindingId,
      tenantId: input.tenantId,
      accountId: input.accountId,
      provider,
      physicalAegisKeyVersion: activeAegisSecretVersion,
    });
    const authority = resolveLiveSessionSealAuthority(binding, provider);
    let session = this.store.createSession({
      ...input,
      sessionId,
      protectionMode,
      bindingId,
      serverOwnedExactIdHex: authority.exactIdHex,
    });
    this.store.writePrivateJsonOnce(input.tenantId, sessionId, "seal-binding.json", binding);
    this.store.writePrivateJsonOnce(input.tenantId, sessionId, "rolling-map.json", createLiveRollingSealMap(bindingId, sessionId));
    session = this.store.transitionSession(input.tenantId, sessionId, ["READY"], "READY", {
      registryBindingState: "ACTIVE",
      signedMapState: "ROLLING",
    }, "session.seal-binding.created", { bindingId, registryVersion: binding.registryVersion, rawIdDisclosed: false });
    return session;
  }

  async startSession(input: { tenantId: string; sessionId: string; expectedRevision: number; idempotencyKey: string }): Promise<{ session: LiveProductSession; receipt: StartReceipt; replayed: boolean }> {
    this.store.reconcileSegmentJournal(input.tenantId, input.sessionId);
    const kh = keyHash("start", input.idempotencyKey);
    const requestDigest = LiveProductStore.stableDigest({ operation: "start", tenantId: input.tenantId, sessionId: input.sessionId, expectedRevision: input.expectedRevision });
    const existing = this.store.readAuxiliaryJson<StartReceipt>(input.tenantId, input.sessionId, "start-receipt.json");
    if (existing) {
      if (existing.keyHash !== kh || existing.requestDigest !== requestDigest) throw new LiveProductError("live_start_idempotency_conflict", 409);
      return { session: this.store.requireSession(input.tenantId, input.sessionId), receipt: existing, replayed: true };
    }
    const session = this.store.requireSession(input.tenantId, input.sessionId);
    const retry = session.status === "RUNNING" && session.startAttempt?.idempotencyKeyHash === kh && session.startAttempt.requestDigest === requestDigest;
    if (session.startAttempt && !retry) throw new LiveProductError("live_start_idempotency_conflict", 409);
    if (retry) {
      if (!session.startedAt) throw new LiveProductError("live_start_recovery_invalid", 409);
      const receipt: StartReceipt = { schemaVersion: "tancmark-live-start-receipt-v1", receiptId: `start-${LiveProductStore.sha256(`${kh}\0${requestDigest}`).slice(0, 32)}`, keyHash: kh, requestDigest, sessionId: input.sessionId, startedAt: session.startedAt };
      this.store.mutateAuxiliaryJson(input.tenantId, input.sessionId, "start-receipt.json", receipt, () => receipt);
      return { session, receipt, replayed: true };
    }
    if (session.revision !== input.expectedRevision) throw new LiveProductError("live_session_revision_conflict", 409);
    if (session.status !== "READY" || (session.protectionMode === "PROTECTED_TANCMARK" ? !session.rawInitSha256 : !session.initSha256)) throw new LiveProductError("live_start_init_required", 409);
    if (session.protectionMode === "PROTECTED_TANCMARK") {
      this.store.readRawInit(input.tenantId, input.sessionId);
      await this.watermarkWorkers.ensureReady(input.tenantId, input.sessionId);
    } else this.store.readInit(input.tenantId, input.sessionId);
    const startedAt = new Date().toISOString();
    const updated = this.store.transitionSession(input.tenantId, input.sessionId, ["READY"], "RUNNING", {
      startedAt,
      startAttempt: { idempotencyKeyHash: kh, requestDigest },
      watermarkWorkerHealth: session.protectionMode === "PROTECTED_TANCMARK" ? "READY" : "NOT_APPLICABLE",
      watermarkState: session.protectionMode === "PROTECTED_TANCMARK" ? "WATERMARK_PENDING" : "WATERMARK_DISABLED",
    }, "session.started");
    const receipt: StartReceipt = { schemaVersion: "tancmark-live-start-receipt-v1", receiptId: `start-${LiveProductStore.sha256(`${kh}\0${requestDigest}`).slice(0, 32)}`, keyHash: kh, requestDigest, sessionId: input.sessionId, startedAt };
    this.store.mutateAuxiliaryJson(input.tenantId, input.sessionId, "start-receipt.json", receipt, () => receipt);
    return { session: updated, receipt, replayed: false };
  }

  async appendSegment(input: { tenantId: string; sessionId: string; sequence: number; durationMs: number; bytes: Buffer; suppliedSha256: string; idempotencyKey: string }): Promise<{ segment: LiveProductSegmentRecord; duplicate: boolean; session: LiveProductSession }> {
    const session = this.store.requireSession(input.tenantId, input.sessionId);
    if (session.protectionMode === "TRANSPORT_ONLY") return this.store.appendSegment(input);
    if (session.status !== "RUNNING") throw new LiveProductError("live_session_not_running", 409);
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 0 || !Number.isSafeInteger(input.durationMs) || input.durationMs < 1 || input.durationMs > 60_000) throw new LiveProductError("live_segment_request_invalid", 400);
    if (!/^[0-9a-f]{64}$/i.test(input.suppliedSha256) || LiveProductStore.sha256(input.bytes) !== input.suppliedSha256.toLowerCase()) throw new LiveProductError("live_segment_hash_mismatch", 409);
    if (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200) throw new LiveProductError("live_idempotency_key_invalid", 400);
    const rawInit = this.store.readRawInit(input.tenantId, input.sessionId);
    let sourceFragment: ReturnType<typeof validateLiveFmp4Fragment>;
    try { sourceFragment = validateLiveFmp4Fragment(input.bytes, { codecs: rawInit.record.codecs, byteLength: rawInit.record.byteLength, tracks: rawInit.record.tracks }); }
    catch { throw new LiveProductError("live_segment_fmp4_invalid", 400); }
    const sourceDigest = LiveProductStore.sha256(input.bytes);
    const keyDigest = LiveProductStore.sha256(`raw-segment-key\0${input.idempotencyKey}`);
    type RawIdempotency = { schemaVersion: "tancmark-live-raw-idempotency-v1"; entries: Array<{ sequence: number; keyDigest: string; sourceDigest: string; outputSegmentId: string }> };
    const ledger = this.store.readPrivateJson<RawIdempotency>(input.tenantId, input.sessionId, "raw-idempotency.json") ?? { schemaVersion: "tancmark-live-raw-idempotency-v1", entries: [] };
    const prior = ledger.entries.find((entry) => entry.sequence === input.sequence);
    if (prior) {
      if (prior.keyDigest !== keyDigest || prior.sourceDigest !== sourceDigest) throw new LiveProductError("live_segment_idempotency_conflict", 409);
      const found = this.store.readSegment(input.tenantId, input.sessionId, prior.outputSegmentId);
      return { segment: found.record, duplicate: true, session: this.store.requireSession(input.tenantId, input.sessionId) };
    }
    if (input.sequence !== session.nextSegmentSequence) throw new LiveProductError("live_segment_sequence_conflict", 409);
    const binding = this.store.readPrivateJson<LiveSessionSealBindingV1>(input.tenantId, input.sessionId, "seal-binding.json");
    if (!binding) throw new LiveProductError("live_session_seal_binding_missing", 409);
    const authority = resolveLiveSessionSealAuthority(binding, loadLiveLocalSecretProvider());
    try {
      const protectedResult = await this.watermarkWorkers.processFragment({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        sequence: input.sequence,
        rawInit: rawInit.bytes,
        rawFragment: input.bytes,
        sourceFragment,
        exactIdHex: authority.exactIdHex,
        globalFrameOffset: session.protectedFrameCount,
        jobRoot: this.store.createWatermarkJobPath(input.tenantId, input.sessionId),
      });
      if (JSON.stringify(protectedResult.sourceTrackTimelines) !== JSON.stringify(protectedResult.outputTrackTimelines)) {
        this.store.appendEvent(input.tenantId, input.sessionId, "watermark.timeline.mismatch", {
          sequence: input.sequence,
          sourceTrackTimelines: protectedResult.sourceTrackTimelines,
          outputTrackTimelines: protectedResult.outputTrackTimelines,
        });
        throw new LiveProductError("live_watermark_output_timeline_changed", 409);
      }
      this.store.publishProtectedInit({ tenantId: input.tenantId, sessionId: input.sessionId, bytes: protectedResult.protectedInit });
      const appended = this.store.appendProtectedSegment({
        ...input,
        durationMs: sourceFragment.durationMs,
        bytes: protectedResult.protectedFragment,
        suppliedSha256: protectedResult.receipt.protectedSha256,
      });
      const currentMap = this.store.readPrivateJson<LiveRollingSealMapV1>(input.tenantId, input.sessionId, "rolling-map.json");
      if (!currentMap) throw new LiveProductError("live_rolling_seal_map_missing", 409);
      const updatedMap = appendLiveRollingSealReceipt(currentMap, {
        bindingId: binding.bindingId,
        sessionId: input.sessionId,
        sequence: input.sequence,
        decodedFrameOffset: session.protectedFrameCount,
        decodedFrameCount: protectedResult.frameCount,
        channelAFrameIdxs: protectedResult.channelAFrameIdxs,
        channelBFrameIdxs: protectedResult.channelBFrameIdxs,
        framePts: protectedResult.framePts,
        watermarkAlgorithmVersion: binding.watermarkAlgorithmVersion,
        sourceFragmentDigestSha256: sourceDigest,
        outputFragmentDigestSha256: protectedResult.receipt.protectedSha256,
        createdAt: protectedResult.receipt.createdAt,
      });
      this.store.mutatePrivateJson(input.tenantId, input.sessionId, "rolling-map.json", currentMap, () => updatedMap);
      const rawLedger = { ...ledger, entries: [...ledger.entries, { sequence: input.sequence, keyDigest, sourceDigest, outputSegmentId: appended.segment.segmentId }] };
      if (ledger.entries.length === 0) this.store.writePrivateJsonOnce(input.tenantId, input.sessionId, "raw-idempotency.json", rawLedger);
      else this.store.mutatePrivateJson(input.tenantId, input.sessionId, "raw-idempotency.json", ledger, () => rawLedger);
      const current = this.store.requireSession(input.tenantId, input.sessionId);
      const shouldVerifySample = (input.sequence + 1) % LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS === 0;
      const updated = this.store.transitionSession(input.tenantId, input.sessionId, ["RUNNING"], "RUNNING", {
        protectedFrameCount: session.protectedFrameCount + protectedResult.frameCount,
        channelAFrameCount: session.channelAFrameCount + protectedResult.channelAFrameIdxs.length,
        channelBFrameCount: session.channelBFrameCount + protectedResult.channelBFrameIdxs.length,
        watermarkState: current.liveVerificationState === "EXACT_VERIFIED" ? "LIVE_SAMPLE_EXACT_VERIFIED" : "WATERMARK_ACTIVE",
        watermarkWorkerHealth: "HEALTHY",
        liveVerificationState: shouldVerifySample ? "PENDING" : current.liveVerificationState,
        signedMapState: "ROLLING",
      }, "watermark.fragment.protected", {
        sequence: input.sequence,
        frameCount: protectedResult.frameCount,
        queueDepthAtSubmit: protectedResult.receipt.queueDepthAtSubmit,
        prepareWallMs: protectedResult.receipt.prepareWallMs,
        stampingWallMs: protectedResult.receipt.stampingWallMs,
        adapterWallMs: protectedResult.receipt.adapterWallMs,
        adapterEncodeWallMs: protectedResult.receipt.adapterEncodeWallMs,
        remuxWallMs: protectedResult.receipt.remuxWallMs,
        splitWallMs: protectedResult.receipt.splitWallMs,
        codecValidationWallMs: protectedResult.receipt.codecValidationWallMs,
        workerCpuSeconds: protectedResult.receipt.workerCpuSeconds,
        workerWorkingSetBytes: protectedResult.receipt.workerWorkingSetBytes,
        workerPeakWorkingSetBytes: protectedResult.receipt.workerPeakWorkingSetBytes,
        totalWallMs: protectedResult.receipt.totalWallMs,
        sourceDigest: "[redacted]",
      });
      if (shouldVerifySample) {
        if (protectedResult.channelAFrameIdxs.length < 1) throw new LiveProductError("live_sample_verification_frame_missing", 500);
        this.scheduleLiveSampleVerification({
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          sequence: input.sequence,
          protectedInit: protectedResult.protectedInit,
          protectedFragment: protectedResult.protectedFragment,
          localChannelAFrameIdxs: protectedResult.channelAFrameIdxs.map((frameIdx) => frameIdx - session.protectedFrameCount),
          globalChannelAFrameIdxs: protectedResult.channelAFrameIdxs,
          exactIdHex: authority.exactIdHex,
          binding,
        });
      }
      return { segment: appended.segment, duplicate: appended.duplicate, session: updated.revision >= current.revision ? updated : current };
    } catch (error) {
      const failed = this.store.getSession(input.tenantId, input.sessionId);
      if (failed?.status === "RUNNING") this.store.transitionSession(input.tenantId, input.sessionId, ["RUNNING"], "FAILED", {
        watermarkState: "LIVE_WATERMARKING_FAILED_FAIL_CLOSED",
        watermarkWorkerHealth: "FAILED",
        protectedOutputReady: false,
      }, "watermark.fragment.failed", { reason: error instanceof LiveProductError ? error.code : "live_watermarking_failed_fail_closed" });
      throw error instanceof LiveProductError ? error : new LiveProductError("live_watermarking_failed_fail_closed", 503);
    }
  }

  revokeSessionPlayback(tenantId: string, sessionId: string, expectedRevision: number): { session: LiveProductSession; revokedGrantCount: number } {
    const current = this.store.requireSession(tenantId, sessionId);
    if (current.revision !== expectedRevision) throw new LiveProductError("live_session_revision_conflict", 409);
    if (!["READY", "RUNNING", "STOPPED"].includes(current.status)) throw new LiveProductError("live_session_state_conflict", 409);
    const updated = this.store.transitionSession(tenantId, sessionId, [current.status], current.status, { tokenEpoch: current.tokenEpoch + 1, accessRevision: current.accessRevision + 1 }, "playback.epoch.incremented");
    return { session: updated, revokedGrantCount: this.grants.revokeAllForSession(tenantId, sessionId) };
  }

  async stopSession(input: { tenantId: string; sessionId: string; expectedRevision: number; idempotencyKey: string }): Promise<{ session: LiveProductSession; receipt: LiveProductStopReceipt; evidence: LiveProductEvidenceV1; finalVerification: LiveAutomaticFinalVerificationResult | null; replayed: boolean }> {
    this.store.reconcileSegmentJournal(input.tenantId, input.sessionId);
    const kh = keyHash("stop", input.idempotencyKey);
    const requestDigest = LiveProductStore.stableDigest({ operation: "stop", tenantId: input.tenantId, sessionId: input.sessionId, expectedRevision: input.expectedRevision });
    let current = this.store.requireSession(input.tenantId, input.sessionId);
    if (current.stopReceipt) {
      if (current.stopReceipt.idempotencyKeyHash !== kh || current.stopReceipt.requestDigest !== requestDigest) throw new LiveProductError("live_stop_idempotency_conflict", 409);
      const evidence = this.store.readEvidence<LiveProductEvidenceV1>(input.tenantId, input.sessionId);
      if (!evidence) throw new LiveProductError("live_evidence_missing", 500);
      return { session: current, receipt: current.stopReceipt, evidence, finalVerification: this.store.readPrivateJson<LiveAutomaticFinalVerificationResult>(input.tenantId, input.sessionId, "final-verification.json"), replayed: true };
    }
    const retry = ["STOPPING", "CLEANUP_PENDING"].includes(current.status) && current.stopAttempt?.idempotencyKeyHash === kh && current.stopAttempt.requestDigest === requestDigest;
    if (current.stopAttempt && !retry) throw new LiveProductError("live_stop_idempotency_conflict", 409);
    if (!retry && current.revision !== input.expectedRevision) throw new LiveProductError("live_session_revision_conflict", 409);
    if (!retry && current.status !== "RUNNING") throw new LiveProductError("live_session_state_conflict", 409);
    try {
      if (current.status !== "STOPPING") current = this.store.transitionSession(input.tenantId, input.sessionId, [current.status], "STOPPING", { tokenEpoch: current.status === "RUNNING" ? current.tokenEpoch + 1 : current.tokenEpoch, accessRevision: current.status === "RUNNING" ? current.accessRevision + 1 : current.accessRevision, stopAttempt: { idempotencyKeyHash: kh, requestDigest } }, "session.stop.requested");
      this.grants.revokeAllForSession(input.tenantId, input.sessionId);
      if (current.protectionMode === "PROTECTED_TANCMARK") await this.watermarkWorkers.stop(input.tenantId, input.sessionId);
      const vodFinalizeStarted = performance.now();
      const manifest = this.store.finalizeManifest(input.tenantId, input.sessionId);
      const recording = this.store.finalizeRecording(input.tenantId, input.sessionId);
      const vodFinalizeWallMs = Number((performance.now() - vodFinalizeStarted).toFixed(3));
      current = this.store.requireSession(input.tenantId, input.sessionId);
      let finalVerification: LiveAutomaticFinalVerificationResult | null = null;
      let finalExactVerifyWallMs: number | null = null;
      if (current.protectionMode === "PROTECTED_TANCMARK") {
        const rolling = this.store.readPrivateJson<LiveRollingSealMapV1>(input.tenantId, input.sessionId, "rolling-map.json");
        const binding = this.store.readPrivateJson<LiveSessionSealBindingV1>(input.tenantId, input.sessionId, "seal-binding.json");
        if (!rolling || !binding) throw new LiveProductError("live_final_evidence_binding_missing", 409);
        validateLiveRollingSealMap(rolling);
        const finalizedMap = finalizeLiveRollingSealMap(rolling);
        this.store.mutatePrivateJson(input.tenantId, input.sessionId, "rolling-map.json", rolling, () => finalizedMap);
        const existingFinalMap = this.store.readPrivateJson<LiveRollingSealMapV1>(input.tenantId, input.sessionId, "rolling-final.json");
        if (!existingFinalMap) this.store.writePrivateJsonOnce(input.tenantId, input.sessionId, "rolling-final.json", finalizedMap);
        else validateLiveRollingSealMap(existingFinalMap);
        current = this.store.transitionSession(input.tenantId, input.sessionId, ["STOPPING"], "STOPPING", {
          watermarkWorkerHealth: "STOPPED",
          signedMapState: "FINALIZED",
          finalVerificationState: "PENDING",
          watermarkState: "WATERMARK_ACTIVE",
        }, "session.final-verification.started", { rollingReceiptCount: finalizedMap.receipts.length });
        finalVerification = this.store.readPrivateJson<LiveAutomaticFinalVerificationResult>(input.tenantId, input.sessionId, "final-verification.json");
        if (!finalVerification) {
          const finalExactVerifyStarted = performance.now();
          finalVerification = await createAndVerifyLiveFinalExact({
            store: this.store,
            tenantId: input.tenantId,
            sessionId: input.sessionId,
            binding,
            rollingMap: finalizedMap,
            provider: loadLiveLocalSecretProvider(),
          });
          finalExactVerifyWallMs = Number((performance.now() - finalExactVerifyStarted).toFixed(3));
        } else finalExactVerifyWallMs = 0;
        if (!finalVerification.final || !finalVerification.ownership || !finalVerification.vault) {
          throw new LiveProductError("live_final_exact_verification_failed", 409);
        }
        current = this.store.transitionSession(input.tenantId, input.sessionId, ["STOPPING"], "STOPPING", {
          finalVerificationState: "EXACT_VERIFIED",
          liveVerificationState: current.liveVerificationState === "NOT_STARTED" ? "NOT_APPLICABLE" : current.liveVerificationState,
          watermarkState: "FINAL_EXACT_VERIFIED",
          registryBindingState: "ACTIVE",
          signedMapState: "FINALIZED",
        }, "session.final-verification.exact", {
          verdict: finalVerification.verdict,
          vodFinalizeWallMs,
          finalExactVerifyWallMs,
          rawIdDisclosed: false,
        });
        if (!this.store.readPrivateJson(input.tenantId, input.sessionId, "final-performance.json")) {
          this.store.writePrivateJsonOnce(input.tenantId, input.sessionId, "final-performance.json", {
            schemaVersion: "tancmark-live-final-performance-v1",
            vodFinalizeWallMs,
            finalExactVerifyWallMs,
            measuredAt: new Date().toISOString(),
          });
        }
        this.store.removePrivateIngestMedia(input.tenantId, input.sessionId);
      }
      let evidence = this.store.readEvidence<LiveProductEvidenceV1>(input.tenantId, input.sessionId);
      if (!evidence) {
        evidence = buildLiveProductEvidence({ session: current, segments: this.store.listSegments(input.tenantId, input.sessionId), manifest, recording, tenantBindingSha256: LiveProductStore.sha256(`tenant\0${input.tenantId}`) });
        this.store.writeEvidence(input.tenantId, input.sessionId, evidence);
      }
      const stoppedAt = new Date().toISOString();
      const receipt: LiveProductStopReceipt = { receiptId: `stop-${LiveProductStore.sha256(`${kh}\0${requestDigest}`).slice(0, 32)}`, idempotencyKeyHash: kh, requestDigest, stoppedAt, sessionRevision: current.revision + 1, evidenceId: evidence.evidenceId, manifestId: manifest.manifestId };
      current = this.store.transitionSession(input.tenantId, input.sessionId, ["STOPPING"], "STOPPED", { evidenceId: evidence.evidenceId, stoppedAt, stopReceipt: receipt }, "session.stopped", { evidenceId: evidence.evidenceId, manifestId: manifest.manifestId, recordingId: recording.recordingId });
      return { session: current, receipt, evidence, finalVerification, replayed: retry };
    } catch (error) {
      const failed = this.store.getSession(input.tenantId, input.sessionId);
      if (failed?.status === "STOPPING") this.store.transitionSession(input.tenantId, input.sessionId, ["STOPPING"], failed.protectionMode === "PROTECTED_TANCMARK" ? "FAILED" : "CLEANUP_PENDING", failed.protectionMode === "PROTECTED_TANCMARK" ? {
        finalVerificationState: "FAILED",
        watermarkState: "LIVE_VERIFICATION_FAILED",
        protectedOutputReady: false,
      } : {}, "session.stop.failed", { reason: error instanceof LiveProductError ? error.code : "internal_error" });
      throw error;
    }
  }

  planCleanup(input: { tenantId: string; sessionId: string; expectedRevision: number; idempotencyKey: string; nowMs?: number }): { plan: CleanupPlan; replayed: boolean } {
    const kh = keyHash("cleanup-plan", input.idempotencyKey);
    const requestDigest = LiveProductStore.stableDigest({ operation: "cleanup-plan", tenantId: input.tenantId, sessionId: input.sessionId, expectedRevision: input.expectedRevision });
    const existing = this.store.readAuxiliaryJson<CleanupPlan>(input.tenantId, input.sessionId, "cleanup-plan.json");
    if (existing) {
      if (existing.keyHash !== kh || existing.requestDigest !== requestDigest) throw new LiveProductError("live_cleanup_idempotency_conflict", 409);
      return { plan: existing, replayed: true };
    }
    const session = this.store.requireSession(input.tenantId, input.sessionId);
    if (session.revision !== input.expectedRevision) throw new LiveProductError("live_session_revision_conflict", 409);
    if (session.status !== "STOPPED" && session.status !== "FAILED") throw new LiveProductError("live_cleanup_state_conflict", 409);
    if (session.legalHold) throw new LiveProductError("live_cleanup_legal_hold", 409);
    const inventory = this.store.mediaInventory(input.tenantId, input.sessionId);
    const nowMs = input.nowMs ?? Date.now();
    const planId = randomUUID();
    const expiresAt = new Date(nowMs + 10 * 60_000).toISOString();
    const confirmationDigest = LiveProductStore.stableDigest({ operation: "purge-managed-media", planId, tenantBinding: LiveProductStore.sha256(`tenant\0${input.tenantId}`), sessionRevision: session.revision, artifacts: inventory.artifacts, expiresAt });
    const plan: CleanupPlan = { schemaVersion: "tancmark-live-cleanup-plan-v1", planId, keyHash: kh, requestDigest, sessionId: input.sessionId, sessionRevision: session.revision, confirmationDigest, mediaOnly: true, metadataEvidenceAuditRetained: true, ...inventory, createdAt: new Date(nowMs).toISOString(), expiresAt };
    this.store.mutateAuxiliaryJson(input.tenantId, input.sessionId, "cleanup-plan.json", plan, () => plan);
    this.store.appendEvent(input.tenantId, input.sessionId, "cleanup.planned", { planId, fileCount: plan.fileCount, totalBytes: plan.totalBytes });
    return { plan, replayed: false };
  }

  executeCleanup(input: { tenantId: string; sessionId: string; expectedRevision: number; confirmationDigest: string; idempotencyKey: string; nowMs?: number }): { session: LiveProductSession; receipt: CleanupReceipt; replayed: boolean } {
    const kh = keyHash("cleanup-execute", input.idempotencyKey);
    const requestDigest = LiveProductStore.stableDigest({ operation: "cleanup-execute", tenantId: input.tenantId, sessionId: input.sessionId, expectedRevision: input.expectedRevision, confirmationDigest: input.confirmationDigest });
    const priorReceipt = this.store.readAuxiliaryJson<CleanupReceipt>(input.tenantId, input.sessionId, "cleanup-receipt.json");
    if (priorReceipt) {
      if (priorReceipt.keyHash !== kh || priorReceipt.requestDigest !== requestDigest) throw new LiveProductError("live_cleanup_idempotency_conflict", 409);
      return { session: this.store.requireSession(input.tenantId, input.sessionId), receipt: priorReceipt, replayed: true };
    }
    let session = this.store.requireSession(input.tenantId, input.sessionId);
    const plan = this.store.readAuxiliaryJson<CleanupPlan>(input.tenantId, input.sessionId, "cleanup-plan.json");
    const nowMs = input.nowMs ?? Date.now();
    if (!plan || plan.confirmationDigest !== input.confirmationDigest || plan.sessionRevision !== input.expectedRevision) throw new LiveProductError("live_cleanup_confirmation_invalid", 409);
    if (session.legalHold) throw new LiveProductError("live_cleanup_legal_hold", 409);
    const matchingPendingAttempt = session.status === "CLEANUP_PENDING" && session.cleanupAttempt?.idempotencyKeyHash === kh && session.cleanupAttempt.requestDigest === requestDigest && session.cleanupAttempt.planId === plan.planId;
    if (session.status === "CLEANUP_PENDING" && !matchingPendingAttempt) throw new LiveProductError("live_cleanup_idempotency_conflict", 409);
    const planExpired = Date.parse(plan.expiresAt) <= nowMs;
    if (planExpired && (!matchingPendingAttempt || this.store.mediaInventory(input.tenantId, input.sessionId).fileCount !== 0)) throw new LiveProductError("live_cleanup_confirmation_expired", 409);
    if (!matchingPendingAttempt) {
      if (session.revision !== input.expectedRevision || (session.status !== "STOPPED" && session.status !== "FAILED")) throw new LiveProductError("live_cleanup_state_conflict", 409);
      session = this.store.transitionSession(input.tenantId, input.sessionId, [session.status], "CLEANUP_PENDING", { cleanupAttempt: { idempotencyKeyHash: kh, requestDigest, planId: plan.planId } }, "cleanup.executing", { planId: plan.planId });
    }
    this.store.purgeManagedMedia(input.tenantId, input.sessionId);
    const purgedAt = new Date(nowMs).toISOString();
    const receipt: CleanupReceipt = { schemaVersion: "tancmark-live-cleanup-receipt-v1", receiptId: `cleanup-${LiveProductStore.sha256(`${kh}\0${requestDigest}`).slice(0, 32)}`, keyHash: kh, requestDigest, planId: plan.planId, sessionId: input.sessionId, purgedAt, deletedFileCount: plan.fileCount, deletedBytes: plan.totalBytes };
    this.store.mutateAuxiliaryJson(input.tenantId, input.sessionId, "cleanup-receipt.json", receipt, () => receipt);
    const completed = this.store.transitionSession(input.tenantId, input.sessionId, ["CLEANUP_PENDING"], "PURGED", {}, "cleanup.executed", { planId: plan.planId, mediaOnly: true, metadataEvidenceAuditRetained: true });
    return { session: completed, receipt, replayed: false };
  }
}
