export const LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION =
  "live-native-large-video-offset-gate-v0.1" as const;

export const LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE =
  "live_native_large_video_offset_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeLargeVideoOffsetAction = "inspect" | "faststart_prepare" | "offset_rewrite";

export type LiveNativeLargeVideoContainer = "mp4" | "mov";

export interface LiveNativeLargeVideoOffsetGateInput {
  recordingId: string;
  container: LiveNativeLargeVideoContainer;
  requestedAction?: LiveNativeLargeVideoOffsetAction;
  fileSizeBytes: number;
  largestMediaOffset: number;
  usesStco: boolean;
  usesCo64: boolean;
  maxStcoOffset?: number;
  maxCo64Offset?: number;
  faststartDeltaBytes?: number;
  payloadSha256Before: string;
  payloadSha256After: string;
  sourceModified?: boolean;
}

export type LiveNativeLargeVideoOffsetGateResult =
  | {
      ok: true;
      reason: "native_large_video_offset_gate_ready";
      version: typeof LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string;
      container: LiveNativeLargeVideoContainer;
      requestedAction: Exclude<LiveNativeLargeVideoOffsetAction, "offset_rewrite">;
      fileSizeBytes: number;
      largestMediaOffset: number;
      isLargeFile: boolean;
      usesStco: boolean;
      usesCo64: boolean;
      faststartDeltaBytes: number;
      offsetsSafeForLargeFile: true;
      payloadsUnchanged: true;
      offsetRewritePending: false;
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
      version: typeof LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      recordingId: string | null;
      container: LiveNativeLargeVideoContainer | "unknown";
      requestedAction: LiveNativeLargeVideoOffsetAction;
      fileSizeBytes: number | null;
      largestMediaOffset: number | null;
      isLargeFile: boolean;
      usesStco: boolean;
      usesCo64: boolean;
      faststartDeltaBytes: number;
      offsetsSafeForLargeFile: false;
      payloadsUnchanged: false;
      offsetRewritePending: boolean;
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

export interface LiveNativeLargeVideoOffsetGatePolicy {
  version: typeof LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "native_4gb_plus_mp4_mov_offset_safety_gate_without_rewrite";
  supportsLargeFileInspection: true;
  supportsCo64ReadinessCheck: true;
  supportsStcoOverflowDetection: true;
  supportsOffsetRewrite: false;
  offsetRewriteStatus: "native_large_video_offset_rewrite_pending";
  fourGbBoundaryBytes: number;
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

const FOUR_GB_BOUNDARY = 0xffffffff;
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

function safeAction(value: unknown): LiveNativeLargeVideoOffsetAction {
  if (value === "faststart_prepare" || value === "offset_rewrite") return value;
  return "inspect";
}

function safeContainer(value: unknown): LiveNativeLargeVideoContainer | "unknown" {
  return value === "mp4" || value === "mov" ? value : "unknown";
}

function safeNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function safePositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isValidHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function fail(
  reason: string,
  input: {
    recordingId: string | null;
    container: LiveNativeLargeVideoContainer | "unknown";
    requestedAction: LiveNativeLargeVideoOffsetAction;
    fileSizeBytes: number | null;
    largestMediaOffset: number | null;
    isLargeFile: boolean;
    usesStco: boolean;
    usesCo64: boolean;
    faststartDeltaBytes: number;
  },
): LiveNativeLargeVideoOffsetGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION,
    decisionRole: LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId: input.recordingId,
    container: input.container,
    requestedAction: input.requestedAction,
    fileSizeBytes: input.fileSizeBytes,
    largestMediaOffset: input.largestMediaOffset,
    isLargeFile: input.isLargeFile,
    usesStco: input.usesStco,
    usesCo64: input.usesCo64,
    faststartDeltaBytes: input.faststartDeltaBytes,
    offsetsSafeForLargeFile: false,
    payloadsUnchanged: false,
    offsetRewritePending: input.requestedAction === "offset_rewrite",
    ...safetyEnvelope(),
  };
}

export function buildLiveNativeLargeVideoOffsetGate(
  input: Partial<LiveNativeLargeVideoOffsetGateInput> = {},
): LiveNativeLargeVideoOffsetGateResult {
  const recordingId = safeId(input.recordingId);
  const container = safeContainer(input.container);
  const requestedAction = safeAction(input.requestedAction);
  const fileSizeBytes = safePositiveSafeInteger(input.fileSizeBytes) ? input.fileSizeBytes : null;
  const largestMediaOffset = safeNonNegativeSafeInteger(input.largestMediaOffset) ? input.largestMediaOffset : null;
  const usesStco = input.usesStco === true;
  const usesCo64 = input.usesCo64 === true;
  const faststartDeltaBytes = safeNonNegativeSafeInteger(input.faststartDeltaBytes)
    ? input.faststartDeltaBytes
    : 0;
  const isLargeFile = (fileSizeBytes ?? 0) > FOUR_GB_BOUNDARY || (largestMediaOffset ?? 0) > FOUR_GB_BOUNDARY;

  const failureContext = {
    recordingId,
    container,
    requestedAction,
    fileSizeBytes,
    largestMediaOffset,
    isLargeFile,
    usesStco,
    usesCo64,
    faststartDeltaBytes,
  };

  if (!recordingId) return fail("recording_id_invalid", failureContext);
  if (container === "unknown") return fail("container_invalid", failureContext);
  if (requestedAction === "offset_rewrite") return fail("native_large_video_offset_rewrite_pending", failureContext);
  if (fileSizeBytes === null) return fail("file_size_invalid", failureContext);
  if (largestMediaOffset === null || largestMediaOffset > fileSizeBytes) {
    return fail("largest_media_offset_invalid", failureContext);
  }
  if (input.sourceModified === true) return fail("source_modified_not_allowed", failureContext);
  if (!isValidHash(input.payloadSha256Before) || !isValidHash(input.payloadSha256After)) {
    return fail("payload_hash_invalid", failureContext);
  }
  if (input.payloadSha256Before.toLowerCase() !== input.payloadSha256After.toLowerCase()) {
    return fail("payload_hash_mismatch", failureContext);
  }
  if (isLargeFile && !usesCo64) return fail("large_file_requires_co64", failureContext);
  if (!usesStco && !usesCo64) return fail("offset_table_missing", failureContext);
  if (usesStco) {
    const maxStcoOffset = safeNonNegativeSafeInteger(input.maxStcoOffset) ? input.maxStcoOffset : null;
    if (maxStcoOffset === null) return fail("stco_max_offset_missing", failureContext);
    if (maxStcoOffset > FOUR_GB_BOUNDARY) return fail("stco_offset_over_32bit", failureContext);
    if (maxStcoOffset + faststartDeltaBytes > FOUR_GB_BOUNDARY) {
      return fail("stco_faststart_delta_overflow", failureContext);
    }
  }
  if (usesCo64) {
    const maxCo64Offset = safeNonNegativeSafeInteger(input.maxCo64Offset) ? input.maxCo64Offset : null;
    if (maxCo64Offset === null) return fail("co64_max_offset_missing", failureContext);
    if (maxCo64Offset > fileSizeBytes) return fail("co64_offset_beyond_file", failureContext);
  }

  return {
    ok: true,
    reason: "native_large_video_offset_gate_ready",
    version: LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION,
    decisionRole: LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    recordingId,
    container,
    requestedAction,
    fileSizeBytes,
    largestMediaOffset,
    isLargeFile,
    usesStco,
    usesCo64,
    faststartDeltaBytes,
    offsetsSafeForLargeFile: true,
    payloadsUnchanged: true,
    offsetRewritePending: false,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeLargeVideoOffsetGatePolicy(): LiveNativeLargeVideoOffsetGatePolicy {
  return {
    version: LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_VERSION,
    decisionRole: LIVE_NATIVE_LARGE_VIDEO_OFFSET_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "native_4gb_plus_mp4_mov_offset_safety_gate_without_rewrite",
    supportsLargeFileInspection: true,
    supportsCo64ReadinessCheck: true,
    supportsStcoOverflowDetection: true,
    supportsOffsetRewrite: false,
    offsetRewriteStatus: "native_large_video_offset_rewrite_pending",
    fourGbBoundaryBytes: FOUR_GB_BOUNDARY,
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
