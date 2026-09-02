import { createHash } from "node:crypto";
import { roundDiscoveryUsd } from "./discoveryCostQuote";
import type {
  DiscoveryCostCalibrationRecord,
  DiscoveryCostQuote,
  DiscoveryCostSummary,
  DiscoveryJobRecord,
} from "./types";

const records = new Map<string, DiscoveryCostCalibrationRecord>();

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function accuracyLabel(
  estimatedCostUsd: number,
  actualMeasuredCostUsd: number,
): DiscoveryCostCalibrationRecord["quoteAccuracyLabel"] {
  if (estimatedCostUsd <= 0) return "unknown";
  const diffPercent = ((actualMeasuredCostUsd - estimatedCostUsd) / estimatedCostUsd) * 100;
  if (Math.abs(diffPercent) <= 10) return "accurate";
  return diffPercent > 0 ? "under_estimated" : "over_estimated";
}

export function buildDiscoveryCostCalibrationRecord(input: {
  job: DiscoveryJobRecord;
  quote: DiscoveryCostQuote;
  costSummary: DiscoveryCostSummary;
  contentType: string | null;
}): DiscoveryCostCalibrationRecord {
  const estimatedCostUsd = input.quote.totalEstimatedInternalCostUsd;
  const actualMeasuredCostUsd = input.costSummary.totalActualMeasuredCostUsd;
  const differenceUsd = roundDiscoveryUsd(actualMeasuredCostUsd - estimatedCostUsd);
  const differencePercent =
    estimatedCostUsd > 0 ? Math.round((differenceUsd / estimatedCostUsd) * 10000) / 100 : 0;
  const label = accuracyLabel(estimatedCostUsd, actualMeasuredCostUsd);
  return {
    id: idFor("cost_calibration", [input.job.id, input.quote.id, actualMeasuredCostUsd]),
    jobId: input.job.id,
    clientId: input.job.clientId,
    contentType: input.contentType,
    mediaType: input.job.mediaType,
    quoteId: input.quote.id,
    estimatedCostUsd,
    actualMeasuredCostUsd,
    differenceUsd,
    differencePercent,
    providerCostJson: input.costSummary.providerTotals,
    computeCostJson: {
      estimatedComputeCostUsd: input.costSummary.estimatedComputeCostUsd,
      processingMetricCount: input.costSummary.processingMetrics.length,
    },
    candidateVerificationCostJson: {
      estimatedCandidateVerificationCostUsd: input.quote.estimatedCandidateVerificationCostUsd,
      mode: "mock_plan_only",
      realCandidateDownloadPerformed: false,
    },
    quoteAccuracyLabel: label,
    learningSummary: {
      estimatedCostUsd,
      actualMeasuredCostUsd,
      differenceUsd,
      differencePercent,
      quoteAccuracyLabel: label,
      supportOnly: true,
    },
    supportOnly: true,
    decisionRole: "discovery_cost_calibration_learning_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: now(),
  };
}

export function recordDiscoveryCostCalibrationRecord(
  record: DiscoveryCostCalibrationRecord,
): DiscoveryCostCalibrationRecord {
  records.set(record.jobId, record);
  return record;
}

export function getDiscoveryCostCalibrationRecord(jobId: string): DiscoveryCostCalibrationRecord | null {
  return records.get(jobId) ?? null;
}

export function resetDiscoveryCostCalibrationRecordsForTests(): void {
  records.clear();
}

