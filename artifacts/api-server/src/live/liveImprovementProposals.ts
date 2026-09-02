import {
  LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE,
  type LiveImprovementRiskLevel,
} from "./liveHumanApprovalPolicy";
import { listLiveLearningRecords, seedLiveLearningMemoryForMock, type LiveLearningRecord } from "./liveLearningMemory";

export const LIVE_IMPROVEMENT_PROPOSAL_DECISION_ROLE =
  "live_improvement_proposal_only_no_vault_no_confirmed" as const;

export interface LiveImprovementProposal {
  proposalId: string;
  learnedFrom: string[];
  proposedChange: string;
  riskLevel: LiveImprovementRiskLevel;
  affectedFiles: string[];
  isolatedTestPlan: string[];
  rollbackPlan: string[];
  humanApprovalRequired: true;
  approvalPhraseRequired: typeof LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE;
  approvalReceived: false;
  applied: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_IMPROVEMENT_PROPOSAL_DECISION_ROLE;
}

export interface LiveImprovementProposalSummary {
  status: "proposal_preview_only";
  recommendations: LiveImprovementProposal[];
  autoApply: false;
  humanApprovalRequired: true;
  approvalPhraseRequired: typeof LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_IMPROVEMENT_PROPOSAL_DECISION_ROLE;
}

export function buildLiveImprovementProposals(records = ensureRecords()): LiveImprovementProposalSummary {
  return {
    status: "proposal_preview_only",
    recommendations: [
      proposal("live-proposal-custom-rtmp-first", records, "Test custom RTMP before YouTube.", "low", [
        "runtime/validation/live_custom_rtmp_lab_future.mjs",
      ]),
      proposal(
        "live-proposal-ats-hit-miss-first",
        records,
        "Measure ATS cache hit/miss before production routing.",
        "medium",
        ["artifacts/api-server/src/live/liveAtsDeploymentPlan.ts"],
      ),
      proposal(
        "live-proposal-provider-docs-before-retry",
        records,
        "Do not retry failed provider config until provider docs and safety gate are checked.",
        "low",
        ["artifacts/api-server/src/live/liveProviderAdapter.ts"],
      ),
    ],
    autoApply: false,
    humanApprovalRequired: true,
    approvalPhraseRequired: LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_IMPROVEMENT_PROPOSAL_DECISION_ROLE,
  };
}

function ensureRecords(): LiveLearningRecord[] {
  const existing = listLiveLearningRecords();
  return existing.length > 0 ? existing : seedLiveLearningMemoryForMock();
}

function proposal(
  proposalId: string,
  records: LiveLearningRecord[],
  proposedChange: string,
  riskLevel: LiveImprovementRiskLevel,
  affectedFiles: string[],
): LiveImprovementProposal {
  return {
    proposalId,
    learnedFrom: records.map((record) => `${record.signalType}: ${record.observedResult}`),
    proposedChange,
    riskLevel,
    affectedFiles,
    isolatedTestPlan: [
      "Run only mock/contract tests.",
      "Do not start real live broadcast.",
      "Do not call real provider APIs.",
      "Verify VAULT/confirmed/final remain false for support-only signals.",
    ],
    rollbackPlan: [
      "Revert the isolated helper or config patch if tests fail.",
      "Keep previous mock route behavior unchanged.",
      "Report failure without auto-deploying anything.",
    ],
    humanApprovalRequired: true,
    approvalPhraseRequired: LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE,
    approvalReceived: false,
    applied: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_IMPROVEMENT_PROPOSAL_DECISION_ROLE,
  };
}
