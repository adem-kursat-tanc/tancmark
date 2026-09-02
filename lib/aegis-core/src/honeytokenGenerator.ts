/**
 * Honeytoken generator. Replaces selected "fact" patterns inside a piece of
 * text with deterministic-but-fake values so any later sighting of those
 * fake values in the wild proves exfiltration. Generation is HMAC-derived
 * from `(secret, clientId, original, kind, occurrence)` so re-running
 * against the same inputs produces the same fakes (idempotent).
 */

import { createHmac } from "node:crypto";

export type HoneytokenKind =
  | "email"
  | "phone"
  | "amount"
  | "percent"
  | "date"
  | "org"
  | "jitter";

/**
 * Compute an adaptive injection density from text length and bot score.
 *
 *  - Higher bot score → denser trapping (we're confident it's a scraper).
 *  - Shorter text → denser trapping (fewer eligible matches available).
 *  - Long marketing copy gets a lighter touch so the watermark layers
 *    still drive the bulk of the per-character signal.
 *
 * Returns a value in [0.2, 1.0]; pass directly as `density` to
 * `injectHoneytokens()` / `applyNumericJitter()`.
 */
export function computeAdaptiveDensity(
  textLength: number,
  botScore: number,
): number {
  const score = Math.max(0, Math.min(1, Number.isFinite(botScore) ? botScore : 0));
  const base = 0.3 + 0.6 * score;
  // Short text has fewer eligible matches → trap as densely as possible.
  // Long marketing copy gets a lighter touch so the watermark layers
  // still drive the bulk of the per-character signal.
  const lengthFactor =
    textLength < 100
      ? 1.0
      : textLength < 400
        ? 0.9
        : textLength < 1200
          ? 0.75
          : 0.6;
  return Math.max(0.2, Math.min(1.0, base * lengthFactor));
}

export interface HoneytokenRecord {
  kind: HoneytokenKind;
  /** The fake value substituted into the text. */
  fakeValue: string;
  /** SHA-256 hex of the original value (we never store the plaintext). */
  originalValueHash: string;
  /** Position in the *output* text where the fake value was inserted. */
  position: number;
}

export interface HoneytokenInjectResult {
  text: string;
  tokens: HoneytokenRecord[];
}

export interface HoneytokenInjectOptions {
  secret: string;
  clientId: string;
  /** Hard cap on how many honeytokens to inject. Default 6. */
  maxTokens?: number;
  /** Approximate fraction of eligible matches to convert. Default 0.5. */
  density?: number;
}

interface PatternDef {
  kind: HoneytokenKind;
  re: RegExp;
}

// All regexes are anchored on word/whitespace boundaries and use the
// global flag so we can iterate matches with `matchAll`.
const PATTERNS: ReadonlyArray<PatternDef> = [
  {
    kind: "email",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    kind: "phone",
    // Turkish mobile patterns (with or without +90 / leading 0).
    re: /(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
  },
  {
    kind: "amount",
    // 1.234,56 TL  /  $12,345  /  9.999,00 ₺  /  4500 USD
    re: /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\s?(?:TL|₺|USD|EUR)?\b/g,
  },
  {
    kind: "percent",
    re: /\b\d{1,3}(?:[.,]\d+)?\s?%/g,
  },
  {
    kind: "date",
    re: /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g,
  },
  {
    kind: "org",
    // "Foo Bar Holding" / "Acme A.Ş." / "Globex Ltd."
    re: /\b(?:[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü]{2,})(?:\s[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü]{2,}){0,2}\s(?:Ltd\.?|A\.?Ş\.?|Inc\.?|Corp\.?|GmbH|Holding)/g,
  },
];

const FAKE_ORG_NAMES: ReadonlyArray<string> = [
  "Aegis Sentinel",
  "Lumen Pinnacle",
  "Nyx Citadel",
  "Helix Vector",
  "Polaris Drift",
  "Arcadia Quanta",
  "Veridian Forge",
];

function hmac(secret: string, ...parts: ReadonlyArray<string>): Buffer {
  return createHmac("sha256", secret).update(parts.join("\u0000")).digest();
}

function hmacHex(secret: string, ...parts: ReadonlyArray<string>): string {
  return createHmac("sha256", secret).update(parts.join("\u0000")).digest("hex");
}

function fakeFor(
  kind: HoneytokenKind,
  secret: string,
  clientId: string,
  original: string,
  occurrence: number,
): string {
  const seed = `${clientId}|${kind}|${original}|${occurrence}`;
  const h = hmac(secret, seed);
  switch (kind) {
    case "email": {
      const slug = h.toString("hex").slice(0, 10);
      return `aegis.trap.${slug}@aegis-honeypot.invalid`;
    }
    case "phone": {
      const digits = Array.from(h.subarray(0, 9))
        .map((b) => (b % 10).toString())
        .join("");
      // Pin to the legitimate-looking TR mobile prefix "5" then 9 digits.
      return `+90 5${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
    }
    case "amount": {
      const n = (h.readUInt32BE(0) % 9000) + 1000; // 1000..9999
      const cents = h[4]! % 100;
      return `${n.toLocaleString("tr-TR")},${cents.toString().padStart(2, "0")} TL`;
    }
    case "percent": {
      const p = (h[0]! % 80) + 10; // 10..89
      const dec = (h[1]! % 9) + 1;
      return `${p},${dec}%`;
    }
    case "date": {
      const y = 2000 + (h[0]! % 25);
      const m = (h[1]! % 12) + 1;
      const d = (h[2]! % 28) + 1;
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    case "org": {
      const name = FAKE_ORG_NAMES[h[0]! % FAKE_ORG_NAMES.length]!;
      const suffixes: ReadonlyArray<string> = ["A.Ş.", "Ltd.", "Holding"];
      const suffix = suffixes[h[1]! % suffixes.length]!;
      return `${name} ${suffix}`;
    }
    case "jitter": {
      // `jitter` is generated by `applyNumericJitter()`, never by this
      // pattern-based generator. Returning the original keeps the API
      // total: this branch is unreachable in normal flow.
      return original;
    }
  }
}

interface RawMatch {
  kind: HoneytokenKind;
  start: number;
  end: number;
  text: string;
}

/**
 * Inject deterministic honeytokens into `text`. Returns the rewritten text
 * and an array of `HoneytokenRecord`s the caller should persist (so that a
 * later forensic scan can confirm exfiltration).
 *
 * The function is idempotent for a given `(secret, clientId, text, opts)`.
 */
export function injectHoneytokens(
  text: string,
  opts: HoneytokenInjectOptions,
): HoneytokenInjectResult {
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("injectHoneytokens: secret must be at least 8 characters");
  }
  if (!opts.clientId) {
    throw new Error("injectHoneytokens: clientId is required");
  }
  const maxTokens = Math.max(1, Math.floor(opts.maxTokens ?? 6));
  const density = Math.min(1, Math.max(0.05, opts.density ?? 0.5));

  // Collect all candidate matches across all patterns.
  const all: RawMatch[] = [];
  for (const def of PATTERNS) {
    const re = new RegExp(def.re.source, def.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // Skip zero-length matches to avoid infinite loops.
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      all.push({ kind: def.kind, start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  if (all.length === 0) {
    return { text, tokens: [] };
  }

  // Sort by start, then resolve overlaps greedily (keep first / longer).
  all.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const nonOverlapping: RawMatch[] = [];
  let cursor = -1;
  for (const m of all) {
    if (m.start >= cursor) {
      nonOverlapping.push(m);
      cursor = m.end;
    }
  }

  // Decide which matches to convert. Use HMAC-derived deterministic
  // selection so the same input always produces the same honeytokens.
  const eligible = nonOverlapping
    .map((m, i) => {
      const score = hmac(opts.secret, opts.clientId, "select", String(i), m.text)[0]! / 255;
      return { m, score, i };
    })
    .sort((a, b) => a.score - b.score);
  const targetCount = Math.min(
    maxTokens,
    Math.max(1, Math.round(eligible.length * density)),
  );
  const chosenIdx = new Set(eligible.slice(0, targetCount).map((e) => e.i));

  // Apply replacements from end → start so earlier indices stay valid.
  const occurrences = new Map<HoneytokenKind, number>();
  let out = text;
  const tokens: HoneytokenRecord[] = [];
  // We need to emit `tokens` in left-to-right order, so build them on a
  // separate pass keyed by the *new* position after rewrites.
  const replacements: Array<{ m: RawMatch; fake: string; hash: string }> = [];
  for (let i = nonOverlapping.length - 1; i >= 0; i--) {
    if (!chosenIdx.has(i)) continue;
    const m = nonOverlapping[i]!;
    const occ = (occurrences.get(m.kind) ?? 0) + 1;
    occurrences.set(m.kind, occ);
    const fake = fakeFor(m.kind, opts.secret, opts.clientId, m.text, occ);
    const hash = hmacHex(opts.secret, "orig", opts.clientId, m.text).slice(0, 64);
    out = out.slice(0, m.start) + fake + out.slice(m.end);
    replacements.unshift({ m, fake, hash });
  }

  // Recompute positions in the rewritten text by scanning for each fake.
  let scanFrom = 0;
  for (const r of replacements) {
    const pos = out.indexOf(r.fake, scanFrom);
    tokens.push({
      kind: r.m.kind,
      fakeValue: r.fake,
      originalValueHash: r.hash,
      position: pos >= 0 ? pos : -1,
    });
    if (pos >= 0) scanFrom = pos + r.fake.length;
  }

  return { text: out, tokens };
}

/**
 * Scan a suspect text for the presence of any of the supplied honeytoken
 * fake values. A non-empty result array constitutes an "absolute breach" —
 * the suspect text contains data that *only* a bot could have ingested.
 */
export interface HoneytokenScanHit {
  fakeValue: string;
  position: number;
}

export function scanForHoneytokens(
  suspectText: string,
  fakeValues: ReadonlyArray<string>,
): HoneytokenScanHit[] {
  if (!suspectText || fakeValues.length === 0) return [];
  const hits: HoneytokenScanHit[] = [];
  for (const fv of fakeValues) {
    if (!fv) continue;
    const pos = suspectText.indexOf(fv);
    if (pos >= 0) hits.push({ fakeValue: fv, position: pos });
  }
  return hits;
}
