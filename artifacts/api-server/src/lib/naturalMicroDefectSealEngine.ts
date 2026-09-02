import { createHmac } from "node:crypto";

export const NATURAL_MICRO_DEFECT_SEAL_ENGINE_VERSION =
  "natural-micro-defect-seal-engine-v0.1" as const;
export const NATURAL_MICRO_DEFECT_DECISION_ROLE =
  "natural_micro_defect_support_only_no_vault_no_confirmed" as const;

export type NaturalMicroDefectDurabilityProfile =
  | "standard"
  | "legacy_resilience_lift"
  | "legacy_strength_invisible";

export type NaturalMicroDefectSurfaceKind =
  | "text_page"
  | "raster_image"
  | "technical_drawing"
  | "video_frame";

export type NaturalMicroDefectRiskProfile =
  | "creative_content"
  | "general_document"
  | "technical_content"
  | "medical_defense_legal";

export type NaturalMicroDefectType =
  | "paper_speckle"
  | "ink_spread"
  | "soft_tone_delta"
  | "line_tone_delta"
  | "compression_noise_like";

export type NaturalMicroDefectPolarity = "darken" | "lighten";

export type NaturalMicroDefectBand = "sync" | "payload" | "redundancy";

export type NaturalMicroDefectScaleLevel = 0 | 1 | 2;

export interface NaturalMicroDefectSafetyEnvelope {
  engineInsideTancMark: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
  dnaCanDecideAlone: false;
  textCharactersChanged: false;
  numbersChanged: false;
  wordsChanged: false;
  semanticMeaningChanged: false;
  visibleLogoFeature: false;
}

export interface NaturalMicroDefectPolicyInput {
  riskProfile: NaturalMicroDefectRiskProfile;
  explicitUserOptIn?: boolean;
  explicitSensitiveOverride?: boolean;
}

export interface NaturalMicroDefectPolicyDecision extends NaturalMicroDefectSafetyEnvelope {
  allowed: boolean;
  warningRequired: boolean;
  sensitiveUseBlocked: boolean;
  decisionRole: typeof NATURAL_MICRO_DEFECT_DECISION_ROLE;
  reason: string;
  warnings: string[];
}

export interface NaturalMicroDefectSurface {
  kind: NaturalMicroDefectSurfaceKind;
  width: number;
  height: number;
  frameCount?: number;
}

export interface NaturalMicroDefectSealInput {
  id: string;
  copyId: string;
  secret: string;
  surface: NaturalMicroDefectSurface;
  riskProfile: NaturalMicroDefectRiskProfile;
  explicitUserOptIn?: boolean;
  explicitSensitiveOverride?: boolean;
  density?: number;
  marksPerBit?: number;
  durabilityProfile?: NaturalMicroDefectDurabilityProfile;
  createdAt?: string;
}

export interface NaturalMicroDefectMark {
  index: number;
  bitIndex: number;
  repeatIndex: number;
  x: number;
  y: number;
  frameIndex: number | null;
  radiusPx: number;
  opacity: number;
  maxPixelDelta: number;
  visibilityDeltaCap: number;
  polarity: NaturalMicroDefectPolarity;
  defectType: NaturalMicroDefectType;
  band: NaturalMicroDefectBand;
  scaleLevel: NaturalMicroDefectScaleLevel;
  resilienceClass: NaturalMicroDefectDurabilityProfile;
}

export interface NaturalMicroDefectSealResult extends NaturalMicroDefectSafetyEnvelope {
  ok: boolean;
  id: string | null;
  copyId: string | null;
  readablePayloadBits: number;
  marks: NaturalMicroDefectMark[];
  policy: NaturalMicroDefectPolicyDecision;
  decisionRole: typeof NATURAL_MICRO_DEFECT_DECISION_ROLE;
  reason: string;
  createdAt: string;
}

export interface NaturalMicroDefectObservedMark {
  x: number;
  y: number;
  frameIndex?: number | null;
  polarity: NaturalMicroDefectPolarity;
}

export interface NaturalMicroDefectVerifyInput {
  expectedId: string;
  copyId: string;
  secret: string;
  surface: NaturalMicroDefectSurface;
  observedMarks: NaturalMicroDefectObservedMark[];
  riskProfile?: NaturalMicroDefectRiskProfile;
  explicitUserOptIn?: boolean;
  explicitSensitiveOverride?: boolean;
  density?: number;
  marksPerBit?: number;
  durabilityProfile?: NaturalMicroDefectDurabilityProfile;
  tolerancePx?: number;
}

export interface NaturalMicroDefectVerifyResult extends NaturalMicroDefectSafetyEnvelope {
  ok: boolean;
  expectedId: string | null;
  idMatched: boolean;
  bitMatchRatio: number;
  observedMatchCount: number;
  expectedMarkCount: number;
  decisionRole: typeof NATURAL_MICRO_DEFECT_DECISION_ROLE;
  reason: string;
}

export interface NaturalMicroDefectRasterInput {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  marks: NaturalMicroDefectMark[];
  frameIndex?: number | null;
}

export interface NaturalMicroDefectRasterResult extends NaturalMicroDefectSafetyEnvelope {
  ok: boolean;
  rgba: Uint8ClampedArray;
  changedPixelCount: number;
  maxObservedDelta: number;
  decisionRole: typeof NATURAL_MICRO_DEFECT_DECISION_ROLE;
  reason: string;
}

export interface NaturalMicroDefectRasterDetectInput {
  width: number;
  height: number;
  baselineRgba: Uint8ClampedArray | Uint8Array;
  candidateRgba: Uint8ClampedArray | Uint8Array;
  marks: NaturalMicroDefectMark[];
  frameIndex?: number | null;
  minMeanDelta?: number;
}

export interface NaturalMicroDefectRasterDetectResult extends NaturalMicroDefectSafetyEnvelope {
  ok: boolean;
  observedMarks: NaturalMicroDefectObservedMark[];
  detectedCount: number;
  missedCount: number;
  expectedMarkCount: number;
  detectionRatio: number;
  decisionRole: typeof NATURAL_MICRO_DEFECT_DECISION_ROLE;
  reason: string;
}

function safetyEnvelope(): NaturalMicroDefectSafetyEnvelope {
  return {
    engineInsideTancMark: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
    textCharactersChanged: false,
    numbersChanged: false,
    wordsChanged: false,
    semanticMeaningChanged: false,
    visibleLogoFeature: false,
  };
}

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isSupportedId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{4,128}$/.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hmacBytes(secret: string, message: string): Buffer {
  return createHmac("sha256", secret).update(message).digest();
}

function bytesToBits(bytes: Buffer, bitCount: number): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0 && bits.length < bitCount; bit -= 1) {
      bits.push((byte >> bit) & 1);
    }
    if (bits.length >= bitCount) break;
  }
  return bits;
}

function seedToUint32(seed: Buffer, offset: number): number {
  const safeOffset = offset % Math.max(1, seed.length - 4);
  return seed.readUInt32BE(safeOffset);
}

function createPrng(seed: Buffer): () => number {
  let state = seedToUint32(seed, 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff);
  };
}

function defectTypesForSurface(kind: NaturalMicroDefectSurfaceKind): NaturalMicroDefectType[] {
  if (kind === "text_page") return ["paper_speckle", "ink_spread", "soft_tone_delta"];
  if (kind === "technical_drawing") return ["line_tone_delta", "paper_speckle", "soft_tone_delta"];
  if (kind === "video_frame") return ["compression_noise_like", "soft_tone_delta", "paper_speckle"];
  return ["soft_tone_delta", "paper_speckle", "compression_noise_like"];
}

function validateSurface(surface: NaturalMicroDefectSurface): boolean {
  if (!Number.isFinite(surface.width) || !Number.isFinite(surface.height)) return false;
  if (surface.width < 64 || surface.height < 64) return false;
  if (surface.kind === "video_frame") {
    return Number.isFinite(surface.frameCount) && (surface.frameCount ?? 0) > 0;
  }
  return true;
}

function normalizeDurabilityProfile(
  value: NaturalMicroDefectDurabilityProfile | null | undefined,
): NaturalMicroDefectDurabilityProfile {
  if (value === "legacy_strength_invisible") return "legacy_strength_invisible";
  return value === "legacy_resilience_lift" ? "legacy_resilience_lift" : "standard";
}

function resolveDurabilitySettings(input: {
  profile: NaturalMicroDefectDurabilityProfile;
  density?: number;
  marksPerBit?: number;
}): {
  density: number;
  marksPerBit: number;
  bitCount: number;
  maxDeltaCap: number;
  visibilityDeltaCap: number;
  gridCellsX: number;
  gridCellsY: number;
} {
  const requestedDensity = clamp(input.density ?? 1, 0.25, 2.5);
  if (input.profile === "legacy_strength_invisible") {
    const requestedMarks = Math.floor(input.marksPerBit ?? 11);
    const marksPerBit = Math.max(13, Math.min(17, requestedMarks + 4));
    const density = clamp(requestedDensity * 2.25, 1, 3.75);
    return {
      density,
      marksPerBit,
      bitCount: Math.max(64, Math.min(128, Math.floor(32 * density))),
      maxDeltaCap: 8,
      visibilityDeltaCap: 14,
      gridCellsX: 12,
      gridCellsY: 12,
    };
  }
  if (input.profile === "legacy_resilience_lift") {
    const requestedMarks = Math.floor(input.marksPerBit ?? 7);
    const marksPerBit = Math.max(7, Math.min(11, requestedMarks + 2));
    const density = clamp(requestedDensity * 1.45, 0.5, 3.25);
    return {
      density,
      marksPerBit,
      bitCount: Math.max(32, Math.min(96, Math.floor(32 * density))),
      maxDeltaCap: 6,
      visibilityDeltaCap: 10,
      gridCellsX: 10,
      gridCellsY: 10,
    };
  }

  const marksPerBit = Math.max(3, Math.min(7, Math.floor(input.marksPerBit ?? 5)));
  return {
    density: requestedDensity,
    marksPerBit,
    bitCount: Math.max(32, Math.min(96, Math.floor(32 * requestedDensity))),
    maxDeltaCap: 4,
    visibilityDeltaCap: 6,
    gridCellsX: 1,
    gridCellsY: 1,
  };
}

function markBand(bitIndex: number, repeatIndex: number, profile: NaturalMicroDefectDurabilityProfile): NaturalMicroDefectBand {
  if (profile === "standard") return "payload";
  if (profile === "legacy_strength_invisible") {
    if (bitIndex % 6 === 0 && repeatIndex <= 2) return "sync";
    if (repeatIndex >= 9) return "redundancy";
    return "payload";
  }
  if (bitIndex % 8 === 0 && repeatIndex <= 1) return "sync";
  if (repeatIndex >= 7) return "redundancy";
  return "payload";
}

function createMarkPosition(input: {
  surface: NaturalMicroDefectSurface;
  profile: NaturalMicroDefectDurabilityProfile;
  bitIndex: number;
  repeatIndex: number;
  marksPerBit: number;
  marginX: number;
  marginY: number;
  random: () => number;
  gridCellsX: number;
  gridCellsY: number;
}): { x: number; y: number; frameIndex: number | null } {
  const safeWidth = Math.max(1, input.surface.width - input.marginX * 2);
  const safeHeight = Math.max(1, input.surface.height - input.marginY * 2);

  if (input.profile !== "standard") {
    const totalCells = input.gridCellsX * input.gridCellsY;
    const cellIndex =
      (input.bitIndex * 37 + input.repeatIndex * 19 + input.bitIndex * input.marksPerBit) % totalCells;
    const cellX = cellIndex % input.gridCellsX;
    const cellY = Math.floor(cellIndex / input.gridCellsX);
    const x = Math.round(
      input.marginX + ((cellX + 0.13 + input.random() * 0.74) / input.gridCellsX) * safeWidth,
    );
    const y = Math.round(
      input.marginY + ((cellY + 0.13 + input.random() * 0.74) / input.gridCellsY) * safeHeight,
    );
    const frameIndex =
      input.surface.kind === "video_frame"
        ? (input.bitIndex * 5 + input.repeatIndex * 7) % Math.max(1, input.surface.frameCount ?? 1)
        : null;
    return {
      x: clamp(x, input.marginX, input.surface.width - input.marginX),
      y: clamp(y, input.marginY, input.surface.height - input.marginY),
      frameIndex,
    };
  }

  const x = Math.round(input.marginX + input.random() * safeWidth);
  const y = Math.round(input.marginY + input.random() * safeHeight);
  const frameIndex =
    input.surface.kind === "video_frame"
      ? Math.floor(input.random() * Math.max(1, input.surface.frameCount ?? 1))
      : null;
  return { x, y, frameIndex };
}

export function evaluateNaturalMicroDefectPolicy(
  input: NaturalMicroDefectPolicyInput,
): NaturalMicroDefectPolicyDecision {
  const base = {
    ...safetyEnvelope(),
    decisionRole: NATURAL_MICRO_DEFECT_DECISION_ROLE,
  };
  const warnings = [
    "Natural micro-defect seal changes the visual surface slightly, not text/rakam/kelime.",
    "Use sidecar/metadata-only mode for zero-change sensitive content.",
  ];

  if (input.riskProfile === "medical_defense_legal" && input.explicitSensitiveOverride !== true) {
    return {
      ...base,
      allowed: false,
      warningRequired: true,
      sensitiveUseBlocked: true,
      reason: "sensitive_content_requires_explicit_override",
      warnings,
    };
  }

  if (input.riskProfile !== "creative_content" && input.explicitUserOptIn !== true) {
    return {
      ...base,
      allowed: false,
      warningRequired: true,
      sensitiveUseBlocked: false,
      reason: "non_creative_content_requires_explicit_opt_in",
      warnings,
    };
  }

  return {
    ...base,
    allowed: true,
    warningRequired: input.riskProfile !== "creative_content",
    sensitiveUseBlocked: false,
    reason:
      input.riskProfile === "creative_content"
        ? "creative_content_micro_defect_allowed"
        : "explicit_user_opt_in_micro_defect_allowed",
    warnings,
  };
}

export function createNaturalMicroDefectSeal(
  input: NaturalMicroDefectSealInput,
): NaturalMicroDefectSealResult {
  const id = normalizeId(input.id);
  const copyId = normalizeId(input.copyId);
  const policy = evaluateNaturalMicroDefectPolicy(input);
  const base = {
    ...safetyEnvelope(),
    id,
    copyId,
    readablePayloadBits: 0,
    marks: [] as NaturalMicroDefectMark[],
    policy,
    decisionRole: NATURAL_MICRO_DEFECT_DECISION_ROLE,
    createdAt: input.createdAt ?? new Date(0).toISOString(),
  };

  if (!id || !copyId || !isSupportedId(id) || !isSupportedId(copyId)) {
    return { ...base, ok: false, reason: "invalid_or_missing_exact_id_or_copy_id" };
  }
  if (!input.secret || input.secret.length < 8) {
    return { ...base, ok: false, reason: "secret_too_short" };
  }
  if (!validateSurface(input.surface)) {
    return { ...base, ok: false, reason: "invalid_surface" };
  }
  if (!policy.allowed) {
    return { ...base, ok: false, reason: policy.reason };
  }

  const durabilityProfile = normalizeDurabilityProfile(input.durabilityProfile);
  const durability = resolveDurabilitySettings({
    profile: durabilityProfile,
    density: input.density,
    marksPerBit: input.marksPerBit,
  });
  const message = [
    NATURAL_MICRO_DEFECT_SEAL_ENGINE_VERSION,
    durabilityProfile,
    id,
    copyId,
    input.surface.kind,
    input.surface.width,
    input.surface.height,
    input.surface.frameCount ?? 1,
  ].join("|");
  const payloadBits = bytesToBits(hmacBytes(input.secret, `payload|${message}`), durability.bitCount);
  const random = createPrng(hmacBytes(input.secret, `layout|${message}`));
  const defectTypes = defectTypesForSurface(input.surface.kind);
  const marginX = Math.max(8, Math.floor(input.surface.width * 0.04));
  const marginY = Math.max(8, Math.floor(input.surface.height * 0.04));
  const marks: NaturalMicroDefectMark[] = [];

  for (let bitIndex = 0; bitIndex < payloadBits.length; bitIndex += 1) {
    const bit = payloadBits[bitIndex] ?? 0;
    for (let repeatIndex = 0; repeatIndex < durability.marksPerBit; repeatIndex += 1) {
      const position = createMarkPosition({
        surface: input.surface,
        profile: durabilityProfile,
        bitIndex,
        repeatIndex,
        marksPerBit: durability.marksPerBit,
        marginX,
        marginY,
        random,
        gridCellsX: durability.gridCellsX,
        gridCellsY: durability.gridCellsY,
      });
      const defectType = defectTypes[Math.floor(random() * defectTypes.length)] ?? "paper_speckle";
      const scaleLevel = (repeatIndex % 3) as NaturalMicroDefectScaleLevel;
      const radiusBase =
        durabilityProfile === "legacy_strength_invisible"
          ? 1.05 + scaleLevel * 0.42
          : durabilityProfile === "legacy_resilience_lift"
            ? 0.8 + scaleLevel * 0.34
            : 0.6;
      const radiusPx = Number(
        (
          radiusBase +
          random() *
            (durabilityProfile === "legacy_strength_invisible"
              ? 1.05
              : durabilityProfile === "legacy_resilience_lift"
                ? 0.95
                : 1.4)
        ).toFixed(3),
      );
      const opacity =
        durabilityProfile === "legacy_strength_invisible"
          ? Number((0.012 + random() * 0.02).toFixed(4))
          : durabilityProfile === "legacy_resilience_lift"
            ? Number((0.009 + random() * 0.014).toFixed(4))
            : Number((0.006 + random() * 0.012).toFixed(4));
      marks.push({
        index: marks.length,
        bitIndex,
        repeatIndex,
        x: position.x,
        y: position.y,
        frameIndex: position.frameIndex,
        radiusPx,
        opacity,
        maxPixelDelta: Math.max(1, Math.min(durability.maxDeltaCap, Math.round(opacity * 255))),
        visibilityDeltaCap: durability.visibilityDeltaCap,
        polarity: bit === 1 ? "darken" : "lighten",
        defectType,
        band: markBand(bitIndex, repeatIndex, durabilityProfile),
        scaleLevel,
        resilienceClass: durabilityProfile,
      });
    }
  }

  return {
    ...base,
    ok: true,
    readablePayloadBits: payloadBits.length,
    marks,
    reason: "natural_micro_defect_plan_created_support_only",
  };
}

export function verifyNaturalMicroDefectSeal(
  input: NaturalMicroDefectVerifyInput,
): NaturalMicroDefectVerifyResult {
  const expectedId = normalizeId(input.expectedId);
  const base = {
    ...safetyEnvelope(),
    expectedId,
    idMatched: false,
    bitMatchRatio: 0,
    observedMatchCount: 0,
    expectedMarkCount: 0,
    decisionRole: NATURAL_MICRO_DEFECT_DECISION_ROLE,
  };

  if (!expectedId || !isSupportedId(expectedId)) {
    return { ...base, ok: false, reason: "invalid_or_missing_expected_id" };
  }

  const plan = createNaturalMicroDefectSeal({
    id: expectedId,
    copyId: input.copyId,
    secret: input.secret,
    surface: input.surface,
    riskProfile: input.riskProfile ?? "creative_content",
    explicitUserOptIn: input.explicitUserOptIn,
    explicitSensitiveOverride: input.explicitSensitiveOverride,
    density: input.density,
    marksPerBit: input.marksPerBit,
    durabilityProfile: input.durabilityProfile,
  });
  if (!plan.ok) {
    return { ...base, ok: false, reason: plan.reason };
  }

  const tolerance = clamp(input.tolerancePx ?? 2.75, 0.5, 10);
  const observed = input.observedMarks;
  const bitVotes = new Map<number, { hit: number; total: number }>();
  let matchCount = 0;

  for (const expected of plan.marks) {
    const hit = observed.some((item) => {
      const frameMatches =
        expected.frameIndex === null ||
        item.frameIndex === undefined ||
        item.frameIndex === null ||
        item.frameIndex === expected.frameIndex;
      const dx = item.x - expected.x;
      const dy = item.y - expected.y;
      return (
        frameMatches &&
        item.polarity === expected.polarity &&
        Math.sqrt(dx * dx + dy * dy) <= tolerance
      );
    });
    const vote = bitVotes.get(expected.bitIndex) ?? { hit: 0, total: 0 };
    vote.total += 1;
    if (hit) {
      vote.hit += 1;
      matchCount += 1;
    }
    bitVotes.set(expected.bitIndex, vote);
  }

  let matchedBits = 0;
  for (const vote of bitVotes.values()) {
    if (vote.hit / Math.max(1, vote.total) >= 0.55) matchedBits += 1;
  }
  const bitMatchRatio = bitVotes.size > 0 ? matchedBits / bitVotes.size : 0;
  const idMatched = bitMatchRatio >= 0.72 && matchCount >= Math.ceil(plan.marks.length * 0.48);

  return {
    ...base,
    ok: true,
    idMatched,
    bitMatchRatio: Number(bitMatchRatio.toFixed(4)),
    observedMatchCount: matchCount,
    expectedMarkCount: plan.marks.length,
    reason: idMatched
      ? "natural_micro_defect_pattern_matched_support_only_no_vault"
      : "natural_micro_defect_pattern_not_matched_no_vault",
  };
}

export function applyNaturalMicroDefectToRaster(
  input: NaturalMicroDefectRasterInput,
): NaturalMicroDefectRasterResult {
  const base = {
    ...safetyEnvelope(),
    decisionRole: NATURAL_MICRO_DEFECT_DECISION_ROLE,
  };
  if (input.width <= 0 || input.height <= 0 || input.rgba.length !== input.width * input.height * 4) {
    return {
      ...base,
      ok: false,
      rgba: input.rgba,
      changedPixelCount: 0,
      maxObservedDelta: 0,
      reason: "invalid_raster",
    };
  }

  const output = new Uint8ClampedArray(input.rgba);
  let changedPixelCount = 0;
  let maxObservedDelta = 0;
  const targetFrame = input.frameIndex ?? null;

  for (const mark of input.marks) {
    if (targetFrame !== null && mark.frameIndex !== null && targetFrame !== mark.frameIndex) continue;
    const radius = Math.max(0.5, mark.radiusPx);
    const minX = clamp(Math.floor(mark.x - radius), 0, input.width - 1);
    const maxX = clamp(Math.ceil(mark.x + radius), 0, input.width - 1);
    const minY = clamp(Math.floor(mark.y - radius), 0, input.height - 1);
    const maxY = clamp(Math.ceil(mark.y + radius), 0, input.height - 1);
    const sign = mark.polarity === "darken" ? -1 : 1;
    const delta = sign * mark.maxPixelDelta;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - mark.x;
        const dy = y - mark.y;
        if (Math.sqrt(dx * dx + dy * dy) > radius) continue;
        const offset = (y * input.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const origin = input.rgba[offset + channel] ?? 0;
          const before = output[offset + channel] ?? 0;
          const visibilityCap = Math.max(1, mark.visibilityDeltaCap ?? Math.max(4, mark.maxPixelDelta * 2));
          const after = clamp(before + delta, Math.max(0, origin - visibilityCap), Math.min(255, origin + visibilityCap));
          output[offset + channel] = after;
          maxObservedDelta = Math.max(maxObservedDelta, Math.abs(after - before));
        }
        changedPixelCount += 1;
      }
    }
  }

  return {
    ...base,
    ok: true,
    rgba: output,
    changedPixelCount,
    maxObservedDelta,
    reason: "natural_micro_defect_raster_applied_support_only",
  };
}

export function detectNaturalMicroDefectFromRaster(
  input: NaturalMicroDefectRasterDetectInput,
): NaturalMicroDefectRasterDetectResult {
  const base = {
    ...safetyEnvelope(),
    decisionRole: NATURAL_MICRO_DEFECT_DECISION_ROLE,
  };
  if (
    input.width <= 0 ||
    input.height <= 0 ||
    input.baselineRgba.length !== input.width * input.height * 4 ||
    input.candidateRgba.length !== input.width * input.height * 4
  ) {
    return {
      ...base,
      ok: false,
      observedMarks: [],
      detectedCount: 0,
      missedCount: input.marks.length,
      expectedMarkCount: input.marks.length,
      detectionRatio: 0,
      reason: "invalid_raster_pair",
    };
  }

  const minMeanDelta = clamp(input.minMeanDelta ?? 0.35, 0.02, 12);
  const targetFrame = input.frameIndex ?? null;
  const observedMarks: NaturalMicroDefectObservedMark[] = [];
  let considered = 0;

  for (const mark of input.marks) {
    if (targetFrame !== null && mark.frameIndex !== null && targetFrame !== mark.frameIndex) continue;
    considered += 1;
    const radius = Math.max(0.75, mark.radiusPx * 1.15);
    const minX = clamp(Math.floor(mark.x - radius), 0, input.width - 1);
    const maxX = clamp(Math.ceil(mark.x + radius), 0, input.width - 1);
    const minY = clamp(Math.floor(mark.y - radius), 0, input.height - 1);
    const maxY = clamp(Math.ceil(mark.y + radius), 0, input.height - 1);
    let totalDelta = 0;
    let sampleCount = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - mark.x;
        const dy = y - mark.y;
        if (Math.sqrt(dx * dx + dy * dy) > radius) continue;
        const offset = (y * input.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          totalDelta +=
            (input.candidateRgba[offset + channel] ?? 0) -
            (input.baselineRgba[offset + channel] ?? 0);
          sampleCount += 1;
        }
      }
    }

    const meanDelta = sampleCount > 0 ? totalDelta / sampleCount : 0;
    const detectedPolarity: NaturalMicroDefectPolarity | null =
      meanDelta <= -minMeanDelta ? "darken" : meanDelta >= minMeanDelta ? "lighten" : null;
    if (detectedPolarity === mark.polarity) {
      observedMarks.push({
        x: mark.x,
        y: mark.y,
        frameIndex: mark.frameIndex,
        polarity: detectedPolarity,
      });
    }
  }

  const detectedCount = observedMarks.length;
  const missedCount = Math.max(0, considered - detectedCount);
  const detectionRatio = considered > 0 ? detectedCount / considered : 0;

  return {
    ...base,
    ok: true,
    observedMarks,
    detectedCount,
    missedCount,
    expectedMarkCount: considered,
    detectionRatio: Number(detectionRatio.toFixed(4)),
    reason:
      detectedCount > 0
        ? "natural_micro_defect_raster_detected_support_only"
        : "natural_micro_defect_raster_not_detected_no_vault",
  };
}
