/**
 * AEGIS T007.9 — BUKALEMUN PROTOCOL — Channel A × Channel B Cross-Check
 *
 * Decisive remains Channel A (cloak_id vault DB lookup over deriveCloakId).
 * Channel B (visual tripleShield) is its WITNESS, not its replacement.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ Channel A (text vault):   cloakId40 → HKDF → id16_A (16-bit)   │
 *   │ Channel B (visual):       tripleShield decode → id16_B (16-bit)│
 *   │ Cross-check:              Hamming(id16_A, id16_B) ≤ K          │
 *   │   K=2 ⇒ P(falseMatch) ≈ C(16,0..2)/2^16 ≈ 0.0021 (acceptable)  │
 *   │   K=8 ⇒ P(falseMatch) ≈ 0.6              (FORBIDDEN)           │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Result modes:
 *   "exact"  — Hamming = 0
 *   "close"  — 0 < Hamming ≤ K (oracle-corroborated, NOT decisive on its own)
 *   "reject" — Hamming > K
 *
 * SHARP-FREE: pure byte arithmetic; lib aegis-core convention preserved.
 */

import { createHmac } from "node:crypto";

export const CROSS_CHECK_HKDF_LABEL = "aegis-t007-bukalemun-id16-v1";
export const CROSS_CHECK_DEFAULT_K = 2;
export const CROSS_CHECK_ID16_BYTES = 2;

/** Project a Channel A `cloakIdHex` (24-hex = 12 bytes) onto a 16-bit
 *  oracle ID, sharing the SAME HKDF namespace as Channel B's stamper-side
 *  `idData` derivation. Pure function. */
export function deriveChannelAId16(
  secret: Buffer | Uint8Array,
  cloakIdHex: string,
): Uint8Array {
  const mac = createHmac("sha256", Buffer.from(secret))
    .update(`${CROSS_CHECK_HKDF_LABEL}|${cloakIdHex}`)
    .digest();
  return new Uint8Array(mac.subarray(0, CROSS_CHECK_ID16_BYTES));
}

export type CrossCheckMode = "exact" | "close" | "reject";

export interface CrossCheckResult {
  /** True iff Hamming distance ≤ K. Oracle-corroborated; NOT decisive alone. */
  match: boolean;
  /** Bit-level Hamming distance over 16 bits (0..16). */
  distance: number;
  mode: CrossCheckMode;
  /** Threshold used (echoed for audit). */
  k: number;
}

function hammingBits16(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== CROSS_CHECK_ID16_BYTES || b.length !== CROSS_CHECK_ID16_BYTES) {
    throw new Error(
      `crossCheck: id16 must be ${CROSS_CHECK_ID16_BYTES} bytes (got ${a.length},${b.length})`,
    );
  }
  let d = 0;
  for (let i = 0; i < CROSS_CHECK_ID16_BYTES; i++) {
    let v = (a[i]! ^ b[i]!) & 0xff;
    while (v) {
      d += v & 1;
      v >>>= 1;
    }
  }
  return d;
}

/** Compare Channel A oracle id16 against Channel B decoded id16. K=2 default. */
export function crossCheckChannels(
  channelA_id16: Uint8Array,
  channelB_id16: Uint8Array,
  k: number = CROSS_CHECK_DEFAULT_K,
): CrossCheckResult {
  if (k < 0 || k > 16) {
    throw new Error(`crossCheck: K must be in [0,16] (got ${k})`);
  }
  const distance = hammingBits16(channelA_id16, channelB_id16);
  const mode: CrossCheckMode =
    distance === 0 ? "exact" : distance <= k ? "close" : "reject";
  return { match: distance <= k, distance, mode, k };
}

// ──────────────────────────────────────────────────────────────────────────
// Content-Aware Dispatcher (Bukalemun selector)
// ──────────────────────────────────────────────────────────────────────────

export type ChannelPriority = "channelA-first" | "channelB-first" | "balanced";

export interface SubstrateMetrics {
  /** 0..1: fraction of pixels classified as text content. */
  textRatio: number;
  /** 0..1: fraction of pixels classified as image/graphic content. */
  imageRatio: number;
}

export interface DispatcherOptions {
  /** Threshold above which a single channel dominates. Default 0.6. */
  dominantThreshold?: number;
}

/** Decide channel priority by substrate composition. Pure function — no IO.
 *
 *   text-heavy   (textRatio  ≥ θ) ⇒ "channelA-first"  (linguistic DNA + vault)
 *   image-heavy  (imageRatio ≥ θ) ⇒ "channelB-first"  (visual tripleShield)
 *   else                          ⇒ "balanced"
 *
 * Channel A remains decisive in ALL modes — priority only orders the
 * lookup pipeline (which channel runs first, which acts as oracle).
 */
export function selectChannelPriority(
  metrics: SubstrateMetrics,
  options: DispatcherOptions = {},
): ChannelPriority {
  const theta = options.dominantThreshold ?? 0.6;
  if (theta < 0 || theta > 1) {
    throw new Error(`dispatcher: dominantThreshold must be in [0,1] (got ${theta})`);
  }
  const t = clamp01(metrics.textRatio);
  const i = clamp01(metrics.imageRatio);
  if (t >= theta && t > i) return "channelA-first";
  if (i >= theta && i > t) return "channelB-first";
  return "balanced";
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
