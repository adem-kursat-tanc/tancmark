import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModule,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory.js";
import {
  createProposalsFromLearningRecommendations,
  validateHumanApprovedImprovementProposal,
  type HumanApprovedImprovementProposal,
} from "../lib/humanApprovedImprovementProposal.js";
import type {
  DnaThreeTaskAdvisoryResult,
  DnaThreeTaskModule,
} from "./dnaThreeTaskAdvisory.js";

export const DNA_THREE_TASK_LEARNING_BRIDGE_VERSION =
  "dna-three-task-learning-bridge-v0.1" as const;
export const DNA_THREE_TASK_LEARNING_DECISION_ROLE =
  "learning_record_only_no_vault_no_confirmed" as const;

export type DnaThreeTaskLearningTaskType =
  | "placement_advisory"
  | "seal_map"
  | "search_hint";

export interface DnaThreeTaskObservedResult {
  attackType?: string | null | undefined;
  success?: boolean | undefined;
  failureReason?: string | null | undefined;
  confidence?: number | undefined;
  observedResult?: string | null | undefined;
}

export interface DnaThreeTaskLearningBridgeInput {
  result: DnaThreeTaskAdvisoryResult;
  attackType?: string | null | undefined;
  observations?:
    | Partial<Record<DnaThreeTaskLearningTaskType, DnaThreeTaskObservedResult>>
    | undefined;
}

export interface DnaThreeTaskLearningRecord {
  module: DnaThreeTaskModule;
  taskType: DnaThreeTaskLearningTaskType;
  recommendation: string;
  observedResult: string;
  attackType: string;
  success: boolean;
  failureReason: string | null;
  confidence: number;
  humanApprovalRequired: true;
  autoApply: false;
  decisionRole: typeof DNA_THREE_TASK_LEARNING_DECISION_ROLE;
}

export interface DnaThreeTaskLearningBridgeSafety {
  learningRecordOnly: true;
  humanApprovalRequired: true;
  autoApply: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  canChangePlacement: false;
  canChangeThresholds: false;
  canChangeOwnershipBlock: false;
  productRouteChanged: false;
}

export interface DnaThreeTaskLearningBridgeResult {
  bridgeVersion: typeof DNA_THREE_TASK_LEARNING_BRIDGE_VERSION;
  decisionRole: typeof DNA_THREE_TASK_LEARNING_DECISION_ROLE;
  module: DnaThreeTaskModule;
  taskRecords: DnaThreeTaskLearningRecord[];
  learningRecords: LearningTestRecord[];
  learningMemory: LearningDnaMemory;
  humanApprovedProposals: HumanApprovedImprovementProposal[];
  proposalValidation: Array<{
    proposalKey: string;
    ok: boolean;
    violations: string[];
  }>;
  safety: DnaThreeTaskLearningBridgeSafety;
}

export function createDnaThreeTaskLearningBridge(
  input: DnaThreeTaskLearningBridgeInput,
): DnaThreeTaskLearningBridgeResult {
  const taskRecords = buildTaskRecords(input);
  const learningRecords = taskRecords.map((record) =>
    taskRecordToLearningRecord(record),
  );
  const learningMemory = buildLearningDnaMemory(learningRecords);
  const humanApprovedProposals = createProposalsFromLearningRecommendations(
    learningMemory.recommendations,
  );
  const proposalValidation = humanApprovedProposals.map((proposal) => ({
    proposalKey: proposal.proposalKey,
    ...validateHumanApprovedImprovementProposal(proposal),
  }));

  return {
    bridgeVersion: DNA_THREE_TASK_LEARNING_BRIDGE_VERSION,
    decisionRole: DNA_THREE_TASK_LEARNING_DECISION_ROLE,
    module: input.result.module,
    taskRecords,
    learningRecords,
    learningMemory,
    humanApprovedProposals,
    proposalValidation,
    safety: bridgeSafety(),
  };
}

export function validateDnaThreeTaskLearningBridge(
  bridge: DnaThreeTaskLearningBridgeResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (bridge.decisionRole !== DNA_THREE_TASK_LEARNING_DECISION_ROLE) {
    violations.push("decisionRole_not_learning_record_only");
  }
  if (bridge.taskRecords.length !== 3) violations.push("taskRecord_count_not_3");
  if (bridge.learningRecords.length !== 3) {
    violations.push("learningRecord_count_not_3");
  }
  if (bridge.learningMemory.recordCount !== bridge.learningRecords.length) {
    violations.push("learningMemory_recordCount_mismatch");
  }
  if (bridge.learningMemory.automation.autoApplyEnabled !== false) {
    violations.push("learningMemory_autoApplyEnabled_not_false");
  }
  if (bridge.learningMemory.automation.requiresHumanApproval !== true) {
    violations.push("learningMemory_requiresHumanApproval_not_true");
  }
  if (bridge.learningMemory.safety.canOpenVault !== false) {
    violations.push("learningMemory_canOpenVault_not_false");
  }
  if (bridge.learningMemory.safety.confirmed !== false) {
    violations.push("learningMemory_confirmed_not_false");
  }
  if (bridge.learningMemory.safety.recommendationsAutoApplied !== false) {
    violations.push("learningMemory_recommendationsAutoApplied_not_false");
  }
  for (const record of bridge.taskRecords) {
    if (record.humanApprovalRequired !== true) {
      violations.push(`${record.taskType}:humanApprovalRequired_not_true`);
    }
    if (record.autoApply !== false) {
      violations.push(`${record.taskType}:autoApply_not_false`);
    }
    if (record.decisionRole !== DNA_THREE_TASK_LEARNING_DECISION_ROLE) {
      violations.push(`${record.taskType}:decisionRole_not_record_only`);
    }
  }
  for (const record of bridge.learningRecords) {
    if (record.finalDecision !== LEARNING_ADVISORY_FINAL_DECISION) {
      violations.push(`${record.recordId}:finalDecision_not_advisory`);
    }
    if (record.falseVault !== false) {
      violations.push(`${record.recordId}:falseVault_not_false`);
    }
    if (record.idlessVault !== false) {
      violations.push(`${record.recordId}:idlessVault_not_false`);
    }
    if (record.modules.some((module) => module.confirmed !== false)) {
      violations.push(`${record.recordId}:module_confirmed_not_false`);
    }
  }
  for (const validation of bridge.proposalValidation) {
    if (!validation.ok) {
      violations.push(
        `${validation.proposalKey}:proposal_invalid:${validation.violations.join(",")}`,
      );
    }
  }
  return {
    ok: violations.length === 0,
    violations,
  };
}

function buildTaskRecords(
  input: DnaThreeTaskLearningBridgeInput,
): DnaThreeTaskLearningRecord[] {
  return [
    buildTaskRecord(input, "placement_advisory"),
    buildTaskRecord(input, "seal_map"),
    buildTaskRecord(input, "search_hint"),
  ];
}

function buildTaskRecord(
  input: DnaThreeTaskLearningBridgeInput,
  taskType: DnaThreeTaskLearningTaskType,
): DnaThreeTaskLearningRecord {
  const observed = input.observations?.[taskType];
  const computed = defaultObservedResult(input.result, taskType);
  const success = observed?.success ?? computed.success;
  const failureReason =
    observed?.failureReason ?? (success ? null : computed.failureReason);
  return {
    module: input.result.module,
    taskType,
    recommendation: recommendationFor(input.result.module, taskType, success),
    observedResult:
      observed?.observedResult ?? observedResultFor(input.result, taskType, success),
    attackType: cleanString(observed?.attackType ?? input.attackType, "lab_baseline"),
    success,
    failureReason: failureReason ? cleanString(failureReason, "unknown") : null,
    confidence: clamp01(observed?.confidence ?? computed.confidence),
    humanApprovalRequired: true,
    autoApply: false,
    decisionRole: DNA_THREE_TASK_LEARNING_DECISION_ROLE,
  };
}

function taskRecordToLearningRecord(
  record: DnaThreeTaskLearningRecord,
): LearningTestRecord {
  return {
    recordId: `dna-three-task-${record.module}-${record.taskType}`,
    scenario: `dna_three_task_${record.module}_${record.taskType}_${record.attackType}`,
    fileKind: record.module,
    expectedOutcome: "DNA_THREE_TASK_LEARNING_RECORD_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: false,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules: [moduleObservation(record)],
    note: [
      `taskType=${record.taskType}`,
      `success=${String(record.success)}`,
      `confidence=${record.confidence.toFixed(3)}`,
      `humanApprovalRequired=${String(record.humanApprovalRequired)}`,
      `autoApply=${String(record.autoApply)}`,
      `decisionRole=${record.decisionRole}`,
      `observedResult=${record.observedResult}`,
      record.failureReason ? `failureReason=${record.failureReason}` : null,
    ].filter((item): item is string => item !== null).join("; "),
  };
}

function moduleObservation(
  record: DnaThreeTaskLearningRecord,
): LearningModuleObservation {
  return {
    module: record.module as LearningModule,
    active: true,
    sealed: record.taskType !== "search_hint",
    idRead: false,
    candidateSupport: record.success,
    confirmed: false,
    rescued: record.success && record.attackType !== "lab_baseline",
    failed: !record.success,
    note: record.recommendation,
  };
}

function defaultObservedResult(
  result: DnaThreeTaskAdvisoryResult,
  taskType: DnaThreeTaskLearningTaskType,
): { success: boolean; failureReason: string | null; confidence: number } {
  if (taskType === "placement_advisory") {
    const count = placementRecommendationCount(result);
    return {
      success: count > 0,
      failureReason: count > 0 ? null : "no_placement_recommendation",
      confidence: Math.min(1, count / 3),
    };
  }
  if (taskType === "seal_map") {
    return {
      success: result.sealMapCompleteness.complete,
      failureReason: result.sealMapCompleteness.complete
        ? null
        : `missing:${result.sealMapCompleteness.missing.join(",")}`,
      confidence: result.sealMapCompleteness.complete
        ? 1
        : clamp01(
            1 - result.sealMapCompleteness.missing.length / 6,
          ),
    };
  }
  return {
    success: result.searchHints.length > 0,
    failureReason: result.searchHints.length > 0 ? null : "no_search_hint",
    confidence: Math.min(1, result.searchHints.length / 3),
  };
}

function placementRecommendationCount(result: DnaThreeTaskAdvisoryResult) {
  const placement = result.placementAdvisory;
  if ("recommendedFrames" in placement) return placement.recommendedFrames.length;
  if ("recommendedRegions" in placement) return placement.recommendedRegions.length;
  if ("recommendedWindows" in placement) return placement.recommendedWindows.length;
  return placement.recommendedSpans.length + placement.recommendedLayers.length;
}

function observedResultFor(
  result: DnaThreeTaskAdvisoryResult,
  taskType: DnaThreeTaskLearningTaskType,
  success: boolean,
) {
  if (taskType === "placement_advisory") {
    return success
      ? `placement_advisory_count=${placementRecommendationCount(result)}`
      : "placement_advisory_missing";
  }
  if (taskType === "seal_map") {
    return success
      ? `seal_map_complete layers=${result.sealMapCompleteness.layerCount} regions=${result.sealMapCompleteness.regionCount}`
      : `seal_map_incomplete missing=${result.sealMapCompleteness.missing.join(",")}`;
  }
  return success
    ? `search_hint_count=${result.searchHints.length}`
    : "search_hint_missing";
}

function recommendationFor(
  module: DnaThreeTaskModule,
  taskType: DnaThreeTaskLearningTaskType,
  success: boolean,
) {
  const prefix = `${module} ${taskType}`;
  return success
    ? `${prefix} kaydi ogrenme hafizasina advisory-only sinyal olarak yazilsin; insan onayi olmadan davranis degismesin.`
    : `${prefix} eksigi insan incelemesine aday olsun; otomatik uygulama, threshold veya VAULT kapisi degismesin.`;
}

function bridgeSafety(): DnaThreeTaskLearningBridgeSafety {
  return {
    learningRecordOnly: true,
    humanApprovalRequired: true,
    autoApply: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    canChangePlacement: false,
    canChangeThresholds: false,
    canChangeOwnershipBlock: false,
    productRouteChanged: false,
  };
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, 160)
    : fallback;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
