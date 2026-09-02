import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LiveProductLifecycle } from "../../artifacts/api-server/src/live/liveProductLifecycle.ts";
import {
  LiveProductError,
  LiveProductStore,
  releaseLiveProductProcessLeasesForContractOnly,
  type LiveProductSegmentRecord,
} from "../../artifacts/api-server/src/live/liveProductStore.ts";
import { validateLiveFmp4Fragment, validateLiveFmp4Init } from "../../artifacts/api-server/src/live/liveFmp4Validator.ts";
import { finalizeLiveRollingSealMap, type LiveRollingSealMapV1 } from "../../artifacts/api-server/src/live/liveRollingSealMap.ts";
import { LiveWatermarkWorkerManager } from "../../artifacts/api-server/src/live/liveWatermarkWorker.ts";
import { generateLiveFmp4Fixture } from "./live_local_product_media_fixture.ts";

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tmlive-crash-recovery-"));
const tenantId = "live-crash-recovery-tenant";
const managers: LiveWatermarkWorkerManager[] = [];

function safeSessionDirectory(root: string, sessionId: string): string {
  return path.join(root, "tenants", sha256(`tenant\0${tenantId}`), "sessions", sessionId);
}

async function createProtected(root: string, suffix: string, fragments = 2): Promise<{
  store: LiveProductStore;
  manager: LiveWatermarkWorkerManager;
  lifecycle: LiveProductLifecycle;
  session: ReturnType<LiveProductStore["requireSession"]>;
}> {
  const manager = new LiveWatermarkWorkerManager();
  managers.push(manager);
  const store = new LiveProductStore(root);
  const lifecycle = new LiveProductLifecycle(store, undefined, manager);
  let session = lifecycle.createSession({ tenantId, accountId: `${tenantId}-${suffix}` });
  const uploaded = store.uploadInit({ tenantId, sessionId: session.sessionId, bytes: fixture.init, suppliedSha256: sha256(fixture.init), idempotencyKey: `${suffix}-init-0001` });
  session = (await lifecycle.startSession({ tenantId, sessionId: session.sessionId, expectedRevision: uploaded.session.revision, idempotencyKey: `${suffix}-start-0001` })).session;
  for (let sequence = 0; sequence < fragments; sequence += 1) {
    const bytes = fixture.fragments[sequence]!;
    session = (await lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence, durationMs: fixture.durationsMs[sequence]!, bytes, suppliedSha256: sha256(bytes), idempotencyKey: `${suffix}-segment-${String(sequence).padStart(4, "0")}` })).session;
  }
  return { store, manager, lifecycle, session };
}

function markStopping(store: LiveProductStore, session: ReturnType<LiveProductStore["requireSession"]>, key: string): { expectedRevision: number; requestDigest: string } {
  const expectedRevision = session.revision;
  const requestDigest = LiveProductStore.stableDigest({ operation: "stop", tenantId, sessionId: session.sessionId, expectedRevision });
  store.transitionSession(tenantId, session.sessionId, ["RUNNING"], "STOPPING", {
    tokenEpoch: session.tokenEpoch + 1,
    accessRevision: session.accessRevision + 1,
    stopAttempt: { idempotencyKeyHash: sha256(`stop-key\0${key}`), requestDigest },
  }, "test.crash.after-stop-transition");
  return { expectedRevision, requestDigest };
}

const fixture = generateLiveFmp4Fixture(path.join(temp, "fixture"));

async function main(): Promise<void> {
  try {
    const checks: Record<string, boolean> = {};

    // 1. Worker exits while a protected fragment is being processed.
    const originalWorkerScript = process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"];
    assert(originalWorkerScript && path.isAbsolute(originalWorkerScript));
    process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"] = path.resolve("runtime/validation/fixtures/live_worker_exit_after_ping.py");
    const crashManager = new LiveWatermarkWorkerManager();
    managers.push(crashManager);
    const crashRoot = path.join(temp, "worker-crash-store");
    const crashStore = new LiveProductStore(crashRoot);
    const crashLifecycle = new LiveProductLifecycle(crashStore, undefined, crashManager);
    let crashSession = crashLifecycle.createSession({ tenantId, accountId: "worker-crash-account" });
    const crashInit = crashStore.uploadInit({ tenantId, sessionId: crashSession.sessionId, bytes: fixture.init, suppliedSha256: sha256(fixture.init), idempotencyKey: "worker-crash-init-0001" });
    crashSession = (await crashLifecycle.startSession({ tenantId, sessionId: crashSession.sessionId, expectedRevision: crashInit.session.revision, idempotencyKey: "worker-crash-start-0001" })).session;
    await assert.rejects(crashLifecycle.appendSegment({ tenantId, sessionId: crashSession.sessionId, sequence: 0, durationMs: fixture.durationsMs[0]!, bytes: fixture.fragments[0]!, suppliedSha256: sha256(fixture.fragments[0]!), idempotencyKey: "worker-crash-segment-0001" }), (error: unknown) => error instanceof LiveProductError && error.code === "live_watermarking_failed_fail_closed");
    assert.equal(crashStore.listSegments(tenantId, crashSession.sessionId).length, 0);
    checks.workerMidStreamExitFailClosed = true;
    await crashManager.shutdownAll();
    process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"] = originalWorkerScript;
    releaseLiveProductProcessLeasesForContractOnly();

    // 2. A new Node/lifecycle instance continues from committed protected media.
    const restartRoot = path.join(temp, "node-restart-store");
    const beforeRestart = await createProtected(restartRoot, "node-restart", 1);
    const restartSessionId = beforeRestart.session.sessionId;
    await beforeRestart.manager.shutdownAll();
    releaseLiveProductProcessLeasesForContractOnly();
    const restartStore = new LiveProductStore(restartRoot);
    const restartManager = new LiveWatermarkWorkerManager(); managers.push(restartManager);
    const restartLifecycle = new LiveProductLifecycle(restartStore, undefined, restartManager);
    const secondBytes = fixture.fragments[1]!;
    const restartedAppend = await restartLifecycle.appendSegment({ tenantId, sessionId: restartSessionId, sequence: 1, durationMs: fixture.durationsMs[1]!, bytes: secondBytes, suppliedSha256: sha256(secondBytes), idempotencyKey: "node-restart-segment-0001" });
    const restartedStop = await restartLifecycle.stopSession({ tenantId, sessionId: restartSessionId, expectedRevision: restartedAppend.session.revision, idempotencyKey: "node-restart-stop-0001" });
    assert.equal(restartedStop.finalVerification?.verdict, "VIDEO_LAYER_VAULT");
    assert.equal(restartStore.listSegments(tenantId, restartSessionId).length, 2);
    checks.nodeProcessRestartSafeContinue = true;
    await restartManager.shutdownAll();
    releaseLiveProductProcessLeasesForContractOnly();

    // 3. A bounded quota simulates temporary disk exhaustion before publish.
    const oldLimit = process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"];
    process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"] = String(fixture.init.length + fixture.fragments[0]!.length - 1);
    const diskRoot = path.join(temp, "disk-full-store");
    const diskManager = new LiveWatermarkWorkerManager(); managers.push(diskManager);
    const diskStore = new LiveProductStore(diskRoot);
    const diskLifecycle = new LiveProductLifecycle(diskStore, undefined, diskManager);
    let diskSession = diskLifecycle.createSession({ tenantId, accountId: "disk-full-account" });
    const diskInit = diskStore.uploadInit({ tenantId, sessionId: diskSession.sessionId, bytes: fixture.init, suppliedSha256: sha256(fixture.init), idempotencyKey: "disk-full-init-0001" });
    diskSession = (await diskLifecycle.startSession({ tenantId, sessionId: diskSession.sessionId, expectedRevision: diskInit.session.revision, idempotencyKey: "disk-full-start-0001" })).session;
    await assert.rejects(diskLifecycle.appendSegment({ tenantId, sessionId: diskSession.sessionId, sequence: 0, durationMs: fixture.durationsMs[0]!, bytes: fixture.fragments[0]!, suppliedSha256: sha256(fixture.fragments[0]!), idempotencyKey: "disk-full-segment-0001" }), (error: unknown) => error instanceof LiveProductError && error.code === "live_storage_quota_exceeded");
    assert.equal(diskStore.listSegments(tenantId, diskSession.sessionId).length, 0);
    checks.temporaryDiskFullFailClosed = true;
    await diskManager.shutdownAll();
    if (oldLimit === undefined) delete process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"]; else process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"] = oldLimit;
    releaseLiveProductProcessLeasesForContractOnly();

    // 4-6. Journal recovery distinguishes partial/output-only writes from a
    // durable segment receipt whose session commit did not finish.
    const journalRoot = path.join(temp, "journal-store");
    const journalStore = new LiveProductStore(journalRoot);
    const journalLifecycle = new LiveProductLifecycle(journalStore);
    let journalSession = journalLifecycle.createSession({ tenantId, accountId: "journal-account", protectionMode: "TRANSPORT_ONLY" });
    const journalInit = journalStore.uploadInit({ tenantId, sessionId: journalSession.sessionId, bytes: fixture.init, suppliedSha256: sha256(fixture.init), idempotencyKey: "journal-init-0001" });
    journalSession = (await journalLifecycle.startSession({ tenantId, sessionId: journalSession.sessionId, expectedRevision: journalInit.session.revision, idempotencyKey: "journal-start-0001" })).session;
    const sessionDir = safeSessionDirectory(journalRoot, journalSession.sessionId);
    const segmentsDir = path.join(sessionDir, "media", "segments");
    const journalFile = path.join(sessionDir, "segment-journal.json");
    const source = fixture.fragments[0]!;
    const sourceSha = sha256(source);
    const writeJournal = (storageName: string, temporaryName: string): void => fs.writeFileSync(journalFile, `${JSON.stringify({ schemaVersion: "tancmark-live-segment-journal-v1", sequence: 0, storageName, temporaryName, sha256: sourceSha, byteLength: source.length })}\n`, { flag: "wx" });

    const partialStorage = `segment-00000000-${randomUUID()}.m4s`;
    const partialName = `.tmp-${randomUUID()}.segment`;
    writeJournal(partialStorage, partialName);
    fs.writeFileSync(path.join(segmentsDir, partialName), source.subarray(0, Math.max(1, Math.floor(source.length / 2))), { flag: "wx" });
    assert.equal(journalStore.reconcileSegmentJournal(tenantId, journalSession.sessionId), "ROLLED_BACK");
    assert.equal(fs.existsSync(path.join(segmentsDir, partialName)), false);
    checks.halfFragmentRolledBack = true;

    const outputOnlyStorage = `segment-00000000-${randomUUID()}.m4s`;
    const outputOnlyTemp = `.tmp-${randomUUID()}.segment`;
    writeJournal(outputOnlyStorage, outputOnlyTemp);
    fs.writeFileSync(path.join(segmentsDir, outputOnlyStorage), source, { flag: "wx" });
    assert.equal(journalStore.reconcileSegmentJournal(tenantId, journalSession.sessionId), "ROLLED_BACK");
    assert.equal(fs.existsSync(path.join(segmentsDir, outputOnlyStorage)), false);
    checks.outputWrittenReceiptMissingRolledBack = true;

    const committedStorage = `segment-00000000-${randomUUID()}.m4s`;
    const committedTemp = `.tmp-${randomUUID()}.segment`;
    const segmentId = committedStorage.slice("segment-00000000-".length, -".m4s".length);
    const parsed = validateLiveFmp4Fragment(source, validateLiveFmp4Init(fixture.init));
    const chainSha256 = sha256(`${journalSession.chainHeadSha256}\0${0}\0${sourceSha}\0${source.length}`);
    const record: LiveProductSegmentRecord = {
      segmentId,
      sequence: 0,
      durationMs: parsed.durationMs,
      byteLength: source.length,
      sha256: sourceSha,
      previousChainSha256: journalSession.chainHeadSha256,
      chainSha256,
      idempotencyKeyHash: sha256("segment-key\0journal-commit-segment-0001"),
      storageName: committedStorage,
      mfhdSequence: parsed.mfhdSequence,
      baseDecodeTime: parsed.baseDecodeTime.toString(),
      trackTimelines: parsed.tracks.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime.toString(), durationTicks: track.durationTicks.toString(), durationMs: track.durationMs, sampleCount: track.sampleCount, sampleBytes: track.sampleBytes })),
      createdAt: new Date().toISOString(),
    };
    writeJournal(committedStorage, committedTemp);
    fs.writeFileSync(path.join(segmentsDir, committedStorage), source, { flag: "wx" });
    fs.writeFileSync(path.join(sessionDir, "segment-00000000.json"), `${JSON.stringify(record)}\n`, { flag: "wx" });
    assert.equal(journalStore.requireSession(tenantId, journalSession.sessionId).nextSegmentSequence, 0);
    assert.equal(journalStore.reconcileSegmentJournal(tenantId, journalSession.sessionId), "COMMITTED");
    assert.equal(journalStore.requireSession(tenantId, journalSession.sessionId).nextSegmentSequence, 1);
    assert.equal(journalStore.readSegment(tenantId, journalSession.sessionId, segmentId).record.sha256, sourceSha);
    checks.receiptWrittenSessionCommitRecovered = true;
    releaseLiveProductProcessLeasesForContractOnly();

    // 7. A process death after the durable STOPPING checkpoint resumes once.
    const stopRoot = path.join(temp, "stop-crash-store");
    const stopBefore = await createProtected(stopRoot, "stop-crash", 2);
    const stopKey = "stop-crash-key-0001";
    const stopCheckpoint = markStopping(stopBefore.store, stopBefore.session, stopKey);
    await stopBefore.manager.shutdownAll();
    releaseLiveProductProcessLeasesForContractOnly();
    const stopStore = new LiveProductStore(stopRoot);
    const stopManager = new LiveWatermarkWorkerManager(); managers.push(stopManager);
    const stopLifecycle = new LiveProductLifecycle(stopStore, undefined, stopManager);
    const stopRecovered = await stopLifecycle.stopSession({ tenantId, sessionId: stopBefore.session.sessionId, expectedRevision: stopCheckpoint.expectedRevision, idempotencyKey: stopKey });
    assert.equal(stopRecovered.replayed, true);
    assert.equal(stopRecovered.finalVerification?.verdict, "VIDEO_LAYER_VAULT");
    assert.equal(stopStore.listEvents(tenantId, stopBefore.session.sessionId).filter((event) => event.type === "session.stopped").length, 1);
    checks.stopProcessDeathRecoveredExactlyOnce = true;
    await stopManager.shutdownAll();
    releaseLiveProductProcessLeasesForContractOnly();

    // 8. A death after VOD/map finalization but before final exact evidence is
    // resumed from durable artifacts and produces one final decision.
    const finalRoot = path.join(temp, "final-verify-crash-store");
    const finalBefore = await createProtected(finalRoot, "final-crash", 2);
    const finalKey = "final-crash-key-0001";
    const finalCheckpoint = markStopping(finalBefore.store, finalBefore.session, finalKey);
    await finalBefore.manager.shutdownAll();
    finalBefore.store.finalizeManifest(tenantId, finalBefore.session.sessionId);
    finalBefore.store.finalizeRecording(tenantId, finalBefore.session.sessionId);
    const rolling = finalBefore.store.readPrivateJson<LiveRollingSealMapV1>(tenantId, finalBefore.session.sessionId, "rolling-map.json");
    assert(rolling);
    const finalized = finalizeLiveRollingSealMap(rolling);
    finalBefore.store.mutatePrivateJson(tenantId, finalBefore.session.sessionId, "rolling-map.json", rolling, () => finalized);
    finalBefore.store.writePrivateJsonOnce(tenantId, finalBefore.session.sessionId, "rolling-final.json", finalized);
    finalBefore.store.transitionSession(tenantId, finalBefore.session.sessionId, ["STOPPING"], "STOPPING", { watermarkWorkerHealth: "STOPPED", signedMapState: "FINALIZED", finalVerificationState: "PENDING" }, "test.crash.before-final-exact");
    assert.equal(finalBefore.store.readPrivateJson(tenantId, finalBefore.session.sessionId, "final-verification.json"), null);
    releaseLiveProductProcessLeasesForContractOnly();
    const finalStore = new LiveProductStore(finalRoot);
    const finalManager = new LiveWatermarkWorkerManager(); managers.push(finalManager);
    const finalLifecycle = new LiveProductLifecycle(finalStore, undefined, finalManager);
    const finalRecovered = await finalLifecycle.stopSession({ tenantId, sessionId: finalBefore.session.sessionId, expectedRevision: finalCheckpoint.expectedRevision, idempotencyKey: finalKey });
    assert.equal(finalRecovered.replayed, true);
    assert.equal(finalRecovered.finalVerification?.verdict, "VIDEO_LAYER_VAULT");
    assert.equal(finalStore.listEvents(tenantId, finalBefore.session.sessionId).filter((event) => event.type === "session.final-verification.exact").length, 1);
    assert.equal(finalStore.listEvents(tenantId, finalBefore.session.sessionId).filter((event) => event.type === "session.stopped").length, 1);
    checks.finalVerificationProcessDeathRecoveredExactlyOnce = true;
    await finalManager.shutdownAll();
    releaseLiveProductProcessLeasesForContractOnly();

    assert.equal(Object.values(checks).every(Boolean), true);
    process.stdout.write(`${JSON.stringify({ schemaVersion: "tancmark-live-instream-crash-recovery-result-v1", status: "PASSED", checks, duplicateProtectedFragments: 0, duplicateRegistryDecisions: 0, unwatermarkedProtectedPlayback: 0, wrongOwnership: 0, sourceWorkingCopiesPreserved: true, externalNetworkCalls: 0, gatePassed: true }, null, 2)}\n`);
  } finally {
    await Promise.all(managers.map((manager) => manager.shutdownAll().catch(() => undefined)));
    releaseLiveProductProcessLeasesForContractOnly();
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(temp));
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
