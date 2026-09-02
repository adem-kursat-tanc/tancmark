import { createHash } from "node:crypto";

export const SIDECAR_TANCMARK_ENGINE_VERSION = "sidecar-tancmark-engine-v0.1" as const;
export const SIDECAR_TANCMARK_DECISION_ROLE =
  "sidecar_tancmark_engine_support_only_no_vault_no_confirmed" as const;

export type SidecarTancMarkFormat =
  | "heic"
  | "heif"
  | "raw"
  | "cr2"
  | "nef"
  | "dng"
  | "arw"
  | "rw2"
  | "orf"
  | "raf"
  | "pef"
  | "srw"
  | "psd"
  | "psb"
  | "cdr"
  | "indd"
  | "epub"
  | "pptx"
  | "xlsx"
  | "ts"
  | "flv"
  | "mxf"
  | "prores"
  | "ogg"
  | "opus"
  | "wma"
  | "aiff";

export interface SidecarSealInput {
  originalBytes: Buffer | Uint8Array;
  id: string;
  format: SidecarTancMarkFormat;
  fileName?: string | null;
  owner?: string | null;
  createdAt?: string | null;
}

export interface SidecarSafetyEnvelope {
  engineInsideTancMark: true;
  originalFileModified: false;
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

export interface SidecarSealResult extends SidecarSafetyEnvelope {
  ok: boolean;
  sidecarJson: string | null;
  id: string | null;
  format: SidecarTancMarkFormat | null;
  sourceDigestSha256: string | null;
  decisionRole: typeof SIDECAR_TANCMARK_DECISION_ROLE;
  reason: string;
}

export interface SidecarReadResult extends SidecarSafetyEnvelope {
  ok: boolean;
  foundTancMarkSidecar: boolean;
  expectedId: string | null;
  extractedId: string | null;
  idMatched: boolean;
  digestMatched: boolean;
  format: SidecarTancMarkFormat | null;
  sourceDigestSha256: string | null;
  decisionRole: typeof SIDECAR_TANCMARK_DECISION_ROLE;
  reason: string;
}

const SUPPORTED_FORMATS: ReadonlySet<string> = new Set<SidecarTancMarkFormat>([
  "heic",
  "heif",
  "raw",
  "cr2",
  "nef",
  "dng",
  "arw",
  "rw2",
  "orf",
  "raf",
  "pef",
  "srw",
  "psd",
  "psb",
  "cdr",
  "indd",
  "epub",
  "pptx",
  "xlsx",
  "ts",
  "flv",
  "mxf",
  "prores",
  "ogg",
  "opus",
  "wma",
  "aiff",
]);

function safetyEnvelope(): SidecarSafetyEnvelope {
  return {
    engineInsideTancMark: true,
    originalFileModified: false,
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

function isSupportedId(id: string): boolean {
  return /^[A-Za-z0-9._:-]{4,128}$/.test(id);
}

function normalizeFormat(format: string | null | undefined): SidecarTancMarkFormat | null {
  if (typeof format !== "string") return null;
  const normalized = format.trim().toLowerCase();
  return SUPPORTED_FORMATS.has(normalized) ? (normalized as SidecarTancMarkFormat) : null;
}

function digestSha256(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function sanitizeFileName(fileName: string | null | undefined): string | null {
  if (typeof fileName !== "string") return null;
  const normalized = fileName.split(/[\\/]/).pop()?.trim() ?? "";
  if (!normalized || normalized.includes("\0")) return null;
  return normalized.slice(0, 240);
}

function parseSidecar(sidecarJson: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(sidecarJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createTancMarkSidecar(input: SidecarSealInput): SidecarSealResult {
  const id = normalizeId(input.id);
  const format = normalizeFormat(input.format);
  const base = {
    ...safetyEnvelope(),
    sidecarJson: null,
    id,
    format,
    sourceDigestSha256: null,
    decisionRole: SIDECAR_TANCMARK_DECISION_ROLE,
  };

  if (!id || !isSupportedId(id)) {
    return { ...base, ok: false, reason: "invalid_or_missing_exact_id" };
  }
  if (!format) {
    return { ...base, ok: false, reason: "unsupported_sidecar_format" };
  }
  if (input.originalBytes.byteLength === 0) {
    return { ...base, ok: false, reason: "empty_original_file" };
  }

  const sourceDigestSha256 = digestSha256(input.originalBytes);
  const sidecar = {
    tancmarkSidecarVersion: 1,
    engine: SIDECAR_TANCMARK_ENGINE_VERSION,
    decisionRole: SIDECAR_TANCMARK_DECISION_ROLE,
    id,
    format,
    fileName: sanitizeFileName(input.fileName),
    owner: normalizeId(input.owner),
    createdAt: input.createdAt ?? new Date(0).toISOString(),
    sourceDigestSha256,
    sourceDigestAlgorithm: "sha256",
    engineInsideTancMark: true,
    originalFileModified: false,
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
  };

  return {
    ...base,
    ok: true,
    sidecarJson: `${JSON.stringify(sidecar, null, 2)}\n`,
    sourceDigestSha256,
    reason: "tancmark_sidecar_created_support_only",
  };
}

export function verifyTancMarkSidecar(
  originalBytes: Buffer | Uint8Array,
  sidecarJson: string | null | undefined,
  expectedId?: string | null,
): SidecarReadResult {
  const expected = normalizeId(expectedId);
  const base = {
    ...safetyEnvelope(),
    expectedId: expected,
    extractedId: null,
    format: null,
    sourceDigestSha256: null,
    decisionRole: SIDECAR_TANCMARK_DECISION_ROLE,
  };

  if (typeof sidecarJson !== "string" || sidecarJson.trim().length === 0) {
    return {
      ...base,
      ok: true,
      foundTancMarkSidecar: false,
      idMatched: false,
      digestMatched: false,
      reason: "no_tancmark_sidecar_found",
    };
  }

  const parsed = parseSidecar(sidecarJson);
  if (!parsed) {
    return {
      ...base,
      ok: false,
      foundTancMarkSidecar: false,
      idMatched: false,
      digestMatched: false,
      reason: "sidecar_json_invalid",
    };
  }

  const extractedId = normalizeId(
    typeof parsed.id === "string" ? parsed.id : null,
  );
  const format = normalizeFormat(typeof parsed.format === "string" ? parsed.format : null);
  const sourceDigestSha256 =
    typeof parsed.sourceDigestSha256 === "string" ? parsed.sourceDigestSha256 : null;
  const digestMatched =
    typeof sourceDigestSha256 === "string" && sourceDigestSha256 === digestSha256(originalBytes);
  const idMatched = Boolean(expected && extractedId && extractedId === expected);

  return {
    ...base,
    ok: true,
    foundTancMarkSidecar: true,
    extractedId,
    format,
    sourceDigestSha256,
    idMatched,
    digestMatched,
    reason:
      idMatched && digestMatched
        ? "exact_id_and_digest_match_support_only_no_vault"
        : "sidecar_found_but_exact_id_or_digest_not_matched_no_vault",
  };
}
