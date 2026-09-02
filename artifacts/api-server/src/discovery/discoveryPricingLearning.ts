import { createHash } from "node:crypto";
import type {
  DiscoveryCostCalibrationRecord,
  DiscoveryCostQuote,
  DiscoveryPricingLearningProfile,
} from "./types";

const profiles = new Map<string, DiscoveryPricingLearningProfile>();

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function keyFor(record: DiscoveryCostCalibrationRecord): string {
  return `${record.clientId}:${record.contentType ?? "unknown"}:${record.mediaType}`;
}

export function recordDiscoveryPricingLearning(input: {
  calibration: DiscoveryCostCalibrationRecord;
  quote: DiscoveryCostQuote;
}): DiscoveryPricingLearningProfile {
  const current = profiles.get(keyFor(input.calibration));
  const sampleCount = (current?.sampleCount ?? 0) + 1;
  const avgEstimatedCostUsd = round(
    ((current?.avgEstimatedCostUsd ?? 0) * (sampleCount - 1) + input.calibration.estimatedCostUsd) /
      sampleCount,
  );
  const avgActualMeasuredCostUsd = round(
    ((current?.avgActualMeasuredCostUsd ?? 0) * (sampleCount - 1) +
      input.calibration.actualMeasuredCostUsd) /
      sampleCount,
  );
  const avgDifferencePercent = round(
    ((current?.avgDifferencePercent ?? 0) * (sampleCount - 1) + input.calibration.differencePercent) /
      sampleCount,
  );
  const recommendedRiskBufferPercent = Math.max(
    input.quote.riskBufferPercent,
    Math.min(0.5, Math.abs(avgDifferencePercent) / 100),
  );
  const profile: DiscoveryPricingLearningProfile = {
    id:
      current?.id ??
      idFor("pricing_learning_profile", [
        input.calibration.clientId,
        input.calibration.contentType,
        input.calibration.mediaType,
      ]),
    clientId: input.calibration.clientId,
    contentType: input.calibration.contentType,
    mediaType: input.calibration.mediaType,
    sampleCount,
    avgEstimatedCostUsd,
    avgActualMeasuredCostUsd,
    avgDifferencePercent,
    recommendedRiskBufferPercent,
    recommendedMarginMultiplier: input.quote.marginMultiplier,
    recommendedMaxAutoCandidates: input.quote.maxAutoVerificationCandidates,
    providerEfficiencyJson: input.calibration.providerCostJson,
    supportOnly: true,
    decisionRole: "discovery_pricing_learning_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: current?.createdAt ?? now(),
    updatedAt: now(),
  };
  profiles.set(keyFor(input.calibration), profile);
  return profile;
}

export function listDiscoveryPricingLearningProfiles(): DiscoveryPricingLearningProfile[] {
  return Array.from(profiles.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export function resetDiscoveryPricingLearningProfilesForTests(): void {
  profiles.clear();
}

