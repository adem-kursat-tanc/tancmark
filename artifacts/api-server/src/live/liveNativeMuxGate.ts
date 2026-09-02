import { createHash } from "node:crypto";

export const LIVE_NATIVE_MUX_GATE_VERSION = "live-native-mux-gate-v0.1" as const;

export const LIVE_NATIVE_MUX_GATE_DECISION_ROLE =
  "live_native_mux_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeMuxMode = "passthrough_segments" | "true_remux" | "track_interleave";

export type LiveNativeMuxTrackLayout =
  | "already_muxed_av"
  | "video_only"
  | "audio_only"
  | "metadata_only"
  | "unknown";

export interface LiveNativeMuxSegmentInput {
  sequence: number;
  uri: string;
  durationSeconds: number;
  bytesWritten: number;
  inputSha256: string;
  writtenSha256: string;
  payloadUnchanged?: boolean;
  trackLayout?: LiveNativeMuxTrackLayout;
}

export interface LiveNativeMuxGateInput {
  recordingId: string;
  mode?: LiveNativeMuxMode;
  expectedStartSequence?: number;
  segments: readonly LiveNativeMuxSegmentInput[];
}

export interface LiveNativeMuxSegmentEntry {
  index: number;
  sequence: number;
  uri: string;
  durationSeconds: number;
  bytesWritten: number;
  sha256: string;
  trackLayout: LiveNativeMuxTrackLayout;
}

export type LiveNativeMuxGateResult =
  | {
      ok: true;
      reason: "native_mux_passthrough_segments_ready";
      version: typeof LIVE_NATIVE_MUX_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_MUX_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string;
      mode: "passthrough_segments";
      segmentCount: number;
      startSequence: number;
      endSequence: number;
      totalDurationSeconds: number;
      totalBytesWritten: number;
      muxPlanHash: string;
      entries: readonly LiveNativeMuxSegmentEntry[];
      allPayloadsUnchanged: true;
      contiguousSequences: true;
      duplicateSequenceDetected: false;
      muxRewritePending: false;
      trackInterleavePending: false;
      oldFfmpegUsed: false;
      dirtyFfmpegUsed: false;
      gplFfmpegUsed: false;
      nonfreeFfmpegUsed: false;
      paidDependencyUsed: false;
      networkFetchUsed: false;
      sourceModified: false;
      mediaPayloadModified: false;
      encodesVideo: false;
      transcodesVideo: false;
      reencodesAudio: false;
      videoMeaningChanged: false;
      audioMeaningChanged: false;
      visualQualityLossAllowed: false;
      supportOnly: true;
      canOpenVault: false;
      confirmed: false;
      final: false;
      exactIdRequired: true;
      wrongIdCanOpenVault: false;
      missingIdCanOpenVault: false;
      candidateSupportCanDecide: false;
      dnaCanDecideAlone: false;
    }
  | {
      ok: false;
      reason: string;
      version: typeof LIVE_NATIVE_MUX_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_MUX_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string | null;
      mode: LiveNativeMuxMode;
      segmentCount: number;
      entries: readonly LiveNativeMuxSegmentEntry[];
      muxRewritePending: boolean;
      trackInterleavePending: boolean;
      oldFfmpegUsed: false;
      dirtyFfmpegUsed: false;
      gplFfmpegUsed: false;
      nonfreeFfmpegUsed: false;
      paidDependencyUsed: false;
      networkFetchUsed: false;
      sourceModified: false;
      mediaPayloadModified: false;
      encodesVideo: false;
      transcodesVideo: false;
      reencodesAudio: false;
      videoMeaningChanged: false;
      audioMeaningChanged: false;
      visualQualityLossAllowed: false;
      supportOnly: true;
      canOpenVault: false;
      confirmed: false;
      final: false;
      exactIdRequired: true;
      wrongIdCanOpenVault: false;
      missingIdCanOpenVault: false;
      candidateSupportCanDecide: false;
      dnaCanDecideAlone: false;
    };

export interface LiveNativeMuxGatePolicy {
  version: typeof LIVE_NATIVE_MUX_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_MUX_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "native_live_vod_mux_passthrough_gate_without_remux";
  supportsAlreadyMuxedSegmentPassthrough: true;
  supportsTrueRemux: false;
  supportsTrackInterleave: false;
  trueRemuxStatus: "native_mux_sample_interleave_pending";
  requiresContiguousSequences: true;
  requiresPayloadHashMatch: true;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchAllowed: false;
  sourceModified: false;
  mediaPayloadModified: false;
  encodesVideo: false;
  transcodesVideo: false;
  reencodesAudio: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const MAX_SEGMENTS = 20_000;
const SHA256_RE = /^[a-f0-9]{64}$/i;

function safetyEnvelope() {
  return {
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsed: false,
    sourceModified: false,
    mediaPayloadModified: false,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
  } as const;
}

function safeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
  return safe.length > 0 ? safe : null;
}

function safeUri(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("rtmp://") ||
    lower.startsWith("rtmps://") ||
    lower.startsWith("s3://") ||
    lower.startsWith("gs://")
  ) {
    return null;
  }
  if (!/^[a-zA-Z0-9_.-]{1,160}$/.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;
  return trimmed;
}

function isValidHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function safeSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 999_999_999;
}

function safePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function safeBytes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function safeMode(value: unknown): LiveNativeMuxMode {
  if (value === "true_remux" || value === "track_interleave") return value;
  return "passthrough_segments";
}

function safeTrackLayout(value: unknown): LiveNativeMuxTrackLayout {
  if (
    value === "already_muxed_av" ||
    value === "video_only" ||
    value === "audio_only" ||
    value === "metadata_only" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function muxPlanHash(recordingId: string, entries: readonly LiveNativeMuxSegmentEntry[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: LIVE_NATIVE_MUX_GATE_VERSION,
        recordingId,
        entries: entries.map((entry) => ({
          sequence: entry.sequence,
          uri: entry.uri,
          durationSeconds: Number(entry.durationSeconds.toFixed(6)),
          bytesWritten: entry.bytesWritten,
          sha256: entry.sha256,
          trackLayout: entry.trackLayout,
        })),
      }),
      "utf8",
    )
    .digest("hex");
}

function reject(
  reason: string,
  recordingId: string | null,
  mode: LiveNativeMuxMode,
  entries: readonly LiveNativeMuxSegmentEntry[] = [],
): LiveNativeMuxGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_MUX_GATE_VERSION,
    decisionRole: LIVE_NATIVE_MUX_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    mode,
    segmentCount: entries.length,
    entries,
    muxRewritePending: reason.includes("remux") || reason.includes("interleave"),
    trackInterleavePending: reason.includes("interleave") || reason.includes("track_layout"),
    ...safetyEnvelope(),
  };
}

export function buildLiveNativeMuxGate(input: LiveNativeMuxGateInput): LiveNativeMuxGateResult {
  const mode = safeMode(input?.mode);
  const recordingId = safeId(input?.recordingId);
  if (!recordingId) return reject("recording_id_invalid", null, mode);

  if (mode === "true_remux") return reject("native_mux_sample_interleave_pending", recordingId, mode);
  if (mode === "track_interleave") return reject("native_mux_track_interleave_pending", recordingId, mode);

  if (!Array.isArray(input?.segments) || input.segments.length === 0) {
    return reject("segments_missing", recordingId, mode);
  }
  if (input.segments.length > MAX_SEGMENTS) return reject("too_many_segments", recordingId, mode);

  const expectedStartSequence =
    input.expectedStartSequence === undefined
      ? undefined
      : safeSequence(input.expectedStartSequence)
        ? input.expectedStartSequence
        : null;
  if (expectedStartSequence === null) return reject("expected_start_sequence_invalid", recordingId, mode);

  const seen = new Set<number>();
  const entries: LiveNativeMuxSegmentEntry[] = [];
  for (let index = 0; index < input.segments.length; index++) {
    const segment = input.segments[index];
    if (!segment || !safeSequence(segment.sequence)) return reject(`segment_${index}_sequence_invalid`, recordingId, mode, entries);
    if (seen.has(segment.sequence)) return reject(`segment_${index}_duplicate_sequence`, recordingId, mode, entries);
    seen.add(segment.sequence);

    const uri = safeUri(segment.uri);
    if (!uri) return reject(`segment_${index}_uri_invalid`, recordingId, mode, entries);
    if (!safePositiveNumber(segment.durationSeconds)) return reject(`segment_${index}_duration_invalid`, recordingId, mode, entries);
    if (!safeBytes(segment.bytesWritten)) return reject(`segment_${index}_bytes_invalid`, recordingId, mode, entries);
    if (!isValidHash(segment.inputSha256)) return reject(`segment_${index}_input_hash_invalid`, recordingId, mode, entries);
    if (!isValidHash(segment.writtenSha256)) return reject(`segment_${index}_written_hash_invalid`, recordingId, mode, entries);
    if (
      segment.payloadUnchanged === false ||
      segment.inputSha256.toLowerCase() !== segment.writtenSha256.toLowerCase()
    ) {
      return reject(`segment_${index}_payload_hash_mismatch`, recordingId, mode, entries);
    }

    const trackLayout = safeTrackLayout(segment.trackLayout);
    entries.push({
      index,
      sequence: segment.sequence,
      uri,
      durationSeconds: segment.durationSeconds,
      bytesWritten: segment.bytesWritten,
      sha256: segment.inputSha256.toLowerCase(),
      trackLayout,
    });
  }

  entries.sort((left, right) => left.sequence - right.sequence);
  const startSequence = expectedStartSequence ?? entries[0].sequence;
  for (let index = 0; index < entries.length; index++) {
    const expectedSequence = startSequence + index;
    if (entries[index].sequence !== expectedSequence) {
      return reject(`segment_${index}_sequence_gap`, recordingId, mode, entries);
    }
    entries[index] = { ...entries[index], index };
  }

  if (entries.some((entry) => entry.trackLayout !== "already_muxed_av")) {
    return reject("native_mux_track_layout_interleave_pending", recordingId, mode, entries);
  }

  const totalDurationSeconds = entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const totalBytesWritten = entries.reduce((sum, entry) => sum + entry.bytesWritten, 0);

  return {
    ok: true,
    reason: "native_mux_passthrough_segments_ready",
    version: LIVE_NATIVE_MUX_GATE_VERSION,
    decisionRole: LIVE_NATIVE_MUX_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    mode: "passthrough_segments",
    segmentCount: entries.length,
    startSequence,
    endSequence: entries[entries.length - 1].sequence,
    totalDurationSeconds: Number(totalDurationSeconds.toFixed(6)),
    totalBytesWritten,
    muxPlanHash: muxPlanHash(recordingId, entries),
    entries,
    allPayloadsUnchanged: true,
    contiguousSequences: true,
    duplicateSequenceDetected: false,
    muxRewritePending: false,
    trackInterleavePending: false,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeMuxGatePolicy(): LiveNativeMuxGatePolicy {
  return {
    version: LIVE_NATIVE_MUX_GATE_VERSION,
    decisionRole: LIVE_NATIVE_MUX_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "native_live_vod_mux_passthrough_gate_without_remux",
    supportsAlreadyMuxedSegmentPassthrough: true,
    supportsTrueRemux: false,
    supportsTrackInterleave: false,
    trueRemuxStatus: "native_mux_sample_interleave_pending",
    requiresContiguousSequences: true,
    requiresPayloadHashMatch: true,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchAllowed: false,
    sourceModified: false,
    mediaPayloadModified: false,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
