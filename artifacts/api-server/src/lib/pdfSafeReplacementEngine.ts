import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export const PDF_SAFE_REPLACEMENT_ENGINE_VERSION =
  "pdf-safe-replacement-engine-v0.1" as const;
export const PDF_SAFE_REPLACEMENT_DECISION_ROLE =
  "pdf_safe_replacement_support_only_no_vault_no_confirmed" as const;
export const PDF_SAFE_REPLACEMENT_PAYLOAD_PREFIX =
  "TANCMARK_SUPPORT_ONLY_V1:" as const;
export const PDF_SAFE_VISUAL_SUPPORT_MARKER_PREFIX =
  "TANCMARK_VISUAL_SUPPORT_ONLY_V1" as const;
export const PDF_SAFE_VISUAL_SUPPORT_MARKER_V2_PREFIX =
  "TANCMARK_VISUAL_SUPPORT_ONLY_V2" as const;
export const PDF_SAFE_REPLACEMENT_PRODUCT_BINDING_GATE =
  "pdf_v2_support_product_path_internal_real_printer_deferred" as const;
export const PDF_SAFE_REPLACEMENT_MAX_METADATA_CHARS = 8192 as const;
export const PDF_SAFE_REPLACEMENT_MAX_SUPPORT_ID_CHARS = 128 as const;
export const PDF_SAFE_REPLACEMENT_MAX_NOTE_CHARS = 2048 as const;

export type PdfSafeReplacementStatus =
  | "support_payload_written"
  | "support_payload_found"
  | "support_payload_missing"
  | "invalid_support_payload"
  | "invalid_pdf"
  | "pdf_load_failed";

export interface PdfSafeReplacementSupportPayload {
  schemaVersion: "tancmark-pdf-support-payload-v1";
  supportOnly: true;
  marker: "TANCMARK_SUPPORT_ONLY";
  supportId: string;
  expectedIdHex: string | null;
  note: string;
  writtenAt: string;
}

export interface PdfSafeReplacementBaseResult {
  version: typeof PDF_SAFE_REPLACEMENT_ENGINE_VERSION;
  decisionRole: typeof PDF_SAFE_REPLACEMENT_DECISION_ROLE;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  thresholdChanged: false;
  ownershipPreSealChanged: false;
  riskyPdfToolUsed: false;
  ghostscriptUsed: false;
  mupdfUsed: false;
  pymupdfUsed: false;
  popplerUsed: false;
  pdfiumUsed: false;
  pdfboxUsed: false;
}

export interface PdfSafeReplacementWriteInput {
  pdfBytes: Uint8Array | Buffer;
  supportId: string;
  expectedIdHex?: string | null;
  note?: string | null;
  writtenAt?: string | Date | null;
}

export interface PdfSafeReplacementReadInput {
  pdfBytes: Uint8Array | Buffer;
  expectedIdHex?: string | null;
}

export interface PdfSafeReplacementVisualWriteInput extends PdfSafeReplacementWriteInput {
  visualOpacity?: number | null;
  explicitVisibleMarkOptIn?: boolean | null;
}

export interface PdfSafeReplacementWriteResult extends PdfSafeReplacementBaseResult {
  status: "support_payload_written" | "invalid_support_payload" | "invalid_pdf" | "pdf_load_failed";
  pdfBytes: Uint8Array | null;
  inputSha256: string;
  outputSha256: string | null;
  payloadSha256: string | null;
  payload: PdfSafeReplacementSupportPayload | null;
  exactIdMatched: boolean;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
}

export interface PdfSafeReplacementVisualWriteResult extends PdfSafeReplacementWriteResult {
  visualSupportOnly: true;
  visualMarkerPrefix: typeof PDF_SAFE_VISUAL_SUPPORT_MARKER_PREFIX;
  visualMarkerV2Prefix: typeof PDF_SAFE_VISUAL_SUPPORT_MARKER_V2_PREFIX;
  visualMarkerApplied: boolean;
  visualMarkerV2Applied: boolean;
  visualMarkerText: string | null;
  visualMarkerPages: number;
  visualMarkerV2GridSize: 9;
  visualMarkerCanOpenVault: false;
}

export interface PdfSafeReplacementReadResult extends PdfSafeReplacementBaseResult {
  status: "support_payload_found" | "support_payload_missing" | "invalid_pdf" | "pdf_load_failed";
  inputSha256: string;
  payloadSha256: string | null;
  payload: PdfSafeReplacementSupportPayload | null;
  exactIdMatched: boolean;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
}

export type PdfSafeReplacementCapability =
  | "metadata_support_payload_write"
  | "metadata_support_payload_read"
  | "exact_id_support_match_report"
  | "visual_text_support_payload_write";

export type PdfSafeReplacementBlockedCapability =
  | "vault_open"
  | "confirmed_decision"
  | "final_decision"
  | "threshold_change"
  | "ownership_pre_seal_change"
  | "pdf_rendering"
  | "eps_postscript_rendering"
  | "visual_text_support_payload_as_final_decision"
  | "dirty_real_world_pdf_product_claim";

export interface PdfSafeReplacementAdapterBoundary {
  name: "pdf-lib-support-only-adapter";
  library: "pdf-lib";
  version: typeof PDF_SAFE_REPLACEMENT_ENGINE_VERSION;
  supportOnly: true;
  productReady: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  thresholdChanged: false;
  ownershipPreSealChanged: false;
  capabilities: PdfSafeReplacementCapability[];
  blockedCapabilities: PdfSafeReplacementBlockedCapability[];
  writeSupportPayload: typeof writePdfSafeSupportPayload;
  writeVisualSupportPayload: typeof writePdfSafeVisualSupportPayload;
  readSupportPayload: typeof readPdfSafeSupportPayload;
}

export interface PdfSafeReplacementReadinessResult extends PdfSafeReplacementBaseResult {
  status: "support_only_adapter_ready_product_not_ready";
  adapterName: PdfSafeReplacementAdapterBoundary["name"];
  productReady: false;
  noticeManifestReady: true;
  remainingProductReadinessBlockers: string[];
}

export interface PdfSafeReplacementProductBindingResult extends PdfSafeReplacementBaseResult {
  status: "support_product_path_bound_real_printer_deferred";
  gate: typeof PDF_SAFE_REPLACEMENT_PRODUCT_BINDING_GATE;
  adapterName: PdfSafeReplacementAdapterBoundary["name"];
  adapterLibrary: PdfSafeReplacementAdapterBoundary["library"];
  productPathBound: true;
  internalProductPathEnabled: true;
  publicProductReady: false;
  productReady: false;
  productBehaviorChanged: false;
  exactIdStillRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportAdvisoryFinal: false;
  visualMarkerV2Enabled: true;
  realPrinterGateDeferred: true;
  realPrinterRequiredBeforePublicReady: true;
  simulatedPrintScanCountsAsProductProof: false;
  screenPhotoPhysicalExactMatches: number | null;
  noPrinterLabExactMatches: number | null;
  aggregateSupportMatches: number | null;
  aggregateResultsProvided: number | null;
  anyVaultOpened: false;
  freeOpenSourceOnly: true;
  commercialUseClear: true;
  license: "MIT";
  allowedProductRuntimeTools: ["pdf-lib"];
  productRuntimeDenylistPolicy: "license_cleanup_phase_1_pdf_runtime_denylist";
  remainingProductReadinessBlockers: string[];
}

export interface PdfSafeReplacementProductBindingEvidence {
  screenPhotoPhysicalExactMatches?: number | null;
  noPrinterLabExactMatches?: number | null;
}

function baseResult(): PdfSafeReplacementBaseResult {
  return {
    version: PDF_SAFE_REPLACEMENT_ENGINE_VERSION,
    decisionRole: PDF_SAFE_REPLACEMENT_DECISION_ROLE,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    thresholdChanged: false,
    ownershipPreSealChanged: false,
    riskyPdfToolUsed: false,
    ghostscriptUsed: false,
    mupdfUsed: false,
    pymupdfUsed: false,
    popplerUsed: false,
    pdfiumUsed: false,
    pdfboxUsed: false,
  };
}

function sha256(bytes: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function looksLikePdf(bytes: Uint8Array | Buffer): boolean {
  if (bytes.length < 5) return false;
  const header = Buffer.from(bytes.subarray(0, 5)).toString("ascii");
  return header === "%PDF-";
}

function encodePayload(payload: PdfSafeReplacementSupportPayload): string {
  const json = JSON.stringify(payload);
  return `${PDF_SAFE_REPLACEMENT_PAYLOAD_PREFIX}${Buffer.from(json, "utf8").toString("base64url")}`;
}

function decodePayload(subject: string | undefined): PdfSafeReplacementSupportPayload | null {
  if (!subject?.startsWith(PDF_SAFE_REPLACEMENT_PAYLOAD_PREFIX)) return null;
  if (subject.length > PDF_SAFE_REPLACEMENT_MAX_METADATA_CHARS) return null;
  try {
    const encoded = subject.slice(PDF_SAFE_REPLACEMENT_PAYLOAD_PREFIX.length);
    const decoded = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<PdfSafeReplacementSupportPayload>;
    if (
      parsed.schemaVersion !== "tancmark-pdf-support-payload-v1" ||
      parsed.supportOnly !== true ||
      parsed.marker !== "TANCMARK_SUPPORT_ONLY" ||
      !isValidSupportId(parsed.supportId) ||
      !isValidExpectedIdHex(parsed.expectedIdHex) ||
      !isValidNote(parsed.note) ||
      !isValidWrittenAt(parsed.writtenAt)
    ) {
      return null;
    }
    return {
      schemaVersion: parsed.schemaVersion,
      supportOnly: true,
      marker: "TANCMARK_SUPPORT_ONLY",
      supportId: parsed.supportId,
      expectedIdHex: parsed.expectedIdHex,
      note: parsed.note,
      writtenAt: parsed.writtenAt,
    };
  } catch {
    return null;
  }
}

function exactIdMatched(
  payload: PdfSafeReplacementSupportPayload | null,
  expectedIdHex: string | null | undefined,
): boolean {
  if (!payload?.expectedIdHex || !expectedIdHex) return false;
  return payload.expectedIdHex.toLowerCase() === expectedIdHex.toLowerCase();
}

function visualMarkerText(payload: PdfSafeReplacementSupportPayload): string {
  const id = payload.expectedIdHex ?? "NO_EXPECTED_ID";
  return `${PDF_SAFE_VISUAL_SUPPORT_MARKER_PREFIX} ID:${id} SUPPORT:${payload.supportId}`;
}

function visualMarkerV2Text(payload: PdfSafeReplacementSupportPayload): string {
  const id = payload.expectedIdHex ?? "NO_EXPECTED_ID";
  return `${PDF_SAFE_VISUAL_SUPPORT_MARKER_V2_PREFIX} ID:${id} SUPPORT:${payload.supportId}`;
}

function clampVisualOpacity(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.92;
  return Math.min(1, Math.max(0.35, value));
}

function safeEvidenceCount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function drawVisualSupportPattern(
  page: ReturnType<PDFDocument["addPage"]>,
  markerText: string,
  supportId: string,
  expectedIdHex: string | null,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  opacity: number,
): void {
  const { width, height } = page.getSize();
  const fontSize = Math.max(6, Math.min(8, Math.floor(Math.min(width, height) / 70)));
  const margin = Math.max(10, Math.min(18, Math.floor(Math.min(width, height) / 35)));
  const dark = rgb(0.02, 0.02, 0.02);
  const muted = rgb(0.15, 0.15, 0.15);
  const line = markerText.length > 118 ? markerText.slice(0, 118) : markerText;

  page.drawText(line, { x: margin, y: height - margin - fontSize, size: fontSize, font, color: dark, opacity });
  page.drawText(line, { x: margin, y: margin, size: fontSize, font, color: dark, opacity });
  page.drawText(line, {
    x: margin,
    y: margin + 6,
    size: fontSize,
    font,
    color: muted,
    opacity,
    rotate: degrees(90),
  });
  page.drawText(line, {
    x: width - margin,
    y: margin + 6,
    size: fontSize,
    font,
    color: muted,
    opacity,
    rotate: degrees(90),
  });

  const digest = sha256(`${supportId}|${expectedIdHex ?? ""}`);
  const cell = Math.max(3, Math.min(5, Math.floor(Math.min(width, height) / 120)));
  const grid = 6;
  const origins = [
    [margin, height - margin - fontSize - grid * cell - 4],
    [width - margin - grid * cell, height - margin - fontSize - grid * cell - 4],
    [margin, margin + fontSize + 4],
    [width - margin - grid * cell, margin + fontSize + 4],
  ] as const;
  for (const [originX, originY] of origins) {
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const nibble = Number.parseInt(digest[(x + y * grid) % digest.length] ?? "0", 16);
        const finder = x === 0 || y === 0 || x === grid - 1 || y === grid - 1;
        const fill = finder || nibble % 2 === 1 ? dark : rgb(0.86, 0.86, 0.86);
        page.drawRectangle({
          x: originX + x * cell,
          y: originY + y * cell,
          width: cell,
          height: cell,
          color: fill,
          opacity: finder ? Math.min(1, opacity + 0.05) : opacity,
        });
      }
    }
  }
}

function bitFromDigest(digest: string, bitIndex: number): boolean {
  const hex = digest[bitIndex % digest.length] ?? "0";
  return (Number.parseInt(hex, 16) & (1 << (bitIndex % 4))) !== 0;
}

function drawVisualSupportPatternV2(
  page: ReturnType<PDFDocument["addPage"]>,
  markerText: string,
  supportId: string,
  expectedIdHex: string | null,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  opacity: number,
): void {
  const { width, height } = page.getSize();
  const shortest = Math.min(width, height);
  const fontSize = Math.max(6, Math.min(8, Math.floor(shortest / 70)));
  const margin = Math.max(12, Math.min(22, Math.floor(shortest / 32)));
  const grid = 9;
  const cell = Math.max(6, Math.min(9, Math.floor(shortest / 78)));
  const gridPx = grid * cell;
  const quiet = Math.max(3, Math.floor(cell / 2));
  const v1Reserved = Math.max(28, Math.floor(shortest / 11));
  const dark = rgb(0, 0, 0);
  const light = rgb(0.98, 0.98, 0.98);
  const border = rgb(0.08, 0.08, 0.08);
  const digest = sha256(`v2|${supportId}|${expectedIdHex ?? ""}`);
  const line = markerText.length > 128 ? markerText.slice(0, 128) : markerText;
  const origins = [
    [margin, height - margin - fontSize - v1Reserved - gridPx],
    [width - margin - gridPx, height - margin - fontSize - v1Reserved - gridPx],
    [margin, margin + fontSize + v1Reserved],
    [width - margin - gridPx, margin + fontSize + v1Reserved],
  ] as const;

  for (const [originX, originY] of origins) {
    page.drawRectangle({
      x: originX - quiet,
      y: originY - quiet,
      width: gridPx + quiet * 2,
      height: gridPx + quiet * 2,
      color: light,
      opacity: Math.min(1, Math.max(0.82, opacity)),
    });
    page.drawRectangle({
      x: originX - quiet,
      y: originY - quiet,
      width: gridPx + quiet * 2,
      height: quiet,
      color: border,
      opacity,
    });
    page.drawRectangle({
      x: originX - quiet,
      y: originY + gridPx,
      width: gridPx + quiet * 2,
      height: quiet,
      color: border,
      opacity,
    });
    page.drawRectangle({
      x: originX - quiet,
      y: originY - quiet,
      width: quiet,
      height: gridPx + quiet * 2,
      color: border,
      opacity,
    });
    page.drawRectangle({
      x: originX + gridPx,
      y: originY - quiet,
      width: quiet,
      height: gridPx + quiet * 2,
      color: border,
      opacity,
    });

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const bitIndex = x + y * grid;
        const bit = bitFromDigest(digest, bitIndex);
        page.drawRectangle({
          x: originX + x * cell,
          y: originY + y * cell,
          width: cell,
          height: cell,
          color: bit ? dark : light,
          opacity,
        });
      }
    }
    page.drawText(line, {
      x: originX,
      y: Math.max(margin, originY - quiet - fontSize - 2),
      size: fontSize,
      font,
      color: dark,
      opacity: Math.min(1, Math.max(0.6, opacity - 0.08)),
    });
  }
}

function isValidSupportId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= PDF_SAFE_REPLACEMENT_MAX_SUPPORT_ID_CHARS &&
    /^[a-zA-Z0-9._:-]+$/.test(value)
  );
}

function isValidExpectedIdHex(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 256 &&
      value.length % 2 === 0 &&
      /^[a-fA-F0-9]+$/.test(value))
  );
}

function isValidNote(value: unknown): value is string {
  return typeof value === "string" && value.length <= PDF_SAFE_REPLACEMENT_MAX_NOTE_CHARS;
}

function isValidWrittenAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function invalidSupportPayloadResult(
  inputSha256: string,
): PdfSafeReplacementWriteResult {
  return {
    ...baseResult(),
    status: "invalid_support_payload",
    pdfBytes: null,
    inputSha256,
    outputSha256: null,
    payloadSha256: null,
    payload: null,
    exactIdMatched: false,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
  };
}

export async function writePdfSafeSupportPayload(
  input: PdfSafeReplacementWriteInput,
): Promise<PdfSafeReplacementWriteResult> {
  const inputSha256 = sha256(input.pdfBytes);
  if (!looksLikePdf(input.pdfBytes)) {
    return {
      ...baseResult(),
      status: "invalid_pdf",
      pdfBytes: null,
      inputSha256,
      outputSha256: null,
      payloadSha256: null,
      payload: null,
      exactIdMatched: false,
      wrongIdCanOpenVault: false,
      missingIdCanOpenVault: false,
    };
  }

  try {
    const note = input.note ?? "TancMark PDF support-only payload. This is not VAULT evidence.";
    const writtenAt =
      input.writtenAt instanceof Date
        ? input.writtenAt.toISOString()
        : input.writtenAt ?? new Date().toISOString();
    const expectedIdHex = input.expectedIdHex ?? null;
    if (
      !isValidSupportId(input.supportId) ||
      !isValidExpectedIdHex(expectedIdHex) ||
      !isValidNote(note) ||
      !isValidWrittenAt(writtenAt)
    ) {
      return invalidSupportPayloadResult(inputSha256);
    }
    const pdf = await PDFDocument.load(input.pdfBytes);
    const payload: PdfSafeReplacementSupportPayload = {
      schemaVersion: "tancmark-pdf-support-payload-v1",
      supportOnly: true,
      marker: "TANCMARK_SUPPORT_ONLY",
      supportId: input.supportId,
      expectedIdHex,
      note,
      writtenAt,
    };
    const payloadSha256 = sha256(JSON.stringify(payload));
    const encodedPayload = encodePayload(payload);
    if (encodedPayload.length > PDF_SAFE_REPLACEMENT_MAX_METADATA_CHARS) {
      return invalidSupportPayloadResult(inputSha256);
    }
    pdf.setSubject(encodedPayload);
    pdf.setKeywords(["TANCMARK_SUPPORT_ONLY", `payload-sha256:${payloadSha256}`]);
    pdf.setProducer("TancMark pdf-lib support-only adapter");
    pdf.setModificationDate(new Date(payload.writtenAt));
    const outputPdfBytes = await pdf.save({ useObjectStreams: false });
    return {
      ...baseResult(),
      status: "support_payload_written",
      pdfBytes: outputPdfBytes,
      inputSha256,
      outputSha256: sha256(outputPdfBytes),
      payloadSha256,
      payload,
      exactIdMatched: exactIdMatched(payload, input.expectedIdHex),
      wrongIdCanOpenVault: false,
      missingIdCanOpenVault: false,
    };
  } catch {
    return {
      ...baseResult(),
      status: "pdf_load_failed",
      pdfBytes: null,
      inputSha256,
      outputSha256: null,
      payloadSha256: null,
      payload: null,
      exactIdMatched: false,
      wrongIdCanOpenVault: false,
      missingIdCanOpenVault: false,
    };
  }
}

function visualWriteResult(
  result: PdfSafeReplacementWriteResult,
  markerText: string | null,
  markerApplied: boolean,
  markerPages: number,
): PdfSafeReplacementVisualWriteResult {
  return {
    ...result,
    visualSupportOnly: true,
    visualMarkerPrefix: PDF_SAFE_VISUAL_SUPPORT_MARKER_PREFIX,
    visualMarkerV2Prefix: PDF_SAFE_VISUAL_SUPPORT_MARKER_V2_PREFIX,
    visualMarkerApplied: markerApplied,
    visualMarkerV2Applied: markerApplied,
    visualMarkerText: markerText,
    visualMarkerPages: markerPages,
    visualMarkerV2GridSize: 9,
    visualMarkerCanOpenVault: false,
  };
}

export async function writePdfSafeVisualSupportPayload(
  input: PdfSafeReplacementVisualWriteInput,
): Promise<PdfSafeReplacementVisualWriteResult> {
  const metadataResult = await writePdfSafeSupportPayload(input);
  if (!metadataResult.pdfBytes || !metadataResult.payload) {
    return visualWriteResult(metadataResult, null, false, 0);
  }
  if (input.explicitVisibleMarkOptIn !== true) {
    return visualWriteResult(metadataResult, null, false, 0);
  }

  try {
    const markerText = visualMarkerText(metadataResult.payload);
    const markerV2Text = visualMarkerV2Text(metadataResult.payload);
    const pdf = await PDFDocument.load(metadataResult.pdfBytes);
    const font = await pdf.embedFont(StandardFonts.CourierBold);
    const opacity = clampVisualOpacity(input.visualOpacity);
    const pages = pdf.getPages();
    for (const page of pages) {
      drawVisualSupportPattern(
        page,
        markerText,
        metadataResult.payload.supportId,
        metadataResult.payload.expectedIdHex,
        font,
        opacity,
      );
      drawVisualSupportPatternV2(
        page,
        markerV2Text,
        metadataResult.payload.supportId,
        metadataResult.payload.expectedIdHex,
        font,
        opacity,
      );
    }
    pdf.setProducer("TancMark pdf-lib visual support-only adapter v2");
    const outputPdfBytes = await pdf.save({ useObjectStreams: false });
    return visualWriteResult(
      {
        ...metadataResult,
        status: "support_payload_written",
        pdfBytes: outputPdfBytes,
        outputSha256: sha256(outputPdfBytes),
        exactIdMatched: exactIdMatched(metadataResult.payload, input.expectedIdHex),
      },
      markerText,
      pages.length > 0,
      pages.length,
    );
  } catch {
    return visualWriteResult(
      {
        ...baseResult(),
        status: "pdf_load_failed",
        pdfBytes: null,
        inputSha256: metadataResult.inputSha256,
        outputSha256: null,
        payloadSha256: metadataResult.payloadSha256,
        payload: metadataResult.payload,
        exactIdMatched: false,
        wrongIdCanOpenVault: false,
        missingIdCanOpenVault: false,
      },
      null,
      false,
      0,
    );
  }
}

export async function readPdfSafeSupportPayload(
  input: PdfSafeReplacementReadInput,
): Promise<PdfSafeReplacementReadResult> {
  const inputSha256 = sha256(input.pdfBytes);
  if (!looksLikePdf(input.pdfBytes)) {
    return {
      ...baseResult(),
      status: "invalid_pdf",
      inputSha256,
      payloadSha256: null,
      payload: null,
      exactIdMatched: false,
      wrongIdCanOpenVault: false,
      missingIdCanOpenVault: false,
    };
  }

  try {
    const pdf = await PDFDocument.load(input.pdfBytes);
    const payload = decodePayload(pdf.getSubject());
    return {
      ...baseResult(),
      status: payload ? "support_payload_found" : "support_payload_missing",
      inputSha256,
      payloadSha256: payload ? sha256(JSON.stringify(payload)) : null,
      payload,
      exactIdMatched: exactIdMatched(payload, input.expectedIdHex),
      wrongIdCanOpenVault: false,
      missingIdCanOpenVault: false,
    };
  } catch {
    return {
      ...baseResult(),
      status: "pdf_load_failed",
      inputSha256,
      payloadSha256: null,
      payload: null,
      exactIdMatched: false,
      wrongIdCanOpenVault: false,
      missingIdCanOpenVault: false,
    };
  }
}

export const pdfLibSupportOnlyAdapter: PdfSafeReplacementAdapterBoundary = {
  name: "pdf-lib-support-only-adapter",
  library: "pdf-lib",
  version: PDF_SAFE_REPLACEMENT_ENGINE_VERSION,
  supportOnly: true,
  productReady: false,
  canOpenVault: false,
  confirmed: false,
  final: false,
  thresholdChanged: false,
  ownershipPreSealChanged: false,
  capabilities: [
    "metadata_support_payload_write",
    "metadata_support_payload_read",
    "exact_id_support_match_report",
    "visual_text_support_payload_write",
  ],
  blockedCapabilities: [
    "vault_open",
    "confirmed_decision",
    "final_decision",
    "threshold_change",
    "ownership_pre_seal_change",
    "pdf_rendering",
    "eps_postscript_rendering",
    "visual_text_support_payload_as_final_decision",
    "dirty_real_world_pdf_product_claim",
  ],
  writeSupportPayload: writePdfSafeSupportPayload,
  writeVisualSupportPayload: writePdfSafeVisualSupportPayload,
  readSupportPayload: readPdfSafeSupportPayload,
};

export function getPdfSafeReplacementReadiness(): PdfSafeReplacementReadinessResult {
  return {
    ...baseResult(),
    status: "support_only_adapter_ready_product_not_ready",
    adapterName: pdfLibSupportOnlyAdapter.name,
    productReady: false,
    noticeManifestReady: true,
    remainingProductReadinessBlockers: [
      "dirty_real_world_pdf_corpus",
      "rasterized_or_re_pdf_roundtrip",
      "physical_print_scan_like_pdf_tests",
      "visual_support_text_marker_is_lab_only_not_product_ready",
      "larger_wrong_id_no_id_negative_matrix",
      "product_pdf_engine_not_integrated",
      "pdfium_pdfjs_pdfbox_future_gates_not_closed",
      "final_product_sbom_third_party_notices_not_generated",
    ],
  };
}

export function getPdfSafeReplacementProductBinding(
  evidence?: PdfSafeReplacementProductBindingEvidence | null,
): PdfSafeReplacementProductBindingResult {
  const screenPhotoPhysicalExactMatches = safeEvidenceCount(evidence?.screenPhotoPhysicalExactMatches);
  const noPrinterLabExactMatches = safeEvidenceCount(evidence?.noPrinterLabExactMatches);
  const aggregateSupportMatches =
    screenPhotoPhysicalExactMatches === null || noPrinterLabExactMatches === null
      ? null
      : screenPhotoPhysicalExactMatches + noPrinterLabExactMatches;
  return {
    ...baseResult(),
    status: "support_product_path_bound_real_printer_deferred",
    gate: PDF_SAFE_REPLACEMENT_PRODUCT_BINDING_GATE,
    adapterName: pdfLibSupportOnlyAdapter.name,
    adapterLibrary: pdfLibSupportOnlyAdapter.library,
    productPathBound: true,
    internalProductPathEnabled: true,
    publicProductReady: false,
    productReady: false,
    productBehaviorChanged: false,
    exactIdStillRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportAdvisoryFinal: false,
    visualMarkerV2Enabled: true,
    realPrinterGateDeferred: true,
    realPrinterRequiredBeforePublicReady: true,
    simulatedPrintScanCountsAsProductProof: false,
    screenPhotoPhysicalExactMatches,
    noPrinterLabExactMatches,
    aggregateSupportMatches,
    aggregateResultsProvided: aggregateSupportMatches,
    anyVaultOpened: false,
    freeOpenSourceOnly: true,
    commercialUseClear: true,
    license: "MIT",
    allowedProductRuntimeTools: ["pdf-lib"],
    productRuntimeDenylistPolicy: "license_cleanup_phase_1_pdf_runtime_denylist",
    remainingProductReadinessBlockers: [
      "real_physical_print_scan_current_lineage",
      "scanner_app_current_lineage",
      "real_pdf_app_export_current_lineage",
      "broader_dirty_pdf_negative_matrix",
      "final_product_sbom_third_party_notices_not_generated",
    ],
  };
}
