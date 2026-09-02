import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory.js";

export const DNA_GUIDED_RECOVERY_ADAPTER_VERSION =
  "dna-guided-recovery-lab-v0.1" as const;
export const DNA_GUIDED_RECOVERY_DECISION_ROLE =
  "recovery_hint_only_no_vault_no_confirmed" as const;
export const DNA_GUIDED_RECOVERY_LEARNING_DECISION_ROLE =
  "recovery_learning_record_only_no_vault_no_confirmed" as const;

export type DnaGuidedRecoveryModule = "video" | "image" | "audio" | "text";

export interface DnaGuidedDamageContext {
  attackType?: string | null | undefined;
  damagedArea?: string | null | undefined;
  observedResult?: string | null | undefined;
  matchingBits?: number | null | undefined;
  realIdReadAfterRepair?: boolean | undefined;
  success?: boolean | undefined;
  failureReason?: string | null | undefined;
}

export interface DnaGuidedRecoveryInput {
  module: DnaGuidedRecoveryModule;
  dna: unknown;
  damage?: DnaGuidedDamageContext | undefined;
}

export interface DnaGuidedRecoverySearchHint {
  module: DnaGuidedRecoveryModule;
  layerId: string;
  regionId: string;
  hintKind:
    | "video_frame_region"
    | "image_region"
    | "audio_time_frequency"
    | "text_span_layer";
  frameIdx?: number;
  tsSec?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  timeStart?: number;
  timeEnd?: number;
  freqBinStart?: number;
  freqBinEnd?: number;
  charStart?: number;
  charEnd?: number;
  carries?: string;
}

export interface DnaGuidedRecoveryHint {
  module: DnaGuidedRecoveryModule;
  layerId: string;
  damagedArea: string;
  attackType: string;
  suggestedAction: string;
  reason: string;
  confidence: number;
  canOpenVault: false;
  confirmed: false;
}

export interface DnaGuidedRepairPlan {
  module: DnaGuidedRecoveryModule;
  planKind:
    | "temporary_image_normalization"
    | "temporary_video_frame_region_normalization"
    | "temporary_audio_alignment_bandpass"
    | "temporary_text_span_layer_normalization";
  steps: string[];
  targetLayers: string[];
  targetRegions: string[];
  transientOnly: true;
  storesOriginalContent: false;
  usesOriginalContentCopy: false;
  predictedId: null;
  completesMissingId: false;
  outputForRealDecoderOnly: true;
  note: string;
}

export interface DnaGuidedRecoverySourceMapUsed {
  dnaPresent: boolean;
  encodeMapUsed: boolean;
  decodeMapUsed: boolean;
  layerMapUsed: boolean;
  structuralFingerprintUsed: boolean;
  contentDigestUsed: boolean;
  evidenceIdPresent: boolean;
  layerIds: string[];
  regionCount: number;
  mapKeys: string[];
}

export interface DnaGuidedRecoverySafety {
  transientOnly: true;
  storesOriginalContent: false;
  predictedId: null;
  completesMissingId: false;
  generatesNonexistentId: false;
  dnaCanOpenVault: false;
  dnaConfirmed: false;
  dnaFinal: false;
  wrongIdCanOpenVault: false;
  idlessCanOpenVault: false;
  candidateSupportCanConfirm: false;
  canChangeThresholds: false;
  canChangeOwnershipBlock: false;
  canChangeEncodeAnalyze: false;
  productRouteChanged: false;
  autoApply: false;
  humanApprovalRequired: true;
}

export interface DnaGuidedRecoveryLearningRecord {
  module: DnaGuidedRecoveryModule;
  layer: string;
  attackType: string;
  damagedArea: string;
  repairPlan: string[];
  recoveryAttempted: boolean;
  realIdReadAfterRepair: boolean;
  success: boolean;
  failureReason: string | null;
  humanApprovalRequired: true;
  autoApply: false;
  decisionRole: typeof DNA_GUIDED_RECOVERY_LEARNING_DECISION_ROLE;
}

export interface DnaGuidedRecoveryResult {
  version: typeof DNA_GUIDED_RECOVERY_ADAPTER_VERSION;
  module: DnaGuidedRecoveryModule;
  searchHints: DnaGuidedRecoverySearchHint[];
  recoveryHints: DnaGuidedRecoveryHint[];
  repairPlan: DnaGuidedRepairPlan;
  sourceMapUsed: DnaGuidedRecoverySourceMapUsed;
  transientOnly: true;
  storesOriginalContent: false;
  predictedId: null;
  completesMissingId: false;
  decisionRole: typeof DNA_GUIDED_RECOVERY_DECISION_ROLE;
  learningRecord: DnaGuidedRecoveryLearningRecord;
  learningMemory: LearningDnaMemory;
  safety: DnaGuidedRecoverySafety;
}

export function buildDnaGuidedRecoveryAdapter(
  input: DnaGuidedRecoveryInput,
): DnaGuidedRecoveryResult {
  const sourceMapUsed = inspectSourceMap(input.dna);
  const searchHints = extractSearchHints(input.module, input.dna);
  const recoveryHints = buildRecoveryHints(input.module, searchHints, input.damage);
  const repairPlan = buildRepairPlan(input.module, searchHints, sourceMapUsed);
  const learningRecord = buildRecoveryLearningRecord({
    module: input.module,
    searchHints,
    repairPlan,
    damage: input.damage,
  });
  const learningMemory = buildLearningDnaMemory([
    learningRecordToLearningTestRecord(learningRecord),
  ]);

  return {
    version: DNA_GUIDED_RECOVERY_ADAPTER_VERSION,
    module: input.module,
    searchHints,
    recoveryHints,
    repairPlan,
    sourceMapUsed,
    transientOnly: true,
    storesOriginalContent: false,
    predictedId: null,
    completesMissingId: false,
    decisionRole: DNA_GUIDED_RECOVERY_DECISION_ROLE,
    learningRecord,
    learningMemory,
    safety: recoverySafety(),
  };
}

export function validateDnaGuidedRecoveryAdapter(
  result: DnaGuidedRecoveryResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (result.decisionRole !== DNA_GUIDED_RECOVERY_DECISION_ROLE) {
    violations.push("decisionRole_not_recovery_hint_only");
  }
  if (result.transientOnly !== true) violations.push("transientOnly_not_true");
  if (result.storesOriginalContent !== false) {
    violations.push("storesOriginalContent_not_false");
  }
  if (result.predictedId !== null) violations.push("predictedId_not_null");
  if (result.completesMissingId !== false) {
    violations.push("completesMissingId_not_false");
  }
  if (result.repairPlan.transientOnly !== true) {
    violations.push("repairPlan_transientOnly_not_true");
  }
  if (result.repairPlan.storesOriginalContent !== false) {
    violations.push("repairPlan_storesOriginalContent_not_false");
  }
  if (result.repairPlan.predictedId !== null) {
    violations.push("repairPlan_predictedId_not_null");
  }
  if (result.repairPlan.completesMissingId !== false) {
    violations.push("repairPlan_completesMissingId_not_false");
  }
  if (result.safety.dnaCanOpenVault !== false) {
    violations.push("safety_dnaCanOpenVault_not_false");
  }
  if (result.safety.dnaConfirmed !== false) {
    violations.push("safety_dnaConfirmed_not_false");
  }
  if (result.safety.dnaFinal !== false) {
    violations.push("safety_dnaFinal_not_false");
  }
  if (result.safety.wrongIdCanOpenVault !== false) {
    violations.push("safety_wrongIdCanOpenVault_not_false");
  }
  if (result.safety.idlessCanOpenVault !== false) {
    violations.push("safety_idlessCanOpenVault_not_false");
  }
  if (result.safety.productRouteChanged !== false) {
    violations.push("safety_productRouteChanged_not_false");
  }
  if (result.safety.canChangeEncodeAnalyze !== false) {
    violations.push("safety_canChangeEncodeAnalyze_not_false");
  }
  if (result.learningRecord.humanApprovalRequired !== true) {
    violations.push("learningRecord_humanApprovalRequired_not_true");
  }
  if (result.learningRecord.autoApply !== false) {
    violations.push("learningRecord_autoApply_not_false");
  }
  if (
    result.learningRecord.decisionRole !==
    DNA_GUIDED_RECOVERY_LEARNING_DECISION_ROLE
  ) {
    violations.push("learningRecord_decisionRole_not_recovery_learning_only");
  }
  if (result.learningMemory.automation.autoApplyEnabled !== false) {
    violations.push("learningMemory_autoApplyEnabled_not_false");
  }
  if (result.learningMemory.automation.requiresHumanApproval !== true) {
    violations.push("learningMemory_requiresHumanApproval_not_true");
  }
  if (result.learningMemory.safety.canOpenVault !== false) {
    violations.push("learningMemory_canOpenVault_not_false");
  }
  if (result.learningMemory.safety.confirmed !== false) {
    violations.push("learningMemory_confirmed_not_false");
  }
  if (result.learningMemory.safety.recommendationsAutoApplied !== false) {
    violations.push("learningMemory_recommendationsAutoApplied_not_false");
  }
  for (const hint of result.recoveryHints) {
    if (hint.canOpenVault !== false) {
      violations.push(`${hint.layerId}:hint_canOpenVault_not_false`);
    }
    if (hint.confirmed !== false) {
      violations.push(`${hint.layerId}:hint_confirmed_not_false`);
    }
  }
  return { ok: violations.length === 0, violations };
}

function inspectSourceMap(dna: unknown): DnaGuidedRecoverySourceMapUsed {
  const rec = asRecord(dna);
  const maps = asRecord(rec["maps"]);
  const encodeMap = asRecord(maps["encodeMap"]);
  const decodeMap = asRecord(maps["decodeMap"]);
  const layers = asArray(rec["layers"]).map(asRecord);
  const structuralFingerprint = asRecord(rec["structuralFingerprint"]);
  const contentDigest = asRecord(rec["contentDigest"]);
  const evidence = asRecord(rec["evidence"]);
  const regionCount = layers.reduce((sum, layer) => {
    return (
      sum +
      asArray(layer["units"])
        .map(asRecord)
        .reduce((unitSum, unit) => unitSum + asArray(unit["regions"]).length, 0)
    );
  }, 0);

  return {
    dnaPresent: Object.keys(rec).length > 0,
    encodeMapUsed: Object.keys(encodeMap).length > 0,
    decodeMapUsed: Object.keys(decodeMap).length > 0,
    layerMapUsed: layers.length > 0,
    structuralFingerprintUsed: Object.keys(structuralFingerprint).length > 0,
    contentDigestUsed: typeof contentDigest["hex"] === "string",
    evidenceIdPresent: typeof evidence["idHex"] === "string",
    layerIds: layers
      .map((layer) => stringOr(layer["layerId"], "unknown-layer"))
      .filter((layerId) => layerId !== "unknown-layer"),
    regionCount,
    mapKeys: [
      ...Object.keys(encodeMap).map((key) => `encodeMap.${key}`),
      ...Object.keys(decodeMap).map((key) => `decodeMap.${key}`),
    ],
  };
}

function extractSearchHints(
  module: DnaGuidedRecoveryModule,
  dna: unknown,
): DnaGuidedRecoverySearchHint[] {
  const layers = asArray(asRecord(dna)["layers"]).map(asRecord);
  const hints: DnaGuidedRecoverySearchHint[] = [];
  for (const layer of layers) {
    if (!layerBelongsToModule(layer, module)) continue;
    const layerId = stringOr(layer["layerId"], "unknown-layer");
    for (const unit of asArray(layer["units"]).map(asRecord)) {
      for (const region of asArray(unit["regions"]).map(asRecord)) {
        hints.push(regionToSearchHint(module, layerId, region));
      }
    }
  }
  return hints;
}

function regionToSearchHint(
  module: DnaGuidedRecoveryModule,
  layerId: string,
  region: Record<string, unknown>,
): DnaGuidedRecoverySearchHint {
  const base = {
    module,
    layerId,
    regionId: stringOr(region["regionId"], "unknown-region"),
    carries: stringOrNull(region["carries"]),
  };
  if (module === "video") {
    return compact({
      ...base,
      hintKind: "video_frame_region",
      frameIdx: numberOrUndefined(region["frameIdx"]),
      tsSec: numberOrUndefined(region["tsSec"]),
      x: numberOrUndefined(region["cx"]),
      y: numberOrUndefined(region["cy"]),
      width: numberOrUndefined(region["width"]),
      height: numberOrUndefined(region["height"]),
    }) as DnaGuidedRecoverySearchHint;
  }
  if (module === "image") {
    return compact({
      ...base,
      hintKind: "image_region",
      x: numberOrUndefined(region["cx"]),
      y: numberOrUndefined(region["cy"]),
      width: numberOrUndefined(region["width"]),
      height: numberOrUndefined(region["height"]),
    }) as DnaGuidedRecoverySearchHint;
  }
  if (module === "audio") {
    return compact({
      ...base,
      hintKind: "audio_time_frequency",
      timeStart: numberOrUndefined(region["timeStart"]),
      timeEnd: numberOrUndefined(region["timeEnd"]),
      freqBinStart: numberOrUndefined(region["freqBinStart"]),
      freqBinEnd: numberOrUndefined(region["freqBinEnd"]),
    }) as DnaGuidedRecoverySearchHint;
  }
  return compact({
    ...base,
    hintKind: "text_span_layer",
    charStart: numberOrUndefined(region["charStart"]),
    charEnd: numberOrUndefined(region["charEnd"]),
  }) as DnaGuidedRecoverySearchHint;
}

function buildRecoveryHints(
  module: DnaGuidedRecoveryModule,
  searchHints: DnaGuidedRecoverySearchHint[],
  damage: DnaGuidedDamageContext | undefined,
): DnaGuidedRecoveryHint[] {
  const attackType = cleanString(damage?.attackType, "lab_damage_unknown");
  const damagedArea = cleanString(damage?.damagedArea, defaultDamagedArea(module));
  const confidenceBase = module === "video" ? 0.76 : module === "image" ? 0.7 : 0.66;
  const hints = searchHints.length > 0 ? searchHints : [fallbackSearchHint(module)];
  return hints.slice(0, 8).map((hint, index) => ({
    module,
    layerId: hint.layerId,
    damagedArea,
    attackType,
    suggestedAction: suggestedActionFor(module, hint),
    reason: reasonFor(module, hint),
    confidence: round3(Math.max(0.2, confidenceBase - index * 0.04)),
    canOpenVault: false,
    confirmed: false,
  }));
}

function buildRepairPlan(
  module: DnaGuidedRecoveryModule,
  searchHints: DnaGuidedRecoverySearchHint[],
  sourceMapUsed: DnaGuidedRecoverySourceMapUsed,
): DnaGuidedRepairPlan {
  const targetLayers = unique(searchHints.map((hint) => hint.layerId));
  const targetRegions = unique(searchHints.map((hint) => hint.regionId));
  const targetLayerFallback =
    sourceMapUsed.layerIds.length > 0 ? sourceMapUsed.layerIds : [`${module}.unknown`];
  const targetRegionFallback = targetRegions.length > 0 ? targetRegions : [`${module}.unknown-region`];

  if (module === "video") {
    return baseRepairPlan({
      module,
      planKind: "temporary_video_frame_region_normalization",
      targetLayers: targetLayers.length > 0 ? targetLayers : targetLayerFallback,
      targetRegions: targetRegionFallback,
      steps: [
        "read DNA frame/time/region hints from layer map",
        "try nearby frame window around hinted frame without changing decoder thresholds",
        "normalize only the hinted region/crop for the real video decoder attempt",
        "prefer Channel B / visual trace / ECC support as search targets, not final decisions",
        "discard transient normalized frames after the lab read attempt",
      ],
      note:
        "Video recovery plan targets known DNA frame regions and nearby windows; it never estimates ID from missing frames.",
    });
  }
  if (module === "image") {
    return baseRepairPlan({
      module,
      planKind: "temporary_image_normalization",
      targetLayers: targetLayers.length > 0 ? targetLayers : targetLayerFallback,
      targetRegions: targetRegionFallback,
      steps: [
        "read DNA image region/vault/L1-L2-L3 layer hints",
        "try deskew, affine and mild perspective normalization on hinted region only",
        "expand crop margin around vault or L3 region before invoking the real image decoder",
        "use pHash/geometric checksum as a search consistency hint only",
        "discard transient normalized image after the lab read attempt",
      ],
      note:
        "Image recovery plan helps the real visual decoder sample the right region; it does not reconstruct the original image.",
    });
  }
  if (module === "audio") {
    return baseRepairPlan({
      module,
      planKind: "temporary_audio_alignment_bandpass",
      targetLayers: targetLayers.length > 0 ? targetLayers : targetLayerFallback,
      targetRegions: targetRegionFallback,
      steps: [
        "read DNA low-fsk / mid-fsk time-frequency trace map",
        "try targeted alignment offsets around the mapped trace start time",
        "focus temporary band-pass analysis on mapped zero/one carrier frequencies",
        "report matchingBits as advisory telemetry only",
        "discard transient aligned audio after the lab read attempt",
      ],
      note:
        "Audio recovery plan narrows time/frequency search for the real decoder; it never fills missing bits.",
    });
  }
  return baseRepairPlan({
    module,
    planKind: "temporary_text_span_layer_normalization",
    targetLayers: targetLayers.length > 0 ? targetLayers : targetLayerFallback,
    targetRegions: targetRegionFallback,
    steps: [
      "read DNA span/layer and linguistic fingerprint hints",
      "normalize whitespace/case around hinted span before real text scan",
      "probe canary, honeytoken, zero-width, linguistic and cascade traces separately",
      "report fuzzy/similarity as support only",
      "discard transient normalized text after the lab scan attempt",
    ],
    note:
      "Text recovery plan targets known spans and layers; fuzzy/support signals cannot confirm identity.",
  });
}

function baseRepairPlan(input: {
  module: DnaGuidedRecoveryModule;
  planKind: DnaGuidedRepairPlan["planKind"];
  steps: string[];
  targetLayers: string[];
  targetRegions: string[];
  note: string;
}): DnaGuidedRepairPlan {
  return {
    module: input.module,
    planKind: input.planKind,
    steps: input.steps,
    targetLayers: input.targetLayers,
    targetRegions: input.targetRegions,
    transientOnly: true,
    storesOriginalContent: false,
    usesOriginalContentCopy: false,
    predictedId: null,
    completesMissingId: false,
    outputForRealDecoderOnly: true,
    note: input.note,
  };
}

function buildRecoveryLearningRecord(input: {
  module: DnaGuidedRecoveryModule;
  searchHints: DnaGuidedRecoverySearchHint[];
  repairPlan: DnaGuidedRepairPlan;
  damage: DnaGuidedDamageContext | undefined;
}): DnaGuidedRecoveryLearningRecord {
  const success = input.damage?.success === true;
  return {
    module: input.module,
    layer: input.repairPlan.targetLayers[0] ?? `${input.module}.unknown`,
    attackType: cleanString(input.damage?.attackType, "lab_damage_unknown"),
    damagedArea: cleanString(input.damage?.damagedArea, defaultDamagedArea(input.module)),
    repairPlan: input.repairPlan.steps,
    recoveryAttempted: input.searchHints.length > 0,
    realIdReadAfterRepair: input.damage?.realIdReadAfterRepair === true,
    success,
    failureReason: success
      ? null
      : cleanString(input.damage?.failureReason, "not_measured_or_not_recovered"),
    humanApprovalRequired: true,
    autoApply: false,
    decisionRole: DNA_GUIDED_RECOVERY_LEARNING_DECISION_ROLE,
  };
}

function learningRecordToLearningTestRecord(
  record: DnaGuidedRecoveryLearningRecord,
): LearningTestRecord {
  return {
    recordId: `dna-guided-recovery-${record.module}-${slug(record.layer)}-${slug(record.attackType)}`,
    scenario: `dna_guided_recovery_${record.module}_${slug(record.attackType)}`,
    fileKind: record.module,
    expectedOutcome: "DNA_GUIDED_RECOVERY_LEARNING_RECORD_ONLY",
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: record.realIdReadAfterRepair,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules: [moduleObservation(record)],
    note: [
      `layer=${record.layer}`,
      `damagedArea=${record.damagedArea}`,
      `recoveryAttempted=${String(record.recoveryAttempted)}`,
      `realIdReadAfterRepair=${String(record.realIdReadAfterRepair)}`,
      `success=${String(record.success)}`,
      `humanApprovalRequired=${String(record.humanApprovalRequired)}`,
      `autoApply=${String(record.autoApply)}`,
      `decisionRole=${record.decisionRole}`,
      record.failureReason ? `failureReason=${record.failureReason}` : null,
    ].filter((item): item is string => item !== null).join("; "),
  };
}

function moduleObservation(
  record: DnaGuidedRecoveryLearningRecord,
): LearningModuleObservation {
  return {
    module: record.module,
    active: true,
    sealed: true,
    idRead: record.realIdReadAfterRepair,
    candidateSupport: true,
    confirmed: false,
    rescued: record.success,
    failed: !record.success,
    note:
      `${record.module}:${record.layer}; recoveryLearningOnly=true; ` +
      `canOpenVault=false; completesMissingId=false`,
  };
}

function recoverySafety(): DnaGuidedRecoverySafety {
  return {
    transientOnly: true,
    storesOriginalContent: false,
    predictedId: null,
    completesMissingId: false,
    generatesNonexistentId: false,
    dnaCanOpenVault: false,
    dnaConfirmed: false,
    dnaFinal: false,
    wrongIdCanOpenVault: false,
    idlessCanOpenVault: false,
    candidateSupportCanConfirm: false,
    canChangeThresholds: false,
    canChangeOwnershipBlock: false,
    canChangeEncodeAnalyze: false,
    productRouteChanged: false,
    autoApply: false,
    humanApprovalRequired: true,
  };
}

function layerBelongsToModule(
  layer: Record<string, unknown>,
  module: DnaGuidedRecoveryModule,
): boolean {
  const mediaType = layer["mediaType"];
  if (mediaType === module) return true;
  const layerId = stringOr(layer["layerId"], "").toLowerCase();
  if (module === "video") {
    return layerId.includes("video") || layerId.includes("triple") || layerId.includes("channel");
  }
  if (module === "image") {
    return layerId.startsWith("image.") || layerId.includes("visual") || layerId.includes("vault");
  }
  if (module === "audio") return layerId.includes("audio") || layerId.includes("fsk");
  return layerId.startsWith("text.") || layerId.includes("canary") || layerId.includes("linguistic");
}

function fallbackSearchHint(
  module: DnaGuidedRecoveryModule,
): DnaGuidedRecoverySearchHint {
  if (module === "video") {
    return {
      module,
      layerId: "video.unknown",
      regionId: "video.unknown-region",
      hintKind: "video_frame_region",
    };
  }
  if (module === "image") {
    return {
      module,
      layerId: "image.unknown",
      regionId: "image.unknown-region",
      hintKind: "image_region",
    };
  }
  if (module === "audio") {
    return {
      module,
      layerId: "audio.unknown",
      regionId: "audio.unknown-region",
      hintKind: "audio_time_frequency",
    };
  }
  return {
    module,
    layerId: "text.unknown",
    regionId: "text.unknown-region",
    hintKind: "text_span_layer",
  };
}

function suggestedActionFor(
  module: DnaGuidedRecoveryModule,
  hint: DnaGuidedRecoverySearchHint,
): string {
  if (module === "video") {
    const frame = typeof hint.frameIdx === "number" ? `frame ${hint.frameIdx}` : "DNA hinted frame";
    return `temporarily normalize ${frame} and nearby frame window before real video decode`;
  }
  if (module === "image") {
    return `temporarily deskew/affine-normalize ${hint.regionId} before real visual decode`;
  }
  if (module === "audio") {
    return `temporarily align and band-focus ${hint.regionId} before real audio decode`;
  }
  return `temporarily normalize text around ${hint.regionId} before real text scan`;
}

function reasonFor(
  module: DnaGuidedRecoveryModule,
  hint: DnaGuidedRecoverySearchHint,
): string {
  if (module === "video") {
    return `DNA layer ${hint.layerId} points to frame/time/region search coordinates.`;
  }
  if (module === "image") {
    return `DNA layer ${hint.layerId} points to image/vault/L1-L2-L3 region coordinates.`;
  }
  if (module === "audio") {
    return `DNA layer ${hint.layerId} points to time-frequency trace coordinates.`;
  }
  return `DNA layer ${hint.layerId} points to text span/layer coordinates.`;
}

function defaultDamagedArea(module: DnaGuidedRecoveryModule): string {
  if (module === "video") return "frame_time_region";
  if (module === "image") return "region_or_vault_area";
  if (module === "audio") return "time_frequency_trace";
  return "span_or_layer";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function cleanString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 240) : fallback;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw !== undefined && raw !== null) out[key] = raw;
  }
  return out as T;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return cleaned || "unknown";
}
