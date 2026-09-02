import { createHash } from "node:crypto";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

import {
  JPG_PNG_AI_SEAL_DECISION_ROLE,
  type JpgPngAiSealDisplayText,
  readJpgPngAiSeal,
  sealJpgPngAiImage,
} from "./jpgPngAiSealEngine";
import {
  PDF_AI_SEAL_DECISION_ROLE,
  type PdfAiSealDisplayText,
  pdfAiSealMetadataContainsExpectedId,
  readPdfAiSealFromRenderedPages,
} from "./pdfAiSealEngine";
import {
  DOCX_AI_SEAL_DECISION_ROLE,
  type DocxAiSealDisplayText,
  inspectDocxAiPackage,
  readDocxAiSeal,
} from "./docxAiSealEngine";
import {
  TXT_AI_SEAL_DECISION_ROLE,
  type TxtAiSealDisplayText,
  readTxtAiSeal,
} from "./txtAiSealEngine";

export const SEAL_INTEGRITY_GATE_VERSION =
  "tancmark-seal-integrity-gate-v1" as const;

export const SEAL_INTEGRITY_GATE_FIXED_ORDER = [
  "ai_seal",
  "integrity_gate",
  "sealed_file_hash",
  "official_timestamp_and_blockchain",
] as const;

export type SealIntegrityGateStatus = "passed" | "failed";
export type SealIntegrityGateDecision = "release_file" | "reject_file";
export type SealIntegrityGateAiOwnershipDecision =
  | "ai_ownership_asserted_by_exact_id"
  | "ai_ownership_not_asserted";
export type SealIntegrityGateReason =
  | "sealed_image_opened"
  | "sealed_image_unreadable_or_damaged"
  | "sealed_image_unsupported_format"
  | "sealed_image_unsafe_dimensions"
  | "correct_id_recovered"
  | "correct_id_not_recovered"
  | "wrong_id_rejected"
  | "wrong_id_accepted"
  | "no_id_did_not_open_ownership"
  | "no_id_opened_ownership"
  | "ai_read_failed"
  | "ai_embed_failed"
  | "sealed_pdf_opened"
  | "sealed_pdf_unreadable_or_damaged"
  | "sealed_pdf_unsafe_page_count"
  | "sealed_pdf_unsafe_size"
  | "rendered_pdf_pages_missing"
  | "pdf_exact_id_marker_valid"
  | "pdf_exact_id_marker_absent"
  | "pdf_exact_id_marker_mismatch"
  | "sealed_docx_opened"
  | "sealed_docx_unreadable_or_damaged"
  | "sealed_docx_unsafe_size"
  | "txt_bytes_unchanged"
  | "txt_bytes_changed"
  | "txt_text_unchanged"
  | "txt_text_changed"
  | "txt_line_order_unchanged"
  | "txt_line_order_changed";

export interface SealIntegrityGateCheck {
  name:
    | "openable_image"
    | "openable_pdf"
    | "openable_docx"
    | "safe_image_shape"
    | "safe_pdf_shape"
    | "safe_docx_shape"
    | "pdf_exact_id_marker"
    | "txt_bytes_exact"
    | "txt_text_exact"
    | "txt_line_order_exact"
    | "correct_id_read"
    | "wrong_id_reject"
    | "no_id_ownership_block";
  passed: boolean;
  reason: SealIntegrityGateReason;
  displayText?:
    | JpgPngAiSealDisplayText
    | PdfAiSealDisplayText
    | DocxAiSealDisplayText
    | TxtAiSealDisplayText
    | undefined;
}

export interface ValidateJpgPngAiSealIntegrityInput {
  sealedImage: Buffer;
  expectedTancmarkId: string;
  wrongTancmarkId?: string | undefined;
  unsealedControlImage?: Buffer | undefined;
}

export interface SealJpgPngAiImageWithIntegrityGateInput {
  image: Buffer;
  tancmarkId: string;
  outputFormat?: "png" | "jpeg" | undefined;
  strength?: number | undefined;
  wrongTancmarkId?: string | undefined;
}

export interface ValidatePdfAiSealIntegrityInput {
  sealedPdf: Buffer;
  renderedPageImages: Buffer[];
  expectedTancmarkId: string;
  wrongTancmarkId?: string | undefined;
  unsealedControlPageImages?: Buffer[] | undefined;
}

export interface ValidateTxtAiSealIntegrityInput {
  originalText: Buffer;
  candidateText: Buffer;
  expectedTancmarkId: string;
  wrongTancmarkId?: string | undefined;
  unsealedControlText?: Buffer | undefined;
}

export interface ValidateDocxAiSealIntegrityInput {
  sealedDocx: Buffer;
  expectedTancmarkId: string;
  wrongTancmarkId?: string | undefined;
  unsealedControlDocx?: Buffer | undefined;
}

export interface SealIntegrityGateResult {
  gateVersion: typeof SEAL_INTEGRITY_GATE_VERSION;
  format: "jpg_png_ai" | "pdf_ai" | "txt_ai" | "docx_ai";
  status: SealIntegrityGateStatus;
  decision: SealIntegrityGateDecision;
  userSafeMessage:
    | "Muhur basarili, dosya verilebilir."
    | "Muhur basarisiz, dosya kullaniciya verilmez.";
  checks: SealIntegrityGateCheck[];
  fixedOrder: typeof SEAL_INTEGRITY_GATE_FIXED_ORDER;
  hashStageAllowed: boolean;
  timestampStageAllowed: boolean;
  timestampOrBlockchainStarted: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  canAssertAiOwnership: boolean;
  aiOwnershipDecision: SealIntegrityGateAiOwnershipDecision;
  ownershipConfidencePercent: number;
  aiResultCanCreateFinal: false;
  decisionRole:
    | typeof JPG_PNG_AI_SEAL_DECISION_ROLE
    | typeof PDF_AI_SEAL_DECISION_ROLE
    | typeof DOCX_AI_SEAL_DECISION_ROLE
    | typeof TXT_AI_SEAL_DECISION_ROLE;
  externalApiUsed: false;
  modelDownloaded: false;
  customerFileSentOutside: false;
}

export interface SealJpgPngAiImageWithIntegrityGateResult {
  sealedImage: Buffer | null;
  gate: SealIntegrityGateResult;
  deliverable: boolean;
  hashStageAllowed: boolean;
  timestampStageAllowed: boolean;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
  originalMutated: false;
}

const MAX_GATE_PIXELS = 24_000_000;

export async function validateJpgPngAiSealIntegrity(
  input: ValidateJpgPngAiSealIntegrityInput,
): Promise<SealIntegrityGateResult> {
  const checks: SealIntegrityGateCheck[] = [];

  await pushImageShapeChecks(input.sealedImage, checks);
  await pushCorrectIdCheck(input, checks);
  await pushWrongIdCheck(input, checks);
  await pushNoIdControlCheck(input, checks);

  const passed = checks.every((check) => check.passed);
  return buildGateResult("jpg_png_ai", JPG_PNG_AI_SEAL_DECISION_ROLE, passed, checks);
}

export async function validatePdfAiSealIntegrity(
  input: ValidatePdfAiSealIntegrityInput,
): Promise<SealIntegrityGateResult> {
  const checks: SealIntegrityGateCheck[] = [];

  await pushPdfShapeChecks(input.sealedPdf, input.renderedPageImages, checks);
  await pushPdfExactIdMarkerCheck(input, checks);
  await pushPdfCorrectIdCheck(input, checks);
  await pushPdfWrongIdCheck(input, checks);
  await pushPdfNoIdControlCheck(input, checks);

  const passed = checks.every((check) => check.passed);
  return buildGateResult("pdf_ai", PDF_AI_SEAL_DECISION_ROLE, passed, checks);
}

export async function validateTxtAiSealIntegrity(
  input: ValidateTxtAiSealIntegrityInput,
): Promise<SealIntegrityGateResult> {
  const checks: SealIntegrityGateCheck[] = [];

  pushTxtExactnessChecks(input.originalText, input.candidateText, checks);
  await pushTxtCorrectIdCheck(input, checks);
  await pushTxtWrongIdCheck(input, checks);
  await pushTxtNoIdControlCheck(input, checks);

  const passed = checks.every((check) => check.passed);
  return buildGateResult("txt_ai", TXT_AI_SEAL_DECISION_ROLE, passed, checks);
}

export async function validateDocxAiSealIntegrity(
  input: ValidateDocxAiSealIntegrityInput,
): Promise<SealIntegrityGateResult> {
  const checks: SealIntegrityGateCheck[] = [];

  pushDocxShapeChecks(input.sealedDocx, checks);
  await pushDocxCorrectIdCheck(input, checks);
  await pushDocxWrongIdCheck(input, checks);
  await pushDocxNoIdControlCheck(input, checks);

  const passed = checks.every((check) => check.passed);
  return buildGateResult("docx_ai", DOCX_AI_SEAL_DECISION_ROLE, passed, checks);
}

export async function sealJpgPngAiImageWithIntegrityGate(
  input: SealJpgPngAiImageWithIntegrityGateInput,
): Promise<SealJpgPngAiImageWithIntegrityGateResult> {
  try {
    const sealed = await sealJpgPngAiImage({
      image: input.image,
      tancmarkId: input.tancmarkId,
      outputFormat: input.outputFormat,
      strength: input.strength,
    });
    const gate = await validateJpgPngAiSealIntegrity({
      sealedImage: sealed.image,
      expectedTancmarkId: input.tancmarkId,
      wrongTancmarkId: input.wrongTancmarkId,
      unsealedControlImage: input.image,
    });
    const deliverable = gate.status === "passed";
    return {
      sealedImage: deliverable ? sealed.image : null,
      gate,
      deliverable,
      hashStageAllowed: gate.hashStageAllowed,
      timestampStageAllowed: gate.timestampStageAllowed,
      canOpenVault: false,
      canConfirmFinal: false,
      externalApiUsed: false,
      modelDownloaded: false,
      originalMutated: sealed.originalMutated,
    };
  } catch {
    const gate = buildGateResult("jpg_png_ai", JPG_PNG_AI_SEAL_DECISION_ROLE, false, [
      {
        name: "correct_id_read",
        passed: false,
        reason: "ai_embed_failed",
      },
    ]);
    return {
      sealedImage: null,
      gate,
      deliverable: false,
      hashStageAllowed: false,
      timestampStageAllowed: false,
      canOpenVault: false,
      canConfirmFinal: false,
      externalApiUsed: false,
      modelDownloaded: false,
      originalMutated: false,
    };
  }
}

export function createSealedFileHashAfterIntegrityGate(
  sealedImage: Buffer,
  gate: SealIntegrityGateResult,
): { digestAlgorithm: "sha256"; digestHex: string; timestampStageAllowed: true } {
  if (gate.status !== "passed" || !gate.hashStageAllowed) {
    throw new Error("seal_integrity_gate_not_passed");
  }
  return {
    digestAlgorithm: "sha256",
    digestHex: createHash("sha256").update(sealedImage).digest("hex"),
    timestampStageAllowed: true,
  };
}

async function pushImageShapeChecks(
  image: Buffer,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const metadata = await sharp(image).metadata();
    if (metadata.format !== "jpeg" && metadata.format !== "png") {
      checks.push({
        name: "openable_image",
        passed: false,
        reason: "sealed_image_unsupported_format",
      });
      return;
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width <= 0 || height <= 0 || width * height > MAX_GATE_PIXELS) {
      checks.push({
        name: "safe_image_shape",
        passed: false,
        reason: "sealed_image_unsafe_dimensions",
      });
      return;
    }
    await sharp(image).rotate().removeAlpha().raw().toBuffer();
    checks.push({
      name: "openable_image",
      passed: true,
      reason: "sealed_image_opened",
    });
    checks.push({
      name: "safe_image_shape",
      passed: true,
      reason: "sealed_image_opened",
    });
  } catch {
    checks.push({
      name: "openable_image",
      passed: false,
      reason: "sealed_image_unreadable_or_damaged",
    });
  }
}

async function pushPdfShapeChecks(
  pdfBytes: Buffer,
  renderedPageImages: Buffer[],
  checks: SealIntegrityGateCheck[],
) {
  if (pdfBytes.length <= 0 || pdfBytes.length > 40 * 1024 * 1024) {
    checks.push({
      name: "safe_pdf_shape",
      passed: false,
      reason: "sealed_pdf_unsafe_size",
    });
    return;
  }
  try {
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
    const pageCount = pdf.getPageCount();
    if (pageCount <= 0 || pageCount > 40) {
      checks.push({
        name: "safe_pdf_shape",
        passed: false,
        reason: "sealed_pdf_unsafe_page_count",
      });
      return;
    }
    checks.push({
      name: "openable_pdf",
      passed: true,
      reason: "sealed_pdf_opened",
    });
    checks.push({
      name: "safe_pdf_shape",
      passed: true,
      reason: "sealed_pdf_opened",
    });
  } catch {
    checks.push({
      name: "openable_pdf",
      passed: false,
      reason: "sealed_pdf_unreadable_or_damaged",
    });
    return;
  }

  if (renderedPageImages.length <= 0) {
    checks.push({
      name: "correct_id_read",
      passed: false,
      reason: "rendered_pdf_pages_missing",
    });
  }
}

async function pushPdfExactIdMarkerCheck(
  input: ValidatePdfAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const pdf = await PDFDocument.load(input.sealedPdf, { ignoreEncryption: false });
    const marker = pdfAiSealMetadataContainsExpectedId(
      pdf.getKeywords(),
      input.expectedTancmarkId,
    );
    checks.push({
      name: "pdf_exact_id_marker",
      passed: marker === true || marker === "absent",
      reason:
        marker === true
          ? "pdf_exact_id_marker_valid"
          : marker === "absent"
            ? "pdf_exact_id_marker_absent"
            : "pdf_exact_id_marker_mismatch",
    });
  } catch {
    checks.push({
      name: "pdf_exact_id_marker",
      passed: false,
      reason: "sealed_pdf_unreadable_or_damaged",
    });
  }
}

function pushDocxShapeChecks(docx: Buffer, checks: SealIntegrityGateCheck[]) {
  if (docx.length <= 0 || docx.length > 60 * 1024 * 1024) {
    checks.push({
      name: "safe_docx_shape",
      passed: false,
      reason: "sealed_docx_unsafe_size",
    });
    return;
  }
  try {
    inspectDocxAiPackage(docx);
    checks.push({
      name: "openable_docx",
      passed: true,
      reason: "sealed_docx_opened",
    });
    checks.push({
      name: "safe_docx_shape",
      passed: true,
      reason: "sealed_docx_opened",
    });
  } catch {
    checks.push({
      name: "openable_docx",
      passed: false,
      reason: "sealed_docx_unreadable_or_damaged",
    });
  }
}

function pushTxtExactnessChecks(
  originalText: Buffer,
  candidateText: Buffer,
  checks: SealIntegrityGateCheck[],
) {
  const bytesEqual = Buffer.compare(originalText, candidateText) === 0;
  checks.push({
    name: "txt_bytes_exact",
    passed: bytesEqual,
    reason: bytesEqual ? "txt_bytes_unchanged" : "txt_bytes_changed",
  });

  const originalString = originalText.toString("utf8");
  const candidateString = candidateText.toString("utf8");
  const textEqual = originalString === candidateString;
  checks.push({
    name: "txt_text_exact",
    passed: textEqual,
    reason: textEqual ? "txt_text_unchanged" : "txt_text_changed",
  });

  const lineOrderEqual =
    splitLines(originalString).join("\n") === splitLines(candidateString).join("\n");
  checks.push({
    name: "txt_line_order_exact",
    passed: lineOrderEqual,
    reason: lineOrderEqual ? "txt_line_order_unchanged" : "txt_line_order_changed",
  });
}

async function pushCorrectIdCheck(
  input: ValidateJpgPngAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readJpgPngAiSeal({
      image: input.sealedImage,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "correct_id_read",
      passed: read.found && read.canAssertAiOwnership,
      reason: read.found ? "correct_id_recovered" : "correct_id_not_recovered",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "correct_id_read",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushWrongIdCheck(
  input: ValidateJpgPngAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readJpgPngAiSeal({
      image: input.sealedImage,
      expectedTancmarkId:
        input.wrongTancmarkId ?? `${input.expectedTancmarkId}:wrong-id`,
    });
    checks.push({
      name: "wrong_id_reject",
      passed:
        !read.found &&
        !read.canAssertAiOwnership &&
        !read.canOpenVault &&
        !read.canConfirmFinal,
      reason: read.found ? "wrong_id_accepted" : "wrong_id_rejected",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "wrong_id_reject",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushNoIdControlCheck(
  input: ValidateJpgPngAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  if (!input.unsealedControlImage) return;
  try {
    const read = await readJpgPngAiSeal({
      image: input.unsealedControlImage,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "no_id_ownership_block",
      passed:
        !read.found &&
        !read.canAssertAiOwnership &&
        !read.canOpenVault &&
        !read.canConfirmFinal,
      reason: read.found ? "no_id_opened_ownership" : "no_id_did_not_open_ownership",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "no_id_ownership_block",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushPdfCorrectIdCheck(
  input: ValidatePdfAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readPdfAiSealFromRenderedPages({
      pageImages: input.renderedPageImages,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "correct_id_read",
      passed: read.found,
      reason: read.found ? "correct_id_recovered" : "correct_id_not_recovered",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "correct_id_read",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushPdfWrongIdCheck(
  input: ValidatePdfAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readPdfAiSealFromRenderedPages({
      pageImages: input.renderedPageImages,
      expectedTancmarkId:
        input.wrongTancmarkId ?? `${input.expectedTancmarkId}:wrong-id`,
    });
    checks.push({
      name: "wrong_id_reject",
      passed:
        !read.found &&
        !read.canAssertAiOwnership &&
        !read.canOpenVault &&
        !read.canConfirmFinal,
      reason: read.found ? "wrong_id_accepted" : "wrong_id_rejected",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "wrong_id_reject",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushPdfNoIdControlCheck(
  input: ValidatePdfAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  if (!input.unsealedControlPageImages) return;
  try {
    const read = await readPdfAiSealFromRenderedPages({
      pageImages: input.unsealedControlPageImages,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "no_id_ownership_block",
      passed:
        !read.found &&
        !read.canAssertAiOwnership &&
        !read.canOpenVault &&
        !read.canConfirmFinal,
      reason: read.found ? "no_id_opened_ownership" : "no_id_did_not_open_ownership",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "no_id_ownership_block",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushDocxCorrectIdCheck(
  input: ValidateDocxAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readDocxAiSeal({
      docx: input.sealedDocx,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "correct_id_read",
      passed: read.found && read.canAssertAiOwnership,
      reason: read.found ? "correct_id_recovered" : "correct_id_not_recovered",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "correct_id_read",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushDocxWrongIdCheck(
  input: ValidateDocxAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readDocxAiSeal({
      docx: input.sealedDocx,
      expectedTancmarkId:
        input.wrongTancmarkId ?? `${input.expectedTancmarkId}:wrong-id`,
    });
    checks.push({
      name: "wrong_id_reject",
      passed:
        !read.found &&
        !read.canAssertAiOwnership &&
        !read.canOpenVault &&
        !read.canConfirmFinal,
      reason: read.found ? "wrong_id_accepted" : "wrong_id_rejected",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "wrong_id_reject",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushDocxNoIdControlCheck(
  input: ValidateDocxAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  if (!input.unsealedControlDocx) return;
  try {
    const read = await readDocxAiSeal({
      docx: input.unsealedControlDocx,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "no_id_ownership_block",
      passed:
        !read.found &&
        !read.canAssertAiOwnership &&
        !read.canOpenVault &&
        !read.canConfirmFinal,
      reason: read.found ? "no_id_opened_ownership" : "no_id_did_not_open_ownership",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "no_id_ownership_block",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushTxtCorrectIdCheck(
  input: ValidateTxtAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readTxtAiSeal({
      text: input.candidateText,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "correct_id_read",
      passed: read.found,
      reason: read.found ? "correct_id_recovered" : "correct_id_not_recovered",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "correct_id_read",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushTxtWrongIdCheck(
  input: ValidateTxtAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  try {
    const read = await readTxtAiSeal({
      text: input.candidateText,
      expectedTancmarkId:
        input.wrongTancmarkId ?? `${input.expectedTancmarkId}:wrong-id`,
    });
    checks.push({
      name: "wrong_id_reject",
      passed: !read.found && !read.canOpenVault && !read.canConfirmFinal,
      reason: read.found ? "wrong_id_accepted" : "wrong_id_rejected",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "wrong_id_reject",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

async function pushTxtNoIdControlCheck(
  input: ValidateTxtAiSealIntegrityInput,
  checks: SealIntegrityGateCheck[],
) {
  const controlText = input.unsealedControlText ?? input.originalText;
  try {
    const read = await readTxtAiSeal({
      text: controlText,
      expectedTancmarkId: input.expectedTancmarkId,
    });
    checks.push({
      name: "no_id_ownership_block",
      passed: !read.found && !read.canOpenVault && !read.canConfirmFinal,
      reason: read.found ? "no_id_opened_ownership" : "no_id_did_not_open_ownership",
      displayText: read.displayText,
    });
  } catch {
    checks.push({
      name: "no_id_ownership_block",
      passed: false,
      reason: "ai_read_failed",
    });
  }
}

function splitLines(value: string) {
  return value.split(/\r\n|\n|\r/);
}

function buildGateResult(
  format: "jpg_png_ai" | "pdf_ai" | "txt_ai" | "docx_ai",
  decisionRole:
    | typeof JPG_PNG_AI_SEAL_DECISION_ROLE
    | typeof PDF_AI_SEAL_DECISION_ROLE
    | typeof DOCX_AI_SEAL_DECISION_ROLE
    | typeof TXT_AI_SEAL_DECISION_ROLE,
  passed: boolean,
  checks: SealIntegrityGateCheck[],
): SealIntegrityGateResult {
  const canAssertAiOwnership = passed && format !== "txt_ai";
  return {
    gateVersion: SEAL_INTEGRITY_GATE_VERSION,
    format,
    status: passed ? "passed" : "failed",
    decision: passed ? "release_file" : "reject_file",
    userSafeMessage: passed
      ? "Muhur basarili, dosya verilebilir."
      : "Muhur basarisiz, dosya kullaniciya verilmez.",
    checks,
    fixedOrder: SEAL_INTEGRITY_GATE_FIXED_ORDER,
    hashStageAllowed: passed,
    timestampStageAllowed: passed,
    timestampOrBlockchainStarted: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    canAssertAiOwnership,
    aiOwnershipDecision: canAssertAiOwnership
      ? "ai_ownership_asserted_by_exact_id"
      : "ai_ownership_not_asserted",
    ownershipConfidencePercent: canAssertAiOwnership ? 100 : 0,
    aiResultCanCreateFinal: false,
    decisionRole,
    externalApiUsed: false,
    modelDownloaded: false,
    customerFileSentOutside: false,
  };
}
