export const LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION =
  "live-native-large-video-writer-gate-v0.1" as const;

export const LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE =
  "live_native_large_video_writer_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeLargeVideoWriterStatus =
  | "prototype_candidate"
  | "ready_for_lab"
  | "product_ready"
  | "pending";

export interface LiveNativeLargeVideoWriterCandidateInput {
  candidateName: string;
  status?: LiveNativeLargeVideoWriterStatus;
  fileSizeBytes: number;
  largestOutputOffsetBytes: number;
  maxMemoryBytes: number;
  usesStreamingRead: boolean;
  usesStreamingWrite: boolean;
  buffersWholeFile: boolean;
  createsExtendedMdat: boolean;
  writesCo64Offsets: boolean;
  detectsStcoOverflow: boolean;
  preservesPayloadHashes: boolean;
  verifiesSourceIntact: boolean;
  writesOutputCopyOnly: boolean;
  rejectsSamePath: boolean;
  supportsProgressiveMp4Mov: boolean;
  rejectsFragmentedMp4UntilWriterExists: boolean;
  rejectsEncryptedMedia: boolean;
  rejectsUnknownSampleTables: boolean;
  usesFfmpeg: boolean;
  usesGplOrAgplDependency: boolean;
  usesPaidOrClosedDependency: boolean;
  usesNetworkFetch: boolean;
  reencodesVideo: boolean;
  reencodesAudio: boolean;
  modifiesVideoBytes: boolean;
  modifiesAudioBytes: boolean;
  sourceFileModified: boolean;
  testCount: number;
  failedTestCount: number;
  productionCodeTestedDirectly: boolean;
  fourGbPlusFixtureTested: boolean;
  canOpenVault?: boolean;
  confirmed?: boolean;
  final?: boolean;
}

export type LiveNativeLargeVideoWriterGateResult =
  | {
      ok: true;
      reason: "native_large_video_writer_candidate_ready_for_lab";
      version: typeof LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      candidateName: string;
      status: "ready_for_lab";
      fileSizeBytes: number;
      largestOutputOffsetBytes: number;
      maxMemoryBytes: number;
      productReady: false;
      labOnly: true;
      fourGbPlusSupportedForLab: true;
      missingProductProofs: readonly string[];
      allRequiredSafetyClaimsMet: true;
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
      version: typeof LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      candidateName: string | null;
      status: LiveNativeLargeVideoWriterStatus;
      fileSizeBytes: number | null;
      largestOutputOffsetBytes: number | null;
      maxMemoryBytes: number | null;
      productReady: false;
      labOnly: true;
      fourGbPlusSupportedForLab: false;
      missingProductProofs: readonly string[];
      allRequiredSafetyClaimsMet: false;
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

export interface LiveNativeLargeVideoWriterGatePolicy {
  version: typeof LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "gate_for_native_4gb_plus_mp4_mov_writer_before_product_use";
  writerCanBeProductReadyNow: false;
  writerCanBeLabReadyWithProofs: true;
  requiresFourGbPlusFixture: true;
  requiresStreamingRead: true;
  requiresStreamingWrite: true;
  forbidsWholeFileBuffer: true;
  requiresExtendedMdat: true;
  requiresCo64Offsets: true;
  requiresStcoOverflowDetection: true;
  requiresNoFfmpeg: true;
  requiresNoGplAgplPaidClosedDependency: true;
  requiresNoNetworkFetch: true;
  requiresNoReencode: true;
  requiresPayloadHashesPreserved: true;
  requiresSourceIntact: true;
  requiresOutputCopyOnly: true;
  maxAllowedMemoryBytes: number;
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
const MAX_ALLOWED_MEMORY_BYTES = 128 * 1024 * 1024;
const MIN_LAB_TEST_COUNT = 12;

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

function safeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 120);
  return safe.length > 0 ? safe : null;
}

function safeStatus(value: unknown): LiveNativeLargeVideoWriterStatus {
  if (value === "prototype_candidate" || value === "ready_for_lab" || value === "product_ready") return value;
  return "pending";
}

function safePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function safeNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function reject(
  reason: string,
  candidateName: string | null,
  status: LiveNativeLargeVideoWriterStatus,
  fileSizeBytes: number | null,
  largestOutputOffsetBytes: number | null,
  maxMemoryBytes: number | null,
  missingProductProofs: readonly string[],
): LiveNativeLargeVideoWriterGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION,
    decisionRole: LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    candidateName,
    status,
    fileSizeBytes,
    largestOutputOffsetBytes,
    maxMemoryBytes,
    productReady: false,
    labOnly: true,
    fourGbPlusSupportedForLab: false,
    missingProductProofs,
    allRequiredSafetyClaimsMet: false,
    ...safetyEnvelope(),
  };
}

function missingProofs(input: Partial<LiveNativeLargeVideoWriterCandidateInput>): string[] {
  const missing: string[] = [];
  if (input.usesStreamingRead !== true) missing.push("streaming_read");
  if (input.usesStreamingWrite !== true) missing.push("streaming_write");
  if (input.buffersWholeFile !== false) missing.push("no_whole_file_buffer");
  if (input.createsExtendedMdat !== true) missing.push("extended_mdat");
  if (input.writesCo64Offsets !== true) missing.push("co64_offsets");
  if (input.detectsStcoOverflow !== true) missing.push("stco_overflow_detection");
  if (input.preservesPayloadHashes !== true) missing.push("payload_hashes_preserved");
  if (input.verifiesSourceIntact !== true) missing.push("source_intact_verified");
  if (input.writesOutputCopyOnly !== true) missing.push("output_copy_only");
  if (input.rejectsSamePath !== true) missing.push("same_path_rejected");
  if (input.supportsProgressiveMp4Mov !== true) missing.push("progressive_mp4_mov_supported");
  if (input.rejectsFragmentedMp4UntilWriterExists !== true) missing.push("fragmented_mp4_safe_pending");
  if (input.rejectsEncryptedMedia !== true) missing.push("encrypted_media_safe_pending");
  if (input.rejectsUnknownSampleTables !== true) missing.push("unknown_sample_tables_safe_pending");
  if (input.usesFfmpeg !== false) missing.push("ffmpeg_absent");
  if (input.usesGplOrAgplDependency !== false) missing.push("gpl_agpl_absent");
  if (input.usesPaidOrClosedDependency !== false) missing.push("paid_closed_absent");
  if (input.usesNetworkFetch !== false) missing.push("network_fetch_absent");
  if (input.reencodesVideo !== false) missing.push("video_reencode_absent");
  if (input.reencodesAudio !== false) missing.push("audio_reencode_absent");
  if (input.modifiesVideoBytes !== false) missing.push("video_bytes_unchanged");
  if (input.modifiesAudioBytes !== false) missing.push("audio_bytes_unchanged");
  if (input.sourceFileModified !== false) missing.push("source_intact");
  if (input.fourGbPlusFixtureTested !== true) missing.push("4gb_plus_fixture_tested");
  if (input.productionCodeTestedDirectly !== true) missing.push("production_code_tested_directly");
  if (typeof input.testCount !== "number" || !Number.isInteger(input.testCount) || input.testCount < MIN_LAB_TEST_COUNT) {
    missing.push("enough_tests");
  }
  if (input.failedTestCount !== 0) missing.push("zero_failed_tests");
  return missing;
}

export function buildLiveNativeLargeVideoWriterGate(
  input: Partial<LiveNativeLargeVideoWriterCandidateInput> = {},
): LiveNativeLargeVideoWriterGateResult {
  const candidateName = safeName(input.candidateName);
  const status = safeStatus(input.status);
  const fileSizeBytes = safePositiveInteger(input.fileSizeBytes);
  const largestOutputOffsetBytes = safeNonNegativeInteger(input.largestOutputOffsetBytes);
  const maxMemoryBytes = safePositiveInteger(input.maxMemoryBytes);

  if (!candidateName) {
    return reject("candidate_name_invalid", null, status, fileSizeBytes, largestOutputOffsetBytes, maxMemoryBytes, ["candidate_name"]);
  }
  if (input.canOpenVault === true || input.confirmed === true || input.final === true) {
    return reject(
      "candidate_must_not_claim_core_decision_power",
      candidateName,
      status,
      fileSizeBytes,
      largestOutputOffsetBytes,
      maxMemoryBytes,
      ["no_core_decision_power"],
    );
  }
  if (fileSizeBytes === null) {
    return reject("file_size_invalid", candidateName, status, null, largestOutputOffsetBytes, maxMemoryBytes, ["file_size"]);
  }
  if (fileSizeBytes <= FOUR_GB_BOUNDARY) {
    return reject("file_must_be_4gb_plus_for_large_writer_gate", candidateName, status, fileSizeBytes, largestOutputOffsetBytes, maxMemoryBytes, ["4gb_plus_file"]);
  }
  if (largestOutputOffsetBytes === null || largestOutputOffsetBytes <= FOUR_GB_BOUNDARY) {
    return reject("largest_output_offset_must_cross_4gb", candidateName, status, fileSizeBytes, largestOutputOffsetBytes, maxMemoryBytes, ["4gb_plus_offset"]);
  }
  if (largestOutputOffsetBytes > fileSizeBytes) {
    return reject("largest_output_offset_beyond_file", candidateName, status, fileSizeBytes, largestOutputOffsetBytes, maxMemoryBytes, ["offset_within_file"]);
  }
  if (maxMemoryBytes === null || maxMemoryBytes > MAX_ALLOWED_MEMORY_BYTES) {
    return reject("max_memory_too_high_for_large_writer", candidateName, status, fileSizeBytes, largestOutputOffsetBytes, maxMemoryBytes, ["bounded_memory"]);
  }

  const missing = missingProofs(input);
  if (missing.length > 0) {
    return reject(
      `candidate_missing_required_proofs:${missing[0]}`,
      candidateName,
      status,
      fileSizeBytes,
      largestOutputOffsetBytes,
      maxMemoryBytes,
      missing,
    );
  }

  return {
    ok: true,
    reason: "native_large_video_writer_candidate_ready_for_lab",
    version: LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION,
    decisionRole: LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    candidateName,
    status: "ready_for_lab",
    fileSizeBytes,
    largestOutputOffsetBytes,
    maxMemoryBytes,
    productReady: false,
    labOnly: true,
    fourGbPlusSupportedForLab: true,
    missingProductProofs: ["full_live_vod_id_read_e2e"],
    allRequiredSafetyClaimsMet: true,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeLargeVideoWriterGatePolicy(): LiveNativeLargeVideoWriterGatePolicy {
  return {
    version: LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_VERSION,
    decisionRole: LIVE_NATIVE_LARGE_VIDEO_WRITER_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "gate_for_native_4gb_plus_mp4_mov_writer_before_product_use",
    writerCanBeProductReadyNow: false,
    writerCanBeLabReadyWithProofs: true,
    requiresFourGbPlusFixture: true,
    requiresStreamingRead: true,
    requiresStreamingWrite: true,
    forbidsWholeFileBuffer: true,
    requiresExtendedMdat: true,
    requiresCo64Offsets: true,
    requiresStcoOverflowDetection: true,
    requiresNoFfmpeg: true,
    requiresNoGplAgplPaidClosedDependency: true,
    requiresNoNetworkFetch: true,
    requiresNoReencode: true,
    requiresPayloadHashesPreserved: true,
    requiresSourceIntact: true,
    requiresOutputCopyOnly: true,
    maxAllowedMemoryBytes: MAX_ALLOWED_MEMORY_BYTES,
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
