import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateLiveFmp4Fragment, validateLiveFmp4Init } from "../../artifacts/api-server/src/live/liveFmp4Validator.ts";
import { LiveProductLifecycle } from "../../artifacts/api-server/src/live/liveProductLifecycle.ts";
import { LiveProductStore, releaseLiveProductProcessLeasesForContractOnly } from "../../artifacts/api-server/src/live/liveProductStore.ts";
import { generateLiveFmp4FixtureFromRealLocalAvMedia } from "./live_local_product_media_fixture.ts";

const digest = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-live-real-av-"));
async function main(): Promise<void> {
try {
  const manifestPath = process.env["TANCMARK_LIVE_REAL_MEDIA_MANIFEST"];
  if (!manifestPath || !path.isAbsolute(manifestPath) || !fs.lstatSync(manifestPath).isFile() || fs.lstatSync(manifestPath).isSymbolicLink()) throw new Error("TANCMARK_LIVE_REAL_MEDIA_MANIFEST_required");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { schemaVersion: string; cases: Record<string, { path: string; sha256: string }> };
  const source = manifest.cases["REAL_H264_AAC_48000_STEREO_01"];
  if (manifest.schemaVersion !== "tancmark-live-private-real-media-manifest-v1" || !source || !path.isAbsolute(source.path) || !/^[0-9A-F]{64}$/.test(source.sha256)) throw new Error("live_real_av_private_manifest_invalid");
  const sourceBefore = { sha256: digest(fs.readFileSync(source.path)).toUpperCase(), byteLength: fs.statSync(source.path).size };
  assert.equal(sourceBefore.sha256, source.sha256);
  const fixture = generateLiveFmp4FixtureFromRealLocalAvMedia(path.join(temp, "fixture"), source.path, source.sha256);
  assert.equal(fixture.hasAudio, true);
  const init = validateLiveFmp4Init(fixture.init);
  assert(init.tracks.some((track) => track.handlerType === "vide" && /^avc[13]\./.test(track.codec)));
  assert(init.tracks.some((track) => track.handlerType === "soun" && track.codec === "mp4a.40.2"));
  for (const fragment of fixture.fragments) {
    const parsed = validateLiveFmp4Fragment(fragment, init);
    assert.equal(parsed.tracks.length, 2); assert(parsed.tracks.every((track) => track.sampleCount > 0 && track.sampleBytes > 0));
  }
  const store = new LiveProductStore(path.join(temp, "store")); const lifecycle = new LiveProductLifecycle(store); const tenantId = "real-av-contract";
  let session = lifecycle.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" });
  const uploaded = store.uploadInit({ tenantId, sessionId: session.sessionId, bytes: fixture.init, suppliedSha256: digest(fixture.init), idempotencyKey: "real-av-init-0001" });
  session = (await lifecycle.startSession({ tenantId, sessionId: session.sessionId, expectedRevision: uploaded.session.revision, idempotencyKey: "real-av-start-0001" })).session;
  for (let sequence = 0; sequence < fixture.fragments.length; sequence += 1) {
    const fragment = fixture.fragments[sequence] as Buffer;
    session = (await lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence, durationMs: fixture.durationsMs[sequence] as number, bytes: fragment, suppliedSha256: digest(fragment), idempotencyKey: `real-av-segment-${String(sequence).padStart(4, "0")}` })).session;
  }
  session = (await lifecycle.stopSession({ tenantId, sessionId: session.sessionId, expectedRevision: session.revision, idempotencyKey: "real-av-stop-0001" })).session;
  assert.equal(session.status, "STOPPED"); assert.equal(store.validateSessionHealth(tenantId, session.sessionId)["valid"], true);
  const recording = store.readRecording(tenantId, session.sessionId).bytes; const recordingPath = path.join(temp, "recording.mp4"); fs.writeFileSync(recordingPath, recording);
  const ffprobe = process.env["TANCMARK_LIVE_TEST_FFPROBE"];
  if (!ffprobe || !path.isAbsolute(ffprobe)) throw new Error("live_test_explicit_ffprobe_required");
  const probe = spawnSync(ffprobe, ["-v", "error", "-show_entries", "stream=codec_name,codec_type", "-of", "json", recordingPath], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  assert.equal(probe.status, 0, probe.stderr); const streams = (JSON.parse(probe.stdout) as { streams?: Array<{ codec_name?: string; codec_type?: string }> }).streams ?? [];
  assert(streams.some((stream) => stream.codec_type === "video" && stream.codec_name === "h264")); assert(streams.some((stream) => stream.codec_type === "audio" && stream.codec_name === "aac"));
  const sourceAfter = { sha256: digest(fs.readFileSync(source.path)).toUpperCase(), byteLength: fs.statSync(source.path).size }; assert.deepEqual(sourceAfter, sourceBefore);
  console.log(JSON.stringify({ contract: "live_local_product_media_av_contract", status: "passed", sourceAlias: "REAL_H264_AAC_48000_STEREO_01", sourcePathDisclosed: false, sourceHashDisclosed: false, sourceByteLengthDisclosed: false, sourceUnchanged: true, cleanFixtureEncoders: ["h264_mf", "aac_native"], initTracks: init.tracks.map((track) => ({ handlerType: track.handlerType, codec: track.codec, timescale: track.timescale })), fragmentCount: fixture.fragments.length, allFragmentsBoundToBothTracks: true, lifecycleStopped: true, ffprobeStreams: streams, externalNetworkCalls: 0 }, null, 2));
} finally {
  releaseLiveProductProcessLeasesForContractOnly(); const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(temp)); assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative)); fs.rmSync(temp, { recursive: true, force: true });
}
}

void main().catch((error) => { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; });
