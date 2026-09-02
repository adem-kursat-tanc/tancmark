import {
  buildAudioPlacementAdvisory,
  type AudioPlacementAdvisoryInput,
  type AudioPlacementAdvisoryResult,
} from "./audioPlacementAdvisory.js";
import {
  buildImageRegionAdvisory,
  type ImageRegionAdvisoryInput,
  type ImageRegionAdvisoryResult,
} from "./imageRegionAdvisory.js";
import {
  buildTextSpanAdvisory,
  type TextSpanAdvisoryInput,
  type TextSpanAdvisoryResult,
} from "./textSpanAdvisory.js";
import {
  buildVideoPlacementAdvisory,
  type VideoPlacementAdvisoryInput,
  type VideoPlacementAdvisoryResult,
} from "./videoPlacementAdvisory.js";

export const DNA_THREE_TASK_DECISION_ROLE =
  "advisory_only_no_vault_no_confirmed" as const;

export type DnaThreeTaskModule = "video" | "image" | "audio" | "text";

export type DnaThreeTaskPlacementAdvisory =
  | VideoPlacementAdvisoryResult
  | ImageRegionAdvisoryResult
  | AudioPlacementAdvisoryResult
  | TextSpanAdvisoryResult;

export interface DnaThreeTaskInput {
  module: DnaThreeTaskModule;
  dna?: unknown;
  placementContext?:
    | VideoPlacementAdvisoryInput
    | ImageRegionAdvisoryInput
    | AudioPlacementAdvisoryInput
    | TextSpanAdvisoryInput
    | undefined;
}

export interface DnaSealMapCompleteness {
  dnaPresent: boolean;
  module: DnaThreeTaskModule;
  hasExpectedLayer: boolean;
  hasId: boolean;
  hasEncodeMap: boolean;
  hasDecodeMap: boolean;
  layerCount: number;
  regionCount: number;
  missing: string[];
  complete: boolean;
}

export interface DnaSearchHint {
  module: DnaThreeTaskModule;
  layerId: string;
  regionId: string;
  hintKind: "video_frame_region" | "image_region" | "audio_time_frequency" | "text_span";
  frameIdx?: number | undefined;
  tsSec?: number | undefined;
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  timeStart?: number | undefined;
  timeEnd?: number | undefined;
  freqBinStart?: number | undefined;
  freqBinEnd?: number | undefined;
  charStart?: number | undefined;
  charEnd?: number | undefined;
}

export interface DnaThreeTaskSafetyResult {
  decisionRole: typeof DNA_THREE_TASK_DECISION_ROLE;
  dnaCanOpenVault: false;
  dnaConfirmed: false;
  dnaFinal: false;
  canChangeThresholds: false;
  candidateSupportCanConfirm: false;
  wrongIdCanOpenVault: false;
  idlessCanOpenVault: false;
  productRouteChanged: false;
}

export interface DnaThreeTaskAdvisoryResult {
  version: "dna-three-task-lab-v1";
  module: DnaThreeTaskModule;
  decisionRole: typeof DNA_THREE_TASK_DECISION_ROLE;
  placementAdvisory: DnaThreeTaskPlacementAdvisory;
  sealMapCompleteness: DnaSealMapCompleteness;
  searchHints: DnaSearchHint[];
  safety: DnaThreeTaskSafetyResult;
}

export function buildDnaThreeTaskAdvisory(
  input: DnaThreeTaskInput,
): DnaThreeTaskAdvisoryResult {
  return {
    version: "dna-three-task-lab-v1",
    module: input.module,
    decisionRole: DNA_THREE_TASK_DECISION_ROLE,
    placementAdvisory: buildPlacementAdvisory(input),
    sealMapCompleteness: inspectSealMapCompleteness(input.module, input.dna),
    searchHints: extractDnaSearchHints(input.module, input.dna),
    safety: evaluateDnaThreeTaskSafety(),
  };
}

export function evaluateDnaThreeTaskSafety(): DnaThreeTaskSafetyResult {
  return {
    decisionRole: DNA_THREE_TASK_DECISION_ROLE,
    dnaCanOpenVault: false,
    dnaConfirmed: false,
    dnaFinal: false,
    canChangeThresholds: false,
    candidateSupportCanConfirm: false,
    wrongIdCanOpenVault: false,
    idlessCanOpenVault: false,
    productRouteChanged: false,
  };
}

export function inspectSealMapCompleteness(
  module: DnaThreeTaskModule,
  dna: unknown,
): DnaSealMapCompleteness {
  const rec = asRecord(dna);
  const layers = asArray(rec["layers"]).map(asRecord);
  const maps = asRecord(rec["maps"]);
  const evidence = asRecord(rec["evidence"]);
  const relevantLayers = layers.filter((layer) => layerBelongsToModule(layer, module));
  const hasExpectedLayer = relevantLayers.length > 0;
  const hasId = typeof evidence["idHex"] === "string" && evidence["idHex"].length > 0;
  const hasEncodeMap = Object.keys(asRecord(maps["encodeMap"])).length > 0;
  const hasDecodeMap = Object.keys(asRecord(maps["decodeMap"])).length > 0;
  const regionCount = relevantLayers.reduce((sum, layer) => {
    const units = asArray(layer["units"]).map(asRecord);
    return sum + units.reduce((unitSum, unit) => unitSum + asArray(unit["regions"]).length, 0);
  }, 0);
  const missing = [
    !rec ? "dna" : null,
    !hasExpectedLayer ? "expected_layer" : null,
    !hasId ? "idHex" : null,
    !hasEncodeMap ? "encodeMap" : null,
    !hasDecodeMap ? "decodeMap" : null,
    regionCount === 0 ? "regions" : null,
  ].filter((item): item is string => item !== null);

  return {
    dnaPresent: Object.keys(rec).length > 0,
    module,
    hasExpectedLayer,
    hasId,
    hasEncodeMap,
    hasDecodeMap,
    layerCount: relevantLayers.length,
    regionCount,
    missing,
    complete: missing.length === 0,
  };
}

export function extractDnaSearchHints(
  module: DnaThreeTaskModule,
  dna: unknown,
): DnaSearchHint[] {
  const rec = asRecord(dna);
  const layers = asArray(rec["layers"]).map(asRecord);
  const hints: DnaSearchHint[] = [];
  for (const layer of layers) {
    if (!layerBelongsToModule(layer, module)) continue;
    const layerId = stringOr(layer["layerId"], "unknown-layer");
    for (const unit of asArray(layer["units"]).map(asRecord)) {
      for (const region of asArray(unit["regions"]).map(asRecord)) {
        hints.push(regionToHint(module, layerId, region));
      }
    }
  }
  return hints;
}

function buildPlacementAdvisory(input: DnaThreeTaskInput): DnaThreeTaskPlacementAdvisory {
  if (input.module === "video") {
    return buildVideoPlacementAdvisory({
      width: 1280,
      height: 720,
      fps: 30,
      totalFrames: 180,
      ...(asObject(input.placementContext) as Partial<VideoPlacementAdvisoryInput>),
    });
  }
  if (input.module === "image") {
    return buildImageRegionAdvisory({
      width: 1200,
      height: 800,
      ...(asObject(input.placementContext) as Partial<ImageRegionAdvisoryInput>),
    });
  }
  if (input.module === "audio") {
    return buildAudioPlacementAdvisory({
      durationSec: 8,
      ...(asObject(input.placementContext) as Partial<AudioPlacementAdvisoryInput>),
    });
  }
  return buildTextSpanAdvisory({
    text: "TancMark text advisory sample. This sentence is long enough to provide a stable span for lab-only advisory checks.",
    ...(asObject(input.placementContext) as Partial<TextSpanAdvisoryInput>),
  });
}

function regionToHint(
  module: DnaThreeTaskModule,
  layerId: string,
  region: Record<string, unknown>,
): DnaSearchHint {
  const base = {
    module,
    layerId,
    regionId: stringOr(region["regionId"], "unknown-region"),
  };
  if (module === "video") {
    return {
      ...base,
      hintKind: "video_frame_region",
      frameIdx: numberOrUndefined(region["frameIdx"]),
      tsSec: numberOrUndefined(region["tsSec"]),
      x: numberOrUndefined(region["cx"]),
      y: numberOrUndefined(region["cy"]),
      width: numberOrUndefined(region["width"]),
      height: numberOrUndefined(region["height"]),
    };
  }
  if (module === "image") {
    return {
      ...base,
      hintKind: "image_region",
      x: numberOrUndefined(region["cx"]),
      y: numberOrUndefined(region["cy"]),
      width: numberOrUndefined(region["width"]),
      height: numberOrUndefined(region["height"]),
    };
  }
  if (module === "audio") {
    return {
      ...base,
      hintKind: "audio_time_frequency",
      timeStart: numberOrUndefined(region["timeStart"]),
      timeEnd: numberOrUndefined(region["timeEnd"]),
      freqBinStart: numberOrUndefined(region["freqBinStart"]),
      freqBinEnd: numberOrUndefined(region["freqBinEnd"]),
    };
  }
  return {
    ...base,
    hintKind: "text_span",
    charStart: numberOrUndefined(region["charStart"]),
    charEnd: numberOrUndefined(region["charEnd"]),
  };
}

function layerBelongsToModule(layer: Record<string, unknown>, module: DnaThreeTaskModule) {
  const mediaType = layer["mediaType"];
  if (mediaType === module) return true;
  const layerId = stringOr(layer["layerId"], "").toLowerCase();
  if (module === "image") return layerId.startsWith("image.") || layerId.includes("visual");
  if (module === "audio") return layerId.includes("audio");
  if (module === "text") return layerId.startsWith("text.");
  return layerId.includes("video") || layerId.includes("triple") || layerId.includes("channel");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asObject(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
