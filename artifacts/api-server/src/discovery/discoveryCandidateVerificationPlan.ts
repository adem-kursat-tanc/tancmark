import { createHash } from "node:crypto";
import type { DiscoveryConfig } from "./config";
import { buildDiscoveryQuotePolicy } from "./discoveryQuotePolicy";
import type {
  DiscoveryCandidateVerificationCandidate,
  DiscoveryCandidateVerificationPlan,
  DiscoveryJobRecord,
  DiscoveryResult,
} from "./types";

const plans = new Map<string, DiscoveryCandidateVerificationPlan>();

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function candidateFromResult(result: DiscoveryResult, rank: number): DiscoveryCandidateVerificationCandidate {
  return {
    resultId: result.id,
    provider: result.provider,
    layer: result.layer,
    url: result.url,
    platform: result.platform,
    title: result.title,
    confidence: result.confidence,
    rank,
    requiresOpenPublicUrl: true,
    requiresNoLogin: true,
    allowByteRangeOnly: true,
    allowPersistentStorage: false,
    supportOnly: true,
  };
}

export function buildDiscoveryCandidateVerificationPlan(input: {
  job: DiscoveryJobRecord;
  results: readonly DiscoveryResult[];
  config: DiscoveryConfig;
}): DiscoveryCandidateVerificationPlan {
  const policy = buildDiscoveryQuotePolicy(input.config);
  const ranked = [...input.results]
    .filter((result) => result.url !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .map((result, index) => candidateFromResult(result, index + 1));
  const selectedCandidatesJson = ranked.slice(0, policy.maxAutoVerificationCandidates);
  const overageCandidatesJson = ranked.slice(policy.maxAutoVerificationCandidates);
  return {
    id: idFor("candidate_plan", [
      input.job.id,
      ranked.length,
      policy.maxAutoVerificationCandidates,
    ]),
    jobId: input.job.id,
    planStatus: ranked.length > 0 ? "planned" : "skipped",
    candidateCount: ranked.length,
    maxAutoVerificationCandidates: policy.maxAutoVerificationCandidates,
    selectedCandidateCount: selectedCandidatesJson.length,
    overageCandidateCount: overageCandidatesJson.length,
    selectedCandidatesJson,
    overageCandidatesJson,
    verificationMode: "mock_plan_only",
    allowByteRangeOnly: true,
    allowPersistentStorage: false,
    requiresOpenPublicUrl: true,
    requiresNoLogin: true,
    temporaryFileDeletionRequired: true,
    externalApiCalled: false,
    realCandidateDownloadPerformed: false,
    supportOnly: true,
    decisionRole: "discovery_candidate_verification_plan_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt: now(),
  };
}

export function recordDiscoveryCandidateVerificationPlan(
  plan: DiscoveryCandidateVerificationPlan,
): DiscoveryCandidateVerificationPlan {
  plans.set(plan.jobId, plan);
  return plan;
}

export function getDiscoveryCandidateVerificationPlan(
  jobId: string,
): DiscoveryCandidateVerificationPlan | null {
  return plans.get(jobId) ?? null;
}

export function resetDiscoveryCandidateVerificationPlansForTests(): void {
  plans.clear();
}

