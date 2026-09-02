export const FFMPEG_CLEAN_PRODUCT_GATE_VERSION =
  "ffmpeg-clean-product-gate-v0.1" as const;
export const FFMPEG_CLEAN_PRODUCT_GATE_DECISION_ROLE =
  "ffmpeg_clean_product_gate_policy_only_no_vault_no_confirmed" as const;

export type FfmpegDistributionMode =
  | "external_cli"
  | "bundled_product_binary";

export type FfmpegCleanProductDecision =
  | "allowed_external_cli_only"
  | "blocked_bundled_binary"
  | "blocked_enable_gpl"
  | "blocked_gpl_codec_library"
  | "blocked_enable_nonfree"
  | "blocked_nonfree_library"
  | "blocked_no_configuration_line"
  | "blocked_empty_or_unparseable_output"
  | "review_required_enable_version3";

export type FfmpegCleanProductReason =
  | "clean_lgpl_external_cli_only"
  | "bundled_ffmpeg_binary_not_allowed_in_product"
  | "enable_gpl_flag_detected"
  | "gpl_codec_library_detected"
  | "enable_nonfree_flag_detected"
  | "nonfree_library_detected"
  | "configuration_line_not_found_cannot_verify_clean_build"
  | "empty_or_unparseable_version_output"
  | "enable_version3_flag_detected_review_required";

export interface FfmpegCleanProductGateInput {
  versionOutput: unknown;
  distributionMode?: FfmpegDistributionMode | null;
}

export interface FfmpegCleanProductGateResult {
  version: typeof FFMPEG_CLEAN_PRODUCT_GATE_VERSION;
  decisionRole: typeof FFMPEG_CLEAN_PRODUCT_GATE_DECISION_ROLE;
  productAllowed: boolean;
  decision: FfmpegCleanProductDecision;
  reason: FfmpegCleanProductReason;
  labOnly: boolean;
  licenseReviewRequired: boolean;
  externalCliOnlyRequired: true;
  externalCliOnly: boolean;
  bundledBinaryAllowed: false;
  distributionMode: FfmpegDistributionMode;
  configurationLineFound: boolean;
  configurationLineCount: number;
  flagsDetected: string[];
  gplEnabled: boolean;
  nonfreeEnabled: boolean;
  version3Enabled: boolean;
  gplCodecLibraryDetected: boolean;
  nonfreeLibraryDetected: boolean;
  codecPolicy: "codec_policy_pending";
  h264H265ProductReady: false;
  h264H265PatentRiskMarked: boolean;
  av1OpusPreferredPathNoted: boolean;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  thresholdChanged: false;
  ownershipPreSealChanged: false;
  coreSealingTouched: false;
  formatEngineTouched: false;
}

const SAFETY_ENVELOPE = {
  supportOnly: true,
  canOpenVault: false,
  confirmed: false,
  final: false,
  thresholdChanged: false,
  ownershipPreSealChanged: false,
  coreSealingTouched: false,
  formatEngineTouched: false,
} as const;

function normalizeInput(input: FfmpegCleanProductGateInput | string | unknown): FfmpegCleanProductGateInput {
  if (typeof input === "string") {
    return { versionOutput: input, distributionMode: "external_cli" };
  }
  if (input && typeof input === "object" && "versionOutput" in input) {
    const candidate = input as Partial<FfmpegCleanProductGateInput>;
    return {
      versionOutput: candidate.versionOutput,
      distributionMode:
        candidate.distributionMode === "bundled_product_binary"
          ? "bundled_product_binary"
          : "external_cli",
    };
  }
  return { versionOutput: input, distributionMode: "external_cli" };
}

function baseResult(input: {
  decision: FfmpegCleanProductDecision;
  reason: FfmpegCleanProductReason;
  productAllowed: boolean;
  labOnly: boolean;
  licenseReviewRequired: boolean;
  distributionMode: FfmpegDistributionMode;
  configurationLineFound: boolean;
  configurationLineCount: number;
  flagsDetected?: string[];
  gplEnabled?: boolean;
  nonfreeEnabled?: boolean;
  version3Enabled?: boolean;
  gplCodecLibraryDetected?: boolean;
  nonfreeLibraryDetected?: boolean;
  h264H265PatentRiskMarked?: boolean;
  av1OpusPreferredPathNoted?: boolean;
}): FfmpegCleanProductGateResult {
  return {
    version: FFMPEG_CLEAN_PRODUCT_GATE_VERSION,
    decisionRole: FFMPEG_CLEAN_PRODUCT_GATE_DECISION_ROLE,
    productAllowed: input.productAllowed,
    decision: input.decision,
    reason: input.reason,
    labOnly: input.labOnly,
    licenseReviewRequired: input.licenseReviewRequired,
    externalCliOnlyRequired: true,
    externalCliOnly: input.productAllowed && input.distributionMode === "external_cli",
    bundledBinaryAllowed: false,
    distributionMode: input.distributionMode,
    configurationLineFound: input.configurationLineFound,
    configurationLineCount: input.configurationLineCount,
    flagsDetected: input.flagsDetected ?? [],
    gplEnabled: input.gplEnabled ?? false,
    nonfreeEnabled: input.nonfreeEnabled ?? false,
    version3Enabled: input.version3Enabled ?? false,
    gplCodecLibraryDetected: input.gplCodecLibraryDetected ?? false,
    nonfreeLibraryDetected: input.nonfreeLibraryDetected ?? false,
    codecPolicy: "codec_policy_pending",
    h264H265ProductReady: false,
    h264H265PatentRiskMarked: input.h264H265PatentRiskMarked ?? false,
    av1OpusPreferredPathNoted: input.av1OpusPreferredPathNoted ?? false,
    ...SAFETY_ENVELOPE,
  };
}

function extractConfigurationLines(versionOutput: string): string[] {
  return versionOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^configuration\s*:/i.test(line));
}

function tokenizeConfigurationLines(configurationLines: readonly string[]): string[] {
  return configurationLines.flatMap((line) => {
    const withoutLabel = line.replace(/^configuration\s*:\s*/i, "");
    return withoutLabel
      .split(/\s+/)
      .map((token) => token.trim().replace(/^["']|["']$/g, ""))
      .filter((token) => token.startsWith("--"));
  });
}

function isFlagEnabled(flags: readonly string[], flagName: string): boolean {
  const pattern = new RegExp(`^--enable-${flagName}(?:=.*)?$`, "i");
  return flags.some((flag) => pattern.test(flag));
}

function uniqueDetectedFlags(flags: readonly string[]): string[] {
  return [...new Set(flags.map((flag) => flag.toLowerCase()))].sort();
}

function detectRestrictedLibraries(flags: readonly string[]): {
  gplCodecLibraryDetected: boolean;
  nonfreeLibraryDetected: boolean;
} {
  const normalized = flags.map((flag) => flag.toLowerCase());
  return {
    gplCodecLibraryDetected: normalized.some((flag) =>
      /^--enable-(?:libx264|libx265|libxvid)(?:=.*)?$/.test(flag),
    ),
    nonfreeLibraryDetected: normalized.some((flag) =>
      /^--enable-(?:libfdk-aac|decklink)(?:=.*)?$/.test(flag),
    ),
  };
}

function detectCodecPolicySignals(configurationLines: readonly string[]): {
  h264H265PatentRiskMarked: boolean;
  av1OpusPreferredPathNoted: boolean;
} {
  const lower = configurationLines.join(" ").toLowerCase();
  const h264H265PatentRiskMarked =
    /\b(?:h264|h\.264|x264|libx264|openh264|h265|h\.265|x265|libx265|hevc)\b/.test(lower);
  const av1OpusPreferredPathNoted = /\b(?:av1|libaom|svtav1|rav1e|opus|libopus)\b/.test(lower);
  return { h264H265PatentRiskMarked, av1OpusPreferredPathNoted };
}

export function checkFfmpegCleanProductGate(
  rawInput: FfmpegCleanProductGateInput | string | unknown,
): FfmpegCleanProductGateResult {
  const input = normalizeInput(rawInput);
  const distributionMode = input.distributionMode ?? "external_cli";

  if (distributionMode === "bundled_product_binary") {
    return baseResult({
      decision: "blocked_bundled_binary",
      reason: "bundled_ffmpeg_binary_not_allowed_in_product",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: false,
      configurationLineCount: 0,
    });
  }

  if (typeof input.versionOutput !== "string" || input.versionOutput.trim().length === 0) {
    return baseResult({
      decision: "blocked_empty_or_unparseable_output",
      reason: "empty_or_unparseable_version_output",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: false,
      configurationLineCount: 0,
    });
  }

  const configurationLines = extractConfigurationLines(input.versionOutput);
  if (configurationLines.length === 0) {
    return baseResult({
      decision: "blocked_no_configuration_line",
      reason: "configuration_line_not_found_cannot_verify_clean_build",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: false,
      configurationLineCount: 0,
    });
  }

  const flags = tokenizeConfigurationLines(configurationLines);
  const gplEnabled = isFlagEnabled(flags, "gpl");
  const nonfreeEnabled = isFlagEnabled(flags, "nonfree");
  const version3Enabled = isFlagEnabled(flags, "version3");
  const restrictedLibraries = detectRestrictedLibraries(flags);
  const flagsDetected = uniqueDetectedFlags(
    flags.filter((flag) =>
      /^--enable-(?:gpl|nonfree|version3|libx264|libx265|libxvid|libfdk-aac|decklink)(?:=.*)?$/i.test(flag),
    ),
  );
  const codecSignals = detectCodecPolicySignals(configurationLines);

  if (nonfreeEnabled) {
    return baseResult({
      decision: "blocked_enable_nonfree",
      reason: "enable_nonfree_flag_detected",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: true,
      configurationLineCount: configurationLines.length,
      flagsDetected,
      gplEnabled,
      nonfreeEnabled,
      version3Enabled,
      ...restrictedLibraries,
      ...codecSignals,
    });
  }

  if (restrictedLibraries.nonfreeLibraryDetected) {
    return baseResult({
      decision: "blocked_nonfree_library",
      reason: "nonfree_library_detected",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: true,
      configurationLineCount: configurationLines.length,
      flagsDetected,
      gplEnabled,
      nonfreeEnabled,
      version3Enabled,
      ...restrictedLibraries,
      ...codecSignals,
    });
  }

  if (gplEnabled) {
    return baseResult({
      decision: "blocked_enable_gpl",
      reason: "enable_gpl_flag_detected",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: true,
      configurationLineCount: configurationLines.length,
      flagsDetected,
      gplEnabled,
      nonfreeEnabled,
      version3Enabled,
      ...restrictedLibraries,
      ...codecSignals,
    });
  }

  if (restrictedLibraries.gplCodecLibraryDetected) {
    return baseResult({
      decision: "blocked_gpl_codec_library",
      reason: "gpl_codec_library_detected",
      productAllowed: false,
      labOnly: true,
      licenseReviewRequired: false,
      distributionMode,
      configurationLineFound: true,
      configurationLineCount: configurationLines.length,
      flagsDetected,
      gplEnabled,
      nonfreeEnabled,
      version3Enabled,
      ...restrictedLibraries,
      ...codecSignals,
    });
  }

  if (version3Enabled) {
    return baseResult({
      decision: "review_required_enable_version3",
      reason: "enable_version3_flag_detected_review_required",
      productAllowed: false,
      labOnly: false,
      licenseReviewRequired: true,
      distributionMode,
      configurationLineFound: true,
      configurationLineCount: configurationLines.length,
      flagsDetected,
      gplEnabled,
      nonfreeEnabled,
      version3Enabled,
      ...restrictedLibraries,
      ...codecSignals,
    });
  }

  return baseResult({
    decision: "allowed_external_cli_only",
    reason: "clean_lgpl_external_cli_only",
    productAllowed: true,
    labOnly: false,
    licenseReviewRequired: false,
    distributionMode,
    configurationLineFound: true,
    configurationLineCount: configurationLines.length,
    flagsDetected: [],
    gplEnabled,
    nonfreeEnabled,
    version3Enabled,
    ...restrictedLibraries,
    ...codecSignals,
  });
}
