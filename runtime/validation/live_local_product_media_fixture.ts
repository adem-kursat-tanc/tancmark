import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface LiveMediaFixture { init: Buffer; fragments: Buffer[]; durationsMs: number[]; ffmpeg: string; ffmpegBuild: string; generatedByExternalTestProcess: true; sourceKind: "STRUCTURAL_SYNTHETIC" | "HASH_VERIFIED_REAL_LOCAL_MEDIA"; sourceSha256: string | null; hasAudio: boolean }

export interface LiveRealFixtureOptions {
  durationSeconds?: number;
  audioSampleRate?: 44_100 | 48_000;
  audioChannels?: 1 | 2;
  targetFrameRate?: number;
  fragmentTargetSeconds?: number;
  videoFilter?: string;
}

function verifiedCleanFfmpeg(): { path: string; build: string } {
  const ffmpeg = process.env["TANCMARK_LIVE_TEST_FFMPEG"];
  if (!ffmpeg || !path.isAbsolute(ffmpeg) || !fs.statSync(ffmpeg).isFile()) throw new Error("live_test_fixture_explicit_ffmpeg_8_1_2_required");
  const version = spawnSync(ffmpeg, ["-hide_banner", "-version"], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
  const build = version.stdout;
  if (version.status !== 0 || !/^ffmpeg version 8\.1\.2(?:-|\b)/m.test(build) || !build.includes("--disable-gpl") || !build.includes("--disable-nonfree") || !build.includes("--disable-network") || build.includes("--enable-libx264") || build.includes("--enable-libx265")) throw new Error("live_test_fixture_clean_ffmpeg_8_1_2_required");
  const encoders = spawnSync(ffmpeg, ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
  if (encoders.status !== 0 || !/\bh264_mf\b/.test(encoders.stdout) || !/\bAAC\b.*\baac\b/i.test(encoders.stdout) || /\blibx26[45]\b/.test(encoders.stdout)) throw new Error("live_test_fixture_license_clean_avc_aac_encoder_required");
  return { path: ffmpeg, build: build.split(/\r?\n/)[0] ?? "ffmpeg-8.1.2" };
}

function buildFixture(
  outputDir: string,
  sourceArgs: string[],
  sourceKind: LiveMediaFixture["sourceKind"],
  sourceSha256: string | null,
  includeAudio = false,
  options: LiveRealFixtureOptions = {},
): LiveMediaFixture {
  fs.mkdirSync(outputDir, { recursive: true });
  const ffmpeg = verifiedCleanFfmpeg();
  const manifest = path.join(outputDir, "fixture.m3u8");
  const sampleRate = options.audioSampleRate ?? 44_100;
  const audioChannels = options.audioChannels ?? 2;
  const targetFrameRate = options.targetFrameRate ?? 20;
  const fragmentTargetSeconds = options.fragmentTargetSeconds ?? 0.2;
  if (!Number.isFinite(targetFrameRate) || targetFrameRate < 1 || targetFrameRate > 120 ||
      !Number.isFinite(fragmentTargetSeconds) || fragmentTargetSeconds < 0.1 || fragmentTargetSeconds > 4) {
    throw new Error("live_test_fixture_timing_options_invalid");
  }
  const audioArgs = includeAudio ? ["-map", "0:v:0", "-map", "0:a:0", "-c:a", "aac", "-b:a", "128k", "-ar", String(sampleRate), "-ac", String(audioChannels), "-shortest"] : ["-an"];
  const videoFilterArgs = options.videoFilter ? ["-vf", options.videoFilter] : [];
  const keyframeInterval = Math.max(2, Math.round(targetFrameRate * fragmentTargetSeconds));
  const result = spawnSync(ffmpeg.path, ["-hide_banner", "-loglevel", "error", ...sourceArgs, ...audioArgs, ...videoFilterArgs, "-r", String(targetFrameRate), "-c:v", "h264_mf", "-rate_control", "quality", "-pix_fmt", "nv12", "-g", String(keyframeInterval), "-force_key_frames", `expr:gte(t,n_forced*${fragmentTargetSeconds})`, "-f", "hls", "-hls_time", String(fragmentTargetSeconds), "-hls_list_size", "0", "-hls_segment_type", "fmp4", "-hls_fmp4_init_filename", "init.mp4", "-hls_segment_filename", "segment-%04d.m4s", "fixture.m3u8"], { cwd: outputDir, encoding: "utf8", windowsHide: true, timeout: options.durationSeconds && options.durationSeconds > 120 ? 600_000 : 120_000 });
  if (result.status !== 0) throw new Error(`live_test_fixture_ffmpeg_failed:${(result.stderr || result.error?.message || "unknown").slice(0, 500)}`);
  const text = fs.readFileSync(manifest, "utf8");
  const names = text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.endsWith(".m4s"));
  const durationsMs = [...text.matchAll(/^#EXTINF:([0-9.]+),/gm)].map((match) => Math.round(Number(match[1]) * 1000));
  const maximumObservedDurationMs = Math.max(500, Math.ceil(fragmentTargetSeconds * 1_500));
  if (names.length < 2 || names.length !== durationsMs.length || durationsMs.some((duration) => duration < 100 || duration > maximumObservedDurationMs)) throw new Error("live_test_fixture_llhls_part_duration_invalid");
  return { init: fs.readFileSync(path.join(outputDir, "init.mp4")), fragments: names.map((name) => fs.readFileSync(path.join(outputDir, name))), durationsMs, ffmpeg: ffmpeg.path, ffmpegBuild: ffmpeg.build, generatedByExternalTestProcess: true, sourceKind, sourceSha256, hasAudio: includeAudio };
}

/** Structural fixture only. Product runtime never imports this module. */
export function generateLiveFmp4Fixture(outputDir: string): LiveMediaFixture {
  return buildFixture(outputDir, ["-f", "lavfi", "-i", "testsrc=size=320x240:rate=20", "-t", "2"], "STRUCTURAL_SYNTHETIC", null);
}

/** Hash-verified real local corpus; source is read-only and never modified. */
export function generateLiveFmp4FixtureFromRealLocalMedia(outputDir: string, sourcePath: string, expectedSha256: string): LiveMediaFixture {
  if (!path.isAbsolute(sourcePath) || !fs.statSync(sourcePath).isFile() || !/^[0-9A-F]{64}$/.test(expectedSha256)) throw new Error("live_test_real_corpus_input_invalid");
  const observed = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex").toUpperCase();
  if (observed !== expectedSha256) throw new Error("live_test_real_corpus_hash_mismatch");
  return buildFixture(outputDir, ["-i", sourcePath], "HASH_VERIFIED_REAL_LOCAL_MEDIA", observed);
}

/** Hash-verified real local H.264+AAC source; clean native AAC plus h264_mf test fixture only. */
export function generateLiveFmp4FixtureFromRealLocalAvMedia(
  outputDir: string,
  sourcePath: string,
  expectedSha256: string,
  options: LiveRealFixtureOptions = {},
): LiveMediaFixture {
  if (!path.isAbsolute(sourcePath) || !fs.statSync(sourcePath).isFile() || !/^[0-9A-F]{64}$/.test(expectedSha256)) throw new Error("live_test_real_av_corpus_input_invalid");
  const observed = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex").toUpperCase();
  if (observed !== expectedSha256) throw new Error("live_test_real_av_corpus_hash_mismatch");
  const durationSeconds = options.durationSeconds ?? 3;
  return buildFixture(
    outputDir,
    ["-i", sourcePath, "-t", String(durationSeconds)],
    "HASH_VERIFIED_REAL_LOCAL_MEDIA",
    observed,
    true,
    { ...options, durationSeconds },
  );
}

/** Full-duration hash-verified real local source for a paced 1x Live simulation. */
export function generateFullDurationLiveFmp4FixtureFromRealLocalAvMedia(
  outputDir: string,
  sourcePath: string,
  expectedSha256: string,
  options: Omit<LiveRealFixtureOptions, "durationSeconds"> = {},
): LiveMediaFixture {
  if (!path.isAbsolute(sourcePath) || !fs.statSync(sourcePath).isFile() || !/^[0-9A-F]{64}$/.test(expectedSha256)) throw new Error("live_test_real_av_corpus_input_invalid");
  const observed = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex").toUpperCase();
  if (observed !== expectedSha256) throw new Error("live_test_real_av_corpus_hash_mismatch");
  return buildFixture(
    outputDir,
    ["-i", sourcePath],
    "HASH_VERIFIED_REAL_LOCAL_MEDIA",
    observed,
    true,
    { ...options, durationSeconds: 464 },
  );
}
