/**
 * Structural Entanglement: paraphrase-resilient n-gram fingerprints.
 *
 * Goal: even after heavy manipulation (synonym swaps, reordering, ~30-50%
 * rewrites), residual fragments of the original text should still
 * deterministically attribute the leak to (clientId, cloakId).
 *
 * Approach:
 *   1. Tokenise + normalise the protected output (lowercase, fold TR
 *      diacritics, strip punctuation, collapse digits to "#").
 *   2. Slide a window of `windowSize` tokens (default 5).
 *   3. For each window: SHA-256 of `tokens.join(" ")`, take the first
 *      16 bytes (128 bits) as `gramHash`.
 *   4. Persist `(clientId, cloakId, docId, windowIndex, gramHash)` rows.
 *
 * Recovery (`scanText`):
 *   - Compute the suspect text's fingerprints the same way.
 *   - For each `gramHash` that matches a registered fingerprint:
 *       * if it appears in ≥2 *distinct* clients' rows → drop it
 *         (false-accusation guard, mirrors honeytoken policy)
 *       * otherwise count it toward (client, cloak) tally.
 *   - The (clientId, cloakId) with the highest decisive tally wins,
 *     provided it clears `RECOVERY_THRESHOLD` (default 5 windows).
 *   - On tie or below threshold → "ambiguous" / "insufficient" verdict.
 *
 * Why content-only hashes (no HMAC):
 *   - Indexable: a single B-tree on `gram_hash` answers any scan in
 *     log time, regardless of which client we're attributing to.
 *   - The HMAC-style "binding" the user requested is provided by the
 *     storage relationship: a fingerprint only "claims" a leak when
 *     it was registered against a specific (clientId, cloakId), and
 *     the false-accusation guard prevents collisions from auto-attrib.
 */

import { createHash } from "node:crypto";

export const DEFAULT_WINDOW_SIZE = 5;
/**
 * Multi-resolution fingerprint sizes used by the cloak path AND the scan
 * path. Two sizes are emitted per cloak: a small (3) window for fragments
 * that survive heavy deletion/corruption, and the original (5) window for
 * specificity. The false-accusation guard (drops gram hashes shared by
 * ≥2 distinct clients) is computed per-hash, so adding the 3-window does
 * not weaken attribution — common Turkish trigrams are simply dropped
 * automatically. Net effect: ~30-35% deletion still clears the recovery
 * threshold, where the single 5-window previously fell to "insufficient".
 */
export const DEFAULT_WINDOW_SIZES: readonly number[] = [3, 5];
export const RECOVERY_THRESHOLD = 5;
export const HASH_HEX_LEN = 32; // 16 raw bytes → 32 hex chars

export interface FingerprintInput {
  clientId: string;
  cloakId: string;
  docId: string;
}

export interface Fingerprint {
  clientId: string;
  cloakId: string;
  docId: string;
  windowSize: number;
  windowIndex: number;
  gramHash: string;
}

/** TR-aware lowercase + diacritic fold. Keeps `ı/i` distinction collapsed. */
function foldTurkish(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c);
}

/**
 * Strip zero-width chars (homoglyph/zero-width carrier layers) so a
 * watermarked sentence and its stripped equivalent produce the same
 * fingerprints. Also collapses runs of digits to a single `#` so
 * numeric jitter doesn't kill window matches.
 */
export function normaliseTokens(text: string): string[] {
  const stripped = text
    // Zero-width: ZWSP, ZWNJ, ZWJ, WJ, ZWNBSP, BOM
    .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "")
    // Homoglyph carriers our protect layer might have swapped in
    .normalize("NFKC");
  const lowered = foldTurkish(stripped);
  // Tokenise on non-letter/digit. Collapse digit runs to "#".
  const raw = lowered.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
  return raw.map((t) => (/^[0-9]+$/.test(t) ? "#" : t));
}

function hashWindow(tokens: ReadonlyArray<string>): string {
  return createHash("sha256")
    .update(tokens.join(" "), "utf8")
    .digest("hex")
    .slice(0, HASH_HEX_LEN);
}

/**
 * Extract every n-gram fingerprint from `text` for the given binding.
 * Idempotent: same `(text, binding)` always produces the same array.
 */
export function extractFingerprints(
  text: string,
  binding: FingerprintInput,
  opts: { windowSize?: number; windowSizes?: readonly number[] } = {},
): Fingerprint[] {
  const sizes = resolveWindowSizes(opts);
  const tokens = normaliseTokens(text);
  const out: Fingerprint[] = [];
  for (const ws of sizes) {
    if (ws < 2) throw new Error("windowSize must be ≥ 2");
    if (tokens.length < ws) continue;
    for (let i = 0; i + ws <= tokens.length; i++) {
      out.push({
        ...binding,
        windowSize: ws,
        windowIndex: i,
        gramHash: hashWindow(tokens.slice(i, i + ws)),
      });
    }
  }
  return out;
}

function resolveWindowSizes(opts: {
  windowSize?: number;
  windowSizes?: readonly number[];
}): readonly number[] {
  if (opts.windowSizes && opts.windowSizes.length > 0) {
    return Array.from(new Set(opts.windowSizes.filter((n) => Number.isInteger(n) && n >= 2)));
  }
  if (typeof opts.windowSize === "number") return [opts.windowSize];
  return DEFAULT_WINDOW_SIZES;
}

/**
 * Compute only the gram hashes for a suspect text (no binding required).
 * Use these to look up registered fingerprints in storage.
 */
export function suspectGramHashes(
  text: string,
  opts: { windowSize?: number; windowSizes?: readonly number[] } = {},
): string[] {
  const sizes = resolveWindowSizes(opts);
  const tokens = normaliseTokens(text);
  const out: string[] = [];
  for (const ws of sizes) {
    if (tokens.length < ws) continue;
    for (let i = 0; i + ws <= tokens.length; i++) {
      out.push(hashWindow(tokens.slice(i, i + ws)));
    }
  }
  return out;
}

/**
 * Pure scoring helper: given the registered rows that matched the
 * suspect's hashes, compute decisive (client,cloak) tallies and a
 * verdict. The DB lookup is the caller's responsibility.
 */
export interface RegisteredMatch {
  clientId: string;
  cloakId: string;
  docId: string;
  gramHash: string;
  /**
   * Optional window size of the matched fingerprint. When provided, the
   * scoring layer enforces the multi-window safety rule: a `strong`
   * verdict requires at least one ≥5-gram match in the top tally so a
   * paraphrased text that hits only short 3-grams cannot single-handedly
   * "win" attribution. Legacy callers that only emit 5-grams may omit
   * this field — every match is then treated as a long-window match.
   */
  windowSize?: number;
}

export interface AttributionVerdict {
  verdict: "strong" | "ambiguous" | "insufficient";
  totalSuspectGrams: number;
  totalMatchedGrams: number;
  ambiguousDroppedHashes: number;
  topSuspect:
    | { clientId: string; cloakId: string; docId: string; matches: number; coverage: number }
    | null;
  candidates: Array<{
    clientId: string;
    cloakId: string;
    docId: string;
    matches: number;
    coverage: number;
  }>;
}

export function attributeFromMatches(
  suspectHashCount: number,
  matches: ReadonlyArray<RegisteredMatch>,
  opts: { recoveryThreshold?: number } = {},
): AttributionVerdict {
  const threshold = opts.recoveryThreshold ?? RECOVERY_THRESHOLD;
  // Group by hash → set of clientIds. Hashes shared across ≥2 clients
  // are dropped from attribution (false-accusation guard).
  const clientsByHash = new Map<string, Set<string>>();
  for (const m of matches) {
    const set = clientsByHash.get(m.gramHash) ?? new Set();
    set.add(m.clientId);
    clientsByHash.set(m.gramHash, set);
  }
  const ambiguousHashes = new Set<string>();
  for (const [h, owners] of clientsByHash) {
    if (owners.size >= 2) ambiguousHashes.add(h);
  }
  // Tally decisive matches per (clientId, cloakId). De-dupe so the same
  // hash isn't double-counted if the suspect text repeats a window. We
  // also track how many matches in each tally come from a long-window
  // (≥5 tokens) — short windows alone are too easily confusable for a
  // strong verdict (see RegisteredMatch.windowSize comment).
  const seenForKey = new Map<string, Set<string>>();
  const tally = new Map<
    string,
    {
      clientId: string;
      cloakId: string;
      docId: string;
      matches: number;
      longWindowMatches: number;
    }
  >();
  for (const m of matches) {
    if (ambiguousHashes.has(m.gramHash)) continue;
    const key = `${m.clientId}\u241F${m.cloakId}`;
    const seen = seenForKey.get(key) ?? new Set<string>();
    if (seen.has(m.gramHash)) continue;
    seen.add(m.gramHash);
    seenForKey.set(key, seen);
    const cur = tally.get(key) ?? {
      clientId: m.clientId,
      cloakId: m.cloakId,
      docId: m.docId,
      matches: 0,
      longWindowMatches: 0,
    };
    cur.matches += 1;
    // Treat a missing windowSize as a long match (legacy compat: callers
    // that only emit 5-grams omit the field and must not be downgraded).
    if (m.windowSize === undefined || m.windowSize >= 5) {
      cur.longWindowMatches += 1;
    }
    tally.set(key, cur);
  }

  const candidates = Array.from(tally.values())
    .map((c) => ({
      ...c,
      coverage: suspectHashCount > 0 ? c.matches / suspectHashCount : 0,
    }))
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      // Stable tiebreaker so the result is deterministic.
      const ak = `${a.clientId}|${a.cloakId}`;
      const bk = `${b.clientId}|${b.cloakId}`;
      return ak.localeCompare(bk);
    });

  const totalMatchedGrams = candidates.reduce((s, c) => s + c.matches, 0);
  const top = candidates[0] ?? null;
  let verdict: AttributionVerdict["verdict"];
  if (!top || top.matches < threshold) {
    verdict = "insufficient";
  } else if (candidates.length >= 2 && candidates[1]!.matches >= top.matches) {
    // True tie at the top → ambiguous.
    verdict = "ambiguous";
  } else if (
    candidates.length >= 2 &&
    candidates[1]!.matches >= Math.ceil(top.matches * 0.8)
  ) {
    // Two candidates within 20% of each other and both above threshold
    // → still ambiguous (we won't pick a winner by 1-2 grams).
    verdict = candidates[1]!.matches >= threshold ? "ambiguous" : "strong";
  } else if (top.longWindowMatches < 1) {
    // Multi-window safety rule: a tally built entirely from short windows
    // (≤4 tokens) is too low-specificity to produce a "strong" verdict
    // even when it clears the count threshold. Short windows exist to
    // boost recall under heavy deletion; the decisive evidence still
    // needs at least one long-window (≥5) match. Otherwise demote to
    // ambiguous so the verdict ladder forces operator review.
    verdict = "ambiguous";
  } else {
    verdict = "strong";
  }

  return {
    verdict,
    totalSuspectGrams: suspectHashCount,
    totalMatchedGrams,
    ambiguousDroppedHashes: ambiguousHashes.size,
    topSuspect: top,
    candidates,
  };
}
