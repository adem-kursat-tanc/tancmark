import { createHash } from "node:crypto";

export const LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION =
  "live-native-timed-text-track-gate-v0.1" as const;

export const LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE =
  "live_native_timed_text_track_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeTimedTextAction = "inventory" | "evidence_manifest" | "embed_or_rewrite";

export type LiveNativeTimedTextTrackKind = "subtitle" | "caption" | "timecode" | "metadata";

export type LiveNativeTimedTextPayloadFormat =
  | "webvtt"
  | "srt"
  | "ttml"
  | "mp4_text"
  | "tmcd"
  | "emsg"
  | "id3";

export interface LiveNativeTimedTextCueInput {
  sequence: number;
  startMs: number;
  endMs: number;
  payloadSha256: string;
  sourceRef?: string;
  payloadUnchanged?: boolean;
  rawTextIncluded?: boolean;
}

export interface LiveNativeTimedTextTrackInput {
  trackId: string;
  kind: LiveNativeTimedTextTrackKind;
  payloadFormat: LiveNativeTimedTextPayloadFormat;
  language?: string;
  cues: readonly LiveNativeTimedTextCueInput[];
}

export interface LiveNativeTimedTextTrackGateInput {
  recordingId: string;
  requestedAction?: LiveNativeTimedTextAction;
  tracks: readonly LiveNativeTimedTextTrackInput[];
}

export interface LiveNativeTimedTextCueEntry {
  index: number;
  sequence: number;
  startMs: number;
  endMs: number;
  payloadSha256: string;
  sourceRef: string | null;
}

export interface LiveNativeTimedTextTrackEntry {
  index: number;
  trackId: string;
  kind: LiveNativeTimedTextTrackKind;
  payloadFormat: LiveNativeTimedTextPayloadFormat;
  language: string | null;
  cueCount: number;
  startMs: number;
  endMs: number;
  cues: readonly LiveNativeTimedTextCueEntry[];
}

export type LiveNativeTimedTextTrackGateResult =
  | {
      ok: true;
      reason: "native_timed_text_track_evidence_ready";
      version: typeof LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string;
      requestedAction: Exclude<LiveNativeTimedTextAction, "embed_or_rewrite">;
      trackCount: number;
      cueCount: number;
      startMs: number;
      endMs: number;
      manifestHash: string;
      tracks: readonly LiveNativeTimedTextTrackEntry[];
      rawTextStored: false;
      hashesOnly: true;
      timestampsMonotonic: true;
      payloadsUnchanged: true;
      embedRewritePending: false;
      oldFfmpegUsed: false;
      dirtyFfmpegUsed: false;
      gplFfmpegUsed: false;
      nonfreeFfmpegUsed: false;
      paidDependencyUsed: false;
      networkFetchUsed: false;
      sourceModified: false;
      mediaPayloadModified: false;
      textMeaningChanged: false;
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
      version: typeof LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string | null;
      requestedAction: LiveNativeTimedTextAction;
      trackCount: number;
      cueCount: number;
      tracks: readonly LiveNativeTimedTextTrackEntry[];
      rawTextStored: false;
      hashesOnly: true;
      timestampsMonotonic: false;
      payloadsUnchanged: false;
      embedRewritePending: boolean;
      oldFfmpegUsed: false;
      dirtyFfmpegUsed: false;
      gplFfmpegUsed: false;
      nonfreeFfmpegUsed: false;
      paidDependencyUsed: false;
      networkFetchUsed: false;
      sourceModified: false;
      mediaPayloadModified: false;
      textMeaningChanged: false;
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

export interface LiveNativeTimedTextTrackGatePolicy {
  version: typeof LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "native_live_subtitle_timecode_track_evidence_gate_without_rewrite";
  supportsSubtitleInventory: true;
  supportsCaptionInventory: true;
  supportsTimecodeInventory: true;
  supportsMetadataInventory: true;
  supportsEvidenceManifest: true;
  supportsEmbedOrRewrite: false;
  embedRewriteStatus: "native_timed_text_embed_rewrite_pending";
  rawTextStorageAllowed: false;
  hashesOnly: true;
  requiresMonotonicTimestamps: true;
  requiresPayloadHash: true;
  requiresPayloadUnchanged: true;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchAllowed: false;
  sourceModified: false;
  mediaPayloadModified: false;
  textMeaningChanged: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const MAX_TRACKS = 64;
const MAX_CUES_PER_TRACK = 50_000;
const MAX_TOTAL_CUES = 250_000;
const SHA256_RE = /^[a-f0-9]{64}$/i;

function safetyEnvelope() {
  return {
    rawTextStored: false,
    hashesOnly: true,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsed: false,
    sourceModified: false,
    mediaPayloadModified: false,
    textMeaningChanged: false,
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

function fail(
  reason: string,
  input: { recordingId: string | null; requestedAction: LiveNativeTimedTextAction },
  tracks: readonly LiveNativeTimedTextTrackEntry[] = [],
  cueCount = tracks.reduce((sum, track) => sum + track.cueCount, 0),
): LiveNativeTimedTextTrackGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION,
    decisionRole: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId: input.recordingId,
    requestedAction: input.requestedAction,
    trackCount: tracks.length,
    cueCount,
    tracks,
    timestampsMonotonic: false,
    payloadsUnchanged: false,
    embedRewritePending: input.requestedAction === "embed_or_rewrite",
    ...safetyEnvelope(),
  };
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

function safeLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().toLowerCase();
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(safe)) return null;
  return safe;
}

function safeSourceRef(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
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
  if (safe.includes("..")) return null;
  if (!/^[a-zA-Z0-9_./:-]{1,180}$/.test(safe)) return null;
  return safe;
}

function safeAction(value: unknown): LiveNativeTimedTextAction {
  if (value === "inventory" || value === "embed_or_rewrite") return value;
  return "evidence_manifest";
}

function isValidHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function safeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 86_400_000;
}

function formatMatchesKind(kind: LiveNativeTimedTextTrackKind, format: LiveNativeTimedTextPayloadFormat): boolean {
  if (kind === "subtitle" || kind === "caption") {
    return format === "webvtt" || format === "srt" || format === "ttml" || format === "mp4_text";
  }
  if (kind === "timecode") return format === "tmcd";
  return format === "emsg" || format === "id3" || format === "mp4_text";
}

function manifestHash(
  recordingId: string,
  tracks: readonly LiveNativeTimedTextTrackEntry[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION,
        recordingId,
        tracks: tracks.map((track) => ({
          trackId: track.trackId,
          kind: track.kind,
          payloadFormat: track.payloadFormat,
          language: track.language,
          cues: track.cues.map((cue) => ({
            sequence: cue.sequence,
            startMs: cue.startMs,
            endMs: cue.endMs,
            payloadSha256: cue.payloadSha256.toLowerCase(),
            sourceRef: cue.sourceRef,
          })),
        })),
      }),
      "utf8",
    )
    .digest("hex");
}

function scanTrack(
  track: LiveNativeTimedTextTrackInput,
  index: number,
): { ok: true; entry: LiveNativeTimedTextTrackEntry } | { ok: false; reason: string; cueCount: number } {
  const trackId = safeTrackId(track.trackId);
  if (!trackId) return { ok: false, reason: `track_${index}_id_invalid`, cueCount: 0 };
  if (!formatMatchesKind(track.kind, track.payloadFormat)) {
    return { ok: false, reason: `track_${index}_format_invalid_for_kind`, cueCount: 0 };
  }
  if (!Array.isArray(track.cues) || track.cues.length === 0) {
    return { ok: false, reason: `track_${index}_cues_missing`, cueCount: 0 };
  }
  if (track.cues.length > MAX_CUES_PER_TRACK) {
    return { ok: false, reason: `track_${index}_too_many_cues`, cueCount: track.cues.length };
  }

  const language = safeLanguage(track.language);
  const cues: LiveNativeTimedTextCueEntry[] = [];
  let previousSequence: number | null = null;
  let previousStartMs: number | null = null;

  for (let cueIndex = 0; cueIndex < track.cues.length; cueIndex += 1) {
    const cue = track.cues[cueIndex];
    if (cue.rawTextIncluded === true) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_raw_text_not_allowed`, cueCount: cueIndex + 1 };
    }
    if (!safeNonNegativeInteger(cue.sequence)) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_sequence_invalid`, cueCount: cueIndex + 1 };
    }
    if (previousSequence !== null && cue.sequence !== previousSequence + 1) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_sequence_gap`, cueCount: cueIndex + 1 };
    }
    if (!safeNonNegativeInteger(cue.startMs) || !safeNonNegativeInteger(cue.endMs) || cue.endMs < cue.startMs) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_time_invalid`, cueCount: cueIndex + 1 };
    }
    if (previousStartMs !== null && cue.startMs < previousStartMs) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_time_regression`, cueCount: cueIndex + 1 };
    }
    if (!isValidHash(cue.payloadSha256)) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_hash_invalid`, cueCount: cueIndex + 1 };
    }
    if (cue.payloadUnchanged !== true) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_payload_changed_or_unverified`, cueCount: cueIndex + 1 };
    }
    const sourceRef = safeSourceRef(cue.sourceRef);
    if (cue.sourceRef !== undefined && sourceRef === null) {
      return { ok: false, reason: `track_${index}_cue_${cueIndex}_source_ref_invalid`, cueCount: cueIndex + 1 };
    }

    cues.push({
      index: cueIndex,
      sequence: cue.sequence,
      startMs: cue.startMs,
      endMs: cue.endMs,
      payloadSha256: cue.payloadSha256.toLowerCase(),
      sourceRef,
    });
    previousSequence = cue.sequence;
    previousStartMs = cue.startMs;
  }

  return {
    ok: true,
    entry: {
      index,
      trackId,
      kind: track.kind,
      payloadFormat: track.payloadFormat,
      language,
      cueCount: cues.length,
      startMs: cues[0]?.startMs ?? 0,
      endMs: cues.at(-1)?.endMs ?? 0,
      cues,
    },
  };
}

export function buildLiveNativeTimedTextTrackGate(
  input: Partial<LiveNativeTimedTextTrackGateInput> = {},
): LiveNativeTimedTextTrackGateResult {
  const recordingId = safeId(input.recordingId);
  const requestedAction = safeAction(input.requestedAction);

  if (!recordingId) return fail("recording_id_invalid", { recordingId: null, requestedAction });
  if (requestedAction === "embed_or_rewrite") {
    return fail("native_timed_text_embed_rewrite_pending", { recordingId, requestedAction });
  }
  if (!Array.isArray(input.tracks) || input.tracks.length === 0) {
    return fail("tracks_missing", { recordingId, requestedAction });
  }
  if (input.tracks.length > MAX_TRACKS) {
    return fail("too_many_tracks", { recordingId, requestedAction }, [], 0);
  }

  const entries: LiveNativeTimedTextTrackEntry[] = [];
  let totalCues = 0;
  for (let trackIndex = 0; trackIndex < input.tracks.length; trackIndex += 1) {
    const scanned = scanTrack(input.tracks[trackIndex], trackIndex);
    if (!scanned.ok) {
      return fail(scanned.reason, { recordingId, requestedAction }, entries, totalCues + scanned.cueCount);
    }
    totalCues += scanned.entry.cueCount;
    if (totalCues > MAX_TOTAL_CUES) {
      return fail("too_many_total_cues", { recordingId, requestedAction }, entries, totalCues);
    }
    entries.push(scanned.entry);
  }

  const startMs = Math.min(...entries.map((track) => track.startMs));
  const endMs = Math.max(...entries.map((track) => track.endMs));

  return {
    ok: true,
    reason: "native_timed_text_track_evidence_ready",
    version: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION,
    decisionRole: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    requestedAction,
    trackCount: entries.length,
    cueCount: totalCues,
    startMs,
    endMs,
    manifestHash: manifestHash(recordingId, entries),
    tracks: entries,
    timestampsMonotonic: true,
    payloadsUnchanged: true,
    embedRewritePending: false,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeTimedTextTrackGatePolicy(): LiveNativeTimedTextTrackGatePolicy {
  return {
    version: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_VERSION,
    decisionRole: LIVE_NATIVE_TIMED_TEXT_TRACK_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "native_live_subtitle_timecode_track_evidence_gate_without_rewrite",
    supportsSubtitleInventory: true,
    supportsCaptionInventory: true,
    supportsTimecodeInventory: true,
    supportsMetadataInventory: true,
    supportsEvidenceManifest: true,
    supportsEmbedOrRewrite: false,
    embedRewriteStatus: "native_timed_text_embed_rewrite_pending",
    rawTextStorageAllowed: false,
    hashesOnly: true,
    requiresMonotonicTimestamps: true,
    requiresPayloadHash: true,
    requiresPayloadUnchanged: true,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchAllowed: false,
    sourceModified: false,
    mediaPayloadModified: false,
    textMeaningChanged: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
