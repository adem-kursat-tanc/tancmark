import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory";

export const VISUAL_LEARNING_ADAPTER_VERSION = "visual-learning-adapter-v0.2" as const;

export type VisualLearningScenario =
  | "clean"
  | "jpeg"
  | "webp"
  | "resize"
  | "crop"
  | "screen_photo"
  | "screenshot_preprocessing";

export type VisualLearningEccResult =
  | "found_32_32"
  | "partial_support"
  | "not_found"
  | "not_tested";

export interface VisualLearningReadInput {
  found: boolean;
  exactIdMatch: boolean;
  bitMatchCount?: number | null;
  expectedIdHex?: string | null;
  decodedIdHex?: string | null;
  note?: string | null;
}

export interface VisualLearningAdapterInput {
  recordId: string;
  generatedAt?: string;
  scenario: VisualLearningScenario;
  fileKind?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  contentDigestHex?: string | null;
  clientIdRef?: string | null;
  docIdRef?: string | null;
  sealRegion?: string | null;
  textureMapSummary?: string | null;
  contrastMapSummary?: string | null;
  brightnessMapSummary?: string | null;
  correctIdResult: VisualLearningReadInput;
  wrongIdResult?: VisualLearningReadInput | null;
  unsealedSourceResult?: VisualLearningReadInput | null;
  eccResult?: VisualLearningEccResult;
  candidateSupport?: boolean;
  survivedTransform?: boolean;
  note?: string | null;
}

export interface VisualLearningAdapterSafety {
  adapterDoesNotDecide: true;
  canOpenVault: false;
  vaultCapable: false;
  confirmed: false;
  canFinalize: false;
  finalDecision: typeof LEARNING_ADVISORY_FINAL_DECISION;
  autoApply: false;
  recommendationsAutoApplied: false;
  canChangeSealPlacement: false;
  canChangeStrongMode: false;
  canChangeThresholds: false;
  canCompleteMissingIdBits: false;
}

export interface VisualLearningAdapterRecord {
  adapterVersion: typeof VISUAL_LEARNING_ADAPTER_VERSION;
  generatedAt: string;
  source: {
    scenario: VisualLearningScenario;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    format: string | null;
    contentDigestHex: string | null;
    clientIdRef: string | null;
    docIdRef: string | null;
    sealRegion: string | null;
    textureMapSummary: string | null;
    contrastMapSummary: string | null;
    brightnessMapSummary: string | null;
    survivedTransform: boolean;
    eccResult: VisualLearningEccResult;
    correctIdResult: VisualLearningReadInput;
    wrongIdResult: VisualLearningReadInput | null;
    unsealedSourceResult: VisualLearningReadInput | null;
  };
  learningRecord: LearningTestRecord;
  safety: VisualLearningAdapterSafety;
  validation: {
    ok: boolean;
    violations: string[];
  };
}

export const VISUAL_LEARNING_ADAPTER_SAFETY: VisualLearningAdapterSafety = {
  adapterDoesNotDecide: true,
  canOpenVault: false,
  vaultCapable: false,
  confirmed: false,
  canFinalize: false,
  finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
  autoApply: false,
  recommendationsAutoApplied: false,
  canChangeSealPlacement: false,
  canChangeStrongMode: false,
  canChangeThresholds: false,
  canCompleteMissingIdBits: false,
};

function generatedAt(value: string | undefined): string {
  return value && Number.isFinite(Date.parse(value)) ? value : new Date().toISOString();
}

function visualScenarioLabel(input: VisualLearningAdapterInput): string {
  return `visual_${input.scenario}`;
}

function visualModuleNote(input: VisualLearningAdapterInput): string {
  const eccResult = input.eccResult ?? "not_tested";
  return [
    `scenario=${input.scenario}`,
    `ecc=${eccResult}`,
    `correctIdExact=${input.correctIdResult.exactIdMatch === true}`,
    `wrongIdExact=${input.wrongIdResult?.exactIdMatch === true}`,
    `unsealedFound=${input.unsealedSourceResult?.found === true}`,
    "advisoryOnly=true",
  ].join("; ");
}

function imageObservation(input: VisualLearningAdapterInput): LearningModuleObservation {
  const eccResult = input.eccResult ?? "not_tested";
  const idRead = input.correctIdResult.exactIdMatch === true;
  const candidateSupport =
    idRead ||
    input.candidateSupport === true ||
    eccResult === "found_32_32" ||
    eccResult === "partial_support";

  return {
    module: "image",
    active: true,
    sealed: true,
    idRead,
    candidateSupport,
    confirmed: false,
    rescued: !idRead && eccResult === "found_32_32",
    failed: !idRead && !candidateSupport,
    note: visualModuleNote(input),
  };
}

function eccObservation(input: VisualLearningAdapterInput): LearningModuleObservation | null {
  const eccResult = input.eccResult ?? "not_tested";
  if (eccResult === "not_tested") return null;

  return {
    module: "image",
    active: true,
    sealed: true,
    idRead: eccResult === "found_32_32",
    candidateSupport: eccResult === "found_32_32" || eccResult === "partial_support",
    confirmed: false,
    rescued: eccResult === "found_32_32" && !input.correctIdResult.exactIdMatch,
    failed: eccResult === "not_found",
    note: `visual_ecc=${eccResult}; advisoryOnly=true; canOpenVault=false`,
  };
}

export function createVisualLearningTestRecord(input: VisualLearningAdapterInput): LearningTestRecord {
  const modules: LearningModuleObservation[] = [imageObservation(input)];
  const ecc = eccObservation(input);
  if (ecc) modules.push(ecc);

  return {
    recordId: input.recordId,
    scenario: visualScenarioLabel(input),
    fileKind: input.fileKind ?? input.format ?? "image",
    expectedOutcome: "VISUAL_LEARNING_ADVISORY_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: input.correctIdResult.exactIdMatch === true,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules,
    note: input.note ?? "visual learning adapter record; no VAULT/confirmed/final decision authority",
  };
}

function validateVisualLearningRecord(record: LearningTestRecord): string[] {
  const violations: string[] = [];
  if (record.finalDecision !== LEARNING_ADVISORY_FINAL_DECISION) {
    violations.push("learning_record_finalDecision_not_advisory_only");
  }
  if (record.falseVault !== false) violations.push("learning_record_falseVault_not_false");
  if (record.idlessVault !== false) violations.push("learning_record_idlessVault_not_false");
  if (record.modules.some((module) => module.confirmed !== false)) {
    violations.push("learning_module_confirmed_not_false");
  }
  return violations;
}

export function createVisualLearningAdapterRecord(input: VisualLearningAdapterInput): VisualLearningAdapterRecord {
  const learningRecord = createVisualLearningTestRecord(input);
  const violations = validateVisualLearningRecord(learningRecord);

  return {
    adapterVersion: VISUAL_LEARNING_ADAPTER_VERSION,
    generatedAt: generatedAt(input.generatedAt),
    source: {
      scenario: input.scenario,
      mimeType: input.mimeType ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      format: input.format ?? null,
      contentDigestHex: input.contentDigestHex ?? null,
      clientIdRef: input.clientIdRef ?? null,
      docIdRef: input.docIdRef ?? null,
      sealRegion: input.sealRegion ?? null,
      textureMapSummary: input.textureMapSummary ?? null,
      contrastMapSummary: input.contrastMapSummary ?? null,
      brightnessMapSummary: input.brightnessMapSummary ?? null,
      survivedTransform: input.survivedTransform ?? input.correctIdResult.exactIdMatch,
      eccResult: input.eccResult ?? "not_tested",
      correctIdResult: input.correctIdResult,
      wrongIdResult: input.wrongIdResult ?? null,
      unsealedSourceResult: input.unsealedSourceResult ?? null,
    },
    learningRecord,
    safety: VISUAL_LEARNING_ADAPTER_SAFETY,
    validation: {
      ok: violations.length === 0,
      violations,
    },
  };
}

export function createVisualLearningMemory(inputs: readonly VisualLearningAdapterInput[]): LearningDnaMemory {
  return buildLearningDnaMemory(inputs.map(createVisualLearningTestRecord));
}

export function validateVisualLearningAdapterBatch(records: readonly VisualLearningAdapterRecord[]): {
  ok: boolean;
  violations: string[];
} {
  const violations = records.flatMap((record) =>
    record.validation.violations.map((violation) => `${record.learningRecord.recordId}:${violation}`),
  );

  return {
    ok: violations.length === 0,
    violations,
  };
}
