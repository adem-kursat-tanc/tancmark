import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const LIVE_NATIVE_SEGMENT_WRITER_VERSION =
  "live-native-segment-writer-v0.1" as const;

export const LIVE_NATIVE_SEGMENT_WRITER_DECISION_ROLE =
  "live_native_segment_writer_support_only_no_vault_no_confirmed" as const;

export interface LiveNativeSegmentPayloadInput {
  durationSeconds: number;
  payload: Uint8Array;
  sequence?: number;
  uri?: string;
}

export interface LiveNativeSegmentWriteInput {
  allowedRoot: string;
  outputDir: string;
  recordingId: string;
  segments: LiveNativeSegmentPayloadInput[];
  startSequence?: number;
}

export interface LiveNativeWrittenSegment {
  sequence: number;
  uri: string;
  relativePath: string;
  absolutePath: string;
  durationSeconds: number;
  bytesWritten: number;
  inputSha256: string;
  writtenSha256: string;
  payloadUnchanged: boolean;
  ffmpegUsed: false;
  dirtyFfmpegUsed: false;
  reencoded: false;
  transcoded: false;
}

export interface LiveNativeSegmentWriteResult {
  version: typeof LIVE_NATIVE_SEGMENT_WRITER_VERSION;
  decisionRole: typeof LIVE_NATIVE_SEGMENT_WRITER_DECISION_ROLE;
  ok: boolean;
  reason: string;
  recordingId: string | null;
  outputDir: string | null;
  manifestPath: string | null;
  mediaPlaylist: string;
  segmentCount: number;
  totalBytesWritten: number;
  writtenSegments: LiveNativeWrittenSegment[];
  allPayloadsUnchanged: boolean;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  reencoded: false;
  transcoded: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  sourceModified: false;
  realNetworkPull: false;
  realNetworkPush: false;
  realCustomerContentUsed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
}

export interface LiveNativeSegmentWriterPolicy {
  version: typeof LIVE_NATIVE_SEGMENT_WRITER_VERSION;
  decisionRole: typeof LIVE_NATIVE_SEGMENT_WRITER_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "write_hls_vod_package_from_ready_segment_payloads";
  writesReadySegmentsOnly: true;
  encodesVideo: false;
  transcodesVideo: false;
  reencodesAudio: false;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  payloadHashVerified: true;
  outputRootMustBeAllowlisted: true;
  routeDoesNotExposeArbitraryWrite: true;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const MAX_SEGMENTS = 10_000;
const MAX_SEGMENT_DURATION_SECONDS = 60 * 60;
const MAX_SEGMENT_BYTES = 512 * 1024 * 1024;

function safetyEnvelope() {
  return {
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    reencoded: false,
    transcoded: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    sourceModified: false,
    realNetworkPull: false,
    realNetworkPush: false,
    realCustomerContentUsed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
  } as const;
}

function reject(reason: string): LiveNativeSegmentWriteResult {
  return {
    version: LIVE_NATIVE_SEGMENT_WRITER_VERSION,
    decisionRole: LIVE_NATIVE_SEGMENT_WRITER_DECISION_ROLE,
    ok: false,
    reason,
    recordingId: null,
    outputDir: null,
    manifestPath: null,
    mediaPlaylist: "",
    segmentCount: 0,
    totalBytesWritten: 0,
    writtenSegments: [],
    allPayloadsUnchanged: false,
    ...safetyEnvelope(),
  };
}

function safeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return safe.length > 0 ? safe : null;
}

function normalizeRoot(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return path.resolve(value);
}

function isInside(child: string, parent: string): boolean {
  const resolvedChild = path.resolve(child);
  const resolvedParent = path.resolve(parent);
  const relative = path.relative(resolvedParent, resolvedChild);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, MAX_SEGMENT_DURATION_SECONDS);
}

function safeSegmentUri(inputUri: unknown, sequence: number): string {
  if (typeof inputUri === "string") {
    const trimmed = inputUri.trim();
    if (/^[a-zA-Z0-9_-]{1,80}\.m4s$/.test(trimmed)) return trimmed;
  }
  return `segment_${String(sequence).padStart(6, "0")}.m4s`;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function playlistFor(input: {
  startSequence: number;
  targetDurationSeconds: number;
  segments: readonly LiveNativeWrittenSegment[];
}): string {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    `#EXT-X-TARGETDURATION:${input.targetDurationSeconds}`,
    `#EXT-X-MEDIA-SEQUENCE:${input.startSequence}`,
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    "# TancMark native segment writer; media payloads are copied byte-for-byte",
  ];

  for (const segment of input.segments) {
    lines.push(`#EXTINF:${segment.durationSeconds.toFixed(3)},`);
    lines.push(segment.uri);
  }

  lines.push("#EXT-X-ENDLIST");
  return `${lines.join("\n")}\n`;
}

export function writeLiveNativeHlsVodPackage(
  input: LiveNativeSegmentWriteInput,
): LiveNativeSegmentWriteResult {
  const allowedRoot = normalizeRoot(input.allowedRoot);
  const outputDir = normalizeRoot(input.outputDir);
  const recordingId = safeId(input.recordingId);
  const startSequence =
    typeof input.startSequence === "number" && Number.isFinite(input.startSequence) && input.startSequence >= 0
      ? Math.floor(input.startSequence)
      : 0;

  if (!allowedRoot) return reject("allowed_root_missing");
  if (!outputDir) return reject("output_dir_missing");
  if (!isInside(outputDir, allowedRoot)) return reject("output_dir_outside_allowed_root");
  if (!recordingId) return reject("recording_id_invalid");
  if (!Array.isArray(input.segments) || input.segments.length === 0) return reject("segments_missing");
  if (input.segments.length > MAX_SEGMENTS) return reject("too_many_segments");

  const writtenSegments: LiveNativeWrittenSegment[] = [];

  try {
    fs.mkdirSync(outputDir, { recursive: true });

    for (let i = 0; i < input.segments.length; i++) {
      const segmentInput = input.segments[i];
      if (!segmentInput || !(segmentInput.payload instanceof Uint8Array)) {
        return reject(`segment_${i}_payload_invalid`);
      }
      if (segmentInput.payload.byteLength === 0) return reject(`segment_${i}_payload_empty`);
      if (segmentInput.payload.byteLength > MAX_SEGMENT_BYTES) return reject(`segment_${i}_payload_too_large`);

      const durationSeconds = normalizeDuration(segmentInput.durationSeconds);
      if (durationSeconds === null) return reject(`segment_${i}_duration_invalid`);

      const sequence =
        typeof segmentInput.sequence === "number" && Number.isFinite(segmentInput.sequence) && segmentInput.sequence >= 0
          ? Math.floor(segmentInput.sequence)
          : startSequence + i;
      const uri = safeSegmentUri(segmentInput.uri, sequence);
      const absolutePath = path.join(outputDir, uri);
      if (!isInside(absolutePath, outputDir)) return reject(`segment_${i}_path_escape_blocked`);

      const inputSha256 = sha256(segmentInput.payload);
      fs.writeFileSync(absolutePath, Buffer.from(segmentInput.payload));
      const writtenBytes = fs.readFileSync(absolutePath);
      const writtenSha256 = sha256(writtenBytes);

      writtenSegments.push({
        sequence,
        uri,
        relativePath: uri,
        absolutePath,
        durationSeconds,
        bytesWritten: writtenBytes.byteLength,
        inputSha256,
        writtenSha256,
        payloadUnchanged: inputSha256 === writtenSha256,
        ffmpegUsed: false,
        dirtyFfmpegUsed: false,
        reencoded: false,
        transcoded: false,
      });
    }

    const targetDurationSeconds = Math.ceil(
      Math.max(...writtenSegments.map((segment) => segment.durationSeconds), 1),
    );
    const mediaPlaylist = playlistFor({ startSequence, targetDurationSeconds, segments: writtenSegments });
    const manifestPath = path.join(outputDir, "index.m3u8");
    fs.writeFileSync(manifestPath, mediaPlaylist, "utf8");

    const allPayloadsUnchanged = writtenSegments.every((segment) => segment.payloadUnchanged);

    return {
      version: LIVE_NATIVE_SEGMENT_WRITER_VERSION,
      decisionRole: LIVE_NATIVE_SEGMENT_WRITER_DECISION_ROLE,
      ok: allPayloadsUnchanged,
      reason: allPayloadsUnchanged ? "native_hls_vod_package_written" : "payload_hash_mismatch",
      recordingId,
      outputDir,
      manifestPath,
      mediaPlaylist,
      segmentCount: writtenSegments.length,
      totalBytesWritten: writtenSegments.reduce((sum, segment) => sum + segment.bytesWritten, 0),
      writtenSegments,
      allPayloadsUnchanged,
      ...safetyEnvelope(),
    };
  } catch {
    return reject("native_segment_writer_io_error");
  }
}

export function getLiveNativeSegmentWriterPolicy(): LiveNativeSegmentWriterPolicy {
  return {
    version: LIVE_NATIVE_SEGMENT_WRITER_VERSION,
    decisionRole: LIVE_NATIVE_SEGMENT_WRITER_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "write_hls_vod_package_from_ready_segment_payloads",
    writesReadySegmentsOnly: true,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    payloadHashVerified: true,
    outputRootMustBeAllowlisted: true,
    routeDoesNotExposeArbitraryWrite: true,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
