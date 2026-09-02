/**
 * AEGIS T007 — TRIPLE CONCENTRIC SHIELD (lib reconstruction)
 *
 * 4 center "Altın Bölge" anchors × (R1 finder + R2 data + R3 redundant data)
 * BPSK = 32-bit ID per cloak (4 anchors × 8 bits/anchor).
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ R1 finder ring  (8 BPSK coefs, radius ≈ 7-8.6)                   │
 *   │     deterministic identity NCC (sign HMAC(secret|anchor|cloak))  │
 *   │ R2 data ring    (8 BPSK coefs, radius ≈ 10-11.5)                 │
 *   │     1 bit/coef = 8 bits/anchor                                   │
 *   │ R3 data ring    (8 BPSK coefs, radius ≈ 13-14.5)                 │
 *   │     redundant 8 bits, magnitude-weighted majority with R2        │
 *   │ DC + ultra-low (r<3)                  UNTOUCHED — preserves luma │
 *   │ High (r>15)                           UNTOUCHED — JPEG erases    │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Adaptive α (see adaptiveAlpha.ts) maps local luma std → α ∈ [20, 80] —
 * quieter substrate gets weaker stamp, noisier (text-heavy) substrate gets
 * stronger stamp for JPEG/rotate carrier survival.
 *
 * INFORMED RECEIVER: subtract WARPED clean reference patch (caller-built
 * via mirror chain under hypothesis θ + JPEG) from observed patch →
 * residual → FDCT → sign-NCC against finder; magnitude-weighted majority
 * for R2/R3 bits.
 *
 * SHARP-FREE: pure pixel/byte/float arithmetic. lib/aegis-core sharp
 * dependency = forbidden (caller handles PNG encode/decode).
 *
 * T008.5 ADDITIVE PROMOTION (BYTE-IDENTICAL surface):
 *   This 4-anchor R1+R2+R3 pipeline remains the byte-identical core.
 *   Diagonal Pivot, Split-Alpha, Local Contrast Boost and RS Aggressive
 *   are layered as ADDITIVE helpers in `./diagonalPivot.ts` and re-exported
 *   from `../index.ts`. Callers that want the T008.5 hybrid pipeline
 *   (8-cardinal + split-alpha NAV/DATA + local boost decode + R1_ERASURE_THR
 *   aggressive) compose this module with `applyLocalContrastBoost` etc.
 *   No symbol from this file was renamed, removed, or semantically altered.
 */

import { createHmac } from "node:crypto";

export const TRIPLE_SHIELD_SIZE = 32;
export const TRIPLE_SHIELD_RING_SIZE = 8;
export const TRIPLE_SHIELD_BITS_PER_ANCHOR = 8;
export const TRIPLE_SHIELD_ANCHOR_COUNT = 4;
export const TRIPLE_SHIELD_TOTAL_BITS =
  TRIPLE_SHIELD_BITS_PER_ANCHOR * TRIPLE_SHIELD_ANCHOR_COUNT;

const R1_BAND: readonly [number, number] = [7.0, 8.6];
const R2_BAND: readonly [number, number] = [10.0, 11.5];
const R3_BAND: readonly [number, number] = [13.0, 14.5];

interface RingCoef {
  idx: number;
  r: number;
  u: number;
  v: number;
}

function buildRingCoefs(rMin: number, rMax: number, take: number): number[] {
  const list: RingCoef[] = [];
  for (let u = 0; u < 32; u++) {
    for (let v = 0; v < 32; v++) {
      if (u === 0 && v === 0) continue;
      const r = Math.sqrt(u * u + v * v);
      if (r >= rMin && r <= rMax) list.push({ idx: u * 32 + v, r, u, v });
    }
  }
  list.sort((a, b) => a.r - b.r || a.v - b.v || a.u - b.u);
  if (list.length < take) {
    throw new Error(
      `tripleShield: ring band [${rMin},${rMax}] yielded ${list.length} coefs, need ${take}`,
    );
  }
  return list.slice(0, take).map((c) => c.idx);
}

const R1_COEFS: readonly number[] = buildRingCoefs(
  R1_BAND[0],
  R1_BAND[1],
  TRIPLE_SHIELD_RING_SIZE,
);
const R2_COEFS: readonly number[] = buildRingCoefs(
  R2_BAND[0],
  R2_BAND[1],
  TRIPLE_SHIELD_RING_SIZE,
);
const R3_COEFS: readonly number[] = buildRingCoefs(
  R3_BAND[0],
  R3_BAND[1],
  TRIPLE_SHIELD_RING_SIZE,
);

export interface TripleShieldAnchor {
  id: string;
  x: number;
  y: number;
}

const ANCHOR_OFFSETS: ReadonlyArray<{ id: string; dx: number; dy: number }> = [
  { id: "C00", dx: -76, dy: -76 },
  { id: "C01", dx: 44, dy: -76 },
  { id: "C10", dx: -76, dy: 44 },
  { id: "C11", dx: 44, dy: 44 },
];

/** 4 center "Altın Bölge" anchors for image of size width×height. */
export function expectedTripleShieldAnchors(
  width: number,
  height: number,
): TripleShieldAnchor[] {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  return ANCHOR_OFFSETS.map((a) => ({ id: a.id, x: cx + a.dx, y: cy + a.dy }));
}

/** Derive R1 finder ring sign sequence (length 8) for one (anchor, cloak)
 *  pair. HMAC(secret|"aegis-t007-r1-finder-v1"|anchorId|cloakIdHex). */
export function deriveR1FinderSigns(
  secret: Buffer | Uint8Array,
  anchorId: string,
  cloakIdHex: string,
): Int8Array {
  const mac = createHmac("sha256", Buffer.from(secret))
    .update(`aegis-t007-r1-finder-v1|${anchorId}|${cloakIdHex}`)
    .digest();
  const out = new Int8Array(TRIPLE_SHIELD_RING_SIZE);
  for (let i = 0; i < TRIPLE_SHIELD_RING_SIZE; i++) {
    out[i] = (mac[i]! & 1) === 1 ? 1 : -1;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 32×32 separable orthonormal DCT-II
// ──────────────────────────────────────────────────────────────────────────

const COS_32: Float64Array = (() => {
  const t = new Float64Array(32 * 32);
  for (let n = 0; n < 32; n++) {
    for (let k = 0; k < 32; k++) {
      t[n * 32 + k] = Math.cos(((2 * n + 1) * k * Math.PI) / 64);
    }
  }
  return t;
})();
const ALPHA_DC = 1 / Math.sqrt(2);
const NORM = Math.sqrt(2 / 32);

function dct1d(input: Float64Array, output: Float64Array): void {
  for (let k = 0; k < 32; k++) {
    let s = 0;
    for (let n = 0; n < 32; n++) s += input[n]! * COS_32[n * 32 + k]!;
    output[k] = (k === 0 ? ALPHA_DC : 1) * NORM * s;
  }
}

function idct1d(input: Float64Array, output: Float64Array): void {
  for (let n = 0; n < 32; n++) {
    let s = 0;
    for (let k = 0; k < 32; k++) {
      s += (k === 0 ? ALPHA_DC : 1) * input[k]! * COS_32[n * 32 + k]!;
    }
    output[n] = NORM * s;
  }
}

function fdct32(block: Float64Array): Float64Array {
  const tmp = new Float64Array(1024);
  const out = new Float64Array(1024);
  const row = new Float64Array(32);
  const rowOut = new Float64Array(32);
  for (let r = 0; r < 32; r++) {
    for (let c = 0; c < 32; c++) row[c] = block[r * 32 + c]!;
    dct1d(row, rowOut);
    for (let c = 0; c < 32; c++) tmp[r * 32 + c] = rowOut[c]!;
  }
  const col = new Float64Array(32);
  const colOut = new Float64Array(32);
  for (let c = 0; c < 32; c++) {
    for (let r = 0; r < 32; r++) col[r] = tmp[r * 32 + c]!;
    dct1d(col, colOut);
    for (let r = 0; r < 32; r++) out[r * 32 + c] = colOut[r]!;
  }
  return out;
}

function idct32(coeff: Float64Array): Float64Array {
  const tmp = new Float64Array(1024);
  const out = new Float64Array(1024);
  const col = new Float64Array(32);
  const colOut = new Float64Array(32);
  for (let c = 0; c < 32; c++) {
    for (let r = 0; r < 32; r++) col[r] = coeff[r * 32 + c]!;
    idct1d(col, colOut);
    for (let r = 0; r < 32; r++) tmp[r * 32 + c] = colOut[r]!;
  }
  const row = new Float64Array(32);
  const rowOut = new Float64Array(32);
  for (let r = 0; r < 32; r++) {
    for (let c = 0; c < 32; c++) row[c] = tmp[r * 32 + c]!;
    idct1d(row, rowOut);
    for (let c = 0; c < 32; c++) out[r * 32 + c] = rowOut[c]!;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Patch I/O (luma extract + delta apply)
// ──────────────────────────────────────────────────────────────────────────

function extractLumaPatch(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): Float64Array {
  const p = new Float64Array(1024);
  for (let py = 0; py < 32; py++) {
    const sy = Math.min(height - 1, Math.max(0, y + py));
    for (let px = 0; px < 32; px++) {
      const sx = Math.min(width - 1, Math.max(0, x + px));
      const i = (sy * width + sx) * 4;
      p[py * 32 + px] = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    }
  }
  return p;
}

function applyLumaDelta(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  delta: Float64Array,
): void {
  for (let py = 0; py < 32; py++) {
    const dy = y + py;
    if (dy < 0 || dy >= height) continue;
    for (let px = 0; px < 32; px++) {
      const dx = x + px;
      if (dx < 0 || dx >= width) continue;
      const i = (dy * width + dx) * 4;
      const d = delta[py * 32 + px]!;
      const r = Math.round(rgba[i]! + d);
      const g = Math.round(rgba[i + 1]! + d);
      const b = Math.round(rgba[i + 2]! + d);
      rgba[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      rgba[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      rgba[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Stamp + Decode
// ──────────────────────────────────────────────────────────────────────────

/** Stamp a single TripleShield anchor (R1 finder + R2 data + R3 redundant
 *  data). Mutates `rgba` in place. dataByte = 8 bits stored at this anchor. */
export function stampTripleShield(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  finderSigns: Int8Array,
  dataByte: number,
  alpha: number,
): void {
  if (finderSigns.length !== TRIPLE_SHIELD_RING_SIZE) {
    throw new Error(
      `stampTripleShield: finderSigns length ${finderSigns.length}, expected ${TRIPLE_SHIELD_RING_SIZE}`,
    );
  }
  const orig = extractLumaPatch(rgba, width, height, x, y);
  const coefs = fdct32(orig);
  for (let i = 0; i < TRIPLE_SHIELD_RING_SIZE; i++) {
    coefs[R1_COEFS[i]!]! += alpha * finderSigns[i]!;
  }
  for (let i = 0; i < TRIPLE_SHIELD_BITS_PER_ANCHOR; i++) {
    const bit = (dataByte >> (7 - i)) & 1;
    const s = bit === 1 ? 1 : -1;
    coefs[R2_COEFS[i]!]! += alpha * s;
    coefs[R3_COEFS[i]!]! += alpha * s;
  }
  const newLuma = idct32(coefs);
  const delta = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) delta[i] = newLuma[i]! - orig[i]!;
  applyLumaDelta(rgba, width, height, x, y, delta);
}

export interface TripleShieldDecoded {
  /** R1 finder sign-only NCC ∈ [−1, 1]. ≈ 1 ⇒ perfect identity match. */
  r1Ncc: number;
  /** Mean |residual| across R2 ring coefs (carrier strength proxy). */
  meanR2Mag: number;
  /** Mean |residual| across R3 ring coefs (redundant carrier strength). */
  meanR3Mag: number;
  /** Decoded 8-bit data byte (R2 + R3 magnitude-weighted majority). */
  dataBits8: number;
}

/** Decode one anchor under the INFORMED contract: caller supplies a
 *  warped reference patch (clean substrate run through the same
 *  hypothesised attack chain). Residual = observed − warpedRef → FDCT →
 *  R1 sign-NCC + R2/R3 magnitude-weighted majority. */
export function decodeTripleShieldInformed(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  refPatch: Float64Array,
  finderSigns: Int8Array,
): TripleShieldDecoded {
  if (refPatch.length !== 1024) {
    throw new Error(
      `decodeTripleShieldInformed: refPatch length ${refPatch.length}, expected 1024`,
    );
  }
  const observed = extractLumaPatch(rgba, width, height, x, y);
  const residual = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) residual[i] = observed[i]! - refPatch[i]!;
  const rc = fdct32(residual);
  let dot = 0;
  for (let i = 0; i < TRIPLE_SHIELD_RING_SIZE; i++) {
    const c = rc[R1_COEFS[i]!]!;
    dot += Math.sign(c) * finderSigns[i]!;
  }
  const r1Ncc = dot / TRIPLE_SHIELD_RING_SIZE;
  let r2Sum = 0;
  let r3Sum = 0;
  let bits = 0;
  for (let i = 0; i < TRIPLE_SHIELD_BITS_PER_ANCHOR; i++) {
    const c2 = rc[R2_COEFS[i]!]!;
    const c3 = rc[R3_COEFS[i]!]!;
    r2Sum += Math.abs(c2);
    r3Sum += Math.abs(c3);
    const score = c2 + c3;
    const bit = score >= 0 ? 1 : 0;
    bits |= bit << (7 - i);
  }
  return {
    r1Ncc,
    meanR2Mag: r2Sum / TRIPLE_SHIELD_BITS_PER_ANCHOR,
    meanR3Mag: r3Sum / TRIPLE_SHIELD_BITS_PER_ANCHOR,
    dataBits8: bits & 0xff,
  };
}

/** Diagnostic: ring coefficient (u, v) layout as a flat list. Useful for
 *  tests and architectural review. */
export function getTripleShieldRingLayout(): {
  r1: number[];
  r2: number[];
  r3: number[];
} {
  return {
    r1: [...R1_COEFS],
    r2: [...R2_COEFS],
    r3: [...R3_COEFS],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// T007.9 BUKALEMUN — Content-Aware Dispatcher (re-export from
// tripleShieldCrossCheck.ts so all T007 chameleon symbols are co-located.)
// ──────────────────────────────────────────────────────────────────────────

export {
  selectChannelPriority,
  deriveChannelAId16,
  crossCheckChannels,
  CROSS_CHECK_DEFAULT_K,
  CROSS_CHECK_ID16_BYTES,
  CROSS_CHECK_HKDF_LABEL,
} from "./tripleShieldCrossCheck";
export type {
  ChannelPriority,
  SubstrateMetrics,
  DispatcherOptions,
  CrossCheckMode,
  CrossCheckResult,
} from "./tripleShieldCrossCheck";
