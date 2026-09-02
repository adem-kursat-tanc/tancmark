import { createHash } from "node:crypto";
import type { DiscoveryConfig } from "./config";
import { buildDiscoveryQuotePolicy } from "./discoveryQuotePolicy";
import type {
  DiscoveryCandidateVerificationPlan,
  DiscoveryCostQuote,
  DiscoveryCostSummary,
  DiscoveryJobRecord,
} from "./types";

const quotes = new Map<string, DiscoveryCostQuote>();

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

export function roundDiscoveryUsd(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundQuoteUnits(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

export function buildDiscoveryCostQuote(input: {
  job: DiscoveryJobRecord;
  costSummary: DiscoveryCostSummary;
  candidatePlan: DiscoveryCandidateVerificationPlan;
  contentType: string | null;
  config: DiscoveryConfig;
}): DiscoveryCostQuote {
  const policy = buildDiscoveryQuotePolicy(input.config);
  const estimatedCandidateVerificationCostUsd = roundDiscoveryUsd(
    input.candidatePlan.selectedCandidateCount * policy.candidateVerificationUnitCostUsd,
  );
  const baseInternalCostUsd = roundDiscoveryUsd(
    input.costSummary.estimatedExternalApiCostUsd +
      input.costSummary.estimatedComputeCostUsd +
      input.costSummary.estimatedStorageCostUsd +
      input.costSummary.estimatedQueueCostUsd +
      input.costSummary.estimatedReportCostUsd +
      estimatedCandidateVerificationCostUsd,
  );
  const riskBufferUsd = roundDiscoveryUsd(baseInternalCostUsd * policy.riskBufferPercent);
  const totalEstimatedInternalCostUsd = roundDiscoveryUsd(baseInternalCostUsd + riskBufferUsd);
  const quoteUnitsPreview = roundQuoteUnits(
    totalEstimatedInternalCostUsd * policy.marginMultiplier * policy.quoteUnitConversionFactor,
  );
  const overageBaseUsd = roundDiscoveryUsd(
    input.candidatePlan.overageCandidateCount * policy.candidateVerificationUnitCostUsd,
  );
  const overageQuoteUnitsPreview = roundQuoteUnits(
    overageBaseUsd * policy.marginMultiplier * policy.quoteUnitConversionFactor,
  );

  return {
    id: idFor("cost_quote", [
      input.job.id,
      input.candidatePlan.id,
      totalEstimatedInternalCostUsd,
    ]),
    jobId: input.job.id,
    clientId: input.job.clientId,
    docId: input.job.docId ?? null,
    quoteMode: policy.quoteMode,
    chargeEnabled: false,
    contentType: input.contentType,
    mediaType: input.job.mediaType,
    estimatedExternalApiCostUsd: input.costSummary.estimatedExternalApiCostUsd,
    estimatedComputeCostUsd: input.costSummary.estimatedComputeCostUsd,
    estimatedStorageCostUsd: input.costSummary.estimatedStorageCostUsd,
    estimatedQueueCostUsd: input.costSummary.estimatedQueueCostUsd,
    estimatedReportCostUsd: input.costSummary.estimatedReportCostUsd,
    estimatedCandidateVerificationCostUsd,
    baseInternalCostUsd,
    riskBufferPercent: policy.riskBufferPercent,
    riskBufferUsd,
    totalEstimatedInternalCostUsd,
    marginMultiplier: policy.marginMultiplier,
    quoteUnitConversionFactor: policy.quoteUnitConversionFactor,
    quoteUnitsPreview,
    includedAutoVerificationCandidates: input.candidatePlan.selectedCandidateCount,
    maxAutoVerificationCandidates: policy.maxAutoVerificationCandidates,
    overageCandidateCount: input.candidatePlan.overageCandidateCount,
    overageQuoteUnitsPreview,
    selfVerifyOptionAvailable: true,
    extraAutoVerifyPreviewAvailable: input.candidatePlan.overageCandidateCount > 0,
    costConfidence: input.costSummary.costConfidence,
    supportOnly: true,
    decisionRole: "discovery_cost_quote_preview_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: now(),
  };
}

export function recordDiscoveryCostQuote(quote: DiscoveryCostQuote): DiscoveryCostQuote {
  quotes.set(quote.jobId, quote);
  return quote;
}

export function getDiscoveryCostQuote(jobId: string): DiscoveryCostQuote | null {
  return quotes.get(jobId) ?? null;
}

export function resetDiscoveryCostQuotesForTests(): void {
  quotes.clear();
}

