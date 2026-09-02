import { createHash } from "node:crypto";
import {
  DISCOVERY_DECISION_ROLE,
  type DiscoveryApiCall,
  type DiscoveryCandidateVerificationPlan,
  type DiscoveryCandidateVerificationSummary,
  type DiscoveryCostSummary,
  type DiscoveryCostQuote,
  type DiscoveryJobRecord,
  type DiscoveryLayer,
  type DiscoveryProviderName,
  type DiscoveryResult,
  type DiscoverySecureRoomHandoff,
} from "./types";
import {
  DISCOVERY_DETECTIVE_POLICY_NOTICE,
  buildDiscoveryDetectivePolicySummary,
} from "./discoveryDetectivePolicy";

const PROVIDERS: DiscoveryProviderName[] = [
  "dataforseo",
  "acrcloud",
  "brave",
  "exa",
  "apify_telegram",
];

function now(): string {
  return new Date().toISOString();
}

function idFor(jobId: string): string {
  return `handoff_${createHash("sha256").update(jobId).digest("hex").slice(0, 16)}`;
}

export interface DiscoverySecureRoomHandoffSearchDnaInput {
  contentType: string | null;
  contentTypeConfidence: number;
  selectedLayers: DiscoveryLayer[];
  selectedProviders: DiscoveryProviderName[];
  learningRecordCreated: boolean;
  planVersion: string | null;
  queryCount: number;
  keyframeCandidateCount: number;
  audioHintCount: number;
  telegramQueryCount: number;
  costCapApplied: boolean;
  costQuote?: DiscoveryCostQuote | null;
  candidateVerificationPlan?: DiscoveryCandidateVerificationPlan | null;
  candidateVerificationSummary?: DiscoveryCandidateVerificationSummary | null;
}

export function buildDiscoverySecureRoomHandoff(
  job: DiscoveryJobRecord,
  results: readonly DiscoveryResult[],
  apiCalls: readonly DiscoveryApiCall[],
  costSummary: DiscoveryCostSummary,
  searchDna?: DiscoverySecureRoomHandoffSearchDnaInput,
): DiscoverySecureRoomHandoff {
  const candidateTelegramMessages = results
    .filter((result) => result.resultType === "telegram_message")
    .map((result) => ({
      url: result.url,
      channelName: result.channelName,
      messageId: result.messageId,
      title: result.title,
    }));
  const candidateUrls = results
    .filter((result) => result.url && result.resultType !== "telegram_message")
    .map((result) => result.url)
    .filter((url): url is string => typeof url === "string");
  const takedownNoticeDraftAvailable =
    candidateUrls.length > 0 || candidateTelegramMessages.some((message) => message.url);

  return {
    id: idFor(job.id),
    jobId: job.id,
    secureRoomId: null,
    handoffStatus: "pending",
    candidateUrls,
    candidateTelegramMessages,
    candidateUrlCount: candidateUrls.length,
    candidateTelegramCount: candidateTelegramMessages.length,
    providerSummaries: PROVIDERS.map((provider) => {
      const providerCalls = apiCalls.filter((call) => call.provider === provider);
      return {
        provider,
        resultCount: results.filter((result) => result.provider === provider).length,
        failedCallCount: providerCalls.filter((call) => call.status === "failed").length,
        skippedCallCount: providerCalls.filter((call) => call.status === "skipped").length,
        mockedCallCount: providerCalls.filter((call) => call.status === "mocked").length,
      };
    }),
    costSummary,
    processingMetrics: costSummary.processingMetrics,
    searchDnaSummary: {
      contentType: searchDna?.contentType ?? null,
      contentTypeConfidence: searchDna?.contentTypeConfidence ?? 0,
      selectedLayers: searchDna?.selectedLayers ?? [],
      selectedProviders: searchDna?.selectedProviders ?? [],
      learningRecordCreated: searchDna?.learningRecordCreated ?? false,
      supportOnly: true,
      decisionRole: "discovery_search_dna_support_only_no_vault_no_confirmed",
      requiresTancMarkVerification: true,
    },
    queryPlanSummary: {
      planVersion: searchDna?.planVersion ?? null,
      queryCount: searchDna?.queryCount ?? 0,
      keyframeCandidateCount: searchDna?.keyframeCandidateCount ?? 0,
      audioHintCount: searchDna?.audioHintCount ?? 0,
      telegramQueryCount: searchDna?.telegramQueryCount ?? 0,
      costCapApplied: searchDna?.costCapApplied ?? false,
      supportOnly: true,
      decisionRole: "discovery_search_dna_support_only_no_vault_no_confirmed",
      requiresTancMarkVerification: true,
    },
    costQuoteSummary: {
      quoteId: searchDna?.costQuote?.id ?? null,
      quoteMode: "internal_preview",
      chargeEnabled: false,
      totalEstimatedInternalCostUsd: searchDna?.costQuote?.totalEstimatedInternalCostUsd ?? 0,
      quoteUnitsPreview: searchDna?.costQuote?.quoteUnitsPreview ?? 0,
      supportOnly: true,
      decisionRole: "discovery_cost_quote_preview_no_vault_no_confirmed",
    },
    candidateVerificationPlanSummary: {
      planId: searchDna?.candidateVerificationPlan?.id ?? null,
      candidateCount: searchDna?.candidateVerificationPlan?.candidateCount ?? 0,
      selectedCandidateCount: searchDna?.candidateVerificationPlan?.selectedCandidateCount ?? 0,
      overageCandidateCount: searchDna?.candidateVerificationPlan?.overageCandidateCount ?? 0,
      maxAutoVerificationCandidates:
        searchDna?.candidateVerificationPlan?.maxAutoVerificationCandidates ?? 0,
      verificationMode: "mock_plan_only",
      realCandidateDownloadPerformed: false,
      supportOnly: true,
      decisionRole: "discovery_candidate_verification_plan_no_vault_no_confirmed",
    },
    candidateVerificationSummary: searchDna?.candidateVerificationSummary ?? {
      runId: null,
      jobId: job.id,
      candidateCount: 0,
      verifiedByTancMarkCount: 0,
      wrongIdCount: 0,
      noIdCount: 0,
      partialSupportCount: 0,
      skippedByPolicyCount: 0,
      failedCount: 0,
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
    },
    detectivePolicySummary: buildDiscoveryDetectivePolicySummary({
      takedownNoticeDraftAvailable,
    }),
    autoEnforcementEnabled: false,
    userActionRequiredForNotice: true,
    takedownNoticeDraftAvailable,
    noticeDeliveryByTancMark: false,
    discoveryResultsAreSupportOnly: true,
    requiresTancMarkVerificationForFinal: true,
    enforcementNotice: DISCOVERY_DETECTIVE_POLICY_NOTICE,
    supportOnly: true,
    decisionRole: DISCOVERY_DECISION_ROLE,
    requiresTancMarkVerification: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: now(),
    sentAt: null,
  };
}
