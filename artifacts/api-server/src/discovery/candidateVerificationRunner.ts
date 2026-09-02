import { createHash } from "node:crypto";
import { runMockExistingTancMarkAnalyzer } from "./candidateVerificationBridge";
import {
  buildCandidateVerificationPolicyLog,
  evaluateCandidateVerificationPolicy,
} from "./candidateVerificationPolicy";
import { mockFixtureForCandidateRank } from "./candidateVerificationMockFixtures";
import { buildCandidateVerificationSummary } from "./candidateVerificationSummary";
import type {
  DiscoveryCandidateVerificationPlan,
  DiscoveryCandidateVerificationPolicyLog,
  DiscoveryCandidateVerificationResult,
  DiscoveryCandidateVerificationRun,
  DiscoveryCandidateVerificationSummary,
  DiscoveryJobRecord,
} from "./types";

const runs = new Map<string, DiscoveryCandidateVerificationRun>();
const results = new Map<string, DiscoveryCandidateVerificationResult[]>();
const policyLogs = new Map<string, DiscoveryCandidateVerificationPolicyLog[]>();
const summaries = new Map<string, DiscoveryCandidateVerificationSummary>();

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function statusFor(
  policyAllowed: boolean,
  bridge: ReturnType<typeof runMockExistingTancMarkAnalyzer>,
): DiscoveryCandidateVerificationResult["verificationStatus"] {
  if (!policyAllowed) return "skipped_by_policy";
  switch (bridge.mockScenario) {
    case "valid_tancmark_id_match":
      return "verified_by_tancmark_mock";
    case "wrong_tancmark_id":
      return "wrong_id_mock";
    case "no_tancmark_id":
      return "no_id_mock";
    case "partial_candidate_support":
      return "partial_support_mock";
    case "unreadable_media":
      return "unreadable_mock";
    case "unsupported_media":
      return "unsupported_media_mock";
    case "blocked_private_or_login_required":
    case "skipped_by_policy":
      return "skipped_by_policy";
  }
}

export function runCandidateVerificationMock(input: {
  job: DiscoveryJobRecord;
  plan: DiscoveryCandidateVerificationPlan;
}): {
  run: DiscoveryCandidateVerificationRun;
  results: DiscoveryCandidateVerificationResult[];
  policyLogs: DiscoveryCandidateVerificationPolicyLog[];
  summary: DiscoveryCandidateVerificationSummary;
} {
  const createdAt = now();
  const runId = idFor("candidate_run", [input.job.id, input.plan.id, input.plan.selectedCandidateCount]);
  const builtResults: DiscoveryCandidateVerificationResult[] = [];
  const builtLogs: DiscoveryCandidateVerificationPolicyLog[] = [];

  for (const candidate of input.plan.selectedCandidatesJson.slice(0, input.plan.maxAutoVerificationCandidates)) {
    const policyDecision = evaluateCandidateVerificationPolicy(candidate);
    const log = buildCandidateVerificationPolicyLog({
      runId,
      candidate,
      decision: policyDecision,
    });
    builtLogs.push(log);
    const bridge = runMockExistingTancMarkAnalyzer({
      candidate,
      expectedDocId: input.job.docId ?? null,
      expectedClientId: input.job.clientId,
    });
    const verificationStatus = statusFor(policyDecision.policyAllowed, bridge);
    builtResults.push({
      id: idFor("candidate_verification", [runId, candidate.resultId, verificationStatus]),
      runId,
      jobId: input.job.id,
      candidateResultId: candidate.resultId,
      url: candidate.url,
      platform: candidate.platform,
      verificationStatus,
      mockScenario: policyDecision.policyAllowed ? bridge.mockScenario : "skipped_by_policy",
      tancmarkIdRead: policyDecision.policyAllowed ? bridge.tancmarkIdRead : null,
      matchedDocId: policyDecision.policyAllowed ? bridge.matchedDocId : null,
      matchedClientId: policyDecision.policyAllowed ? bridge.matchedClientId : null,
      idMatch: policyDecision.policyAllowed ? bridge.idMatch : false,
      matchingBits: policyDecision.policyAllowed ? bridge.matchingBits : 0,
      supportPercent: policyDecision.policyAllowed ? bridge.supportPercent : 0,
      analyzerDecisionSource: "mock_existing_tancmark_analyzer",
      discoveryDecisionRole: "discovery_records_only_no_vault_no_confirmed",
      canOpenVaultByDiscovery: false,
      supportOnly: true,
      policyAllowed: policyDecision.policyAllowed,
      policyBlockReason: policyDecision.policyBlockReason,
      canOpenVault: false,
      confirmed: false,
      final: false,
      createdAt: now(),
    });
  }

  const run: DiscoveryCandidateVerificationRun = {
    id: runId,
    jobId: input.job.id,
    planId: input.plan.id,
    runMode: "mock_only",
    status: "completed",
    candidateCount: builtResults.length,
    verifiedCandidateCount: builtResults.filter(
      (result) => result.verificationStatus === "verified_by_tancmark_mock",
    ).length,
    wrongIdCount: builtResults.filter((result) => result.verificationStatus === "wrong_id_mock").length,
    noIdCount: builtResults.filter((result) => result.verificationStatus === "no_id_mock").length,
    partialSupportCount: builtResults.filter(
      (result) => result.verificationStatus === "partial_support_mock",
    ).length,
    skippedByPolicyCount: builtResults.filter(
      (result) => result.verificationStatus === "skipped_by_policy",
    ).length,
    failedCount: builtResults.filter(
      (result) =>
        result.verificationStatus === "failed_mock" ||
        result.verificationStatus === "unreadable_mock" ||
        result.verificationStatus === "unsupported_media_mock",
    ).length,
    realFetchEnabled: false,
    realAnalyzeEnabled: false,
    supportOnly: true,
    decisionRole: "discovery_records_only_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    createdAt,
    completedAt: now(),
  };
  const summary = buildCandidateVerificationSummary({
    jobId: input.job.id,
    run,
    results: builtResults,
  });
  runs.set(input.job.id, run);
  results.set(input.job.id, builtResults);
  policyLogs.set(input.job.id, builtLogs);
  summaries.set(input.job.id, summary);
  return { run, results: builtResults, policyLogs: builtLogs, summary };
}

export function getCandidateVerificationRun(jobId: string): DiscoveryCandidateVerificationRun | null {
  return runs.get(jobId) ?? null;
}

export function getCandidateVerificationResults(jobId: string): DiscoveryCandidateVerificationResult[] {
  return [...(results.get(jobId) ?? [])];
}

export function getCandidateVerificationPolicyLogs(jobId: string): DiscoveryCandidateVerificationPolicyLog[] {
  return [...(policyLogs.get(jobId) ?? [])];
}

export function getCandidateVerificationSummary(jobId: string): DiscoveryCandidateVerificationSummary | null {
  return summaries.get(jobId) ?? null;
}

export function resetCandidateVerificationRunsForTests(): void {
  runs.clear();
  results.clear();
  policyLogs.clear();
  summaries.clear();
}
