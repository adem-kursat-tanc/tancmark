import { createHash } from "node:crypto";
import { buildDiscoveryConfig, type DiscoveryConfig } from "../discovery/config";
import { runCandidateVerificationMock } from "../discovery/candidateVerificationRunner";
import { applyCostSummaryToJob, buildDiscoveryCostSummary } from "../discovery/costing";
import {
  buildDiscoveryCandidateVerificationPlan,
  recordDiscoveryCandidateVerificationPlan,
} from "../discovery/discoveryCandidateVerificationPlan";
import {
  buildDiscoveryCostCalibrationRecord,
  recordDiscoveryCostCalibrationRecord,
} from "../discovery/discoveryCostCalibration";
import { buildDiscoveryCostQuote, recordDiscoveryCostQuote } from "../discovery/discoveryCostQuote";
import { recordDiscoverySearchDnaCostLearningHint } from "../discovery/discoveryLearningMemory";
import { recordDiscoveryPricingLearning } from "../discovery/discoveryPricingLearning";
import {
  appendDiscoveryApiCalls,
  appendDiscoveryMediaAssets,
  appendDiscoveryProcessingMetrics,
  appendDiscoveryResults,
  createDiscoveryJob,
  getDiscoveryApiCalls,
  getDiscoveryJob,
  getDiscoveryMediaAssets,
  getDiscoveryProcessingMetrics,
  getDiscoveryResults,
  getDiscoverySnapshot,
  setDiscoverySecureRoomHandoff,
  updateDiscoveryJob,
} from "../discovery/discoveryStore";
import { buildDiscoveryMediaPlan } from "../discovery/mediaSplitter";
import { providersForNames } from "../discovery/providerRegistry";
import { evaluateDiscoveryProviderSafetyGate } from "../discovery/providerSafetyGate";
import { buildDiscoverySecureRoomHandoff } from "../discovery/secureRoomHandoff";
import {
  buildDiscoverySearchDnaBundle,
  completeDiscoverySearchDnaLearning,
  providerNamesFromSearchDnaPlan,
} from "../discovery/discoverySearchDna";
import type { DiscoveryProvider } from "../discovery/providers/DiscoveryProvider";
import type {
  DiscoveryApiCall,
  DiscoveryCostSummary,
  DiscoveryJobInput,
  DiscoveryJobSnapshot,
  DiscoveryProviderName,
} from "../discovery/types";

export interface DiscoveryWorkerOptions {
  config?: DiscoveryConfig;
  forceFailureProviders?: DiscoveryProviderName[];
  forceNoResultProviders?: DiscoveryProviderName[];
}

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function skippedCall(
  jobId: string,
  provider: DiscoveryProvider,
  reason: string,
  estimatedCostUsd: number,
  unitCount: number,
  realApiEnabled: boolean,
): DiscoveryApiCall {
  const timestamp = now();
  return {
    id: idFor("call", [jobId, provider.name, reason]),
    jobId,
    provider: provider.name,
    layer: provider.layer,
    endpointName: provider.endpointName,
    requestId: idFor("req", [jobId, provider.name, reason]),
    status: "skipped",
    realApiEnabled,
    unitCount,
    estimatedCostUsd,
    actualCostUsd: 0,
    retryCount: 0,
    latencyMs: 0,
    externalRequestRef: null,
    externalResultRef: null,
    errorCode: reason,
    errorMessage: reason,
    sentOriginalContent: false,
    sentHashOnly: false,
    sentMetadataOnly: false,
    sentSignedUrl: false,
    sentFingerprintOnly: false,
    mocked: false,
    skipped: true,
    createdAt: timestamp,
    completedAt: timestamp,
  };
}

export async function runDiscoveryJob(
  jobId: string,
  options: DiscoveryWorkerOptions = {},
): Promise<DiscoveryJobSnapshot> {
  const config = options.config ?? buildDiscoveryConfig();
  const failureProviders = new Set(options.forceFailureProviders ?? []);
  const noResultProviders = new Set(options.forceNoResultProviders ?? []);
  let job = getDiscoveryJob(jobId);
  if (!job) throw new Error(`Discovery job not found: ${jobId}`);
  job = updateDiscoveryJob(job.id, { status: "processing" });

  const searchDnaBundle = buildDiscoverySearchDnaBundle({ job, config });
  job = updateDiscoveryJob(job.id, {
    requestedLayers: searchDnaBundle.plan.searchLayers,
  });

  const mediaPlan = buildDiscoveryMediaPlan(job, config);
  appendDiscoveryMediaAssets(job.id, mediaPlan.assets);
  appendDiscoveryProcessingMetrics(job.id, mediaPlan.metrics);

  let plannedEstimatedExternalCost = 0;
  const providerCalls: DiscoveryApiCall[] = [];

  for (const provider of providersForNames(providerNamesFromSearchDnaPlan(searchDnaBundle.plan))) {
    const providerInput = {
      job,
      assets: mediaPlan.assets,
      metadataQueries: mediaPlan.metadataQueries,
      telegramQueries: mediaPlan.telegramQueries,
      forceFailure: failureProviders.has(provider.name),
      forceNoResult: noResultProviders.has(provider.name),
    };
    const request = provider.buildRequest(providerInput, config);
    const estimatedCostUsd = provider.estimateCost(providerInput, config);
    const safetyGate = evaluateDiscoveryProviderSafetyGate({
      job,
      provider,
      request,
      config,
      estimatedCostUsd,
      plannedCostBeforeUsd: plannedEstimatedExternalCost,
    });
    if (safetyGate.blockedReasons.includes("max_allowed_cost_exceeded")) {
      providerCalls.push(
        skippedCall(
          job.id,
          provider,
          "max_allowed_cost_exceeded",
          estimatedCostUsd,
          request.unitCount,
          config.realApiEnabled && config.credentialsAvailable[provider.name],
        ),
      );
      continue;
    }

    plannedEstimatedExternalCost += estimatedCostUsd;
    if (
      !safetyGate.canExecuteRealCall &&
      config.realApiEnabled &&
      job.userConfirmedExternalSearch === true
    ) {
      providerCalls.push(
        skippedCall(
          job.id,
          provider,
          safetyGate.reason,
          estimatedCostUsd,
          request.unitCount,
          config.realApiEnabled && config.credentialsAvailable[provider.name],
        ),
      );
    }
    try {
      const execution = await provider.execute(providerInput, config);
      providerCalls.push(execution.apiCall);
      appendDiscoveryResults(job.id, execution.results);
    } catch (err) {
      providerCalls.push(
        skippedCall(
          job.id,
          provider,
          err instanceof Error ? err.message : "provider_execution_error",
          estimatedCostUsd,
          request.unitCount,
          config.realApiEnabled && config.credentialsAvailable[provider.name],
        ),
      );
    }
  }

  appendDiscoveryApiCalls(job.id, providerCalls);
  appendDiscoveryProcessingMetrics(job.id, [
    {
      id: idFor("metric", [job.id, "provider_calls"]),
      jobId: job.id,
      metricType: "provider_calls",
      durationMs: providerCalls.reduce((sum, call) => sum + call.latencyMs, 0),
      inputBytes: mediaPlan.assets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
      outputBytes: getDiscoveryResults(job.id).length * 512,
      estimatedCostUsd: 0,
      notes: "provider_calls_mock_first_partial_completion_supported",
      createdAt: now(),
    },
    {
      id: idFor("metric", [job.id, "secure_room_handoff"]),
      jobId: job.id,
      metricType: "secure_room_handoff",
      durationMs: 3,
      inputBytes: getDiscoveryResults(job.id).length * 512,
      outputBytes: getDiscoveryResults(job.id).length * 256,
      estimatedCostUsd: 0,
      notes: "secure_room_handoff_prepared_support_only",
      createdAt: now(),
    },
    {
      id: idFor("metric", [job.id, "report_prepare"]),
      jobId: job.id,
      metricType: "report_prepare",
      durationMs: 2,
      inputBytes: getDiscoveryResults(job.id).length * 512,
      outputBytes: 1024,
      estimatedCostUsd: 0,
      notes: "internal_cost_report_prepared_no_user_price",
      createdAt: now(),
    },
  ]);

  const updatedJob = getDiscoveryJob(job.id);
  if (!updatedJob) throw new Error(`Discovery job not found after run: ${job.id}`);
  const costSummary = buildDiscoveryCostSummary(
    updatedJob,
    getDiscoveryApiCalls(job.id),
    getDiscoveryProcessingMetrics(job.id),
    config,
  );
  const completedJob = applyCostSummaryToJob(
    updateDiscoveryJob(job.id, {
      status: "completed",
      completedAt: now(),
      errorMessage: null,
    }),
    costSummary,
  );
  updateDiscoveryJob(job.id, completedJob);

  const completedSearchDnaBundle = completeDiscoverySearchDnaLearning({
    job: completedJob,
    bundle: searchDnaBundle,
    apiCalls: getDiscoveryApiCalls(job.id),
    results: getDiscoveryResults(job.id),
    secureRoomHandoffCreated: true,
  });
  const candidateVerificationPlan = recordDiscoveryCandidateVerificationPlan(
    buildDiscoveryCandidateVerificationPlan({
      job: completedJob,
      results: getDiscoveryResults(job.id),
      config,
    }),
  );
  const costQuote = recordDiscoveryCostQuote(
    buildDiscoveryCostQuote({
      job: completedJob,
      costSummary,
      candidatePlan: candidateVerificationPlan,
      contentType: completedSearchDnaBundle.classification.contentType,
      config,
    }),
  );
  const costCalibration = recordDiscoveryCostCalibrationRecord(
    buildDiscoveryCostCalibrationRecord({
      job: completedJob,
      quote: costQuote,
      costSummary,
      contentType: completedSearchDnaBundle.classification.contentType,
    }),
  );
  recordDiscoveryPricingLearning({
    calibration: costCalibration,
    quote: costQuote,
  });
  recordDiscoverySearchDnaCostLearningHint({
    clientId: completedJob.clientId,
    contentType: completedSearchDnaBundle.classification.contentType,
    provider: completedSearchDnaBundle.plan.providerPlan[0]?.provider ?? "brave",
    hint: `cost_quote_${costCalibration.quoteAccuracyLabel}`,
  });
  const candidateVerificationRun = runCandidateVerificationMock({
    job: completedJob,
    plan: candidateVerificationPlan,
  });
  const handoff = buildDiscoverySecureRoomHandoff(
    completedJob,
    getDiscoveryResults(job.id),
    getDiscoveryApiCalls(job.id),
    costSummary,
    {
      contentType: completedSearchDnaBundle.classification.contentType,
      contentTypeConfidence: completedSearchDnaBundle.classification.confidence,
      selectedLayers: completedSearchDnaBundle.plan.searchLayers,
      selectedProviders: completedSearchDnaBundle.plan.providerPlan.map((rec) => rec.provider),
      learningRecordCreated: completedSearchDnaBundle.record !== null,
      planVersion: completedSearchDnaBundle.plan.planVersion,
      queryCount: completedSearchDnaBundle.plan.queryVariants.length,
      keyframeCandidateCount: completedSearchDnaBundle.plan.keyframePlan.length,
      audioHintCount: completedSearchDnaBundle.plan.audioPlan.length,
      telegramQueryCount: completedSearchDnaBundle.plan.telegramPlan.length,
      costCapApplied: completedSearchDnaBundle.plan.costPlan.costCapApplied,
      costQuote,
      candidateVerificationPlan,
      candidateVerificationSummary: candidateVerificationRun.summary,
    },
  );
  setDiscoverySecureRoomHandoff(job.id, handoff);
  return getDiscoverySnapshot(job.id, costSummary);
}

export async function createAndRunDiscoveryJob(
  input: DiscoveryJobInput,
  options: DiscoveryWorkerOptions = {},
): Promise<DiscoveryJobSnapshot> {
  const config = options.config ?? buildDiscoveryConfig();
  const job = createDiscoveryJob(input, config.defaultMaxCostUsd);
  return runDiscoveryJob(job.id, { ...options, config });
}

export function summarizeDiscoveryCost(snapshot: DiscoveryJobSnapshot): DiscoveryCostSummary {
  return snapshot.costSummary;
}
