export const LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_VERSION =
  "live-native-sample-table-clip-gate-v0.1" as const;

export const LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_DECISION_ROLE =
  "live_native_sample_table_clip_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeSampleTableClipFormat = "mp4" | "mov" | "unknown";
export type LiveNativeSampleTableClipLayout = "progressive_mp4" | "fragmented_mp4" | "unknown";

export interface LiveNativeSampleTableClipProof {
  baselineTestsPassed?: number | null;
  sourceIntact?: boolean | null;
  sampleBytesUnchanged?: boolean | null;
  outputParseVerified?: boolean | null;
  keyframeAligned?: boolean | null;
  audioVideoSyncPreserved?: boolean | null;
  undefinedOptionsGuardPassed?: boolean | null;
  noFfmpeg?: boolean | null;
  noNetwork?: boolean | null;
}

export interface LiveNativeSampleTableClipGateInput {
  recordingId?: string | null;
  format?: LiveNativeSampleTableClipFormat | null;
  layout?: LiveNativeSampleTableClipLayout | null;
  trackTypes?: readonly string[] | null;
  startMs?: number | null;
  endMs?: number | null;
  actualStartMs?: number | null;
  fileBytes?: number | null;
  editListPresent?: boolean | null;
  compactSampleSizePresent?: boolean | null;
  requiredTablesRewritten?: readonly string[] | null;
  proof?: LiveNativeSampleTableClipProof | null;
}

export interface LiveNativeSampleTableClipGateResult {
  ok: boolean;
  reason: string;
  version: typeof LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  recordingId: string | null;
  format: LiveNativeSampleTableClipFormat;
  layout: LiveNativeSampleTableClipLayout;
  trackTypes: readonly string[];
  startMs: number | null;
  endMs: number | null;
  actualStartMs: number | null;
  safeToExecuteNarrowTimedClip: boolean;
  guardedTimedClipReady: boolean;
  productDefaultForEveryMp4Mov: false;
  baselineTestsPassed: number;
  requiredTables: readonly string[];
  requiredTablesSatisfied: boolean;
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

export interface LiveNativeSampleTableClipGatePolicy {
  version: typeof LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "guarded_native_mp4_mov_timed_clip_sample_table_rewrite";
  supportsGuardedTrueTimedClip: true;
  productDefaultForEveryMp4Mov: false;
  minimumBaselineTestsRequired: 21;
  requiredTables: readonly string[];
  allowedFormats: readonly ["mp4", "mov"];
  allowedLayout: "progressive_mp4";
  allowedTrackTypes: readonly ["vide", "soun"];
  editListRequiresFurtherGate: true;
  compactSampleSizeRequiresFurtherGate: true;
  fragmentedMp4RequiresFurtherGate: true;
  undefinedOptionsGuardRequired: true;
  sourceMustRemainIntact: true;
  sampleBytesMustRemainUnchanged: true;
  outputMustParseAfterWrite: true;
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

const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
const MIN_BASELINE_TESTS = 21;
const REQUIRED_TABLES = [
  "stts",
  "ctts",
  "stss",
  "stsc",
  "stsz",
  "stco",
  "co64",
  "mvhd",
  "tkhd",
  "mdhd",
] as const;

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

function safeFormat(value: unknown): LiveNativeSampleTableClipFormat {
  return value === "mp4" || value === "mov" ? value : "unknown";
}

function safeLayout(value: unknown): LiveNativeSampleTableClipLayout {
  if (value === "progressive_mp4" || value === "fragmented_mp4") return value;
  return "unknown";
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function safeTrackTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function hasAllRequiredTables(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const seen = new Set(value.filter((item): item is string => typeof item === "string"));
  return REQUIRED_TABLES.every((table) => seen.has(table));
}

function reject(
  reason: string,
  input: {
    recordingId: string | null;
    format: LiveNativeSampleTableClipFormat;
    layout: LiveNativeSampleTableClipLayout;
    trackTypes: readonly string[];
    startMs: number | null;
    endMs: number | null;
    actualStartMs: number | null;
    baselineTestsPassed: number;
    requiredTablesSatisfied: boolean;
  },
): LiveNativeSampleTableClipGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_VERSION,
    decisionRole: LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    ...input,
    safeToExecuteNarrowTimedClip: false,
    guardedTimedClipReady: false,
    productDefaultForEveryMp4Mov: false,
    requiredTables: REQUIRED_TABLES,
    ...safetyEnvelope(),
  };
}

export function buildLiveNativeSampleTableClipGate(
  input: LiveNativeSampleTableClipGateInput = {},
): LiveNativeSampleTableClipGateResult {
  const recordingId = safeId(input?.recordingId);
  const format = safeFormat(input?.format);
  const layout = safeLayout(input?.layout);
  const trackTypes = safeTrackTypes(input?.trackTypes);
  const startMs = safeNumber(input?.startMs);
  const endMs = safeNumber(input?.endMs);
  const actualStartMs = safeNumber(input?.actualStartMs);
  const baselineTestsPassed = Math.max(0, safeNumber(input?.proof?.baselineTestsPassed) ?? 0);
  const requiredTablesSatisfied = hasAllRequiredTables(input?.requiredTablesRewritten);
  const state = {
    recordingId,
    format,
    layout,
    trackTypes,
    startMs,
    endMs,
    actualStartMs,
    baselineTestsPassed,
    requiredTablesSatisfied,
  };

  if (!recordingId) return reject("recording_id_invalid", state);
  if (format === "unknown") return reject("unsupported_format", state);
  if (layout !== "progressive_mp4") return reject("fragmented_or_unknown_layout_requires_further_gate", state);
  if (startMs === null || startMs < 0) return reject("invalid_start_ms", state);
  if (endMs === null || endMs <= startMs) return reject("invalid_end_ms", state);
  if (actualStartMs === null || actualStartMs < 0 || actualStartMs > startMs) {
    return reject("keyframe_alignment_not_proven", state);
  }
  if (typeof input?.fileBytes === "number" && input.fileBytes > MAX_FILE_BYTES) {
    return reject("source_too_large_for_32bit_mdat_gate", state);
  }
  if (input?.editListPresent === true) return reject("edit_list_present_requires_further_gate", state);
  if (input?.compactSampleSizePresent === true) return reject("compact_sample_size_requires_further_gate", state);
  if (trackTypes.length === 0) return reject("track_types_missing", state);
  if (trackTypes.some((type) => type !== "vide" && type !== "soun")) {
    return reject("unsupported_track_type_requires_further_gate", state);
  }
  if (!requiredTablesSatisfied) return reject("required_sample_tables_not_proven", state);

  const proof = input?.proof ?? {};
  const proofChecks: Array<[string, boolean]> = [
    ["baseline_tests_missing", baselineTestsPassed >= MIN_BASELINE_TESTS],
    ["source_intact_not_proven", proof.sourceIntact === true],
    ["sample_bytes_unchanged_not_proven", proof.sampleBytesUnchanged === true],
    ["output_parse_not_proven", proof.outputParseVerified === true],
    ["keyframe_alignment_not_proven", proof.keyframeAligned === true],
    ["audio_video_sync_not_proven", proof.audioVideoSyncPreserved === true],
    ["undefined_options_guard_missing", proof.undefinedOptionsGuardPassed === true],
    ["ffmpeg_absence_not_proven", proof.noFfmpeg === true],
    ["network_absence_not_proven", proof.noNetwork === true],
  ];
  const failed = proofChecks.find(([, ok]) => !ok);
  if (failed) return reject(failed[0], state);

  return {
    ok: true,
    reason: "native_sample_table_clip_guarded_ready",
    version: LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_VERSION,
    decisionRole: LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    ...state,
    safeToExecuteNarrowTimedClip: true,
    guardedTimedClipReady: true,
    productDefaultForEveryMp4Mov: false,
    requiredTables: REQUIRED_TABLES,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeSampleTableClipGatePolicy(): LiveNativeSampleTableClipGatePolicy {
  return {
    version: LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_VERSION,
    decisionRole: LIVE_NATIVE_SAMPLE_TABLE_CLIP_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "guarded_native_mp4_mov_timed_clip_sample_table_rewrite",
    supportsGuardedTrueTimedClip: true,
    productDefaultForEveryMp4Mov: false,
    minimumBaselineTestsRequired: MIN_BASELINE_TESTS,
    requiredTables: REQUIRED_TABLES,
    allowedFormats: ["mp4", "mov"],
    allowedLayout: "progressive_mp4",
    allowedTrackTypes: ["vide", "soun"],
    editListRequiresFurtherGate: true,
    compactSampleSizeRequiresFurtherGate: true,
    fragmentedMp4RequiresFurtherGate: true,
    undefinedOptionsGuardRequired: true,
    sourceMustRemainIntact: true,
    sampleBytesMustRemainUnchanged: true,
    outputMustParseAfterWrite: true,
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
