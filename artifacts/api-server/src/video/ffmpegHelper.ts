import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { assertCanonicalReaderInvocationAllowed } from "./canonicalReaderLiveScope";
import {
  approvedMediaRuntimeChildEnvironment,
  resolveMediaRuntimePath,
} from "./mediaRuntimePathResolver";

export interface VideoInfo {
  durationSec: number;
  fps: number;
  averageFps: number;
  writebackFps: number;
  rFrameRate: string | null;
  avgFrameRate: string | null;
  rateModeHint: "RATE_ALIGNED" | "VFR_OR_RATE_DIVERGENCE";
  width: number;
  height: number;
  frameCount: number;
}

export interface MediaStreamInfo {
  hasVideo: boolean;
  hasAudio: boolean;
  hasSubtitle: boolean;
  videoCodecs: string[];
  audioCodecs: string[];
  subtitleCodecs: string[];
}

export interface MediaStreamInventory {
  streams: Array<{
    index: number;
    type: string;
    codec: string;
    codecTag: string | null;
    metadataKeys: string[];
    sideDataTypes: string[];
    rotation: number;
  }>;
  counts: Record<string, number>;
  chapterCount: number;
  globalMetadataKeys: string[];
  formatNames: string[];
}

export interface StreamingWritebackPreflight {
  safeForStreaming: boolean;
  selectedAdapter: "streaming_ffv1" | "legacy_ffv1";
  fallbackReasons: string[];
  inventory: MediaStreamInventory;
  policy: {
    unsupportedUntilMeasured: string[];
    explicitStreamMappingRequired: true;
    metadataInspected: true;
    orientationInspected: true;
  };
}

function runFfprobe(args: string[]): Promise<string> {
  assertCanonicalReaderInvocationAllowed();
  return new Promise((resolve, reject) => {
    const p = spawn(resolveMediaRuntimePath("ffprobe"), args, {
      windowsHide: true,
      env: approvedMediaRuntimeChildEnvironment(),
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`ffprobe exit ${code}: ${err}`));
    });
  });
}

function runFfmpeg(args: string[], timeoutMs = 120_000): Promise<void> {
  assertCanonicalReaderInvocationAllowed();
  return new Promise((resolve, reject) => {
    // Force single-thread filtering globally so frame-level operations
    // (scale, gblur, noise, select, etc.) produce bit-identical output
    // across runs. Caller-side -threads/-x264-params still apply.
    const detPrefix = ["-y", "-hide_banner", "-loglevel", "error",
      "-filter_threads", "1", "-filter_complex_threads", "1"];
    const p = spawn(resolveMediaRuntimePath("ffmpeg"), [...detPrefix, ...args], {
      windowsHide: true,
      env: approvedMediaRuntimeChildEnvironment(),
    });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err}`));
    });
  });
}

export async function videoInfo(videoPath: string): Promise<VideoInfo> {
  const json = await runFfprobe([
    "-v", "error",
    "-select_streams", "v:0",
    // FFprobe 8.x treats a later -show_entries option as replacement rather
    // than accumulation. A second option here erased the selected stream
    // fields and made valid long MP4 files appear as width/height/frameCount
    // zero. Keep format and stream fields in one deterministic expression.
    "-show_entries", "format=duration:stream=width,height,r_frame_rate,avg_frame_rate,duration,nb_frames",
    "-of", "json",
    videoPath,
  ]);
  const parsed = JSON.parse(json) as {
    streams?: Array<{
      width?: number;
      height?: number;
      r_frame_rate?: string;
      avg_frame_rate?: string;
      duration?: string;
      nb_frames?: string;
    }>;
    format?: { duration?: string };
  };
  const s = parsed.streams?.[0] ?? {};
  const width = s.width ?? 0;
  const height = s.height ?? 0;
  let fps = 30;
  if (s.r_frame_rate) {
    const parts = s.r_frame_rate.split("/").map((v) => parseFloat(v));
    if (parts.length === 2 && parts[1]! !== 0) fps = parts[0]! / parts[1]!;
  }
  let averageFps = fps;
  if (s.avg_frame_rate) {
    const parts = s.avg_frame_rate.split("/").map((v) => parseFloat(v));
    if (parts.length === 2 && parts[1]! !== 0) {
      const parsed = parts[0]! / parts[1]!;
      if (Number.isFinite(parsed) && parsed > 0) averageFps = parsed;
    }
  }
  const durationSec = parseFloat(s.duration ?? parsed.format?.duration ?? "0") || 0;
  const frameCount = s.nb_frames ? parseInt(s.nb_frames, 10) : Math.round(durationSec * fps);
  // Both historical replacement transports (image2 PNG and rawvideo pipe)
  // carry pixels but not source frame PTS. Rebuilding their encoder timeline
  // from r_frame_rate can therefore speed up VFR sources. avg_frame_rate is
  // the measured frame-count/time ratio and preserves the source duration
  // without changing physical stamp selection, thresholds, payload, or IDs.
  const writebackFps = averageFps > 0 ? averageFps : fps;
  return {
    durationSec,
    fps,
    averageFps,
    writebackFps,
    rFrameRate: s.r_frame_rate ?? null,
    avgFrameRate: s.avg_frame_rate ?? null,
    rateModeHint:
      Math.abs(fps - averageFps) <= 1e-6
        ? "RATE_ALIGNED"
        : "VFR_OR_RATE_DIVERGENCE",
    width,
    height,
    frameCount,
  };
}

export async function mediaStreamInfo(videoPath: string): Promise<MediaStreamInfo> {
  const json = await runFfprobe([
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name",
    "-of", "json",
    videoPath,
  ]);
  const parsed = JSON.parse(json) as {
    streams?: Array<{ codec_type?: string; codec_name?: string }>;
  };
  const videoCodecs: string[] = [];
  const audioCodecs: string[] = [];
  const subtitleCodecs: string[] = [];
  for (const stream of parsed.streams ?? []) {
    const codec = stream.codec_name ?? "unknown";
    if (stream.codec_type === "video") videoCodecs.push(codec);
    if (stream.codec_type === "audio") audioCodecs.push(codec);
    if (stream.codec_type === "subtitle") subtitleCodecs.push(codec);
  }
  return {
    hasVideo: videoCodecs.length > 0,
    hasAudio: audioCodecs.length > 0,
    hasSubtitle: subtitleCodecs.length > 0,
    videoCodecs,
    audioCodecs,
    subtitleCodecs,
  };
}

export async function mediaStreamInventory(
  mediaPath: string,
): Promise<MediaStreamInventory> {
  const json = await runFfprobe([
    "-v", "error",
    "-show_streams",
    "-show_chapters",
    "-show_format",
    "-of", "json",
    mediaPath,
  ]);
  const parsed = JSON.parse(json) as {
    streams?: Array<{
      index?: number;
      codec_type?: string;
      codec_name?: string;
      codec_tag_string?: string;
      tags?: Record<string, string>;
      side_data_list?: Array<{ side_data_type?: string; rotation?: number }>;
    }>;
    chapters?: unknown[];
    format?: { format_name?: string; tags?: Record<string, string> };
  };
  const streams = (parsed.streams ?? []).map((stream, position) => {
    const sideData = stream.side_data_list ?? [];
    const rotation = sideData
      .map((item) => Number(item.rotation))
      .find((value) => Number.isFinite(value)) ??
      Number(stream.tags?.["rotate"] ?? 0);
    return {
      index: stream.index ?? position,
      type: stream.codec_type ?? "unknown",
      codec: stream.codec_name ?? "unknown",
      codecTag: stream.codec_tag_string ?? null,
      metadataKeys: Object.keys(stream.tags ?? {}).sort(),
      sideDataTypes: sideData
        .map((item) => item.side_data_type)
        .filter((value): value is string => typeof value === "string")
        .sort(),
      rotation: Number.isFinite(rotation) ? rotation : 0,
    };
  });
  const counts: Record<string, number> = {};
  for (const stream of streams) counts[stream.type] = (counts[stream.type] ?? 0) + 1;
  return {
    streams,
    counts,
    chapterCount: parsed.chapters?.length ?? 0,
    globalMetadataKeys: Object.keys(parsed.format?.tags ?? {}).sort(),
    formatNames: (parsed.format?.format_name ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export async function preflightStreamingWriteback(
  sourceMediaPath: string,
): Promise<StreamingWritebackPreflight> {
  const inventory = await mediaStreamInventory(sourceMediaPath);
  const reasons: string[] = [];
  if ((inventory.counts["video"] ?? 0) !== 1) {
    reasons.push("REQUIRES_EXACTLY_ONE_VIDEO_STREAM");
  }
  if ((inventory.counts["audio"] ?? 0) > 1) {
    reasons.push("MULTIPLE_AUDIO_STREAMS_NOT_MEASURED");
  }
  for (const type of ["subtitle", "data", "attachment"] as const) {
    if ((inventory.counts[type] ?? 0) > 0) {
      reasons.push(`${type.toUpperCase()}_STREAM_NOT_MEASURED`);
    }
  }
  if (inventory.chapterCount > 0) reasons.push("CHAPTERS_NOT_MEASURED");
  const knownTypes = new Set(["video", "audio", "subtitle", "data", "attachment"]);
  if (inventory.streams.some((stream) => !knownTypes.has(stream.type))) {
    reasons.push("UNKNOWN_STREAM_TYPE");
  }
  return {
    safeForStreaming: reasons.length === 0,
    selectedAdapter: reasons.length === 0 ? "streaming_ffv1" : "legacy_ffv1",
    fallbackReasons: reasons,
    inventory,
    policy: {
      unsupportedUntilMeasured: ["subtitle", "data", "attachment", "chapter"],
      explicitStreamMappingRequired: true,
      metadataInspected: true,
      orientationInspected: true,
    },
  };
}

/** Sample N frame timestamps (sn) across video.
 *  Strategy: start (0.5s pad) + end (-0.5s pad) + middle + uniform interior.
 *  Always includes start, middle, end (ilk 3) for predictable easy-stage. */
export function sampleTimestamps(durationSec: number, count: number): number[] {
  if (count <= 0) return [];
  const safeDur = Math.max(0.5, durationSec);
  const pad = Math.min(0.3, safeDur * 0.1);
  const start = pad;
  const end = Math.max(start + 0.1, safeDur - pad);
  if (count === 1) return [(start + end) / 2];
  if (count === 2) return [start, end];
  const mid = (start + end) / 2;
  if (count === 3) return [start, mid, end];
  const out: number[] = [start, mid, end];
  const interior = count - 3;
  for (let i = 1; i <= interior; i++) {
    const t = start + ((end - start) * i) / (interior + 1);
    out.push(t);
  }
  return out.sort((a, b) => a - b);
}

/** Extract frames at given timestamps. Returns array of PNG file paths. */
export async function extractFrames(
  videoPath: string,
  timestamps: number[],
  outDir: string,
): Promise<Array<{ tsSec: number; pngPath: string }>> {
  // codeql[js/path-injection] Reported flow is the impossible text-to-video branch; callers pass an invocation-owned decoder directory.
  fs.mkdirSync(outDir, { recursive: true });
  const results: Array<{ tsSec: number; pngPath: string }> = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i]!;
    const out = path.join(outDir, `frame_${i.toString().padStart(3, "0")}_t${ts.toFixed(2)}.png`);
    await runFfmpeg([
      "-ss", String(ts),
      "-i", videoPath,
      "-frames:v", "1",
      "-f", "image2",
      out,
    ], 30_000);
    results.push({ tsSec: ts, pngPath: out });
  }
  return results;
}

export type VideoWritebackAdapter =
  | "legacy_ffv1"
  | "streaming_ffv1"
  | "auto"
  | "pyav_candidate"
  | "unified_pts_watermark_adapter_c"
  | "selective_packet_candidate";

export interface VideoWritebackMetrics {
  adapter:
    | "legacy_ffv1"
    | "streaming_ffv1"
    | "unified_pts_watermark_adapter_c";
  requestedAdapter?: VideoWritebackAdapter;
  fallbackReason?: string[];
  preflight?: StreamingWritebackPreflight;
  postflight?: {
    pass: boolean;
    failures: string[];
    sourceFrames: number;
    outputFrames: number;
    sourceDurationSec: number;
    outputDurationSec: number;
  };
  threads: 1 | 4;
  framesProcessed: number;
  replacementFrames: number;
  fullFrameTempFiles: number;
  peakTempBytes: number;
  peakBufferedFrameBytes: number;
  phaseMs: {
    decode: number | "NOT_SEPARABLE_SINGLE_PIPELINE";
    replacement: number | "INCLUDED_IN_SINGLE_PIPELINE";
    encode: number | "NOT_SEPARABLE_SINGLE_PIPELINE";
    streamingPipeline: number | "NOT_APPLICABLE";
  };
  outputBytes: number;
  wallMs: number;
}

/**
 * The preserved legacy adapter remains available as an explicit override.
 * Auto is the integrated resolver: it selects streaming only for measured
 * layouts and otherwise fails over to legacy with an auditable reason.
 */
export function resolveVideoWritebackAdapter(
  raw = process.env.TANCMARK_VIDEO_WRITEBACK_ADAPTER,
): VideoWritebackAdapter {
  const value = (raw ?? "auto").trim() || "auto";
  if (value === "streaming_ffv1_candidate") return "streaming_ffv1";
  if (
    value === "legacy_ffv1" ||
    value === "streaming_ffv1" ||
    value === "auto" ||
    value === "pyav_candidate" ||
    value === "unified_pts_watermark_adapter_c" ||
    value === "selective_packet_candidate"
  ) {
    return value;
  }
  throw new Error(`Unsupported TANCMARK_VIDEO_WRITEBACK_ADAPTER: ${value}`);
}

export function resolveVideoWritebackThreads(
  raw = process.env.TANCMARK_VIDEO_WRITEBACK_THREADS,
): 1 | 4 {
  const value = (raw ?? "1").trim() || "1";
  if (value === "1") return 1;
  if (value === "4") return 4;
  throw new Error(`Unsupported TANCMARK_VIDEO_WRITEBACK_THREADS: ${value}`);
}

/** Historical recovered path: all frames are materialized as PNG files. */
export async function replaceFramesInVideoLegacy(
  sourceVideoPath: string,
  replacements: Array<{ frameIdx: number; pngPath: string }>,
  outPath: string,
  fps: number,
  timeoutMs = 180_000,
): Promise<VideoWritebackMetrics> {
  const startedAt = Date.now();
  const threads = resolveVideoWritebackThreads();
  const tmpDir = path.join(path.dirname(outPath), `_frames_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  let fullFrameTempFiles = 0;
  let peakTempBytes = 0;
  let decodeMs = 0;
  let replacementMs = 0;
  let encodeMs = 0;
  try {
    // Extract all frames as PNGs.
    const decodeStartedAt = Date.now();
    await runFfmpeg([
      "-i", sourceVideoPath,
      "-vsync", "0",
      "-f", "image2",
      path.join(tmpDir, "f_%06d.png"),
    ], timeoutMs);
    decodeMs = Date.now() - decodeStartedAt;
    fullFrameTempFiles = fs.readdirSync(tmpDir).filter((name) =>
      /^f_\d{6}\.png$/i.test(name),
    ).length;
    // Overwrite specific indices (1-based).
    const replacementStartedAt = Date.now();
    for (const r of replacements) {
      const target = path.join(tmpDir, `f_${(r.frameIdx + 1).toString().padStart(6, "0")}.png`);
      fs.copyFileSync(r.pngPath, target);
    }
    replacementMs = Date.now() - replacementStartedAt;
    peakTempBytes = fs.readdirSync(tmpDir).reduce((total, name) => {
      const candidate = path.join(tmpDir, name);
      return total + (fs.statSync(candidate).isFile() ? fs.statSync(candidate).size : 0);
    }, 0);
    // Re-encode using FFV1 in Matroska container — LOSSLESS so L1 stamp
    // survives the encode→attack→decode roundtrip. Baseline ("copy" remux)
    // preserves stamp bit-exact; lossy attacks (libx264 recompress, etc.)
    // erode it as intended. `-threads 1` for bit-identical output across
    // runs (FFV1 slicing varies with thread count).
    const encodeStartedAt = Date.now();
    await runFfmpeg([
      "-threads", String(threads),
      "-framerate", String(fps),
      "-i", path.join(tmpDir, "f_%06d.png"),
      "-c:v", "ffv1",
      "-level", "3",
      "-pix_fmt", "yuv420p",
      outPath,
    ], timeoutMs);
    encodeMs = Date.now() - encodeStartedAt;
    return {
      adapter: "legacy_ffv1",
      threads,
      framesProcessed: fullFrameTempFiles,
      replacementFrames: replacements.length,
      fullFrameTempFiles,
      peakTempBytes,
      peakBufferedFrameBytes: 0,
      phaseMs: {
        decode: decodeMs,
        replacement: replacementMs,
        encode: encodeMs,
        streamingPipeline: "NOT_APPLICABLE",
      },
      outputBytes: fs.statSync(outPath).size,
      wallMs: Date.now() - startedAt,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function childExit(
  child: ReturnType<typeof spawn>,
  label: string,
  stderr: () => string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `${label} exit=${String(code)} signal=${String(signal)}: ${stderr()}`,
          ),
        );
      }
    });
  });
}

function writeFrame(
  stream: NodeJS.WritableStream,
  frame: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(frame, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * Candidate path: FFmpeg decodes raw RGB frames to stdout, Node substitutes
 * only the already-produced physical stamp frames, and a second FFmpeg
 * process writes the same FFV1/yuv420p MKV contract. No stamp algorithm,
 * placement, threshold, or decision code runs here.
 */
export async function replaceFramesInVideoStreamingCandidate(
  sourceVideoPath: string,
  replacements: Array<{ frameIdx: number; pngPath: string }>,
  outPath: string,
  fps: number,
  timeoutMs = 180_000,
): Promise<VideoWritebackMetrics> {
  const startedAt = Date.now();
  const threads = resolveVideoWritebackThreads();
  const info = await videoInfo(sourceVideoPath);
  if (info.width <= 0 || info.height <= 0) {
    throw new Error("Streaming FFV1 candidate requires a valid video size");
  }
  // FFmpeg auto-rotates sources carrying a display matrix. The recovered
  // legacy PNG path therefore uses the displayed dimensions, which can be
  // width/height-swapped relative to ffprobe's coded dimensions. An already
  // produced replacement frame is the authoritative legacy-contract shape.
  let streamWidth = info.width;
  let streamHeight = info.height;
  if (replacements.length > 0) {
    const metadata = await sharp(replacements[0]!.pngPath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Cannot read replacement frame dimensions");
    }
    if (metadata.width * metadata.height !== info.width * info.height) {
      throw new Error(
        "Replacement frame dimensions do not match the decoded source area",
      );
    }
    streamWidth = metadata.width;
    streamHeight = metadata.height;
  }
  const frameBytes = streamWidth * streamHeight * 3;
  const replacementByFrame = new Map<number, string>();
  for (const replacement of replacements) {
    if (!Number.isInteger(replacement.frameIdx) || replacement.frameIdx < 0) {
      throw new Error(`Invalid replacement frame index: ${replacement.frameIdx}`);
    }
    replacementByFrame.set(replacement.frameIdx, replacement.pngPath);
  }

  const prefix = [
    "-hide_banner",
    "-loglevel", "error",
    "-filter_threads", "1",
    "-filter_complex_threads", "1",
  ];
  const ffmpeg = resolveMediaRuntimePath("ffmpeg");
  const decoder = spawn(ffmpeg, [
    ...prefix,
    "-i", sourceVideoPath,
    "-map", "0:v:0",
    "-vsync", "0",
    "-f", "rawvideo",
    "-pix_fmt", "rgb24",
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"], env: approvedMediaRuntimeChildEnvironment() });
  const encoder = spawn(ffmpeg, [
    "-y",
    ...prefix,
    "-threads", String(threads),
    "-f", "rawvideo",
    "-pix_fmt", "rgb24",
    "-video_size", `${streamWidth}x${streamHeight}`,
    "-framerate", String(fps),
    "-i", "pipe:0",
    "-c:v", "ffv1",
    "-level", "3",
    "-pix_fmt", "yuv420p",
    outPath,
  ], { stdio: ["pipe", "ignore", "pipe"], env: approvedMediaRuntimeChildEnvironment() });

  let decoderErr = "";
  let encoderErr = "";
  decoder.stderr.on("data", (data) => (decoderErr += data.toString()));
  encoder.stderr.on("data", (data) => (encoderErr += data.toString()));
  // write callbacks below carry the actionable error; this listener prevents
  // an EPIPE from becoming an unhandled stream event when the encoder fails.
  encoder.stdin.on("error", () => undefined);
  const decoderDone = childExit(decoder, "streaming decoder", () => decoderErr);
  const encoderDone = childExit(encoder, "streaming encoder", () => encoderErr);
  const timeout = setTimeout(() => {
    decoder.kill("SIGKILL");
    encoder.kill("SIGKILL");
  }, timeoutMs);

  let carry = Buffer.alloc(0);
  let frameIdx = 0;
  let replacementFrames = 0;
  let peakBufferedFrameBytes = 0;
  const pipelineStartedAt = Date.now();
  try {
    for await (const rawChunk of decoder.stdout) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      carry = carry.length === 0 ? chunk : Buffer.concat([carry, chunk]);
      peakBufferedFrameBytes = Math.max(peakBufferedFrameBytes, carry.length);
      while (carry.length >= frameBytes) {
        const decodedFrame = carry.subarray(0, frameBytes);
        carry = carry.subarray(frameBytes);
        const replacementPath = replacementByFrame.get(frameIdx);
        if (replacementPath) {
          const rendered = await sharp(replacementPath)
            .removeAlpha()
            .toColourspace("srgb")
            .raw()
            .toBuffer({ resolveWithObject: true });
          if (
            rendered.info.width !== streamWidth ||
            rendered.info.height !== streamHeight ||
            rendered.info.channels !== 3 ||
            rendered.data.length !== frameBytes
          ) {
            throw new Error(
              `Replacement frame ${frameIdx} is not ${streamWidth}x${streamHeight} RGB`,
            );
          }
          await writeFrame(encoder.stdin, rendered.data);
          replacementFrames++;
        } else {
          await writeFrame(encoder.stdin, decodedFrame);
        }
        frameIdx++;
      }
    }
    if (carry.length !== 0) {
      throw new Error(`Streaming decoder ended with ${carry.length} stray bytes`);
    }
    encoder.stdin.end();
    await Promise.all([decoderDone, encoderDone]);
    if (replacementFrames !== replacementByFrame.size) {
      throw new Error(
        `Only ${replacementFrames}/${replacementByFrame.size} replacements were applied`,
      );
    }
    return {
      adapter: "streaming_ffv1",
      threads,
      framesProcessed: frameIdx,
      replacementFrames,
      fullFrameTempFiles: 0,
      peakTempBytes: 0,
      peakBufferedFrameBytes,
      phaseMs: {
        decode: "NOT_SEPARABLE_SINGLE_PIPELINE",
        replacement: "INCLUDED_IN_SINGLE_PIPELINE",
        encode: "NOT_SEPARABLE_SINGLE_PIPELINE",
        streamingPipeline: Date.now() - pipelineStartedAt,
      },
      outputBytes: fs.statSync(outPath).size,
      wallMs: Date.now() - startedAt,
    };
  } catch (error) {
    decoder.kill("SIGKILL");
    encoder.kill("SIGKILL");
    encoder.stdin.destroy();
    await Promise.allSettled([decoderDone, encoderDone]);
    try {
      fs.rmSync(outPath, { force: true });
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function postflightStreamingWriteback(input: {
  sourceVideoPath: string;
  outputPath: string;
}) {
  const source = await videoInfo(input.sourceVideoPath);
  const output = await videoInfo(input.outputPath);
  const failures: string[] = [];
  if (source.frameCount !== output.frameCount) failures.push("FRAME_COUNT_MISMATCH");
  const durationToleranceSec = 0.05;
  if (Math.abs(source.durationSec - output.durationSec) > durationToleranceSec) {
    failures.push("DURATION_MISMATCH");
  }
  const sameArea = source.width * source.height === output.width * output.height;
  if (!sameArea) failures.push("DISPLAY_AREA_MISMATCH");
  return {
    pass: failures.length === 0,
    failures,
    sourceFrames: source.frameCount,
    outputFrames: output.frameCount,
    sourceDurationSec: source.durationSec,
    outputDurationSec: output.durationSec,
    sourceRFrameRate: source.rFrameRate,
    sourceAvgFrameRate: source.avgFrameRate,
    selectedWritebackFps: source.writebackFps,
  };
}

async function runLegacyWithSelection(input: {
  sourceVideoPath: string;
  replacements: Array<{ frameIdx: number; pngPath: string }>;
  outPath: string;
  fps: number;
  timeoutMs: number;
  requestedAdapter: VideoWritebackAdapter;
  preflight?: StreamingWritebackPreflight;
  fallbackReason?: string[];
}) {
  const metrics = await replaceFramesInVideoLegacy(
    input.sourceVideoPath,
    input.replacements,
    input.outPath,
    input.fps,
    input.timeoutMs,
  );
  return {
    ...metrics,
    requestedAdapter: input.requestedAdapter,
    preflight: input.preflight,
    fallbackReason: input.fallbackReason,
  } satisfies VideoWritebackMetrics;
}

async function replaceFramesWithUnifiedPtsAdapterC(input: {
  sourceVideoPath: string;
  replacements: Array<{ frameIdx: number; pngPath: string }>;
  outPath: string;
  timeoutMs: number;
}): Promise<Record<string, unknown>> {
  const python = process.env.TANCMARK_UNIFIED_PYAV_PYTHON;
  const script = process.env.TANCMARK_UNIFIED_PYAV_SCRIPT;
  if (!python || !script) {
    throw new Error(
      "UNIFIED_ADAPTER_C_RUNTIME_REQUIRED:" +
        "TANCMARK_UNIFIED_PYAV_PYTHON,TANCMARK_UNIFIED_PYAV_SCRIPT",
    );
  }
  const profile =
    process.env.TANCMARK_UNIFIED_PYAV_PROFILE?.trim() || "mov_h264_lab";
  const demoOnly = process.env.TANCMARK_DEMO_ONLY === "1";
  if (demoOnly && profile !== "mkv_ffv1_codespaces_demo") {
    throw new Error("CODESPACES_DEMO_ADAPTER_C_PROFILE_REQUIRED");
  }
  const ffprobe = resolveMediaRuntimePath("ffprobe");
  const manifestPath = `${input.outPath}.adapter-c-replacements.json`;
  const resultPath = `${input.outPath}.adapter-c-result.json`;
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: "tancmark-adapter-c-replacement-manifest-v1",
      replacements: input.replacements,
    }, null, 2)}\n`,
    "utf8",
  );
  try {
    const receipt = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const child = spawn(
          python,
          [
            script,
            "--source",
            input.sourceVideoPath,
            "--output",
            input.outPath,
            "--replacements-json",
            manifestPath,
            "--result-json",
            resultPath,
            "--profile",
            profile,
            "--ffprobe",
            ffprobe,
          ],
          {
            env: demoOnly
              ? {
                  PATH: "/usr/bin:/bin",
                  LANG: "C.UTF-8",
                  LC_ALL: "C.UTF-8",
                  PYTHONNOUSERSITE: "1",
                  PYTHONDONTWRITEBYTECODE: "1",
                  LD_LIBRARY_PATH:
                    process.env["TANCMARK_DEMO_LD_LIBRARY_PATH"] ?? "",
                }
              : process.env,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("UNIFIED_ADAPTER_C_TIMEOUT"));
        }, input.timeoutMs);
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          let parsed: Record<string, unknown> | null = null;
          try {
            parsed = JSON.parse(fs.readFileSync(resultPath, "utf8")) as Record<
              string,
              unknown
            >;
          } catch {
            parsed = null;
          }
          if (code !== 0 || !parsed) {
            reject(
              new Error(
                `UNIFIED_ADAPTER_C_FAILED:${code ?? "null"}:` +
                  `${stderr.slice(-1200)}:${stdout.slice(-1200)}`,
              ),
            );
            return;
          }
          resolve(parsed);
        });
      },
    );
    return receipt;
  } finally {
    try {
      fs.rmSync(manifestPath, { force: true });
      fs.rmSync(resultPath, { force: true });
    } catch {
      /* candidate-only temporary receipts */
    }
  }
}

/**
 * Safe dispatch. Auto is the product default only after the integration gate:
 * measured video/audio layouts use streaming; unmeasured subtitle/data/
 * attachment/chapter layouts fall back to the preserved legacy adapter.
 */
export async function replaceFramesInVideo(
  sourceVideoPath: string,
  replacements: Array<{ frameIdx: number; pngPath: string }>,
  outPath: string,
  _fps: number,
  timeoutMs = 180_000,
): Promise<void> {
  const adapter = resolveVideoWritebackAdapter();
  if (adapter === "unified_pts_watermark_adapter_c") {
    const sourceTiming = await videoInfo(sourceVideoPath);
    // The frozen 180 s floor is suitable for short fixtures but killed a
    // valid 7:44 VFR writeback before Adapter C could finalize its receipt.
    // Scale only the infrastructure deadline with media duration; physical
    // payload, frame choices, thresholds and encoder profile remain frozen.
    const durationScaledTimeoutMs = Math.ceil(
      sourceTiming.durationSec * 2_000 + 120_000,
    );
    const adapterTimeoutMs = Math.max(timeoutMs, durationScaledTimeoutMs);
    console.log(
      `[TANCMARK_WRITEBACK_TIMEOUT] ${JSON.stringify({
        sourceDurationSec: sourceTiming.durationSec,
        requestedTimeoutMs: timeoutMs,
        selectedTimeoutMs: adapterTimeoutMs,
        policy: "max(requested,2x_media_duration_plus_120s)",
      })}`,
    );
    const receipt = await replaceFramesWithUnifiedPtsAdapterC({
      sourceVideoPath,
      replacements,
      outPath,
      timeoutMs: adapterTimeoutMs,
    });
    console.log(
      `[TANCMARK_WRITEBACK_METRICS] ${JSON.stringify({
        adapter,
        requestedAdapter: adapter,
        ...receipt,
      })}`,
    );
    return;
  }
  const sourceTiming = await videoInfo(sourceVideoPath);
  const writebackFps = sourceTiming.writebackFps;
  if (!Number.isFinite(writebackFps) || writebackFps <= 0) {
    throw new Error("VIDEO_WRITEBACK_TIMELINE_RATE_UNAVAILABLE");
  }
  if (adapter === "legacy_ffv1") {
    const metrics = await runLegacyWithSelection({
      sourceVideoPath,
      replacements,
      outPath,
      fps: writebackFps,
      timeoutMs,
      requestedAdapter: adapter,
    });
    console.log(`[TANCMARK_WRITEBACK_METRICS] ${JSON.stringify(metrics)}`);
    return;
  }
  if (adapter === "streaming_ffv1") {
    const preflight = await preflightStreamingWriteback(sourceVideoPath);
    if (!preflight.safeForStreaming) {
      throw new Error(
        `STREAMING_FFV1_PREFLIGHT_FAILED: ${preflight.fallbackReasons.join(",")}`,
      );
    }
    const metrics = await replaceFramesInVideoStreamingCandidate(
      sourceVideoPath,
      replacements,
      outPath,
      writebackFps,
      timeoutMs,
    );
    const postflight = await postflightStreamingWriteback({
      sourceVideoPath,
      outputPath: outPath,
    });
    if (!postflight.pass) {
      fs.rmSync(outPath, { force: true });
      throw new Error(
        `STREAMING_FFV1_POSTFLIGHT_FAILED: ${postflight.failures.join(",")}`,
      );
    }
    console.log(
      `[TANCMARK_WRITEBACK_METRICS] ${JSON.stringify({
        ...metrics,
        requestedAdapter: adapter,
        preflight,
        postflight,
      })}`,
    );
    return;
  }
  if (adapter === "auto") {
    const preflight = await preflightStreamingWriteback(sourceVideoPath);
    if (!preflight.safeForStreaming) {
      const metrics = await runLegacyWithSelection({
        sourceVideoPath,
        replacements,
        outPath,
        fps: writebackFps,
        timeoutMs,
        requestedAdapter: adapter,
        preflight,
        fallbackReason: preflight.fallbackReasons,
      });
      console.log(
        `[TANCMARK_WRITEBACK_FALLBACK] ${JSON.stringify({
          requestedAdapter: adapter,
          selectedAdapter: "legacy_ffv1",
          reasons: preflight.fallbackReasons,
        })}`,
      );
      console.log(`[TANCMARK_WRITEBACK_METRICS] ${JSON.stringify(metrics)}`);
      return;
    }
    try {
      const streamingMetrics = await replaceFramesInVideoStreamingCandidate(
        sourceVideoPath,
        replacements,
        outPath,
        writebackFps,
        timeoutMs,
      );
      const postflight = await postflightStreamingWriteback({
        sourceVideoPath,
        outputPath: outPath,
      });
      if (!postflight.pass) {
        throw new Error(`POSTFLIGHT:${postflight.failures.join(",")}`);
      }
      console.log(
        `[TANCMARK_WRITEBACK_METRICS] ${JSON.stringify({
          ...streamingMetrics,
          requestedAdapter: adapter,
          preflight,
          postflight,
        })}`,
      );
      return;
    } catch (error) {
      try {
        fs.rmSync(outPath, { force: true });
      } catch {
        /* ignore */
      }
      const reason =
        error instanceof Error ? error.message : String(error);
      const metrics = await runLegacyWithSelection({
        sourceVideoPath,
        replacements,
        outPath,
        fps: writebackFps,
        timeoutMs,
        requestedAdapter: adapter,
        preflight,
        fallbackReason: [`STREAMING_POSTFLIGHT_OR_RUNTIME_FAILURE:${reason}`],
      });
      console.log(
        `[TANCMARK_WRITEBACK_FALLBACK] ${JSON.stringify({
          requestedAdapter: adapter,
          selectedAdapter: "legacy_ffv1",
          reasons: metrics.fallbackReason,
        })}`,
      );
      console.log(`[TANCMARK_WRITEBACK_METRICS] ${JSON.stringify(metrics)}`);
      return;
    }
  }
  if (adapter === "pyav_candidate" || adapter === "selective_packet_candidate") {
    throw new Error(`${adapter} is a documented research candidate, not enabled`);
  }
  throw new Error(`Unsupported adapter: ${String(adapter)}`);
}

/** Generate a synthetic test video (testsrc smptebars) at requested
 *  duration & resolution. MVP test fixture. */
export async function generateTestVideo(
  outPath: string,
  durationSec: number,
  width: number,
  height: number,
  fps: number,
): Promise<void> {
  // Deterministic encode: -threads 1 + x264 seed/sliced-threads/nondet off.
  // testsrc2 source itself is already deterministic (pattern generator).
  await runFfmpeg([
    "-threads", "1",
    "-f", "lavfi",
    "-i", `testsrc2=duration=${durationSec}:size=${width}x${height}:rate=${fps}`,
    "-c:v", "libx264",
    "-x264-params", "seed=42:sliced-threads=0:nondeterministic=0:lookahead-threads=1",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    outPath,
  ], 60_000);
}

export { runFfmpeg };
