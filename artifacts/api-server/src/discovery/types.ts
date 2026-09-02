export const DISCOVERY_DECISION_ROLE =
  "discovery_support_only_no_vault_no_confirmed" as const;

export type DiscoveryDecisionRole = typeof DISCOVERY_DECISION_ROLE;

export type DiscoveryMediaType = "video" | "image" | "audio" | "text" | "mixed";

export type DiscoveryScanType =
  | "hybrid_video"
  | "visual_only"
  | "audio_only"
  | "text_only"
  | "telegram_only";

export type DiscoveryLayer =
  | "visual"
  | "audio"
  | "metadata_text"
  | "video_metadata"
  | "telegram";

export type DiscoveryProviderName =
  | "dataforseo"
  | "acrcloud"
  | "brave"
  | "exa"
  | "apify_telegram";

export type DiscoveryProviderStatus = "queued" | "success" | "failed" | "skipped" | "mocked";

export type DiscoveryJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type DiscoveryCostConfidence = "low" | "medium" | "high";

export type DiscoveryAssetType = "keyframe" | "audio_extract" | "metadata_text" | "query_pack";

export type DiscoveryExternalPayloadType =
  | "none"
  | "hash"
  | "url"
  | "metadata"
  | "query"
  | "signed_url"
  | "fingerprint";

export type DiscoveryResultType =
  | "url"
  | "telegram_message"
  | "youtube_video"
  | "image_match"
  | "audio_match"
  | "text_match";

export type DiscoveryMetricType =
  | "upload"
  | "keyframe_extract"
  | "audio_extract"
  | "query_pack"
  | "provider_calls"
  | "secure_room_handoff"
  | "report_prepare";

export interface DiscoveryJobInput {
  userId?: string | null;
  clientId: string;
  docId?: string | null;
  sourceContentId?: string | null;
  uploadRef?: string | null;
  mediaType: DiscoveryMediaType;
  scanType: DiscoveryScanType;
  title?: string | null;
  instructorName?: string | null;
  description?: string | null;
  tags?: string[];
  keywords?: string[];
  requestedLayers?: DiscoveryLayer[];
  maxAllowedCostUsd?: number | null;
  userConfirmedExternalSearch?: boolean;
  allowSignedUrlForVisualSearch?: boolean;
  fileSizeBytes?: number | null;
  durationSec?: number | null;
}

export interface DiscoveryJobRecord extends DiscoveryJobInput {
  id: string;
  status: DiscoveryJobStatus;
  requestedLayers: DiscoveryLayer[];
  estimatedExternalApiCostUsd: number;
  actualExternalApiCostUsd: number;
  estimatedComputeCostUsd: number;
  estimatedStorageCostUsd: number;
  estimatedQueueCostUsd: number;
  estimatedReportCostUsd: number;
  totalEstimatedInternalCostUsd: number;
  totalActualMeasuredCostUsd: number;
  costConfidence: DiscoveryCostConfidence;
  maxAllowedCostUsd: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: DiscoveryDecisionRole;
}

export interface DiscoveryMediaAsset {
  id: string;
  jobId: string;
  assetType: DiscoveryAssetType;
  localRef: string | null;
  storageRef: string | null;
  sha256: string;
  sizeBytes: number;
  durationSec: number | null;
  frameIndex: number | null;
  timestampSec: number | null;
  redacted: boolean;
  sentToExternalProvider: boolean;
  externalPayloadType: DiscoveryExternalPayloadType;
  createdAt: string;
}

export interface DiscoveryProcessingMetric {
  id: string;
  jobId: string;
  metricType: DiscoveryMetricType;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  estimatedCostUsd: number;
  notes: string;
  createdAt: string;
}

export interface DiscoveryApiCall {
  id: string;
  jobId: string;
  provider: DiscoveryProviderName;
  layer: DiscoveryLayer;
  endpointName: string;
  requestId: string;
  status: DiscoveryProviderStatus;
  realApiEnabled: boolean;
  unitCount: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  retryCount: number;
  latencyMs: number;
  externalRequestRef: string | null;
  externalResultRef: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentOriginalContent: false;
  sentHashOnly: boolean;
  sentMetadataOnly: boolean;
  sentSignedUrl: boolean;
  sentFingerprintOnly: boolean;
  mocked: boolean;
  skipped: boolean;
  createdAt: string;
  completedAt: string;
}

export interface DiscoveryResult {
  id: string;
  jobId: string;
  provider: DiscoveryProviderName;
  layer: DiscoveryLayer;
  resultType: DiscoveryResultType;
  url: string | null;
  platform: string | null;
  title: string | null;
  snippet: string | null;
  channelName: string | null;
  messageId: string | null;
  fileName: string | null;
  confidence: number;
  matchReason: string;
  supportOnly: true;
  decisionRole: DiscoveryDecisionRole;
  canOpenVault: false;
  confirmed: false;
  final: false;
  requiresTancMarkVerification: true;
  normalizedPayloadJson: Record<string, unknown>;
  createdAt: string;
}

export interface DiscoveryCostSummary {
  estimatedExternalApiCostUsd: number;
  actualExternalApiCostUsd: number;
  estimatedComputeCostUsd: number;
  estimatedStorageCostUsd: number;
  estimatedQueueCostUsd: number;
  estimatedReportCostUsd: number;
  totalEstimatedInternalCostUsd: number;
  totalActualMeasuredCostUsd: number;
  costConfidence: DiscoveryCostConfidence;
  providerTotals: Record<
    DiscoveryProviderName,
    {
      unitCount: number;
      estimatedCostUsd: number;
      actualCostUsd: number;
      retryCount: number;
      failedCallCount: number;
      skippedCallCount: number;
      mockedCallCount: number;
    }
  >;
  processingMetrics: DiscoveryProcessingMetric[];
}

export interface DiscoveryCandidateVerificationCandidate {
  resultId: string;
  provider: DiscoveryProviderName;
  layer: DiscoveryLayer;
  url: string | null;
  platform: string | null;
  title: string | null;
  confidence: number;
  rank: number;
  requiresOpenPublicUrl: true;
  requiresNoLogin: true;
  allowByteRangeOnly: true;
  allowPersistentStorage: false;
  supportOnly: true;
}

export interface DiscoveryCandidateVerificationPlan {
  id: string;
  jobId: string;
  planStatus: "planned" | "skipped" | "completed_mock";
  candidateCount: number;
  maxAutoVerificationCandidates: number;
  selectedCandidateCount: number;
  overageCandidateCount: number;
  selectedCandidatesJson: DiscoveryCandidateVerificationCandidate[];
  overageCandidatesJson: DiscoveryCandidateVerificationCandidate[];
  verificationMode: "mock_plan_only";
  allowByteRangeOnly: true;
  allowPersistentStorage: false;
  requiresOpenPublicUrl: true;
  requiresNoLogin: true;
  temporaryFileDeletionRequired: true;
  externalApiCalled: false;
  realCandidateDownloadPerformed: false;
  supportOnly: true;
  decisionRole: "discovery_candidate_verification_plan_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

export interface DiscoveryCostQuote {
  id: string;
  jobId: string;
  clientId: string;
  docId: string | null;
  quoteMode: "internal_preview";
  chargeEnabled: false;
  contentType: string | null;
  mediaType: DiscoveryMediaType;
  estimatedExternalApiCostUsd: number;
  estimatedComputeCostUsd: number;
  estimatedStorageCostUsd: number;
  estimatedQueueCostUsd: number;
  estimatedReportCostUsd: number;
  estimatedCandidateVerificationCostUsd: number;
  baseInternalCostUsd: number;
  riskBufferPercent: number;
  riskBufferUsd: number;
  totalEstimatedInternalCostUsd: number;
  marginMultiplier: number;
  quoteUnitConversionFactor: number;
  quoteUnitsPreview: number;
  includedAutoVerificationCandidates: number;
  maxAutoVerificationCandidates: number;
  overageCandidateCount: number;
  overageQuoteUnitsPreview: number;
  selfVerifyOptionAvailable: true;
  extraAutoVerifyPreviewAvailable: boolean;
  costConfidence: DiscoveryCostConfidence;
  supportOnly: true;
  decisionRole: "discovery_cost_quote_preview_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

export interface DiscoveryCostCalibrationRecord {
  id: string;
  jobId: string;
  clientId: string;
  contentType: string | null;
  mediaType: DiscoveryMediaType;
  quoteId: string;
  estimatedCostUsd: number;
  actualMeasuredCostUsd: number;
  differenceUsd: number;
  differencePercent: number;
  providerCostJson: Record<string, unknown>;
  computeCostJson: Record<string, unknown>;
  candidateVerificationCostJson: Record<string, unknown>;
  quoteAccuracyLabel: "under_estimated" | "over_estimated" | "accurate" | "unknown";
  learningSummary: Record<string, unknown>;
  supportOnly: true;
  decisionRole: "discovery_cost_calibration_learning_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

export interface DiscoveryPricingLearningProfile {
  id: string;
  clientId: string;
  contentType: string | null;
  mediaType: DiscoveryMediaType;
  sampleCount: number;
  avgEstimatedCostUsd: number;
  avgActualMeasuredCostUsd: number;
  avgDifferencePercent: number;
  recommendedRiskBufferPercent: number;
  recommendedMarginMultiplier: number;
  recommendedMaxAutoCandidates: number;
  providerEfficiencyJson: Record<string, unknown>;
  supportOnly: true;
  decisionRole: "discovery_pricing_learning_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  updatedAt: string;
  createdAt: string;
}

export type DiscoveryCandidateVerificationMockScenario =
  | "valid_tancmark_id_match"
  | "wrong_tancmark_id"
  | "no_tancmark_id"
  | "partial_candidate_support"
  | "unreadable_media"
  | "unsupported_media"
  | "blocked_private_or_login_required"
  | "skipped_by_policy";

export type DiscoveryCandidateVerificationStatus =
  | "verified_by_tancmark_mock"
  | "wrong_id_mock"
  | "no_id_mock"
  | "partial_support_mock"
  | "unreadable_mock"
  | "unsupported_media_mock"
  | "skipped_by_policy"
  | "failed_mock";

export interface DiscoveryCandidateVerificationRun {
  id: string;
  jobId: string;
  planId: string;
  runMode: "mock_only";
  status: "planned" | "running" | "completed" | "failed";
  candidateCount: number;
  verifiedCandidateCount: number;
  wrongIdCount: number;
  noIdCount: number;
  partialSupportCount: number;
  skippedByPolicyCount: number;
  failedCount: number;
  realFetchEnabled: false;
  realAnalyzeEnabled: false;
  supportOnly: true;
  decisionRole: "discovery_records_only_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
  completedAt: string | null;
}

export interface DiscoveryCandidateVerificationResult {
  id: string;
  runId: string;
  jobId: string;
  candidateResultId: string;
  url: string | null;
  platform: string | null;
  verificationStatus: DiscoveryCandidateVerificationStatus;
  mockScenario: DiscoveryCandidateVerificationMockScenario;
  tancmarkIdRead: string | null;
  matchedDocId: string | null;
  matchedClientId: string | null;
  idMatch: boolean;
  matchingBits: number;
  supportPercent: number;
  analyzerDecisionSource: "mock_existing_tancmark_analyzer";
  discoveryDecisionRole: "discovery_records_only_no_vault_no_confirmed";
  canOpenVaultByDiscovery: false;
  supportOnly: true;
  policyAllowed: boolean;
  policyBlockReason: string | null;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

export interface DiscoveryCandidateVerificationPolicyLog {
  id: string;
  runId: string;
  candidateResultId: string;
  policyAllowed: boolean;
  requiresPublicUrl: true;
  requiresNoLogin: true;
  requiresNoPaywall: true;
  requiresNoDrmBypass: true;
  allowsPersistentStorage: false;
  realFetchAttempted: false;
  reason: string;
  createdAt: string;
}

export interface DiscoveryCandidateVerificationSummary {
  runId: string | null;
  jobId: string;
  candidateCount: number;
  verifiedByTancMarkCount: number;
  wrongIdCount: number;
  noIdCount: number;
  partialSupportCount: number;
  skippedByPolicyCount: number;
  failedCount: number;
  verificationRunMode: "mock_only";
  discoveryDecisionRole: "discovery_records_only_no_vault_no_confirmed";
  requiresRealTancMarkAnalysisForFinal: true;
  canOpenVaultByDiscovery: false;
  realFetchAttempted: false;
  realAnalyzeEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface DiscoveryDetectivePolicySummary {
  tancmarkRole: "detective_not_police";
  autoTakedownEnabled: false;
  autoDmcaEnabled: false;
  autoComplaintEnabled: false;
  userMustSubmitNotice: true;
  supportOnlyDiscovery: true;
  requiresTancMarkVerificationForFinal: true;
  publicSourcesOnly: true;
  privateGroupScanAllowed: false;
  loginBypassAllowed: false;
  paywallBypassAllowed: false;
  drmBypassAllowed: false;
  platformComplaintApiEnabled: false;
  autoEnforcementEnabled: false;
  noticeDeliveryByTancMark: false;
  userActionRequiredForNotice: true;
  takedownNoticeDraftAvailable: boolean;
  discoveryResultsAreSupportOnly: true;
  policyNotice: string;
  decisionRole: "detective_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface DiscoverySecureRoomHandoff {
  id: string;
  jobId: string;
  secureRoomId: string | null;
  handoffStatus: "pending" | "sent" | "failed";
  candidateUrls: string[];
  candidateTelegramMessages: Array<{
    url: string | null;
    channelName: string | null;
    messageId: string | null;
    title: string | null;
  }>;
  candidateUrlCount: number;
  candidateTelegramCount: number;
  providerSummaries: Array<{
    provider: DiscoveryProviderName;
    resultCount: number;
    failedCallCount: number;
    skippedCallCount: number;
    mockedCallCount: number;
  }>;
  costSummary: DiscoveryCostSummary;
  processingMetrics: DiscoveryProcessingMetric[];
  searchDnaSummary: {
    contentType: string | null;
    contentTypeConfidence: number;
    selectedLayers: DiscoveryLayer[];
    selectedProviders: DiscoveryProviderName[];
    learningRecordCreated: boolean;
    supportOnly: true;
    decisionRole: "discovery_search_dna_support_only_no_vault_no_confirmed";
    requiresTancMarkVerification: true;
  };
  queryPlanSummary: {
    planVersion: string | null;
    queryCount: number;
    keyframeCandidateCount: number;
    audioHintCount: number;
    telegramQueryCount: number;
    costCapApplied: boolean;
    supportOnly: true;
    decisionRole: "discovery_search_dna_support_only_no_vault_no_confirmed";
    requiresTancMarkVerification: true;
  };
  costQuoteSummary: {
    quoteId: string | null;
    quoteMode: "internal_preview";
    chargeEnabled: false;
    totalEstimatedInternalCostUsd: number;
    quoteUnitsPreview: number;
    supportOnly: true;
    decisionRole: "discovery_cost_quote_preview_no_vault_no_confirmed";
  };
  candidateVerificationPlanSummary: {
    planId: string | null;
    candidateCount: number;
    selectedCandidateCount: number;
    overageCandidateCount: number;
    maxAutoVerificationCandidates: number;
    verificationMode: "mock_plan_only";
    realCandidateDownloadPerformed: false;
    supportOnly: true;
    decisionRole: "discovery_candidate_verification_plan_no_vault_no_confirmed";
  };
  candidateVerificationSummary: DiscoveryCandidateVerificationSummary;
  detectivePolicySummary: DiscoveryDetectivePolicySummary;
  autoEnforcementEnabled: false;
  userActionRequiredForNotice: true;
  takedownNoticeDraftAvailable: boolean;
  noticeDeliveryByTancMark: false;
  discoveryResultsAreSupportOnly: true;
  requiresTancMarkVerificationForFinal: true;
  enforcementNotice: string;
  supportOnly: true;
  decisionRole: DiscoveryDecisionRole;
  requiresTancMarkVerification: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
  sentAt: string | null;
}

export interface DiscoveryJobSnapshot {
  job: DiscoveryJobRecord;
  mediaAssets: DiscoveryMediaAsset[];
  apiCalls: DiscoveryApiCall[];
  processingMetrics: DiscoveryProcessingMetric[];
  results: DiscoveryResult[];
  costSummary: DiscoveryCostSummary;
  secureRoomHandoff: DiscoverySecureRoomHandoff;
}
