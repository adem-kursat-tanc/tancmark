import {
  type AudioLearningAdapterInput,
  type AudioLearningOutcome,
  type AudioLearningReadInput,
  type AudioLearningScenario,
} from "../../dna/audioLearningAdapter";
import {
  type TextLearningAdapterInput,
  type TextLearningOutcome,
  type TextLearningReadInput,
  type TextLearningScenario,
} from "../../dna/textLearningAdapter";
import {
  type VisualLearningAdapterInput,
  type VisualLearningEccResult,
  type VisualLearningReadInput,
  type VisualLearningScenario,
} from "../../dna/visualLearningAdapter";
import {
  type VideoLearningAdapterInput,
  type VideoLearningDecision,
  type VideoLearningReadInput,
  type VideoLearningScenario,
} from "../../dna/videoLearningAdapter";

const VISUAL_LEARNING_SCENARIOS = new Set<VisualLearningScenario>([
  "clean",
  "jpeg",
  "webp",
  "resize",
  "crop",
  "screen_photo",
  "screenshot_preprocessing",
]);
const VISUAL_ECC_STATUSES = new Set<VisualLearningEccResult>([
  "found_32_32",
  "partial_support",
  "not_found",
  "not_tested",
]);
const VIDEO_LEARNING_SCENARIOS = new Set<VideoLearningScenario>([
  "strong_mode_success",
  "fast_candidate",
  "fast_output_discarded",
  "fast_output_not_ready",
  "b_frame_fallback",
  "timebase_drift",
  "audio_preservation",
]);
const VIDEO_LEARNING_DECISIONS = new Set<VideoLearningDecision>([
  "STRONG_MODE_SUCCESS",
  "FAST_CANDIDATE",
  "FAST_OUTPUT_ACCEPTABLE",
  "FAST_OUTPUT_DISCARDED",
  "FAST_OUTPUT_NOT_READY",
  "STRONG_MODE_FALLBACK",
]);
const AUDIO_LEARNING_SCENARIOS = new Set<AudioLearningScenario>([
  "clean",
  "aac_transcode",
  "mp3_transcode",
  "volume_change",
  "trim_offset",
  "compression_transcode",
  "candidate_support",
  "wrong_id_security",
  "unsealed_source_security",
]);
const AUDIO_LEARNING_OUTCOMES = new Set<AudioLearningOutcome>([
  "ID_MATCH",
  "NOT_FOUND",
  "CANDIDATE_SUPPORT",
  "TRANSCODE_SURVIVED",
  "TRIM_OFFSET_SURVIVED",
]);
const TEXT_LEARNING_SCENARIOS = new Set<TextLearningScenario>([
  "clean",
  "copy_paste",
  "pdf",
  "ocr",
  "format_change",
  "partial_text_loss",
]);
const TEXT_LEARNING_OUTCOMES = new Set<TextLearningOutcome>([
  "ID_MATCH",
  "NOT_FOUND",
  "CANDIDATE_SUPPORT",
  "OCR_SUPPORT",
  "FORMAT_SURVIVED",
  "PARTIAL_TEXT_LOSS",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function bool(value: unknown): boolean {
  return value === true;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  return null;
}

function normalizeVisualRead(value: unknown): VisualLearningReadInput | null {
  const raw = asRecord(value);
  if (typeof raw["found"] !== "boolean" || typeof raw["exactIdMatch"] !== "boolean") {
    return null;
  }
  return {
    found: raw["found"],
    exactIdMatch: raw["exactIdMatch"],
    bitMatchCount: numberOrNull(raw["bitMatchCount"]),
    expectedIdHex: cleanString(raw["expectedIdHex"], 120),
    decodedIdHex: cleanString(raw["decodedIdHex"], 120),
    note: cleanString(raw["note"], 240),
  };
}

function normalizeVideoRead(value: unknown): VideoLearningReadInput | null {
  const raw = asRecord(value);
  if (typeof raw["found"] !== "boolean" || typeof raw["exactIdMatch"] !== "boolean") {
    return null;
  }
  return {
    found: raw["found"],
    exactIdMatch: raw["exactIdMatch"],
    targetCount: numberOrNull(raw["targetCount"]),
    foundTargets: numberOrNull(raw["foundTargets"]),
    expectedIdHex: cleanString(raw["expectedIdHex"], 120),
    decodedIdHex: cleanString(raw["decodedIdHex"], 120),
    note: cleanString(raw["note"], 240),
  };
}

function normalizeAudioRead(value: unknown): AudioLearningReadInput | null {
  const raw = asRecord(value);
  if (typeof raw["found"] !== "boolean" || typeof raw["exactIdMatch"] !== "boolean") {
    return null;
  }
  return {
    found: raw["found"],
    exactIdMatch: raw["exactIdMatch"],
    bitMatchCount: numberOrNull(raw["bitMatchCount"]),
    expectedIdHex: cleanString(raw["expectedIdHex"], 120),
    decodedIdHex: cleanString(raw["decodedIdHex"], 120),
    selectedOffsetSec: numberOrNull(raw["selectedOffsetSec"]),
    note: cleanString(raw["note"], 240),
  };
}

function normalizeTextRead(value: unknown): TextLearningReadInput | null {
  const raw = asRecord(value);
  if (typeof raw["found"] !== "boolean" || typeof raw["exactIdMatch"] !== "boolean") {
    return null;
  }
  return {
    found: raw["found"],
    exactIdMatch: raw["exactIdMatch"],
    signalCount: numberOrNull(raw["signalCount"]),
    expectedIdHex: cleanString(raw["expectedIdHex"], 120),
    decodedIdHex: cleanString(raw["decodedIdHex"], 120),
    note: cleanString(raw["note"], 240),
  };
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => numberOrNull(item))
    .filter((item): item is number => item !== null)
    .slice(0, 16);
}

export function normalizeVisualLearningInput(value: unknown): {
  input: VisualLearningAdapterInput | null;
  error: string | null;
  refs: {
    sourceRef: string | null;
    dnaRecordId: string | null;
    testHistoryId: string | null;
  };
} {
  const raw = asRecord(value);
  const recordId = cleanString(raw["recordId"], 120);
  const scenarioRaw = cleanString(raw["scenario"], 80);
  const scenario =
    scenarioRaw && VISUAL_LEARNING_SCENARIOS.has(scenarioRaw as VisualLearningScenario)
      ? (scenarioRaw as VisualLearningScenario)
      : null;
  const correctIdResult = normalizeVisualRead(raw["correctIdResult"]);
  const wrongIdResult = normalizeVisualRead(raw["wrongIdResult"]);
  const unsealedSourceResult = normalizeVisualRead(raw["unsealedSourceResult"]);
  const eccRaw = cleanString(raw["eccResult"], 80);
  const eccResult =
    eccRaw && VISUAL_ECC_STATUSES.has(eccRaw as VisualLearningEccResult)
      ? (eccRaw as VisualLearningEccResult)
      : "not_tested";

  if (!recordId) {
    return { input: null, error: "recordId required", refs: { sourceRef: null, dnaRecordId: null, testHistoryId: null } };
  }
  if (!scenario) {
    return { input: null, error: "valid visual scenario required", refs: { sourceRef: null, dnaRecordId: null, testHistoryId: null } };
  }
  if (!correctIdResult) {
    return { input: null, error: "correctIdResult with found/exactIdMatch required", refs: { sourceRef: null, dnaRecordId: null, testHistoryId: null } };
  }
  if (!wrongIdResult) {
    return { input: null, error: "wrongIdResult is required for learning safety", refs: { sourceRef: null, dnaRecordId: null, testHistoryId: null } };
  }
  if (!unsealedSourceResult) {
    return { input: null, error: "unsealedSourceResult is required for learning safety", refs: { sourceRef: null, dnaRecordId: null, testHistoryId: null } };
  }

  return {
    input: {
      recordId,
      generatedAt: cleanString(raw["generatedAt"], 80) ?? undefined,
      scenario,
      fileKind: cleanString(raw["fileKind"], 80),
      mimeType: cleanString(raw["mimeType"], 120),
      width: numberOrNull(raw["width"]),
      height: numberOrNull(raw["height"]),
      format: cleanString(raw["format"], 80),
      contentDigestHex: cleanString(raw["contentDigestHex"], 160),
      clientIdRef: cleanString(raw["clientId"], 160) ?? cleanString(raw["clientIdRef"], 160),
      docIdRef: cleanString(raw["docId"], 160) ?? cleanString(raw["docIdRef"], 160),
      sealRegion: cleanString(raw["sealRegion"], 160),
      textureMapSummary: cleanString(raw["textureMapSummary"], 240),
      contrastMapSummary: cleanString(raw["contrastMapSummary"], 240),
      brightnessMapSummary: cleanString(raw["brightnessMapSummary"], 240),
      correctIdResult,
      wrongIdResult,
      unsealedSourceResult,
      eccResult,
      candidateSupport: bool(raw["candidateSupport"]),
      survivedTransform: typeof raw["survivedTransform"] === "boolean" ? raw["survivedTransform"] : undefined,
      note: cleanString(raw["note"], 500),
    },
    error: null,
    refs: {
      sourceRef: cleanString(raw["sourceRef"], 160),
      dnaRecordId: cleanString(raw["dnaRecordId"], 160),
      testHistoryId: cleanString(raw["testHistoryId"], 160),
    },
  };
}

export function normalizeAudioLearningInput(value: unknown): {
  input: AudioLearningAdapterInput | null;
  error: string | null;
} {
  const raw = asRecord(value);
  const recordId = cleanString(raw["recordId"], 120);
  const scenarioRaw = cleanString(raw["scenario"], 80);
  const scenario =
    scenarioRaw && AUDIO_LEARNING_SCENARIOS.has(scenarioRaw as AudioLearningScenario)
      ? (scenarioRaw as AudioLearningScenario)
      : null;
  const outcomeRaw =
    cleanString(raw["audioOutcome"], 80) ??
    cleanString(raw["outcome"], 80) ??
    cleanString(raw["status"], 80);
  const audioOutcome =
    outcomeRaw && AUDIO_LEARNING_OUTCOMES.has(outcomeRaw as AudioLearningOutcome)
      ? (outcomeRaw as AudioLearningOutcome)
      : null;
  const correctIdResult = normalizeAudioRead(raw["correctIdResult"]);
  const wrongIdResult = normalizeAudioRead(raw["wrongIdResult"]);
  const unsealedSourceResult = normalizeAudioRead(raw["unsealedSourceResult"]);

  if (!recordId) return { input: null, error: "recordId required" };
  if (!scenario) return { input: null, error: "valid audio scenario required" };
  if (!audioOutcome) return { input: null, error: "valid audioOutcome required" };
  if (!correctIdResult) return { input: null, error: "correctIdResult with found/exactIdMatch required" };
  if (!wrongIdResult) return { input: null, error: "wrongIdResult is required for learning safety" };
  if (!unsealedSourceResult) {
    return { input: null, error: "unsealedSourceResult is required for learning safety" };
  }

  return {
    input: {
      recordId,
      generatedAt: cleanString(raw["generatedAt"], 80) ?? undefined,
      scenario,
      fileKind: cleanString(raw["fileKind"], 80),
      format: cleanString(raw["format"], 80),
      codec: cleanString(raw["codec"], 80),
      sampleRateHz: numberOrNull(raw["sampleRateHz"]) ?? numberOrNull(raw["sampleRate"]),
      channelCount: numberOrNull(raw["channelCount"]) ?? numberOrNull(raw["channels"]),
      durationSec: numberOrNull(raw["durationSec"]),
      volumeScale: numberOrNull(raw["volumeScale"]),
      trimOffsetSec: numberOrNull(raw["trimOffsetSec"]) ?? numberOrNull(raw["offsetSec"]),
      selectedOffsetSec: numberOrNull(raw["selectedOffsetSec"]),
      alignmentWindowSec: numberArray(raw["alignmentWindowSec"]),
      compressionSummary: cleanString(raw["compressionSummary"], 240),
      transcodeSummary: cleanString(raw["transcodeSummary"], 240),
      audioOutcome,
      correctIdResult,
      wrongIdResult,
      unsealedSourceResult,
      candidateSupport: bool(raw["candidateSupport"]),
      note: cleanString(raw["note"], 500),
    },
    error: null,
  };
}

export function normalizeTextLearningInput(value: unknown): {
  input: TextLearningAdapterInput | null;
  error: string | null;
} {
  const raw = asRecord(value);
  const recordId = cleanString(raw["recordId"], 120);
  const scenarioRaw = cleanString(raw["scenario"], 80);
  const scenario =
    scenarioRaw && TEXT_LEARNING_SCENARIOS.has(scenarioRaw as TextLearningScenario)
      ? (scenarioRaw as TextLearningScenario)
      : null;
  const outcomeRaw =
    cleanString(raw["textOutcome"], 80) ??
    cleanString(raw["outcome"], 80) ??
    cleanString(raw["status"], 80);
  const textOutcome =
    outcomeRaw && TEXT_LEARNING_OUTCOMES.has(outcomeRaw as TextLearningOutcome)
      ? (outcomeRaw as TextLearningOutcome)
      : null;
  const correctIdResult = normalizeTextRead(raw["correctIdResult"]);
  const wrongIdResult = normalizeTextRead(raw["wrongIdResult"]);
  const unsealedSourceResult = normalizeTextRead(raw["unsealedSourceResult"]);

  if (!recordId) return { input: null, error: "recordId required" };
  if (!scenario) return { input: null, error: "valid text scenario required" };
  if (!textOutcome) return { input: null, error: "valid textOutcome required" };
  if (!correctIdResult) return { input: null, error: "correctIdResult with found/exactIdMatch required" };
  if (!wrongIdResult) return { input: null, error: "wrongIdResult is required for learning safety" };
  if (!unsealedSourceResult) {
    return { input: null, error: "unsealedSourceResult is required for learning safety" };
  }

  return {
    input: {
      recordId,
      generatedAt: cleanString(raw["generatedAt"], 80) ?? undefined,
      scenario,
      fileKind: cleanString(raw["fileKind"], 80),
      format: cleanString(raw["format"], 80),
      sourceTextLength: numberOrNull(raw["sourceTextLength"]),
      observedTextLength: numberOrNull(raw["observedTextLength"]),
      retainedRatio: numberOrNull(raw["retainedRatio"]),
      transformSummary: cleanString(raw["transformSummary"], 240),
      ocrSupport: bool(raw["ocrSupport"]),
      heavyOcrTriggered: bool(raw["heavyOcrTriggered"]),
      ocrConfidence: numberOrNull(raw["ocrConfidence"]),
      textOutcome,
      correctIdResult,
      wrongIdResult,
      unsealedSourceResult,
      candidateSupport: bool(raw["candidateSupport"]),
      note: cleanString(raw["note"], 500),
    },
    error: null,
  };
}

export function normalizeVideoLearningInput(value: unknown): {
  input: VideoLearningAdapterInput | null;
  error: string | null;
} {
  const raw = asRecord(value);
  const recordId = cleanString(raw["recordId"], 120);
  const scenarioRaw = cleanString(raw["scenario"], 80);
  const scenario =
    scenarioRaw && VIDEO_LEARNING_SCENARIOS.has(scenarioRaw as VideoLearningScenario)
      ? (scenarioRaw as VideoLearningScenario)
      : null;
  const decisionRaw =
    cleanString(raw["videoDecision"], 80) ??
    cleanString(raw["fastDecision"], 80) ??
    cleanString(raw["status"], 80);
  const videoDecision =
    decisionRaw && VIDEO_LEARNING_DECISIONS.has(decisionRaw as VideoLearningDecision)
      ? (decisionRaw as VideoLearningDecision)
      : null;
  const correctIdResult = normalizeVideoRead(raw["correctIdResult"]);
  const wrongIdResult = normalizeVideoRead(raw["wrongIdResult"]);
  const unsealedSourceResult = normalizeVideoRead(raw["unsealedSourceResult"]);

  if (!recordId) return { input: null, error: "recordId required" };
  if (!scenario) return { input: null, error: "valid video scenario required" };
  if (!videoDecision) return { input: null, error: "valid videoDecision required" };
  if (!correctIdResult) return { input: null, error: "correctIdResult with found/exactIdMatch required" };
  if (!wrongIdResult) return { input: null, error: "wrongIdResult is required for learning safety" };
  if (!unsealedSourceResult) {
    return { input: null, error: "unsealedSourceResult is required for learning safety" };
  }

  return {
    input: {
      recordId,
      generatedAt: cleanString(raw["generatedAt"], 80) ?? undefined,
      scenario,
      fileKind: cleanString(raw["fileKind"], 80),
      mimeType: cleanString(raw["mimeType"], 120),
      codec: cleanString(raw["codec"], 80) ?? cleanString(raw["codecName"], 80),
      profile: cleanString(raw["profile"], 80),
      container: cleanString(raw["container"], 80) ?? cleanString(raw["format"], 80),
      gopSummary: cleanString(raw["gopSummary"], 240),
      hasBFrames: booleanOrNull(raw["hasBFrames"]),
      hasPtsDtsReorder: booleanOrNull(raw["hasPtsDtsReorder"]),
      hasNegativePtsDelta: booleanOrNull(raw["hasNegativePtsDelta"]),
      frameCountReliable: booleanOrNull(raw["frameCountReliable"]),
      sourceFrameCount: numberOrNull(raw["sourceFrameCount"]),
      outputFrameCount: numberOrNull(raw["outputFrameCount"]),
      frameCountDrift: numberOrNull(raw["frameCountDrift"]),
      sourceDurationSec: numberOrNull(raw["sourceDurationSec"]),
      outputDurationSec: numberOrNull(raw["outputDurationSec"]),
      durationDriftSec: numberOrNull(raw["durationDriftSec"]),
      sourceFps: cleanString(raw["sourceFps"], 80) ?? cleanString(raw["sourceAvgFrameRate"], 80),
      outputFps: cleanString(raw["outputFps"], 80) ?? cleanString(raw["outputAvgFrameRate"], 80),
      sourceTimeBase: cleanString(raw["sourceTimeBase"], 80) ?? cleanString(raw["timeBase"], 80),
      outputTimeBase: cleanString(raw["outputTimeBase"], 80),
      ptsDtsSummary: cleanString(raw["ptsDtsSummary"], 240),
      audioPreserved: booleanOrNull(raw["audioPreserved"]),
      sourceHasAudio: booleanOrNull(raw["sourceHasAudio"]),
      outputHasAudio: booleanOrNull(raw["outputHasAudio"]),
      videoDecision,
      correctIdResult,
      wrongIdResult,
      unsealedSourceResult,
      candidateSupport: bool(raw["candidateSupport"]),
      note: cleanString(raw["note"], 500),
    },
    error: null,
  };
}
