import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateLiveFmp4Fragment, validateLiveFmp4Init } from "../../artifacts/api-server/src/live/liveFmp4Validator.ts";
import { LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS, LiveProductLifecycle } from "../../artifacts/api-server/src/live/liveProductLifecycle.ts";
import { LiveProductStore, releaseLiveProductProcessLeasesForContractOnly } from "../../artifacts/api-server/src/live/liveProductStore.ts";
import { LiveWatermarkWorkerManager } from "../../artifacts/api-server/src/live/liveWatermarkWorker.ts";
import { generateLiveFmp4Fixture, generateLiveFmp4FixtureFromRealLocalAvMedia } from "./live_local_product_media_fixture.ts";

const requiredFile = (name: string): string => {
  const value = process.env[name];
  if (!value || !path.isAbsolute(value) || !fs.statSync(value).isFile()) throw new Error(`${name}_required`);
  return value;
};
const digest = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const privateRealSource = (): { path: string; sha256: string } => {
  const manifestPath = requiredFile("TANCMARK_LIVE_REAL_MEDIA_MANIFEST");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { schemaVersion?: string; cases?: Record<string, { path?: string; sha256?: string }> };
  const source = manifest.cases?.["REAL_H264_AAC_48000_STEREO_01"];
  if (manifest.schemaVersion !== "tancmark-live-private-real-media-manifest-v1" || !source || typeof source.path !== "string" || !path.isAbsolute(source.path) || typeof source.sha256 !== "string" || !/^[0-9A-F]{64}$/.test(source.sha256)) {
    throw new Error("live_real_av_private_manifest_invalid");
  }
  return { path: source.path, sha256: source.sha256 };
};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tmw-"));
const manager = new LiveWatermarkWorkerManager();
let debugSession: { tenantId: string; sessionId: string } | null = null;
let debugStore: LiveProductStore | null = null;

async function main(): Promise<void> {
try {
  requiredFile("TANCMARK_LIVE_WATERMARK_PYTHON");
  requiredFile("TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT");
  requiredFile("TANCMARK_LIVE_ADAPTER_C_SCRIPT");
  requiredFile("TANCMARK_LIVE_TEST_FFMPEG");
  requiredFile("TANCMARK_LIVE_TEST_FFPROBE");
  if (!process.env["TANCMARK_LIVE_PLAYBACK_KEYRING"]) throw new Error("TANCMARK_LIVE_PLAYBACK_KEYRING_required");
  const useRealAv = process.env["TANCMARK_LIVE_CONTRACT_REAL_AV"] === "1";
  const source = useRealAv ? privateRealSource() : null;
  if (source && digest(fs.readFileSync(source.path)).toUpperCase() !== source.sha256) throw new Error("live_real_av_private_manifest_hash_mismatch");
  const sourceBefore = source ? { sha256: source.sha256, byteLength: fs.statSync(source.path).size } : null;
  const fixture = source
    ? generateLiveFmp4FixtureFromRealLocalAvMedia(path.join(temp, "fixture"), source.path, source.sha256)
    : generateLiveFmp4Fixture(path.join(temp, "fixture"));
  const rawInitInfo = validateLiveFmp4Init(fixture.init);
  const store = new LiveProductStore(path.join(temp, "store"));
  debugStore = store;
  const lifecycle = new LiveProductLifecycle(store, undefined, manager);
  const tenantId = "live-watermark-contract-tenant";
  let session = lifecycle.createSession({ tenantId, accountId: "live-watermark-contract-account" });
  debugSession = { tenantId, sessionId: session.sessionId };
  assert.equal(session.protectionMode, "PROTECTED_TANCMARK");
  assert.equal(session.expectedIdProvided, false);
  const uploaded = store.uploadInit({ tenantId, sessionId: session.sessionId, bytes: fixture.init, suppliedSha256: digest(fixture.init), idempotencyKey: "protected-init-contract-0001" });
  assert.equal(uploaded.session.initSha256, null);
  assert.equal(uploaded.session.rawInitSha256, digest(fixture.init));
  session = (await lifecycle.startSession({ tenantId, sessionId: session.sessionId, expectedRevision: uploaded.session.revision, idempotencyKey: "protected-start-contract-0001" })).session;
  const latencies: number[] = [];
  let rawVideoSamples = 0;
  let rawAudioSamples = 0;
  let protectedVideoSamples = 0;
  let protectedAudioSamples = 0;
  for (let sequence = 0; sequence < fixture.fragments.length; sequence += 1) {
    const fragment = fixture.fragments[sequence] as Buffer;
    const raw = validateLiveFmp4Fragment(fragment, rawInitInfo);
    rawVideoSamples += raw.tracks.find((track) => rawInitInfo.tracks.find((item) => item.trackId === track.trackId)?.handlerType === "vide")?.sampleCount ?? 0;
    rawAudioSamples += raw.tracks.find((track) => rawInitInfo.tracks.find((item) => item.trackId === track.trackId)?.handlerType === "soun")?.sampleCount ?? 0;
    const started = performance.now();
    const appended = await lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence, durationMs: fixture.durationsMs[sequence] as number, bytes: fragment, suppliedSha256: digest(fragment), idempotencyKey: `protected-segment-contract-${String(sequence).padStart(4, "0")}` });
    latencies.push(performance.now() - started);
    session = appended.session;
    const output = store.readSegment(tenantId, session.sessionId, appended.segment.segmentId);
    const protectedInit = store.readInit(tenantId, session.sessionId);
    const parsed = validateLiveFmp4Fragment(output.bytes, validateLiveFmp4Init(protectedInit.bytes));
    protectedVideoSamples += parsed.tracks.find((track) => protectedInit.record.tracks.find((item) => item.trackId === track.trackId)?.handlerType === "vide")?.sampleCount ?? 0;
    protectedAudioSamples += parsed.tracks.find((track) => protectedInit.record.tracks.find((item) => item.trackId === track.trackId)?.handlerType === "soun")?.sampleCount ?? 0;
    assert.equal(appended.segment.mfhdSequence, raw.mfhdSequence);
    assert.deepEqual(appended.segment.trackTimelines.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime })), raw.tracks.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime.toString() })));
  }
  const stopped = await lifecycle.stopSession({ tenantId, sessionId: session.sessionId, expectedRevision: session.revision, idempotencyKey: "protected-stop-contract-0001" });
  assert.equal(stopped.session.status, "STOPPED");
  assert.equal(stopped.finalVerification?.verdict, "VIDEO_LAYER_VAULT");
  assert.equal(stopped.finalVerification?.final, true);
  assert.equal(stopped.evidence.protectionMode, "PROTECTED_TANCMARK");
  assert.equal(stopped.evidence.identityAuthorityMode, "SERVER_OWNED_SIGNED_EXACT");
  assert.equal(stopped.evidence.ownership, true);
  assert.equal(stopped.evidence.vault, true);
  assert.equal(stopped.evidence.final, true);
  const liveSamples = store.readPrivateJson<{
    fixedFrequencyFragments: number;
    results: Array<{ exactSampleVerified: boolean; rawIdDisclosed: boolean }>;
  }>(tenantId, session.sessionId, "sample-verification.json");
  assert.equal(liveSamples?.fixedFrequencyFragments, LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS);
  assert.equal(liveSamples?.results.length, Math.floor(fixture.fragments.length / LIVE_SAMPLE_VERIFICATION_EVERY_FRAGMENTS));
  assert(liveSamples?.results.every((sample) => sample.exactSampleVerified && sample.rawIdDisclosed === false));
  assert.equal(rawVideoSamples, protectedVideoSamples);
  assert.equal(rawAudioSamples, protectedAudioSamples);
  assert.equal(store.validateSessionHealth(tenantId, session.sessionId)["valid"], true);
  if (source && sourceBefore) assert.deepEqual({ sha256: digest(fs.readFileSync(source.path)).toUpperCase(), byteLength: fs.statSync(source.path).size }, sourceBefore);
  const sorted = [...latencies].sort((left, right) => left - right);
  const percentile = (q: number): number => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)] ?? 0;
  console.log(JSON.stringify({
    contract: "live_instream_watermark_worker_contract",
    status: "passed",
    fragmentCount: fixture.fragments.length,
    sourceKind: fixture.sourceKind,
    sourcePathDisclosed: false,
    sourceUnchanged: sourceBefore !== null,
    rawVideoSamples,
    protectedVideoSamples,
    rawAudioSamples,
    protectedAudioSamples,
    protectedFrameCount: stopped.session.protectedFrameCount,
    channelAFrameCount: stopped.session.channelAFrameCount,
    channelBFrameCount: stopped.session.channelBFrameCount,
    p50FragmentWallMs: Number(percentile(0.5).toFixed(3)),
    p95FragmentWallMs: Number(percentile(0.95).toFixed(3)),
    liveSampleVerification: {
      fixedFrequencyFragments: liveSamples?.fixedFrequencyFragments,
      sampleCount: liveSamples?.results.length,
      exactSampleCount: liveSamples?.results.filter((sample) => sample.exactSampleVerified).length,
    },
    workerHealthAfterStop: manager.health(tenantId, session.sessionId),
    backlogAtEnd: 0,
    finalVerification: stopped.finalVerification ? {
      verdict: stopped.finalVerification.verdict,
      exactIdVerified: stopped.finalVerification.exactIdVerified,
      registryVerified: stopped.finalVerification.registryVerified,
      signatureVerified: stopped.finalVerification.signatureVerified,
      tenantVerified: stopped.finalVerification.tenantVerified,
      accountVerified: stopped.finalVerification.accountVerified,
      uniqueRecord: stopped.finalVerification.uniqueRecord,
      physicalVideoIdVerified: stopped.finalVerification.physicalVideoIdVerified,
      ownership: stopped.finalVerification.ownership,
      vault: stopped.finalVerification.vault,
      confirmed: stopped.finalVerification.confirmed,
      final: stopped.finalVerification.final,
      exactIdDisclosed: false,
      privateMapDisclosed: false,
      registryContentsDisclosed: false,
      decoderDetailsDisclosed: false,
    } : null,
    finalEvidenceAuthority: {
      identityAuthorityMode: stopped.evidence.identityAuthorityMode,
      ownership: stopped.evidence.ownership,
      vault: stopped.evidence.vault,
      final: stopped.evidence.final,
    },
    rawIdDisclosed: false,
    externalNetworkCalls: 0,
  }, null, 2));
} catch (error) {
  if (debugSession) console.error(JSON.stringify({ failClosedWorkerHealth: manager.health(debugSession.tenantId, debugSession.sessionId) }));
  if (debugSession && debugStore) console.error(JSON.stringify({ recentEventTypes: debugStore.listEvents(debugSession.tenantId, debugSession.sessionId).slice(-3).map((event) => event.type) }));
  throw error;
} finally {
  await manager.shutdownAll();
  releaseLiveProductProcessLeasesForContractOnly();
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(temp));
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  fs.rmSync(temp, { recursive: true, force: true });
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
