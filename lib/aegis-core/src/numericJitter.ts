/**
 * Numeric jitter — autonomous adaptive trap layer.
 *
 * Locates standalone numeric tokens inside text and applies a tiny,
 * deterministic perturbation to the last digit (no carry, length
 * preserved) using `HMAC(secret, clientId | original | occurrence)`.
 *
 * Properties:
 *  - **Deterministic per (secret, clientId, original)**: the same input
 *    always produces the same jittered output, so any later sighting of
 *    the jittered value can be attributed to a single client.
 *  - **Length-preserving**: only the last digit is shifted modulo 10, so
 *    the visual footprint of the document is unchanged for a casual reader
 *    (this is *not* meant to fool a forensic re-read of the original; it
 *    is meant to invisibly tag exfiltrated copies).
 *  - **Conservative**: skips very short (<2 digits) and very long (>9
 *    digits) runs so we don't break IDs, ISBNs, phone numbers, etc.
 *  - **Idempotent**: running this against an already-jittered text
 *    re-applies the SAME shift (because the formula keys off the *new*
 *    last digit too is risky, so we key off the *full* number — once
 *    rewritten, re-running produces a fixed point only when shift==0,
 *    which we exclude). To make it strictly idempotent we mark each
 *    output token's `originalValueHash` so the caller can deduplicate.
 *
 * The companion `scanForHoneytokens()` in `honeytokenGenerator.ts` is
 * sufficient to *detect* jittered values (substring match), since each
 * jittered value is persisted alongside the regular honeytokens.
 */

import { createHmac } from "node:crypto";
import type { HoneytokenRecord } from "./honeytokenGenerator.js";

export interface JitterOptions {
  secret: string;
  clientId: string;
  /** Hard cap on how many numbers to jitter. Default 6. */
  maxJitters?: number;
  /** Approximate fraction of eligible numbers to jitter. Default 0.5. */
  density?: number;
  /**
   * Half-open `[start, end)` byte ranges in `text` that the jitter pass
   * MUST NOT touch (e.g. spans occupied by previously-injected pattern
   * honeytokens). Any number whose match overlaps an excluded range is
   * skipped, preventing jitter from corrupting another layer's fake
   * value (which would later break leak detection).
   */
  excludedRanges?: ReadonlyArray<readonly [number, number]>;
}

export interface JitterResult {
  text: string;
  /** Each jitter is recorded as a HoneytokenRecord with kind="jitter". */
  tokens: HoneytokenRecord[];
}

interface NumberMatch {
  start: number;
  end: number;
  raw: string; // matched digit run (no leading separators)
  prefix: string; // optional leading +/- (we keep sign untouched)
}

const NUMBER_RE = /(?<![\w.])([+-]?)(\d{5,9})(?![\w])/g;

function hmac(secret: string, ...parts: ReadonlyArray<string>): Buffer {
  return createHmac("sha256", secret).update(parts.join("\u0000")).digest();
}

function hmacHex(secret: string, ...parts: ReadonlyArray<string>): string {
  return createHmac("sha256", secret).update(parts.join("\u0000")).digest("hex");
}

/**
 * Deterministic delta in {-3,-2,-1,+1,+2,+3} for a given (clientId, raw).
 * Excludes 0 so jitter is always observable.
 */
export function jitterDelta(secret: string, clientId: string, raw: string): number {
  const h = hmac(secret, clientId, "jitter", raw);
  const choices = [-3, -2, -1, 1, 2, 3];
  return choices[h[0]! % choices.length]!;
}

/**
 * Apply the jitter formula to a single numeric token. Public for tests
 * and for the analyze-text fast path (so a detector can re-derive the
 * jittered form from a hypothesized original without DB lookup).
 */
export function jitterNumber(
  raw: string,
  secret: string,
  clientId: string,
): string {
  if (!/^\d{5,9}$/.test(raw)) return raw;
  const delta = jitterDelta(secret, clientId, raw);
  const last = Number(raw[raw.length - 1]!);
  const newLast = ((last + delta) % 10 + 10) % 10;
  return raw.slice(0, -1) + String(newLast);
}

export function applyNumericJitter(
  text: string,
  opts: JitterOptions,
): JitterResult {
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("applyNumericJitter: secret must be at least 8 characters");
  }
  if (!opts.clientId) {
    throw new Error("applyNumericJitter: clientId is required");
  }
  const maxJitters = Math.max(1, Math.floor(opts.maxJitters ?? 6));
  const density = Math.min(1, Math.max(0.05, opts.density ?? 0.5));

  const excluded = (opts.excludedRanges ?? []).slice();
  const overlapsExcluded = (s: number, e: number): boolean => {
    for (const [xs, xe] of excluded) {
      if (s < xe && xs < e) return true;
    }
    return false;
  };

  const matches: NumberMatch[] = [];
  const re = new RegExp(NUMBER_RE.source, NUMBER_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    const prefix = m[1] ?? "";
    const raw = m[2] ?? "";
    if (raw.length < 2 || raw.length > 9) continue;
    const start = m.index + prefix.length;
    const end = start + raw.length;
    if (overlapsExcluded(start, end)) continue;
    matches.push({ start, end, raw, prefix });
  }
  if (matches.length === 0) return { text, tokens: [] };

  // Deterministic selection: rank matches by HMAC and take the top
  // `round(eligible * density)` (capped by maxJitters).
  const ranked = matches
    .map((mt, i) => ({ mt, i, score: hmac(opts.secret, opts.clientId, "select-jitter", String(i), mt.raw)[0]! / 255 }))
    .sort((a, b) => a.score - b.score);
  const targetCount = Math.min(
    maxJitters,
    Math.max(1, Math.round(ranked.length * density)),
  );
  const chosen = new Set(ranked.slice(0, targetCount).map((e) => e.i));

  // Apply replacements end → start so earlier indices stay valid.
  let out = text;
  const replacements: Array<{ raw: string; jittered: string; hash: string; start: number }> = [];
  for (let i = matches.length - 1; i >= 0; i--) {
    if (!chosen.has(i)) continue;
    const mt = matches[i]!;
    const jittered = jitterNumber(mt.raw, opts.secret, opts.clientId);
    if (jittered === mt.raw) continue; // delta excluded 0, but be safe
    out = out.slice(0, mt.start) + jittered + out.slice(mt.end);
    const hash = hmacHex(opts.secret, "orig-jitter", opts.clientId, mt.raw).slice(0, 64);
    replacements.unshift({ raw: mt.raw, jittered, hash, start: mt.start });
  }

  // Rebuild the token list with positions resolved against `out`.
  const tokens: HoneytokenRecord[] = [];
  let scanFrom = 0;
  for (const r of replacements) {
    const pos = out.indexOf(r.jittered, scanFrom);
    tokens.push({
      kind: "jitter",
      fakeValue: r.jittered,
      originalValueHash: r.hash,
      position: pos >= 0 ? pos : -1,
    });
    if (pos >= 0) scanFrom = pos + r.jittered.length;
  }

  return { text: out, tokens };
}
