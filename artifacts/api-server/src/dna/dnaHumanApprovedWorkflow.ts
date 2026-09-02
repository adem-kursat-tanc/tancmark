import {
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModule,
  type LearningTestRecord,
} from "../lib/learningDnaMemory.js";
import {
  createProposalsFromLearningRecommendations,
  validateHumanApprovedImprovementProposal,
  type HumanApprovedImprovementProposal,
} from "../lib/humanApprovedImprovementProposal.js";

export const DNA_HUMAN_APPROVED_WORKFLOW_VERSION =
  "dna-human-approved-workflow-v0.1" as const;
export const DNA_HUMAN_APPROVED_WORKFLOW_DECISION_ROLE =
  "human_approved_safe_improvement_no_vault_no_confirmed" as const;
export const DNA_SAFE_IMPROVEMENT_APPROVAL_TEXT =
  "APPROVE_DNA_SAFE_IMPROVEMENT" as const;

export type DnaWorkflowOperationType =
  | "append_text"
  | "replace_text"
  | "record_advisory";

export interface DnaWorkflowSafeOperation {
  type: DnaWorkflowOperationType;
  filePath: string;
  description: string;
  find?: string | null;
  replace?: string | null;
  text?: string | null;
}

export interface DnaWorkflowSafetyTestResult {
  name: DnaWorkflowRequiredTestName;
  passed: boolean;
  note?: string | null;
}

export type DnaWorkflowRequiredTestName =
  | "module_contract"
  | "dna_full_module_integration_contract"
  | "dna_active_assist_no_decision_change_contract"
  | "wrong_id_security"
  | "unsealed_idless_security"
  | "candidate_support_no_vault"
  | "api_typecheck"
  | "root_typecheck"
  | "git_diff_check";

export interface DnaHumanApprovedWorkflowInput {
  records: LearningTestRecord[];
  proposalOverride?: HumanApprovedImprovementProposal | undefined;
  selectedProposalKey?: string | undefined;
  humanApprovalText?: string | null | undefined;
  requestedBy?: string | null | undefined;
  operations?: DnaWorkflowSafeOperation[] | undefined;
  testResults?: DnaWorkflowSafetyTestResult[] | undefined;
  simulateApplyFailure?: boolean | undefined;
}

export interface DnaHumanApprovedWorkflowSafety {
  confirmedChanged: false;
  canOpenVaultChanged: false;
  vaultEligibleChanged: false;
  finalChanged: false;
  thresholdChanged: false;
  ownershipChanged: false;
  strongModeChanged: false;
  sealCoreChanged: false;
  registrySecurityChanged: false;
  candidateSupportPromoted: false;
  dnaPredictedId: false;
  dnaCompletedMissingId: false;
  dnaGeneratedNonexistentId: false;
  dnaStoredOriginalContent: false;
  highRiskApplied: false;
  forbiddenApplied: false;
  autoApply: false;
  humanApprovalRequired: true;
  remotePushAllowed: false;
}

export interface DnaHumanApprovedWorkflowResult {
  version: typeof DNA_HUMAN_APPROVED_WORKFLOW_VERSION;
  decisionRole: typeof DNA_HUMAN_APPROVED_WORKFLOW_DECISION_ROLE;
  learnedFrom: string[];
  proposedChange: string;
  expectedBenefit: string;
  affectedModules: LearningModule[];
  affectedFiles: string[];
  riskLevel: HumanApprovedImprovementProposal["riskLevel"] | "none";
  forbiddenTouchpoints: HumanApprovedImprovementProposal["forbiddenTouchpoints"];
  proposal: HumanApprovedImprovementProposal | null;
  proposalPreview: {
    produced: boolean;
    proposalCount: number;
    requiresHumanApproval: true;
    patchDraftAllowed: boolean;
  };
  humanApprovalRequired: true;
  requiredApprovalText: typeof DNA_SAFE_IMPROVEMENT_APPROVAL_TEXT;
  humanApprovalReceived: boolean;
  approvalRejectedReason: string | null;
  applied: boolean;
  applyAttempted: boolean;
  applyBlockedReasons: string[];
  changedFiles: string[];
  operationsAccepted: number;
  testsPassed: boolean;
  testResults: DnaWorkflowSafetyTestResult[];
  missingRequiredTests: DnaWorkflowRequiredTestName[];
  rollbackAvailable: boolean;
  rollbackExecuted: boolean;
  rollbackPlan: string[];
  resultReport: string;
  learningMemory: Pick<
    LearningDnaMemory,
    | "status"
    | "recordCount"
    | "lessons"
    | "recommendations"
    | "automation"
    | "safety"
  >;
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
  final: false;
  autoApply: false;
  humanApprovalRequiredForApply: true;
  safety: DnaHumanApprovedWorkflowSafety;
}

export const DNA_HUMAN_APPROVED_WORKFLOW_REQUIRED_TESTS: DnaWorkflowRequiredTestName[] = [
  "module_contract",
  "dna_full_module_integration_contract",
  "dna_active_assist_no_decision_change_contract",
  "wrong_id_security",
  "unsealed_idless_security",
  "candidate_support_no_vault",
  "api_typecheck",
  "root_typecheck",
  "git_diff_check",
];

const SAFE_APPLY_PATH_PREFIXES = [
  "docs/",
  "runtime/validation/",
  "runtime/learning-proposal-apply-validation/",
  "scripts/validation/",
] as const;

const SAFE_APPLY_EXACT_PATHS = [
  "artifacts/api-server/src/lib/humanApprovedImprovementProposal.ts",
  "artifacts/api-server/src/lib/learningDnaMemory.ts",
  "artifacts/api-server/src/dna/visualLearningAdapter.ts",
  "artifacts/dashboard-ui/src/pages/learning-summary.tsx",
] as const;

const BLOCKED_PATH_NEEDLES = [
  "/video/",
  "/audio/",
  "/routes/audiolab",
  "/routes/visuallab",
  "/routes/secure",
  "vault",
  "ownership",
  "preseal",
  "pre-seal",
  "seal",
  "watermark",
  "cloak",
  "analyze",
  "decode",
  "encodevideo",
  "c2pa",
  "ecc",
  "threshold",
  "confirmed",
  "final",
  "strong",
  "decision",
  "canopenvault",
  "vaulteligible",
] as const;

export function runDnaHumanApprovedWorkflow(
  input: DnaHumanApprovedWorkflowInput,
): DnaHumanApprovedWorkflowResult {
  const learningMemory = buildLearningDnaMemory(input.records);
  const proposals =
    input.proposalOverride !== undefined
      ? [input.proposalOverride]
      : createProposalsFromLearningRecommendations(learningMemory.recommendations);
  const proposal =
    selectProposal(proposals, input.selectedProposalKey) ?? proposals[0] ?? null;
  const validation = proposal
    ? validateHumanApprovedImprovementProposal(proposal)
    : { ok: false, violations: ["proposal_missing"] };
  const approval = evaluateApproval(input.humanApprovalText);
  const testEvaluation = evaluateTests(input.testResults ?? []);
  const operationValidation = validateOperations(input.operations ?? []);
  const blockedReasons = [
    ...validation.violations.map((violation) => `proposal_${violation}`),
    ...approval.blockedReasons,
    ...operationValidation.blockedReasons,
    ...riskBlockedReasons(proposal),
  ];
  const baseCanApply =
    proposal !== null &&
    validation.ok &&
    approval.received &&
    operationValidation.safe &&
    (proposal.riskLevel === "low" || proposal.riskLevel === "medium") &&
    proposal.patchDraftAllowed === true &&
    proposal.forbiddenTouchpoints.length === 0;
  const applyAttempted = baseCanApply && blockedReasons.length === 0;
  const rawApplied =
    applyAttempted &&
    input.simulateApplyFailure !== true &&
    operationValidation.changedFiles.length > 0;
  const rollbackExecuted = rawApplied && !testEvaluation.testsPassed;
  const applied = rawApplied && testEvaluation.testsPassed && !rollbackExecuted;
  const rollbackAvailable =
    operationValidation.changedFiles.length > 0 || (proposal?.rollbackPlan.length ?? 0) > 0;
  const applyBlockedReasons = applyAttempted
    ? testEvaluation.testsPassed
      ? []
      : ["post_apply_tests_failed"]
    : unique(blockedReasons);
  const learnedFrom = buildLearnedFrom(learningMemory);
  const proposedChange = proposal?.proposedChange ?? "No proposal produced.";
  const expectedBenefit = proposal?.benefit ?? "No benefit estimated.";
  const affectedModules = proposal?.affectedModules ?? [];
  const affectedFiles = proposal?.affectedFiles ?? [];
  const rollbackPlan = buildRollbackPlan({
    proposal,
    changedFiles: operationValidation.changedFiles,
    rollbackExecuted,
  });

  return {
    version: DNA_HUMAN_APPROVED_WORKFLOW_VERSION,
    decisionRole: DNA_HUMAN_APPROVED_WORKFLOW_DECISION_ROLE,
    learnedFrom,
    proposedChange,
    expectedBenefit,
    affectedModules,
    affectedFiles,
    riskLevel: proposal?.riskLevel ?? "none",
    forbiddenTouchpoints: proposal?.forbiddenTouchpoints ?? [],
    proposal,
    proposalPreview: {
      produced: proposal !== null,
      proposalCount: proposals.length,
      requiresHumanApproval: true,
      patchDraftAllowed: proposal?.patchDraftAllowed === true,
    },
    humanApprovalRequired: true,
    requiredApprovalText: DNA_SAFE_IMPROVEMENT_APPROVAL_TEXT,
    humanApprovalReceived: approval.received,
    approvalRejectedReason: approval.rejectionReason,
    applied,
    applyAttempted,
    applyBlockedReasons,
    changedFiles: applied ? operationValidation.changedFiles : [],
    operationsAccepted: applied ? operationValidation.operationCount : 0,
    testsPassed: testEvaluation.testsPassed,
    testResults: input.testResults ?? [],
    missingRequiredTests: testEvaluation.missingRequiredTests,
    rollbackAvailable,
    rollbackExecuted,
    rollbackPlan,
    resultReport: buildResultReport({
      learnedFrom,
      proposedChange,
      expectedBenefit,
      riskLevel: proposal?.riskLevel ?? "none",
      approvalReceived: approval.received,
      applied,
      testsPassed: testEvaluation.testsPassed,
      rollbackExecuted,
      blockedReasons: applyBlockedReasons,
    }),
    learningMemory: {
      status: learningMemory.status,
      recordCount: learningMemory.recordCount,
      lessons: learningMemory.lessons,
      recommendations: learningMemory.recommendations,
      automation: learningMemory.automation,
      safety: learningMemory.safety,
    },
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
    final: false,
    autoApply: false,
    humanApprovalRequiredForApply: true,
    safety: workflowSafety(),
  };
}

export function validateDnaHumanApprovedWorkflowResult(
  result: DnaHumanApprovedWorkflowResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (result.decisionRole !== DNA_HUMAN_APPROVED_WORKFLOW_DECISION_ROLE) {
    violations.push("decisionRole_not_human_approved_safe_improvement");
  }
  if (result.confirmed !== false) violations.push("confirmed_not_false");
  if (result.canOpenVault !== false) violations.push("canOpenVault_not_false");
  if (result.vaultEligible !== false) violations.push("vaultEligible_not_false");
  if (result.final !== false) violations.push("final_not_false");
  if (result.autoApply !== false) violations.push("autoApply_not_false");
  if (result.humanApprovalRequired !== true) {
    violations.push("humanApprovalRequired_not_true");
  }
  if (result.humanApprovalRequiredForApply !== true) {
    violations.push("humanApprovalRequiredForApply_not_true");
  }
  if (result.applied && !result.humanApprovalReceived) {
    violations.push("applied_without_human_approval");
  }
  if (result.applied && !result.testsPassed) {
    violations.push("applied_without_tests_passed");
  }
  if (result.applied && result.riskLevel !== "low" && result.riskLevel !== "medium") {
    violations.push("applied_non_low_medium_risk");
  }
  if (result.applied && result.forbiddenTouchpoints.length > 0) {
    violations.push("applied_forbidden_touchpoint");
  }
  if (result.safety.confirmedChanged !== false) {
    violations.push("confirmedChanged_not_false");
  }
  if (result.safety.canOpenVaultChanged !== false) {
    violations.push("canOpenVaultChanged_not_false");
  }
  if (result.safety.vaultEligibleChanged !== false) {
    violations.push("vaultEligibleChanged_not_false");
  }
  if (result.safety.finalChanged !== false) {
    violations.push("finalChanged_not_false");
  }
  if (result.safety.thresholdChanged !== false) {
    violations.push("thresholdChanged_not_false");
  }
  if (result.safety.ownershipChanged !== false) {
    violations.push("ownershipChanged_not_false");
  }
  if (result.safety.strongModeChanged !== false) {
    violations.push("strongModeChanged_not_false");
  }
  if (result.safety.sealCoreChanged !== false) {
    violations.push("sealCoreChanged_not_false");
  }
  if (result.safety.candidateSupportPromoted !== false) {
    violations.push("candidateSupportPromoted_not_false");
  }
  if (result.safety.dnaPredictedId !== false) {
    violations.push("dnaPredictedId_not_false");
  }
  if (result.safety.dnaCompletedMissingId !== false) {
    violations.push("dnaCompletedMissingId_not_false");
  }
  if (result.safety.dnaGeneratedNonexistentId !== false) {
    violations.push("dnaGeneratedNonexistentId_not_false");
  }
  if (result.safety.dnaStoredOriginalContent !== false) {
    violations.push("dnaStoredOriginalContent_not_false");
  }
  if (result.safety.highRiskApplied !== false) {
    violations.push("highRiskApplied_not_false");
  }
  if (result.safety.forbiddenApplied !== false) {
    violations.push("forbiddenApplied_not_false");
  }
  if (result.safety.autoApply !== false) {
    violations.push("safety_autoApply_not_false");
  }
  if (result.safety.humanApprovalRequired !== true) {
    violations.push("safety_humanApprovalRequired_not_true");
  }
  return {
    ok: violations.length === 0,
    violations,
  };
}

function selectProposal(
  proposals: readonly HumanApprovedImprovementProposal[],
  selectedProposalKey: string | undefined,
): HumanApprovedImprovementProposal | null {
  if (!selectedProposalKey) return null;
  return proposals.find((proposal) => proposal.proposalKey === selectedProposalKey) ?? null;
}

function evaluateApproval(text: string | null | undefined): {
  received: boolean;
  rejectionReason: string | null;
  blockedReasons: string[];
} {
  if (text === DNA_SAFE_IMPROVEMENT_APPROVAL_TEXT) {
    return {
      received: true,
      rejectionReason: null,
      blockedReasons: [],
    };
  }
  const rejectionReason =
    text === undefined || text === null || text.trim() === ""
      ? "human_approval_missing"
      : "human_approval_text_mismatch";
  return {
    received: false,
    rejectionReason,
    blockedReasons: [rejectionReason],
  };
}

function riskBlockedReasons(
  proposal: HumanApprovedImprovementProposal | null,
): string[] {
  if (!proposal) return ["proposal_missing"];
  const reasons: string[] = [];
  if (proposal.riskLevel === "high") reasons.push("high_risk_manual_review_required");
  if (proposal.riskLevel === "forbidden") reasons.push("forbidden_proposal");
  if (!proposal.patchDraftAllowed) reasons.push("patch_draft_not_allowed");
  if (proposal.forbiddenTouchpoints.length > 0) {
    reasons.push("forbidden_touchpoints_present");
  }
  if (proposal.patchApplied !== false) reasons.push("patch_already_applied");
  if (proposal.commitAllowed !== false) reasons.push("commit_allowed_must_be_false");
  if (proposal.remotePushAllowed !== false) reasons.push("remote_push_allowed_must_be_false");
  if (proposal.autoApply !== false) reasons.push("auto_apply_must_be_false");
  return reasons;
}

function normalizeRepoPath(value: string): string | null {
  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("\0")) return null;
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.includes("/./")
  ) {
    return null;
  }
  return normalized;
}

function validateOperations(operations: readonly DnaWorkflowSafeOperation[]): {
  safe: boolean;
  blockedReasons: string[];
  changedFiles: string[];
  operationCount: number;
} {
  const blockedReasons = new Set<string>();
  const changedFiles = new Set<string>();
  if (operations.length === 0) {
    blockedReasons.add("safe_operations_required");
  }
  for (const operation of operations) {
    const repoPath = normalizeRepoPath(operation.filePath);
    if (!repoPath) {
      blockedReasons.add("unsafe_operation_path");
      continue;
    }
    if (!isAllowedApplyPath(repoPath)) {
      blockedReasons.add("operation_file_not_allowlisted");
    }
    if (isBlockedApplyPath(repoPath)) {
      blockedReasons.add("operation_file_blocklisted");
    }
    if (operation.type === "replace_text") {
      if (!operation.find || operation.replace === undefined || operation.replace === null) {
        blockedReasons.add("replace_text_requires_find_and_replace");
      }
    }
    if (operation.type === "append_text" && !operation.text) {
      blockedReasons.add("append_text_requires_text");
    }
    if (operation.type === "record_advisory" && !operation.description) {
      blockedReasons.add("record_advisory_requires_description");
    }
    changedFiles.add(repoPath);
  }
  return {
    safe: blockedReasons.size === 0,
    blockedReasons: Array.from(blockedReasons),
    changedFiles: Array.from(changedFiles),
    operationCount: operations.length,
  };
}

function isAllowedApplyPath(repoPath: string): boolean {
  return (
    SAFE_APPLY_PATH_PREFIXES.some((prefix) => repoPath.startsWith(prefix)) ||
    SAFE_APPLY_EXACT_PATHS.includes(repoPath as (typeof SAFE_APPLY_EXACT_PATHS)[number])
  );
}

function isBlockedApplyPath(repoPath: string): boolean {
  const lowered = repoPath.toLowerCase();
  return BLOCKED_PATH_NEEDLES.some((needle) => lowered.includes(needle));
}

function evaluateTests(testResults: readonly DnaWorkflowSafetyTestResult[]): {
  testsPassed: boolean;
  missingRequiredTests: DnaWorkflowRequiredTestName[];
} {
  const results = new Map(testResults.map((result) => [result.name, result.passed]));
  const missingRequiredTests = DNA_HUMAN_APPROVED_WORKFLOW_REQUIRED_TESTS.filter(
    (name) => !results.has(name),
  );
  const testsPassed =
    missingRequiredTests.length === 0 &&
    DNA_HUMAN_APPROVED_WORKFLOW_REQUIRED_TESTS.every(
      (name) => results.get(name) === true,
    );
  return {
    testsPassed,
    missingRequiredTests,
  };
}

function buildLearnedFrom(memory: LearningDnaMemory): string[] {
  return [
    ...memory.lessons,
    memory.bestWorkingModule
      ? `Best working module observed: ${memory.bestWorkingModule}.`
      : null,
    memory.weakModule ? `Weak module observed: ${memory.weakModule}.` : null,
  ].filter((item): item is string => item !== null);
}

function buildRollbackPlan(input: {
  proposal: HumanApprovedImprovementProposal | null;
  changedFiles: readonly string[];
  rollbackExecuted: boolean;
}): string[] {
  return unique([
    ...(input.proposal?.rollbackPlan ?? []),
    ...input.changedFiles.map((file) => `If rejected or failed, revert only ${file}.`),
    input.rollbackExecuted
      ? "Post-apply tests failed; workflow marked rollbackExecuted=true and reports applied=false."
      : "Rollback is available for changed allowlisted files; no remote push is performed.",
  ]);
}

function buildResultReport(input: {
  learnedFrom: readonly string[];
  proposedChange: string;
  expectedBenefit: string;
  riskLevel: HumanApprovedImprovementProposal["riskLevel"] | "none";
  approvalReceived: boolean;
  applied: boolean;
  testsPassed: boolean;
  rollbackExecuted: boolean;
  blockedReasons: readonly string[];
}): string {
  return [
    "DNA human-approved workflow report.",
    `Learned: ${input.learnedFrom.slice(0, 3).join(" | ") || "No lesson."}`,
    `Proposed change: ${input.proposedChange}`,
    `Expected benefit: ${input.expectedBenefit}`,
    `Risk: ${input.riskLevel}`,
    `Human approval received: ${String(input.approvalReceived)}`,
    `Applied: ${String(input.applied)}`,
    `Tests passed: ${String(input.testsPassed)}`,
    `Rollback executed: ${String(input.rollbackExecuted)}`,
    `Blocked reasons: ${input.blockedReasons.join(",") || "none"}`,
    "Decision gates unchanged: VAULT/confirmed/final/threshold/ownership remain untouched.",
  ].join("\n");
}

function workflowSafety(): DnaHumanApprovedWorkflowSafety {
  return {
    confirmedChanged: false,
    canOpenVaultChanged: false,
    vaultEligibleChanged: false,
    finalChanged: false,
    thresholdChanged: false,
    ownershipChanged: false,
    strongModeChanged: false,
    sealCoreChanged: false,
    registrySecurityChanged: false,
    candidateSupportPromoted: false,
    dnaPredictedId: false,
    dnaCompletedMissingId: false,
    dnaGeneratedNonexistentId: false,
    dnaStoredOriginalContent: false,
    highRiskApplied: false,
    forbiddenApplied: false,
    autoApply: false,
    humanApprovalRequired: true,
    remotePushAllowed: false,
  };
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}
