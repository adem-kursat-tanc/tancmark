import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export const DOCX_AI_SEAL_FEATURE_FLAG =
  "TANCMARK_AI_SEAL_DOCX_ENABLED" as const;

export const DOCX_AI_SEAL_DECISION_ROLE =
  "docx_ai_exact_id_ownership_no_vault_no_final" as const;

export const DOCX_AI_SEAL_VERSION = "tancmark-ai-seal-docx-mvp-v1" as const;

export type DocxAiSealDisplayText =
  | "AI kesin ID okundu"
  | "AI destek izi bulunamadi"
  | "Zayif AI sinyal var";

export type DocxAiSealOwnershipDecision =
  | "ai_ownership_asserted_by_exact_id"
  | "ai_weak_trace_percent_only"
  | "ai_ownership_not_asserted";

export type DocxAiSealOperation = "embed" | "search" | "degraded_recovery";

export interface DocxAiSealGate {
  module: "docx_ai_seal";
  enabled: boolean;
  featureFlag: typeof DOCX_AI_SEAL_FEATURE_FLAG;
  defaultEnabled: false;
  productReady: false;
  decisionRole: typeof DOCX_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface SealDocxAiDocumentInput {
  docx: Buffer;
  tancmarkId: string;
}

export interface SealDocxAiDocumentResult {
  docx: Buffer;
  packageEntryCount: number;
  aiSealEmbedded: true;
  sourceDocxMutated: false;
  visibleDocumentTextMutated: false;
  decisionRole: typeof DOCX_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface ReadDocxAiSealInput {
  docx: Buffer;
  expectedTancmarkId: string;
}

export interface ReadDocxAiSealResult {
  found: boolean;
  weakSignal: boolean;
  score: number;
  displayText: DocxAiSealDisplayText;
  decisionRole: typeof DOCX_AI_SEAL_DECISION_ROLE;
  canAssertAiOwnership: boolean;
  aiOwnershipDecision: DocxAiSealOwnershipDecision;
  ownershipConfidencePercent: number;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface InspectDocxAiPackageResult {
  openable: true;
  entryCount: number;
  hasDocumentXml: true;
  hasContentTypes: true;
}

export interface DocxAiSealTokenEstimateInput {
  operation: DocxAiSealOperation;
  sizeBytes: number;
}

export interface DocxAiSealTokenEstimate {
  operation: DocxAiSealOperation;
  estimatedTokens: number;
  userMessage: string;
  approveButton: "Onayla ve islemi baslat";
  cancelButton: "Iptal et";
  requiresExplicitApproval: true;
}

export interface DocxAiSealEvidenceComponents {
  packageMarkerFound: boolean;
  documentPropertyMarkerFound: boolean;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

const MAX_SUPPORTED_DOCX_BYTES = 60 * 1024 * 1024;
const DOCX_AI_MARKER_PREFIX = "tancmark-docx-ai-seal:";
const DOCX_AI_PACKAGE_MARKER = "customXml/tancmark-ai-seal.xml";
const DOCX_AI_PROPERTY_MARKER = "docProps/tancmark-ai-seal.xml";
const CONTENT_TYPES_ENTRY = "[Content_Types].xml";
const WORD_DOCUMENT_ENTRY = "word/document.xml";

export function getDocxAiSealGate(
  env: NodeJS.ProcessEnv = process.env,
): DocxAiSealGate {
  return {
    module: "docx_ai_seal",
    enabled:
      env[DOCX_AI_SEAL_FEATURE_FLAG] === "1" ||
      env[DOCX_AI_SEAL_FEATURE_FLAG] === "true",
    featureFlag: DOCX_AI_SEAL_FEATURE_FLAG,
    defaultEnabled: false,
    productReady: false,
    decisionRole: DOCX_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export function estimateDocxAiSealTokens(
  input: DocxAiSealTokenEstimateInput,
): DocxAiSealTokenEstimate {
  const sizeFactor = Math.max(1, Math.ceil(input.sizeBytes / 1_000_000));
  const base =
    input.operation === "embed" ? 220 : input.operation === "search" ? 180 : 360;
  const estimatedTokens = base + sizeFactor * 45;
  return {
    operation: input.operation,
    estimatedTokens,
    userMessage: `Bu islem yaklasik ${estimatedTokens} token yakacak.`,
    approveButton: "Onayla ve islemi baslat",
    cancelButton: "Iptal et",
    requiresExplicitApproval: true,
  };
}

export async function sealDocxAiDocument(
  input: SealDocxAiDocumentInput,
): Promise<SealDocxAiDocumentResult> {
  assertDocxAiFeatureEnabled();
  assertSafeId(input.tancmarkId);
  assertSafeDocxSize(input.docx);

  const entries = readDocxPackage(input.docx);
  assertOpenableDocx(entries);
  const tag = createDocxAiSealTag(input.tancmarkId);
  const nextEntries = upsertZipEntry(
    upsertZipEntry(
      upsertZipEntry(entries, DOCX_AI_PACKAGE_MARKER, createPackageMarkerXml(tag)),
      DOCX_AI_PROPERTY_MARKER,
      createDocumentPropertyMarkerXml(tag),
    ),
    CONTENT_TYPES_ENTRY,
    ensureDocxAiContentTypes(getRequiredTextEntry(entries, CONTENT_TYPES_ENTRY)),
  );

  return {
    docx: writeZipEntries(nextEntries),
    packageEntryCount: nextEntries.length,
    aiSealEmbedded: true,
    sourceDocxMutated: false,
    visibleDocumentTextMutated: false,
    decisionRole: DOCX_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export async function readDocxAiSeal(
  input: ReadDocxAiSealInput,
): Promise<ReadDocxAiSealResult> {
  assertDocxAiFeatureEnabled();
  assertSafeId(input.expectedTancmarkId);
  assertSafeDocxSize(input.docx);

  const entries = readDocxPackage(input.docx);
  assertOpenableDocx(entries);
  const tag = createDocxAiSealTag(input.expectedTancmarkId);
  const packageMarkerFound = entryContains(entries, DOCX_AI_PACKAGE_MARKER, tag);
  const documentPropertyMarkerFound = entryContains(entries, DOCX_AI_PROPERTY_MARKER, tag);

  return classifyDocxAiSealEvidence({
    packageMarkerFound,
    documentPropertyMarkerFound,
  });
}

export function classifyDocxAiSealEvidence(
  components: DocxAiSealEvidenceComponents,
): ReadDocxAiSealResult {
  const found = components.packageMarkerFound && components.documentPropertyMarkerFound;
  const weakSignal =
    !found && (components.packageMarkerFound || components.documentPropertyMarkerFound);
  const score = found ? 1 : weakSignal ? 0.5 : 0;
  const ownershipConfidencePercent = found ? 100 : weakSignal ? 50 : 0;
  return {
    found,
    weakSignal,
    score,
    displayText: found
      ? "AI kesin ID okundu"
      : weakSignal
        ? "Zayif AI sinyal var"
        : "AI destek izi bulunamadi",
    decisionRole: DOCX_AI_SEAL_DECISION_ROLE,
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

export function inspectDocxAiPackage(docx: Buffer): InspectDocxAiPackageResult {
  assertSafeDocxSize(docx);
  const entries = readDocxPackage(docx);
  assertOpenableDocx(entries);
  return {
    openable: true,
    entryCount: entries.length,
    hasDocumentXml: true,
    hasContentTypes: true,
  };
}

export function createDocxAiSealTag(tancmarkId: string): string {
  assertSafeId(tancmarkId);
  return `${DOCX_AI_MARKER_PREFIX}${createHash("sha256")
    .update(DOCX_AI_SEAL_VERSION)
    .update(":")
    .update(tancmarkId)
    .digest("hex")}`;
}

function assertDocxAiFeatureEnabled() {
  if (!getDocxAiSealGate().enabled) {
    throw new Error("docx_ai_seal_feature_flag_disabled");
  }
}

function assertSafeId(value: string) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(value)) {
    throw new Error("invalid_docx_ai_seal_tancmark_id");
  }
}

function assertSafeDocxSize(docx: Buffer) {
  if (docx.length <= 0 || docx.length > MAX_SUPPORTED_DOCX_BYTES) {
    throw new Error("unsafe_docx_ai_seal_size");
  }
}

function readDocxPackage(docx: Buffer): ZipEntry[] {
  const entries = readZipEntries(docx);
  if (entries.length <= 0) {
    throw new Error("unsupported_docx_ai_seal_empty_package");
  }
  return entries;
}

function assertOpenableDocx(entries: ZipEntry[]) {
  if (!hasEntry(entries, CONTENT_TYPES_ENTRY) || !hasEntry(entries, WORD_DOCUMENT_ENTRY)) {
    throw new Error("unsupported_docx_ai_seal_package");
  }
}

function hasEntry(entries: ZipEntry[], name: string): boolean {
  return entries.some((entry) => entry.name === name);
}

function entryContains(entries: ZipEntry[], name: string, value: string): boolean {
  const entry = entries.find((candidate) => candidate.name === name);
  return entry?.data.toString("utf8").includes(value) === true;
}

function getRequiredTextEntry(entries: ZipEntry[], name: string): string {
  const entry = entries.find((candidate) => candidate.name === name);
  if (!entry) throw new Error("unsupported_docx_ai_seal_package");
  return entry.data.toString("utf8");
}

function upsertZipEntry(entries: ZipEntry[], name: string, data: string | Buffer): ZipEntry[] {
  const normalizedName = normalizeZipEntryName(name);
  const payload = Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data, "utf8");
  const next = entries.filter((entry) => entry.name !== normalizedName);
  next.push({ name: normalizedName, data: payload });
  return next.sort((left, right) => left.name.localeCompare(right.name));
}

function createPackageMarkerXml(tag: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tancmarkAiSeal version="${escapeXml(DOCX_AI_SEAL_VERSION)}" role="${escapeXml(DOCX_AI_SEAL_DECISION_ROLE)}">`,
    `  <exactIdTag>${escapeXml(tag)}</exactIdTag>`,
    "  <vault>false</vault>",
    "  <final>false</final>",
    "</tancmarkAiSeal>",
  ].join("\n");
}

function createDocumentPropertyMarkerXml(tag: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tancmarkDocxAiProperty version="${escapeXml(DOCX_AI_SEAL_VERSION)}">`,
    `  <exactIdTag>${escapeXml(tag)}</exactIdTag>`,
    "  <visibleDocumentTextMutated>false</visibleDocumentTextMutated>",
    "</tancmarkDocxAiProperty>",
  ].join("\n");
}

function ensureDocxAiContentTypes(contentTypesXml: string): string {
  let updated = contentTypesXml;
  for (const partName of [`/${DOCX_AI_PACKAGE_MARKER}`, `/${DOCX_AI_PROPERTY_MARKER}`]) {
    if (updated.includes(`PartName="${partName}"`)) continue;
    updated = updated.replace(
      "</Types>",
      `<Override PartName="${partName}" ContentType="application/xml"/></Types>`,
    );
  }
  return updated;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeZipEntryName(name: string): string {
  const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("unsafe_docx_ai_seal_zip_entry_name");
  }
  return normalized;
}

function readZipEntries(archive: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = archive.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("unsupported_docx_ai_seal_central_directory");
    }
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const fileNameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const name = normalizeZipEntryName(
      archive.toString("utf8", nameStart, nameStart + fileNameLength),
    );
    cursor = nameStart + fileNameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if ((flags & 1) === 1) {
      throw new Error("unsupported_docx_ai_seal_encrypted_entry");
    }
    if (archive.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error("unsupported_docx_ai_seal_local_header");
    }
    const localNameLength = archive.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = archive.subarray(dataStart, dataStart + compressedSize);
    const data =
      method === 0
        ? Buffer.from(compressedData)
        : method === 8
          ? inflateRawSync(compressedData)
          : unsupportedZipCompression();
    entries.push({ name, data });
  }

  return entries;
}

function unsupportedZipCompression(): never {
  throw new Error("unsupported_docx_ai_seal_zip_compression");
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const minOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("unsupported_docx_ai_seal_zip");
}

function writeZipEntries(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = normalizeZipEntryName(entry.name);
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(entry.data);
    const compressed = deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuffer.copy(localHeader, 30);
    localParts.push(localHeader, compressed);

    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuffer.copy(centralHeader, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();
