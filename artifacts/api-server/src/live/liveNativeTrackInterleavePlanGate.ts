import { createHash } from "node:crypto";

export const LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION =
  "live-native-track-interleave-plan-gate-v0.1" as const;

export const LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE =
  "live_native_track_interleave_plan_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeInterleaveTrackKind = "video" | "audio";

export type LiveNativeInterleaveAction = "plan" | "write_interleaved_output";

export interface LiveNativeInterleaveSegmentInput {
  sequence: number;
  startMs: number;
  endMs: number;
  bytesWritten: number;
  inputSha256: string;
  writtenSha256: string;
  uri: string;
  payloadUnchanged?: boolean;
}

export interface LiveNativeInterleaveTrackInput {
  trackId: string;
  kind: LiveNativeInterleaveTrackKind;
  codecLabel: string;
  timescale: number;
  segments: readonly LiveNativeInterleaveSegmentInput[];
}

export interface LiveNativeTrackInterleavePlanGateInput {
  recordingId: string;
  requestedAction?: LiveNativeInterleaveAction;
  maxAudioVideoDriftMs?: number;
  tracks: readonly LiveNativeInterleaveTrackInput[];
}

export interface LiveNativeInterleavePlanEntry {
  index: number;
  trackId: string;
  kind: LiveNativeInterleaveTrackKind;
  sequence: number;
  startMs: number;
  endMs: number;
  bytesWritten: number;
  sha256: string;
  uri: string;
}

export interface LiveNativeInterleaveTrackSummary {
  trackId: string;
  kind: LiveNativeInterleaveTrackKind;
  codecLabel: string;
  timescale: number;
  segmentCount: number;
  startMs: number;
  endMs: number;
  bytesWritten: number;
}

export type LiveNativeTrackInterleavePlanGateResult =
  | {
      ok: true;
      reason: "native_track_interleave_plan_ready";
      version: typeof LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string;
      requestedAction: "plan";
      trackCount: number;
      videoTrackCount: number;
      audioTrackCount: number;
      segmentCount: number;
      startMs: number;
      endMs: number;
      maxAudioVideoDriftMs: number;
      observedAudioVideoDriftMs: number;
      planHash: string;
      tracks: readonly LiveNativeInterleaveTrackSummary[];
      plan: readonly LiveNativeInterleavePlanEntry[];
      interleaveWritePending: false;
      allPayloadsUnchanged: true;
      timestampsMonotonic: true;
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
      version: typeof LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string | null;
      requestedAction: LiveNativeInterleaveAction;
      trackCount: number;
      videoTrackCount: number;
      audioTrackCount: number;
      segmentCount: number;
      maxAudioVideoDriftMs: number;
      observedAudioVideoDriftMs: number | null;
      tracks: readonly LiveNativeInterleaveTrackSummary[];
      plan: readonly LiveNativeInterleavePlanEntry[];
      interleaveWritePending: boolean;
      allPayloadsUnchanged: false;
      timestampsMonotonic: false;
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

export interface LiveNativeTrackInterleavePlanGatePolicy {
  version: typeof LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "native_live_audio_video_track_interleave_plan_without_write";
  supportsInterleavePlan: true;
  supportsInterleaveWrite: false;
  interleaveWriteStatus: "native_track_interleave_write_pending";
  requiresVideoAndAudioTracks: true;
  requiresContiguousSequencesPerTrack: true;
  requiresMonotonicTimestamps: true;
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

const MAX_TRACKS = 8;
const MAX_SEGMENTS_PER_TRACK = 50_000;
const DEFAULT_MAX_DRIFT_MS = 250;
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

function safeTrackId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim();
  if (!/^[a-zA-Z0-9_.:-]{1,80}$/.test(safe)) return null;
  if (safe.includes("..")) return null;
  return safe;
}

function safeCodec(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{2,32}$/.test(safe)) return null;
  return safe;
}

function safeUri(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim();
  const lower = safe.toLowerCase();
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
  if (!/^[a-zA-Z0-9_./:-]{1,180}$/.test(safe)) return null;
  if (safe.includes("..")) return null;
  return safe;
}

function safeAction(value: unknown): LiveNativeInterleaveAction {
  return value === "write_interleaved_output" ? "write_interleaved_output" : "plan";
}

function safeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 86_400_000;
}

function safePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1_000_000_000;
}

function isValidHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function fail(
  reason: string,
  context: {
    recordingId: string | null;
    requestedAction: LiveNativeInterleaveAction;
    maxAudioVideoDriftMs: number;
    tracks: readonly LiveNativeInterleaveTrackSummary[];
    plan: readonly LiveNativeInterleavePlanEntry[];
    observedAudioVideoDriftMs?: number | null;
  },
): LiveNativeTrackInterleavePlanGateResult {
  const videoTrackCount = context.tracks.filter((track) => track.kind === "video").length;
  const audioTrackCount = context.tracks.filter((track) => track.kind === "audio").length;
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION,
    decisionRole: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId: context.recordingId,
    requestedAction: context.requestedAction,
    trackCount: context.tracks.length,
    videoTrackCount,
    audioTrackCount,
    segmentCount: context.plan.length,
    maxAudioVideoDriftMs: context.maxAudioVideoDriftMs,
    observedAudioVideoDriftMs: context.observedAudioVideoDriftMs ?? null,
    tracks: context.tracks,
    plan: context.plan,
    interleaveWritePending: context.requestedAction === "write_interleaved_output",
    allPayloadsUnchanged: false,
    timestampsMonotonic: false,
    ...safetyEnvelope(),
  };
}

function planHash(recordingId: string, plan: readonly LiveNativeInterleavePlanEntry[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION,
        recordingId,
        plan: plan.map((entry) => ({
          trackId: entry.trackId,
          kind: entry.kind,
          sequence: entry.sequence,
          startMs: entry.startMs,
          endMs: entry.endMs,
          bytesWritten: entry.bytesWritten,
          sha256: entry.sha256,
          uri: entry.uri,
        })),
      }),
      "utf8",
    )
    .digest("hex");
}

export function buildLiveNativeTrackInterleavePlanGate(
  input: Partial<LiveNativeTrackInterleavePlanGateInput> = {},
): LiveNativeTrackInterleavePlanGateResult {
  const recordingId = safeId(input.recordingId);
  const requestedAction = safeAction(input.requestedAction);
  const maxAudioVideoDriftMs = safeNonNegativeInteger(input.maxAudioVideoDriftMs)
    ? input.maxAudioVideoDriftMs
    : DEFAULT_MAX_DRIFT_MS;
  const context = { recordingId, requestedAction, maxAudioVideoDriftMs, tracks: [], plan: [] };
  if (!recordingId) return fail("recording_id_invalid", context);
  if (requestedAction === "write_interleaved_output") {
    return fail("native_track_interleave_write_pending", context);
  }
  if (!Array.isArray(input.tracks) || input.tracks.length === 0) return fail("tracks_missing", context);
  if (input.tracks.length > MAX_TRACKS) return fail("too_many_tracks", context);

  const summaries: LiveNativeInterleaveTrackSummary[] = [];
  const plan: LiveNativeInterleavePlanEntry[] = [];

  for (let trackIndex = 0; trackIndex < input.tracks.length; trackIndex += 1) {
    const track = input.tracks[trackIndex];
    const trackId = safeTrackId(track.trackId);
    const codecLabel = safeCodec(track.codecLabel);
    if (!trackId) return fail(`track_${trackIndex}_id_invalid`, { ...context, tracks: summaries, plan });
    if (track.kind !== "video" && track.kind !== "audio") {
      return fail(`track_${trackIndex}_kind_invalid`, { ...context, tracks: summaries, plan });
    }
    if (!codecLabel) return fail(`track_${trackIndex}_codec_invalid`, { ...context, tracks: summaries, plan });
    if (!safePositiveInteger(track.timescale)) {
      return fail(`track_${trackIndex}_timescale_invalid`, { ...context, tracks: summaries, plan });
    }
    if (!Array.isArray(track.segments) || track.segments.length === 0) {
      return fail(`track_${trackIndex}_segments_missing`, { ...context, tracks: summaries, plan });
    }
    if (track.segments.length > MAX_SEGMENTS_PER_TRACK) {
      return fail(`track_${trackIndex}_too_many_segments`, { ...context, tracks: summaries, plan });
    }

    let previousSequence: number | null = null;
    let previousStartMs: number | null = null;
    let trackBytesWritten = 0;
    let trackStartMs = Number.POSITIVE_INFINITY;
    let trackEndMs = 0;

    for (let segmentIndex = 0; segmentIndex < track.segments.length; segmentIndex += 1) {
      const segment = track.segments[segmentIndex];
      if (!safeNonNegativeInteger(segment.sequence)) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_sequence_invalid`, { ...context, tracks: summaries, plan });
      }
      if (previousSequence !== null && segment.sequence !== previousSequence + 1) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_sequence_gap`, { ...context, tracks: summaries, plan });
      }
      if (!safeNonNegativeInteger(segment.startMs) || !safeNonNegativeInteger(segment.endMs) || segment.endMs <= segment.startMs) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_time_invalid`, { ...context, tracks: summaries, plan });
      }
      if (previousStartMs !== null && segment.startMs < previousStartMs) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_time_regression`, { ...context, tracks: summaries, plan });
      }
      if (!safePositiveInteger(segment.bytesWritten)) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_bytes_invalid`, { ...context, tracks: summaries, plan });
      }
      if (!isValidHash(segment.inputSha256) || !isValidHash(segment.writtenSha256)) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_hash_invalid`, { ...context, tracks: summaries, plan });
      }
      if (
        segment.payloadUnchanged !== true ||
        segment.inputSha256.toLowerCase() !== segment.writtenSha256.toLowerCase()
      ) {
        return fail(`track_${trackIndex}_segment_${segmentIndex}_payload_hash_mismatch`, { ...context, tracks: summaries, plan });
      }
      const uri = safeUri(segment.uri);
      if (!uri) return fail(`track_${trackIndex}_segment_${segmentIndex}_uri_invalid`, { ...context, tracks: summaries, plan });

      trackBytesWritten += segment.bytesWritten;
      trackStartMs = Math.min(trackStartMs, segment.startMs);
      trackEndMs = Math.max(trackEndMs, segment.endMs);
      plan.push({
        index: plan.length,
        trackId,
        kind: track.kind,
        sequence: segment.sequence,
        startMs: segment.startMs,
        endMs: segment.endMs,
        bytesWritten: segment.bytesWritten,
        sha256: segment.inputSha256.toLowerCase(),
        uri,
      });
      previousSequence = segment.sequence;
      previousStartMs = segment.startMs;
    }

    summaries.push({
      trackId,
      kind: track.kind,
      codecLabel,
      timescale: track.timescale,
      segmentCount: track.segments.length,
      startMs: trackStartMs,
      endMs: trackEndMs,
      bytesWritten: trackBytesWritten,
    });
  }

  const videoTracks = summaries.filter((track) => track.kind === "video");
  const audioTracks = summaries.filter((track) => track.kind === "audio");
  if (videoTracks.length === 0 || audioTracks.length === 0) {
    return fail("video_and_audio_tracks_required", { ...context, tracks: summaries, plan });
  }

  const videoStart = Math.min(...videoTracks.map((track) => track.startMs));
  const audioStart = Math.min(...audioTracks.map((track) => track.startMs));
  const videoEnd = Math.max(...videoTracks.map((track) => track.endMs));
  const audioEnd = Math.max(...audioTracks.map((track) => track.endMs));
  const observedAudioVideoDriftMs = Math.max(Math.abs(videoStart - audioStart), Math.abs(videoEnd - audioEnd));
  if (observedAudioVideoDriftMs > maxAudioVideoDriftMs) {
    return fail("audio_video_drift_too_large", {
      ...context,
      tracks: summaries,
      plan,
      observedAudioVideoDriftMs,
    });
  }

  plan.sort((left, right) => left.startMs - right.startMs || (left.kind === right.kind ? 0 : left.kind === "video" ? -1 : 1));
  const normalizedPlan = plan.map((entry, index) => ({ ...entry, index }));
  const startMs = Math.min(...summaries.map((track) => track.startMs));
  const endMs = Math.max(...summaries.map((track) => track.endMs));

  return {
    ok: true,
    reason: "native_track_interleave_plan_ready",
    version: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION,
    decisionRole: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    requestedAction,
    trackCount: summaries.length,
    videoTrackCount: videoTracks.length,
    audioTrackCount: audioTracks.length,
    segmentCount: normalizedPlan.length,
    startMs,
    endMs,
    maxAudioVideoDriftMs,
    observedAudioVideoDriftMs,
    planHash: planHash(recordingId, normalizedPlan),
    tracks: summaries,
    plan: normalizedPlan,
    interleaveWritePending: false,
    allPayloadsUnchanged: true,
    timestampsMonotonic: true,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeTrackInterleavePlanGatePolicy(): LiveNativeTrackInterleavePlanGatePolicy {
  return {
    version: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_VERSION,
    decisionRole: LIVE_NATIVE_TRACK_INTERLEAVE_PLAN_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "native_live_audio_video_track_interleave_plan_without_write",
    supportsInterleavePlan: true,
    supportsInterleaveWrite: false,
    interleaveWriteStatus: "native_track_interleave_write_pending",
    requiresVideoAndAudioTracks: true,
    requiresContiguousSequencesPerTrack: true,
    requiresMonotonicTimestamps: true,
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
