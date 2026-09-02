import type { DiscoveryConfig } from "./config";
import type { DiscoveryApiCall, DiscoveryJobRecord, DiscoveryProviderName, DiscoveryResult } from "./types";
import {
  classifyDiscoveryContent,
  DISCOVERY_SEARCH_DNA_DECISION_ROLE,
  type DiscoveryContentClassification,
} from "./discoveryContentClassifier";
import {
  buildDiscoverySearchPieces,
  type DiscoverySelectedSearchPieces,
} from "./discoveryQueryBuilder";
import { buildDiscoverySearchPlan, type DiscoverySearchDnaPlan } from "./discoverySearchPlan";
import {
  getDiscoveryQueryOutcomes,
  getDiscoverySearchDnaRecord,
  recordDiscoverySearchDnaLearning,
  type DiscoveryQueryOutcome,
  type DiscoverySearchDnaRecord,
} from "./discoveryLearningMemory";

export interface DiscoverySearchDnaBundle {
  classification: DiscoveryContentClassification;
  selectedPieces: DiscoverySelectedSearchPieces;
  plan: DiscoverySearchDnaPlan;
  record: DiscoverySearchDnaRecord | null;
  queryOutcomes: DiscoveryQueryOutcome[];
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
  requiresTancMarkVerification: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const bundles = new Map<string, DiscoverySearchDnaBundle>();

export function buildDiscoverySearchDnaBundle(input: {
  job: DiscoveryJobRecord;
  config: DiscoveryConfig;
}): DiscoverySearchDnaBundle {
  const classification = classifyDiscoveryContent(input.job);
  const selectedPieces = buildDiscoverySearchPieces(input.job, classification);
  const plan = buildDiscoverySearchPlan({
    jobId: input.job.id,
    classification,
    pieces: selectedPieces,
    config: input.config,
    maxAllowedCostUsd: input.job.maxAllowedCostUsd,
  });
  const bundle: DiscoverySearchDnaBundle = {
    classification,
    selectedPieces,
    plan,
    record: getDiscoverySearchDnaRecord(input.job.id),
    queryOutcomes: getDiscoveryQueryOutcomes(input.job.id),
    supportOnly: true,
    decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
    requiresTancMarkVerification: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
  bundles.set(input.job.id, bundle);
  return bundle;
}

export function completeDiscoverySearchDnaLearning(input: {
  job: DiscoveryJobRecord;
  bundle: DiscoverySearchDnaBundle;
  apiCalls: readonly DiscoveryApiCall[];
  results: readonly DiscoveryResult[];
  secureRoomHandoffCreated: boolean;
}): DiscoverySearchDnaBundle {
  const learning = recordDiscoverySearchDnaLearning({
    job: input.job,
    classification: input.bundle.classification,
    plan: input.bundle.plan,
    apiCalls: input.apiCalls,
    results: input.results,
    secureRoomHandoffCreated: input.secureRoomHandoffCreated,
  });
  const updated: DiscoverySearchDnaBundle = {
    ...input.bundle,
    record: learning.record,
    queryOutcomes: learning.outcomes,
  };
  bundles.set(input.job.id, updated);
  return updated;
}

export function getDiscoverySearchDnaBundle(jobId: string): DiscoverySearchDnaBundle | null {
  const existing = bundles.get(jobId);
  if (existing) return existing;
  const record = getDiscoverySearchDnaRecord(jobId);
  if (!record) return null;
  return null;
}

export function providerNamesFromSearchDnaPlan(
  plan: DiscoverySearchDnaPlan,
): DiscoveryProviderName[] {
  return plan.providerPlan.map((rec) => rec.provider);
}

export function resetDiscoverySearchDnaBundlesForTests(): void {
  bundles.clear();
}
