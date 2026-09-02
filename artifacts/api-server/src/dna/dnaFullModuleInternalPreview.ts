import {
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModule,
  type LearningTestRecord,
} from "../lib/learningDnaMemory.js";
import {
  buildDnaGuidedRecoveryAdapter,
  type DnaGuidedDamageContext,
  type DnaGuidedRecoveryHint,
  type DnaGuidedRecoveryModule,
  type DnaGuidedRepairPlan,
} from "./dnaGuidedRecoveryAdapter.js";
import {
  buildDnaThreeTaskAdvisory,
  type DnaSearchHint,
  type DnaSealMapCompleteness,
  type DnaThreeTaskInput,
  type DnaThreeTaskModule,
  type DnaThreeTaskPlacementAdvisory,
} from "./dnaThreeTaskAdvisory.js";
import {
  createDnaThreeTaskLearningBridge,
  validateDnaThreeTaskLearningBridge,
  type DnaThreeTaskLearningTaskType,
} from "./dnaThreeTaskLearningBridge.js";

export const DNA_FULL_MODULE_INTERNAL_PREVIEW_VERSION =
  "dna-full-module-internal-preview-v0.1" as const;
export const DNA_FULL_MODULE_INTERNAL_PREVIEW_DECISION_ROLE =
  "dna_internal_preview_no_vault_no_confirmed" as const;
export const DNA_FULL_MODULE_LEARNING_DECISION_ROLE =
  "learning_record_only_no_vault_no_confirmed" as const;

export type DnaFullModuleInternalPreviewModule =
  | "video"
  | "image"
  | "audio"
  | "text";

export interface DnaFullModuleInternalPreviewInput {
  module: DnaFullModuleInternalPreviewModule;
  dna: unknown;
  placementContext?: DnaThreeTaskInput["placementContext"] | undefined;
  damage?: DnaGuidedDamageContext | undefined;
}

export interface DnaFullModuleLearningRecordSummary {
  recordCount: number;
  module: DnaFullModuleInternalPreviewModule;
  taskTypes: Array<DnaThreeTaskLearningTaskType | "guided_recovery">;
  recommendationCount: number;
  recoveryAttempted: boolean;
  recoverySuccess: boolean;
  humanApprovalRequired: true;
  autoApply: false;
  decisionRole: typeof DNA_FULL_MODULE_LEARNING_DECISION_ROLE;
}

export interface DnaFullModuleInternalPreviewSafety {
  productRouteChanged: false;
  encodeAnalyzeChanged: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  candidateSupportCanConfirm: false;
  dnaCanOpenVault: false;
  wrongIdCanOpenVault: false;
  idlessCanOpenVault: false;
  predictsId: false;
  predictedId: null;
  completesMissingId: false;
  generatesNonexistentId: false;
  storesOriginalContent: false;
  canChangeThresholds: false;
  canChangeOwnershipBlock: false;
  autoApply: false;
  humanApprovalRequired: true;
}

export interface DnaFullModuleInternalPreviewResult {
  version: typeof DNA_FULL_MODULE_INTERNAL_PREVIEW_VERSION;
  module: DnaFullModuleInternalPreviewModule;
  placementAdvisory: DnaThreeTaskPlacementAdvisory;
  sealMapCompleteness: DnaSealMapCompleteness;
  searchHints: DnaSearchHint[];
  recoveryHints: DnaGuidedRecoveryHint[];
  recoveryPlan: DnaGuidedRepairPlan;
  learningRecordSummary: DnaFullModuleLearningRecordSummary;
  learningMemory: LearningDnaMemory;
  legacyFallback: {
    dnaPresent: boolean;
    ifDnaMissing: "legacy_encode_analyze_path_unchanged";
  };
  decisionRole: typeof DNA_FULL_MODULE_INTERNAL_PREVIEW_DECISION_ROLE;
  canOpenVault: false;
  confirmed: false;
  final: false;
  autoApply: false;
  humanApprovalRequired: true;
  safety: DnaFullModuleInternalPreviewSafety;
}

export function buildDnaFullModuleInternalPreview(
  input: DnaFullModuleInternalPreviewInput,
): DnaFullModuleInternalPreviewResult {
  const threeTask = buildDnaThreeTaskAdvisory({
    module: input.module as DnaThreeTaskModule,
    dna: input.dna,
    placementContext: input.placementContext,
  });
  const threeTaskBridge = createDnaThreeTaskLearningBridge({
    result: threeTask,
    attackType: input.damage?.attackType ?? "internal_preview",
  });
  const threeTaskValidation = validateDnaThreeTaskLearningBridge(threeTaskBridge);
  if (!threeTaskValidation.ok) {
    throw new Error(
      `DNA full module preview safety violation: ${threeTaskValidation.violations.join(",")}`,
    );
  }

  const recovery = buildDnaGuidedRecoveryAdapter({
    module: input.module as DnaGuidedRecoveryModule,
    dna: input.dna,
    damage: input.damage,
  });
  const learningRecords: LearningTestRecord[] = [
    ...threeTaskBridge.learningRecords,
    ...recovery.learningMemory.records,
  ];
  const learningMemory = buildLearningDnaMemory(learningRecords);

  return {
    version: DNA_FULL_MODULE_INTERNAL_PREVIEW_VERSION,
    module: input.module,
    placementAdvisory: threeTask.placementAdvisory,
    sealMapCompleteness: threeTask.sealMapCompleteness,
    searchHints: threeTask.searchHints,
    recoveryHints: recovery.recoveryHints,
    recoveryPlan: recovery.repairPlan,
    learningRecordSummary: buildLearningSummary({
      module: input.module,
      learningRecords,
      recoveryAttempted: recovery.learningRecord.recoveryAttempted,
      recoverySuccess: recovery.learningRecord.success,
      recommendationCount: threeTaskBridge.humanApprovedProposals.length,
    }),
    learningMemory,
    legacyFallback: {
      dnaPresent: threeTask.sealMapCompleteness.dnaPresent,
      ifDnaMissing: "legacy_encode_analyze_path_unchanged",
    },
    decisionRole: DNA_FULL_MODULE_INTERNAL_PREVIEW_DECISION_ROLE,
    canOpenVault: false,
    confirmed: false,
    final: false,
    autoApply: false,
    humanApprovalRequired: true,
    safety: fullPreviewSafety(),
  };
}

export function validateDnaFullModuleInternalPreview(
  preview: DnaFullModuleInternalPreviewResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (preview.decisionRole !== DNA_FULL_MODULE_INTERNAL_PREVIEW_DECISION_ROLE) {
    violations.push("decisionRole_not_internal_preview");
  }
  if (preview.canOpenVault !== false) violations.push("canOpenVault_not_false");
  if (preview.confirmed !== false) violations.push("confirmed_not_false");
  if (preview.final !== false) violations.push("final_not_false");
  if (preview.autoApply !== false) violations.push("autoApply_not_false");
  if (preview.humanApprovalRequired !== true) {
    violations.push("humanApprovalRequired_not_true");
  }
  if (preview.recoveryPlan.predictedId !== null) {
    violations.push("recoveryPlan_predictedId_not_null");
  }
  if (preview.recoveryPlan.completesMissingId !== false) {
    violations.push("recoveryPlan_completesMissingId_not_false");
  }
  if (preview.recoveryPlan.storesOriginalContent !== false) {
    violations.push("recoveryPlan_storesOriginalContent_not_false");
  }
  if (preview.recoveryPlan.transientOnly !== true) {
    violations.push("recoveryPlan_transientOnly_not_true");
  }
  if (preview.learningRecordSummary.humanApprovalRequired !== true) {
    violations.push("learningSummary_humanApprovalRequired_not_true");
  }
  if (preview.learningRecordSummary.autoApply !== false) {
    violations.push("learningSummary_autoApply_not_false");
  }
  if (preview.learningMemory.automation.autoApplyEnabled !== false) {
    violations.push("learningMemory_autoApplyEnabled_not_false");
  }
  if (preview.learningMemory.automation.requiresHumanApproval !== true) {
    violations.push("learningMemory_requiresHumanApproval_not_true");
  }
  if (preview.learningMemory.safety.canOpenVault !== false) {
    violations.push("learningMemory_canOpenVault_not_false");
  }
  if (preview.learningMemory.safety.confirmed !== false) {
    violations.push("learningMemory_confirmed_not_false");
  }
  for (const record of preview.learningMemory.records) {
    if (record.finalDecision !== "LEARNING_ADVISORY_ONLY") {
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
  const safety = preview.safety;
  if (safety.productRouteChanged !== false) {
    violations.push("safety_productRouteChanged_not_false");
  }
  if (safety.encodeAnalyzeChanged !== false) {
    violations.push("safety_encodeAnalyzeChanged_not_false");
  }
  if (safety.dnaCanOpenVault !== false) {
    violations.push("safety_dnaCanOpenVault_not_false");
  }
  if (safety.predictedId !== null) {
    violations.push("safety_predictedId_not_null");
  }
  if (safety.completesMissingId !== false) {
    violations.push("safety_completesMissingId_not_false");
  }
  if (safety.storesOriginalContent !== false) {
    violations.push("safety_storesOriginalContent_not_false");
  }
  return { ok: violations.length === 0, violations };
}

function buildLearningSummary(input: {
  module: DnaFullModuleInternalPreviewModule;
  learningRecords: LearningTestRecord[];
  recoveryAttempted: boolean;
  recoverySuccess: boolean;
  recommendationCount: number;
}): DnaFullModuleLearningRecordSummary {
  return {
    recordCount: input.learningRecords.length,
    module: input.module,
    taskTypes: [
      "placement_advisory",
      "seal_map",
      "search_hint",
      "guided_recovery",
    ],
    recommendationCount: input.recommendationCount,
    recoveryAttempted: input.recoveryAttempted,
    recoverySuccess: input.recoverySuccess,
    humanApprovalRequired: true,
    autoApply: false,
    decisionRole: DNA_FULL_MODULE_LEARNING_DECISION_ROLE,
  };
}

function fullPreviewSafety(): DnaFullModuleInternalPreviewSafety {
  return {
    productRouteChanged: false,
    encodeAnalyzeChanged: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    candidateSupportCanConfirm: false,
    dnaCanOpenVault: false,
    wrongIdCanOpenVault: false,
    idlessCanOpenVault: false,
    predictsId: false,
    predictedId: null,
    completesMissingId: false,
    generatesNonexistentId: false,
    storesOriginalContent: false,
    canChangeThresholds: false,
    canChangeOwnershipBlock: false,
    autoApply: false,
    humanApprovalRequired: true,
  };
}

export function learningModuleForPreview(
  module: DnaFullModuleInternalPreviewModule,
): LearningModule {
  return module;
}
