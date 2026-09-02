// Visual fingerprinting helper — projects each character of a sealed text
// onto a synthetic spatial grid so the PDF "Mikro-Boşluk ve Karakter Varyans"
// block can show codepoint placement coordinates as a forensic technical log.
//
// Coordinates are deterministic (column = i % wrap, row = floor(i / wrap))
// plus a sub-pixel "micro offset" derived from the codepoint to surface the
// presence of zero-width / homoglyph carriers in the variance dump.

export interface SpatialPoint {
  /** 0-based character index in the ORIGINAL (un-stripped) text. */
  index: number;
  /** Column on the synthetic grid (0..wrap-1). */
  col: number;
  /** Row on the synthetic grid. */
  row: number;
  /** Sub-pixel horizontal jitter, range [0, 1). */
  microX: number;
  /** Sub-pixel vertical jitter, range [0, 1). */
  microY: number;
  /** The character itself (single codepoint segment). */
  char: string;
  /** Hex codepoint, e.g. "0061". */
  codepoint: string;
  /** Marker — true when char is zero-width or a known homoglyph carrier. */
  carrier: boolean;
}

export interface SpatialVarianceReport {
  totalChars: number;
  wrap: number;
  carriers: number;
  /** Micro-offset variance across all characters (population variance of microX). */
  microXVariance: number;
  /** Micro-offset variance of microY. */
  microYVariance: number;
  /** Sample of points (capped). */
  points: SpatialPoint[];
}

const ZW_CHARS = new Set<string>([
  "\u200B", // ZWSP
  "\u200C", // ZWNJ
  "\u200D", // ZWJ
  "\u2060", // WJ
  "\u2063", // INVISIBLE SEPARATOR
  "\u2064", // INVISIBLE PLUS
  "\uFEFF", // BOM / ZWNBSP
]);

// Well-known Latin↔Cyrillic confusables surfaced as carriers in the variance.
const HOMO_CARRIERS = new Set<string>([
  "а",
  "е",
  "о",
  "р",
  "с",
  "у",
  "х",
  "А",
  "В",
  "Е",
  "К",
  "М",
  "Н",
  "О",
  "Р",
  "С",
  "Т",
  "Х",
]);

export interface SpatialVarianceOptions {
  /** Grid wrap column. Default 64. */
  wrap?: number;
  /** Maximum number of points to materialize. Default 80. */
  pointLimit?: number;
}

export function computeSpatialVariance(
  text: string,
  opts: SpatialVarianceOptions = {},
): SpatialVarianceReport {
  const wrap = Math.max(8, Math.floor(opts.wrap ?? 64));
  const pointLimit = Math.max(0, Math.floor(opts.pointLimit ?? 80));

  const chars = Array.from(text);
  const totalChars = chars.length;

  let carriers = 0;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  const points: SpatialPoint[] = [];
  // Pick evenly-spaced indices so the sample spans the whole document.
  const stride = totalChars > pointLimit && pointLimit > 0 ? Math.floor(totalChars / pointLimit) : 1;

  for (let i = 0; i < totalChars; i++) {
    const ch = chars[i]!;
    const cp = ch.codePointAt(0) ?? 0;
    const isCarrier = ZW_CHARS.has(ch) || HOMO_CARRIERS.has(ch);
    if (isCarrier) carriers++;

    // Deterministic micro-offset: hash codepoint into [0,1).
    const microX = ((cp * 2654435761) >>> 0) / 0xffffffff;
    const microY = ((cp * 40503) >>> 0) / 0xffffffff;
    sumX += microX;
    sumY += microY;
    sumX2 += microX * microX;
    sumY2 += microY * microY;

    if (
      points.length < pointLimit &&
      (i % stride === 0 || isCarrier) // always include carriers
    ) {
      points.push({
        index: i,
        col: i % wrap,
        row: Math.floor(i / wrap),
        microX,
        microY,
        char: ch,
        codepoint: cp.toString(16).padStart(4, "0").toUpperCase(),
        carrier: isCarrier,
      });
    }
  }

  // Trim if carriers pushed over the limit.
  const finalPoints = points.slice(0, pointLimit);

  const microXVariance =
    totalChars > 0 ? sumX2 / totalChars - (sumX / totalChars) ** 2 : 0;
  const microYVariance =
    totalChars > 0 ? sumY2 / totalChars - (sumY / totalChars) ** 2 : 0;

  return {
    totalChars,
    wrap,
    carriers,
    microXVariance,
    microYVariance,
    points: finalPoints,
  };
}
