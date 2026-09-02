import { createHash } from "node:crypto";
import type {
  DiscoveryCandidateVerificationCandidate,
  DiscoveryCandidateVerificationPolicyLog,
} from "./types";

export interface DiscoveryCandidateVerificationPolicy {
  runMode: "mock_only";
  realFetchEnabled: false;
  realAnalyzeEnabled: false;
  requiresPublicUrl: true;
  requiresNoLogin: true;
  requiresNoPaywall: true;
  requiresNoDrmBypass: true;
  allowsPersistentStorage: false;
  allowByteRangeOnly: true;
  temporaryFileDeletionRequired: true;
  supportOnly: true;
  decisionRole: "candidate_verification_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface CandidateVerificationPolicyDecision {
  policyAllowed: boolean;
  policyBlockReason: string | null;
  logReason: string;
}

export const CANDIDATE_VERIFICATION_POLICY: DiscoveryCandidateVerificationPolicy = {
  runMode: "mock_only",
  realFetchEnabled: false,
  realAnalyzeEnabled: false,
  requiresPublicUrl: true,
  requiresNoLogin: true,
  requiresNoPaywall: true,
  requiresNoDrmBypass: true,
  allowsPersistentStorage: false,
  allowByteRangeOnly: true,
  temporaryFileDeletionRequired: true,
  supportOnly: true,
  decisionRole: "candidate_verification_policy_no_vault_no_confirmed",
  canOpenVault: false,
  confirmed: false,
  final: false,
};

function now(): string {
  return new Date().toISOString();
}

function idFor(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function urlText(candidate: DiscoveryCandidateVerificationCandidate): string {
  return (candidate.url ?? "").toLowerCase();
}

export function evaluateCandidateVerificationPolicy(
  candidate: DiscoveryCandidateVerificationCandidate,
): CandidateVerificationPolicyDecision {
  const url = urlText(candidate);
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return {
      policyAllowed: false,
      policyBlockReason: "requires_public_open_url",
      logReason: "candidate_url_missing_or_not_public_http_url",
    };
  }
  if (url.includes("private") || url.includes("login") || url.includes("closed")) {
    return {
      policyAllowed: false,
      policyBlockReason: "private_or_login_required",
      logReason: "private_or_login_required_candidate_blocked",
    };
  }
  if (url.includes("paywall") || url.includes("drm")) {
    return {
      policyAllowed: false,
      policyBlockReason: "paywall_or_drm_blocked",
      logReason: "paywall_or_drm_candidate_blocked",
    };
  }
  return {
    policyAllowed: true,
    policyBlockReason: null,
    logReason: "policy_allowed_mock_only_no_fetch",
  };
}

export function buildCandidateVerificationPolicyLog(input: {
  runId: string;
  candidate: DiscoveryCandidateVerificationCandidate;
  decision: CandidateVerificationPolicyDecision;
}): DiscoveryCandidateVerificationPolicyLog {
  return {
    id: idFor("candidate_policy", [input.runId, input.candidate.resultId, input.decision.logReason]),
    runId: input.runId,
    candidateResultId: input.candidate.resultId,
    policyAllowed: input.decision.policyAllowed,
    requiresPublicUrl: true,
    requiresNoLogin: true,
    requiresNoPaywall: true,
    requiresNoDrmBypass: true,
    allowsPersistentStorage: false,
    realFetchAttempted: false,
    reason: input.decision.logReason,
    createdAt: now(),
  };
}

