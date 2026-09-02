import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory";

export const TEXT_LEARNING_ADAPTER_VERSION = "text-learning-adapter-v0.1" as const;

export type TextLearningScenario =
  | "clean"
  | "copy_paste"
  | "pdf"
  | "ocr"
  | "format_change"
  | "partial_text_loss";

export type TextLearningOutcome =
  | "ID_MATCH"
  | "NOT_FOUND"
  | "CANDIDATE_SUPPORT"
  | "OCR_SUPPORT"
  | "FORMAT_SURVIVED"
  | "PARTIAL_TEXT_LOSS";

export interface TextLearningReadInput {
  found: boolean;
  exactIdMatch: boolean;
  signalCount?: number | null;
  expectedIdHex?: string | null;
  decodedIdHex?: string | null;
  note?: string | null;
}

export interface TextLearningAdapterInput {
  recordId: string;
  generatedAt?: string;
  scenario: TextLearningScenario;
  fileKind?: string | null;
  format?: string | null;
  sourceTextLength?: number | null;
  observedTextLength?: number | null;
  retainedRatio?: number | null;
  transformSummary?: string | null;
  ocrSupport?: boolean;
  heavyOcrTriggered?: boolean;
  ocrConfidence?: number | null;
  textOutcome: TextLearningOutcome;
  correctIdResult: TextLearningReadInput;
  wrongIdResult: TextLearningReadInput;
  unsealedSourceResult: TextLearningReadInput;
  candidateSupport?: boolean;
  note?: string | null;
}

export interface TextLearningAdapterSafety {
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

export interface TextLearningAdapterRecord {
  adapterVersion: typeof TEXT_LEARNING_ADAPTER_VERSION;
  generatedAt: string;
  source: {
    scenario: TextLearningScenario;
    format: string | null;
    sourceTextLength: number | null;
    observedTextLength: number | null;
    retainedRatio: number | null;
    transformSummary: string | null;
    ocrSupport: boolean;
    heavyOcrTriggered: boolean;
    ocrConfidence: number | null;
    textOutcome: TextLearningOutcome;
    correctIdResult: TextLearningReadInput;
    wrongIdResult: TextLearningReadInput;
    unsealedSourceResult: TextLearningReadInput;
  };
  learningRecord: LearningTestRecord;
  safety: TextLearningAdapterSafety;
  validation: {
    ok: boolean;
    violations: string[];
  };
}

export const TEXT_LEARNING_ADAPTER_SAFETY: TextLearningAdapterSafety = {
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

function scenarioLabel(input: TextLearningAdapterInput): string {
  return `text_${input.scenario}`;
}

function textModuleNote(input: TextLearningAdapterInput): string {
  return [
    `scenario=${input.scenario}`,
    `outcome=${input.textOutcome}`,
    `format=${input.format ?? "unknown"}`,
    `sourceTextLength=${String(input.sourceTextLength ?? "unknown")}`,
    `observedTextLength=${String(input.observedTextLength ?? "unknown")}`,
    `retainedRatio=${String(input.retainedRatio ?? "unknown")}`,
    `ocrSupport=${String(input.ocrSupport === true)}`,
    `heavyOcrTriggered=${String(input.heavyOcrTriggered === true)}`,
    `correctIdExact=${input.correctIdResult.exactIdMatch === true}`,
    `wrongIdExact=${input.wrongIdResult.exactIdMatch === true}`,
    `unsealedFound=${input.unsealedSourceResult.found === true}`,
    "advisoryOnly=true",
  ].join("; ");
}

function textObservation(input: TextLearningAdapterInput): LearningModuleObservation {
  const idRead = input.correctIdResult.exactIdMatch === true;
  const candidateSupport =
    idRead ||
    input.candidateSupport === true ||
    input.textOutcome === "CANDIDATE_SUPPORT" ||
    input.textOutcome === "OCR_SUPPORT" ||
    input.textOutcome === "FORMAT_SURVIVED" ||
    input.textOutcome === "PARTIAL_TEXT_LOSS";

  return {
    module: "text",
    active: true,
    sealed: true,
    idRead,
    candidateSupport,
    confirmed: false,
    rescued: idRead && input.scenario !== "clean",
    failed: !idRead && !candidateSupport,
    note: textModuleNote(input),
  };
}

function ocrObservation(input: TextLearningAdapterInput): LearningModuleObservation | null {
  if (input.ocrSupport !== true && input.heavyOcrTriggered !== true) return null;
  const module = input.heavyOcrTriggered === true ? "heavy_ocr" : "light_ocr";

  return {
    module,
    active: true,
    sealed: false,
    idRead: false,
    candidateSupport: true,
    confirmed: false,
    rescued: false,
    failed: false,
    note: `ocrSupport=true; confidence=${String(input.ocrConfidence ?? "unknown")}; supportOnly=true; canOpenVault=false`,
  };
}

export function createTextLearningTestRecord(input: TextLearningAdapterInput): LearningTestRecord {
  const modules: LearningModuleObservation[] = [textObservation(input)];
  const ocr = ocrObservation(input);
  if (ocr) modules.push(ocr);

  return {
    recordId: input.recordId,
    scenario: scenarioLabel(input),
    fileKind: input.fileKind ?? input.format ?? "text",
    expectedOutcome: "TEXT_LEARNING_ADVISORY_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: input.correctIdResult.exactIdMatch === true,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: input.heavyOcrTriggered === true,
    modules,
    note: input.note ?? "text learning adapter record; no VAULT/confirmed/final decision authority",
  };
}

function validateTextLearningRecord(record: LearningTestRecord, input: TextLearningAdapterInput): string[] {
  const violations: string[] = [];
  if (record.finalDecision !== LEARNING_ADVISORY_FINAL_DECISION) {
    violations.push("learning_record_finalDecision_not_advisory_only");
  }
  if (record.falseVault !== false) violations.push("learning_record_falseVault_not_false");
  if (record.idlessVault !== false) violations.push("learning_record_idlessVault_not_false");
  if (record.modules.some((module) => module.confirmed !== false)) {
    violations.push("learning_module_confirmed_not_false");
  }
  if (input.wrongIdResult.exactIdMatch === true) {
    violations.push("wrong_id_exact_match_not_safe");
  }
  if (input.unsealedSourceResult.found === true || input.unsealedSourceResult.exactIdMatch === true) {
    violations.push("unsealed_source_positive_not_safe");
  }
  return violations;
}

export function createTextLearningAdapterRecord(input: TextLearningAdapterInput): TextLearningAdapterRecord {
  const learningRecord = createTextLearningTestRecord(input);
  const violations = validateTextLearningRecord(learningRecord, input);

  return {
    adapterVersion: TEXT_LEARNING_ADAPTER_VERSION,
    generatedAt: generatedAt(input.generatedAt),
    source: {
      scenario: input.scenario,
      format: input.format ?? null,
      sourceTextLength: input.sourceTextLength ?? null,
      observedTextLength: input.observedTextLength ?? null,
      retainedRatio: input.retainedRatio ?? null,
      transformSummary: input.transformSummary ?? null,
      ocrSupport: input.ocrSupport === true,
      heavyOcrTriggered: input.heavyOcrTriggered === true,
      ocrConfidence: input.ocrConfidence ?? null,
      textOutcome: input.textOutcome,
      correctIdResult: input.correctIdResult,
      wrongIdResult: input.wrongIdResult,
      unsealedSourceResult: input.unsealedSourceResult,
    },
    learningRecord,
    safety: TEXT_LEARNING_ADAPTER_SAFETY,
    validation: {
      ok: violations.length === 0,
      violations,
    },
  };
}

export function createTextLearningMemory(inputs: readonly TextLearningAdapterInput[]): LearningDnaMemory {
  return buildLearningDnaMemory(inputs.map(createTextLearningTestRecord));
}

export function validateTextLearningAdapterBatch(records: readonly TextLearningAdapterRecord[]): {
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
