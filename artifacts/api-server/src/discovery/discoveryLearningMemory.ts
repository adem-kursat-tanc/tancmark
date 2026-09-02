import { createHash } from "node:crypto";
import type { DiscoveryApiCall, DiscoveryJobRecord, DiscoveryProviderName, DiscoveryResult } from "./types";
import {
  DISCOVERY_SEARCH_DNA_DECISION_ROLE,
  type DiscoveryContentClassification,
  type DiscoveryContentType,
} from "./discoveryContentClassifier";
import type { DiscoveryQueryVariant } from "./discoveryQueryBuilder";
import type { DiscoverySearchDnaPlan } from "./discoverySearchPlan";

export type DiscoveryQueryOutcomeLabel =
  | "useful"
  | "weak"
  | "noisy"
  | "no_result"
  | "failed"
  | "skipped";

export interface DiscoveryQueryOutcome {
  id: string;
  jobId: string;
  queryPlanId: string;
  provider: DiscoveryProviderName;
  queryText: string;
  queryType: DiscoveryQueryVariant["queryType"] | "provider_payload";
  resultCount: number;
  usefulCandidateCount: number;
  weakCandidateCount: number;
  falsePositiveCount: number;
  estimatedCostUsd: number;
  actualCostUsd: number;
  latencyMs: number;
  outcomeLabel: DiscoveryQueryOutcomeLabel;
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
  requiresTancMarkVerification: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

export interface DiscoverySearchDnaRecord {
  id: string;
  jobId: string;
  clientId: string;
  docId: string | null;
  contentType: DiscoveryContentType;
  contentTypeConfidence: number;
  selectedLayersJson: string[];
  selectedProvidersJson: DiscoveryProviderName[];
  selectedQueryTermsJson: string[];
  selectedKeyframesJson: DiscoverySearchDnaPlan["keyframePlan"];
  selectedAudioHintsJson: DiscoverySearchDnaPlan["audioPlan"];
  estimatedCostUsd: number;
  actualCostUsd: number;
  resultCount: number;
  usefulResultCount: number;
  falsePositiveCount: number;
  secureRoomHandoffCreated: boolean;
  laterVerifiedByTancMark: false;
  learningSummary: {
    usefulProviders: DiscoveryProviderName[];
    weakProviders: DiscoveryProviderName[];
    failedProviders: DiscoveryProviderName[];
    noResultProviders: DiscoveryProviderName[];
    expensiveProviders: DiscoveryProviderName[];
    usefulQueries: string[];
    noResultQueries: string[];
    providerFailureLearned: boolean;
    noResultQueryLearned: boolean;
    usefulCandidateLearned: boolean;
  };
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
  requiresTancMarkVerification: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt: string;
}

export interface DiscoverySearchDnaProfile {
  id: string;
  clientId: string;
  contentType: DiscoveryContentType;
  profileName: string;
  learnedProviderRankingJson: Array<{ provider: DiscoveryProviderName; score: number }>;
  learnedQueryPatternsJson: string[];
  learnedCostHintsJson: Array<{ provider: DiscoveryProviderName; hint: string }>;
  learnedFalsePositiveHintsJson: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const records = new Map<string, DiscoverySearchDnaRecord>();
const outcomes = new Map<string, DiscoveryQueryOutcome[]>();
const profiles = new Map<string, DiscoverySearchDnaProfile>();

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function providerForQueryTarget(target: DiscoveryQueryVariant["target"]): DiscoveryProviderName {
  if (target === "telegram") return "apify_telegram";
  if (target === "semantic_web") return "exa";
  return "brave";
}

function outcomeLabel(call: DiscoveryApiCall, resultCount: number): DiscoveryQueryOutcomeLabel {
  if (call.status === "failed") return "failed";
  if (call.status === "skipped") return "skipped";
  if (resultCount === 0) return "no_result";
  return resultCount > 0 && call.estimatedCostUsd <= 0.01 ? "useful" : "weak";
}

export function buildDiscoveryQueryOutcomes(input: {
  job: DiscoveryJobRecord;
  plan: DiscoverySearchDnaPlan;
  apiCalls: readonly DiscoveryApiCall[];
  results: readonly DiscoveryResult[];
}): DiscoveryQueryOutcome[] {
  const queryByProvider = new Map<DiscoveryProviderName, DiscoveryQueryVariant>();
  for (const query of input.plan.queryVariants) {
    const provider = providerForQueryTarget(query.target);
    if (!queryByProvider.has(provider)) queryByProvider.set(provider, query);
  }

  return input.apiCalls.map((call) => {
    const providerResults = input.results.filter((result) => result.provider === call.provider);
    const query = queryByProvider.get(call.provider);
    const label = outcomeLabel(call, providerResults.length);
    return {
      id: idFor("query_outcome", [call.id, query?.queryText ?? call.provider]),
      jobId: input.job.id,
      queryPlanId: input.plan.id,
      provider: call.provider,
      queryText: query?.queryText ?? `${call.provider}:${call.endpointName}`,
      queryType: query?.queryType ?? "provider_payload",
      resultCount: providerResults.length,
      usefulCandidateCount: label === "useful" ? providerResults.length : 0,
      weakCandidateCount: label === "weak" ? providerResults.length : 0,
      falsePositiveCount: 0,
      estimatedCostUsd: call.estimatedCostUsd,
      actualCostUsd: call.actualCostUsd,
      latencyMs: call.latencyMs,
      outcomeLabel: label,
      supportOnly: true,
      decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
      requiresTancMarkVerification: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
      createdAt: now(),
    };
  });
}

function upsertProfile(record: DiscoverySearchDnaRecord): DiscoverySearchDnaProfile {
  const key = `${record.clientId}:${record.contentType}`;
  const current = profiles.get(key);
  const ranking = new Map<DiscoveryProviderName, number>();
  for (const provider of record.selectedProvidersJson) ranking.set(provider, 1);
  for (const provider of record.learningSummary.usefulProviders) {
    ranking.set(provider, (ranking.get(provider) ?? 0) + 2);
  }
  for (const provider of record.learningSummary.failedProviders) {
    ranking.set(provider, (ranking.get(provider) ?? 0) - 1);
  }
  if (current) {
    for (const item of current.learnedProviderRankingJson) {
      ranking.set(item.provider, (ranking.get(item.provider) ?? 0) + item.score);
    }
  }
  const profile: DiscoverySearchDnaProfile = {
    id: current?.id ?? idFor("search_dna_profile", [record.clientId, record.contentType]),
    clientId: record.clientId,
    contentType: record.contentType,
    profileName: `${record.contentType}_adaptive_search_profile`,
    learnedProviderRankingJson: Array.from(ranking.entries())
      .map(([provider, score]) => ({ provider, score }))
      .sort((a, b) => b.score - a.score),
    learnedQueryPatternsJson: Array.from(
      new Set([...(current?.learnedQueryPatternsJson ?? []), ...record.learningSummary.usefulQueries]),
    ).slice(0, 20),
    learnedCostHintsJson: Array.from(
      new Map(
        [
          ...(current?.learnedCostHintsJson ?? []),
          ...record.learningSummary.expensiveProviders.map((provider) => ({
            provider,
            hint: "deprioritize_when_cost_cap_is_low",
          })),
        ].map((item) => [item.provider, item]),
      ).values(),
    ),
    learnedFalsePositiveHintsJson: current?.learnedFalsePositiveHintsJson ?? [],
    active: true,
    createdAt: current?.createdAt ?? now(),
    updatedAt: now(),
  };
  profiles.set(key, profile);
  return profile;
}

export function recordDiscoverySearchDnaLearning(input: {
  job: DiscoveryJobRecord;
  classification: DiscoveryContentClassification;
  plan: DiscoverySearchDnaPlan;
  apiCalls: readonly DiscoveryApiCall[];
  results: readonly DiscoveryResult[];
  secureRoomHandoffCreated: boolean;
}): { record: DiscoverySearchDnaRecord; outcomes: DiscoveryQueryOutcome[]; profile: DiscoverySearchDnaProfile } {
  const builtOutcomes = buildDiscoveryQueryOutcomes({
    job: input.job,
    plan: input.plan,
    apiCalls: input.apiCalls,
    results: input.results,
  });
  outcomes.set(input.job.id, builtOutcomes);
  const usefulProviders = Array.from(
    new Set(builtOutcomes.filter((outcome) => outcome.outcomeLabel === "useful").map((outcome) => outcome.provider)),
  );
  const failedProviders = Array.from(
    new Set(builtOutcomes.filter((outcome) => outcome.outcomeLabel === "failed").map((outcome) => outcome.provider)),
  );
  const noResultProviders = Array.from(
    new Set(builtOutcomes.filter((outcome) => outcome.outcomeLabel === "no_result").map((outcome) => outcome.provider)),
  );
  const weakProviders = Array.from(
    new Set(builtOutcomes.filter((outcome) => outcome.outcomeLabel === "weak").map((outcome) => outcome.provider)),
  );
  const expensiveProviders = input.plan.costPlan.expensiveProvidersDeprioritized;
  const usefulQueries = builtOutcomes
    .filter((outcome) => outcome.outcomeLabel === "useful")
    .map((outcome) => outcome.queryText)
    .slice(0, 12);
  const noResultQueries = builtOutcomes
    .filter((outcome) => outcome.outcomeLabel === "no_result")
    .map((outcome) => outcome.queryText)
    .slice(0, 12);
  const record: DiscoverySearchDnaRecord = {
    id: idFor("search_dna_record", [input.job.id, input.classification.contentType]),
    jobId: input.job.id,
    clientId: input.job.clientId,
    docId: input.job.docId ?? null,
    contentType: input.classification.contentType,
    contentTypeConfidence: input.classification.confidence,
    selectedLayersJson: input.plan.searchLayers,
    selectedProvidersJson: input.plan.providerPlan.map((rec) => rec.provider),
    selectedQueryTermsJson: input.plan.queryVariants.map((query) => query.queryText),
    selectedKeyframesJson: input.plan.keyframePlan,
    selectedAudioHintsJson: input.plan.audioPlan,
    estimatedCostUsd: input.plan.costPlan.totalEstimatedCostUsd,
    actualCostUsd: input.apiCalls.reduce((sum, call) => sum + call.actualCostUsd, 0),
    resultCount: input.results.length,
    usefulResultCount: builtOutcomes.reduce((sum, outcome) => sum + outcome.usefulCandidateCount, 0),
    falsePositiveCount: 0,
    secureRoomHandoffCreated: input.secureRoomHandoffCreated,
    laterVerifiedByTancMark: false,
    learningSummary: {
      usefulProviders,
      weakProviders,
      failedProviders,
      noResultProviders,
      expensiveProviders,
      usefulQueries,
      noResultQueries,
      providerFailureLearned: failedProviders.length > 0,
      noResultQueryLearned: noResultQueries.length > 0,
      usefulCandidateLearned: usefulQueries.length > 0,
    },
    supportOnly: true,
    decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
    requiresTancMarkVerification: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: now(),
  };
  records.set(input.job.id, record);
  const profile = upsertProfile(record);
  return { record, outcomes: builtOutcomes, profile };
}

export function getDiscoverySearchDnaRecord(jobId: string): DiscoverySearchDnaRecord | null {
  return records.get(jobId) ?? null;
}

export function getDiscoveryQueryOutcomes(jobId: string): DiscoveryQueryOutcome[] {
  return [...(outcomes.get(jobId) ?? [])];
}

export function listDiscoverySearchDnaProfiles(): DiscoverySearchDnaProfile[] {
  return Array.from(profiles.values()).sort((a, b) => a.profileName.localeCompare(b.profileName));
}

export function recordDiscoverySearchDnaCostLearningHint(input: {
  clientId: string;
  contentType: DiscoveryContentType;
  provider: DiscoveryProviderName;
  hint: string;
}): DiscoverySearchDnaProfile | null {
  const key = `${input.clientId}:${input.contentType}`;
  const current = profiles.get(key);
  if (!current) return null;
  const learnedCostHintsJson = Array.from(
    new Map(
      [
        ...current.learnedCostHintsJson,
        {
          provider: input.provider,
          hint: input.hint,
        },
      ].map((item) => [`${item.provider}:${item.hint}`, item]),
    ).values(),
  ).slice(0, 20);
  const updated: DiscoverySearchDnaProfile = {
    ...current,
    learnedCostHintsJson,
    updatedAt: now(),
  };
  profiles.set(key, updated);
  return updated;
}

export function resetDiscoverySearchDnaLearningForTests(): void {
  records.clear();
  outcomes.clear();
  profiles.clear();
}
