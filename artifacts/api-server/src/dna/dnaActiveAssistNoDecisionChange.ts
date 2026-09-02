import {
  buildReadOnlyDnaProductReport,
  type DnaReadOnlyProductReport,
  type DnaReadOnlyProductReportModule,
} from "./dnaReadOnlyProductReport.js";
import type { DnaSearchHint } from "./dnaThreeTaskAdvisory.js";

export const DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_VERSION =
  "dna-active-assist-no-decision-change-v0.1" as const;
export const DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_ROLE =
  "active_assist_no_vault_no_confirmed" as const;

export type DnaActiveAssistModule = DnaReadOnlyProductReportModule;

export interface DnaActiveAssistInput {
  module: DnaActiveAssistModule;
  dna?: unknown;
  readOnlyReport?: DnaReadOnlyProductReport | undefined;
}

export interface DnaActiveAssistDelivery {
  activeAssistEnabled: boolean;
  deliveredToAnalyzeHelper: boolean;
  searchHintsDelivered: boolean;
  recoveryPlanDelivered: boolean;
  sealMapDelivered: boolean;
  learningSummaryDelivered: boolean;
  deliveryTarget:
    | "video_analyze_helper_context"
    | "image_analyze_helper_context"
    | "audio_analyze_helper_context"
    | "text_analyze_helper_context";
  fallbackIfMissing: "legacy_analyze_path_unchanged";
}

export interface DnaActiveAssistRepairNormalizePlan {
  planKind: DnaReadOnlyProductReport["recoveryPlan"]["planKind"];
  targetLayers: string[];
  targetRegions: string[];
  steps: string[];
  transientOnly: true;
  outputForRealDecoderOnly: true;
  predictedId: null;
  completesMissingId: false;
  storesOriginalContent: false;
  usesOriginalContentCopy: false;
}

export interface DnaActiveAssistSafety {
  productRouteChanged: false;
  encodeAnalyzeDecisionChanged: false;
  confirmedChanged: false;
  canOpenVaultChanged: false;
  vaultEligibleChanged: false;
  finalChanged: false;
  thresholdChanged: false;
  ownershipChanged: false;
  wrongIdCanOpenVault: false;
  idlessCanOpenVault: false;
  candidateSupportCanConfirm: false;
  predictsId: false;
  predictedId: null;
  completesMissingId: false;
  generatesNonexistentId: false;
  storesOriginalContent: false;
  autoApply: false;
  humanApprovalRequired: true;
}

export interface DnaActiveAssistNoDecisionChangeReport {
  version: typeof DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_VERSION;
  module: DnaActiveAssistModule;
  decisionRole: typeof DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_ROLE;
  activeHelper: true;
  sealMapCompleteness: DnaReadOnlyProductReport["sealMapCompleteness"];
  searchHints: DnaSearchHint[];
  searchPlan: {
    hintCount: number;
    orderedHints: DnaSearchHint[];
    searchOrderOnly: true;
    canConfirm: false;
    canOpenVault: false;
  };
  recoveryPlan: DnaActiveAssistRepairNormalizePlan;
  learningRecordSummary: DnaReadOnlyProductReport["learningRecordSummary"];
  delivery: DnaActiveAssistDelivery;
  legacyFallback: {
    dnaPresent: boolean;
    ifDnaMissing: "legacy_analyze_path_unchanged";
  };
  candidateSupportOnly: true;
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
  final: false;
  autoApply: false;
  humanApprovalRequired: true;
  safety: DnaActiveAssistSafety;
}

export function buildDnaActiveAssistNoDecisionChange(
  input: DnaActiveAssistInput,
): DnaActiveAssistNoDecisionChangeReport {
  const readOnlyReport =
    input.readOnlyReport ??
    buildReadOnlyDnaProductReport({
      module: input.module,
      dna: input.dna,
    });
  const activeAssistEnabled =
    readOnlyReport.sealMapCompleteness.dnaPresent &&
    (readOnlyReport.searchHints.length > 0 ||
      readOnlyReport.recoveryPlan.steps.length > 0);

  return {
    version: DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_VERSION,
    module: input.module,
    decisionRole: DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_ROLE,
    activeHelper: true,
    sealMapCompleteness: readOnlyReport.sealMapCompleteness,
    searchHints: readOnlyReport.searchHints,
    searchPlan: {
      hintCount: readOnlyReport.searchHints.length,
      orderedHints: readOnlyReport.searchHints,
      searchOrderOnly: true,
      canConfirm: false,
      canOpenVault: false,
    },
    recoveryPlan: {
      planKind: readOnlyReport.recoveryPlan.planKind,
      targetLayers: readOnlyReport.recoveryPlan.targetLayers,
      targetRegions: readOnlyReport.recoveryPlan.targetRegions,
      steps: readOnlyReport.recoveryPlan.steps,
      transientOnly: true,
      outputForRealDecoderOnly: true,
      predictedId: null,
      completesMissingId: false,
      storesOriginalContent: false,
      usesOriginalContentCopy: false,
    },
    learningRecordSummary: readOnlyReport.learningRecordSummary,
    delivery: {
      activeAssistEnabled,
      deliveredToAnalyzeHelper: activeAssistEnabled,
      searchHintsDelivered: readOnlyReport.searchHints.length > 0,
      recoveryPlanDelivered: readOnlyReport.recoveryPlan.steps.length > 0,
      sealMapDelivered: true,
      learningSummaryDelivered: true,
      deliveryTarget: deliveryTarget(input.module),
      fallbackIfMissing: "legacy_analyze_path_unchanged",
    },
    legacyFallback: {
      dnaPresent: readOnlyReport.sealMapCompleteness.dnaPresent,
      ifDnaMissing: "legacy_analyze_path_unchanged",
    },
    candidateSupportOnly: true,
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
    final: false,
    autoApply: false,
    humanApprovalRequired: true,
    safety: activeAssistSafety(),
  };
}

export function validateDnaActiveAssistNoDecisionChange(
  report: DnaActiveAssistNoDecisionChangeReport,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (report.decisionRole !== DNA_ACTIVE_ASSIST_NO_DECISION_CHANGE_ROLE) {
    violations.push("decisionRole_not_active_assist");
  }
  if (report.searchPlan.canConfirm !== false) {
    violations.push("searchPlan_canConfirm_not_false");
  }
  if (report.searchPlan.canOpenVault !== false) {
    violations.push("searchPlan_canOpenVault_not_false");
  }
  if (report.confirmed !== false) violations.push("confirmed_not_false");
  if (report.canOpenVault !== false) violations.push("canOpenVault_not_false");
  if (report.vaultEligible !== false) violations.push("vaultEligible_not_false");
  if (report.final !== false) violations.push("final_not_false");
  if (report.autoApply !== false) violations.push("autoApply_not_false");
  if (report.humanApprovalRequired !== true) {
    violations.push("humanApprovalRequired_not_true");
  }
  if (report.recoveryPlan.predictedId !== null) {
    violations.push("recoveryPlan_predictedId_not_null");
  }
  if (report.recoveryPlan.completesMissingId !== false) {
    violations.push("recoveryPlan_completesMissingId_not_false");
  }
  if (report.recoveryPlan.storesOriginalContent !== false) {
    violations.push("recoveryPlan_storesOriginalContent_not_false");
  }
  if (report.recoveryPlan.usesOriginalContentCopy !== false) {
    violations.push("recoveryPlan_usesOriginalContentCopy_not_false");
  }
  if (report.recoveryPlan.transientOnly !== true) {
    violations.push("recoveryPlan_transientOnly_not_true");
  }
  if (report.recoveryPlan.outputForRealDecoderOnly !== true) {
    violations.push("recoveryPlan_outputForRealDecoderOnly_not_true");
  }
  const safety = report.safety;
  if (safety.confirmedChanged !== false) {
    violations.push("safety_confirmedChanged_not_false");
  }
  if (safety.canOpenVaultChanged !== false) {
    violations.push("safety_canOpenVaultChanged_not_false");
  }
  if (safety.vaultEligibleChanged !== false) {
    violations.push("safety_vaultEligibleChanged_not_false");
  }
  if (safety.finalChanged !== false) {
    violations.push("safety_finalChanged_not_false");
  }
  if (safety.thresholdChanged !== false) {
    violations.push("safety_thresholdChanged_not_false");
  }
  if (safety.ownershipChanged !== false) {
    violations.push("safety_ownershipChanged_not_false");
  }
  if (safety.wrongIdCanOpenVault !== false) {
    violations.push("safety_wrongIdCanOpenVault_not_false");
  }
  if (safety.idlessCanOpenVault !== false) {
    violations.push("safety_idlessCanOpenVault_not_false");
  }
  if (safety.candidateSupportCanConfirm !== false) {
    violations.push("safety_candidateSupportCanConfirm_not_false");
  }
  if (safety.predictsId !== false || safety.predictedId !== null) {
    violations.push("safety_predictsId_not_false");
  }
  if (safety.completesMissingId !== false) {
    violations.push("safety_completesMissingId_not_false");
  }
  if (safety.generatesNonexistentId !== false) {
    violations.push("safety_generatesNonexistentId_not_false");
  }
  if (safety.storesOriginalContent !== false) {
    violations.push("safety_storesOriginalContent_not_false");
  }
  if (safety.autoApply !== false) {
    violations.push("safety_autoApply_not_false");
  }
  if (safety.humanApprovalRequired !== true) {
    violations.push("safety_humanApprovalRequired_not_true");
  }
  return { ok: violations.length === 0, violations };
}

function deliveryTarget(
  module: DnaActiveAssistModule,
): DnaActiveAssistDelivery["deliveryTarget"] {
  if (module === "video") return "video_analyze_helper_context";
  if (module === "image") return "image_analyze_helper_context";
  if (module === "audio") return "audio_analyze_helper_context";
  return "text_analyze_helper_context";
}

function activeAssistSafety(): DnaActiveAssistSafety {
  return {
    productRouteChanged: false,
    encodeAnalyzeDecisionChanged: false,
    confirmedChanged: false,
    canOpenVaultChanged: false,
    vaultEligibleChanged: false,
    finalChanged: false,
    thresholdChanged: false,
    ownershipChanged: false,
    wrongIdCanOpenVault: false,
    idlessCanOpenVault: false,
    candidateSupportCanConfirm: false,
    predictsId: false,
    predictedId: null,
    completesMissingId: false,
    generatesNonexistentId: false,
    storesOriginalContent: false,
    autoApply: false,
    humanApprovalRequired: true,
  };
}
