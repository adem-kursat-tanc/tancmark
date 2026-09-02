/**
 * AEGIS Faz 5 Step 5.8-A.6 / T006.2 — Anchor Geometry Code (Channel B)
 *
 * Spatial ID half-key transport: encodes the LOW 4 bytes of cloak identity
 * into 8 anchor coordinate offsets (Channel B), complementary to the DCT
 * concentric marker (Channel A) that already carries the HIGH 4 bytes.
 *
 *  Channel A (DCT marker, dctConcentricMarker.ts) → high 4 bytes of cloakId
 *  Channel B (this lib, anchor offset codebook)   → low  4 bytes of cloakId
 *  Together                                       → 64-bit identity
 *
 * MATHEMATICAL FOUNDATION
 * ───────────────────────
 *   T006.0-REVISE Aşama 2 SPIKE measured σ_int=0 (640 detection sample,
 *   8 attack profiles incl. JPEG Q85 + rotate ±5°/±30° + Hough jitter ±0.5°)
 *   for DCT-concentric anchor centroid recovery → ±2 px / step=1 codebook
 *   is mathematically viable on paper-like backgrounds. T006.6 e2e gate
 *   (real PDFKit text-heavy cloak corpus) MUST validate before promotion;
 *   see docs/archive/t006_spike_landings.md methodology caveat.
 *
 * CODEBOOK (architect REVISION madde 2 — affine-orthogonal symmetry)
 * ───────────────────────────────────────────────────────────────────
 *   • 4 levels per axis: {-2, -1, +1, +2} px (skip 0 to maintain noise margin
 *     against detection drift around the centroid).
 *   • Each anchor carries 1 nibble (4 bits): high-2-bits → dx index,
 *     low-2-bits → dy index.
 *   • 8 anchors × 4 bits = 32 bits = 4 bytes. EXACT half-key capacity.
 *   • Symmetric around (0,0) → for uniform-random IDs across a corpus,
 *     E[Σdx]=E[Σdy]=0 (ensemble property; NOT a per-codeword constraint —
 *     a single ID like 0xFFFFFFFF maps every anchor to (+2,+2)).
 *
 *   TRANSLATION DRIFT IS THE CALLER'S RESPONSIBILITY. This lib does NOT
 *   mean-subtract measurements before snap, because doing so would corrupt
 *   asymmetric codewords (e.g. 0xFF.. → all (+2,+2) → mean (+2,+2) → snap
 *   collapses to (-1,-1), wrong nibble). In the Aegis pipeline, cascade
 *   Hough RAW-pxRgba deskew + inverse-warp already aligns the vault rect to
 *   the canonical frame BEFORE marker centroids are measured — so (dx,dy)
 *   passed to decodeOffsetsToIdLow4 are already drift-free relative to the
 *   nominal anchor centroids (Maskeleme Kanunu intakt: TEK bilinear).
 *
 * NIBBLE LAYOUT
 * ─────────────
 *   nibble bits b3 b2 b1 b0 → (dxIdx, dyIdx)
 *     b3 b2 = dx index (00 → -2, 01 → -1, 10 → +1, 11 → +2)
 *     b1 b0 = dy index (00 → -2, 01 → -1, 10 → +1, 11 → +2)
 *
 *   bytes-to-nibbles ordering (byte i, hi-nibble first):
 *     bytes[0]: anchor 0 = bytes[0] >> 4, anchor 1 = bytes[0] & 0x0f
 *     bytes[1]: anchor 2 = bytes[1] >> 4, anchor 3 = bytes[1] & 0x0f
 *     bytes[2]: anchor 4 = bytes[2] >> 4, anchor 5 = bytes[2] & 0x0f
 *     bytes[3]: anchor 6 = bytes[3] >> 4, anchor 7 = bytes[3] & 0x0f
 *
 * DECODER NO-MEAN-SUB CONTRACT
 * ────────────────────────────
 *   The previous design experimented with mean-subtraction across non-erased
 *   anchors to absorb residual translation drift. SMOKE T05/T08/T09 proved
 *   this corrupts asymmetric codewords. Removed; caller aligns upstream.
 *
 * DECODER (Partial ID Matching, architect REVISION madde 1)
 * ──────────────────────────────────────────────────────────
 *   No in-band ECC (RS/CRC). Recovery is deferred to the database matcher
 *   via Hamming distance over the 32-bit decoded payload. Rationale:
 *     • RS(8,4) over GF(16) would halve capacity from 32 to 16 data bits
 *       (architect REVISION KPI-driven decision).
 *     • CRC32 inside 32 bits leaves 0 bits for data.
 *     • SPIKE σ_int=0 implies clean reads → in-band ECC overhead is wasteful.
 *     • Erasure (occluded anchor) → DB fuzzy lookup with Hamming ≤ N tolerates
 *       up to 4-anchor loss naturally (8 bits per anchor erasure).
 *
 *   Decoder reports:
 *     • bytes (best-effort 4-byte payload; erased anchors → 0x0)
 *     • perAnchorSnapDist: float[] of |measured - codebook| L∞ distance
 *     • erasures: int[] anchor indices marked erased on input
 *     • confidence: "exact" if (no erasures) AND (max snap dist ≤ 0.7) AND
 *                   (max snap dist on the chosen level ≤ 1.0); else
 *                   "ecc-recovered" (caller must DB-fuzzy-match).
 *
 * FUZZY MATCH HELPER
 * ──────────────────
 *   findCandidatesByHamming(decoded, candidates, maxBitDistance) returns
 *   sorted (asc by distance) candidates whose Hamming distance to the decoded
 *   payload ≤ maxBitDistance. Caller scopes candidates by client_id (architect
 *   REVISION madde 4: never global lookup — partial-ID space is small enough
 *   that cross-tenant collisions become probable at scale).
 *
 * KIRMIZI ÇİZGİLER
 * ────────────────
 *   • Pure TS, no native deps (sharp-free contract).
 *   • Deterministic: same input → same output, no randomness.
 *   • Honest reporting: confidence="ecc-recovered" never lies — even a single
 *     ambiguous snap or any erasure downgrades from "exact".
 */

// Codebook constants — DO NOT REORDER (decoder relies on index alignment).
export const ANCHOR_AXIS_LEVELS = [-2, -1, 1, 2] as const;
export const ANCHOR_COUNT = 8;
export const ANCHOR_PAYLOAD_BYTES = 4;
export const ANCHOR_PAYLOAD_BITS = 32;

// Snap-distance thresholds for confidence promotion.
export const ANCHOR_EXACT_SNAP_MAX = 0.7; // ≤ this → "exact" possible
export const ANCHOR_AMBIGUOUS_SNAP_MAX = 1.5; // > this on chosen level → still
                                              // returns best, downgrades

export interface AnchorOffset {
  /** Δx in pixels relative to the nominal anchor centroid (codebook level). */
  dx: number;
  /** Δy in pixels relative to the nominal anchor centroid (codebook level). */
  dy: number;
}

export interface AnchorMeasurement {
  /** Measured Δx (sub-pixel allowed). */
  dx: number;
  /** Measured Δy (sub-pixel allowed). */
  dy: number;
  /** True if this anchor is occluded / unreliable; decoder fills with 0x0. */
  erased?: boolean;
}

export interface DecodeResult {
  /** Best-effort 4-byte payload (low 4 bytes of cloakId). */
  bytes: Uint8Array;
  /** L∞ snap distance for each of the 8 anchors (0 = perfect snap). */
  perAnchorSnapDist: number[];
  /** Anchor indices marked erased on input (passed through). */
  erasures: number[];
  /** "exact" only if zero erasures AND max snap dist ≤ ANCHOR_EXACT_SNAP_MAX. */
  confidence: "exact" | "ecc-recovered";
  /** Diagnostic: per-anchor decoded nibble (0x00..0x0f). Erased = 0. */
  perAnchorNibbles: number[];
}

export interface CandidateMatch {
  /** Index into the candidates array supplied by the caller. */
  index: number;
  /** Hamming distance (bit count) to the decoded payload. 0 = exact match. */
  hammingDistance: number;
}

// ─── ENCODE ────────────────────────────────────────────────────────────────

/**
 * Encode the LOW 4 bytes of a cloak identity into 8 anchor offsets.
 *
 * @param idLow4 4-byte payload (Uint8Array of length 4).
 * @returns 8 (dx, dy) offsets in the order anchor 0 .. anchor 7.
 * @throws if idLow4.length !== 4.
 */
export function encodeIdLow4ToOffsets(idLow4: Uint8Array): AnchorOffset[] {
  if (idLow4.length !== ANCHOR_PAYLOAD_BYTES) {
    throw new Error(
      `anchorGeometryCode.encode: expected ${ANCHOR_PAYLOAD_BYTES} bytes, got ${idLow4.length}`,
    );
  }
  const out: AnchorOffset[] = [];
  for (let byteIdx = 0; byteIdx < ANCHOR_PAYLOAD_BYTES; byteIdx++) {
    const b = idLow4[byteIdx]!;
    const hiNibble = (b >> 4) & 0x0f;
    const loNibble = b & 0x0f;
    out.push(nibbleToOffset(hiNibble));
    out.push(nibbleToOffset(loNibble));
  }
  return out;
}

function nibbleToOffset(nibble: number): AnchorOffset {
  const dxIdx = (nibble >> 2) & 0x03;
  const dyIdx = nibble & 0x03;
  return {
    dx: ANCHOR_AXIS_LEVELS[dxIdx]!,
    dy: ANCHOR_AXIS_LEVELS[dyIdx]!,
  };
}

// ─── DECODE ────────────────────────────────────────────────────────────────

/**
 * Decode 8 measured anchor offsets back to the LOW 4 bytes of cloak identity.
 *
 * Performs:
 *   1. Erasure collection (passed-through; no implicit drift absorption —
 *      see header DECODER NO-MEAN-SUB CONTRACT).
 *   2. Nearest-level snap on each axis with L∞ distance reported.
 *   3. Confidence determination (see header doc).
 *
 * HONEST KNOWN LIMITATION (smoke T18): a systematic drift d with
 * |d| ≥ 1.0 px applied to a saturated codeword (e.g. 0x00000000 → all anchors
 * at (-2,-2)) can produce a wrong byte AND confidence="exact" simultaneously,
 * because every measurement still snaps within ANCHOR_EXACT_SNAP_MAX of an
 * adjacent (wrong) level. This is by design — the lib has no out-of-band
 * reference to detect global drift. The CALLER MUST align measurements
 * upstream (cascade Hough deskew + inverse warp in the Aegis pipeline) AND
 * cross-check decoded bytes against a tenant-scoped DB candidate set via
 * `findCandidatesByHamming`. A self-consistent decode is not a vouched ID.
 *
 * @param measurements Exactly 8 anchor measurements (anchor 0 .. anchor 7).
 * @returns DecodeResult with best-effort bytes + diagnostics.
 * @throws if measurements.length !== 8.
 */
export function decodeOffsetsToIdLow4(
  measurements: readonly AnchorMeasurement[],
): DecodeResult {
  if (measurements.length !== ANCHOR_COUNT) {
    throw new Error(
      `anchorGeometryCode.decode: expected ${ANCHOR_COUNT} measurements, got ${measurements.length}`,
    );
  }

  // Step 1: collect erasures (no mean-subtraction; caller aligns upstream).
  const erasures: number[] = [];
  for (let i = 0; i < ANCHOR_COUNT; i++) {
    if (measurements[i]!.erased) erasures.push(i);
  }

  // Step 2: snap each non-erased anchor to nearest codebook level.
  const bytes = new Uint8Array(ANCHOR_PAYLOAD_BYTES);
  const perAnchorSnapDist: number[] = new Array(ANCHOR_COUNT).fill(0);
  const perAnchorNibbles: number[] = new Array(ANCHOR_COUNT).fill(0);

  let maxSnap = 0;
  for (let i = 0; i < ANCHOR_COUNT; i++) {
    const m = measurements[i]!;
    if (m.erased) {
      perAnchorSnapDist[i] = Number.POSITIVE_INFINITY;
      perAnchorNibbles[i] = 0;
      continue;
    }
    const xs = snapToLevel(m.dx);
    const ys = snapToLevel(m.dy);
    perAnchorSnapDist[i] = Math.max(xs.dist, ys.dist);
    if (perAnchorSnapDist[i]! > maxSnap) maxSnap = perAnchorSnapDist[i]!;
    const nibble = ((xs.idx & 0x03) << 2) | (ys.idx & 0x03);
    perAnchorNibbles[i] = nibble;
  }

  // Step 3: pack nibbles into bytes (anchor 2k → hi nibble, anchor 2k+1 → lo).
  for (let byteIdx = 0; byteIdx < ANCHOR_PAYLOAD_BYTES; byteIdx++) {
    const hi = perAnchorNibbles[byteIdx * 2]! & 0x0f;
    const lo = perAnchorNibbles[byteIdx * 2 + 1]! & 0x0f;
    bytes[byteIdx] = (hi << 4) | lo;
  }

  // Step 4: confidence verdict.
  const confidence: "exact" | "ecc-recovered" =
    erasures.length === 0 && maxSnap <= ANCHOR_EXACT_SNAP_MAX
      ? "exact"
      : "ecc-recovered";

  return { bytes, perAnchorSnapDist, erasures, confidence, perAnchorNibbles };
}

function snapToLevel(value: number): { idx: number; dist: number } {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ANCHOR_AXIS_LEVELS.length; i++) {
    const d = Math.abs(value - ANCHOR_AXIS_LEVELS[i]!);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, dist: bestDist };
}

// ─── FUZZY MATCH (Partial ID Matching) ─────────────────────────────────────

/**
 * Find candidate IDs whose Hamming distance to the decoded payload is at most
 * `maxBitDistance`. Returns matches sorted ascending by distance (0 = exact).
 *
 * Caller MUST scope `candidates` by tenant/client_id before invocation
 * (architect REVISION madde 4 — never global lookup; partial-ID collision
 * probability grows quickly with corpus size).
 *
 * @param decoded 4-byte decoded payload from `decodeOffsetsToIdLow4`.
 * @param candidates Tenant-scoped candidate payloads (each Uint8Array(4)).
 * @param maxBitDistance Max Hamming distance for a hit (0..32).
 * @returns Sorted matches; empty if none qualify.
 */
export function findCandidatesByHamming(
  decoded: Uint8Array,
  candidates: readonly Uint8Array[],
  maxBitDistance: number,
): CandidateMatch[] {
  if (decoded.length !== ANCHOR_PAYLOAD_BYTES) {
    throw new Error(
      `findCandidatesByHamming: decoded must be ${ANCHOR_PAYLOAD_BYTES} bytes`,
    );
  }
  if (maxBitDistance < 0 || maxBitDistance > ANCHOR_PAYLOAD_BITS) {
    throw new Error(
      `findCandidatesByHamming: maxBitDistance must be in [0, ${ANCHOR_PAYLOAD_BITS}]`,
    );
  }
  const matches: CandidateMatch[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (c.length !== ANCHOR_PAYLOAD_BYTES) {
      throw new Error(
        `findCandidatesByHamming: candidate[${i}] must be ${ANCHOR_PAYLOAD_BYTES} bytes`,
      );
    }
    const d = hammingDistanceBytes(decoded, c);
    if (d <= maxBitDistance) {
      matches.push({ index: i, hammingDistance: d });
    }
  }
  matches.sort((a, b) => a.hammingDistance - b.hammingDistance);
  return matches;
}

function hammingDistanceBytes(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = (a[i]! ^ b[i]!) & 0xff;
    // Brian Kernighan popcount (fast for small bit counts).
    while (x !== 0) {
      x &= x - 1;
      d += 1;
    }
  }
  return d;
}

// ─── INTERNALS (exported for smoke / introspection only) ───────────────────

export const ANCHOR_GEOMETRY_INTERNALS = {
  nibbleToOffset,
  snapToLevel,
  hammingDistanceBytes,
};
