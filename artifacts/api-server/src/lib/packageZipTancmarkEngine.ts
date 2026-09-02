import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export const PACKAGE_ZIP_TANCMARK_ENGINE_VERSION =
  "package-zip-tancmark-engine-v0.1" as const;
export const PACKAGE_ZIP_TANCMARK_NAMESPACE = "urn:tancmark:package:v1" as const;
export const PACKAGE_ZIP_TANCMARK_DECISION_ROLE =
  "package_zip_tancmark_engine_support_only_no_vault_no_confirmed" as const;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;

export type TancMarkPackageFormat = "epub" | "pptx" | "xlsx";

export interface PackageZipSealInput {
  packageBytes: Buffer | Uint8Array;
  id: string;
  owner?: string | null;
  createdAt?: string | null;
  formatHint?: TancMarkPackageFormat | null;
}

export interface PackageZipEntryInput {
  name: string;
  data: Buffer | Uint8Array | string;
  compression?: "store" | "deflate";
}

export interface PackageZipSafetyEnvelope {
  engineInsideTancMark: true;
  externalToolUsed: false;
  containerUsed: false;
  paidLicenseUsed: false;
  externalUploadUsed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
  dnaCanDecideAlone: false;
}

export interface PackageZipSealResult extends PackageZipSafetyEnvelope {
  ok: boolean;
  sealedBytes: Buffer | null;
  format: TancMarkPackageFormat | null;
  id: string | null;
  originalMutated: false;
  metadataEntryName: string | null;
  metadataInserted: boolean;
  priorTancMarkMetadataRemoved: boolean;
  sidecarFallbackRequired: boolean;
  appendMode: boolean;
  originalBytesPreservedPrefix: boolean;
  decisionRole: typeof PACKAGE_ZIP_TANCMARK_DECISION_ROLE;
  reason: string;
}

export interface PackageZipReadResult extends PackageZipSafetyEnvelope {
  ok: boolean;
  format: TancMarkPackageFormat | null;
  foundTancMarkMetadata: boolean;
  metadataEntryNames: string[];
  extractedId: string | null;
  extractedIds: string[];
  expectedId: string | null;
  idMatched: boolean;
  sourceDigestSha256: string | null;
  digestMatched: boolean;
  decisionRole: typeof PACKAGE_ZIP_TANCMARK_DECISION_ROLE;
  reason: string;
}

interface ParsedZipEntry {
  name: string;
  data: Buffer;
  compressionMethod: 0 | 8;
  localHeaderOffset: number;
}

interface ZipAppendPlan {
  centralDirectoryOffset: number;
  centralDirectorySize: number;
  centralDirectoryBytes: Buffer;
  totalEntries: number;
}

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_FLAG = 1 << 11;
const ENCRYPTED_FLAG = 1;

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[i] = value >>> 0;
}

function safetyEnvelope(): PackageZipSafetyEnvelope {
  return {
    engineInsideTancMark: true,
    externalToolUsed: false,
    containerUsed: false,
    paidLicenseUsed: false,
    externalUploadUsed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
  };
}

function normalizeId(id: string | null | undefined): string | null {
  if (typeof id !== "string") return null;
  const normalized = id.trim();
  if (normalized.length === 0) return null;
  return normalized;
}

function sha256(bytes: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isSupportedId(id: string): boolean {
  return /^[A-Za-z0-9._:-]{4,128}$/.test(id);
}

function normalizeEntryName(name: string): string {
  const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.length === 0 || normalized.includes("\0") || normalized.includes("../")) {
    throw new Error(`unsafe_zip_entry_name:${name}`);
  }
  return normalized;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function addZipInflateBudget(uncompressedSize: number, totalBefore: number): number {
  if (!Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0) {
    throw new Error("zip_entry_uncompressed_size_invalid");
  }
  if (uncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
    throw new Error("zip_entry_uncompressed_size_limit_exceeded");
  }
  const totalAfter = totalBefore + uncompressedSize;
  if (totalAfter > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
    throw new Error("zip_total_uncompressed_size_limit_exceeded");
  }
  return totalAfter;
}

function inflateZipEntryWithLimit(compressedData: Buffer, uncompressedSize: number): Buffer {
  try {
    return inflateRawSync(compressedData, { maxOutputLength: uncompressedSize });
  } catch {
    throw new Error("zip_entry_inflate_failed");
  }
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const min = Math.max(0, zip.length - 0xffff - 22);
  for (let offset = zip.length - 22; offset >= min; offset -= 1) {
    if (zip.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}

function parsePackageZip(packageBytes: Buffer | Uint8Array): ParsedZipEntry[] {
  const zip = Buffer.from(packageBytes);
  const eocdOffset = findEndOfCentralDirectory(zip);
  if (eocdOffset < 0) throw new Error("zip_end_of_central_directory_not_found");

  const diskNumber = zip.readUInt16LE(eocdOffset + 4);
  const centralDisk = zip.readUInt16LE(eocdOffset + 6);
  if (diskNumber !== 0 || centralDisk !== 0) throw new Error("split_zip_not_supported");

  const totalEntries = zip.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  let cursor = centralDirectoryOffset;
  const entries: ParsedZipEntry[] = [];
  let totalUncompressedBytes = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > zip.length) throw new Error("central_directory_truncated");
    if (zip.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error("central_directory_header_not_found");
    }

    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localHeaderOffset = zip.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > zip.length) throw new Error("central_directory_name_truncated");
    const name = normalizeEntryName(zip.slice(nameStart, nameEnd).toString("utf8"));
    cursor = nameEnd + extraLength + commentLength;

    if ((flags & ENCRYPTED_FLAG) !== 0) throw new Error(`encrypted_zip_entry_not_supported:${name}`);
    if (method !== 0 && method !== 8) {
      throw new Error(`zip_compression_method_not_supported:${name}:${method}`);
    }
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) {
      throw new Error(`zip64_entry_not_supported:${name}`);
    }
    totalUncompressedBytes = addZipInflateBudget(uncompressedSize, totalUncompressedBytes);

    if (localHeaderOffset + 30 > zip.length) throw new Error(`local_header_truncated:${name}`);
    if (zip.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER) {
      throw new Error(`local_header_not_found:${name}`);
    }
    const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zip.length) throw new Error(`zip_entry_data_truncated:${name}`);
    const compressedData = zip.slice(dataStart, dataEnd);
    const data = method === 0 ? Buffer.from(compressedData) : inflateZipEntryWithLimit(compressedData, uncompressedSize);
    if (data.length !== uncompressedSize) throw new Error(`zip_entry_size_mismatch:${name}`);

    entries.push({
      name,
      data,
      compressionMethod: method as 0 | 8,
      localHeaderOffset,
    });
  }

  return entries;
}

function planZipAppend(zip: Buffer, parsedEntries: readonly ParsedZipEntry[]): ZipAppendPlan {
  const eocdOffset = findEndOfCentralDirectory(zip);
  if (eocdOffset < 0) throw new Error("zip_end_of_central_directory_not_found");

  const diskNumber = zip.readUInt16LE(eocdOffset + 4);
  const centralDisk = zip.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = zip.readUInt16LE(eocdOffset + 8);
  const totalEntries = zip.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = zip.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  const commentLength = zip.readUInt16LE(eocdOffset + 20);

  if (diskNumber !== 0 || centralDisk !== 0) throw new Error("split_zip_not_supported");
  if (entriesOnDisk !== totalEntries) throw new Error("split_zip_not_supported");
  if (totalEntries === 0xffff) throw new Error("zip64_entry_count_not_supported");
  if (centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("zip64_central_directory_not_supported");
  }
  if (totalEntries !== parsedEntries.length) throw new Error("zip_entry_count_mismatch");
  if (eocdOffset + 22 + commentLength !== zip.length) throw new Error("zip_trailing_data_not_supported");
  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) {
    throw new Error("central_directory_bounds_invalid");
  }

  return {
    centralDirectoryOffset,
    centralDirectorySize,
    centralDirectoryBytes: Buffer.from(zip.slice(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize)),
    totalEntries,
  };
}

export function buildPackageZipFromEntries(entries: readonly PackageZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = normalizeEntryName(entry.name);
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(entry.data)
      ? Buffer.from(entry.data)
      : typeof entry.data === "string"
        ? Buffer.from(entry.data, "utf8")
        : Buffer.from(entry.data);
    const method = entry.compression === "store" ? 0 : 8;
    const compressedData = method === 0 ? data : deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(LOCAL_FILE_HEADER, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressedData.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);
    localParts.push(local, compressedData);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressedData.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);
    centralParts.push(central);

    offset += local.length + compressedData.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function detectPackageFormat(entries: readonly ParsedZipEntry[]): TancMarkPackageFormat | null {
  const names = new Set(entries.map((entry) => entry.name.toLowerCase()));
  if (names.has("ppt/presentation.xml")) return "pptx";
  if (names.has("xl/workbook.xml")) return "xlsx";
  if (
    names.has("mimetype") &&
    (names.has("meta-inf/container.xml") || [...names].some((name) => name.startsWith("oebps/")))
  ) {
    return "epub";
  }
  return null;
}

function metadataEntryFor(format: TancMarkPackageFormat): string {
  if (format === "epub") return "META-INF/tancmark.xml";
  return "docProps/tancmark.xml";
}

function isTancMarkMetadataEntry(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized === "meta-inf/tancmark.xml" ||
    normalized === "docprops/tancmark.xml" ||
    normalized === "tancmark/tancmark.xml"
  );
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeXmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function buildMetadataXml(input: {
  id: string;
  owner: string | null;
  createdAt: string;
  format: TancMarkPackageFormat;
  sourceDigestSha256: string;
}): string {
  const ownerAttribute = input.owner
    ? ` owner="${escapeXmlAttribute(input.owner)}"`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<tancmark:packageMark xmlns:tancmark="${PACKAGE_ZIP_TANCMARK_NAMESPACE}" version="1" engine="${PACKAGE_ZIP_TANCMARK_ENGINE_VERSION}" format="${input.format}" id="${escapeXmlAttribute(
    input.id,
  )}"${ownerAttribute} createdAt="${escapeXmlAttribute(
    input.createdAt,
  )}" sourceDigestSha256="${input.sourceDigestSha256}" sourceDigestAlgorithm="sha256" supportOnly="true" canOpenVault="false" confirmed="false" final="false" externalToolUsed="false" containerUsed="false" paidLicenseUsed="false" />`;
}

function parseAttributes(attributeText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(attributeText))) {
    const key = match[1];
    const rawValue = match[2] ?? match[3] ?? "";
    if (key) attrs[key] = unescapeXmlAttribute(rawValue);
  }
  return attrs;
}

function extractTancMarkId(xml: string): string | null {
  const match = /<tancmark:packageMark\b([^>]*)\/?>/i.exec(xml);
  if (!match) return null;
  const attrs = parseAttributes(match[1] ?? "");
  return normalizeId(attrs.id);
}

function extractTancMarkSourceDigest(xml: string): string | null {
  const match = /<tancmark:packageMark\b([^>]*)\/?>/i.exec(xml);
  if (!match) return null;
  const attrs = parseAttributes(match[1] ?? "");
  const digest = attrs.sourceDigestSha256;
  return typeof digest === "string" && /^[a-fA-F0-9]{64}$/.test(digest) ? digest.toLowerCase() : null;
}

function packageEntriesForWrite(entries: readonly ParsedZipEntry[]): PackageZipEntryInput[] {
  return entries.map((entry) => ({
    name: entry.name,
    data: entry.data,
    compression: entry.name.toLowerCase() === "mimetype" ? "store" : "deflate",
  }));
}

function orderPackageEntries(format: TancMarkPackageFormat, entries: PackageZipEntryInput[]): PackageZipEntryInput[] {
  if (format !== "epub") return entries;
  const mimetype = entries.find((entry) => entry.name.toLowerCase() === "mimetype");
  if (!mimetype) return entries;
  return [mimetype, ...entries.filter((entry) => entry !== mimetype)];
}

function appendMetadataEntryPreservingOriginalZip(
  zip: Buffer,
  plan: ZipAppendPlan,
  name: string,
  data: string,
): Buffer {
  const nameBytes = Buffer.from(normalizeEntryName(name), "utf8");
  const dataBytes = Buffer.from(data, "utf8");
  const compressedData = deflateRawSync(dataBytes);
  const crc = crc32(dataBytes);
  const newLocalOffset = zip.length;

  if (plan.totalEntries + 1 > 0xffff) throw new Error("zip64_entry_count_not_supported");

  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(LOCAL_FILE_HEADER, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(UTF8_FLAG, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressedData.length, 18);
  local.writeUInt32LE(dataBytes.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  nameBytes.copy(local, 30);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(CENTRAL_DIRECTORY_HEADER, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(UTF8_FLAG, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressedData.length, 20);
  central.writeUInt32LE(dataBytes.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(newLocalOffset, 42);
  nameBytes.copy(central, 46);

  const centralDirectoryOffset = zip.length + local.length + compressedData.length;
  const centralDirectory = Buffer.concat([plan.centralDirectoryBytes, central]);
  if (centralDirectoryOffset > 0xffffffff || centralDirectory.length > 0xffffffff) {
    throw new Error("zip64_central_directory_not_supported");
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(plan.totalEntries + 1, 8);
  eocd.writeUInt16LE(plan.totalEntries + 1, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([zip, local, compressedData, centralDirectory, eocd]);
}

export function listPackageZipEntries(packageBytes: Buffer | Uint8Array): string[] {
  return parsePackageZip(packageBytes).map((entry) => entry.name);
}

export function sealPackageZip(input: PackageZipSealInput): PackageZipSealResult {
  const id = normalizeId(input.id);
  const base = {
    ...safetyEnvelope(),
    sealedBytes: null,
    format: null,
    id,
    originalMutated: false as const,
    metadataEntryName: null,
    metadataInserted: false,
    priorTancMarkMetadataRemoved: false,
    sidecarFallbackRequired: false,
    appendMode: false,
    originalBytesPreservedPrefix: false,
    decisionRole: PACKAGE_ZIP_TANCMARK_DECISION_ROLE,
  };

  if (!id || !isSupportedId(id)) {
    return { ...base, ok: false, reason: "invalid_or_missing_exact_id" };
  }

  const zip = Buffer.from(input.packageBytes);
  let parsed: ParsedZipEntry[];
  try {
    parsed = parsePackageZip(zip);
  } catch (error) {
    return {
      ...base,
      ok: false,
      sidecarFallbackRequired: true,
      reason: `input_is_not_supported_zip_package_use_sidecar:${error instanceof Error ? error.message : "unknown"}`,
    };
  }

  const detectedFormat = detectPackageFormat(parsed);
  const format = input.formatHint ?? detectedFormat;
  if (!format || !["epub", "pptx", "xlsx"].includes(format)) {
    return { ...base, ok: false, reason: "unsupported_package_format" };
  }
  if (detectedFormat && input.formatHint && detectedFormat !== input.formatHint) {
    return { ...base, ok: false, format: detectedFormat, reason: "format_hint_mismatch" };
  }

  const metadataEntryName = metadataEntryFor(format);
  const priorTancMarkMetadataRemoved = parsed.some((entry) => isTancMarkMetadataEntry(entry.name));
  if (priorTancMarkMetadataRemoved) {
    return {
      ...base,
      ok: false,
      format,
      metadataEntryName,
      priorTancMarkMetadataRemoved: true,
      sidecarFallbackRequired: true,
      reason: "prior_tancmark_package_metadata_present_use_sidecar_or_clean_regeneration",
    };
  }

  const metadataXml = buildMetadataXml({
    id,
    owner: normalizeId(input.owner),
    createdAt: input.createdAt ?? new Date(0).toISOString(),
    format,
    sourceDigestSha256: sha256(zip),
  });

  let plan: ZipAppendPlan;
  let sealedBytes: Buffer;
  try {
    plan = planZipAppend(zip, parsed);
    sealedBytes = appendMetadataEntryPreservingOriginalZip(zip, plan, metadataEntryName, metadataXml);
  } catch (error) {
    return {
      ...base,
      ok: false,
      format,
      metadataEntryName,
      sidecarFallbackRequired: true,
      reason: `package_append_unsafe_use_sidecar:${error instanceof Error ? error.message : "unknown"}`,
    };
  }

  return {
    ...base,
    ok: true,
    sealedBytes,
    format,
    metadataEntryName,
    metadataInserted: true,
    priorTancMarkMetadataRemoved: false,
    sidecarFallbackRequired: false,
    appendMode: true,
    originalBytesPreservedPrefix: sealedBytes.subarray(0, zip.length).equals(zip),
    reason: "package_zip_tancmark_metadata_inserted_support_only",
  };
}

export function readPackageZip(
  packageBytes: Buffer | Uint8Array,
  expectedId?: string | null,
): PackageZipReadResult {
  const expected = normalizeId(expectedId);
  const base = {
    ...safetyEnvelope(),
    format: null,
    expectedId: expected,
    sourceDigestSha256: null,
    digestMatched: false,
    decisionRole: PACKAGE_ZIP_TANCMARK_DECISION_ROLE,
  };

  let parsed: ParsedZipEntry[];
  try {
    parsed = parsePackageZip(packageBytes);
  } catch {
    return {
      ...base,
      ok: false,
      foundTancMarkMetadata: false,
      metadataEntryNames: [],
      extractedId: null,
      extractedIds: [],
      idMatched: false,
      reason: "input_is_not_supported_zip_package",
    };
  }

  const format = detectPackageFormat(parsed);
  if (!format) {
    return {
      ...base,
      ok: false,
      foundTancMarkMetadata: false,
      metadataEntryNames: [],
      extractedId: null,
      extractedIds: [],
      idMatched: false,
      reason: "unsupported_package_format",
    };
  }

  const metadataEntries = parsed.filter((entry) => isTancMarkMetadataEntry(entry.name));
  const extractedIds = metadataEntries
    .map((entry) => extractTancMarkId(entry.data.toString("utf8")))
    .filter((id): id is string => Boolean(id));
  const sourceDigests = metadataEntries
    .map((entry) => extractTancMarkSourceDigest(entry.data.toString("utf8")))
    .filter((digest): digest is string => Boolean(digest));
  const extractedId = extractedIds[0] ?? null;
  const sourceDigestSha256 = sourceDigests[0] ?? null;
  const zip = Buffer.from(packageBytes);
  const digestMatched = metadataEntries.some((entry) => {
    const sourceDigest = extractTancMarkSourceDigest(entry.data.toString("utf8"));
    if (!sourceDigest) return false;
    const originalPrefix = zip.subarray(0, entry.localHeaderOffset);
    return sha256(originalPrefix) === sourceDigest;
  });
  if (extractedIds.length === 0) {
    return {
      ...base,
      ok: true,
      format,
      foundTancMarkMetadata: false,
      metadataEntryNames: metadataEntries.map((entry) => entry.name),
      extractedId: null,
      extractedIds,
      idMatched: false,
      sourceDigestSha256: null,
      digestMatched: false,
      reason: "no_tancmark_package_metadata_found",
    };
  }

  const idMatched = expected ? extractedIds.some((id) => id === expected) : false;
  return {
    ...base,
    ok: true,
    format,
    foundTancMarkMetadata: true,
    metadataEntryNames: metadataEntries.map((entry) => entry.name),
    extractedId,
    extractedIds,
    idMatched,
    sourceDigestSha256,
    digestMatched,
    reason: idMatched
      ? "exact_id_match_support_only_no_vault"
      : "metadata_found_but_exact_id_not_matched_no_vault",
  };
}
