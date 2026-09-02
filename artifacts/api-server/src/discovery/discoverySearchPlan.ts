import type { DiscoveryConfig } from "./config";
import type { DiscoveryLayer, DiscoveryProviderName } from "./types";
import {
  DISCOVERY_SEARCH_DNA_DECISION_ROLE,
  type DiscoveryContentClassification,
} from "./discoveryContentClassifier";
import type { DiscoverySelectedSearchPieces, DiscoveryQueryVariant } from "./discoveryQueryBuilder";

export type DiscoveryQueryPlanStatus = "planned" | "used" | "skipped" | "failed";

export interface DiscoveryProviderRouteRecommendation {
  provider: DiscoveryProviderName;
  layer: DiscoveryLayer;
  priority: number;
  estimatedCostUsd: number;
  expectedValue: number;
  privacyPayloadType: "hash" | "metadata" | "query" | "signed_url" | "fingerprint";
  reason: string;
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
  requiresTancMarkVerification: true;
}

export interface DiscoverySearchDnaPlan {
  id: string;
  jobId: string;
  planVersion: "search-dna-plan-v0.1";
  contentType: DiscoveryContentClassification["contentType"];
  contentTypeConfidence: number;
  planStatus: DiscoveryQueryPlanStatus;
  searchLayers: DiscoveryLayer[];
  providerPlan: DiscoveryProviderRouteRecommendation[];
  queryVariants: DiscoveryQueryVariant[];
  keyframePlan: DiscoverySelectedSearchPieces["keyframeCandidates"];
  audioPlan: DiscoverySelectedSearchPieces["audioFingerprintHints"];
  telegramPlan: string[];
  costPlan: {
    maxAllowedCostUsd: number;
    totalEstimatedCostUsd: number;
    expensiveProvidersDeprioritized: DiscoveryProviderName[];
    costCapApplied: boolean;
  };
  privacyPlan: Array<{
    provider: DiscoveryProviderName;
    payloadType: DiscoveryProviderRouteRecommendation["privacyPayloadType"];
    sentOriginalContent: false;
    requiresRuntimeUserConsentForSignedUrl: boolean;
  }>;
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
  requiresTancMarkVerification: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

function now(): string {
  return new Date().toISOString();
}

function roundUsd(value: number): number {
  return Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;
}

function makeId(jobId: string): string {
  return `search_dna_plan_${jobId}`;
}

function baseExpectedValue(
  provider: DiscoveryProviderName,
  contentType: DiscoveryContentClassification["contentType"],
): number {
  if (provider === "apify_telegram" && contentType === "education_course") return 0.82;
  if (provider === "acrcloud" && (contentType === "podcast_speech" || contentType === "music")) return 0.8;
  if (provider === "dataforseo" && (contentType === "visual_artwork" || contentType === "social_video")) return 0.78;
  if (provider === "brave" && (contentType === "text_document" || contentType === "link_url")) return 0.76;
  if (provider === "exa" && contentType === "text_document") return 0.72;
  return 0.58;
}

function providerForLayer(layer: DiscoveryLayer): DiscoveryProviderRouteRecommendation[] {
  switch (layer) {
    case "visual":
    case "video_metadata":
      return [
        {
          provider: "dataforseo",
          layer: "visual",
          priority: 7,
          estimatedCostUsd: 0,
          expectedValue: 0,
          privacyPayloadType: "hash",
          reason: "visual_or_video_metadata_candidate_discovery",
          supportOnly: true,
          decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
          requiresTancMarkVerification: true,
        },
      ];
    case "audio":
      return [
        {
          provider: "acrcloud",
          layer: "audio",
          priority: 7,
          estimatedCostUsd: 0,
          expectedValue: 0,
          privacyPayloadType: "fingerprint",
          reason: "audio_fingerprint_candidate_discovery",
          supportOnly: true,
          decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
          requiresTancMarkVerification: true,
        },
      ];
    case "metadata_text":
      return [
        {
          provider: "brave",
          layer: "metadata_text",
          priority: 8,
          estimatedCostUsd: 0,
          expectedValue: 0,
          privacyPayloadType: "query",
          reason: "cheap_web_text_candidate_discovery",
          supportOnly: true,
          decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
          requiresTancMarkVerification: true,
        },
        {
          provider: "exa",
          layer: "metadata_text",
          priority: 5,
          estimatedCostUsd: 0,
          expectedValue: 0,
          privacyPayloadType: "metadata",
          reason: "semantic_similarity_candidate_discovery",
          supportOnly: true,
          decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
          requiresTancMarkVerification: true,
        },
      ];
    case "telegram":
      return [
        {
          provider: "apify_telegram",
          layer: "telegram",
          priority: 6,
          estimatedCostUsd: 0,
          expectedValue: 0,
          privacyPayloadType: "query",
          reason: "public_telegram_piracy_candidate_discovery",
          supportOnly: true,
          decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
          requiresTancMarkVerification: true,
        },
      ];
  }
}

export function buildDiscoverySearchPlan(input: {
  jobId: string;
  classification: DiscoveryContentClassification;
  pieces: DiscoverySelectedSearchPieces;
  config: DiscoveryConfig;
  maxAllowedCostUsd: number;
}): DiscoverySearchDnaPlan {
  const byProvider = new Map<DiscoveryProviderName, DiscoveryProviderRouteRecommendation>();
  for (const layer of input.classification.recommendedSearchLayers) {
    for (const rec of providerForLayer(layer)) {
      const current = byProvider.get(rec.provider);
      if (!current || rec.priority > current.priority) byProvider.set(rec.provider, rec);
    }
  }

  const expensiveProvidersDeprioritized: DiscoveryProviderName[] = [];
  const providerPlan = Array.from(byProvider.values()).map((rec) => {
    const estimatedCostUsd = input.config.providerUnitCostsUsd[rec.provider];
    const expectedValue = baseExpectedValue(rec.provider, input.classification.contentType);
    const costPressure =
      input.maxAllowedCostUsd > 0 && estimatedCostUsd > input.maxAllowedCostUsd * 0.45;
    if (costPressure) expensiveProvidersDeprioritized.push(rec.provider);
    return {
      ...rec,
      estimatedCostUsd: roundUsd(estimatedCostUsd),
      expectedValue,
      priority: costPressure ? Math.max(1, rec.priority - 4) : Math.round((rec.priority + expectedValue * 4) * 10) / 10,
      reason: costPressure ? `${rec.reason}_deprioritized_by_cost_cap` : rec.reason,
    };
  });

  providerPlan.sort((a, b) => b.priority - a.priority || a.estimatedCostUsd - b.estimatedCostUsd);
  const totalEstimatedCostUsd = roundUsd(
    providerPlan.reduce((sum, rec) => sum + rec.estimatedCostUsd, 0),
  );

  return {
    id: makeId(input.jobId),
    jobId: input.jobId,
    planVersion: "search-dna-plan-v0.1",
    contentType: input.classification.contentType,
    contentTypeConfidence: input.classification.confidence,
    planStatus: "planned",
    searchLayers: input.classification.recommendedSearchLayers,
    providerPlan,
    queryVariants: input.pieces.queryVariants,
    keyframePlan: input.pieces.keyframeCandidates,
    audioPlan: input.pieces.audioFingerprintHints,
    telegramPlan: input.pieces.telegramShortPatterns,
    costPlan: {
      maxAllowedCostUsd: input.maxAllowedCostUsd,
      totalEstimatedCostUsd,
      expensiveProvidersDeprioritized,
      costCapApplied: expensiveProvidersDeprioritized.length > 0,
    },
    privacyPlan: providerPlan.map((rec) => ({
      provider: rec.provider,
      payloadType: rec.privacyPayloadType,
      sentOriginalContent: false,
      requiresRuntimeUserConsentForSignedUrl: rec.privacyPayloadType === "signed_url",
    })),
    supportOnly: true,
    decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
    requiresTancMarkVerification: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: now(),
  };
}
