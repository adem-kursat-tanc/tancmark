import {
  buildDnaFullModuleInternalPreview,
  validateDnaFullModuleInternalPreview,
  type DnaFullModuleInternalPreviewInput,
  type DnaFullModuleInternalPreviewModule,
  type DnaFullModuleInternalPreviewResult,
  type DnaFullModuleInternalPreviewSafety,
  type DnaFullModuleLearningRecordSummary,
} from "./dnaFullModuleInternalPreview.js";
import type {
  DnaSearchHint,
  DnaSealMapCompleteness,
  DnaThreeTaskPlacementAdvisory,
} from "./dnaThreeTaskAdvisory.js";
import type { DnaGuidedRepairPlan } from "./dnaGuidedRecoveryAdapter.js";

export const DNA_READ_ONLY_PRODUCT_REPORT_VERSION =
  "dna-read-only-product-report-v0.1" as const;
export const DNA_READ_ONLY_PRODUCT_REPORT_DECISION_ROLE =
  "read_only_dna_report_no_vault_no_confirmed" as const;

export type DnaReadOnlyProductReportModule =
  DnaFullModuleInternalPreviewModule;

export interface DnaReadOnlyProductReportIsolation {
  reportOnly: true;
  confirmedUnchanged: true;
  canOpenVaultUnchanged: true;
  vaultEligibleUnchanged: true;
  finalUnchanged: true;
  thresholdUnchanged: true;
  ownershipUnchanged: true;
  placementUnchanged: true;
  encodeAnalyzeUnchanged: true;
}

export interface DnaReadOnlyProductReportSafety
  extends DnaFullModuleInternalPreviewSafety {
  vaultEligible: false;
}

export interface DnaReadOnlyProductLearningSummary {
  module: DnaReadOnlyProductReportModule;
  recordCount: number;
  recommendationCount: number;
  recoveryAttempted: boolean;
  recoverySuccess: boolean;
  strongSignals: string[];
  weakSignals: string[];
  advisoryOnly: true;
  humanApprovalRequired: true;
  autoApply: false;
}

export interface DnaReadOnlyProductReport {
  version: typeof DNA_READ_ONLY_PRODUCT_REPORT_VERSION;
  module: DnaReadOnlyProductReportModule;
  sourceDecisionRole: DnaFullModuleInternalPreviewResult["decisionRole"];
  decisionRole: typeof DNA_READ_ONLY_PRODUCT_REPORT_DECISION_ROLE;
  placementAdvisory: DnaThreeTaskPlacementAdvisory;
  sealMapCompleteness: DnaSealMapCompleteness;
  searchHints: DnaSearchHint[];
  recoveryPlan: DnaGuidedRepairPlan;
  learningRecordSummary: DnaFullModuleLearningRecordSummary;
  learningSummary: DnaReadOnlyProductLearningSummary;
  decisionIsolation: DnaReadOnlyProductReportIsolation;
  candidateSupportOnly: true;
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
  final: false;
  autoApply: false;
  humanApprovalRequired: true;
  safety: DnaReadOnlyProductReportSafety;
}

export function buildReadOnlyDnaProductReport(
  input: DnaFullModuleInternalPreviewInput,
): DnaReadOnlyProductReport {
  const preview = buildDnaFullModuleInternalPreview(input);
  const validation = validateDnaFullModuleInternalPreview(preview);
  if (!validation.ok) {
    throw new Error(
      `read-only DNA report safety violation: ${validation.violations.join(",")}`,
    );
  }

  return {
    version: DNA_READ_ONLY_PRODUCT_REPORT_VERSION,
    module: preview.module,
    sourceDecisionRole: preview.decisionRole,
    decisionRole: DNA_READ_ONLY_PRODUCT_REPORT_DECISION_ROLE,
    placementAdvisory: preview.placementAdvisory,
    sealMapCompleteness: preview.sealMapCompleteness,
    searchHints: preview.searchHints,
    recoveryPlan: preview.recoveryPlan,
    learningRecordSummary: preview.learningRecordSummary,
    learningSummary: buildLearningSummary(preview),
    decisionIsolation: readOnlyIsolation(),
    candidateSupportOnly: true,
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
    final: false,
    autoApply: false,
    humanApprovalRequired: true,
    safety: {
      ...preview.safety,
      vaultEligible: false,
    },
  };
}

export function mediaTypeToReadOnlyDnaModule(
  mediaType: unknown,
): DnaReadOnlyProductReportModule | undefined {
  if (
    mediaType === "video" ||
    mediaType === "image" ||
    mediaType === "audio" ||
    mediaType === "text"
  ) {
    return mediaType;
  }
  return undefined;
}

export function validateReadOnlyDnaProductReport(
  report: DnaReadOnlyProductReport,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (report.decisionRole !== DNA_READ_ONLY_PRODUCT_REPORT_DECISION_ROLE) {
    violations.push("decisionRole_not_read_only");
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
  const isolation = report.decisionIsolation;
  if (isolation.reportOnly !== true) violations.push("reportOnly_not_true");
  if (isolation.confirmedUnchanged !== true) {
    violations.push("confirmedUnchanged_not_true");
  }
  if (isolation.canOpenVaultUnchanged !== true) {
    violations.push("canOpenVaultUnchanged_not_true");
  }
  if (isolation.vaultEligibleUnchanged !== true) {
    violations.push("vaultEligibleUnchanged_not_true");
  }
  if (isolation.finalUnchanged !== true) {
    violations.push("finalUnchanged_not_true");
  }
  if (isolation.thresholdUnchanged !== true) {
    violations.push("thresholdUnchanged_not_true");
  }
  if (isolation.ownershipUnchanged !== true) {
    violations.push("ownershipUnchanged_not_true");
  }
  if (isolation.placementUnchanged !== true) {
    violations.push("placementUnchanged_not_true");
  }
  if (isolation.encodeAnalyzeUnchanged !== true) {
    violations.push("encodeAnalyzeUnchanged_not_true");
  }
  const safety = report.safety;
  if (safety.canOpenVault !== false) violations.push("safety_canOpenVault_not_false");
  if (safety.confirmed !== false) violations.push("safety_confirmed_not_false");
  if (safety.vaultEligible !== false) {
    violations.push("safety_vaultEligible_not_false");
  }
  if (safety.final !== false) violations.push("safety_final_not_false");
  if (safety.dnaCanOpenVault !== false) {
    violations.push("safety_dnaCanOpenVault_not_false");
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

function buildLearningSummary(
  preview: DnaFullModuleInternalPreviewResult,
): DnaReadOnlyProductLearningSummary {
  const strongSignals = [
    preview.sealMapCompleteness.complete
      ? `${preview.module}:seal_map_complete`
      : null,
    preview.searchHints.length > 0 ? `${preview.module}:search_hints_available` : null,
    preview.learningRecordSummary.recordCount > 0
      ? `${preview.module}:advisory_learning_records_available`
      : null,
  ].filter((item): item is string => item !== null);
  const weakSignals = [
    preview.sealMapCompleteness.complete ? null : `${preview.module}:seal_map_incomplete`,
    preview.searchHints.length === 0 ? `${preview.module}:search_hints_missing` : null,
    preview.recoveryPlan.steps.length === 0
      ? `${preview.module}:recovery_plan_empty`
      : null,
  ].filter((item): item is string => item !== null);

  return {
    module: preview.module,
    recordCount: preview.learningRecordSummary.recordCount,
    recommendationCount: preview.learningRecordSummary.recommendationCount,
    recoveryAttempted: preview.learningRecordSummary.recoveryAttempted,
    recoverySuccess: preview.learningRecordSummary.recoverySuccess,
    strongSignals,
    weakSignals,
    advisoryOnly: true,
    humanApprovalRequired: true,
    autoApply: false,
  };
}

function readOnlyIsolation(): DnaReadOnlyProductReportIsolation {
  return {
    reportOnly: true,
    confirmedUnchanged: true,
    canOpenVaultUnchanged: true,
    vaultEligibleUnchanged: true,
    finalUnchanged: true,
    thresholdUnchanged: true,
    ownershipUnchanged: true,
    placementUnchanged: true,
    encodeAnalyzeUnchanged: true,
  };
}
