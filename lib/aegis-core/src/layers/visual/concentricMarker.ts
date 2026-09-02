/**
 * AEGIS Faz 5 Step 5.4.1 — Concentric Identity Markers (CIM)
 *
 * Hierarchical 32×32 fiducial: 3 nested rings + 8×8 identity core. Inspired
 * by QR finder patterns, but every ring carries domain-separated HMAC bits
 * so cross-tenant masquerade is impossible.
 *
 *  ┌──────────────────────────────────┐  rows/cols 0..3, 28..31
 *  │ R1 — outer SOLID ring (4 px wide)│  blur-immune, low-frequency
 *  │   ┌──────────────────────────┐   │
 *  │   │ R2 — DASHED ring (2 px)  │   │  rows/cols 6..7, 24..25
 *  │   │   ┌──────────────────┐   │   │  scale & medium-blur signature
 *  │   │   │ R3 — DOTTED (2 px)│  │   │  rows/cols 10..11, 20..21
 *  │   │   │   ┌──────────┐   │   │   │  high-frequency, blur-fragile
 *  │   │   │   │ ID CORE  │   │   │   │  rows/cols 12..19 (8×8 = 64 bits)
 *  │   │   │   │  8 × 8   │   │   │   │  HMAC bit pattern, primary identity
 *  │   │   │   └──────────┘   │   │   │
 *  │   │   └──────────────────┘   │   │
 *  │   └──────────────────────────┘   │
 *  └──────────────────────────────────┘
 *
 * KEY DESIGN PRINCIPLES
 * ─────────────────────
 *   • SAME 32×32 footprint as T3.5 LARGE (margin = SMALL + 24 px diagonally
 *     inward), so geometric placement contract is unchanged. Only stamp/
 *     detect *content* differs.
 *   • Ring-by-ring detect → degradation diagnostic. R1 surviving but R3
 *     missing ⇒ medium blur. R1 missing ⇒ heavy crop / occlusion.
 *   • Rotation invariance via 4-cardinal template precomputation
 *     (0/90/180/270°). No resampling needed — pure index transpose+flip.
 *     Best |NCC| across rotations selects orientation.
 *   • Identity by hierarchy: R1 sign (1 bit), R2 dash phase (2 bits),
 *     R3 dot phase (1 bit), ID core (64 bits). Together = 68-bit identity
 *     per (tenant, corner, cloakId).
 *   • Each ring uses an independent HMAC domain-separator. R1 alone gives
 *     50/50 odds against random; combined with full ID it's
 *     1 / 2^68 collision odds — strong enough that match decides identity
 *     even before vault region V1 gates.
 *
 * SHARP-FREE CONTRACT
 * ───────────────────
 * Pure pixel/byte arithmetic. Caller (route layer) handles sharp PNG
 * encode/decode. lib/aegis-core sharp dependency = forbidden.
 *
 * RED LINES (Step 5.4.1 KIRMIZI ÇİZGİLER)
 * ───────────────────────────────────────
 *   1. SMALL 16×16 marker logic (deriveMarkerMask, stampMarker,
 *      detectMarkerAt) UNCHANGED bit-for-bit.
 *   2. T3.5 LARGE 32×32 logic (deriveMarkerMaskLarge, stampMarkerLarge,
 *      detectMarkerAtLarge) UNCHANGED bit-for-bit.
 *   3. CIM is purely additive — v4 schema rows stamp SMALL + LARGE + CIM;
 *      v3 rows stamp SMALL + LARGE; v2/v1 rows stamp SMALL only.
 *   4. Detect cascade: Pass 0a CIM → Pass 0b LARGE (T3.5) → Pass 1+2+3
 *      SMALL chain. Maskeleme Kanunu: any pass failure → next pass.
 */

import { createHmac } from "node:crypto";
import {
  expectedOuterAnchorsLargeV3,
  type MarkerAnchor,
  type MarkerKey,
  type MarkerTier,
} from "./syncMarkers.js";

/**
 * CIM uses the SAME 8 anchor positions as T3.5 LARGE (margin = SMALL +
 * 24 px diagonally inward). This re-export keeps the v4 detect path
 * symmetric: anchor geometry is shared, only marker *content* differs.
 * Stamp order in `/cloak-image` is SMALL → LARGE → CIM, so CIM is applied
 * on top of LARGE at identical pixel coordinates — by design, since
 * both are 32×32 and rely on the same envelope.
 */
export function expectedOuterAnchorsCimV4(
  width: number,
  height: number,
  smallMarginPx?: number,
): MarkerAnchor[] {
  return expectedOuterAnchorsLargeV3(width, height, smallMarginPx);
}

/** CIM marker dimensions (same envelope as T3.5 LARGE). */
export const CIM_SIZE = 32;
export const CIM_PIXELS = CIM_SIZE * CIM_SIZE;

/** Ring layout — start (inclusive) / end (inclusive) indices for the OUTER
 *  edge of each ring. Pixel `p` belongs to ring R if its Chebyshev distance
 *  from the centre falls within the ring's [innerHalf, outerHalf] band. */
export const CIM_R1_OUTER_HALF = 16; // 32/2
export const CIM_R1_INNER_HALF = 12; // 4-px band
export const CIM_R2_OUTER_HALF = 10;
export const CIM_R2_INNER_HALF = 8;  // 2-px band
export const CIM_R3_OUTER_HALF = 6;
export const CIM_R3_INNER_HALF = 4;  // 2-px band

/** ID core occupies the central 8×8 block (Chebyshev half ≤ 4, half-open). */
export const CIM_ID_SIZE = 8;
export const CIM_ID_BITS = CIM_ID_SIZE * CIM_ID_SIZE;
export const CIM_ID_HALF = CIM_ID_SIZE / 2; // 4

/**
 * Per-ring stamp delta. R1 highest (blur-resilient priority), inner rings
 * progressively smaller to keep total perceptual change comparable to T3.5
 * LARGE. R1=±48 puts ring contrast above PDF text glyph noise floor (~80
 * std luma) far better than 16×16 SMALL ±24. ID core ±32 is a balance:
 * high enough to exceed JPEG Q35 mid-frequency noise, low enough to remain
 * invisible on clean PDF render.
 */
export const CIM_DELTA_R1 = 48;
export const CIM_DELTA_R2 = 32;
export const CIM_DELTA_R3 = 32;
export const CIM_DELTA_ID = 32;

/** Detect NCC threshold (per ring). R1 most permissive (low freq survives
 *  more), inner rings tighter. ID core uses Hamming distance, not NCC. */
// R1 score is luma-deviation normalised to DELTA_R1 (NOT NCC) — see
// `r1Ncc` computation in `detectCimAt`. Mild box blur attenuates the
// 4-px ring's mean luma deviation to ~0.40·DELTA_R1 (edges leak into
// gap reference); 0.35 keeps mild blur 'ok' while still rejecting
// gray-only noise (which scores ≪0.1).
export const CIM_NCC_THRESHOLD_R1 = 0.35;
export const CIM_NCC_THRESHOLD_R2 = 0.35;
export const CIM_NCC_THRESHOLD_R3 = 0.30;
export const CIM_ID_HAMMING_MAX = 16; // out of 64 bits

/** OUTER_SCHEME constant for CIM-augmented v4 rows is declared in
 *  `syncMarkers.ts` (single source of truth for OuterScheme union) and
 *  re-exported from this module's barrel. v4 row layout: SMALL (V2 anchors)
 *  + LARGE (T3.5 anchors) + CIM (same anchors as LARGE, different content). */

/** Cardinal rotation count — 4 templates at 0/90/180/270°. */
export const CIM_ROTATION_COUNT = 4;

/**
 * Per-pixel ring classification — used by template builder and by the
 * ring-isolation NCC variant (diagnostic). Returns "outside" for pixels
 * not in any defined band (i.e. inter-ring gaps).
 */
export type CimZone = "R1" | "R2" | "R3" | "ID" | "gap";

export function cimPixelZone(x: number, y: number): CimZone {
  // Chebyshev distance from the centre of the 32×32 marker. Centre is
  // between pixels 15 and 16 — we use min(|x − 15.5|, |y − 15.5|) ceiling
  // form via integer math: half = max(|x − 15|, |y − 15|) + 1 vs |x − 16|.
  // Simpler: compute symmetric "rim distance" rd = min(x, 31 − x, y, 31 − y).
  const rd = Math.min(x, CIM_SIZE - 1 - x, y, CIM_SIZE - 1 - y);
  if (rd < 4) return "R1";        // rd ∈ {0,1,2,3} → outermost 4-px band
  if (rd < 6) return "gap";       // rd ∈ {4,5}
  if (rd < 8) return "R2";        // rd ∈ {6,7}
  if (rd < 10) return "gap";      // rd ∈ {8,9}
  if (rd < 12) return "R3";       // rd ∈ {10,11}
  if (rd < 12 + 0) return "gap";  // (no extra gap; R3 ends at rd=11, ID starts at rd=12)
  return "ID";                    // rd ∈ {12..15} — central 8×8 block
}

/**
 * CIM identity per (tier, corner, cloakId). All four sub-fields are
 * domain-separated HMAC outputs, so cross-tenant or cross-corner attempts
 * to forge a CIM patch require the tenant master secret.
 */
export interface CimIdentity {
  /** R1 ring sign — 1 bit (HMAC byte 0, bit 0). +1 ⇒ ring brighter than
   *  background, −1 ⇒ darker. */
  r1Sign: 1 | -1;
  /** R2 dashed ring phase — 2 bits (HMAC byte 0, bits 1-2). 0..3.
   *  Determines the start offset of the on/off pattern around the ring. */
  r2Phase: 0 | 1 | 2 | 3;
  /** R3 dotted ring phase — 1 bit (HMAC byte 0, bit 3). 0 or 1. */
  r3Phase: 0 | 1;
  /** ID core 64-bit pattern (HMAC bytes 0..7 of the dedicated ID HMAC). */
  idBits: Uint8Array; // length = 64 (each element 0 or 1)
}

/**
 * Derive a CIM identity from a tenant master secret. Each sub-field uses an
 * independent HMAC label, so even if an attacker observes (or forges) one
 * ring they cannot infer the others.
 */
export function deriveCimIdentity(
  tenantMasterSecret: Buffer | Uint8Array,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId?: string,
): CimIdentity {
  const cloakPart = cloakId ? `|${cloakId}` : "";
  const macR1 = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-cim-r1-v1|${tier}|${corner}${cloakPart}`)
    .digest();
  const macR2 = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-cim-r2-v1|${tier}|${corner}${cloakPart}`)
    .digest();
  const macR3 = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-cim-r3-v1|${tier}|${corner}${cloakPart}`)
    .digest();
  const macId = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-cim-id-v1|${tier}|${corner}${cloakPart}`)
    .digest();

  const r1Sign: 1 | -1 = (macR1[0]! & 1) === 1 ? 1 : -1;
  const r2Phase = ((macR2[0]! >> 0) & 0b11) as 0 | 1 | 2 | 3;
  const r3Phase = ((macR3[0]! >> 0) & 0b1) as 0 | 1;

  const idBits = new Uint8Array(CIM_ID_BITS);
  for (let i = 0; i < CIM_ID_BITS; i++) {
    const byte = macId[i >> 3]!;
    idBits[i] = (byte >> (i & 7)) & 1;
  }

  return { r1Sign, r2Phase, r3Phase, idBits };
}

/**
 * Map a pixel inside an outer ring (R1/R2/R3) to its 1-D index along the
 * ring perimeter, walking clockwise starting from the top-left corner.
 * Used to apply dashed/dotted patterns in a rotation-invariant way: the
 * starting phase shifts with rotation, but we precompute all four
 * rotations explicitly (cheaper than runtime phase math).
 */
function ringPerimeterIndex(_zone: "R1" | "R2" | "R3", x: number, y: number): number {
  // Sub-ring layer index from the marker edge (rd = 0 ⇒ outermost row/col).
  // R1 spans rd ∈ {0..3} (4 layers), R2 spans rd ∈ {6..7} (2 layers), R3
  // spans rd ∈ {10..11} (2 layers). Each layer is its OWN perimeter loop;
  // we walk that loop clockwise starting from its top-left and use the
  // 1-D position for dash/dot phase math. This avoids any recursion and
  // makes the dashed/dotted pattern visually consistent across all
  // layers of a thick ring (good for R1's 4-px width).
  const rd = Math.min(x, CIM_SIZE - 1 - x, y, CIM_SIZE - 1 - y);
  const s = rd;
  const size = CIM_SIZE - 2 * rd;
  const e = s + size - 1;
  if (y === s) return x - s;                  // top edge L→R
  if (x === e) return size + (y - s);         // right edge T→B
  if (y === e) return 2 * size + (e - x);     // bottom edge R→L
  return 3 * size + (e - y);                  // left edge B→T (x === s)
}

/**
 * Build the signed-delta template for a CIM marker at rotation 0°.
 * Returns Int8Array length 1024. Each cell is in {−delta, 0, +delta}.
 *
 * @param identity Derived CIM identity (sign + phase bits + ID bits).
 * @param ringFilter If provided, only that ring's deltas are non-zero
 *                   (others = 0). Used by ring-isolation NCC for
 *                   diagnostics. When undefined, the full marker template
 *                   is built.
 */
export function buildCimTemplate(
  identity: CimIdentity,
  ringFilter?: "R1" | "R2" | "R3" | "ID",
): Int8Array {
  const tpl = new Int8Array(CIM_PIXELS);
  const { r1Sign, r2Phase, r3Phase, idBits } = identity;

  for (let y = 0; y < CIM_SIZE; y++) {
    for (let x = 0; x < CIM_SIZE; x++) {
      const zone = cimPixelZone(x, y);
      const i = y * CIM_SIZE + x;
      switch (zone) {
        case "R1": {
          if (ringFilter && ringFilter !== "R1") break;
          // Solid ring — every pixel signed by R1 sign bit.
          tpl[i] = r1Sign * CIM_DELTA_R1;
          break;
        }
        case "R2": {
          if (ringFilter && ringFilter !== "R2") break;
          // Dashed pattern: 2-on / 2-off cycle (period 4) along the
          // perimeter, with phase r2Phase.
          const idx = ringPerimeterIndex("R2", x, y);
          const onCycle = ((idx + r2Phase) & 0b11) < 2;
          tpl[i] = onCycle ? CIM_DELTA_R2 : 0;
          break;
        }
        case "R3": {
          if (ringFilter && ringFilter !== "R3") break;
          // Dotted pattern: 1-on / 1-off (period 2) with phase r3Phase.
          const idx = ringPerimeterIndex("R3", x, y);
          const onDot = ((idx + r3Phase) & 1) === 0;
          tpl[i] = onDot ? CIM_DELTA_R3 : 0;
          break;
        }
        case "ID": {
          if (ringFilter && ringFilter !== "ID") break;
          // ID core 8×8 — bit value drives sign directly.
          const ix = x - 12;
          const iy = y - 12;
          const bit = idBits[iy * CIM_ID_SIZE + ix]!;
          tpl[i] = (bit === 1 ? 1 : -1) * CIM_DELTA_ID;
          break;
        }
        case "gap":
        default:
          break;
      }
    }
  }
  return tpl;
}

/**
 * Produce the same template rotated by 90° clockwise (k times). Pure
 * index permutation — no interpolation, no quality loss. For k=0 returns
 * a copy of the input.
 */
export function rotateTemplate90(tpl: Int8Array, k: 0 | 1 | 2 | 3): Int8Array {
  if (k === 0) return tpl.slice();
  const out = new Int8Array(CIM_PIXELS);
  for (let y = 0; y < CIM_SIZE; y++) {
    for (let x = 0; x < CIM_SIZE; x++) {
      const v = tpl[y * CIM_SIZE + x]!;
      let nx: number;
      let ny: number;
      switch (k) {
        case 1: nx = CIM_SIZE - 1 - y; ny = x; break;          // 90° CW
        case 2: nx = CIM_SIZE - 1 - x; ny = CIM_SIZE - 1 - y; break; // 180°
        case 3: nx = y; ny = CIM_SIZE - 1 - x; break;          // 270° CW
      }
      out[ny * CIM_SIZE + nx] = v;
    }
  }
  return out;
}

/**
 * Stamp a single CIM marker in-place. Sign-adaptive luma direction (T3.5
 * fix preserved): if the local mean luma > 127 the entire stamp is
 * inverted to avoid white-background saturation. Detect uses |NCC| so
 * the global flip cancels.
 */
export function stampCim(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  identity: CimIdentity,
): void {
  const tpl = buildCimTemplate(identity);
  // Compute local mean luma over the marker footprint.
  let lumaSum = 0;
  let pxCount = 0;
  for (let my = 0; my < CIM_SIZE; my++) {
    for (let mx = 0; mx < CIM_SIZE; mx++) {
      const px = x + mx;
      const py = y + my;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = (py * width + px) * 4;
      lumaSum += rgba[idx]! * 0.299 + rgba[idx + 1]! * 0.587 + rgba[idx + 2]! * 0.114;
      pxCount++;
    }
  }
  if (pxCount === 0) return;
  const meanLuma = lumaSum / pxCount;
  const flip = meanLuma > 127 ? -1 : 1;

  for (let my = 0; my < CIM_SIZE; my++) {
    for (let mx = 0; mx < CIM_SIZE; mx++) {
      const v = tpl[my * CIM_SIZE + mx]!;
      if (v === 0) continue;
      const px = x + mx;
      const py = y + my;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const d = flip * v;
      const idx = (py * width + px) * 4;
      rgba[idx]     = Math.max(0, Math.min(255, rgba[idx]!     + d));
      rgba[idx + 1] = Math.max(0, Math.min(255, rgba[idx + 1]! + d));
      rgba[idx + 2] = Math.max(0, Math.min(255, rgba[idx + 2]! + d));
    }
  }
}

/**
 * Pre-computed pixel-index list per zone, evaluated lazily on first use.
 * Used by `patchTemplateNccZone` to restrict NCC over a single ring's
 * footprint — this is critical for ring-isolated diagnostic NCC because
 * the patch contains non-zero stamp content OUTSIDE the ring (R1, ID,
 * etc.) while the ring-filtered template is zero outside; computing NCC
 * across the full 1024-cell array would force NCC < 1 even on clean
 * roundtrips (patch and template are not linearly related globally).
 */
let _zoneIndices: Record<"R1" | "R2" | "R3" | "ID", Uint16Array> | null = null;
function getZoneIndices(): Record<"R1" | "R2" | "R3" | "ID", Uint16Array> {
  if (_zoneIndices) return _zoneIndices;
  const tmp: Record<"R1" | "R2" | "R3" | "ID", number[]> = { R1: [], R2: [], R3: [], ID: [] };
  for (let y = 0; y < CIM_SIZE; y++) {
    for (let x = 0; x < CIM_SIZE; x++) {
      const z = cimPixelZone(x, y);
      if (z !== "gap") tmp[z].push(y * CIM_SIZE + x);
    }
  }
  _zoneIndices = {
    R1: Uint16Array.from(tmp.R1),
    R2: Uint16Array.from(tmp.R2),
    R3: Uint16Array.from(tmp.R3),
    ID: Uint16Array.from(tmp.ID),
  };
  return _zoneIndices;
}

/**
 * Zone-restricted |NCC|: same maths as `patchTemplateNcc` but evaluated
 * only over pixels classified as `zone`. Used for per-ring diagnostic
 * scores so a clean stamp produces ring NCC ≈ 1.0 (not 0.4-ish, which
 * is what a full-1024-cell NCC would give for ring-filtered templates).
 */
function patchTemplateNccZone(
  patch: Float64Array,
  tpl: Int8Array,
  zone: "R1" | "R2" | "R3" | "ID",
): number {
  const idx = getZoneIndices()[zone];
  const n = idx.length;
  if (n === 0) return 0;
  let pSum = 0, tSum = 0;
  for (let k = 0; k < n; k++) {
    const i = idx[k]!;
    pSum += patch[i]!;
    tSum += tpl[i]!;
  }
  const pMean = pSum / n;
  const tMean = tSum / n;
  let cov = 0, pVar = 0, tVar = 0;
  for (let k = 0; k < n; k++) {
    const i = idx[k]!;
    const pd = patch[i]! - pMean;
    const td = tpl[i]! - tMean;
    cov += pd * td;
    pVar += pd * pd;
    tVar += td * td;
  }
  const denom = Math.sqrt(pVar) * Math.sqrt(tVar);
  if (denom < 1e-9) return 0;
  return Math.abs(cov / denom);
}

/**
 * Compute |NCC| of a 32×32 luma patch against an Int8 template. Both
 * arrays are mean-centred internally. Sign-invariant (returns absolute
 * value) so the flip done by `stampCim` does not matter for matching.
 */
function patchTemplateNcc(patch: Float64Array, tpl: Int8Array): number {
  // Patch stats.
  let pSum = 0;
  for (let i = 0; i < CIM_PIXELS; i++) pSum += patch[i]!;
  const pMean = pSum / CIM_PIXELS;
  // Template stats (only non-zero cells contribute, but we mean-centre
  // over the full 1024 cells for consistency with patch).
  let tSum = 0;
  for (let i = 0; i < CIM_PIXELS; i++) tSum += tpl[i]!;
  const tMean = tSum / CIM_PIXELS;

  let cov = 0;
  let pVar = 0;
  let tVar = 0;
  for (let i = 0; i < CIM_PIXELS; i++) {
    const pd = patch[i]! - pMean;
    const td = tpl[i]! - tMean;
    cov += pd * td;
    pVar += pd * pd;
    tVar += td * td;
  }
  const denom = Math.sqrt(pVar) * Math.sqrt(tVar);
  if (denom < 1e-9) return 0;
  return Math.abs(cov / denom);
}

/**
 * Per-ring (and per-rotation) detect status. Used both as the detect
 * return value and as the per-marker entry in the diagnostic profile.
 */
export interface CimRingStatus {
  /** Best |NCC| of patch vs full-marker template at the chosen rotation. */
  fullNcc: number;
  /** Per-ring |NCC| (template restricted to one ring). */
  r1Ncc: number;
  r2Ncc: number;
  r3Ncc: number;
  /** ID core Hamming distance — 0..64. */
  idHamming: number;
  /** Boolean ring-survival flags. */
  r1Ok: boolean;
  r2Ok: boolean;
  r3Ok: boolean;
  idOk: boolean;
  /** Best rotation (0/1/2/3 = 0°/90°/180°/270° CW). */
  bestRotationK: 0 | 1 | 2 | 3;
}

export type CimDegradation =
  | "clean"        // R1+R2+R3+ID all OK
  | "medium-blur"  // R1+R2 OK, R3 fails
  | "heavy-blur"   // only R1 OK
  | "tamper"       // R1+R2 OK but ID Hamming high
  | "missing";     // R1 fails entirely

export function cimDegradationLabel(rs: CimRingStatus): CimDegradation {
  if (!rs.r1Ok) return "missing";
  if (rs.r1Ok && rs.r2Ok && !rs.idOk) return "tamper";
  if (rs.r1Ok && rs.r2Ok && rs.r3Ok && rs.idOk) return "clean";
  if (rs.r1Ok && rs.r2Ok && !rs.r3Ok) return "medium-blur";
  return "heavy-blur";
}

export interface CimDetectResult {
  found: boolean;
  detectedX: number;
  detectedY: number;
  dx: number;
  dy: number;
  status: CimRingStatus;
  degradation: CimDegradation;
}

export interface CimDetectOptions {
  searchWindow?: number;
  /** When false, skips the inner-ring (R2/R3/ID) checks and only confirms
   *  R1. Used as a fast-path screen before committing to per-ring NCC. */
  hierarchical?: boolean;
}

/**
 * Detect a CIM marker at the expected anchor, scanning ±searchWindow and
 * trying all 4 cardinal rotations. Returns the best-NCC location and a
 * full ring-by-ring diagnostic (R1/R2/R3 NCC + ID Hamming).
 *
 * Performance: O((2W+1)² × CIM_ROTATION_COUNT × CIM_PIXELS) ≈ 17² × 4 × 1024
 *              ≈ 1.2 M ops per anchor. 8 anchors → ≈ 10 M ops ≈ 60 ms in
 * pure JS, sharp-free.
 */
export function detectCimAt(
  rgba: Uint8Array,
  width: number,
  height: number,
  expectedX: number,
  expectedY: number,
  identity: CimIdentity,
  opts: CimDetectOptions = {},
): CimDetectResult {
  const searchWindow = opts.searchWindow ?? 8;
  const hierarchical = opts.hierarchical ?? true;

  // Precompute 4 rotated templates (full + per-ring).
  const tplFull0 = buildCimTemplate(identity);
  const tplFull: Int8Array[] = [
    tplFull0,
    rotateTemplate90(tplFull0, 1),
    rotateTemplate90(tplFull0, 2),
    rotateTemplate90(tplFull0, 3),
  ];

  const tplR1_0 = buildCimTemplate(identity, "R1");
  const tplR2_0 = buildCimTemplate(identity, "R2");
  const tplR3_0 = buildCimTemplate(identity, "R3");
  const tplId_0 = buildCimTemplate(identity, "ID");
  const tplR1: Int8Array[] = [tplR1_0, rotateTemplate90(tplR1_0, 1), rotateTemplate90(tplR1_0, 2), rotateTemplate90(tplR1_0, 3)];
  const tplR2: Int8Array[] = [tplR2_0, rotateTemplate90(tplR2_0, 1), rotateTemplate90(tplR2_0, 2), rotateTemplate90(tplR2_0, 3)];
  const tplR3: Int8Array[] = [tplR3_0, rotateTemplate90(tplR3_0, 1), rotateTemplate90(tplR3_0, 2), rotateTemplate90(tplR3_0, 3)];
  const tplId: Int8Array[] = [tplId_0, rotateTemplate90(tplId_0, 1), rotateTemplate90(tplId_0, 2), rotateTemplate90(tplId_0, 3)];

  let bestNcc = -1;
  let bestDx = 0;
  let bestDy = 0;
  let bestK: 0 | 1 | 2 | 3 = 0;
  const patch = new Float64Array(CIM_PIXELS);

  // Two-stage rotation selection — fixes a fundamental scoring bias of the
  // hierarchical CIM design:
  //
  //   The R1 outer ring is a 448-pixel ±DELTA_R1 (=48) signed annulus
  //   whose *shape* is rotation-symmetric (rotating an annulus 90° gives
  //   another annulus). It contributes 448·48² = 1,032,192 to template
  //   energy, vs only 64·32² = 65,536 from the ID core (16× weight
  //   ratio). When matching a clean CIM patch the R1 component pins
  //   |NCC| ≈ 1.0 across ALL 4 cardinal rotations, leaving the rotation
  //   pick effectively undetermined (numerical-tie roulette).
  //
  // Stage 1 (position): pick (dx,dy) by best full-template |NCC| —
  //   geometric registration uses the full marker because R1 gives
  //   robust spatial peak.
  // Stage 2 (rotation): at the chosen position, pick `k` by best
  //   *ID-core only* |NCC|. The ID core's HMAC bit pattern is the only
  //   sub-component that genuinely encodes orientation (rings R1/R2/R3
  //   are 4-fold rotationally symmetric in their shape contribution
  //   even though phase bits differ).
  for (let dy = -searchWindow; dy <= searchWindow; dy++) {
    for (let dx = -searchWindow; dx <= searchWindow; dx++) {
      const x0 = expectedX + dx;
      const y0 = expectedY + dy;
      if (x0 < 0 || y0 < 0 || x0 + CIM_SIZE > width || y0 + CIM_SIZE > height) continue;

      // Extract luma patch once for this position.
      for (let py = 0; py < CIM_SIZE; py++) {
        const rowOff = ((y0 + py) * width + x0) * 4;
        for (let px = 0; px < CIM_SIZE; px++) {
          const i = rowOff + px * 4;
          patch[py * CIM_SIZE + px] =
            rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
        }
      }
      // Stage 1 — position search using rotation 0 of the full template
      // (R1 dominates so all 4 k's give nearly identical |NCC|; using
      // k=0 is equivalent in the position dimension).
      const ncc = patchTemplateNcc(patch, tplFull[0]!);
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  // Stage 2 — at the chosen position, pick rotation by ID-core only |NCC|.
  {
    const x0 = expectedX + bestDx;
    const y0 = expectedY + bestDy;
    if (x0 >= 0 && y0 >= 0 && x0 + CIM_SIZE <= width && y0 + CIM_SIZE <= height) {
      for (let py = 0; py < CIM_SIZE; py++) {
        const rowOff = ((y0 + py) * width + x0) * 4;
        for (let px = 0; px < CIM_SIZE; px++) {
          const i = rowOff + px * 4;
          patch[py * CIM_SIZE + px] =
            rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
        }
      }
      let bestIdNcc = -1;
      for (let k = 0; k < CIM_ROTATION_COUNT; k++) {
        const idNcc = patchTemplateNcc(patch, tplId[k]!);
        if (idNcc > bestIdNcc) {
          bestIdNcc = idNcc;
          bestK = k as 0 | 1 | 2 | 3;
        }
      }
      // Refresh bestNcc to reflect the chosen rotation's full match
      // (used by the diagnostic field `fullNcc` in the result).
      bestNcc = patchTemplateNcc(patch, tplFull[bestK]!);
    }
  }

  // Re-extract patch at the best position for ring-by-ring measurements.
  const x0 = expectedX + bestDx;
  const y0 = expectedY + bestDy;
  let r1Ncc = 0;
  let r2Ncc = 0;
  let r3Ncc = 0;
  let idHamming = CIM_ID_BITS; // worst case if patch out of bounds
  if (x0 >= 0 && y0 >= 0 && x0 + CIM_SIZE <= width && y0 + CIM_SIZE <= height) {
    for (let py = 0; py < CIM_SIZE; py++) {
      const rowOff = ((y0 + py) * width + x0) * 4;
      for (let px = 0; px < CIM_SIZE; px++) {
        const i = rowOff + px * 4;
        patch[py * CIM_SIZE + px] =
          rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
      }
    }
    if (hierarchical) {
      // R1 ring is a UNIFORM signed annulus (all 448 pixels at +DELTA_R1
      // or all at −DELTA_R1, depending on r1Sign). Zone-restricted NCC
      // is undefined here because intra-zone variance = 0 → NCC denom = 0.
      // Instead we use a luma-deviation presence test: |mean(R1 zone) −
      // mean(gap reference zone)| should be ≈ DELTA_R1 for a clean stamp.
      // Score is normalised against DELTA_R1 and clipped to [0, 1] so it
      // shares the same threshold semantics (≥ 0.5) as ring NCC scores.
      const idxR1 = getZoneIndices().R1;
      let r1Sum = 0;
      for (let k = 0; k < idxR1.length; k++) r1Sum += patch[idxR1[k]!]!;
      const r1Mean = r1Sum / idxR1.length;
      // Gap reference: row/col index 4 lies between R1 and R2; pure gap
      // (untouched by stamp). Sample the 4 corner intersections of that
      // gap inset to get a neutral background reference inside the
      // marker footprint (so it tracks local image luma, not 128).
      const gapPositions = [
        4 * CIM_SIZE + 4, 4 * CIM_SIZE + 27,
        27 * CIM_SIZE + 4, 27 * CIM_SIZE + 27,
        4 * CIM_SIZE + 15, 27 * CIM_SIZE + 15,
        15 * CIM_SIZE + 4, 15 * CIM_SIZE + 27,
      ];
      let gapSum = 0;
      for (const i of gapPositions) gapSum += patch[i]!;
      const gapMean = gapSum / gapPositions.length;
      r1Ncc = Math.min(1.0, Math.abs(r1Mean - gapMean) / CIM_DELTA_R1);

      // R2 dashed + R3 dotted + ID HMAC bits all have intra-zone
      // variance (sign-alternating patterns) → zone-restricted NCC is
      // well-defined and equals 1.0 on clean roundtrip.
      r2Ncc = patchTemplateNccZone(patch, tplR2[bestK]!, "R2");
      r3Ncc = patchTemplateNccZone(patch, tplR3[bestK]!, "R3");

      // ID Hamming: per pixel of ID core, compare patch sign (relative to
      // patch mean within the ID block) to template sign. Sign-invariant
      // by re-aligning to template polarity using full-marker NCC sign.
      idHamming = computeIdHamming(patch, tplId[bestK]!);
    }
  }

  const r1Ok = r1Ncc >= CIM_NCC_THRESHOLD_R1;
  const r2Ok = r2Ncc >= CIM_NCC_THRESHOLD_R2;
  const r3Ok = r3Ncc >= CIM_NCC_THRESHOLD_R3;
  const idOk = idHamming <= CIM_ID_HAMMING_MAX;

  const status: CimRingStatus = {
    fullNcc: bestNcc,
    r1Ncc, r2Ncc, r3Ncc, idHamming,
    r1Ok, r2Ok, r3Ok, idOk,
    bestRotationK: bestK,
  };
  const degradation = cimDegradationLabel(status);
  return {
    found: r1Ok, // R1 is the minimum bar — drives marker-survival count.
    detectedX: x0,
    detectedY: y0,
    dx: bestDx,
    dy: bestDy,
    status,
    degradation,
  };
}

/**
 * Compare ID-core 8×8 region of the patch (re-located after best rotation
 * was applied to the template, NOT to the patch) against the template ID
 * bits. Sign-invariant: we compute patch mean over the ID footprint and
 * derive each pixel's sign relative to that mean; template sign comes
 * directly from the Int8 value. Mismatches are counted as Hamming bits.
 *
 * Because we rotated the TEMPLATE not the patch, ID bits in the rotated
 * template line up with ID bits in the patch's central 8×8 block — no
 * extra coordinate translation needed.
 */
function computeIdHamming(patch: Float64Array, tplIdRotated: Int8Array): number {
  // ID core bbox in marker coords: [12..19, 12..19].
  const x0 = 12, y0 = 12;
  // Patch ID mean (only over ID block).
  let sum = 0;
  for (let dy = 0; dy < CIM_ID_SIZE; dy++) {
    for (let dx = 0; dx < CIM_ID_SIZE; dx++) {
      sum += patch[(y0 + dy) * CIM_SIZE + (x0 + dx)]!;
    }
  }
  const mean = sum / CIM_ID_BITS;

  // Determine global sign-flip: dot-product of (patch - mean) with template
  // sign. If negative, patch was inverted (white background) — flip our
  // patch-sign interpretation.
  let dot = 0;
  for (let dy = 0; dy < CIM_ID_SIZE; dy++) {
    for (let dx = 0; dx < CIM_ID_SIZE; dx++) {
      const i = (y0 + dy) * CIM_SIZE + (x0 + dx);
      const tplVal = tplIdRotated[i]!;
      if (tplVal === 0) continue;
      dot += (patch[i]! - mean) * Math.sign(tplVal);
    }
  }
  const polarity = dot >= 0 ? 1 : -1;

  let hamming = 0;
  for (let dy = 0; dy < CIM_ID_SIZE; dy++) {
    for (let dx = 0; dx < CIM_ID_SIZE; dx++) {
      const i = (y0 + dy) * CIM_SIZE + (x0 + dx);
      const tplVal = tplIdRotated[i]!;
      if (tplVal === 0) continue;
      const tplSign = Math.sign(tplVal);
      const patchSign = (patch[i]! - mean) >= 0 ? 1 : -1;
      const matches = (patchSign * polarity) === tplSign;
      if (!matches) hamming++;
    }
  }
  return hamming;
}

/**
 * Aggregate diagnostic profile across all detected CIM anchors. Caller
 * (route layer) emits this as part of `/analyze-image` response so the
 * client can reason about *why* a marker chain failed (heavy crop vs
 * heavy blur vs forgery attempt).
 */
export interface CimDegradationProfile {
  clean: number;
  mediumBlur: number;
  heavyBlur: number;
  tamper: number;
  missing: number;
}

export function buildCimDegradationProfile(
  results: ReadonlyArray<CimDetectResult>,
): CimDegradationProfile {
  const p: CimDegradationProfile = {
    clean: 0, mediumBlur: 0, heavyBlur: 0, tamper: 0, missing: 0,
  };
  for (const r of results) {
    switch (r.degradation) {
      case "clean": p.clean++; break;
      case "medium-blur": p.mediumBlur++; break;
      case "heavy-blur": p.heavyBlur++; break;
      case "tamper": p.tamper++; break;
      case "missing": p.missing++; break;
    }
  }
  return p;
}
