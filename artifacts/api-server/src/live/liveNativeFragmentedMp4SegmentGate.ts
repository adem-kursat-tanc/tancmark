import { createHash } from "node:crypto";

export const LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION =
  "live-native-fragmented-mp4-segment-gate-v0.1" as const;

export const LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE =
  "live_native_fragmented_mp4_segment_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeFragmentedMp4TrackType = "vide" | "soun";

export interface LiveNativeFragmentedMp4InitSegmentInput {
  uri: string;
  bytes: number;
  inputSha256: string;
  writtenSha256: string;
  sourceIntact?: boolean;
  mediaPayloadModified?: boolean;
  boxes?: {
    ftyp?: boolean;
    moov?: boolean;
    mvex?: boolean;
  };
}

export interface LiveNativeFragmentedMp4TrackInput {
  trackId: number;
  type: LiveNativeFragmentedMp4TrackType;
  timescale: number;
  sampleCount: number;
  baseMediaDecodeTime: number;
  mdatStart: number;
  mdatEnd: number;
}

export interface LiveNativeFragmentedMp4MediaSegmentInput {
  sequence: number;
  uri: string;
  startTimeMs: number;
  durationMs: number;
  bytes: number;
  inputSha256: string;
  writtenSha256: string;
  sourceIntact?: boolean;
  mediaPayloadModified?: boolean;
  ffmpegUsed?: boolean;
  networkFetchUsed?: boolean;
  payloadUnchanged?: boolean;
  boxes?: {
    moof?: boolean;
    traf?: boolean;
    tfhd?: boolean;
    tfdt?: boolean;
    trun?: boolean;
    mdat?: boolean;
  };
  tracks: readonly LiveNativeFragmentedMp4TrackInput[];
}

export interface LiveNativeFragmentedMp4SegmentGateInput {
  recordingId: string;
  expectedStartSequence?: number;
  initSegment: LiveNativeFragmentedMp4InitSegmentInput;
  segments: readonly LiveNativeFragmentedMp4MediaSegmentInput[];
}

export interface LiveNativeFragmentedMp4ManifestEntry {
  index: number;
  sequence: number;
  uri: string;
  startTimeMs: number;
  durationMs: number;
  endTimeMs: number;
  bytes: number;
  sha256: string;
  trackTypes: readonly LiveNativeFragmentedMp4TrackType[];
  trackCount: number;
  entryHash: string;
}

export type LiveNativeFragmentedMp4SegmentGateResult =
  | {
      ok: true;
      reason: "native_fragmented_mp4_segment_gate_ready";
      version: typeof LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string;
      initSegmentUri: string;
      segmentCount: number;
      startSequence: number;
      endSequence: number;
      totalDurationMs: number;
      totalBytes: number;
      entries: readonly LiveNativeFragmentedMp4ManifestEntry[];
      manifestHash: string;
      contiguousSequences: true;
      timestampsMoveForward: true;
      payloadsUnchanged: true;
      sourceIntact: true;
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
      version: typeof LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string | null;
      segmentCount: number;
      entries: readonly LiveNativeFragmentedMp4ManifestEntry[];
      fragmentedMp4Pending: true;
      sourceIntact: true;
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

export interface LiveNativeFragmentedMp4SegmentGatePolicy {
  version: typeof LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "validate_native_fragmented_mp4_live_segments_without_ffmpeg";
  validatesInitSegment: true;
  validatesMoofMdatSegments: true;
  requiresContiguousSequence: true;
  requiresForwardTimestamps: true;
  requiresPayloadHashMatch: true;
  requiresSourceIntact: true;
  allowedTrackTypes: readonly ["vide", "soun"];
  writesOrReencodesMedia: false;
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
const MAX_SEGMENT_BYTES = 512 * 1024 * 1024;
const MAX_SEGMENT_DURATION_MS = 60 * 60 * 1000;
const SHA256_RE = /^[a-f0-9]{64}$/i;

function safetyEnvelope() {
  return {
    sourceIntact: true,
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

function reject(
  reason: string,
  recordingId: string | null,
  entries: readonly LiveNativeFragmentedMp4ManifestEntry[] = [],
): LiveNativeFragmentedMp4SegmentGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION,
    decisionRole: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    segmentCount: entries.length,
    entries,
    fragmentedMp4Pending: true,
    ...safetyEnvelope(),
  };
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
    lower.startsWith("srt://") ||
    lower.startsWith("s3://") ||
    lower.startsWith("gs://")
  ) {
    return null;
  }
  if (!/^[a-zA-Z0-9_.-]{1,180}$/.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;
  return trimmed;
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function safeSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 999_999_999;
}

function safePositiveInt(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

function safeNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function segmentBoxesOk(segment: LiveNativeFragmentedMp4MediaSegmentInput): boolean {
  const boxes = segment.boxes;
  return !!(boxes?.moof && boxes.traf && boxes.tfhd && boxes.tfdt && boxes.trun && boxes.mdat);
}

function initBoxesOk(initSegment: LiveNativeFragmentedMp4InitSegmentInput): boolean {
  const boxes = initSegment.boxes;
  return !!(boxes?.ftyp && boxes.moov && boxes.mvex);
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function entryHash(entry: Omit<LiveNativeFragmentedMp4ManifestEntry, "entryHash">): string {
  return sha256Text(
    JSON.stringify({
      version: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION,
      index: entry.index,
      sequence: entry.sequence,
      uri: entry.uri,
      startTimeMs: entry.startTimeMs,
      durationMs: entry.durationMs,
      endTimeMs: entry.endTimeMs,
      bytes: entry.bytes,
      sha256: entry.sha256,
      trackTypes: entry.trackTypes,
      trackCount: entry.trackCount,
    }),
  );
}

function manifestHash(entries: readonly LiveNativeFragmentedMp4ManifestEntry[]): string {
  return sha256Text(
    JSON.stringify({
      version: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION,
      entries: entries.map((entry) => ({
        sequence: entry.sequence,
        startTimeMs: entry.startTimeMs,
        durationMs: entry.durationMs,
        sha256: entry.sha256,
        entryHash: entry.entryHash,
      })),
    }),
  );
}

export function buildLiveNativeFragmentedMp4SegmentGate(
  input: LiveNativeFragmentedMp4SegmentGateInput,
): LiveNativeFragmentedMp4SegmentGateResult {
  const recordingId = safeId(input?.recordingId);
  if (!recordingId) return reject("recording_id_invalid", null);

  const init = input?.initSegment;
  if (!init) return reject("init_segment_missing", recordingId);
  const initUri = safeUri(init.uri);
  if (!initUri) return reject("init_segment_uri_invalid", recordingId);
  if (!safePositiveInt(init.bytes, MAX_SEGMENT_BYTES)) return reject("init_segment_bytes_invalid", recordingId);
  if (!isHash(init.inputSha256) || !isHash(init.writtenSha256)) return reject("init_segment_hash_invalid", recordingId);
  if (init.inputSha256.toLowerCase() !== init.writtenSha256.toLowerCase()) {
    return reject("init_segment_hash_mismatch", recordingId);
  }
  if (init.sourceIntact !== true) return reject("init_segment_source_not_intact", recordingId);
  if (init.mediaPayloadModified === true) return reject("init_segment_payload_modified", recordingId);
  if (!initBoxesOk(init)) return reject("init_segment_boxes_missing", recordingId);

  if (!Array.isArray(input?.segments) || input.segments.length === 0) {
    return reject("segments_missing", recordingId);
  }
  if (input.segments.length > MAX_SEGMENTS) return reject("too_many_segments", recordingId);

  const expectedStartSequence =
    input.expectedStartSequence === undefined
      ? undefined
      : safeSequence(input.expectedStartSequence)
        ? input.expectedStartSequence
        : null;
  if (expectedStartSequence === null) return reject("expected_start_sequence_invalid", recordingId);

  const seen = new Set<number>();
  const normalized = [...input.segments];
  const entries: LiveNativeFragmentedMp4ManifestEntry[] = [];
  const lastDecodeTimeByTrack = new Map<number, number>();

  for (let index = 0; index < normalized.length; index++) {
    const segment = normalized[index];
    if (!segment || !safeSequence(segment.sequence)) return reject(`segment_${index}_sequence_invalid`, recordingId, entries);
    if (seen.has(segment.sequence)) return reject(`segment_${index}_duplicate_sequence`, recordingId, entries);
    seen.add(segment.sequence);

    const expectedSequence = (expectedStartSequence ?? normalized[0].sequence) + index;
    if (segment.sequence !== expectedSequence) return reject(`segment_${index}_sequence_gap`, recordingId, entries);

    const uri = safeUri(segment.uri);
    if (!uri) return reject(`segment_${index}_uri_invalid`, recordingId, entries);
    if (!safeNonNegativeNumber(segment.startTimeMs)) return reject(`segment_${index}_start_time_invalid`, recordingId, entries);
    if (!safePositiveInt(segment.durationMs, MAX_SEGMENT_DURATION_MS)) {
      return reject(`segment_${index}_duration_invalid`, recordingId, entries);
    }
    if (!safePositiveInt(segment.bytes, MAX_SEGMENT_BYTES)) return reject(`segment_${index}_bytes_invalid`, recordingId, entries);
    if (!isHash(segment.inputSha256) || !isHash(segment.writtenSha256)) {
      return reject(`segment_${index}_hash_invalid`, recordingId, entries);
    }
    if (
      segment.payloadUnchanged === false ||
      segment.inputSha256.toLowerCase() !== segment.writtenSha256.toLowerCase()
    ) {
      return reject(`segment_${index}_payload_hash_mismatch`, recordingId, entries);
    }
    if (segment.sourceIntact !== true) return reject(`segment_${index}_source_not_intact`, recordingId, entries);
    if (segment.mediaPayloadModified === true) return reject(`segment_${index}_payload_modified`, recordingId, entries);
    if (segment.ffmpegUsed === true) return reject(`segment_${index}_ffmpeg_used`, recordingId, entries);
    if (segment.networkFetchUsed === true) return reject(`segment_${index}_network_fetch_used`, recordingId, entries);
    if (!segmentBoxesOk(segment)) return reject(`segment_${index}_boxes_missing`, recordingId, entries);
    if (!Array.isArray(segment.tracks) || segment.tracks.length === 0) {
      return reject(`segment_${index}_tracks_missing`, recordingId, entries);
    }

    const previousEntry = entries[index - 1];
    if (previousEntry && segment.startTimeMs < previousEntry.startTimeMs) {
      return reject(`segment_${index}_timestamp_regression`, recordingId, entries);
    }

    const trackTypes: LiveNativeFragmentedMp4TrackType[] = [];
    for (let trackIndex = 0; trackIndex < segment.tracks.length; trackIndex++) {
      const track = segment.tracks[trackIndex];
      if (!safePositiveInt(track?.trackId, 999_999)) {
        return reject(`segment_${index}_track_${trackIndex}_id_invalid`, recordingId, entries);
      }
      if (track.type !== "vide" && track.type !== "soun") {
        return reject(`segment_${index}_track_${trackIndex}_type_invalid`, recordingId, entries);
      }
      if (!safePositiveInt(track.timescale, 1_000_000_000)) {
        return reject(`segment_${index}_track_${trackIndex}_timescale_invalid`, recordingId, entries);
      }
      if (!safePositiveInt(track.sampleCount, 5_000_000)) {
        return reject(`segment_${index}_track_${trackIndex}_sample_count_invalid`, recordingId, entries);
      }
      if (!safeNonNegativeNumber(track.baseMediaDecodeTime)) {
        return reject(`segment_${index}_track_${trackIndex}_decode_time_invalid`, recordingId, entries);
      }
      if (
        !safeNonNegativeNumber(track.mdatStart) ||
        !safeNonNegativeNumber(track.mdatEnd) ||
        track.mdatEnd <= track.mdatStart ||
        track.mdatEnd > segment.bytes
      ) {
        return reject(`segment_${index}_track_${trackIndex}_mdat_range_invalid`, recordingId, entries);
      }

      const lastDecodeTime = lastDecodeTimeByTrack.get(track.trackId);
      if (lastDecodeTime !== undefined && track.baseMediaDecodeTime < lastDecodeTime) {
        return reject(`segment_${index}_track_${trackIndex}_decode_time_regression`, recordingId, entries);
      }
      lastDecodeTimeByTrack.set(track.trackId, track.baseMediaDecodeTime);
      if (!trackTypes.includes(track.type)) trackTypes.push(track.type);
    }

    const entryWithoutHash = {
      index,
      sequence: segment.sequence,
      uri,
      startTimeMs: Math.round(segment.startTimeMs),
      durationMs: segment.durationMs,
      endTimeMs: Math.round(segment.startTimeMs + segment.durationMs),
      bytes: segment.bytes,
      sha256: segment.inputSha256.toLowerCase(),
      trackTypes,
      trackCount: segment.tracks.length,
    };
    entries.push({ ...entryWithoutHash, entryHash: entryHash(entryWithoutHash) });
  }

  const totalDurationMs = entries.reduce((sum, entry) => sum + entry.durationMs, 0);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

  return {
    ok: true,
    reason: "native_fragmented_mp4_segment_gate_ready",
    version: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION,
    decisionRole: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    initSegmentUri: initUri,
    segmentCount: entries.length,
    startSequence: entries[0].sequence,
    endSequence: entries[entries.length - 1].sequence,
    totalDurationMs,
    totalBytes,
    entries,
    manifestHash: manifestHash(entries),
    contiguousSequences: true,
    timestampsMoveForward: true,
    payloadsUnchanged: true,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeFragmentedMp4SegmentGatePolicy(): LiveNativeFragmentedMp4SegmentGatePolicy {
  return {
    version: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_VERSION,
    decisionRole: LIVE_NATIVE_FRAGMENTED_MP4_SEGMENT_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "validate_native_fragmented_mp4_live_segments_without_ffmpeg",
    validatesInitSegment: true,
    validatesMoofMdatSegments: true,
    requiresContiguousSequence: true,
    requiresForwardTimestamps: true,
    requiresPayloadHashMatch: true,
    requiresSourceIntact: true,
    allowedTrackTypes: ["vide", "soun"],
    writesOrReencodesMedia: false,
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
