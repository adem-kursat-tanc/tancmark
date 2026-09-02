import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory";

export const AUDIO_LEARNING_ADAPTER_VERSION = "audio-learning-adapter-v0.1" as const;

export type AudioLearningScenario =
  | "clean"
  | "aac_transcode"
  | "mp3_transcode"
  | "volume_change"
  | "trim_offset"
  | "compression_transcode"
  | "candidate_support"
  | "wrong_id_security"
  | "unsealed_source_security";

export type AudioLearningOutcome =
  | "ID_MATCH"
  | "NOT_FOUND"
  | "CANDIDATE_SUPPORT"
  | "TRANSCODE_SURVIVED"
  | "TRIM_OFFSET_SURVIVED";

export interface AudioLearningReadInput {
  found: boolean;
  exactIdMatch: boolean;
  bitMatchCount?: number | null;
  expectedIdHex?: string | null;
  decodedIdHex?: string | null;
  selectedOffsetSec?: number | null;
  note?: string | null;
}

export interface AudioLearningAdapterInput {
  recordId: string;
  generatedAt?: string;
  scenario: AudioLearningScenario;
  fileKind?: string | null;
  format?: string | null;
  codec?: string | null;
  sampleRateHz?: number | null;
  channelCount?: number | null;
  durationSec?: number | null;
  volumeScale?: number | null;
  trimOffsetSec?: number | null;
  selectedOffsetSec?: number | null;
  alignmentWindowSec?: readonly number[];
  compressionSummary?: string | null;
  transcodeSummary?: string | null;
  audioOutcome: AudioLearningOutcome;
  correctIdResult: AudioLearningReadInput;
  wrongIdResult: AudioLearningReadInput;
  unsealedSourceResult: AudioLearningReadInput;
  candidateSupport?: boolean;
  note?: string | null;
}

export interface AudioLearningAdapterSafety {
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

export interface AudioLearningAdapterRecord {
  adapterVersion: typeof AUDIO_LEARNING_ADAPTER_VERSION;
  generatedAt: string;
  source: {
    scenario: AudioLearningScenario;
    format: string | null;
    codec: string | null;
    sampleRateHz: number | null;
    channelCount: number | null;
    durationSec: number | null;
    volumeScale: number | null;
    trimOffsetSec: number | null;
    selectedOffsetSec: number | null;
    alignmentWindowSec: readonly number[];
    compressionSummary: string | null;
    transcodeSummary: string | null;
    audioOutcome: AudioLearningOutcome;
    correctIdResult: AudioLearningReadInput;
    wrongIdResult: AudioLearningReadInput;
    unsealedSourceResult: AudioLearningReadInput;
  };
  learningRecord: LearningTestRecord;
  safety: AudioLearningAdapterSafety;
  validation: {
    ok: boolean;
    violations: string[];
  };
}

export const AUDIO_LEARNING_ADAPTER_SAFETY: AudioLearningAdapterSafety = {
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

function scenarioLabel(input: AudioLearningAdapterInput): string {
  return `audio_${input.scenario}`;
}

function audioModuleNote(input: AudioLearningAdapterInput): string {
  return [
    `scenario=${input.scenario}`,
    `outcome=${input.audioOutcome}`,
    `format=${input.format ?? "unknown"}`,
    `codec=${input.codec ?? "unknown"}`,
    `sampleRateHz=${String(input.sampleRateHz ?? "unknown")}`,
    `channels=${String(input.channelCount ?? "unknown")}`,
    `volumeScale=${String(input.volumeScale ?? "unknown")}`,
    `trimOffsetSec=${String(input.trimOffsetSec ?? "unknown")}`,
    `selectedOffsetSec=${String(input.selectedOffsetSec ?? input.correctIdResult.selectedOffsetSec ?? "unknown")}`,
    `correctIdExact=${input.correctIdResult.exactIdMatch === true}`,
    `wrongIdExact=${input.wrongIdResult.exactIdMatch === true}`,
    `unsealedFound=${input.unsealedSourceResult.found === true}`,
    "advisoryOnly=true",
  ].join("; ");
}

function audioObservation(input: AudioLearningAdapterInput): LearningModuleObservation {
  const idRead = input.correctIdResult.exactIdMatch === true;
  const candidateSupport =
    idRead ||
    input.candidateSupport === true ||
    input.audioOutcome === "CANDIDATE_SUPPORT" ||
    input.audioOutcome === "TRANSCODE_SURVIVED" ||
    input.audioOutcome === "TRIM_OFFSET_SURVIVED";

  return {
    module: "audio",
    active: true,
    sealed: true,
    idRead,
    candidateSupport,
    confirmed: false,
    rescued: idRead && input.scenario !== "clean",
    failed: !idRead && !candidateSupport,
    note: audioModuleNote(input),
  };
}

export function createAudioLearningTestRecord(input: AudioLearningAdapterInput): LearningTestRecord {
  return {
    recordId: input.recordId,
    scenario: scenarioLabel(input),
    fileKind: input.fileKind ?? input.format ?? "audio",
    expectedOutcome: "AUDIO_LEARNING_ADVISORY_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: input.correctIdResult.exactIdMatch === true,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules: [audioObservation(input)],
    note: input.note ?? "audio learning adapter record; no VAULT/confirmed/final decision authority",
  };
}

function validateAudioLearningRecord(record: LearningTestRecord, input: AudioLearningAdapterInput): string[] {
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

export function createAudioLearningAdapterRecord(input: AudioLearningAdapterInput): AudioLearningAdapterRecord {
  const learningRecord = createAudioLearningTestRecord(input);
  const violations = validateAudioLearningRecord(learningRecord, input);

  return {
    adapterVersion: AUDIO_LEARNING_ADAPTER_VERSION,
    generatedAt: generatedAt(input.generatedAt),
    source: {
      scenario: input.scenario,
      format: input.format ?? null,
      codec: input.codec ?? null,
      sampleRateHz: input.sampleRateHz ?? null,
      channelCount: input.channelCount ?? null,
      durationSec: input.durationSec ?? null,
      volumeScale: input.volumeScale ?? null,
      trimOffsetSec: input.trimOffsetSec ?? null,
      selectedOffsetSec: input.selectedOffsetSec ?? input.correctIdResult.selectedOffsetSec ?? null,
      alignmentWindowSec: input.alignmentWindowSec ?? [],
      compressionSummary: input.compressionSummary ?? null,
      transcodeSummary: input.transcodeSummary ?? null,
      audioOutcome: input.audioOutcome,
      correctIdResult: input.correctIdResult,
      wrongIdResult: input.wrongIdResult,
      unsealedSourceResult: input.unsealedSourceResult,
    },
    learningRecord,
    safety: AUDIO_LEARNING_ADAPTER_SAFETY,
    validation: {
      ok: violations.length === 0,
      violations,
    },
  };
}

export function createAudioLearningMemory(inputs: readonly AudioLearningAdapterInput[]): LearningDnaMemory {
  return buildLearningDnaMemory(inputs.map(createAudioLearningTestRecord));
}

export function validateAudioLearningAdapterBatch(records: readonly AudioLearningAdapterRecord[]): {
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
