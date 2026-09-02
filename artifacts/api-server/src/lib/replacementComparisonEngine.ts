export const REPLACEMENT_COMPARISON_ENGINE_VERSION =
  "replacement-comparison-engine-v0.1" as const;
export const REPLACEMENT_COMPARISON_DECISION_ROLE =
  "replacement_comparison_engine_readiness_only_no_vault_no_confirmed" as const;

export interface ReplacementPathMetrics {
  exactIdReadRate: number;
  testedCaseCount: number;
  wrongIdCanOpenVault: boolean;
  missingIdCanOpenVault: boolean;
  unsealedCanOpenVault: boolean;
  originalFileMutated: boolean;
  externalUploadUsed: boolean;
  paidLicenseUsed: boolean;
  riskyRuntimeUsed: boolean;
}

export interface ReplacementComparisonInput {
  area: string;
  oldPath: ReplacementPathMetrics;
  newPath: ReplacementPathMetrics;
  realWorldExtremeCorpusUsed: boolean;
}

export interface ReplacementComparisonResult {
  ok: true;
  engineVersion: typeof REPLACEMENT_COMPARISON_ENGINE_VERSION;
  decisionRole: typeof REPLACEMENT_COMPARISON_DECISION_ROLE;
  area: string;
  acceptedAsProductReadyReplacement: boolean;
  newPathEqualOrBetter: boolean;
  exactIdReadRateNotWorse: boolean;
  enoughRealWorldEvidence: boolean;
  noWrongIdVaultRisk: boolean;
  noMissingIdVaultRisk: boolean;
  noUnsealedVaultRisk: boolean;
  originalFileSafe: boolean;
  licenseSafeRuntimeOnly: boolean;
  externalUploadUsed: false;
  paidLicenseUsed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  reasons: string[];
}

function validRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validCount(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function normalizeArea(area: string): string {
  const normalized = area.trim();
  return normalized.length > 0 ? normalized.slice(0, 120) : "unknown_area";
}

export function compareReplacementPaths(
  input: ReplacementComparisonInput,
): ReplacementComparisonResult {
  const reasons: string[] = [];
  const area = normalizeArea(input.area);

  if (!validRate(input.oldPath.exactIdReadRate)) reasons.push("old_exact_id_rate_invalid");
  if (!validRate(input.newPath.exactIdReadRate)) reasons.push("new_exact_id_rate_invalid");
  if (!validCount(input.oldPath.testedCaseCount)) reasons.push("old_test_count_missing");
  if (!validCount(input.newPath.testedCaseCount)) reasons.push("new_test_count_missing");

  const exactIdReadRateNotWorse =
    validRate(input.oldPath.exactIdReadRate) &&
    validRate(input.newPath.exactIdReadRate) &&
    input.newPath.exactIdReadRate >= input.oldPath.exactIdReadRate;
  if (!exactIdReadRateNotWorse) reasons.push("new_exact_id_read_rate_worse_than_old_path");

  const enoughRealWorldEvidence =
    input.realWorldExtremeCorpusUsed &&
    validCount(input.oldPath.testedCaseCount) &&
    validCount(input.newPath.testedCaseCount);
  if (!enoughRealWorldEvidence) reasons.push("real_world_extreme_corpus_missing");

  const noWrongIdVaultRisk = input.newPath.wrongIdCanOpenVault === false;
  if (!noWrongIdVaultRisk) reasons.push("new_path_wrong_id_can_open_vault");

  const noMissingIdVaultRisk = input.newPath.missingIdCanOpenVault === false;
  if (!noMissingIdVaultRisk) reasons.push("new_path_missing_id_can_open_vault");

  const noUnsealedVaultRisk = input.newPath.unsealedCanOpenVault === false;
  if (!noUnsealedVaultRisk) reasons.push("new_path_unsealed_can_open_vault");

  const originalFileSafe = input.newPath.originalFileMutated === false;
  if (!originalFileSafe) reasons.push("new_path_mutates_original_file");

  const licenseSafeRuntimeOnly =
    input.newPath.externalUploadUsed === false &&
    input.newPath.paidLicenseUsed === false &&
    input.newPath.riskyRuntimeUsed === false;
  if (!licenseSafeRuntimeOnly) reasons.push("new_path_runtime_or_license_not_safe");

  const newPathEqualOrBetter =
    exactIdReadRateNotWorse &&
    enoughRealWorldEvidence &&
    noWrongIdVaultRisk &&
    noMissingIdVaultRisk &&
    noUnsealedVaultRisk &&
    originalFileSafe &&
    licenseSafeRuntimeOnly;

  return {
    ok: true,
    engineVersion: REPLACEMENT_COMPARISON_ENGINE_VERSION,
    decisionRole: REPLACEMENT_COMPARISON_DECISION_ROLE,
    area,
    acceptedAsProductReadyReplacement: newPathEqualOrBetter,
    newPathEqualOrBetter,
    exactIdReadRateNotWorse,
    enoughRealWorldEvidence,
    noWrongIdVaultRisk,
    noMissingIdVaultRisk,
    noUnsealedVaultRisk,
    originalFileSafe,
    licenseSafeRuntimeOnly,
    externalUploadUsed: false,
    paidLicenseUsed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    reasons,
  };
}
