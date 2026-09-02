import type {
  DiscoveryCandidateVerificationResult,
  DiscoveryCandidateVerificationRun,
  DiscoveryCandidateVerificationSummary,
} from "./types";

export function buildCandidateVerificationSummary(input: {
  jobId: string;
  run: DiscoveryCandidateVerificationRun | null;
  results: readonly DiscoveryCandidateVerificationResult[];
}): DiscoveryCandidateVerificationSummary {
  return {
    runId: input.run?.id ?? null,
    jobId: input.jobId,
    candidateCount: input.run?.candidateCount ?? input.results.length,
    verifiedByTancMarkCount: input.results.filter(
      (result) => result.verificationStatus === "verified_by_tancmark_mock",
    ).length,
    wrongIdCount: input.results.filter((result) => result.verificationStatus === "wrong_id_mock").length,
    noIdCount: input.results.filter((result) => result.verificationStatus === "no_id_mock").length,
    partialSupportCount: input.results.filter(
      (result) => result.verificationStatus === "partial_support_mock",
    ).length,
    skippedByPolicyCount: input.results.filter(
      (result) => result.verificationStatus === "skipped_by_policy",
    ).length,
    failedCount: input.results.filter(
      (result) =>
        result.verificationStatus === "failed_mock" ||
        result.verificationStatus === "unreadable_mock" ||
        result.verificationStatus === "unsupported_media_mock",
    ).length,
    verificationRunMode: "mock_only",
    discoveryDecisionRole: "discovery_records_only_no_vault_no_confirmed",
    requiresRealTancMarkAnalysisForFinal: true,
    canOpenVaultByDiscovery: false,
    realFetchAttempted: false,
    realAnalyzeEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

