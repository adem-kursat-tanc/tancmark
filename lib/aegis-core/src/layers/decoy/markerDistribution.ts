import { encodeEmissionToken } from "./tokenCodec";

/**
 * AEGIS v4.1 Step 2 — Distribute emission token marker blocks across the
 * delivery text and append the visible AEGIS footer banner.
 *
 * Strategy:
 *   markerCount = max(MIN_MARKERS, ceil(textLen / TARGET_BYTES_PER_MARKER))
 *
 * Insertion preference (tried in order, falls back as needed):
 *   1. Paragraph boundaries (`\n\s*\n`)
 *   2. Sentence boundaries (`.!?` followed by whitespace)
 *   3. Even char-offset distribution
 *
 * Footer is decoy-in-the-literal-sense: an attacker who reads it, panics,
 * and strips it gains a false sense of safety while the invisible markers
 * carry the real attribution. Removing the footer alone is normal copy
 * behaviour (no `Decoy_Stripped` audit). Only when the tag markers
 * themselves are normalized away does that audit fire.
 */

export const MIN_MARKERS = 4;
export const TARGET_BYTES_PER_MARKER = 500;

export interface DistributeMarkersInput {
  baseText: string;
  emissionToken: string;
  shortDocId: string;
  issuedDate: Date;
}

export interface DistributeMarkersOutput {
  deliveryText: string;
  markerCount: number;
  markerPositions: number[];
}

function buildFooter(shortDocId: string, issuedDate: Date): string {
  const iso = issuedDate.toISOString().slice(0, 10);
  return [
    "",
    "---",
    "This document is digitally protected by AEGIS. Unauthorized distribution is logged and traceable.",
    `Document ID: ${shortDocId}  •  Issued: ${iso}`,
    "",
  ].join("\n");
}

function chooseInsertionPositions(text: string, count: number): number[] {
  const positions: number[] = [];
  // 1. Paragraph boundaries.
  const paraRe = /\n\s*\n/g;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(text)) !== null) {
    positions.push(m.index + m[0].length);
  }
  if (positions.length >= count) {
    return positions.slice(0, count);
  }
  // 2. Sentence boundaries (Latin punctuation + whitespace).
  const sentRe = /[.!?]\s+/g;
  while ((m = sentRe.exec(text)) !== null) {
    const pos = m.index + m[0].length;
    if (!positions.includes(pos)) positions.push(pos);
  }
  if (positions.length >= count) {
    // De-dup + sort + evenly subsample.
    return evenSubsample(
      Array.from(new Set(positions)).sort((a, b) => a - b),
      count,
    );
  }
  // 3. Even char-offset fallback.
  const offsets: number[] = [];
  const step = Math.floor(text.length / (count + 1));
  for (let i = 1; i <= count; i++) {
    offsets.push(Math.min(text.length, step * i));
  }
  return offsets;
}

function evenSubsample(arr: number[], k: number): number[] {
  if (arr.length <= k) return arr.slice();
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i * arr.length) / k);
    out.push(arr[idx]!);
  }
  return out;
}

export function distributeMarkers(
  input: DistributeMarkersInput,
): DistributeMarkersOutput {
  const { baseText, emissionToken, shortDocId, issuedDate } = input;
  const markerCount = Math.max(
    MIN_MARKERS,
    Math.ceil(baseText.length / TARGET_BYTES_PER_MARKER),
  );
  const markerBlock = encodeEmissionToken(emissionToken);

  const insertAt = chooseInsertionPositions(baseText, markerCount).sort(
    (a, b) => a - b,
  );

  // Build delivery text by splicing markerBlock at each insertion offset.
  const positionsInDelivery: number[] = [];
  let out = "";
  let cursor = 0;
  for (const pos of insertAt) {
    out += baseText.slice(cursor, pos);
    positionsInDelivery.push(out.length);
    out += markerBlock;
    cursor = pos;
  }
  out += baseText.slice(cursor);

  // Append visible footer (NOT counted as a marker).
  out += buildFooter(shortDocId, issuedDate);

  return {
    deliveryText: out,
    markerCount: insertAt.length,
    markerPositions: positionsInDelivery,
  };
}
