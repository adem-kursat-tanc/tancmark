import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory";

export const VIDEO_LEARNING_ADAPTER_VERSION = "video-learning-adapter-v0.1" as const;

export type VideoLearningScenario =
  | "strong_mode_success"
  | "fast_candidate"
  | "fast_output_discarded"
  | "fast_output_not_ready"
  | "b_frame_fallback"
  | "timebase_drift"
  | "audio_preservation";

export type VideoLearningDecision =
  | "STRONG_MODE_SUCCESS"
  | "FAST_CANDIDATE"
  | "FAST_OUTPUT_ACCEPTABLE"
  | "FAST_OUTPUT_DISCARDED"
  | "FAST_OUTPUT_NOT_READY"
  | "STRONG_MODE_FALLBACK";

export interface VideoLearningReadInput {
  found: boolean;
  exactIdMatch: boolean;
  targetCount?: number | null;
  foundTargets?: number | null;
  expectedIdHex?: string | null;
  decodedIdHex?: string | null;
  note?: string | null;
}

export interface VideoLearningAdapterInput {
  recordId: string;
  generatedAt?: string;
  scenario: VideoLearningScenario;
  fileKind?: string | null;
  mimeType?: string | null;
  codec?: string | null;
  profile?: string | null;
  container?: string | null;
  gopSummary?: string | null;
  hasBFrames?: boolean | null;
  hasPtsDtsReorder?: boolean | null;
  hasNegativePtsDelta?: boolean | null;
  frameCountReliable?: boolean | null;
  sourceFrameCount?: number | null;
  outputFrameCount?: number | null;
  frameCountDrift?: number | null;
  sourceDurationSec?: number | null;
  outputDurationSec?: number | null;
  durationDriftSec?: number | null;
  sourceFps?: string | null;
  outputFps?: string | null;
  sourceTimeBase?: string | null;
  outputTimeBase?: string | null;
  ptsDtsSummary?: string | null;
  audioPreserved?: boolean | null;
  sourceHasAudio?: boolean | null;
  outputHasAudio?: boolean | null;
  videoDecision: VideoLearningDecision;
  correctIdResult: VideoLearningReadInput;
  wrongIdResult: VideoLearningReadInput;
  unsealedSourceResult: VideoLearningReadInput;
  candidateSupport?: boolean;
  note?: string | null;
}

export interface VideoLearningAdapterSafety {
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

export interface VideoLearningAdapterRecord {
  adapterVersion: typeof VIDEO_LEARNING_ADAPTER_VERSION;
  generatedAt: string;
  source: {
    scenario: VideoLearningScenario;
    codec: string | null;
    profile: string | null;
    container: string | null;
    gopSummary: string | null;
    hasBFrames: boolean | null;
    hasPtsDtsReorder: boolean | null;
    hasNegativePtsDelta: boolean | null;
    frameCountReliable: boolean | null;
    sourceFrameCount: number | null;
    outputFrameCount: number | null;
    frameCountDrift: number | null;
    sourceDurationSec: number | null;
    outputDurationSec: number | null;
    durationDriftSec: number | null;
    sourceFps: string | null;
    outputFps: string | null;
    sourceTimeBase: string | null;
    outputTimeBase: string | null;
    ptsDtsSummary: string | null;
    audioPreserved: boolean | null;
    sourceHasAudio: boolean | null;
    outputHasAudio: boolean | null;
    videoDecision: VideoLearningDecision;
    correctIdResult: VideoLearningReadInput;
    wrongIdResult: VideoLearningReadInput;
    unsealedSourceResult: VideoLearningReadInput;
  };
  learningRecord: LearningTestRecord;
  safety: VideoLearningAdapterSafety;
  validation: {
    ok: boolean;
    violations: string[];
  };
}

export const VIDEO_LEARNING_ADAPTER_SAFETY: VideoLearningAdapterSafety = {
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

function driftFrom(source: number | null | undefined, output: number | null | undefined): number | null {
  return typeof source === "number" && typeof output === "number" ? output - source : null;
}

function scenarioLabel(input: VideoLearningAdapterInput): string {
  return `video_${input.scenario}`;
}

function isFastFailure(input: VideoLearningAdapterInput): boolean {
  return (
    input.videoDecision === "FAST_OUTPUT_DISCARDED" ||
    input.videoDecision === "FAST_OUTPUT_NOT_READY" ||
    input.videoDecision === "STRONG_MODE_FALLBACK"
  );
}

function videoModuleNote(input: VideoLearningAdapterInput): string {
  const frameDrift = input.frameCountDrift ?? driftFrom(input.sourceFrameCount, input.outputFrameCount);
  const durationDrift = input.durationDriftSec ?? driftFrom(input.sourceDurationSec, input.outputDurationSec);
  return [
    `scenario=${input.scenario}`,
    `decision=${input.videoDecision}`,
    `codec=${input.codec ?? "unknown"}`,
    `container=${input.container ?? "unknown"}`,
    `bFrames=${String(input.hasBFrames ?? "unknown")}`,
    `ptsDtsReorder=${String(input.hasPtsDtsReorder ?? "unknown")}`,
    `timeBase=${input.sourceTimeBase ?? "unknown"}>${input.outputTimeBase ?? "unknown"}`,
    `frameCountDrift=${String(frameDrift ?? "unknown")}`,
    `durationDriftSec=${String(durationDrift ?? "unknown")}`,
    `audioPreserved=${String(input.audioPreserved ?? "unknown")}`,
    `correctIdExact=${input.correctIdResult.exactIdMatch === true}`,
    `wrongIdExact=${input.wrongIdResult.exactIdMatch === true}`,
    `unsealedFound=${input.unsealedSourceResult.found === true}`,
    "advisoryOnly=true",
  ].join("; ");
}

function videoObservation(input: VideoLearningAdapterInput): LearningModuleObservation {
  const idRead = input.correctIdResult.exactIdMatch === true;
  const candidateSupport =
    idRead ||
    input.candidateSupport === true ||
    input.videoDecision === "FAST_CANDIDATE" ||
    input.videoDecision === "FAST_OUTPUT_ACCEPTABLE" ||
    input.videoDecision === "STRONG_MODE_SUCCESS";

  return {
    module: "video",
    active: true,
    sealed: true,
    idRead,
    candidateSupport,
    confirmed: false,
    rescued: input.videoDecision === "STRONG_MODE_SUCCESS" || input.videoDecision === "FAST_OUTPUT_ACCEPTABLE",
    failed: isFastFailure(input) || (!idRead && !candidateSupport),
    note: videoModuleNote(input),
  };
}

export function createVideoLearningTestRecord(input: VideoLearningAdapterInput): LearningTestRecord {
  return {
    recordId: input.recordId,
    scenario: scenarioLabel(input),
    fileKind: input.fileKind ?? input.container ?? "video",
    expectedOutcome: "VIDEO_LEARNING_ADVISORY_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: input.correctIdResult.exactIdMatch === true,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules: [videoObservation(input)],
    note: input.note ?? "video learning adapter record; no VAULT/confirmed/final decision authority",
  };
}

function validateVideoLearningRecord(record: LearningTestRecord, input: VideoLearningAdapterInput): string[] {
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

export function createVideoLearningAdapterRecord(input: VideoLearningAdapterInput): VideoLearningAdapterRecord {
  const learningRecord = createVideoLearningTestRecord(input);
  const violations = validateVideoLearningRecord(learningRecord, input);

  return {
    adapterVersion: VIDEO_LEARNING_ADAPTER_VERSION,
    generatedAt: generatedAt(input.generatedAt),
    source: {
      scenario: input.scenario,
      codec: input.codec ?? null,
      profile: input.profile ?? null,
      container: input.container ?? null,
      gopSummary: input.gopSummary ?? null,
      hasBFrames: input.hasBFrames ?? null,
      hasPtsDtsReorder: input.hasPtsDtsReorder ?? null,
      hasNegativePtsDelta: input.hasNegativePtsDelta ?? null,
      frameCountReliable: input.frameCountReliable ?? null,
      sourceFrameCount: input.sourceFrameCount ?? null,
      outputFrameCount: input.outputFrameCount ?? null,
      frameCountDrift: input.frameCountDrift ?? driftFrom(input.sourceFrameCount, input.outputFrameCount),
      sourceDurationSec: input.sourceDurationSec ?? null,
      outputDurationSec: input.outputDurationSec ?? null,
      durationDriftSec: input.durationDriftSec ?? driftFrom(input.sourceDurationSec, input.outputDurationSec),
      sourceFps: input.sourceFps ?? null,
      outputFps: input.outputFps ?? null,
      sourceTimeBase: input.sourceTimeBase ?? null,
      outputTimeBase: input.outputTimeBase ?? null,
      ptsDtsSummary: input.ptsDtsSummary ?? null,
      audioPreserved: input.audioPreserved ?? null,
      sourceHasAudio: input.sourceHasAudio ?? null,
      outputHasAudio: input.outputHasAudio ?? null,
      videoDecision: input.videoDecision,
      correctIdResult: input.correctIdResult,
      wrongIdResult: input.wrongIdResult,
      unsealedSourceResult: input.unsealedSourceResult,
    },
    learningRecord,
    safety: VIDEO_LEARNING_ADAPTER_SAFETY,
    validation: {
      ok: violations.length === 0,
      violations,
    },
  };
}

export function createVideoLearningMemory(inputs: readonly VideoLearningAdapterInput[]): LearningDnaMemory {
  return buildLearningDnaMemory(inputs.map(createVideoLearningTestRecord));
}

export function validateVideoLearningAdapterBatch(records: readonly VideoLearningAdapterRecord[]): {
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
