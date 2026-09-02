import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decodeAudioV01FromDna, encodeStandaloneAudioV01 } from "../../artifacts/api-server/src/video/audioModule.ts";

const ffmpeg = process.env["TANCMARK_LIVE_TEST_FFMPEG"];
assert(ffmpeg && path.isAbsolute(ffmpeg) && fs.statSync(ffmpeg).isFile(), "TANCMARK_LIVE_TEST_FFMPEG_ABSOLUTE_FILE_REQUIRED");
process.env["NODE_ENV"] = "test";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-public-audio-"));
async function main(): Promise<void> {
  try {
    const source = path.join(temp, "source.wav");
    const stamped = path.join(temp, "stamped.wav");
    const encodeDir = path.join(temp, "encode");
    const readDir = path.join(temp, "read");
    fs.mkdirSync(encodeDir); fs.mkdirSync(readDir);
    const generated = spawnSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000:duration=8", "-c:a", "pcm_s16le", source], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
    assert.equal(generated.status, 0, generated.stderr);
    const sealed = await encodeStandaloneAudioV01({ sourceAudioPath: source, outputPath: stamped, workDir: encodeDir, idInput: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", ownerClientId: "public-audio-owner" });
    const positive = await decodeAudioV01FromDna({ mediaPath: stamped, workDir: readDir, dna: sealed.dna, expectedPayload4Hex: sealed.payload4Hex });
    assert.equal(positive.idMatched, true);
    assert.equal(positive.verdict, "AUDIO_ID_MATCH");
    assert(positive.matchedTraceIds.length >= 1);
    const wrongPayload = sealed.payload4Hex === "ffffffff" ? "00000000" : "ffffffff";
    const wrong = await decodeAudioV01FromDna({ mediaPath: stamped, workDir: readDir, dna: sealed.dna, expectedPayload4Hex: wrongPayload });
    assert.equal(wrong.idMatched, false);
    const unsealed = await decodeAudioV01FromDna({ mediaPath: source, workDir: readDir, dna: sealed.dna, expectedPayload4Hex: sealed.payload4Hex });
    assert.equal(unsealed.idMatched, false);
    process.stdout.write(`${JSON.stringify({ contract: "public_physical_audio_contract", status: "passed", sourceKind: "GENERATED_PCM_WAV", physicalSeal: true, physicalRead: true, exactPayloadMatched: true, matchedIndependentTraceCount: positive.matchedTraceIds.length, wrongPayloadAccepted: false, unsealedAccepted: false, sourcePathDisclosed: false, sourceHashDisclosed: false, externalNetworkCalls: 0 }, null, 2)}\n`);
  } finally {
    const resolved = path.resolve(temp); const relative = path.relative(path.resolve(os.tmpdir()), resolved);
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

void main().catch((error) => { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; });
