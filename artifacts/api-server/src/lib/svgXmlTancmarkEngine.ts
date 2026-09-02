export const SVG_XML_TANCMARK_ENGINE_VERSION = "svg-xml-tancmark-engine-v0.1" as const;
export const SVG_XML_TANCMARK_NAMESPACE = "urn:tancmark:svg-xml:v1" as const;
export const SVG_XML_TANCMARK_DECISION_ROLE =
  "svg_xml_tancmark_engine_support_only_no_vault_no_confirmed" as const;

export interface SvgXmlSealInput {
  svgText: string;
  id: string;
  owner?: string | null;
  createdAt?: string | null;
}

export interface SvgXmlSafetyEnvelope {
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

export interface SvgXmlSealResult extends SvgXmlSafetyEnvelope {
  ok: boolean;
  sealedSvg: string | null;
  id: string | null;
  originalMutated: false;
  metadataInserted: boolean;
  priorTancMarkMetadataRemoved: boolean;
  decisionRole: typeof SVG_XML_TANCMARK_DECISION_ROLE;
  reason: string;
}

export interface SvgXmlReadResult extends SvgXmlSafetyEnvelope {
  ok: boolean;
  foundTancMarkMetadata: boolean;
  extractedId: string | null;
  extractedIds: string[];
  expectedId: string | null;
  idMatched: boolean;
  decisionRole: typeof SVG_XML_TANCMARK_DECISION_ROLE;
  reason: string;
}

function safetyEnvelope(): SvgXmlSafetyEnvelope {
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

function findSvgOpenTagEnd(svgText: string): number {
  const openMatch = /<svg\b/i.exec(svgText);
  if (!openMatch || typeof openMatch.index !== "number") return -1;

  let quote: '"' | "'" | null = null;
  for (let i = openMatch.index + openMatch[0].length; i < svgText.length; i += 1) {
    const char = svgText[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return i;
  }
  return -1;
}

export function isProbablySvgXml(svgText: string): boolean {
  if (typeof svgText !== "string") return false;
  let cursor = skipXmlWhitespace(svgText, 0);
  if (svgText.slice(cursor, cursor + 5).toLowerCase() === "<?xml") {
    const declarationEnd = svgText.indexOf("?>", cursor + 5);
    if (declarationEnd < 0) return false;
    cursor = skipXmlWhitespace(svgText, declarationEnd + 2);
  }
  while (svgText.startsWith("<!--", cursor)) {
    const commentEnd = svgText.indexOf("-->", cursor + 4);
    if (commentEnd < 0) return false;
    cursor = skipXmlWhitespace(svgText, commentEnd + 3);
  }
  if (svgText.slice(cursor, cursor + 4).toLowerCase() !== "<svg") return false;
  const rootBoundary = svgText[cursor + 4];
  if (rootBoundary !== ">" && rootBoundary !== undefined && !isXmlWhitespace(rootBoundary)) return false;
  if (!hasSvgCloseTag(svgText)) return false;
  return findSvgOpenTagEnd(svgText) >= 0;
}

function isXmlWhitespace(value: string): boolean {
  return value === " " || value === "\t" || value === "\r" || value === "\n";
}

function skipXmlWhitespace(value: string, start: number): number {
  let cursor = start;
  while (cursor < value.length && isXmlWhitespace(value[cursor] ?? "")) cursor += 1;
  return cursor;
}

function hasSvgCloseTag(svgText: string): boolean {
  const lower = svgText.toLowerCase();
  let cursor = 0;
  while (cursor < lower.length) {
    const start = lower.indexOf("</svg", cursor);
    if (start < 0) return false;
    const boundary = skipXmlWhitespace(lower, start + 5);
    if (lower[boundary] === ">") return true;
    cursor = start + 5;
  }
  return false;
}

function stripExistingTancMarkMetadata(svgText: string): { text: string; removed: boolean } {
  const pattern =
    /\s*<metadata\b(?=[^>]*\bdata-tancmark-engine\s*=\s*["']svg-xml-tancmark-engine-v0\.1["'])[^>]*>[\s\S]*?<\/metadata>\s*/gi;
  const text = svgText.replace(pattern, "");
  return { text, removed: text !== svgText };
}

export function neutralizeSvgNonMarkupRegions(svgText: string): string {
  return stripDelimitedRegions(stripDelimitedRegions(svgText, "<!--", "-->"), "<![CDATA[", "]]>");
}

function stripDelimitedRegions(value: string, opening: string, closing: string): string {
  let cursor = 0;
  let result = "";
  while (cursor < value.length) {
    const start = value.indexOf(opening, cursor);
    if (start < 0) return result + value.slice(cursor);
    result += value.slice(cursor, start);
    const end = value.indexOf(closing, start + opening.length);
    if (end < 0) return result;
    cursor = end + closing.length;
  }
  return result;
}

function buildMetadataBlock(input: {
  id: string;
  owner: string | null;
  createdAt: string;
}): string {
  const ownerAttribute = input.owner
    ? ` owner="${escapeXmlAttribute(input.owner)}"`
    : "";
  return [
    "",
    `  <metadata data-tancmark-engine="${SVG_XML_TANCMARK_ENGINE_VERSION}" data-tancmark-role="support_only_no_vault_no_confirmed">`,
    `    <tancmark:data xmlns:tancmark="${SVG_XML_TANCMARK_NAMESPACE}" version="1" id="${escapeXmlAttribute(
      input.id,
    )}"${ownerAttribute} createdAt="${escapeXmlAttribute(
      input.createdAt,
    )}" supportOnly="true" canOpenVault="false" confirmed="false" final="false" externalToolUsed="false" containerUsed="false" paidLicenseUsed="false" />`,
    "  </metadata>",
  ].join("\n");
}

export function sealSvgXml(input: SvgXmlSealInput): SvgXmlSealResult {
  const id = normalizeId(input.id);
  const base = {
    ...safetyEnvelope(),
    id,
    sealedSvg: null,
    originalMutated: false as const,
    metadataInserted: false,
    priorTancMarkMetadataRemoved: false,
    decisionRole: SVG_XML_TANCMARK_DECISION_ROLE,
  };

  if (!id || !isSupportedId(id)) {
    return { ...base, ok: false, reason: "invalid_or_missing_exact_id" };
  }
  if (!isProbablySvgXml(input.svgText)) {
    return { ...base, ok: false, reason: "input_is_not_supported_svg_xml" };
  }

  const stripped = stripExistingTancMarkMetadata(input.svgText);
  const openTagEnd = findSvgOpenTagEnd(stripped.text);
  if (openTagEnd < 0) {
    return { ...base, ok: false, reason: "svg_open_tag_not_found" };
  }

  const metadata = buildMetadataBlock({
    id,
    owner: normalizeId(input.owner),
    createdAt: input.createdAt ?? new Date(0).toISOString(),
  });
  const sealedSvg = `${stripped.text.slice(0, openTagEnd + 1)}${metadata}${stripped.text.slice(
    openTagEnd + 1,
  )}`;

  return {
    ...base,
    ok: true,
    sealedSvg,
    metadataInserted: true,
    priorTancMarkMetadataRemoved: stripped.removed,
    reason: "svg_xml_tancmark_metadata_inserted_support_only",
  };
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

function extractTancMarkIds(svgText: string): string[] {
  const ids: string[] = [];
  const pattern = /<tancmark:data\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(svgText))) {
    const attrs = parseAttributes(match[1] ?? "");
    const id = normalizeId(attrs.id);
    if (id) ids.push(id);
  }
  return ids;
}

export function readSvgXml(svgText: string, expectedId?: string | null): SvgXmlReadResult {
  const expected = normalizeId(expectedId);
  const base = {
    ...safetyEnvelope(),
    expectedId: expected,
    decisionRole: SVG_XML_TANCMARK_DECISION_ROLE,
  };

  if (!isProbablySvgXml(svgText)) {
    return {
      ...base,
      ok: false,
      foundTancMarkMetadata: false,
      extractedId: null,
      extractedIds: [],
      idMatched: false,
      reason: "input_is_not_supported_svg_xml",
    };
  }

  const extractedIds = extractTancMarkIds(neutralizeSvgNonMarkupRegions(svgText));
  const extractedId = extractedIds[0] ?? null;
  if (extractedIds.length === 0) {
    return {
      ...base,
      ok: true,
      foundTancMarkMetadata: false,
      extractedId: null,
      extractedIds,
      idMatched: false,
      reason: "no_tancmark_svg_xml_metadata_found",
    };
  }

  const idMatched = expected ? extractedIds.some((id) => id === expected) : false;
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
