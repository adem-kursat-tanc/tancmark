import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModule,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory.js";

export const DNA_LAYER_SIGNAL_BRIDGE_VERSION =
  "dna-layer-signal-bridge-v0.1" as const;
export const DNA_LAYER_SIGNAL_DECISION_ROLE =
  "layer_learning_record_only_no_vault_no_confirmed" as const;

export type DnaLayerSignalModule =
  | "video"
  | "image"
  | "audio"
  | "text"
  | "secure_room"
  | "zehir"
  | "ocr"
  | "ecc"
  | "c2pa";

export interface DnaLayerSignalInput {
  recordId?: string | null | undefined;
  module: DnaLayerSignalModule;
  layerName: string;
  signalType: string;
  observedResult: string;
  attackType?: string | null | undefined;
  success: boolean;
  failureReason?: string | null | undefined;
  confidence?: number | undefined;
  candidateOnly?: boolean | undefined;
  supportOnly?: boolean | undefined;
  exactIdMatched?: boolean | undefined;
  sealed?: boolean | undefined;
}

export interface DnaLayerSignalLearningRecord {
  recordId: string;
  module: DnaLayerSignalModule;
  layerName: string;
  signalType: string;
  observedResult: string;
  attackType: string;
  success: boolean;
  failureReason: string | null;
  confidence: number;
  candidateOnly: boolean;
  supportOnly: boolean;
  exactIdMatched: boolean;
  canOpenVault: false;
  confirmed: false;
  final: false;
  humanApprovalRequired: true;
  autoApply: false;
  decisionRole: typeof DNA_LAYER_SIGNAL_DECISION_ROLE;
}

export interface DnaLayerSignalBridgeSafety {
  layerLearningRecordOnly: true;
  humanApprovalRequired: true;
  autoApply: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  canChangePlacement: false;
  canChangeThresholds: false;
  canChangeOwnershipBlock: false;
  canChangeEncodeAnalyze: false;
  productRouteChanged: false;
}

export interface DnaLayerSignalBridgeResult {
  bridgeVersion: typeof DNA_LAYER_SIGNAL_BRIDGE_VERSION;
  decisionRole: typeof DNA_LAYER_SIGNAL_DECISION_ROLE;
  layerRecords: DnaLayerSignalLearningRecord[];
  learningRecords: LearningTestRecord[];
  learningMemory: LearningDnaMemory;
  safety: DnaLayerSignalBridgeSafety;
}

export function createDnaLayerSignalBridge(
  inputs: readonly DnaLayerSignalInput[],
): DnaLayerSignalBridgeResult {
  const layerRecords = inputs.map((input, index) =>
    normalizeLayerSignal(input, index),
  );
  const learningRecords = layerRecords.map((record) =>
    layerRecordToLearningRecord(record),
  );

  return {
    bridgeVersion: DNA_LAYER_SIGNAL_BRIDGE_VERSION,
    decisionRole: DNA_LAYER_SIGNAL_DECISION_ROLE,
    layerRecords,
    learningRecords,
    learningMemory: buildLearningDnaMemory(learningRecords),
    safety: bridgeSafety(),
  };
}

export function validateDnaLayerSignalBridge(
  bridge: DnaLayerSignalBridgeResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (bridge.decisionRole !== DNA_LAYER_SIGNAL_DECISION_ROLE) {
    violations.push("decisionRole_not_layer_learning_record_only");
  }
  if (bridge.layerRecords.length !== bridge.learningRecords.length) {
    violations.push("layerRecord_learningRecord_count_mismatch");
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
  for (const record of bridge.layerRecords) {
    if (record.canOpenVault !== false) {
      violations.push(`${record.recordId}:canOpenVault_not_false`);
    }
    if (record.confirmed !== false) {
      violations.push(`${record.recordId}:confirmed_not_false`);
    }
    if (record.final !== false) {
      violations.push(`${record.recordId}:final_not_false`);
    }
    if (record.humanApprovalRequired !== true) {
      violations.push(`${record.recordId}:humanApprovalRequired_not_true`);
    }
    if (record.autoApply !== false) {
      violations.push(`${record.recordId}:autoApply_not_false`);
    }
    if (record.decisionRole !== DNA_LAYER_SIGNAL_DECISION_ROLE) {
      violations.push(`${record.recordId}:decisionRole_not_record_only`);
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
  if (bridge.safety.autoApply !== false) violations.push("safety_autoApply_not_false");
  if (bridge.safety.humanApprovalRequired !== true) {
    violations.push("safety_humanApprovalRequired_not_true");
  }
  if (bridge.safety.productRouteChanged !== false) {
    violations.push("safety_productRouteChanged_not_false");
  }
  if (bridge.safety.canChangeEncodeAnalyze !== false) {
    violations.push("safety_canChangeEncodeAnalyze_not_false");
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

function normalizeLayerSignal(
  input: DnaLayerSignalInput,
  index: number,
): DnaLayerSignalLearningRecord {
  const moduleName = input.module;
  const layerName = cleanString(input.layerName, "unknown-layer");
  const signalType = cleanString(input.signalType, "unknown-signal");
  const recordId =
    cleanNullable(input.recordId) ??
    `dna-layer-${moduleName}-${slug(layerName)}-${String(index + 1).padStart(2, "0")}`;

  return {
    recordId,
    module: moduleName,
    layerName,
    signalType,
    observedResult: cleanString(input.observedResult, "not_observed"),
    attackType: cleanString(input.attackType, "lab_baseline"),
    success: input.success === true,
    failureReason: input.success === true ? null : cleanNullable(input.failureReason) ?? "unknown_failure",
    confidence: clamp01(input.confidence ?? (input.success ? 0.8 : 0.2)),
    candidateOnly: input.candidateOnly === true,
    supportOnly: input.supportOnly === true || input.module === "secure_room" || input.module === "zehir",
    exactIdMatched: input.exactIdMatched === true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    humanApprovalRequired: true,
    autoApply: false,
    decisionRole: DNA_LAYER_SIGNAL_DECISION_ROLE,
  };
}

function layerRecordToLearningRecord(
  record: DnaLayerSignalLearningRecord,
): LearningTestRecord {
  return {
    recordId: record.recordId,
    scenario: `dna_layer_${record.module}_${slug(record.layerName)}_${slug(record.attackType)}`,
    fileKind: record.module,
    expectedOutcome: "DNA_LAYER_SIGNAL_LEARNING_RECORD_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: record.exactIdMatched,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: record.module === "ocr" && /heavy/i.test(record.layerName),
    modules: [moduleObservation(record)],
    note: [
      `layerName=${record.layerName}`,
      `signalType=${record.signalType}`,
      `observedResult=${record.observedResult}`,
      `attackType=${record.attackType}`,
      `success=${String(record.success)}`,
      `candidateOnly=${String(record.candidateOnly)}`,
      `supportOnly=${String(record.supportOnly)}`,
      `exactIdMatched=${String(record.exactIdMatched)}`,
      `humanApprovalRequired=${String(record.humanApprovalRequired)}`,
      `autoApply=${String(record.autoApply)}`,
      `decisionRole=${record.decisionRole}`,
      record.failureReason ? `failureReason=${record.failureReason}` : null,
    ].filter((item): item is string => item !== null).join("; "),
  };
}

function moduleObservation(
  record: DnaLayerSignalLearningRecord,
): LearningModuleObservation {
  const module = learningModuleFor(record);
  const idRead = record.exactIdMatched;
  const candidateSupport =
    idRead || record.candidateOnly || record.supportOnly || record.success;

  return {
    module,
    active: true,
    sealed: sealedFor(record),
    idRead,
    candidateSupport,
    confirmed: false,
    rescued: record.success && record.attackType !== "lab_baseline",
    failed: !record.success,
    note: `${record.module}:${record.layerName}; signal=${record.signalType}; layerLearningOnly=true; canOpenVault=false`,
  };
}

function learningModuleFor(record: DnaLayerSignalLearningRecord): LearningModule {
  if (record.module === "ocr") {
    return /heavy/i.test(record.layerName) || /heavy/i.test(record.signalType)
      ? "heavy_ocr"
      : "light_ocr";
  }
  if (record.module === "c2pa") return "c2pa_draft";
  if (record.module === "ecc") return "evidence_package";
  return record.module;
}

function sealedFor(record: DnaLayerSignalLearningRecord): boolean {
  if (record.module === "secure_room" || record.module === "zehir") return false;
  if (record.module === "ocr" || record.module === "c2pa") return false;
  return true;
}

function bridgeSafety(): DnaLayerSignalBridgeSafety {
  return {
    layerLearningRecordOnly: true,
    humanApprovalRequired: true,
    autoApply: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    canChangePlacement: false,
    canChangeThresholds: false,
    canChangeOwnershipBlock: false,
    canChangeEncodeAnalyze: false,
    productRouteChanged: false,
  };
}

function cleanString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 240) : fallback;
}

function cleanNullable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 240) : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "signal";
}
