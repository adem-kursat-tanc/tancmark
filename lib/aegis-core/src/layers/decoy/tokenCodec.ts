/**
 * AEGIS v4.1 Step 2 — Unicode Tag block (U+E0000-U+E007F) codec for
 * embedding base64 emission tokens into delivery text.
 *
 * Encoding strategy: emission_token is base64(HMAC-SHA256) → fixed 44 chars
 * (32-byte digest + 1 pad). Each ASCII byte (range 43-122 for base64 alpha)
 * maps to U+E0000 + asciiCode. Block terminator is U+E007F (CANCEL TAG, the
 * natural Unicode block sentinel — cannot collide with base64 alphabet).
 *
 * Block layout:
 *   [tagChar × 44] [U+E007F sentinel] = 45 codepoints
 *
 * Decoder accepts any contiguous run of tag chars (U+E0000..U+E007F) and
 * splits on the sentinel. Each block of EXACTLY 44 data chars decodes to
 * one candidate token. Malformed blocks (wrong length, non-base64-alpha
 * mapping, etc.) are silently dropped — they may be normalization residue
 * or attacker noise; analyze-text never trusts an undecodable block.
 */

export const TAG_BLOCK_START = 0xe0000;
export const TAG_BLOCK_END = 0xe007f;
export const TAG_SENTINEL = 0xe007f;
export const TAG_DATA_LENGTH = 44;
export const TAG_BLOCK_LENGTH = TAG_DATA_LENGTH + 1;

const BASE64_RE = /^[A-Za-z0-9+/]{43}=$/;

/**
 * Encode a base64 emission_token (44 chars) as a single tag block:
 * 44 data tag chars + 1 sentinel = 45 codepoints.
 */
export function encodeEmissionToken(token: string): string {
  if (token.length !== TAG_DATA_LENGTH) {
    throw new Error(
      `decoy.tokenCodec: token must be ${TAG_DATA_LENGTH} chars (got ${token.length})`,
    );
  }
  if (!BASE64_RE.test(token)) {
    throw new Error("decoy.tokenCodec: token is not base64 (32-byte digest)");
  }
  let out = "";
  for (let i = 0; i < token.length; i++) {
    const ascii = token.charCodeAt(i);
    out += String.fromCodePoint(TAG_BLOCK_START + ascii);
  }
  out += String.fromCodePoint(TAG_SENTINEL);
  return out;
}

/** True if codepoint is in the Tag block range. */
export function isTagCodepoint(cp: number): boolean {
  return cp >= TAG_BLOCK_START && cp <= TAG_BLOCK_END;
}

/**
 * Strip every tag-block codepoint from a string. Used by analyze-text /
 * `Decoy_Stripped` detection to reproduce what an attacker's normalizer
 * would leave behind.
 */
export function stripTagCodepoints(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (!isTagCodepoint(cp)) out += ch;
  }
  return out;
}

/**
 * Scan a string and return every decoded emission token candidate found.
 * Result is de-duplicated in insertion order; the same token repeated
 * across multiple blocks counts once. `multipleEmissions` upstream is
 * computed from `tokens.length > 1`.
 */
export interface DecodeScanResult {
  tokens: string[];
  /** Total tag-block codepoints observed (data + sentinels). */
  tagCodepointCount: number;
  /** Blocks that didn't decode cleanly (wrong length, bad alphabet). */
  malformedBlocks: number;
}

export function scanForEmissionTokens(text: string): DecodeScanResult {
  const tokens: string[] = [];
  const seen = new Set<string>();
  let tagCodepointCount = 0;
  let malformedBlocks = 0;
  let buffer: number[] = [];
  let inRun = false;

  function flushBlock(): void {
    if (buffer.length === 0) return;
    if (buffer.length !== TAG_DATA_LENGTH) {
      malformedBlocks++;
      buffer = [];
      return;
    }
    let candidate = "";
    let ok = true;
    for (const cp of buffer) {
      const ascii = cp - TAG_BLOCK_START;
      if (ascii < 0 || ascii > 0x7f) {
        ok = false;
        break;
      }
      candidate += String.fromCharCode(ascii);
    }
    buffer = [];
    if (!ok || !BASE64_RE.test(candidate)) {
      malformedBlocks++;
      return;
    }
    if (!seen.has(candidate)) {
      seen.add(candidate);
      tokens.push(candidate);
    }
  }

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= TAG_BLOCK_START && cp <= TAG_BLOCK_END) {
      tagCodepointCount++;
      inRun = true;
      if (cp === TAG_SENTINEL) {
        flushBlock();
      } else {
        buffer.push(cp);
        // Defensive: cap block buffer at 2× expected to avoid runaway.
        if (buffer.length > TAG_DATA_LENGTH * 2) {
          malformedBlocks++;
          buffer = [];
        }
      }
    } else {
      // Non-tag char ends any in-flight (sentinel-less) block as malformed.
      if (inRun && buffer.length > 0) {
        malformedBlocks++;
        buffer = [];
      }
      inRun = false;
    }
  }
  // EOF flush — trailing data without sentinel = malformed.
  if (buffer.length > 0) malformedBlocks++;

  return { tokens, tagCodepointCount, malformedBlocks };
}
