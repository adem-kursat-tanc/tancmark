import { createHash } from "node:crypto";
import sharp, { type Sharp } from "sharp";

export const JPG_PNG_AI_SEAL_FEATURE_FLAG =
  "TANCMARK_AI_SEAL_JPG_PNG_ENABLED" as const;

export const JPG_PNG_AI_SEAL_DECISION_ROLE =
  "jpg_png_ai_exact_id_ownership_no_vault_no_final" as const;

export const JPG_PNG_AI_SEAL_VERSION = "tancmark-ai-seal-jpg-png-mvp-v1" as const;

export type JpgPngAiSealDisplayText =
  | "AI kesin ID okundu"
  | "AI destek izi bulunamadi"
  | "Zayif AI sinyal var";

export type JpgPngAiSealOwnershipDecision =
  | "ai_ownership_asserted_by_exact_id"
  | "ai_weak_trace_percent_only"
  | "ai_ownership_not_asserted";

export type JpgPngAiSealOperation = "embed" | "search" | "degraded_recovery";

export interface JpgPngAiSealGate {
  module: "jpg_png_ai_seal";
  enabled: boolean;
  featureFlag: typeof JPG_PNG_AI_SEAL_FEATURE_FLAG;
  defaultEnabled: false;
  productReady: false;
  decisionRole: typeof JPG_PNG_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface JpgPngAiSealTokenEstimateInput {
  operation: JpgPngAiSealOperation;
  sizeBytes: number;
  width?: number | undefined;
  height?: number | undefined;
}

export interface JpgPngAiSealTokenEstimate {
  operation: JpgPngAiSealOperation;
  estimatedTokens: number;
  userMessage: string;
  approveButton: "Onayla ve islemi baslat";
  cancelButton: "Iptal et";
  requiresExplicitApproval: true;
}

export interface SealJpgPngAiImageInput {
  image: Buffer;
  tancmarkId: string;
  outputFormat?: "png" | "jpeg" | undefined;
  strength?: number | undefined;
}

export interface SealJpgPngAiImageResult {
  image: Buffer;
  format: "png" | "jpeg";
  width: number;
  height: number;
  decisionRole: typeof JPG_PNG_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
  originalMutated: false;
}

export interface ReadJpgPngAiSealInput {
  image: Buffer;
  expectedTancmarkId: string;
}

export interface ReadJpgPngAiSealResult {
  found: boolean;
  weakSignal: boolean;
  score: number;
  displayText: JpgPngAiSealDisplayText;
  decisionRole: typeof JPG_PNG_AI_SEAL_DECISION_ROLE;
  canAssertAiOwnership: boolean;
  aiOwnershipDecision: JpgPngAiSealOwnershipDecision;
  ownershipConfidencePercent: number;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

interface RawRgbImage {
  data: Buffer;
  width: number;
  height: number;
}

interface CorrelationTransform {
  scale: number;
  offsetRatioX: number;
  offsetRatioY: number;
}

const MAX_SUPPORTED_PIXELS = 24_000_000;
const DEFAULT_STRENGTH = 20;
const FOUND_THRESHOLD = 0.105;
const SECONDARY_FOUND_THRESHOLD = 0.09;
const WEAK_THRESHOLD = 0.065;
const SECONDARY_WEAK_THRESHOLD = 0.065;
const SPECIFICITY_FOUND_MARGIN = 0.014;
const SPECIFICITY_WEAK_MARGIN = 0.004;
const LUMA_FOUND_THRESHOLD = 0.13;
const LUMA_WEAK_THRESHOLD = 0.085;
const LUMA_SPECIFICITY_FOUND_MARGIN = 0.02;
const LUMA_SPECIFICITY_WEAK_MARGIN = 0.006;
const EMBED_PATTERNS = [
  { period: 24, weight: 0.34 },
  { period: 32, weight: 0.42 },
  { period: 40, weight: 0.24 },
] as const;

type AiSealPatternChannel = "primary" | "secondary" | "luma";

export function getJpgPngAiSealGate(
  env: NodeJS.ProcessEnv = process.env,
): JpgPngAiSealGate {
  return {
    module: "jpg_png_ai_seal",
    enabled: env[JPG_PNG_AI_SEAL_FEATURE_FLAG] === "1" || env[JPG_PNG_AI_SEAL_FEATURE_FLAG] === "true",
    featureFlag: JPG_PNG_AI_SEAL_FEATURE_FLAG,
    defaultEnabled: false,
    productReady: false,
    decisionRole: JPG_PNG_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export function estimateJpgPngAiSealTokens(
  input: JpgPngAiSealTokenEstimateInput,
): JpgPngAiSealTokenEstimate {
  const megapixels = Math.max(
    1,
    Math.ceil(((input.width ?? 1000) * (input.height ?? 1000)) / 1_000_000),
  );
  const sizeFactor = Math.max(1, Math.ceil(input.sizeBytes / 1_500_000));
  const base =
    input.operation === "embed" ? 180 : input.operation === "search" ? 160 : 360;
  const estimatedTokens = base + Math.max(megapixels, sizeFactor) * 40;
  return {
    operation: input.operation,
    estimatedTokens,
    userMessage: `Bu islem yaklasik ${estimatedTokens} token yakacak.`,
    approveButton: "Onayla ve islemi baslat",
    cancelButton: "Iptal et",
    requiresExplicitApproval: true,
  };
}

export async function sealJpgPngAiImage(
  input: SealJpgPngAiImageInput,
): Promise<SealJpgPngAiImageResult> {
  assertFeatureEnabled();
  assertSafeId(input.tancmarkId);

  const raw = await decodeJpgPng(input.image);
  const strength = clampInt(input.strength ?? DEFAULT_STRENGTH, 8, 72);
  const output = Buffer.from(raw.data);
  const primaryDigest = createPatternDigest(input.tancmarkId, "primary");
  const secondaryDigest = createPatternDigest(input.tancmarkId, "secondary");
  const lumaDigest = createPatternDigest(input.tancmarkId, "luma");

  for (let y = 0; y < raw.height; y += 1) {
    for (let x = 0; x < raw.width; x += 1) {
      const primarySignal = mixedPatternSignal(primaryDigest, x, y, raw.width, raw.height);
      const secondarySignal = mixedPatternSignal(secondaryDigest, x, y, raw.width, raw.height);
      const index = (y * raw.width + x) * 3;
      const red = output[index] ?? 0;
      const green = output[index + 1] ?? 0;
      const blue = output[index + 2] ?? 0;
      const lumaSignal = mixedPatternSignal(lumaDigest, x, y, raw.width, raw.height);
      const lumaDelta = Math.round(lumaSignal * strength * 0.42);
      output[index] = clampByte(red - Math.round(primarySignal * strength * 0.42));
      output[index] = clampByte((output[index] ?? 0) + lumaDelta);
      output[index + 1] = clampByte(green + Math.round(secondarySignal * strength) + lumaDelta);
      output[index + 2] = clampByte(blue + Math.round(primarySignal * strength * 0.74) + lumaDelta);
    }
  }

  const format = input.outputFormat ?? (await inferFormat(input.image));
  const image = await encodeRgb(output, raw.width, raw.height, format);

  return {
    image,
    format,
    width: raw.width,
    height: raw.height,
    decisionRole: JPG_PNG_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
    originalMutated: false,
  };
}

export async function readJpgPngAiSeal(
  input: ReadJpgPngAiSealInput,
): Promise<ReadJpgPngAiSealResult> {
  assertFeatureEnabled();
  assertSafeId(input.expectedTancmarkId);

  const rawCandidates = await decodeJpgPngReadCandidates(input.image);
  let primaryScore = 0;
  let secondaryScore = 0;
  for (const raw of rawCandidates) {
    const candidatePrimary = bestCorrelationScore(raw, input.expectedTancmarkId, "primary");
    const candidateSecondary = bestCorrelationScore(raw, input.expectedTancmarkId, "secondary");
    if (Math.min(candidatePrimary, candidateSecondary) > Math.min(primaryScore, secondaryScore)) {
      primaryScore = candidatePrimary;
      secondaryScore = candidateSecondary;
    }
  }
  let lumaScore = 0;
  for (const raw of rawCandidates) {
    lumaScore = Math.max(lumaScore, bestCorrelationScore(raw, input.expectedTancmarkId, "luma"));
  }
  const specificityMargin = specificityGap(rawCandidates, input.expectedTancmarkId, Math.min(primaryScore, secondaryScore));
  const lumaSpecificityMargin = channelSpecificityGap(
    rawCandidates,
    input.expectedTancmarkId,
    "luma",
    lumaScore,
  );
  const pairScore = Math.min(primaryScore, secondaryScore);
  const score = round4(Math.max(pairScore, lumaScore));
  const pairFound =
    primaryScore >= FOUND_THRESHOLD &&
    secondaryScore >= SECONDARY_FOUND_THRESHOLD &&
    specificityMargin >= SPECIFICITY_FOUND_MARGIN;
  const lumaFound =
    lumaScore >= LUMA_FOUND_THRESHOLD &&
    lumaSpecificityMargin >= LUMA_SPECIFICITY_FOUND_MARGIN;
  const found = pairFound || lumaFound;
  const pairWeak =
    primaryScore >= WEAK_THRESHOLD &&
    secondaryScore >= SECONDARY_WEAK_THRESHOLD &&
    specificityMargin >= SPECIFICITY_WEAK_MARGIN;
  const lumaWeak =
    lumaScore >= LUMA_WEAK_THRESHOLD &&
    lumaSpecificityMargin >= LUMA_SPECIFICITY_WEAK_MARGIN;
  const weakSignal = !found && (pairWeak || lumaWeak);
  const ownershipConfidencePercent = confidencePercent(found, weakSignal, score);
  const displayText: JpgPngAiSealDisplayText = found
    ? "AI kesin ID okundu"
    : weakSignal
      ? "Zayif AI sinyal var"
      : "AI destek izi bulunamadi";

  return {
    found,
    weakSignal,
    score,
    displayText,
    decisionRole: JPG_PNG_AI_SEAL_DECISION_ROLE,
    canAssertAiOwnership: found,
    aiOwnershipDecision: found
      ? "ai_ownership_asserted_by_exact_id"
      : weakSignal
        ? "ai_weak_trace_percent_only"
        : "ai_ownership_not_asserted",
    ownershipConfidencePercent,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

function confidencePercent(found: boolean, weakSignal: boolean, score: number): number {
  const scaled = clampInt(Math.round(score * 100), 0, 100);
  if (found) return clampInt(Math.max(95, scaled), 95, 100);
  if (weakSignal) return clampInt(Math.max(1, scaled), 1, 94);
  return 0;
}

async function decodeJpgPng(image: Buffer): Promise<RawRgbImage> {
  return decodeJpgPngWithPipeline(sharp(image), image);
}

async function decodeJpgPngReadCandidates(image: Buffer): Promise<RawRgbImage[]> {
  return [
    await decodeJpgPngWithPipeline(sharp(image), image),
    await decodeJpgPngWithPipeline(
      sharp(image)
        .normalise()
        .sharpen({ sigma: 0.6, m1: 0.7, m2: 1.2 }),
      image,
    ),
    await decodeJpgPngWithPipeline(
      sharp(image)
        .linear(0.78, 14)
        .normalise()
        .sharpen({ sigma: 0.5, m1: 0.55, m2: 1.05 }),
      image,
    ),
  ];
}

async function decodeJpgPngWithPipeline(
  pipeline: Sharp,
  sourceImage: Buffer,
): Promise<RawRgbImage> {
  const metadata = await sharp(sourceImage).metadata();
  if (metadata.format !== "jpeg" && metadata.format !== "png") {
    throw new Error("unsupported_ai_seal_image_format");
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0 || width * height > MAX_SUPPORTED_PIXELS) {
    throw new Error("unsafe_ai_seal_image_dimensions");
  }
  const { data, info } = await pipeline
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error("unsupported_ai_seal_channel_count");
  }
  return {
    data,
    width: info.width,
    height: info.height,
  };
}

async function inferFormat(image: Buffer): Promise<"png" | "jpeg"> {
  const metadata = await sharp(image).metadata();
  return metadata.format === "jpeg" ? "jpeg" : "png";
}

async function encodeRgb(
  data: Buffer,
  width: number,
  height: number,
  format: "png" | "jpeg",
): Promise<Buffer> {
  const pipeline = sharp(data, { raw: { width, height, channels: 3 } });
  return format === "jpeg"
    ? pipeline.jpeg({ quality: 94, mozjpeg: false }).toBuffer()
    : pipeline.png({ compressionLevel: 8 }).toBuffer();
}

function bestCorrelationScore(
  raw: RawRgbImage,
  tancmarkId: string,
  channel: AiSealPatternChannel,
): number {
  const patternDigest = createPatternDigest(tancmarkId, channel);
  const candidateTransforms = buildCorrelationTransforms();
  let best = -1;

  for (const transform of candidateTransforms) {
    const score = correlationScore(raw, patternDigest, channel, transform);
    if (score > best) best = score;
  }

  return Math.max(0, best);
}

function specificityGap(
  rawCandidates: RawRgbImage[],
  tancmarkId: string,
  expectedCombinedScore: number,
): number {
  const decoyIds = [
    `${tancmarkId}:decoy-a`,
    `${tancmarkId}:decoy-b`,
    `${tancmarkId}:decoy-c`,
  ];
  let bestDecoy = 0;
  for (const decoyId of decoyIds) {
    for (const raw of rawCandidates) {
      const primary = bestCorrelationScore(raw, decoyId, "primary");
      const secondary = bestCorrelationScore(raw, decoyId, "secondary");
      bestDecoy = Math.max(bestDecoy, Math.min(primary, secondary));
    }
  }
  return expectedCombinedScore - bestDecoy;
}

function channelSpecificityGap(
  rawCandidates: RawRgbImage[],
  tancmarkId: string,
  channel: AiSealPatternChannel,
  expectedScore: number,
): number {
  const decoyIds = [
    `${tancmarkId}:decoy-a`,
    `${tancmarkId}:decoy-b`,
    `${tancmarkId}:decoy-c`,
  ];
  let bestDecoy = 0;
  for (const decoyId of decoyIds) {
    for (const raw of rawCandidates) {
      bestDecoy = Math.max(bestDecoy, bestCorrelationScore(raw, decoyId, channel));
    }
  }
  return expectedScore - bestDecoy;
}

function mixedPatternSignal(
  patternDigest: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  let signal = 0;
  for (const pattern of EMBED_PATTERNS) {
    signal +=
      patternSign(patternDigest, x, y, width, height, pattern.period, 0, 0) *
      pattern.weight;
  }
  return signal;
}

function correlationScore(
  raw: RawRgbImage,
  patternDigest: Buffer,
  channel: AiSealPatternChannel,
  transform: CorrelationTransform,
): number {
  const step = Math.max(1, Math.floor(Math.sqrt((raw.width * raw.height) / 12_000)));
  let dot = 0;
  let normSignal = 0;
  let normPattern = 0;

  for (let y = 0; y < raw.height; y += step) {
    for (let x = 0; x < raw.width; x += step) {
      const index = (y * raw.width + x) * 3;
      const red = raw.data[index] ?? 0;
      const green = raw.data[index + 1] ?? 0;
      const blue = raw.data[index + 2] ?? 0;
      const signal =
        channel === "primary"
          ? blue - red
          : channel === "secondary"
            ? green - Math.round((red + blue) / 2)
            : Math.round((red + green + blue) / 3);
      const patternSignal = scaledMixedPatternSignal(
        patternDigest,
        x,
        y,
        raw.width,
        raw.height,
        transform,
      );
      dot += signal * patternSignal;
      normSignal += signal * signal;
      normPattern += patternSignal * patternSignal;
    }
  }

  if (normSignal <= 0 || normPattern <= 0) return 0;
  return Math.max(0, dot / Math.sqrt(normSignal * normPattern));
}

function scaledMixedPatternSignal(
  patternDigest: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  transform: CorrelationTransform,
): number {
  let signal = 0;
  for (const pattern of EMBED_PATTERNS) {
    signal +=
      transformedPatternSign(patternDigest, x, y, width, height, pattern.period, transform) *
      pattern.weight;
  }
  return signal;
}

function buildCorrelationTransforms(): CorrelationTransform[] {
  const transforms: CorrelationTransform[] = [];
  for (const scale of [0.72, 0.82, 0.92, 1, 1.08, 1.18]) {
    transforms.push({ scale, offsetRatioX: 0, offsetRatioY: 0 });
  }
  for (const scale of [0.38, 0.42, 0.46, 0.5, 0.52, 0.58, 0.64, 0.72, 0.82]) {
    const centeredOffset = (1 - scale) / 2;
    transforms.push({ scale, offsetRatioX: centeredOffset, offsetRatioY: centeredOffset });
  }
  return transforms;
}

function transformedPatternSign(
  digest: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  period: number,
  transform: CorrelationTransform,
): 1 | -1 {
  const transformedX = (x / Math.max(1, width)) * transform.scale + transform.offsetRatioX;
  const transformedY = (y / Math.max(1, height)) * transform.scale + transform.offsetRatioY;
  const tileX = positiveModulo(Math.floor(transformedX * period), 16);
  const tileY = positiveModulo(Math.floor(transformedY * period), 16);
  const bitIndex = tileY * 16 + tileX;
  const byte = digest[Math.floor(bitIndex / 8) % digest.length] ?? 0;
  return (byte & (1 << (bitIndex % 8))) === 0 ? -1 : 1;
}

function patternSign(
  digest: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
  period: number,
  offsetX: number,
  offsetY: number,
): 1 | -1 {
  const tileX = positiveModulo(Math.floor((x / Math.max(1, width)) * period + offsetX), 16);
  const tileY = positiveModulo(Math.floor((y / Math.max(1, height)) * period + offsetY), 16);
  const bitIndex = tileY * 16 + tileX;
  const byte = digest[Math.floor(bitIndex / 8) % digest.length] ?? 0;
  return (byte & (1 << (bitIndex % 8))) === 0 ? -1 : 1;
}

function createPatternDigest(tancmarkId: string, channel: AiSealPatternChannel): Buffer {
  return createHash("sha256")
    .update(JPG_PNG_AI_SEAL_VERSION)
    .update(":")
    .update(channel)
    .update(":")
    .update(tancmarkId)
    .digest();
}

function assertFeatureEnabled() {
  if (!getJpgPngAiSealGate().enabled) {
    throw new Error("jpg_png_ai_seal_feature_flag_disabled");
  }
}

function assertSafeId(value: string) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(value)) {
    throw new Error("invalid_ai_seal_tancmark_id");
  }
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function clampByte(value: number) {
  return clampInt(value, 0, 255);
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
