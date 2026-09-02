import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import {
  JPG_PNG_AI_SEAL_DECISION_ROLE,
  readJpgPngAiSeal,
  sealJpgPngAiImage,
} from "./jpgPngAiSealEngine";

export const PDF_AI_SEAL_FEATURE_FLAG = "TANCMARK_AI_SEAL_PDF_ENABLED" as const;

export const PDF_AI_SEAL_DECISION_ROLE =
  "pdf_ai_exact_id_ownership_no_vault_no_final" as const;

export const PDF_AI_SEAL_VERSION = "tancmark-ai-seal-pdf-mvp-v1" as const;

export type PdfAiSealDisplayText =
  | "AI kesin ID okundu"
  | "AI destek izi bulunamadi"
  | "Zayif AI sinyal var";

export type PdfAiSealOwnershipDecision =
  | "ai_ownership_asserted_by_exact_id"
  | "ai_weak_trace_percent_only"
  | "ai_ownership_not_asserted";

export type PdfAiSealOperation = "embed" | "search" | "degraded_recovery";

export interface PdfAiSealGate {
  module: "pdf_ai_seal";
  enabled: boolean;
  featureFlag: typeof PDF_AI_SEAL_FEATURE_FLAG;
  defaultEnabled: false;
  productReady: false;
  decisionRole: typeof PDF_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface SealPdfAiDocumentInput {
  pdf: Buffer;
  tancmarkId: string;
  strength?: number | undefined;
}

export interface SealPdfAiDocumentResult {
  pdf: Buffer;
  pageCount: number;
  aiSealEmbedded: true;
  sourcePdfMutated: false;
  decisionRole: typeof PDF_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface ReadPdfAiSealFromRenderedPagesInput {
  pageImages: Buffer[];
  expectedTancmarkId: string;
  allowGeometricRecovery?: boolean | undefined;
}

export interface ReadPdfAiSealFromRenderedPagesResult {
  found: boolean;
  weakSignal: boolean;
  score: number;
  pageCount: number;
  displayText: PdfAiSealDisplayText;
  decisionRole: typeof PDF_AI_SEAL_DECISION_ROLE;
  canAssertAiOwnership: boolean;
  aiOwnershipDecision: PdfAiSealOwnershipDecision;
  ownershipConfidencePercent: number;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface PdfAiSealComponentEvidence {
  found: boolean;
  weakSignal: boolean;
  score: number;
}

export interface PdfAiSealTokenEstimateInput {
  operation: PdfAiSealOperation;
  sizeBytes: number;
  pageCount?: number | undefined;
}

export interface PdfAiSealTokenEstimate {
  operation: PdfAiSealOperation;
  estimatedTokens: number;
  userMessage: string;
  approveButton: "Onayla ve islemi baslat";
  cancelButton: "Iptal et";
  requiresExplicitApproval: true;
}

const MAX_SUPPORTED_PDF_BYTES = 40 * 1024 * 1024;
const MAX_SUPPORTED_PAGES = 40;
const DEFAULT_STRENGTH = 60;
const PDF_AI_TILE_SIZE = 1024;
const PDF_AI_SENTINEL_ID = "tm-pdf-ai-seal-sentinel-v1";
const PDF_AI_METADATA_PREFIX = "tancmark-pdf-ai-seal:";

export function getPdfAiSealGate(env: NodeJS.ProcessEnv = process.env): PdfAiSealGate {
  return {
    module: "pdf_ai_seal",
    enabled: env[PDF_AI_SEAL_FEATURE_FLAG] === "1" || env[PDF_AI_SEAL_FEATURE_FLAG] === "true",
    featureFlag: PDF_AI_SEAL_FEATURE_FLAG,
    defaultEnabled: false,
    productReady: false,
    decisionRole: PDF_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export function estimatePdfAiSealTokens(input: PdfAiSealTokenEstimateInput): PdfAiSealTokenEstimate {
  const sizeFactor = Math.max(1, Math.ceil(input.sizeBytes / 1_500_000));
  const pageFactor = Math.max(1, input.pageCount ?? 1);
  const base =
    input.operation === "embed" ? 320 : input.operation === "search" ? 260 : 540;
  const estimatedTokens = base + Math.max(sizeFactor, pageFactor) * 55;
  return {
    operation: input.operation,
    estimatedTokens,
    userMessage: `Bu islem yaklasik ${estimatedTokens} token yakacak.`,
    approveButton: "Onayla ve islemi baslat",
    cancelButton: "Iptal et",
    requiresExplicitApproval: true,
  };
}

export async function sealPdfAiDocument(
  input: SealPdfAiDocumentInput,
): Promise<SealPdfAiDocumentResult> {
  assertPdfAiFeatureEnabled();
  assertSafeId(input.tancmarkId);
  assertSafePdfSize(input.pdf);

  const pdf = await PDFDocument.load(input.pdf, { ignoreEncryption: false });
  const pageCount = pdf.getPageCount();
  if (pageCount <= 0 || pageCount > MAX_SUPPORTED_PAGES) {
    throw new Error("unsafe_pdf_ai_seal_page_count");
  }

  const aiTile = await createAiSealTile(input.tancmarkId, input.strength ?? DEFAULT_STRENGTH);
  const sentinelTile = await createAiSealTile(PDF_AI_SENTINEL_ID, input.strength ?? DEFAULT_STRENGTH);
  const embeddedTile = await pdf.embedPng(aiTile);
  const embeddedSentinelTile = await pdf.embedPng(sentinelTile);
  pdf.setKeywords([createPdfAiSealMetadataTag(input.tancmarkId)]);
  for (const page of pdf.getPages()) {
    const size = page.getSize();
    page.drawImage(embeddedTile, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      opacity: 0.38,
    });
    page.drawImage(embeddedSentinelTile, {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      opacity: 0.68,
    });
  }

  const pdfBytes = await pdf.save({ useObjectStreams: false });
  return {
    pdf: Buffer.from(pdfBytes),
    pageCount,
    aiSealEmbedded: true,
    sourcePdfMutated: false,
    decisionRole: PDF_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export async function readPdfAiSealFromRenderedPages(
  input: ReadPdfAiSealFromRenderedPagesInput,
): Promise<ReadPdfAiSealFromRenderedPagesResult> {
  assertPdfAiFeatureEnabled();
  assertSafeId(input.expectedTancmarkId);
  if (input.pageImages.length <= 0) {
    throw new Error("pdf_ai_seal_requires_rendered_page_images");
  }

  let best: ReadPdfAiSealFromRenderedPagesResult = {
    found: false,
    weakSignal: false,
    score: 0,
    pageCount: input.pageImages.length,
    displayText: "AI destek izi bulunamadi",
    decisionRole: PDF_AI_SEAL_DECISION_ROLE,
    canAssertAiOwnership: false,
    aiOwnershipDecision: "ai_ownership_not_asserted",
    ownershipConfidencePercent: 0,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };

  for (const image of input.pageImages.slice(0, MAX_SUPPORTED_PAGES)) {
    const pageCandidates = [image];
    for (let index = 0; index < pageCandidates.length; index += 1) {
      const candidateImage = pageCandidates[index] ?? image;
      const expectedResult = await readJpgPngAiSeal({
        image: candidateImage,
        expectedTancmarkId: input.expectedTancmarkId,
      });
      const sentinelResult = await readJpgPngAiSeal({
        image: candidateImage,
        expectedTancmarkId: PDF_AI_SENTINEL_ID,
      });
      const candidate = classifyPdfAiSealPageEvidence(
        expectedResult,
        sentinelResult,
        input.pageImages.length,
      );
      if (candidate.found || candidate.score > best.score) {
        best = candidate;
      }
      if (index === 0 && !candidate.found && input.allowGeometricRecovery === true) {
        pageCandidates.push(...(await createPdfAiPageRecoveryCandidates(image)));
      }
      if (candidate.found) break;
    }
    if (best.found) break;
  }

  return best;
}

export function classifyPdfAiSealPageEvidence(
  expectedResult: PdfAiSealComponentEvidence,
  sentinelResult: PdfAiSealComponentEvidence,
  pageCount: number,
): ReadPdfAiSealFromRenderedPagesResult {
  const score = Math.min(expectedResult.score, sentinelResult.score);
  const bothMarkersRecovered =
    (expectedResult.found || expectedResult.weakSignal) &&
    (sentinelResult.found || sentinelResult.weakSignal);
  const found = expectedResult.found && sentinelResult.found;
  const weakSignal =
    !found &&
    bothMarkersRecovered;
  const ownershipConfidencePercent = confidencePercent(found, weakSignal, score);
  return {
    found,
    weakSignal,
    score,
    pageCount,
    displayText: found
      ? "AI kesin ID okundu"
      : weakSignal
        ? "Zayif AI sinyal var"
        : "AI destek izi bulunamadi",
    decisionRole: PDF_AI_SEAL_DECISION_ROLE,
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
  const scaled = clampInteger(Math.round(score * 100), 0, 100);
  if (found) return clampInteger(Math.max(95, scaled), 95, 100);
  if (weakSignal) return clampInteger(Math.max(1, scaled), 1, 94);
  return 0;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function createPdfAiPageRecoveryCandidates(image: Buffer): Promise<Buffer[]> {
  const metadata = await sharp(image).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new Error("pdf_ai_seal_invalid_page_image");
  }
  const candidates: Buffer[] = [];
  for (const angle of [-4, 4, -2, 2]) {
    candidates.push(
      await sharp(image)
        .rotate(angle, { background: "#ffffff" })
        .resize(width, height, { fit: "fill" })
        .png()
        .toBuffer(),
    );
  }
  return candidates;
}

export function createPdfAiSealMetadataTag(tancmarkId: string): string {
  assertSafeId(tancmarkId);
  return `${PDF_AI_METADATA_PREFIX}${createHash("sha256")
    .update(PDF_AI_SEAL_VERSION)
    .update(":")
    .update(tancmarkId)
    .digest("hex")}`;
}

export function pdfAiSealMetadataContainsExpectedId(
  keywords: string | undefined,
  expectedTancmarkId: string,
): boolean | "absent" {
  assertSafeId(expectedTancmarkId);
  if (!keywords || !keywords.includes(PDF_AI_METADATA_PREFIX)) {
    return "absent";
  }
  return keywords.includes(createPdfAiSealMetadataTag(expectedTancmarkId));
}

async function createAiSealTile(tancmarkId: string, strength: number): Promise<Buffer> {
  const baseTile = await sharp({
    create: {
      width: PDF_AI_TILE_SIZE,
      height: PDF_AI_TILE_SIZE,
      channels: 3,
      background: "#f7f7f7",
    },
  })
    .png()
    .toBuffer();
  const sealedTile = await sealJpgPngAiImage({
    image: baseTile,
    tancmarkId,
    outputFormat: "png",
    strength,
  });
  return sealedTile.image;
}

function assertPdfAiFeatureEnabled() {
  if (!getPdfAiSealGate().enabled) {
    throw new Error("pdf_ai_seal_feature_flag_disabled");
  }
}

function assertSafeId(value: string) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(value)) {
    throw new Error("invalid_pdf_ai_seal_tancmark_id");
  }
}

function assertSafePdfSize(pdf: Buffer) {
  if (pdf.length <= 0 || pdf.length > MAX_SUPPORTED_PDF_BYTES) {
    throw new Error("unsafe_pdf_ai_seal_size");
  }
}

export const PDF_AI_SEAL_JPG_PNG_SUPPORT_ROLE = JPG_PNG_AI_SEAL_DECISION_ROLE;
