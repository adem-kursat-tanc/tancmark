import type { DiscoveryConfig } from "./config";
import type {
  DiscoveryApiCall,
  DiscoveryCostSummary,
  DiscoveryJobRecord,
  DiscoveryProcessingMetric,
  DiscoveryProviderName,
} from "./types";

const PROVIDERS: DiscoveryProviderName[] = [
  "dataforseo",
  "acrcloud",
  "brave",
  "exa",
  "apify_telegram",
];

function roundUsd(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function estimateComputeCostUsd(
  metrics: readonly DiscoveryProcessingMetric[],
  config: DiscoveryConfig,
): number {
  const workerSeconds = metrics.reduce((sum, metric) => sum + metric.durationMs / 1000, 0);
  return roundUsd(workerSeconds * config.computeCostPerWorkerSecondUsd);
}

export function estimateStorageCostUsd(inputBytes: number, config: DiscoveryConfig): number {
  const gbDays = Math.max(0, inputBytes) / (1024 * 1024 * 1024);
  return roundUsd(gbDays * config.storageCostPerGbDayUsd);
}

export function buildDiscoveryCostSummary(
  job: DiscoveryJobRecord,
  apiCalls: readonly DiscoveryApiCall[],
  metrics: readonly DiscoveryProcessingMetric[],
  config: DiscoveryConfig,
): DiscoveryCostSummary {
  const providerTotals = Object.fromEntries(
    PROVIDERS.map((provider) => [
      provider,
      {
        unitCount: 0,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        retryCount: 0,
        failedCallCount: 0,
        skippedCallCount: 0,
        mockedCallCount: 0,
      },
    ]),
  ) as DiscoveryCostSummary["providerTotals"];

  for (const call of apiCalls) {
    const total = providerTotals[call.provider];
    total.unitCount += call.unitCount;
    total.estimatedCostUsd = roundUsd(total.estimatedCostUsd + call.estimatedCostUsd);
    total.actualCostUsd = roundUsd(total.actualCostUsd + call.actualCostUsd);
    total.retryCount += call.retryCount;
    if (call.status === "failed") total.failedCallCount += 1;
    if (call.status === "skipped") total.skippedCallCount += 1;
    if (call.status === "mocked") total.mockedCallCount += 1;
  }

  const estimatedExternalApiCostUsd = roundUsd(
    apiCalls.reduce((sum, call) => sum + call.estimatedCostUsd, 0),
  );
  const actualExternalApiCostUsd = roundUsd(
    apiCalls.reduce((sum, call) => sum + call.actualCostUsd, 0),
  );
  const estimatedComputeCostUsd = estimateComputeCostUsd(metrics, config);
  const inputBytes = Math.max(0, job.fileSizeBytes ?? 0);
  const temporaryOutputBytes = metrics.reduce((sum, metric) => sum + metric.outputBytes, 0);
  const estimatedStorageCostUsd = estimateStorageCostUsd(inputBytes + temporaryOutputBytes, config);
  const estimatedQueueCostUsd = roundUsd(config.queueCostUsd);
  const estimatedReportCostUsd = roundUsd(config.reportCostUsd + config.secureRoomHandoffCostUsd);
  const totalEstimatedInternalCostUsd = roundUsd(
    estimatedExternalApiCostUsd +
      estimatedComputeCostUsd +
      estimatedStorageCostUsd +
      estimatedQueueCostUsd +
      estimatedReportCostUsd,
  );
  const totalActualMeasuredCostUsd = roundUsd(
    actualExternalApiCostUsd +
      estimatedComputeCostUsd +
      estimatedStorageCostUsd +
      estimatedQueueCostUsd +
      estimatedReportCostUsd,
  );

  return {
    estimatedExternalApiCostUsd,
    actualExternalApiCostUsd,
    estimatedComputeCostUsd,
    estimatedStorageCostUsd,
    estimatedQueueCostUsd,
    estimatedReportCostUsd,
    totalEstimatedInternalCostUsd,
    totalActualMeasuredCostUsd,
    costConfidence: apiCalls.some((call) => call.status === "success") ? "high" : "medium",
    providerTotals,
    processingMetrics: [...metrics],
  };
}

export function applyCostSummaryToJob(
  job: DiscoveryJobRecord,
  summary: DiscoveryCostSummary,
): DiscoveryJobRecord {
  return {
    ...job,
    estimatedExternalApiCostUsd: summary.estimatedExternalApiCostUsd,
    actualExternalApiCostUsd: summary.actualExternalApiCostUsd,
    estimatedComputeCostUsd: summary.estimatedComputeCostUsd,
    estimatedStorageCostUsd: summary.estimatedStorageCostUsd,
    estimatedQueueCostUsd: summary.estimatedQueueCostUsd,
    estimatedReportCostUsd: summary.estimatedReportCostUsd,
    totalEstimatedInternalCostUsd: summary.totalEstimatedInternalCostUsd,
    totalActualMeasuredCostUsd: summary.totalActualMeasuredCostUsd,
    costConfidence: summary.costConfidence,
  };
}
