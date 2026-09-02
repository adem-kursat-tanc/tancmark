import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  approvedMediaRuntimeChildEnvironment,
  resolveMediaRuntimePath,
  type MediaRuntimeTool,
} from "./mediaRuntimePathResolver";

export const EXACT_SEAL_TIMING_MAP_SCHEMA =
  "tancmark-private-exact-seal-timing-map-v1" as const;

export interface ExactFrameAddress {
  frameIdx: number;
  pts: string;
  timeBase: string;
}

export interface ExactSealTimingMap {
  schemaVersion: typeof EXACT_SEAL_TIMING_MAP_SCHEMA;
  frameCount: number;
  videoTimeBase: string;
  framePtsDigestSha256: string;
  /** Hash only; the private registry remains responsible for ID lookup. */
  registryRecordIdHashSha256: string;
  channelA: ExactFrameAddress[];
  channelB: ExactFrameAddress[];
}

interface ProbedTimeline {
  frameCount: number;
  timeBase: string;
  pts: string[];
  digestSha256: string;
}

export interface ExactSealTimingValidation {
  valid: boolean;
  reason:
    | "VALID"
    | "SCHEMA_MISMATCH"
    | "RECORD_ID_MISMATCH"
    | "FRAME_COUNT_MISMATCH"
    | "TIME_BASE_MISMATCH"
    | "FRAME_TIMELINE_DIGEST_MISMATCH"
    | "INVALID_ADDRESS"
    | "ADDRESS_PTS_MISMATCH"
    | "CHANNEL_OVERLAP";
  timeline?: ProbedTimeline;
}

export interface ExactExtractedFrame {
  frameIdx: number;
  pts: string;
  timeBase: string;
  tsSec: number;
  pngPath: string;
}

function runProcess(
  command: MediaRuntimeTool,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveMediaRuntimePath(command), args, {
      windowsHide: true,
      env: approvedMediaRuntimeChildEnvironment(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command.toUpperCase()}_TIMEOUT:${timeoutMs}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command.toUpperCase()}_EXIT_${code}:${stderr.slice(-2000)}`));
    });
  });
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function rationalToSeconds(value: string, timeBase: string): number {
  const pts = Number.parseInt(value, 10);
  const [numRaw, denRaw] = timeBase.split("/");
  const num = Number.parseInt(numRaw ?? "", 10);
  const den = Number.parseInt(denRaw ?? "", 10);
  if (!Number.isSafeInteger(pts) || !Number.isSafeInteger(num) ||
      !Number.isSafeInteger(den) || den === 0) {
    throw new Error("INVALID_EXACT_RATIONAL");
  }
  return pts * num / den;
}

export async function probeExactVideoTimeline(
  videoPath: string,
): Promise<ProbedTimeline> {
  const { stdout } = await runProcess("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=time_base:frame=pts,best_effort_timestamp",
    "-of", "json",
    videoPath,
  ], 120_000);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ time_base?: string }>;
    frames?: Array<{ pts?: number | string; best_effort_timestamp?: number | string }>;
  };
  const timeBase = parsed.streams?.[0]?.time_base;
  if (!timeBase || !/^[-+]?\d+\/[-+]?\d+$/.test(timeBase)) {
    throw new Error("VIDEO_TIME_BASE_NOT_AVAILABLE");
  }
  const pts = (parsed.frames ?? []).map((frame, frameIdx) => {
    const value = frame.pts ?? frame.best_effort_timestamp;
    if (value === undefined || value === null || !/^-?\d+$/.test(String(value))) {
      throw new Error(`FRAME_PTS_NOT_AVAILABLE:${frameIdx}`);
    }
    return String(value);
  });
  if (pts.length === 0) throw new Error("VIDEO_FRAME_TIMELINE_EMPTY");
  return {
    frameCount: pts.length,
    timeBase,
    pts,
    digestSha256: sha256(`${timeBase}\n${pts.join("\n")}`),
  };
}

function uniqueSortedFrameIdxs(indices: readonly number[]): number[] {
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}

/** Build a logarithmic-depth FFmpeg select expression. A flat `a+b+c+...`
 * chain with hundreds of exact ordinals can exhaust the Windows filter
 * expression parser even though the address list itself is bounded. Adjacent
 * ordinals are first compressed to `between`, then combined as a balanced OR
 * tree. The selected frame set is byte-for-byte identical. */
export function buildBoundedExactFrameSelectExpression(indices: readonly number[]): string {
  const sorted = uniqueSortedFrameIdxs(indices);
  if (sorted.length === 0 || sorted.some((value) => !Number.isSafeInteger(value) || value < 0) || sorted.length > 10_000) {
    throw new Error("EXACT_SELECT_INDEX_SET_INVALID");
  }
  const leaves: string[] = [];
  let start = sorted[0]!;
  let end = start;
  for (const value of sorted.slice(1)) {
    if (value === end + 1) {
      end = value;
      continue;
    }
    leaves.push(start === end ? `eq(n\\,${start})` : `between(n\\,${start}\\,${end})`);
    start = value;
    end = value;
  }
  leaves.push(start === end ? `eq(n\\,${start})` : `between(n\\,${start}\\,${end})`);
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]!;
      const right = level[index + 1];
      next.push(right === undefined ? left : `max(${left}\\,${right})`);
    }
    level = next;
  }
  return level[0]!;
}

function addressesFor(
  indices: readonly number[],
  timeline: ProbedTimeline,
): ExactFrameAddress[] {
  return uniqueSortedFrameIdxs(indices).map((frameIdx) => {
    if (!Number.isInteger(frameIdx) || frameIdx < 0 || frameIdx >= timeline.frameCount) {
      throw new Error(`EXACT_MAP_FRAME_INDEX_OUT_OF_RANGE:${frameIdx}`);
    }
    return {
      frameIdx,
      pts: timeline.pts[frameIdx]!,
      timeBase: timeline.timeBase,
    };
  });
}

export async function buildPrivateExactSealTimingMap(input: {
  videoPath: string;
  registryRecordIdHex: string;
  channelAFrameIdxs: readonly number[];
  channelBFrameIdxs: readonly number[];
}): Promise<ExactSealTimingMap> {
  const timeline = await probeExactVideoTimeline(input.videoPath);
  const channelA = addressesFor(input.channelAFrameIdxs, timeline);
  const channelB = addressesFor(input.channelBFrameIdxs, timeline);
  const channelASet = new Set(channelA.map((address) => address.frameIdx));
  if (channelB.some((address) => channelASet.has(address.frameIdx))) {
    throw new Error("EXACT_MAP_CHANNEL_OVERLAP");
  }
  return {
    schemaVersion: EXACT_SEAL_TIMING_MAP_SCHEMA,
    frameCount: timeline.frameCount,
    videoTimeBase: timeline.timeBase,
    framePtsDigestSha256: timeline.digestSha256,
    registryRecordIdHashSha256: sha256(input.registryRecordIdHex),
    channelA,
    channelB,
  };
}

function addressesValid(
  addresses: readonly ExactFrameAddress[],
  timeline: ProbedTimeline,
): boolean {
  const seen = new Set<number>();
  for (const address of addresses) {
    if (!Number.isInteger(address.frameIdx) || address.frameIdx < 0 ||
        address.frameIdx >= timeline.frameCount || seen.has(address.frameIdx) ||
        address.timeBase !== timeline.timeBase) {
      return false;
    }
    seen.add(address.frameIdx);
  }
  return true;
}

export async function validatePrivateExactSealTimingMap(input: {
  videoPath: string;
  registryRecordIdHex: string;
  map: ExactSealTimingMap;
}): Promise<ExactSealTimingValidation> {
  if (input.map.schemaVersion !== EXACT_SEAL_TIMING_MAP_SCHEMA) {
    return { valid: false, reason: "SCHEMA_MISMATCH" };
  }
  if (input.map.registryRecordIdHashSha256 !== sha256(input.registryRecordIdHex)) {
    return { valid: false, reason: "RECORD_ID_MISMATCH" };
  }
  const timeline = await probeExactVideoTimeline(input.videoPath);
  if (input.map.frameCount !== timeline.frameCount) {
    return { valid: false, reason: "FRAME_COUNT_MISMATCH", timeline };
  }
  if (input.map.videoTimeBase !== timeline.timeBase) {
    return { valid: false, reason: "TIME_BASE_MISMATCH", timeline };
  }
  if (input.map.framePtsDigestSha256 !== timeline.digestSha256) {
    return { valid: false, reason: "FRAME_TIMELINE_DIGEST_MISMATCH", timeline };
  }
  if (!addressesValid(input.map.channelA, timeline) ||
      !addressesValid(input.map.channelB, timeline)) {
    return { valid: false, reason: "INVALID_ADDRESS", timeline };
  }
  const channelASet = new Set(input.map.channelA.map((address) => address.frameIdx));
  if (input.map.channelB.some((address) => channelASet.has(address.frameIdx))) {
    return { valid: false, reason: "CHANNEL_OVERLAP", timeline };
  }
  for (const address of [...input.map.channelA, ...input.map.channelB]) {
    if (timeline.pts[address.frameIdx] !== address.pts) {
      return { valid: false, reason: "ADDRESS_PTS_MISMATCH", timeline };
    }
  }
  return { valid: true, reason: "VALID", timeline };
}

export async function extractFramesByExactAddresses(input: {
  videoPath: string;
  addresses: readonly ExactFrameAddress[];
  outDir: string;
}): Promise<ExactExtractedFrame[]> {
  if (input.addresses.length === 0) return [];
  // codeql[js/path-injection] Reported flow is the impossible text-to-video branch; callers pass the decoder's invocation-owned work directory.
  fs.mkdirSync(input.outDir, { recursive: true });
  const addresses = [...input.addresses].sort((a, b) => a.frameIdx - b.frameIdx);
  const filter = buildBoundedExactFrameSelectExpression(addresses.map((address) => address.frameIdx));
  const platformFilter =
    process.platform === "linux" &&
    process.env["TANCMARK_DEMO_ONLY"] === "1" &&
    process.env["TANCMARK_MEDIA_RUNTIME_PROFILE"] === "CODESPACES_LINUX_DEMO_PROFILE_V1"
      ? `setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709,select=${filter}`
      : `select=${filter}`;
  const pattern = path.join(input.outDir, "exact_%03d.png");
  await runProcess("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-filter_threads", "1", "-filter_complex_threads", "1",
    "-i", input.videoPath,
    "-map", "0:v:0",
    "-vf", platformFilter,
    "-fps_mode", "passthrough",
    "-start_number", "0",
    "-frames:v", String(addresses.length),
    "-f", "image2",
    pattern,
  ], Math.max(120_000, addresses.length * 10_000));

  return addresses.map((address, index) => {
    const pngPath = path.join(input.outDir, `exact_${index.toString().padStart(3, "0")}.png`);
    // codeql[js/path-injection] pngPath is a fixed filename inside the invocation-owned output directory established above.
    if (!fs.existsSync(pngPath)) {
      throw new Error(`EXACT_ORDINAL_NOT_EXTRACTED:${address.frameIdx}`);
    }
    return {
      ...address,
      tsSec: rationalToSeconds(address.pts, address.timeBase),
      pngPath,
    };
  });
}
