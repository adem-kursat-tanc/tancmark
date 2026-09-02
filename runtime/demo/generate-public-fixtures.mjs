import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINUX_DEMO_FFMPEG_SHA256 =
  "69274076177abb5a998133711361addcd347d446327655ef0be1dbc751e62c11";
const SEED = "tancmark-demo-public-synthetic-v1";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const destination = path.join(root, "fixtures", "demo-public");
const ffmpeg = process.env["TANCMARK_DEMO_FFMPEG"]?.trim();

assert(ffmpeg && path.isAbsolute(ffmpeg), "TANCMARK_DEMO_FFMPEG_ABSOLUTE_PATH_REQUIRED");
assert.equal(path.basename(ffmpeg), "ffmpeg", "TANCMARK_DEMO_FFMPEG_BASENAME_INVALID");
assert.equal(fs.lstatSync(ffmpeg).isFile(), true, "TANCMARK_DEMO_FFMPEG_FILE_REQUIRED");
assert.equal(fs.lstatSync(ffmpeg).isSymbolicLink(), false, "TANCMARK_DEMO_FFMPEG_SYMLINK_REJECTED");
assert.equal(sha256File(ffmpeg), LINUX_DEMO_FFMPEG_SHA256, "TANCMARK_DEMO_FFMPEG_SHA256_MISMATCH");

const version = run(["-hide_banner", "-version"]);
assert.match(version, /^ffmpeg version 8\.1\.2-tancmark-codespaces-linux-demo-v1/m);
assert.match(version, /--disable-gpl/);
assert.match(version, /--disable-nonfree/);

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-demo-fixtures-"));
try {
  fs.writeFileSync(
    path.join(stage, "demo-text-en.txt"),
    "TancMark public synthetic demo text. This deterministic example contains no personal, customer, or production information. It exists only to exercise the real text sealing and recovery engine.\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(stage, "demo-text-tr.txt"),
    "TancMark kamuya açık yapay demo metni. Bu belirlenebilir örnek hiçbir kişisel, müşteri veya üretim bilgisi içermez. Yalnız gerçek metin mühürleme ve okuma motorunu çalıştırmak için vardır.\n",
    "utf8",
  );

  generateImage(path.join(stage, "demo-image.png"));
  generateAudio(path.join(stage, "demo-audio-44100.wav"), 44_100);
  generateAudio(path.join(stage, "demo-audio-48000.wav"), 48_000);
  generateVideo(path.join(stage, "demo-video-source.mkv"), 8, 640, 360);
  generateVideo(path.join(stage, "demo-live-source.mkv"), 16, 640, 360);

  const specs = [
    { name: "demo-text-en.txt", kind: "text", language: "en", characters: 178 },
    { name: "demo-text-tr.txt", kind: "text", language: "tr", characters: 179 },
    { name: "demo-image.png", kind: "image", width: 512, height: 512, format: "PNG" },
    { name: "demo-audio-44100.wav", kind: "audio", sampleRate: 44_100, channels: 2, durationSec: 10, format: "PCM_S16LE_WAV" },
    { name: "demo-audio-48000.wav", kind: "audio", sampleRate: 48_000, channels: 2, durationSec: 10, format: "PCM_S16LE_WAV" },
    { name: "demo-video-source.mkv", kind: "video", width: 640, height: 360, fps: 24, durationSec: 8, format: "FFV1_PCM_MATROSKA" },
    { name: "demo-live-source.mkv", kind: "live-source", width: 640, height: 360, fps: 24, durationSec: 16, format: "FFV1_PCM_MATROSKA" },
  ];
  const files = specs.map((spec) => {
    const filePath = path.join(stage, spec.name);
    return {
      ...spec,
      bytes: fs.statSync(filePath).size,
      sha256: sha256File(filePath),
      deterministicSeed: SEED,
      publicSafe: true,
      provenance: "Generated locally by TancMark from mathematical text, color-bar, shape, and multi-tone functions.",
      license: "AGPL-3.0-only",
    };
  });
  fs.writeFileSync(
    path.join(stage, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: "tancmark-demo-public-fixtures-v1",
      deterministicSeed: SEED,
      publicSafeDeclaration:
        "All files are programmatically generated. No customer, private, copyrighted stock, camera, microphone, or production data is used.",
      generator: "runtime/demo/generate-public-fixtures.mjs",
      ffmpeg: {
        version: "8.1.2-tancmark-codespaces-linux-demo-v1",
        sha256: LINUX_DEMO_FFMPEG_SHA256,
      },
      files,
    }, null, 2)}\n`,
    "utf8",
  );

  fs.mkdirSync(destination, { recursive: true });
  for (const name of [...specs.map((entry) => entry.name), "manifest.json"]) {
    fs.copyFileSync(path.join(stage, name), path.join(destination, name));
  }
  process.stdout.write(`${JSON.stringify({ status: "DEMO_PUBLIC_FIXTURES_GENERATED", fileCount: files.length, files }, null, 2)}\n`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}

function generateImage(output) {
  run([
    "-y", "-hide_banner", "-loglevel", "error", "-bitexact", "-fflags", "+bitexact",
    "-f", "lavfi", "-i", "testsrc2=size=512x512:rate=1:duration=1",
    "-vf", "drawbox=x=40:y=40:w=432:h=432:color=white@0.35:t=4,drawbox=x=76:y=106:w=150:h=88:color=0x19C37D@0.85:t=fill,drawbox=x=274:y=286:w=162:h=126:color=0x2F6FED@0.85:t=fill",
    "-frames:v", "1", "-c:v", "png", "-flags:v", "+bitexact", output,
  ]);
}

function generateAudio(output, sampleRate) {
  const expression = "0.12*sin(2*PI*440*t)+0.07*sin(2*PI*997*t)|0.11*sin(2*PI*554.37*t)+0.06*sin(2*PI*1499*t)";
  run([
    "-y", "-hide_banner", "-loglevel", "error", "-bitexact", "-fflags", "+bitexact",
    "-f", "lavfi", "-i", `aevalsrc=${expression}:s=${sampleRate}:d=10`,
    "-map_metadata", "-1", "-c:a", "pcm_s16le", "-flags:a", "+bitexact", output,
  ]);
}

function generateVideo(output, duration, width, height) {
  const expression = "0.10*sin(2*PI*330*t)+0.06*sin(2*PI*880*t)|0.10*sin(2*PI*392*t)+0.06*sin(2*PI*1175*t)";
  run([
    "-y", "-hide_banner", "-loglevel", "error", "-bitexact", "-fflags", "+bitexact",
    "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=24:duration=${duration}`,
    "-f", "lavfi", "-i", `aevalsrc=${expression}:s=48000:d=${duration}`,
    "-map", "0:v:0", "-map", "1:a:0", "-map_metadata", "-1",
    "-c:v", "ffv1", "-level", "3", "-coder", "1", "-context", "1", "-g", "1", "-pix_fmt", "yuv420p",
    "-c:a", "pcm_s16le", "-shortest", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
    "-write_crc32", "0", output,
  ]);
  normalizeMatroskaUids(output, duration);
}

function normalizeMatroskaUids(filePath, duration) {
  const bytes = fs.readFileSync(filePath);
  const segmentUidMarker = Buffer.from([0x73, 0xa4, 0x90]);
  const trackUidMarker = Buffer.from([0x73, 0xc5, 0x88]);
  const tagTrackUidMarker = Buffer.from([0x63, 0xc5, 0x88]);
  const segmentLocations = findAll(bytes, segmentUidMarker);
  const trackLocations = findAll(bytes, trackUidMarker);
  const tagTrackLocations = findAll(bytes, tagTrackUidMarker);

  assert.equal(segmentLocations.length, 1, "MATROSKA_SEGMENT_UID_COUNT_MISMATCH");
  assert.equal(trackLocations.length, 2, "MATROSKA_TRACK_UID_COUNT_MISMATCH");
  assert.equal(tagTrackLocations.length, 2, "MATROSKA_TAG_TRACK_UID_COUNT_MISMATCH");

  const originalTrackUids = trackLocations.map((location) =>
    Buffer.from(bytes.subarray(location + trackUidMarker.length, location + trackUidMarker.length + 8)),
  );
  assert.notEqual(originalTrackUids[0].compare(originalTrackUids[1]), 0, "MATROSKA_TRACK_UIDS_NOT_UNIQUE");

  const fixedSegmentUid = deterministicBytes(`${SEED}:matroska:${duration}:segment`, 16);
  fixedSegmentUid.copy(bytes, segmentLocations[0] + segmentUidMarker.length);

  const fixedTrackUids = originalTrackUids.map((_, index) =>
    deterministicBytes(`${SEED}:matroska:${duration}:track:${index}`, 8),
  );
  for (let index = 0; index < trackLocations.length; index += 1) {
    fixedTrackUids[index].copy(bytes, trackLocations[index] + trackUidMarker.length);
  }

  const matchedTagIndexes = new Set();
  for (const location of tagTrackLocations) {
    const originalTagUid = bytes.subarray(
      location + tagTrackUidMarker.length,
      location + tagTrackUidMarker.length + 8,
    );
    const trackIndex = originalTrackUids.findIndex((uid) => uid.equals(originalTagUid));
    assert.notEqual(trackIndex, -1, "MATROSKA_TAG_TRACK_UID_NOT_FOUND");
    assert.equal(matchedTagIndexes.has(trackIndex), false, "MATROSKA_TAG_TRACK_UID_DUPLICATED");
    matchedTagIndexes.add(trackIndex);
    fixedTrackUids[trackIndex].copy(bytes, location + tagTrackUidMarker.length);
  }
  assert.equal(matchedTagIndexes.size, 2, "MATROSKA_TAG_TRACK_UID_COVERAGE_MISMATCH");
  fs.writeFileSync(filePath, bytes);
}

function deterministicBytes(label, length) {
  const value = createHash("sha256").update(label, "utf8").digest().subarray(0, length);
  assert(value.some((byte) => byte !== 0), "DETERMINISTIC_UID_MUST_NOT_BE_ZERO");
  return value;
}

function findAll(haystack, needle) {
  const locations = [];
  for (let offset = 0; offset <= haystack.length - needle.length;) {
    const location = haystack.indexOf(needle, offset);
    if (location === -1) break;
    locations.push(location);
    offset = location + needle.length;
  }
  return locations;
}

function run(args) {
  const result = spawnSync(ffmpeg, args, {
    encoding: "utf8",
    timeout: 180_000,
    env: {
      PATH: "/usr/bin:/bin",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      LD_LIBRARY_PATH: process.env["TANCMARK_DEMO_LD_LIBRARY_PATH"] ?? "",
    },
  });
  if (result.status !== 0) {
    throw new Error(`fixture_ffmpeg_failed:${result.status}:${(result.stderr ?? "").slice(-2000)}`);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
