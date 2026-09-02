import {
  pgTable,
  bigserial,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const discoveryJobsTable = pgTable(
  "discovery_jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id"),
    clientId: text("client_id").notNull(),
    docId: text("doc_id"),
    sourceContentId: text("source_content_id"),
    mediaType: text("media_type").notNull(),
    status: text("status").notNull().default("queued"),
    scanType: text("scan_type").notNull(),
    requestedLayers: jsonb("requested_layers").$type<string[]>().notNull().default([]),
    estimatedExternalApiCostUsd: doublePrecision("estimated_external_api_cost_usd").notNull().default(0),
    actualExternalApiCostUsd: doublePrecision("actual_external_api_cost_usd").notNull().default(0),
    estimatedComputeCostUsd: doublePrecision("estimated_compute_cost_usd").notNull().default(0),
    estimatedStorageCostUsd: doublePrecision("estimated_storage_cost_usd").notNull().default(0),
    estimatedQueueCostUsd: doublePrecision("estimated_queue_cost_usd").notNull().default(0),
    estimatedReportCostUsd: doublePrecision("estimated_report_cost_usd").notNull().default(0),
    totalEstimatedInternalCostUsd: doublePrecision("total_estimated_internal_cost_usd")
      .notNull()
      .default(0),
    totalActualMeasuredCostUsd: doublePrecision("total_actual_measured_cost_usd").notNull().default(0),
    costConfidence: text("cost_confidence").notNull().default("low"),
    maxAllowedCostUsd: doublePrecision("max_allowed_cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("discovery_jobs_client_idx").on(t.clientId),
    index("discovery_jobs_doc_idx").on(t.docId),
    index("discovery_jobs_status_idx").on(t.status),
    index("discovery_jobs_created_idx").on(t.createdAt),
  ],
);

export const discoveryMediaAssetsTable = pgTable(
  "discovery_media_assets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    assetType: text("asset_type").notNull(),
    localRef: text("local_ref"),
    storageRef: text("storage_ref"),
    sha256: text("sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    durationSec: doublePrecision("duration_sec"),
    frameIndex: integer("frame_index"),
    timestampSec: doublePrecision("timestamp_sec"),
    redacted: boolean("redacted").notNull().default(true),
    sentToExternalProvider: boolean("sent_to_external_provider").notNull().default(false),
    externalPayloadType: text("external_payload_type").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_media_assets_job_idx").on(t.jobId),
    index("discovery_media_assets_type_idx").on(t.assetType),
    index("discovery_media_assets_sha_idx").on(t.sha256),
  ],
);

export const discoveryProviderPricingTable = pgTable(
  "discovery_provider_pricing",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(),
    layer: text("layer").notNull(),
    unitType: text("unit_type").notNull(),
    unitCostUsd: doublePrecision("unit_cost_usd").notNull(),
    active: boolean("active").notNull().default(true),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    notes: text("notes"),
  },
  (t) => [
    index("discovery_provider_pricing_provider_idx").on(t.provider),
    index("discovery_provider_pricing_active_idx").on(t.active),
  ],
);

export const discoveryApiCallsTable = pgTable(
  "discovery_api_calls",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    provider: text("provider").notNull(),
    layer: text("layer").notNull(),
    endpointName: text("endpoint_name").notNull(),
    requestId: text("request_id").notNull(),
    status: text("status").notNull(),
    realApiEnabled: boolean("real_api_enabled").notNull().default(false),
    unitCount: integer("unit_count").notNull().default(0),
    estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
    actualCostUsd: doublePrecision("actual_cost_usd").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    externalRequestRef: text("external_request_ref"),
    externalResultRef: text("external_result_ref"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    sentOriginalContent: boolean("sent_original_content").notNull().default(false),
    sentHashOnly: boolean("sent_hash_only").notNull().default(false),
    sentMetadataOnly: boolean("sent_metadata_only").notNull().default(false),
    sentSignedUrl: boolean("sent_signed_url").notNull().default(false),
    sentFingerprintOnly: boolean("sent_fingerprint_only").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("discovery_api_calls_job_idx").on(t.jobId),
    index("discovery_api_calls_provider_idx").on(t.provider),
    index("discovery_api_calls_status_idx").on(t.status),
  ],
);

export const discoveryProcessingMetricsTable = pgTable(
  "discovery_processing_metrics",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    metricType: text("metric_type").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    inputBytes: integer("input_bytes").notNull().default(0),
    outputBytes: integer("output_bytes").notNull().default(0),
    estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_processing_metrics_job_idx").on(t.jobId),
    index("discovery_processing_metrics_type_idx").on(t.metricType),
  ],
);

export const discoveryResultsTable = pgTable(
  "discovery_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    provider: text("provider").notNull(),
    layer: text("layer").notNull(),
    resultType: text("result_type").notNull(),
    url: text("url"),
    platform: text("platform"),
    title: text("title"),
    snippet: text("snippet"),
    channelName: text("channel_name"),
    messageId: text("message_id"),
    fileName: text("file_name"),
    confidence: doublePrecision("confidence").notNull().default(0),
    matchReason: text("match_reason").notNull(),
    supportOnly: boolean("support_only").notNull().default(true),
    decisionRole: text("decision_role").notNull().default("discovery_support_only_no_vault_no_confirmed"),
    normalizedPayloadJson: jsonb("normalized_payload_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_results_job_idx").on(t.jobId),
    index("discovery_results_provider_idx").on(t.provider),
    index("discovery_results_url_idx").on(t.url),
  ],
);

export const discoverySecureRoomHandoffTable = pgTable(
  "discovery_secure_room_handoff",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    secureRoomId: text("secure_room_id"),
    handoffStatus: text("handoff_status").notNull().default("pending"),
    candidateUrlCount: integer("candidate_url_count").notNull().default(0),
    candidateTelegramCount: integer("candidate_telegram_count").notNull().default(0),
    supportOnly: boolean("support_only").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("discovery_secure_room_handoff_job_idx").on(t.jobId),
    index("discovery_secure_room_handoff_status_idx").on(t.handoffStatus),
  ],
);

export const discoverySearchDnaProfilesTable = pgTable(
  "discovery_search_dna_profiles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clientId: text("client_id").notNull(),
    contentType: text("content_type").notNull(),
    profileName: text("profile_name").notNull(),
    learnedProviderRankingJson: jsonb("learned_provider_ranking_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    learnedQueryPatternsJson: jsonb("learned_query_patterns_json").$type<string[]>().notNull().default([]),
    learnedCostHintsJson: jsonb("learned_cost_hints_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    learnedFalsePositiveHintsJson: jsonb("learned_false_positive_hints_json")
      .$type<string[]>()
      .notNull()
      .default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_search_dna_profiles_client_idx").on(t.clientId),
    index("discovery_search_dna_profiles_type_idx").on(t.contentType),
    index("discovery_search_dna_profiles_active_idx").on(t.active),
  ],
);

export const discoverySearchDnaRecordsTable = pgTable(
  "discovery_search_dna_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    clientId: text("client_id").notNull(),
    docId: text("doc_id"),
    contentType: text("content_type").notNull(),
    contentTypeConfidence: doublePrecision("content_type_confidence").notNull().default(0),
    selectedLayersJson: jsonb("selected_layers_json").$type<string[]>().notNull().default([]),
    selectedProvidersJson: jsonb("selected_providers_json").$type<string[]>().notNull().default([]),
    selectedQueryTermsJson: jsonb("selected_query_terms_json").$type<string[]>().notNull().default([]),
    selectedKeyframesJson: jsonb("selected_keyframes_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    selectedAudioHintsJson: jsonb("selected_audio_hints_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
    actualCostUsd: doublePrecision("actual_cost_usd").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    usefulResultCount: integer("useful_result_count").notNull().default(0),
    falsePositiveCount: integer("false_positive_count").notNull().default(0),
    secureRoomHandoffCreated: boolean("secure_room_handoff_created").notNull().default(false),
    laterVerifiedByTancMark: boolean("later_verified_by_tancmark").notNull().default(false),
    learningSummary: jsonb("learning_summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_search_dna_records_job_idx").on(t.jobId),
    index("discovery_search_dna_records_client_idx").on(t.clientId),
    index("discovery_search_dna_records_type_idx").on(t.contentType),
  ],
);

export const discoveryQueryPlansTable = pgTable(
  "discovery_query_plans",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    planVersion: text("plan_version").notNull(),
    contentType: text("content_type").notNull(),
    planStatus: text("plan_status").notNull().default("planned"),
    searchLayersJson: jsonb("search_layers_json").$type<string[]>().notNull().default([]),
    providerPlanJson: jsonb("provider_plan_json").$type<Array<Record<string, unknown>>>().notNull().default([]),
    queryVariantsJson: jsonb("query_variants_json").$type<Array<Record<string, unknown>>>().notNull().default([]),
    keyframePlanJson: jsonb("keyframe_plan_json").$type<Array<Record<string, unknown>>>().notNull().default([]),
    audioPlanJson: jsonb("audio_plan_json").$type<Array<Record<string, unknown>>>().notNull().default([]),
    telegramPlanJson: jsonb("telegram_plan_json").$type<string[]>().notNull().default([]),
    costPlanJson: jsonb("cost_plan_json").$type<Record<string, unknown>>().notNull().default({}),
    privacyPlanJson: jsonb("privacy_plan_json").$type<Array<Record<string, unknown>>>().notNull().default([]),
    supportOnly: boolean("support_only").notNull().default(true),
    decisionRole: text("decision_role")
      .notNull()
      .default("discovery_search_dna_support_only_no_vault_no_confirmed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_query_plans_job_idx").on(t.jobId),
    index("discovery_query_plans_type_idx").on(t.contentType),
    index("discovery_query_plans_status_idx").on(t.planStatus),
  ],
);

export const discoveryQueryOutcomesTable = pgTable(
  "discovery_query_outcomes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    queryPlanId: text("query_plan_id").notNull(),
    provider: text("provider").notNull(),
    queryText: text("query_text").notNull(),
    queryType: text("query_type").notNull(),
    resultCount: integer("result_count").notNull().default(0),
    usefulCandidateCount: integer("useful_candidate_count").notNull().default(0),
    weakCandidateCount: integer("weak_candidate_count").notNull().default(0),
    falsePositiveCount: integer("false_positive_count").notNull().default(0),
    estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
    actualCostUsd: doublePrecision("actual_cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    outcomeLabel: text("outcome_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_query_outcomes_job_idx").on(t.jobId),
    index("discovery_query_outcomes_plan_idx").on(t.queryPlanId),
    index("discovery_query_outcomes_provider_idx").on(t.provider),
    index("discovery_query_outcomes_label_idx").on(t.outcomeLabel),
  ],
);

export const discoveryCostQuotesTable = pgTable(
  "discovery_cost_quotes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    clientId: text("client_id").notNull(),
    docId: text("doc_id"),
    quoteMode: text("quote_mode").notNull().default("internal_preview"),
    chargeEnabled: boolean("charge_enabled").notNull().default(false),
    contentType: text("content_type"),
    mediaType: text("media_type").notNull(),
    estimatedExternalApiCostUsd: doublePrecision("estimated_external_api_cost_usd").notNull().default(0),
    estimatedComputeCostUsd: doublePrecision("estimated_compute_cost_usd").notNull().default(0),
    estimatedStorageCostUsd: doublePrecision("estimated_storage_cost_usd").notNull().default(0),
    estimatedQueueCostUsd: doublePrecision("estimated_queue_cost_usd").notNull().default(0),
    estimatedReportCostUsd: doublePrecision("estimated_report_cost_usd").notNull().default(0),
    estimatedCandidateVerificationCostUsd: doublePrecision("estimated_candidate_verification_cost_usd")
      .notNull()
      .default(0),
    baseInternalCostUsd: doublePrecision("base_internal_cost_usd").notNull().default(0),
    riskBufferPercent: doublePrecision("risk_buffer_percent").notNull().default(0),
    riskBufferUsd: doublePrecision("risk_buffer_usd").notNull().default(0),
    totalEstimatedInternalCostUsd: doublePrecision("total_estimated_internal_cost_usd")
      .notNull()
      .default(0),
    marginMultiplier: doublePrecision("margin_multiplier").notNull().default(1),
    quoteUnitConversionFactor: doublePrecision("quote_unit_conversion_factor").notNull().default(1),
    quoteUnitsPreview: doublePrecision("quote_units_preview").notNull().default(0),
    includedAutoVerificationCandidates: integer("included_auto_verification_candidates").notNull().default(0),
    maxAutoVerificationCandidates: integer("max_auto_verification_candidates").notNull().default(100),
    overageCandidateCount: integer("overage_candidate_count").notNull().default(0),
    overageQuoteUnitsPreview: doublePrecision("overage_quote_units_preview").notNull().default(0),
    selfVerifyOptionAvailable: boolean("self_verify_option_available").notNull().default(true),
    costConfidence: text("cost_confidence").notNull().default("low"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_cost_quotes_job_idx").on(t.jobId),
    index("discovery_cost_quotes_client_idx").on(t.clientId),
    index("discovery_cost_quotes_type_idx").on(t.contentType),
  ],
);

export const discoveryCandidateVerificationPlansTable = pgTable(
  "discovery_candidate_verification_plans",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    planStatus: text("plan_status").notNull().default("planned"),
    candidateCount: integer("candidate_count").notNull().default(0),
    maxAutoVerificationCandidates: integer("max_auto_verification_candidates").notNull().default(100),
    selectedCandidateCount: integer("selected_candidate_count").notNull().default(0),
    overageCandidateCount: integer("overage_candidate_count").notNull().default(0),
    selectedCandidatesJson: jsonb("selected_candidates_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    overageCandidatesJson: jsonb("overage_candidates_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    verificationMode: text("verification_mode").notNull().default("mock_plan_only"),
    allowByteRangeOnly: boolean("allow_byte_range_only").notNull().default(true),
    allowPersistentStorage: boolean("allow_persistent_storage").notNull().default(false),
    requiresOpenPublicUrl: boolean("requires_open_public_url").notNull().default(true),
    requiresNoLogin: boolean("requires_no_login").notNull().default(true),
    supportOnly: boolean("support_only").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_candidate_verification_plans_job_idx").on(t.jobId),
    index("discovery_candidate_verification_plans_status_idx").on(t.planStatus),
  ],
);

export const discoveryCostCalibrationRecordsTable = pgTable(
  "discovery_cost_calibration_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    clientId: text("client_id").notNull(),
    contentType: text("content_type"),
    mediaType: text("media_type").notNull(),
    quoteId: text("quote_id").notNull(),
    estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
    actualMeasuredCostUsd: doublePrecision("actual_measured_cost_usd").notNull().default(0),
    differenceUsd: doublePrecision("difference_usd").notNull().default(0),
    differencePercent: doublePrecision("difference_percent").notNull().default(0),
    providerCostJson: jsonb("provider_cost_json").$type<Record<string, unknown>>().notNull().default({}),
    computeCostJson: jsonb("compute_cost_json").$type<Record<string, unknown>>().notNull().default({}),
    candidateVerificationCostJson: jsonb("candidate_verification_cost_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    quoteAccuracyLabel: text("quote_accuracy_label").notNull().default("unknown"),
    learningSummary: jsonb("learning_summary").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_cost_calibration_records_job_idx").on(t.jobId),
    index("discovery_cost_calibration_records_client_idx").on(t.clientId),
    index("discovery_cost_calibration_records_type_idx").on(t.contentType),
  ],
);

export const discoveryPricingLearningProfilesTable = pgTable(
  "discovery_pricing_learning_profiles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clientId: text("client_id").notNull(),
    contentType: text("content_type"),
    mediaType: text("media_type").notNull(),
    avgEstimatedCostUsd: doublePrecision("avg_estimated_cost_usd").notNull().default(0),
    avgActualMeasuredCostUsd: doublePrecision("avg_actual_measured_cost_usd").notNull().default(0),
    avgDifferencePercent: doublePrecision("avg_difference_percent").notNull().default(0),
    recommendedRiskBufferPercent: doublePrecision("recommended_risk_buffer_percent").notNull().default(0),
    recommendedMarginMultiplier: doublePrecision("recommended_margin_multiplier").notNull().default(1),
    recommendedMaxAutoCandidates: integer("recommended_max_auto_candidates").notNull().default(100),
    providerEfficiencyJson: jsonb("provider_efficiency_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_pricing_learning_profiles_client_idx").on(t.clientId),
    index("discovery_pricing_learning_profiles_type_idx").on(t.contentType),
  ],
);

export const discoveryCandidateVerificationRunsTable = pgTable(
  "discovery_candidate_verification_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    planId: text("plan_id").notNull(),
    runMode: text("run_mode").notNull().default("mock_only"),
    status: text("status").notNull().default("planned"),
    candidateCount: integer("candidate_count").notNull().default(0),
    verifiedCandidateCount: integer("verified_candidate_count").notNull().default(0),
    wrongIdCount: integer("wrong_id_count").notNull().default(0),
    noIdCount: integer("no_id_count").notNull().default(0),
    partialSupportCount: integer("partial_support_count").notNull().default(0),
    skippedByPolicyCount: integer("skipped_by_policy_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    realFetchEnabled: boolean("real_fetch_enabled").notNull().default(false),
    realAnalyzeEnabled: boolean("real_analyze_enabled").notNull().default(false),
    supportOnly: boolean("support_only").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("discovery_candidate_verification_runs_job_idx").on(t.jobId),
    index("discovery_candidate_verification_runs_plan_idx").on(t.planId),
  ],
);

export const discoveryCandidateVerificationResultsTable = pgTable(
  "discovery_candidate_verification_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id").notNull(),
    jobId: text("job_id").notNull(),
    candidateResultId: text("candidate_result_id").notNull(),
    url: text("url"),
    platform: text("platform"),
    verificationStatus: text("verification_status").notNull(),
    mockScenario: text("mock_scenario").notNull(),
    tancmarkIdRead: text("tancmark_id_read"),
    matchedDocId: text("matched_doc_id"),
    matchedClientId: text("matched_client_id"),
    idMatch: boolean("id_match").notNull().default(false),
    matchingBits: integer("matching_bits").notNull().default(0),
    supportPercent: doublePrecision("support_percent").notNull().default(0),
    analyzerDecisionSource: text("analyzer_decision_source")
      .notNull()
      .default("mock_existing_tancmark_analyzer"),
    discoveryDecisionRole: text("discovery_decision_role")
      .notNull()
      .default("discovery_records_only_no_vault_no_confirmed"),
    canOpenVaultByDiscovery: boolean("can_open_vault_by_discovery").notNull().default(false),
    supportOnly: boolean("support_only").notNull().default(true),
    policyAllowed: boolean("policy_allowed").notNull().default(false),
    policyBlockReason: text("policy_block_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_candidate_verification_results_run_idx").on(t.runId),
    index("discovery_candidate_verification_results_job_idx").on(t.jobId),
    index("discovery_candidate_verification_results_status_idx").on(t.verificationStatus),
  ],
);

export const discoveryCandidateVerificationPolicyLogsTable = pgTable(
  "discovery_candidate_verification_policy_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: text("run_id").notNull(),
    candidateResultId: text("candidate_result_id").notNull(),
    policyAllowed: boolean("policy_allowed").notNull().default(false),
    requiresPublicUrl: boolean("requires_public_url").notNull().default(true),
    requiresNoLogin: boolean("requires_no_login").notNull().default(true),
    requiresNoPaywall: boolean("requires_no_paywall").notNull().default(true),
    requiresNoDrmBypass: boolean("requires_no_drm_bypass").notNull().default(true),
    allowsPersistentStorage: boolean("allows_persistent_storage").notNull().default(false),
    realFetchAttempted: boolean("real_fetch_attempted").notNull().default(false),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discovery_candidate_verification_policy_logs_run_idx").on(t.runId),
    index("discovery_candidate_verification_policy_logs_candidate_idx").on(t.candidateResultId),
  ],
);

export type DiscoveryJobRow = typeof discoveryJobsTable.$inferSelect;
export type DiscoveryMediaAssetRow = typeof discoveryMediaAssetsTable.$inferSelect;
export type DiscoveryProviderPricingRow = typeof discoveryProviderPricingTable.$inferSelect;
export type DiscoveryApiCallRow = typeof discoveryApiCallsTable.$inferSelect;
export type DiscoveryProcessingMetricRow = typeof discoveryProcessingMetricsTable.$inferSelect;
export type DiscoveryResultRow = typeof discoveryResultsTable.$inferSelect;
export type DiscoverySecureRoomHandoffRow = typeof discoverySecureRoomHandoffTable.$inferSelect;
export type DiscoverySearchDnaProfileRow = typeof discoverySearchDnaProfilesTable.$inferSelect;
export type DiscoverySearchDnaRecordRow = typeof discoverySearchDnaRecordsTable.$inferSelect;
export type DiscoveryQueryPlanRow = typeof discoveryQueryPlansTable.$inferSelect;
export type DiscoveryQueryOutcomeRow = typeof discoveryQueryOutcomesTable.$inferSelect;
export type DiscoveryCostQuoteRow = typeof discoveryCostQuotesTable.$inferSelect;
export type DiscoveryCandidateVerificationPlanRow =
  typeof discoveryCandidateVerificationPlansTable.$inferSelect;
export type DiscoveryCostCalibrationRecordRow =
  typeof discoveryCostCalibrationRecordsTable.$inferSelect;
export type DiscoveryPricingLearningProfileRow =
  typeof discoveryPricingLearningProfilesTable.$inferSelect;
export type DiscoveryCandidateVerificationRunRow =
  typeof discoveryCandidateVerificationRunsTable.$inferSelect;
export type DiscoveryCandidateVerificationResultRow =
  typeof discoveryCandidateVerificationResultsTable.$inferSelect;
export type DiscoveryCandidateVerificationPolicyLogRow =
  typeof discoveryCandidateVerificationPolicyLogsTable.$inferSelect;
