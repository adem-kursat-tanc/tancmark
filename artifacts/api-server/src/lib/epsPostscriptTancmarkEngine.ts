export const EPS_POSTSCRIPT_TANCMARK_ENGINE_VERSION =
  "eps-postscript-tancmark-engine-v0.1" as const;
export const EPS_POSTSCRIPT_TANCMARK_DECISION_ROLE =
  "eps_postscript_tancmark_engine_support_only_no_vault_no_confirmed" as const;

export interface EpsPostscriptSealInput {
  text: string;
  id: string;
  owner?: string | null;
  createdAt?: string | null;
}

export interface EpsPostscriptSafetyEnvelope {
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

export interface EpsPostscriptSealResult extends EpsPostscriptSafetyEnvelope {
  ok: boolean;
  sealedText: string | null;
  id: string | null;
  originalMutated: false;
  metadataInserted: boolean;
  priorTancMarkMetadataRemoved: boolean;
  decisionRole: typeof EPS_POSTSCRIPT_TANCMARK_DECISION_ROLE;
  reason: string;
}

export interface EpsPostscriptReadResult extends EpsPostscriptSafetyEnvelope {
  ok: boolean;
  foundTancMarkMetadata: boolean;
  extractedId: string | null;
  extractedIds: string[];
  expectedId: string | null;
  idMatched: boolean;
  decisionRole: typeof EPS_POSTSCRIPT_TANCMARK_DECISION_ROLE;
  reason: string;
}

function safetyEnvelope(): EpsPostscriptSafetyEnvelope {
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

function isSupportedId(id: string): boolean {
  return /^[A-Za-z0-9._:-]{4,128}$/.test(id);
}

function sanitizeCommentValue(value: string | null | undefined): string | null {
  const normalized = normalizeId(value);
  if (!normalized) return null;
  return normalized.replace(/[\r\n%]/g, "_").slice(0, 240);
}

export function isProbablyEpsPostscript(text: string): boolean {
  if (typeof text !== "string") return false;
  return /^\s*%!PS(?:-Adobe-\d+\.\d+)?/i.test(text) || /%%BoundingBox:/i.test(text);
}

function stripExistingTancMarkBlock(text: string): { text: string; removed: boolean } {
  const pattern =
    /\r?\n?%%BeginTancMark: eps-postscript-tancmark-engine-v0\.1[\s\S]*?%%EndTancMark\r?\n?/gi;
  const stripped = text.replace(pattern, "\n");
  return { text: stripped, removed: stripped !== text };
}

export function extractEpsTancMarkIds(text: string): string[] {
  const ids: string[] = [];
  const pattern = /^%%TancMark-ID:\s*(.+?)\s*$/gim;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const id = normalizeId(match[1]);
    if (id) ids.push(id);
  }
  return ids;
}

function buildBlock(input: { id: string; owner: string | null; createdAt: string }): string {
  const ownerLine = input.owner ? `%%TancMark-Owner: ${input.owner}\n` : "";
  return [
    `%%BeginTancMark: ${EPS_POSTSCRIPT_TANCMARK_ENGINE_VERSION}`,
    `%%TancMark-ID: ${input.id}`,
    ownerLine.trimEnd(),
    `%%TancMark-CreatedAt: ${input.createdAt}`,
    "%%TancMark-Role: support_only_no_vault_no_confirmed",
    "%%TancMark-CanOpenVault: false",
    "%%TancMark-Confirmed: false",
    "%%TancMark-Final: false",
    "%%TancMark-ExternalToolUsed: false",
    "%%TancMark-ContainerUsed: false",
    "%%EndTancMark",
  ]
    .filter(Boolean)
    .join("\n");
}

export function sealEpsPostscript(input: EpsPostscriptSealInput): EpsPostscriptSealResult {
  const id = normalizeId(input.id);
  const base = {
    ...safetyEnvelope(),
    sealedText: null,
    id,
    originalMutated: false as const,
    metadataInserted: false,
    priorTancMarkMetadataRemoved: false,
    decisionRole: EPS_POSTSCRIPT_TANCMARK_DECISION_ROLE,
  };

  if (!id || !isSupportedId(id)) {
    return { ...base, ok: false, reason: "invalid_or_missing_exact_id" };
  }
  if (!isProbablyEpsPostscript(input.text)) {
    return { ...base, ok: false, reason: "input_is_not_supported_eps_postscript" };
  }

  const stripped = stripExistingTancMarkBlock(input.text);
  const lines = stripped.text.split(/\r?\n/);
  const insertAt = lines.findIndex((line, index) => index > 0 && /^%%EndComments\b/i.test(line));
  const block = buildBlock({
    id: sanitizeCommentValue(id) ?? id,
    owner: sanitizeCommentValue(input.owner),
    createdAt: sanitizeCommentValue(input.createdAt) ?? new Date(0).toISOString(),
  });

  if (insertAt >= 0) {
    lines.splice(insertAt, 0, block);
  } else {
    lines.splice(1, 0, block);
  }

  return {
    ...base,
    ok: true,
    sealedText: lines.join("\n"),
    metadataInserted: true,
    priorTancMarkMetadataRemoved: stripped.removed,
    reason: "eps_postscript_tancmark_comment_inserted_support_only",
  };
}

export function readEpsPostscript(text: string, expectedId?: string | null): EpsPostscriptReadResult {
  const expected = normalizeId(expectedId);
  const base = {
    ...safetyEnvelope(),
    expectedId: expected,
    decisionRole: EPS_POSTSCRIPT_TANCMARK_DECISION_ROLE,
  };

  if (!isProbablyEpsPostscript(text)) {
    return {
      ...base,
      ok: false,
      foundTancMarkMetadata: false,
      extractedId: null,
      extractedIds: [],
      idMatched: false,
      reason: "input_is_not_supported_eps_postscript",
    };
  }

  const extractedIds = extractEpsTancMarkIds(text);
  const extractedId = extractedIds[0] ?? null;
  if (!extractedId) {
    return {
      ...base,
      ok: true,
      foundTancMarkMetadata: false,
      extractedId: null,
      extractedIds,
      idMatched: false,
      reason: "no_tancmark_eps_postscript_metadata_found",
    };
  }

  const idMatched = Boolean(expected && extractedIds.some((id) => id === expected));
  return {
    ...base,
    ok: true,
    foundTancMarkMetadata: true,
    extractedId,
    extractedIds,
    idMatched,
    reason: idMatched
      ? "exact_id_match_support_only_no_vault"
      : "metadata_found_but_exact_id_not_matched_no_vault",
  };
}
