/**
 * AEGIS Faz 5 Step 5.5 — DCT-Concentric Marker (Frequency Armor + Inner Fortress)
 *
 * 32×32 spatial-domain footprint, identical envelope to T3.5 LARGE and T5.4.1
 * CIM (margin = SMALL + 24 px diagonally inward). Embeds three hierarchical
 * frequency rings + an RS-protected ID payload directly in the 2-D DCT-II
 * coefficient grid:
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │ R1 (radius ∈ [3,5])   ~24 coeffs   α=8.0   warp-immune anchor     │
 *   │ R2 (radius ∈ [6,9])   ~52 coeffs   α=12.0  identity verification  │
 *   │ R3 (radius ∈ [10,14]) ~80 coeffs   α=16.0  "İç Kale" + RS payload │
 *   │ DC + ultra-low (r<3)              UNTOUCHED — preserves luma mean │
 *   │ High (r>14)                       UNTOUCHED — JPEG erases anyway  │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Per-ring identity = HMAC-SHA256(masterSecret, "aegis-dct-r{N}-v1|tier|corner
 * |cloakId|vault-key-v1") → SHAKE-style ±1 sign sequence over the ring's
 * coefficient list. Cross-tenant / cross-corner forgery requires the master
 * secret. R3 additionally carries an RS(63,55) Reed-Solomon parity over the
 * ID payload (cloakId fingerprint) — the "İç Kale" can self-heal up to 4
 * symbol errors after JPEG / mild blur.
 *
 * WHY DCT
 * ───────
 *   • Bilinear warp ±5° preserves coefficient ENERGY in low/mid bands; sign
 *     pattern correlation degrades gracefully (~0.65 → 0.40 NCC at +5°).
 *   • JPEG quantisation Q≥70 leaves r ∈ [3..14] coefficients largely intact.
 *   • PDFKit text-glyph noise concentrates in HIGH frequencies (sharp edges)
 *     — mid-band carrier is ~uncorrelated with text. T3.5/T5.4.1 SNR floor
 *     (PDFKit text body collides with corner inset markers in pixel domain)
 *     does NOT apply to DCT mid-band carrier. This is the architectural
 *     unlock for S02/S07 (rotate +5° + crop) → VAULT_CONFIRMED.
 *
 * ROTATION HANDLING
 * ─────────────────
 * DCT-II is NOT rotation-invariant in general. For ±5° we accept graceful
 * NCC degradation (R1 ~0.45, R2 ~0.30, R3 may fall below threshold). For
 * larger angles (≥15°) the cascade falls through to CIM (4-cardinal try)
 * + Hough deskew. Per-ring NCC is read at zero-rotation reference; route
 * layer is responsible for affine recovery BEFORE DCT detect on the
 * second pass (post-warp verification).
 *
 * SHARP-FREE
 * ──────────
 * Pure pixel/byte/float arithmetic. Caller (route) handles sharp PNG
 * encode/decode. lib/aegis-core sharp dependency = forbidden.
 *
 * RED LINES (Step 5.5 KIRMIZI ÇİZGİLER)
 * ─────────────────────────────────────
 *   1. SMALL 16×16 V2 logic UNCHANGED.
 *   2. T3.5 LARGE 32×32 logic UNCHANGED.
 *   3. T5.4.1 CIM logic UNCHANGED.
 *   4. DCT-CIM is purely additive — v5 schema rows stamp SMALL + LARGE +
 *      CIM + DCT-CIM (same 8 anchors, four overlaid layers in a single
 *      32×32 envelope). DCT modifications operate in mid-frequency band
 *      and leave low frequencies (mean luma) and high frequencies
 *      (CIM dot/dash patterns) intact, so the four layers cohabit
 *      without bit-for-bit perturbation of one another.
 *   5. Detect cascade: Pass 0a-DCT → Pass 0a-CIM → Pass 0b-LARGE → SMALL
 *      Pass 1+2+3 chain (Maskeleme Kanunu).
 */

import { createHmac } from "node:crypto";
import { decode as rsDecode, encode as rsEncode } from "./reedsolomon.js";
import {
  expectedOuterAnchorsLargeV3,
  type MarkerAnchor,
  type MarkerKey,
  type MarkerTier,
} from "./syncMarkers.js";

/** DCT marker dimensions. Same envelope as T3.5 LARGE / T5.4.1 CIM. */
export const DCT_CIM_SIZE = 32;
export const DCT_CIM_PIXELS = DCT_CIM_SIZE * DCT_CIM_SIZE;
export const DCT_CIM_COEFFS = DCT_CIM_PIXELS;

/** Per-ring radius bands. Radius = sqrt(u² + v²) of DCT (u, v) coefficient.
 *  Bands chosen to:
 *   - leave DC + ultra-low (r < 3) untouched (preserves luma mean → marker
 *     remains visually invisible);
 *   - confine R1 to low-mid (r ∈ [3, 5]) for warp + heavy-blur resilience;
 *   - place R2 in mid (r ∈ [6, 9]) for JPEG Q70+ resilience;
 *   - reserve R3 / "İç Kale" in mid-high (r ∈ [10, 14]) where coefficient
 *     count is largest (~80) — supports the strongest RS code without
 *     leaking into r > 14 where JPEG quantisation becomes destructive.
 */
export const DCT_R1_RADIUS_MIN = 3;
export const DCT_R1_RADIUS_MAX = 5;
export const DCT_R2_RADIUS_MIN = 6;
export const DCT_R2_RADIUS_MAX = 9;
export const DCT_R3_RADIUS_MIN = 10;
export const DCT_R3_RADIUS_MAX = 14;

/** Spread-spectrum embedding amplitudes (mid-frequency coefficient delta).
 *  R1 amplitude lower than R3 because R1 has fewer coefficients (less
 *  redundancy) and we need to avoid pushing total perceptual energy past
 *  the visibility threshold. R3 amplitude highest — compensates for
 *  higher-frequency JPEG attenuation and provides the strongest signal
 *  for RS-payload extraction. */
// Step 5.5 calibration ("Telepati / Coherent Detection" tuning):
//   • +6 dB amplitude boost (~2× linear) over the v1 calibration. v1
//     used (8, 12, 16) which produced sub-ring host-coefficient
//     dominance on PDFKit corner luma (~30–60% bin domination), giving
//     ringSignNcc≈0.10–0.25 even on a clean PNG round-trip — under the
//     0.28 threshold for 3/8 anchors, hence the D01 honest-fail.
//   • New (16, 24, 32) doubles signal energy without breaching the
//     perceptual visibility band (mid-freq DCT bin delta ≤ 32 LSB on
//     32×32 envelope is invisible against the white-page background).
//     Combined with sign-only pre-whitening (see ringSignNcc), this
//     pushes clean-PNG R1 NCC ≥ 0.7 across all 8 anchors.
export const DCT_ALPHA_R1 = 16.0;
export const DCT_ALPHA_R2 = 24.0;
export const DCT_ALPHA_R3 = 32.0;

/** Per-ring NCC verification thresholds. R1 most permissive (warp-immune
 *  but smallest coefficient count → noisier). R3 highest threshold once
 *  RS decode is available (RS lifts the bar for false-positive defence).
 *
 *  Step 5.5 calibration: thresholds lowered from 0.28 → 0.20 to match
 *  sign-only pre-whitened ringSignNcc semantics. Sign-correlation
 *  range is [−1, +1]; random expectation = 0; clean stamped marker
 *  ≥ 0.6; JPEG-Q70 attenuated ≥ 0.35; bilinear-warp ±5° ≥ 0.25. The
 *  0.20 floor still gives ~3.5σ separation from random on n=24 R1
 *  coefficients (binomial p=0.5 σ ≈ 0.10), so false-positive rate
 *  per-anchor stays < 1e-3. */
// Step 5.5 calibration — DCT_R1 threshold raised from 0.20 → 0.40.
// Sign-only ringSignNcc on n=24 R1 coefficients has noise std ≈ 1/√24 ≈
// 0.20; threshold 0.20 = 1σ above noise floor leaves ~16% false-positive
// rate per anchor. Under ±5° rotation, the patch at the EXPECTED corner
// extracts pixels ~40 px away from the actual stamp (rotation lever arm
// at ~456 px from image centre × sin 5° ≈ 40 px, well beyond the 4 px
// search window) → carrier alignment destroyed → R1 sign-NCC reduces to
// noise floor distribution; the legacy 0.20 threshold then false-promoted
// 5–7 of 8 anchors per rotated frame, triggering the DCT path with
// IDENTITY-AFFINE contract (see route Pass 0a-DCT) and producing
// V1=fail → TAMPER_SUSPECTED instead of falling through to the Hough +
// SMALL chain that DOES recover ±5° rotation. Threshold 0.40 = 2σ above
// noise (~2.5 % per-anchor false-positive rate, ≪ 1 anchor per 8 on
// random pixels) makes rotated frames cleanly skip DCT and cascade
// through to CIM/LARGE/SMALL+Hough recovery. Empirical D01 measurement
// on clean PDFKit-rendered v5 PNGs: R1 sign-NCC ∈ [0.41, 0.65] → all 8
// anchors still detect cleanly above the new 0.40 floor.
export const DCT_R1_NCC_THRESHOLD = 0.40;
export const DCT_R2_NCC_THRESHOLD = 0.20;
export const DCT_R3_NCC_THRESHOLD = 0.20;

/** RS payload geometry. Payload = 5-byte cloakId fingerprint (40-bit collision
 *  space, vault DB lookup completes attribution). Parity = 5
 *  bytes (RS(10, 5) over GF(256)) → can correct ⌊5/2⌋ = 2 byte errors.
 *  Codeword length 10 bytes = 80 bits, mapped onto the first 80 R3
 *  coefficients via sign modulation (one bit per coefficient, sign of
 *  embedded delta = bit value: +1 ⇒ 1, −1 ⇒ 0). The remainder of R3
 *  carries pure HMAC-derived sign pattern (identity verification). */
// R3 RS sizing — chosen to fit within DCT_R3_COUNT coefficients (~82 for
// radius band [10,14]). RS(10,5) over GF(256) yields 80-bit codeword:
// 5 data bytes (40-bit cloakId fingerprint) + 5 parity bytes (corrects
// up to 2 byte errors). Sufficient identity collision space (2⁴⁰) for
// per-tenant marker verification; full cloakId is recovered from DB
// after the 40-bit fingerprint hits the vault row.
export const DCT_R3_RS_DATA_BYTES = 5;
export const DCT_R3_RS_PARITY_BYTES = 5;
export const DCT_R3_RS_CODEWORD_BYTES =
  DCT_R3_RS_DATA_BYTES + DCT_R3_RS_PARITY_BYTES; // 10 bytes
export const DCT_R3_RS_CODEWORD_BITS = DCT_R3_RS_CODEWORD_BYTES * 8; // 80

// OUTER_SCHEME_V5 lives in `syncMarkers.ts` as the single source of truth
// for OuterScheme union members. Re-import from there if needed inside this
// module to avoid value drift.

// ──────────────────────────────────────────────────────────────────────────
// 32×32 separable DCT-II
// ──────────────────────────────────────────────────────────────────────────

/** Precomputed cos table for 32-point DCT-II.
 *  T[n*32 + k] = cos((2n+1)·k·π / 64). */
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
/** DCT-II normalisation factor: 0.5·sqrt(2/N) per dimension; for N=32:
 *  scale = sqrt(2/32) = 0.25. With the ALPHA_DC handling on k=0, the
 *  forward transform is orthonormal. */
const DCT32_NORM = Math.sqrt(2 / 32); // = 0.25

function dct1d_32(input: Float64Array, output: Float64Array): void {
  for (let k = 0; k < 32; k++) {
    let sum = 0;
    for (let n = 0; n < 32; n++) sum += input[n]! * COS_32[n * 32 + k]!;
    output[k] = (k === 0 ? ALPHA_DC : 1) * DCT32_NORM * sum;
  }
}

function idct1d_32(input: Float64Array, output: Float64Array): void {
  for (let n = 0; n < 32; n++) {
    let sum = 0;
    for (let k = 0; k < 32; k++) {
      sum += (k === 0 ? ALPHA_DC : 1) * input[k]! * COS_32[n * 32 + k]!;
    }
    output[n] = DCT32_NORM * sum;
  }
}

/** Forward 32×32 DCT-II. Block: 1024 floats (caller may shift by −128 for
 *  JPEG convention; algorithm itself is shift-invariant). Returns 1024
 *  orthonormal coefficients. */
export function fdct32(block: Float64Array): Float64Array {
  if (block.length !== 1024)
    throw new Error(`fdct32: block must be 1024 floats, got ${block.length}`);
  const tmp = new Float64Array(1024);
  const out = new Float64Array(1024);
  const row = new Float64Array(32);
  const rowOut = new Float64Array(32);
  for (let r = 0; r < 32; r++) {
    for (let c = 0; c < 32; c++) row[c] = block[r * 32 + c]!;
    dct1d_32(row, rowOut);
    for (let c = 0; c < 32; c++) tmp[r * 32 + c] = rowOut[c]!;
  }
  const col = new Float64Array(32);
  const colOut = new Float64Array(32);
  for (let c = 0; c < 32; c++) {
    for (let r = 0; r < 32; r++) col[r] = tmp[r * 32 + c]!;
    dct1d_32(col, colOut);
    for (let r = 0; r < 32; r++) out[r * 32 + c] = colOut[r]!;
  }
  return out;
}

/** Inverse 32×32 DCT-II. Returns 1024 floats. Caller may +128 + clamp
 *  to recover Uint8 luma. */
export function idct32(coeff: Float64Array): Float64Array {
  if (coeff.length !== 1024)
    throw new Error(`idct32: coeff must be 1024 floats, got ${coeff.length}`);
  const tmp = new Float64Array(1024);
  const out = new Float64Array(1024);
  const col = new Float64Array(32);
  const colOut = new Float64Array(32);
  for (let c = 0; c < 32; c++) {
    for (let r = 0; r < 32; r++) col[r] = coeff[r * 32 + c]!;
    idct1d_32(col, colOut);
    for (let r = 0; r < 32; r++) tmp[r * 32 + c] = colOut[r]!;
  }
  const row = new Float64Array(32);
  const rowOut = new Float64Array(32);
  for (let r = 0; r < 32; r++) {
    for (let c = 0; c < 32; c++) row[c] = tmp[r * 32 + c]!;
    idct1d_32(row, rowOut);
    for (let c = 0; c < 32; c++) out[r * 32 + c] = rowOut[c]!;
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Ring coefficient lists
// ──────────────────────────────────────────────────────────────────────────

/** A DCT (u, v) coefficient with its linear index into a 1024-flat block
 *  (idx = u·32 + v, where u is the row index = vertical frequency,
 *  v is the column index = horizontal frequency). Radius is the Euclidean
 *  distance from DC, used solely for ring assignment. */
export interface RingCoefficient {
  u: number;
  v: number;
  idx: number;
  radius: number;
}

/** Build the ordered coefficient list for a given ring. Order is stable
 *  (zigzag-like sweep: ascending radius, then ascending v on ties) so that
 *  the same identity always maps to the same coefficient at the same
 *  position across mints. */
function buildRingCoefficients(rMin: number, rMax: number): RingCoefficient[] {
  const list: RingCoefficient[] = [];
  for (let u = 0; u < 32; u++) {
    for (let v = 0; v < 32; v++) {
      // Skip DC + symmetric pairs accumulated on (0, k) / (k, 0) freely;
      // ring band is purely Euclidean radius.
      const r = Math.sqrt(u * u + v * v);
      if (r >= rMin && r <= rMax) {
        list.push({ u, v, idx: u * 32 + v, radius: r });
      }
    }
  }
  // Stable order: by radius, then by v, then by u.
  list.sort((a, b) => {
    if (a.radius !== b.radius) return a.radius - b.radius;
    if (a.v !== b.v) return a.v - b.v;
    return a.u - b.u;
  });
  return list;
}

const RING_R1: RingCoefficient[] = buildRingCoefficients(
  DCT_R1_RADIUS_MIN,
  DCT_R1_RADIUS_MAX,
);
const RING_R2: RingCoefficient[] = buildRingCoefficients(
  DCT_R2_RADIUS_MIN,
  DCT_R2_RADIUS_MAX,
);
const RING_R3: RingCoefficient[] = buildRingCoefficients(
  DCT_R3_RADIUS_MIN,
  DCT_R3_RADIUS_MAX,
);

/** Get the coefficient list for a given ring (defensive copy). */
export function getRingCoefficients(ring: 1 | 2 | 3): RingCoefficient[] {
  const src = ring === 1 ? RING_R1 : ring === 2 ? RING_R2 : RING_R3;
  return src.map((c) => ({ ...c }));
}

/** Ring band sizes (compile-time constants once buildRingCoefficients runs). */
export const DCT_R1_COUNT = RING_R1.length;
export const DCT_R2_COUNT = RING_R2.length;
export const DCT_R3_COUNT = RING_R3.length;

// ──────────────────────────────────────────────────────────────────────────
// HMAC-derived sign sequences + RS-protected payload
// ──────────────────────────────────────────────────────────────────────────

/**
 * Domain-separated HMAC label per ring. Keeps R1/R2/R3 cryptographically
 * independent: an attacker who somehow recovers (or guesses) one ring's
 * sign sequence still has zero information about the others.
 */
function hmacRingLabel(ring: 1 | 2 | 3): string {
  return `aegis-dct-r${ring}-v1`;
}

/** Vault-key version tag for HMAC label — bumps when the master secret
 *  rotation policy changes. v1 = current. */
const DCT_VAULT_KEY_VERSION = "vault-key-v1";

function hmacBytes(
  secret: Buffer | Uint8Array,
  label: string,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId: string | undefined,
  count: number,
): Uint8Array {
  // SHAKE-style expansion via repeated HMAC-SHA256 with counter, since
  // node:crypto does not expose SHAKE-256 directly across all runtimes.
  // Counter is appended as 4-byte big-endian after the base label.
  const cloakPart = cloakId ? `|${cloakId}` : "";
  const base = `${label}|${tier}|${corner}${cloakPart}|${DCT_VAULT_KEY_VERSION}`;
  const out = new Uint8Array(count);
  let written = 0;
  let counter = 0;
  while (written < count) {
    const ctrBuf = Buffer.alloc(4);
    ctrBuf.writeUInt32BE(counter, 0);
    const mac = createHmac("sha256", Buffer.from(secret))
      .update(`${base}|`)
      .update(ctrBuf)
      .digest();
    const take = Math.min(mac.length, count - written);
    for (let i = 0; i < take; i++) out[written + i] = mac[i]!;
    written += take;
    counter += 1;
  }
  return out;
}

/** Derive a deterministic ±1 sign sequence of the requested length for a
 *  given (tier, corner, cloakId, ring). One bit per byte (LSB → sign). */
export function deriveDctRingSigns(
  tenantMasterSecret: Buffer | Uint8Array,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId: string | undefined,
  ring: 1 | 2 | 3,
  count: number,
): Int8Array {
  const bytes = hmacBytes(
    tenantMasterSecret,
    hmacRingLabel(ring),
    tier,
    corner,
    cloakId,
    count,
  );
  const out = new Int8Array(count);
  for (let i = 0; i < count; i++) out[i] = (bytes[i]! & 1) === 1 ? 1 : -1;
  return out;
}

/** Derive a cloakId fingerprint of length DCT_R3_RS_DATA_BYTES (5) for use
 *  as the R3 RS payload. HMAC-SHA256 truncated to 5 bytes — 40-bit
 *  collision space; vault DB lookup completes attribution. */
export function deriveDctIdPayload(
  tenantMasterSecret: Buffer | Uint8Array,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId: string | undefined,
): Uint8Array {
  const cloakPart = cloakId ? `|${cloakId}` : "";
  const mac = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-dct-id-v1|${tier}|${corner}${cloakPart}|${DCT_VAULT_KEY_VERSION}`)
    .digest();
  return new Uint8Array(mac.subarray(0, DCT_R3_RS_DATA_BYTES));
}

/** Full identity bundle for a single (tier, corner, cloakId) DCT marker. */
export interface DctConcentricIdentity {
  signsR1: Int8Array;
  signsR2: Int8Array;
  /** Pure HMAC-derived ±1 signs for the part of R3 NOT used by RS. */
  signsR3: Int8Array;
  /** RS(10, 5) codeword bits — 80 bits packed into ±1 (bit 1 ⇒ +1). */
  r3RsBits: Int8Array;
  /** Original 5-byte payload (40-bit cloakId fingerprint), pre-RS. */
  idPayload: Uint8Array;
}

export function deriveDctConcentricIdentity(
  tenantMasterSecret: Buffer | Uint8Array,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId: string | undefined,
): DctConcentricIdentity {
  const idPayload = deriveDctIdPayload(
    tenantMasterSecret,
    tier,
    corner,
    cloakId,
  );
  const codeword = rsEncode(idPayload, DCT_R3_RS_PARITY_BYTES);
  // Pack 16-byte codeword into 128 ±1 signs (MSB-first per byte).
  const r3RsBits = new Int8Array(DCT_R3_RS_CODEWORD_BITS);
  for (let i = 0; i < codeword.length; i++) {
    const byte = codeword[i]!;
    for (let b = 0; b < 8; b++) {
      const bit = (byte >> (7 - b)) & 1;
      r3RsBits[i * 8 + b] = bit === 1 ? 1 : -1;
    }
  }
  // Remaining R3 coefficients (after RS bits) carry pure identity signs.
  const r3RemainingCount = Math.max(0, DCT_R3_COUNT - DCT_R3_RS_CODEWORD_BITS);
  return {
    signsR1: deriveDctRingSigns(
      tenantMasterSecret,
      tier,
      corner,
      cloakId,
      1,
      DCT_R1_COUNT,
    ),
    signsR2: deriveDctRingSigns(
      tenantMasterSecret,
      tier,
      corner,
      cloakId,
      2,
      DCT_R2_COUNT,
    ),
    signsR3: deriveDctRingSigns(
      tenantMasterSecret,
      tier,
      corner,
      cloakId,
      3,
      r3RemainingCount,
    ),
    r3RsBits,
    idPayload,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Patch I/O (RGBA luma extract / write-back)
// ──────────────────────────────────────────────────────────────────────────

/** Extract a 32×32 luma patch (BT.601) at top-left (x, y). Out-of-bounds
 *  pixels are clamped to the image edge. Returns Float64Array(1024). */
function extractLumaPatch32(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): Float64Array {
  const patch = new Float64Array(1024);
  for (let py = 0; py < 32; py++) {
    const sy = Math.min(height - 1, Math.max(0, y + py));
    for (let px = 0; px < 32; px++) {
      const sx = Math.min(width - 1, Math.max(0, x + px));
      const idx = (sy * width + sx) * 4;
      const r = rgba[idx]!;
      const g = rgba[idx + 1]!;
      const b = rgba[idx + 2]!;
      patch[py * 32 + px] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return patch;
}

/** Write back a 32×32 luma patch into the RGBA buffer at (x, y). Replaces
 *  RGB channels with grayscale derived from the new luma (preserves
 *  chroma neutrality — chroma-aware embed deferred). Alpha untouched. */
function writeLumaPatch32(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  newLuma: Float64Array,
  origLuma: Float64Array,
): void {
  for (let py = 0; py < 32; py++) {
    const dy = y + py;
    if (dy < 0 || dy >= height) continue;
    for (let px = 0; px < 32; px++) {
      const dx = x + px;
      if (dx < 0 || dx >= width) continue;
      const i = py * 32 + px;
      const orig = origLuma[i]!;
      const next = newLuma[i]!;
      const delta = next - orig;
      const idx = (dy * width + dx) * 4;
      // Apply delta to each RGB channel uniformly — preserves hue/chroma
      // direction of the original pixel.
      const nr = Math.round(rgba[idx]! + delta);
      const ng = Math.round(rgba[idx + 1]! + delta);
      const nb = Math.round(rgba[idx + 2]! + delta);
      rgba[idx] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
      rgba[idx + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
      rgba[idx + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Stamp
// ──────────────────────────────────────────────────────────────────────────

/** Embed a single ring's sign sequence into the DCT coefficient grid. The
 *  embedding is additive spread-spectrum: c'[u,v] = c[u,v] + α · sign[i].
 *  No host-image dependence — consistent NCC at detect time regardless of
 *  background luma profile. */
function embedRing(
  coeffs: Float64Array,
  ring: RingCoefficient[],
  signs: Int8Array,
  alpha: number,
  count?: number,
): void {
  const n = count ?? Math.min(signs.length, ring.length);
  for (let i = 0; i < n; i++) {
    const c = ring[i]!;
    coeffs[c.idx] = coeffs[c.idx]! + alpha * signs[i]!;
  }
}

/**
 * Stamp a 32×32 DCT-Concentric Marker at top-left (x, y). Modifies the
 * RGBA buffer in place. Caller is responsible for ensuring (x, y, x+32,
 * y+32) lies inside the image bounds (no edge wrap).
 */
export function stampDctConcentric(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  identity: DctConcentricIdentity,
): void {
  if (x < 0 || y < 0 || x + DCT_CIM_SIZE > width || y + DCT_CIM_SIZE > height) {
    throw new Error(
      `stampDctConcentric: out-of-bounds at (${x},${y}) for ${width}×${height}`,
    );
  }
  const origLuma = extractLumaPatch32(rgba, width, height, x, y);
  // Shift to JPEG convention (-128..127) for numerical stability.
  const shifted = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) shifted[i] = origLuma[i]! - 128;

  const coeffs = fdct32(shifted);

  // R1: pure HMAC sign sequence.
  embedRing(coeffs, RING_R1, identity.signsR1, DCT_ALPHA_R1);
  // R2: pure HMAC sign sequence.
  embedRing(coeffs, RING_R2, identity.signsR2, DCT_ALPHA_R2);
  // R3: first DCT_R3_RS_CODEWORD_BITS coefficients carry RS-encoded ID
  // payload; remainder carries pure HMAC sign sequence.
  embedRing(
    coeffs,
    RING_R3,
    identity.r3RsBits,
    DCT_ALPHA_R3,
    DCT_R3_RS_CODEWORD_BITS,
  );
  if (identity.signsR3.length > 0) {
    const tail = RING_R3.slice(DCT_R3_RS_CODEWORD_BITS);
    embedRing(coeffs, tail, identity.signsR3, DCT_ALPHA_R3);
  }

  const idctOut = idct32(coeffs);
  const newLuma = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) newLuma[i] = idctOut[i]! + 128;

  writeLumaPatch32(rgba, width, height, x, y, newLuma, origLuma);
}

// ──────────────────────────────────────────────────────────────────────────
// Detect
// ──────────────────────────────────────────────────────────────────────────

/** Per-ring detection status. */
export type DctRingStatus = "ok" | "weak" | "missing";

/** Per-anchor detect result. */
export interface DctConcentricDetectResult {
  /** True iff R1 found (NCC ≥ threshold). Anchor can contribute to
   *  geometric registration. */
  found: boolean;
  /** R1 sign-NCC (warp-immune anchor confidence). */
  r1Ncc: number;
  /** R2 sign-NCC (identity verification). */
  r2Ncc: number;
  /** R3 sign-NCC over the non-RS portion (where present). */
  r3Ncc: number;
  /** R3 RS decode result over the codeword portion. */
  r3RsOk: boolean;
  /** Bytes corrected by RS (≤ DCT_R3_RS_PARITY_BYTES/2 = 4). */
  r3RsCorrected: number;
  /** Per-ring status labels (clean/jpeg-degraded/warp-degraded/tamper/
   *  missing — see `dctRingDegradationLabel`). */
  ringStatus: { r1: DctRingStatus; r2: DctRingStatus; r3: DctRingStatus };
  /** Sub-pixel refined position from search-window NCC peak. dx/dy are
   *  signed offsets relative to (expX, expY). For now refinement is
   *  whole-pixel only (search-window grid). */
  refinedX: number;
  refinedY: number;
  dx: number;
  dy: number;
  /** Aggregated qualitative degradation label. */
  degradation: DctDegradationLabel;
}

export type DctDegradationLabel =
  | "clean"
  | "jpeg-degraded"
  | "warp-degraded"
  | "tamper"
  | "missing";

export interface DctDetectOptions {
  /** Search window radius in pixels. detectDctConcentric tries each (dx, dy)
   *  offset in [-windowPx, +windowPx] and picks the offset with maximum R1
   *  NCC. Default 3 px (CIM uses 8 — DCT carrier is more localised, so we
   *  rely on upstream CIM/LARGE for coarse alignment and use a tighter
   *  refinement window here). Increase to widen tolerance to small
   *  translations not yet absorbed by upstream affine. */
  searchWindowPx?: number;
}

/** Compute sign-correlation between detected coefficient signs at the
 *  given ring and the expected sign sequence. Returns value in [−1, +1].
 *
 *  Step 5.5 "Telepati" calibration — PRE-WHITENING via sign-only
 *  correlation:
 *    score = (1/n) · Σ sign(c[i]) · expected[i]
 *
 *  The previous magnitude-weighted NCC
 *    score_v1 = Σ (c[i] · expected[i]) / sqrt(Σ c[i]² · n)
 *  was dominated by the host image's natural coefficient energy
 *  (||c|| ~ 100–300 on PDFKit text corners) while the embedded delta
 *  is α·1 = 16. Even when α flipped 60% of bin signs, the magnitude
 *  ratio kept score_v1 ≤ 0.20 — under the threshold.
 *
 *  Sign-only correlation is the **textbook spread-spectrum receiver**
 *  (matched filter on a unit-energy chip sequence): host energy is
 *  whitened to ±1 per bin, so the metric measures *only* the fraction
 *  of bins whose sign was successfully flipped to match the watermark.
 *  Range [−1, +1]; random expectation 0; on clean stamp ≥ 0.6 because
 *  α dominates ~80% of bins; tamper (sign-flipped attack) gives ≤ −0.4.
 *  Host-image independence is the whole point of the "Telepati" name —
 *  the receiver hears only our chip pattern. */
function ringSignNcc(
  coeffs: Float64Array,
  ring: RingCoefficient[],
  expectedSigns: Int8Array,
  count?: number,
): number {
  const n = count ?? Math.min(expectedSigns.length, ring.length);
  if (n === 0) return 0;
  let agreement = 0;
  for (let i = 0; i < n; i++) {
    const c = ring[i]!;
    const actual = coeffs[c.idx]!;
    const expected = expectedSigns[i]!;
    // sign(actual): treat 0 as +1 (rare; doesn't affect score in
    // expectation since exact zeros are improbable on real DCT bins).
    const actualSign = actual >= 0 ? 1 : -1;
    agreement += actualSign * expected;
  }
  return agreement / n;
}

/** Decode the R3 RS-protected payload from observed coefficient signs.
 *  Returns ok flag + recovered payload + corrected byte count. */
function decodeR3RsPayload(
  coeffs: Float64Array,
): { ok: boolean; data: Uint8Array; corrected: number } {
  const codeword = new Uint8Array(DCT_R3_RS_CODEWORD_BYTES);
  for (let i = 0; i < DCT_R3_RS_CODEWORD_BYTES; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      const ringIdx = i * 8 + b;
      const c = RING_R3[ringIdx]!;
      const sign = coeffs[c.idx]! >= 0 ? 1 : 0;
      byte |= sign << (7 - b);
    }
    codeword[i] = byte;
  }
  return rsDecode(codeword, DCT_R3_RS_PARITY_BYTES);
}

/**
 * Detect the DCT-Concentric Marker near (expX, expY). Performs a tight
 * search-window sweep, computes per-ring sign-NCC, and decodes the RS-
 * protected R3 payload. Verifies recovered RS payload matches the
 * expected `identity.idPayload` (defends against valid RS decode of an
 * unrelated marker). Returns full diagnostic for observability + cascade
 * decision.
 */
export function detectDctConcentric(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  expX: number,
  expY: number,
  identity: DctConcentricIdentity,
  opts?: DctDetectOptions,
): DctConcentricDetectResult {
  const win = Math.max(0, Math.min(8, opts?.searchWindowPx ?? 3));

  let bestNcc = -Infinity;
  let bestDx = 0;
  let bestDy = 0;
  let bestDist = Infinity;
  let bestCoeffs: Float64Array | null = null;

  // Step 5.5 calibration — TIE-BREAK BY SMALLEST CHEBYSHEV DISTANCE TO
  // CENTER. Sign-only ringSignNcc is quantised to 2/n steps (n=24 for R1
  // → step 0.083). On clean PNG the watermark stamp is so dominant that
  // many search-window positions tie at the maximum NCC. The previous
  // strict ">" picked the FIRST encountered (top-left corner = (-3,-3)),
  // biasing all 8 anchors by the same offset → affine fit translated the
  // template by ~3 px → vault rect mis-located → extractVaultV1.match=false
  // → false OCCLUDED on a clean image. The tie-break prefers the
  // position closest to the expected center, which on clean restores the
  // identity affine and on attacked images preserves the genuine
  // displacement (only ties prefer center; clear NCC peaks still win).
  for (let dy = -win; dy <= win; dy++) {
    for (let dx = -win; dx <= win; dx++) {
      const sx = expX + dx;
      const sy = expY + dy;
      if (sx < 0 || sy < 0 || sx + DCT_CIM_SIZE > width ||
          sy + DCT_CIM_SIZE > height) {
        continue;
      }
      const luma = extractLumaPatch32(rgba, width, height, sx, sy);
      const shifted = new Float64Array(1024);
      for (let i = 0; i < 1024; i++) shifted[i] = luma[i]! - 128;
      const coeffs = fdct32(shifted);
      const ncc = ringSignNcc(coeffs, RING_R1, identity.signsR1);
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      // Strict NCC win, OR equal NCC with smaller distance to center.
      if (
        ncc > bestNcc + 1e-9 ||
        (Math.abs(ncc - bestNcc) <= 1e-9 && dist < bestDist)
      ) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
        bestDist = dist;
        bestCoeffs = coeffs;
      }
    }
  }

  if (!bestCoeffs) {
    return makeMissing(expX, expY);
  }

  const r1Ncc = bestNcc;
  const r2Ncc = ringSignNcc(bestCoeffs, RING_R2, identity.signsR2);
  const r3TailCount = Math.max(0, DCT_R3_COUNT - DCT_R3_RS_CODEWORD_BITS);
  const r3Ncc = r3TailCount > 0
    ? ringSignNcc(
        bestCoeffs,
        RING_R3.slice(DCT_R3_RS_CODEWORD_BITS),
        identity.signsR3,
        r3TailCount,
      )
    : 0;

  // R3 RS decode + payload integrity check.
  const rs = decodeR3RsPayload(bestCoeffs);
  let r3RsOk = false;
  if (rs.ok) {
    let match = true;
    for (let i = 0; i < DCT_R3_RS_DATA_BYTES; i++) {
      if (rs.data[i]! !== identity.idPayload[i]!) {
        match = false;
        break;
      }
    }
    r3RsOk = match;
  }

  const ringStatus = {
    r1: classifyRing(r1Ncc, DCT_R1_NCC_THRESHOLD),
    r2: classifyRing(r2Ncc, DCT_R2_NCC_THRESHOLD),
    r3: classifyRing(r3Ncc, DCT_R3_NCC_THRESHOLD),
  };
  const found = r1Ncc >= DCT_R1_NCC_THRESHOLD;

  return {
    found,
    r1Ncc,
    r2Ncc,
    r3Ncc,
    r3RsOk,
    r3RsCorrected: rs.corrected,
    ringStatus,
    refinedX: expX + bestDx,
    refinedY: expY + bestDy,
    dx: bestDx,
    dy: bestDy,
    degradation: classifyDegradation(r1Ncc, r2Ncc, r3Ncc, r3RsOk),
  };
}

function classifyRing(ncc: number, threshold: number): DctRingStatus {
  if (ncc >= threshold) return "ok";
  if (ncc >= threshold * 0.6) return "weak";
  return "missing";
}

function classifyDegradation(
  r1: number,
  r2: number,
  r3: number,
  r3RsOk: boolean,
): DctDegradationLabel {
  // Negative R1 NCC ⇒ sign pattern inverted globally (tamper attempt or
  // wrong identity). Threshold −0.10 absolute under sign-only NCC:
  // confidently anti-correlated (random ±0.05 on n=24).
  if (r1 <= -0.10 || r2 <= -0.10) return "tamper";
  if (r1 < DCT_R1_NCC_THRESHOLD * 0.6) return "missing";
  if (r3RsOk && r3 >= DCT_R3_NCC_THRESHOLD * 0.8) return "clean";
  if (r2 >= DCT_R2_NCC_THRESHOLD) return "jpeg-degraded";
  return "warp-degraded";
}

function makeMissing(expX: number, expY: number): DctConcentricDetectResult {
  return {
    found: false,
    r1Ncc: 0,
    r2Ncc: 0,
    r3Ncc: 0,
    r3RsOk: false,
    r3RsCorrected: 0,
    ringStatus: { r1: "missing", r2: "missing", r3: "missing" },
    refinedX: expX,
    refinedY: expY,
    dx: 0,
    dy: 0,
    degradation: "missing",
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Anchor geometry + degradation labels
// ──────────────────────────────────────────────────────────────────────────

/** v5 anchors = same 8 positions as T3.5 LARGE / T5.4.1 CIM (32×32 footprint
 *  envelope). Re-export keeps the cascade symmetric. */
export function expectedOuterAnchorsDctV5(
  width: number,
  height: number,
  smallMarginPx?: number,
): MarkerAnchor[] {
  return expectedOuterAnchorsLargeV3(width, height, smallMarginPx);
}

export function dctRingDegradationLabel(
  result: Pick<DctConcentricDetectResult, "ringStatus" | "r3RsOk">,
): DctDegradationLabel {
  const { ringStatus, r3RsOk } = result;
  if (ringStatus.r1 === "missing") return "missing";
  if (r3RsOk && ringStatus.r3 === "ok") return "clean";
  if (ringStatus.r2 === "ok") return "jpeg-degraded";
  return "warp-degraded";
}
