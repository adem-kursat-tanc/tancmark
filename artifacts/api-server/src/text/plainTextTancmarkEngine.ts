export const PLAIN_TEXT_TANCMARK_ENGINE_VERSION = "plain-text-tancmark-engine-v0.1" as const;

const FRAME_START = "\u2060\u2063\u2060";
const FRAME_END = "\u2060\u2064\u2060";
const BIT_ZERO = "\u200b";
const BIT_ONE = "\u200c";
const ID_HEX_RE = /^[a-f0-9]{32}$/i;
const DEFAULT_FRAME_COUNT = 3;
const ID_BITS = 128;

export type PlainTextTancmarkSafety = {
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canChangePreSeal: false;
  storesFileName: false;
  storesFilePath: false;
  storesFileContent: false;
  storesHashOrFingerprint: false;
};

export type PlainTextSealResult = {
  ok: true;
  status: "txt_exact_id_embedded_support_only";
  engineVersion: typeof PLAIN_TEXT_TANCMARK_ENGINE_VERSION;
  sealedText: string;
  sealStats: {
    independentFrames: number;
    encodedBitsPerFrame: typeof ID_BITS;
    visibleIdStored: false;
    originalLength: number;
    sealedLength: number;
  };
  safety: PlainTextTancmarkSafety;
};

export type PlainTextReadStatus =
  | "txt_exact_id_found_support_only"
  | "txt_wrong_id_rejected_no_vault"
  | "txt_no_id_no_vault";

export type PlainTextReadResult = {
  ok: true;
  status: PlainTextReadStatus;
  engineVersion: typeof PLAIN_TEXT_TANCMARK_ENGINE_VERSION;
  exactIdFound: boolean;
  wrongIdRejected: boolean;
  noIdCannotOpenVault: boolean;
  candidateIdPresent: boolean;
  gotIdHexRedacted: boolean;
  matchingBits: number;
  matchingBitsMax: typeof ID_BITS;
  matchPercent: number;
  safety: PlainTextTancmarkSafety;
};

export type PlainTextErrorResult = {
  ok: false;
  status: "txt_invalid_input";
  reason: "text_required" | "id_hex_32_required" | "frame_count_invalid";
  engineVersion: typeof PLAIN_TEXT_TANCMARK_ENGINE_VERSION;
  safety: PlainTextTancmarkSafety;
};

export type PlainTextTancmarkResult =
  | PlainTextSealResult
  | PlainTextReadResult
  | PlainTextErrorResult;

export function plainTextTancmarkSafety(): PlainTextTancmarkSafety {
  return {
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    canChangePreSeal: false,
    storesFileName: false,
    storesFilePath: false,
    storesFileContent: false,
    storesHashOrFingerprint: false,
  };
}

function fail(reason: PlainTextErrorResult["reason"]): PlainTextErrorResult {
  return {
    ok: false,
    status: "txt_invalid_input",
    reason,
    engineVersion: PLAIN_TEXT_TANCMARK_ENGINE_VERSION,
    safety: plainTextTancmarkSafety(),
  };
}

function normalizeIdHex(idHex: string): string | null {
  const normalized = idHex.trim().toLowerCase();
  return ID_HEX_RE.test(normalized) ? normalized : null;
}

function hexToBits(idHex: string): string {
  return Array.from(idHex)
    .map((char) => Number.parseInt(char, 16).toString(2).padStart(4, "0"))
    .join("");
}

function bitsToFrame(bits: string): string {
  return FRAME_START + Array.from(bits).map((bit) => (bit === "1" ? BIT_ONE : BIT_ZERO)).join("") + FRAME_END;
}

function frameToBits(framePayload: string): string {
  let bits = "";
  for (const char of framePayload) {
    if (char === BIT_ZERO) bits += "0";
    if (char === BIT_ONE) bits += "1";
  }
  return bits;
}

function bitsToHex(bits: string): string | null {
  if (bits.length < ID_BITS) return null;
  const trimmed = bits.slice(0, ID_BITS);
  let hex = "";
  for (let index = 0; index < trimmed.length; index += 4) {
    const nibble = trimmed.slice(index, index + 4);
    if (!/^[01]{4}$/.test(nibble)) return null;
    hex += Number.parseInt(nibble, 2).toString(16);
  }
  return hex;
}

function splitForFrames(text: string, frame: string, frameCount: number): string {
  const lines = text.split(/\r?\n/);
  if (frameCount === 1 || lines.length <= 1) return `${frame}${text}`;

  const firstCut = Math.max(1, Math.floor(lines.length / 2));
  const parts = [frame, ...lines.slice(0, firstCut), frame, ...lines.slice(firstCut)];
  while (parts.filter((part) => part === frame).length < frameCount) {
    parts.push(frame);
  }
  return parts.join("\n");
}

function extractIds(text: string): string[] {
  const ids: string[] = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const start = text.indexOf(FRAME_START, searchFrom);
    if (start < 0) break;
    const payloadStart = start + FRAME_START.length;
    const end = text.indexOf(FRAME_END, payloadStart);
    if (end < 0) break;
    const idHex = bitsToHex(frameToBits(text.slice(payloadStart, end)));
    if (idHex) ids.push(idHex);
    searchFrom = end + FRAME_END.length;
  }
  return ids;
}

function matchingBits(candidateIdHex: string | null, expectedIdHex: string): number {
  if (!candidateIdHex) return 0;
  const candidateBits = hexToBits(candidateIdHex);
  const expectedBits = hexToBits(expectedIdHex);
  let matched = 0;
  for (let index = 0; index < ID_BITS; index += 1) {
    if (candidateBits[index] === expectedBits[index]) matched += 1;
  }
  return matched;
}

export function sealPlainTextTancmark(input: {
  text: string;
  idHex: string;
  independentFrames?: number;
}): PlainTextSealResult | PlainTextErrorResult {
  if (typeof input.text !== "string" || input.text.length === 0) return fail("text_required");
  const idHex = normalizeIdHex(input.idHex);
  if (!idHex) return fail("id_hex_32_required");

  const frameCount = input.independentFrames ?? DEFAULT_FRAME_COUNT;
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 5) return fail("frame_count_invalid");

  const frame = bitsToFrame(hexToBits(idHex));
  const sealedText = splitForFrames(input.text, frame, frameCount);
  return {
    ok: true,
    status: "txt_exact_id_embedded_support_only",
    engineVersion: PLAIN_TEXT_TANCMARK_ENGINE_VERSION,
    sealedText,
    sealStats: {
      independentFrames: frameCount,
      encodedBitsPerFrame: ID_BITS,
      visibleIdStored: false,
      originalLength: input.text.length,
      sealedLength: sealedText.length,
    },
    safety: plainTextTancmarkSafety(),
  };
}

export function readPlainTextTancmark(input: {
  text: string;
  expectedIdHex: string;
}): PlainTextReadResult | PlainTextErrorResult {
  if (typeof input.text !== "string" || input.text.length === 0) return fail("text_required");
  const expectedIdHex = normalizeIdHex(input.expectedIdHex);
  if (!expectedIdHex) return fail("id_hex_32_required");

  const ids = extractIds(input.text);
  let best: string | null = null;
  let bestBits = 0;
  for (const candidate of ids) {
    const score = matchingBits(candidate, expectedIdHex);
    if (score > bestBits) {
      best = candidate;
      bestBits = score;
    }
  }

  const exactIdFound = best === expectedIdHex;
  const candidateIdPresent = best !== null;
  const status: PlainTextReadStatus = exactIdFound
    ? "txt_exact_id_found_support_only"
    : candidateIdPresent
      ? "txt_wrong_id_rejected_no_vault"
      : "txt_no_id_no_vault";

  return {
    ok: true,
    status,
    engineVersion: PLAIN_TEXT_TANCMARK_ENGINE_VERSION,
    exactIdFound,
    wrongIdRejected: candidateIdPresent && !exactIdFound,
    noIdCannotOpenVault: !candidateIdPresent,
    candidateIdPresent,
    gotIdHexRedacted: candidateIdPresent,
    matchingBits: bestBits,
    matchingBitsMax: ID_BITS,
    matchPercent: Math.round((bestBits / ID_BITS) * 1000) / 10,
    safety: plainTextTancmarkSafety(),
  };
}
