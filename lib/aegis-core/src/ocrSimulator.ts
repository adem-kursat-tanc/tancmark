/**
 * **Test-only** helper that simulates what a camera-photo + OCR pipeline
 * does to a protected text. Used by the test battery to measure how much
 * of the cloak survives a screen-capture attack:
 *
 *  - strips zero-width markers
 *  - normalizes homoglyph carriers (Cyrillic а → Latin a, etc.)
 *  - corrupts a small fraction of characters using common OCR errors
 *    (O↔0, I↔1, l↔1, rn→m, S↔5, B↔8)
 *  - randomly drops/changes Turkish-specific diacritics (ş→s, ğ→g)
 *  - collapses whitespace and removes some punctuation
 *
 * Deterministic given a `seed` so tests are reproducible. Default seed is
 * `"ocr-simulator-default"`. NOT used in production code paths.
 */

const ZW_RE = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

const HOMOGLYPH_NORMALIZE: Record<string, string> = {
  "а": "a", // CYRILLIC SMALL LETTER A → LATIN
  "е": "e",
  "о": "o",
  "р": "p",
  "с": "c",
  "х": "x",
  "у": "y",
  "А": "A",
  "Е": "E",
  "О": "O",
  "Р": "P",
  "С": "C",
  "Х": "X",
  "У": "Y",
  "ı": "i", // some OCR engines collapse dotless-i
};

const TR_DIACRITIC_DEGRADE: Record<string, string> = {
  "ş": "s", "Ş": "S",
  "ğ": "g", "Ğ": "G",
  "ç": "c", "Ç": "C",
  "ö": "o", "Ö": "O",
  "ü": "u", "Ü": "U",
  "İ": "I",
};

const OCR_PAIRS: ReadonlyArray<[string, string]> = [
  ["O", "0"], ["0", "O"],
  ["I", "1"], ["l", "1"],
  ["S", "5"], ["B", "8"],
  ["rn", "m"], ["cl", "d"],
];

// Tiny PRNG (Mulberry32) for reproducibility.
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export interface OcrSimulateOptions {
  /** Probability per char of an OCR substitution. Default 0.02. */
  errorRate?: number;
  /** Probability per Turkish diacritic char of being stripped. Default 0.5. */
  diacriticDropRate?: number;
  /** Reproducibility seed. */
  seed?: string;
  /** Strip carrier zero-width chars (default true). */
  stripZeroWidth?: boolean;
  /** Normalize Cyrillic-look-alike homoglyphs (default true). */
  normalizeHomoglyphs?: boolean;
  /** Remove `,;:!?` (default true) — many OCR pipelines lose them. */
  dropPunctuation?: boolean;
}

/** Apply a deterministic OCR-style corruption to `text`. */
export function simulateOcr(text: string, opts: OcrSimulateOptions = {}): string {
  if (typeof text !== "string" || text.length === 0) return "";
  const errorRate = opts.errorRate ?? 0.02;
  const dropDiacritic = opts.diacriticDropRate ?? 0.5;
  const stripZw = opts.stripZeroWidth ?? true;
  const normHomo = opts.normalizeHomoglyphs ?? true;
  const dropPunct = opts.dropPunctuation ?? true;
  const rand = mulberry32(seedFromString(opts.seed ?? "ocr-simulator-default"));

  let out = text;
  if (stripZw) out = out.replace(ZW_RE, "");

  if (normHomo) {
    out = Array.from(out)
      .map((ch) => HOMOGLYPH_NORMALIZE[ch] ?? ch)
      .join("");
  }

  // Diacritic degradation
  out = Array.from(out)
    .map((ch) => {
      const repl = TR_DIACRITIC_DEGRADE[ch];
      if (repl !== undefined && rand() < dropDiacritic) return repl;
      return ch;
    })
    .join("");

  // OCR substitution errors (whole-string scan; cheap on demo sizes)
  for (const [from, to] of OCR_PAIRS) {
    out = out.replace(new RegExp(from, "g"), (m) => (rand() < errorRate ? to : m));
  }

  if (dropPunct) {
    out = out.replace(/[,;:!?]/g, (m) => (rand() < 0.6 ? "" : m));
  }

  // Collapse whitespace
  out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return out;
}
