export const LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION =
  "live-native-interleave-writer-gate-v0.1" as const;

export const LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE =
  "live_native_interleave_writer_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeInterleaveWriterStatus =
  | "prototype_candidate"
  | "ready_for_lab"
  | "product_ready"
  | "pending";

export interface LiveNativeInterleaveWriterCandidateInput {
  candidateName: string;
  status?: LiveNativeInterleaveWriterStatus;
  usesFfmpeg: boolean;
  usesGplOrAgplDependency: boolean;
  usesPaidOrClosedDependency: boolean;
  reencodesVideo: boolean;
  reencodesAudio: boolean;
  modifiesVideoBytes: boolean;
  modifiesAudioBytes: boolean;
  sourceFileModified: boolean;
  writesOutputCopyOnly: boolean;
  supportsBasicProgressiveMp4Mov: boolean;
  rejectsFragmentedMp4: boolean;
  rejectsEncryptedMedia: boolean;
  rejectsEditList: boolean;
  rejectsUnknownSampleTables: boolean;
  handlesStco: boolean;
  handlesCo64: boolean;
  detectsStcoOverflow: boolean;
  preservesPayloadHashes: boolean;
  verifiesSourceIntact: boolean;
  testCount: number;
  failedTestCount: number;
  productionCodeTestedDirectly: boolean;
  canOpenVault?: boolean;
  confirmed?: boolean;
  final?: boolean;
}

export type LiveNativeInterleaveWriterGateResult =
  | {
      ok: true;
      reason: "native_interleave_writer_candidate_ready_for_lab";
      version: typeof LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      candidateName: string;
      status: "ready_for_lab";
      productReady: false;
      labOnly: true;
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
      version: typeof LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION;
      decisionRole: typeof LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE;
      productDefaultVideoEngine: "tancmark_native_video_factory";
      candidateName: string | null;
      status: LiveNativeInterleaveWriterStatus;
      productReady: false;
      labOnly: true;
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

export interface LiveNativeInterleaveWriterGatePolicy {
  version: typeof LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "gate_for_native_audio_video_interleave_writer_before_product_use";
  writerCanBeProductReadyNow: false;
  writerCanBeLabReadyWithProofs: true;
  requiresNoFfmpeg: true;
  requiresNoGplAgplPaidClosedDependency: true;
  requiresNoReencode: true;
  requiresPayloadHashesPreserved: true;
  requiresSourceIntact: true;
  requiresOutputCopyOnly: true;
  requiresBasicMp4MovOnly: true;
  requiresComplexLayoutsPending: true;
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

const MIN_LAB_TEST_COUNT = 10;

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

function safeStatus(value: unknown): LiveNativeInterleaveWriterStatus {
  if (value === "prototype_candidate" || value === "ready_for_lab" || value === "product_ready") return value;
  return "pending";
}

function reject(
  reason: string,
  candidateName: string | null,
  status: LiveNativeInterleaveWriterStatus,
  missingProductProofs: readonly string[],
): LiveNativeInterleaveWriterGateResult {
  return {
    ok: false,
    reason,
    version: LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION,
    decisionRole: LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    candidateName,
    status,
    productReady: false,
    labOnly: true,
    missingProductProofs,
    allRequiredSafetyClaimsMet: false,
    ...safetyEnvelope(),
  };
}

function missingProofs(input: Partial<LiveNativeInterleaveWriterCandidateInput>): string[] {
  const missing: string[] = [];
  if (input.usesFfmpeg !== false) missing.push("ffmpeg_absent");
  if (input.usesGplOrAgplDependency !== false) missing.push("gpl_agpl_absent");
  if (input.usesPaidOrClosedDependency !== false) missing.push("paid_closed_absent");
  if (input.reencodesVideo !== false) missing.push("video_reencode_absent");
  if (input.reencodesAudio !== false) missing.push("audio_reencode_absent");
  if (input.modifiesVideoBytes !== false) missing.push("video_bytes_unchanged");
  if (input.modifiesAudioBytes !== false) missing.push("audio_bytes_unchanged");
  if (input.sourceFileModified !== false) missing.push("source_intact");
  if (input.writesOutputCopyOnly !== true) missing.push("output_copy_only");
  if (input.supportsBasicProgressiveMp4Mov !== true) missing.push("basic_progressive_mp4_mov_supported");
  if (input.rejectsFragmentedMp4 !== true) missing.push("fragmented_mp4_rejected");
  if (input.rejectsEncryptedMedia !== true) missing.push("encrypted_media_rejected");
  if (input.rejectsEditList !== true) missing.push("edit_list_rejected");
  if (input.rejectsUnknownSampleTables !== true) missing.push("unknown_sample_tables_rejected");
  if (input.handlesStco !== true) missing.push("stco_handled");
  if (input.handlesCo64 !== true) missing.push("co64_handled");
  if (input.detectsStcoOverflow !== true) missing.push("stco_overflow_detected");
  if (input.preservesPayloadHashes !== true) missing.push("payload_hashes_preserved");
  if (input.verifiesSourceIntact !== true) missing.push("source_intact_verified");
  if (input.productionCodeTestedDirectly !== true) missing.push("production_code_tested_directly");
  if (typeof input.testCount !== "number" || !Number.isInteger(input.testCount) || input.testCount < MIN_LAB_TEST_COUNT) {
    missing.push("enough_tests");
  }
  if (input.failedTestCount !== 0) missing.push("zero_failed_tests");
  return missing;
}

export function buildLiveNativeInterleaveWriterGate(
  input: Partial<LiveNativeInterleaveWriterCandidateInput> = {},
): LiveNativeInterleaveWriterGateResult {
  const candidateName = safeName(input.candidateName);
  const status = safeStatus(input.status);
  if (!candidateName) return reject("candidate_name_invalid", null, status, ["candidate_name"]);
  if (input.canOpenVault === true || input.confirmed === true || input.final === true) {
    return reject("candidate_must_not_claim_core_decision_power", candidateName, status, ["no_core_decision_power"]);
  }
  const missing = missingProofs(input);
  if (missing.length > 0) return reject(`candidate_missing_required_proofs:${missing[0]}`, candidateName, status, missing);

  return {
    ok: true,
    reason: "native_interleave_writer_candidate_ready_for_lab",
    version: LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION,
    decisionRole: LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    candidateName,
    status: "ready_for_lab",
    productReady: false,
    labOnly: true,
    missingProductProofs: ["real_world_extreme_live_files", "full_product_e2e_live_vod_id_read"],
    allRequiredSafetyClaimsMet: true,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeInterleaveWriterGatePolicy(): LiveNativeInterleaveWriterGatePolicy {
  return {
    version: LIVE_NATIVE_INTERLEAVE_WRITER_GATE_VERSION,
    decisionRole: LIVE_NATIVE_INTERLEAVE_WRITER_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "gate_for_native_audio_video_interleave_writer_before_product_use",
    writerCanBeProductReadyNow: false,
    writerCanBeLabReadyWithProofs: true,
    requiresNoFfmpeg: true,
    requiresNoGplAgplPaidClosedDependency: true,
    requiresNoReencode: true,
    requiresPayloadHashesPreserved: true,
    requiresSourceIntact: true,
    requiresOutputCopyOnly: true,
    requiresBasicMp4MovOnly: true,
    requiresComplexLayoutsPending: true,
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
