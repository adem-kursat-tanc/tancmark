/**
 * Faz 5 Step 5.3 — Nested Sync Markers (L-shape fiducials, HMAC tenant-specific)
 *
 * Tasarım kararı (architect onaylı sapma): Spec'te "her marker'da ML-DSA-65 PQC
 * imza" istense de 16×16 piksel patern fiziksel olarak 3309-byte sig taşıyamaz
 * (~256 bit kapasite). Çözüm:
 *   - Marker PATERNi tenant-specific HMAC-SHA256 hash'inden türetilir
 *     (256 bit → 16×16 binary mask). Saldırgan tenant secret'ı bilmeden
 *     marker'ı "sahte" olarak yeniden üretemez (NCC eşleşmez).
 *   - Gerçek PQC garantisi vault region V2'de korunur (mevcut vault_anchors
 *     ML-DSA-65 sig + DB lookup).
 *
 * Outer (4) ve Inner (4) marker'lar farklı `tier` ile farklı pattern üretir
 * → izolasyon. Pragmatik kapsam (Step 5.3): marker'lar BEKLENEN pozisyonun
 * ±searchWindow yakınında aranır. Tam-CV (full-image scan + Hough deskew)
 * Step 5.4'e bırakıldı.
 */

import { createHmac } from "node:crypto";

export type MarkerCorner = "NW" | "NE" | "SW" | "SE";
/**
 * Faz 5 Step 5.4 T1 — edge-midpoint outer marker positions. Adds 4 anchors
 * (top/right/bottom/left mid) on top of the 4 corners. `MarkerKey` is the
 * union used for `outer` tier in the v2-8marker scheme; inner tier remains
 * `MarkerCorner` (vault rect corners only). HMAC mask domain-separator
 * already keys on (tier, corner|edge), so adding "N"|"E"|"S"|"W" produces
 * 4 fresh, statistically-independent masks (verified by pairwise Hamming
 * smoke in T1 acceptance).
 */
export type EdgeMid = "N" | "E" | "S" | "W";
export type MarkerKey = MarkerCorner | EdgeMid;
export type MarkerTier = "outer" | "inner";

/**
 * Outer marker geometric scheme. v1-4marker = legacy 4 corners (Step 5.3).
 * v2-8marker = 4 corners + 4 edge midpoints (Step 5.4). Persisted in
 * `vault_metadata.markers.outerScheme`; detect path defaults to v1-4marker
 * when the field is absent (backward compat for ≤Step 5.3 rows).
 */
export const OUTER_SCHEME_V1 = "v1-4marker" as const;
export const OUTER_SCHEME_V2 = "v2-8marker" as const;
/**
 * Faz 5 Step 5.4 T3.5 — multi-scale scheme. SAME 8-anchor geometry as v2,
 * PLUS an additional 8 LARGE (32×32) markers at a diagonally-inward offset.
 * Detect path tries LARGE first (bilinear-blur resilient via 2×2 bit
 * replication, KEY insight: rotate+5° single-bilinear preserves NCC ≥ 0.4
 * within 2-px-cell interiors), falls back to v2 SMALL chain on miss.
 *
 * Backward compat: v1/v2 rows continue to use v1/v2 detect path; v3 rows
 * gain Pass 0 (LARGE) before the existing v2 chain. SMALL markers in v3
 * rows are stamped IDENTICALLY to v2 (positions, masks, contrast unchanged).
 */
export const OUTER_SCHEME_V3 = "v3-8marker-multiscale" as const;
/**
 * Faz 5 Step 5.4.1 — Concentric Identity Marker (CIM) augmented scheme.
 * v4 row layout: SMALL 16×16 (V2 anchors, bit-for-bit) + LARGE 32×32
 * (T3.5 anchors + masks, bit-for-bit) + CIM 32×32 at the SAME anchors as
 * LARGE but with hierarchical 3-ring + 8×8 ID-core content. Detect cascade:
 * Pass 0a CIM → Pass 0b LARGE → Pass 1+2+3 SMALL chain. CIM logic lives in
 * `concentricMarker.ts`; the constant lives here so `OuterScheme` stays
 * the single source of truth (avoids circular dependency).
 */
export const OUTER_SCHEME_V4 = "v4-8marker-cim" as const;
/**
 * Faz 5 Step 5.5 — DCT-Concentric Marker (Frequency Armor + Inner Fortress)
 * augmented scheme. v5 row layout: SMALL 16×16 (V2 anchors, bit-for-bit) +
 * LARGE 32×32 (T3.5 anchors, bit-for-bit) + CIM 32×32 (T5.4.1 anchors,
 * bit-for-bit) + DCT-Concentric 32×32 at the SAME anchors as LARGE/CIM but
 * with hierarchical 3-ring DCT-II spread-spectrum content + RS-protected
 * R3 ID payload. Detect cascade: Pass 0a-DCT → Pass 0a-CIM → Pass 0b-LARGE
 * → Pass 1+2+3 SMALL chain. DCT logic lives in `dctConcentricMarker.ts`;
 * the constant lives here so `OuterScheme` stays the single source of
 * truth (avoids circular dependency).
 */
export const OUTER_SCHEME_V5 = "v5-8marker-dct-cim" as const;
export type OuterScheme =
  | typeof OUTER_SCHEME_V1
  | typeof OUTER_SCHEME_V2
  | typeof OUTER_SCHEME_V3
  | typeof OUTER_SCHEME_V4
  | typeof OUTER_SCHEME_V5;

export const MARKER_SIZE = 16;
export const MARKER_PIXELS = MARKER_SIZE * MARKER_SIZE;

/**
 * Faz 5 Step 5.4 T3.5 — bilinear-resilient LARGE marker scale.
 *
 * 32×32 pixel mask = 256 unique HMAC bits replicated into 2×2 pixel cells.
 * Why 2× scale: a single bilinear (e.g. attacker `sharp.rotate(+5°)`)
 * mixes a destination pixel from a 2×2 source neighborhood. With 16×16
 * markers (1 bit per pixel) every neighborhood crosses bit boundaries
 * ⇒ NCC peak collapses ~0.7 → ~0.20-0.35 (T3 empirical floor). With
 * 32×32 markers (1 logical bit replicated to 2×2 pixels), the 2×2
 * bilinear neighborhood usually stays WITHIN a single bit cell ⇒ ~50%
 * of pixels carry the correct bit verbatim ⇒ NCC peak holds ≥ 0.5.
 * The remaining ~50% are at cell boundaries and contribute noise on
 * the order of bit-balanced average — harmless.
 *
 * Margin/placement: large markers sit at `smallMargin + MARKER_SIZE + 8`
 * inward from each edge so they NEVER overlap with the existing 16×16
 * small markers (which retain their exact v2 positions). This keeps the
 * Step 5.4 T1+T2+T3 stamp/detect contract bit-for-bit identical for v3
 * rows when the LARGE path falls back.
 */
export const MARKER_SIZE_LARGE = 32;
export const MARKER_PIXELS_LARGE = MARKER_SIZE_LARGE * MARKER_SIZE_LARGE;
export const MARKER_LARGE_BIT_REPLICATION = 2;
/** Inset of LARGE marker top-left corner from SMALL marker top-left corner,
 *  diagonally toward image interior. Equals SMALL marker size + safety gap.
 *  At smallMargin=32 (STEP53_OUTER_MARKER_MARGIN), large margin = 32+16+8=56. */
export const MARKER_LARGE_INSET = MARKER_SIZE + 8;

/** Stamp anında uygulanan luma artışı. ±24, telefon kamerası + JPEG Q35
 *  altında ayakta kalan en küçük güvenli değer (clean PNG'de görünmez). */
export const MARKER_CONTRAST_DELTA = 24;

/** Marker hit eşiği. NCC -1..1 arası, 0.40 = clean roundtrip ≈ 0.95,
 *  JPEG Q35 + küçük rotate ≈ 0.50. Daha yüksek eşik false negative,
 *  daha düşük cross-tenant noise riski. */
export const MARKER_NCC_THRESHOLD = 0.4;

export interface MarkerAnchor {
  /** v1 anchors only ever produce MarkerCorner values; v2 may produce
   *  MarkerCorner | EdgeMid. Widened to MarkerKey so both schemes share
   *  the same type. */
  corner: MarkerKey;
  x: number;
  y: number;
}

export interface MarkerHit {
  corner: MarkerKey;
  tier: MarkerTier;
  found: boolean;
  ncc: number;
  detectedX: number;
  detectedY: number;
  expectedX: number;
  expectedY: number;
  dx: number;
  dy: number;
}

/**
 * Tenant-specific 16×16 binary mask. HMAC-SHA256 256-bit → bit-per-pixel.
 * Tier ve corner ayrı pattern üretir → 8 marker birbirinden tamamen farklı.
 *
 * `cloakId` opsiyonel domain-separator (architect önerisi): verildiğinde
 * her cloak için pattern UNIQUE olur → tenant-içi sabit-pattern öğrenme
 * riski kapanır. Caller route layer'ı her cloak için cloakId bilir; analyze
 * tarafı candidateCloakIds üzerinden iterasyon yapar (vault digest fallback
 * akışıyla aynı pattern). cloakId yoksa eski tenant-only davranış (geriye
 * dönük uyumluluk için).
 */
export function deriveMarkerMask(
  tenantMasterSecret: Buffer | Uint8Array,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId?: string,
): Uint8Array {
  const cloakPart = cloakId ? `|${cloakId}` : "";
  const h = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-sync-marker-v1|${tier}|${corner}${cloakPart}`)
    .digest();
  const mask = new Uint8Array(MARKER_PIXELS);
  for (let i = 0; i < MARKER_PIXELS; i++) {
    const byte = h[i >> 3]!;
    const bit = (byte >> (i & 7)) & 1;
    mask[i] = bit;
  }
  return mask;
}

/**
 * RGBA buffer'a in-place stamp. mask=1 olan piksellerde luma artar.
 * Image boundary kontrolü yapılır; off-canvas pixeller atlanır.
 */
export function stampMarker(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  mask: Uint8Array,
  delta: number = MARKER_CONTRAST_DELTA,
): void {
  // T6 integration fix (Faz 5 Step 5.3): stamp direction is chosen per-pixel
  // based on local luma to avoid saturation. Without this, white-background
  // text images saturate at 255 and the +delta lift becomes invisible
  // (NCC drops to noise level, observed 0.13-0.20). With signed modulation,
  // mask=1 pixels deviate consistently AWAY from the local base — detect uses
  // |NCC| to remain sign-invariant.
  for (let my = 0; my < MARKER_SIZE; my++) {
    for (let mx = 0; mx < MARKER_SIZE; mx++) {
      const px = x + mx;
      const py = y + my;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (mask[my * MARKER_SIZE + mx] !== 1) continue;
      const idx = (py * width + px) * 4;
      const r = rgba[idx]!;
      const g = rgba[idx + 1]!;
      const b = rgba[idx + 2]!;
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const sign = luma > 127 ? -1 : 1;
      const d = sign * delta;
      rgba[idx]     = Math.max(0, Math.min(255, r + d));
      rgba[idx + 1] = Math.max(0, Math.min(255, g + d));
      rgba[idx + 2] = Math.max(0, Math.min(255, b + d));
    }
  }
}

/**
 * Single marker NCC search at expected anchor ± searchWindow.
 * Returns best (ncc, dx, dy). NCC < threshold ⇒ found=false.
 *
 * Performans: O((2W+1)² × MARKER_PIXELS). 16×16 mask, W=8 → 17² × 256
 * ≈ 74K ops per marker × 8 markers ≈ 600K ops — JS'de < 5ms.
 */
export function detectMarkerAt(
  rgba: Uint8Array,
  width: number,
  height: number,
  expectedX: number,
  expectedY: number,
  mask: Uint8Array,
  searchWindow: number = 8,
  nccThreshold: number = MARKER_NCC_THRESHOLD,
): { found: boolean; ncc: number; dx: number; dy: number; detectedX: number; detectedY: number } {
  // Pre-compute mask statistics
  let maskSum = 0;
  for (let i = 0; i < MARKER_PIXELS; i++) maskSum += mask[i]!;
  const maskMean = maskSum / MARKER_PIXELS;
  let maskVar = 0;
  for (let i = 0; i < MARKER_PIXELS; i++) {
    const d = mask[i]! - maskMean;
    maskVar += d * d;
  }
  const maskStd = Math.sqrt(maskVar);

  let bestNcc = -1;
  let bestDx = 0;
  let bestDy = 0;

  if (maskStd < 1e-6) {
    return { found: false, ncc: -1, dx: 0, dy: 0, detectedX: expectedX, detectedY: expectedY };
  }

  const patch = new Float64Array(MARKER_PIXELS);

  for (let dy = -searchWindow; dy <= searchWindow; dy++) {
    for (let dx = -searchWindow; dx <= searchWindow; dx++) {
      const x0 = expectedX + dx;
      const y0 = expectedY + dy;
      if (x0 < 0 || y0 < 0 || x0 + MARKER_SIZE > width || y0 + MARKER_SIZE > height) continue;

      let sum = 0;
      for (let py = 0; py < MARKER_SIZE; py++) {
        const rowOff = ((y0 + py) * width + x0) * 4;
        for (let px = 0; px < MARKER_SIZE; px++) {
          const i = rowOff + px * 4;
          // Rec.601 luma
          const luma = rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
          patch[py * MARKER_SIZE + px] = luma;
          sum += luma;
        }
      }
      const mean = sum / MARKER_PIXELS;
      let varSum = 0;
      let cov = 0;
      for (let i = 0; i < MARKER_PIXELS; i++) {
        const pd = patch[i]! - mean;
        varSum += pd * pd;
        cov += pd * (mask[i]! - maskMean);
      }
      const std = Math.sqrt(varSum);
      if (std < 1e-6) continue;
      // T6 fix: |NCC| because stampMarker is sign-adaptive (darken on light
      // backgrounds, brighten on dark). Cross-tenant baseline (foreign mask)
      // peaks ≈0.18 in lib smoke — |NCC| keeps that well below 0.4 threshold.
      const ncc = Math.abs(cov / (std * maskStd));
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return {
    found: bestNcc >= nccThreshold,
    ncc: bestNcc,
    dx: bestDx,
    dy: bestDy,
    detectedX: expectedX + bestDx,
    detectedY: expectedY + bestDy,
  };
}

export interface VaultRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Outer 4 corner anchors — image kenarından `margin` (≥8, image min-edge'in
 * %1'i) içeride. Her corner'da MARKER_SIZE×MARKER_SIZE blok.
 *
 * `marginPx` opsiyonel; verilirse default formülü ezer (route layer L1 stamp
 * çakışmasını önlemek için 32 kullanıyor — STEP53_OUTER_MARKER_MARGIN).
 */
export function expectedOuterAnchors(
  width: number,
  height: number,
  marginPx?: number,
): MarkerAnchor[] {
  const margin = marginPx ?? Math.max(8, Math.round(Math.min(width, height) * 0.01));
  return [
    { corner: "NW", x: margin, y: margin },
    { corner: "NE", x: width - margin - MARKER_SIZE, y: margin },
    { corner: "SW", x: margin, y: height - margin - MARKER_SIZE },
    { corner: "SE", x: width - margin - MARKER_SIZE, y: height - margin - MARKER_SIZE },
  ];
}

/**
 * Faz 5 Step 5.4 T1 — outer 8 anchors (4 corner + 4 edge midpoint).
 *
 * Edge-midpoint positions: top-mid (N), right-mid (E), bottom-mid (S),
 * left-mid (W). Her edge marker'ı kenardan `margin` içeride, eksenel ortada.
 * Marker boyutu 16×16 piksel (MARKER_SIZE), pozisyon `width/2 - 8` veya
 * `height/2 - 8` (ortalama).
 *
 * **Tasarım gerekçesi**: Step 5.3'te 4 corner attack zarfında 1 köşe
 * crop (top-left vb.) 2/4 marker'ı kaybediyordu — 3-of-4 affine eşiğinin
 * altına düşüyordu. 8-marker scheme ile tek-köşe crop'tan sonra 6/8 hit
 * mümkün; 5/8 minimum gate (T2'de tanımlanır) tek-köşe attack'i kapsar.
 *
 * Backward-compat: yalnızca `expectedOuterAnchors` (v1) çağrı yapan kod
 * etkilenmez. Bu fonksiyon yeni; route v2-8marker'a opt-in eder.
 */
export function expectedOuterAnchorsV2(
  width: number,
  height: number,
  marginPx?: number,
): MarkerAnchor[] {
  const margin = marginPx ?? Math.max(8, Math.round(Math.min(width, height) * 0.01));
  const half = Math.floor(MARKER_SIZE / 2);
  // Centre offsets — round to even pixel for axis alignment.
  const midX = Math.round(width / 2) - half;
  const midY = Math.round(height / 2) - half;
  return [
    // Corners (same positions as v1)
    { corner: "NW", x: margin, y: margin },
    { corner: "NE", x: width - margin - MARKER_SIZE, y: margin },
    { corner: "SW", x: margin, y: height - margin - MARKER_SIZE },
    { corner: "SE", x: width - margin - MARKER_SIZE, y: height - margin - MARKER_SIZE },
    // Edge midpoints (new in v2)
    { corner: "N", x: midX, y: margin },
    { corner: "E", x: width - margin - MARKER_SIZE, y: midY },
    { corner: "S", x: midX, y: height - margin - MARKER_SIZE },
    { corner: "W", x: margin, y: midY },
  ];
}

/**
 * Scheme dispatcher — v1 → 4 anchors, v2 → 8 anchors. Caller hangi
 * scheme'i kullanıyorsa onu geçer; emisyon (cloak-image) sırasında scheme
 * `vault_metadata.markers.outerScheme` olarak persist edilir, detect
 * (analyze-image) okuduğu scheme ile aynı helper'ı çağırır.
 */
export function expectedOuterAnchorsForScheme(
  width: number,
  height: number,
  scheme: OuterScheme,
  marginPx?: number,
): MarkerAnchor[] {
  // v3-multiscale shares the SAME 8 SMALL anchor positions as v2 (the LARGE
  // anchors are returned by `expectedOuterAnchorsLargeV3` separately, so this
  // helper continues to return only the small/16×16 set). This preserves the
  // entire v2 stamp/detect contract for v3 rows when the LARGE path falls
  // back into the SMALL chain (Step 5.4 T3.5 KIRMIZI ÇİZGİ #1).
  if (
    scheme === OUTER_SCHEME_V2 ||
    scheme === OUTER_SCHEME_V3 ||
    // Faz 5 Step 5.4.1 — v4 SMALL anchors share the V2/V3 8-key topology
    // bit-for-bit (KIRMIZI ÇİZGİ #1: SMALL chain unchanged). The CIM
    // 32×32 markers live at the LARGE anchor positions and are returned
    // by `expectedOuterAnchorsCimV4` separately.
    scheme === OUTER_SCHEME_V4 ||
    // Faz 5 Step 5.5 — v5 SMALL anchors share the V2/V3/V4 8-key topology
    // bit-for-bit (KIRMIZI ÇİZGİ #1). DCT-Concentric markers live at the
    // LARGE/CIM anchor positions and are returned by
    // `expectedOuterAnchorsDctV5` (re-export of LARGE) separately.
    scheme === OUTER_SCHEME_V5
  ) {
    return expectedOuterAnchorsV2(width, height, marginPx);
  }
  return expectedOuterAnchors(width, height, marginPx);
}

// ───────────────────────────────────────────────────────────────────────
// Faz 5 Step 5.4 T3.5 — LARGE marker primitives (32×32, 2×2 bit replication)
// ───────────────────────────────────────────────────────────────────────

/**
 * 1024-pixel binary mask = 256 unique HMAC bits replicated into 2×2 cells.
 *
 * Domain-separator string `aegis-sync-marker-large-v1|…` is DISTINCT from the
 * SMALL `aegis-sync-marker-v1|…` (T3.5-A invariant): a SMALL mask and a LARGE
 * mask for the same (tier, corner, cloakId) tuple have UNCORRELATED bits
 * (smoke asserts pairwise Hamming ≥ 400 / 1024). This prevents a SMALL stamp
 * leaking signal into a LARGE detect (and vice versa) when both are stamped
 * in close proximity — required because LARGE markers sit just 24 px diagonal
 * from the SMALL ones in v3 layouts.
 *
 * Replication invariant: `mask[(2y)·32 + 2x] === mask[(2y)·32 + (2x+1)]
 * === mask[(2y+1)·32 + 2x] === mask[(2y+1)·32 + (2x+1)]` for every logical
 * bit cell (x,y) ∈ [0..15]². Lib smoke asserts this directly.
 */
export function deriveMarkerMaskLarge(
  tenantMasterSecret: Buffer | Uint8Array,
  tier: MarkerTier,
  corner: MarkerKey,
  cloakId?: string,
): Uint8Array {
  const cloakPart = cloakId ? `|${cloakId}` : "";
  const h = createHmac("sha256", Buffer.from(tenantMasterSecret))
    .update(`aegis-sync-marker-large-v1|${tier}|${corner}${cloakPart}`)
    .digest();
  const mask = new Uint8Array(MARKER_PIXELS_LARGE);
  // 256 logical bits laid out as a 16×16 grid; each bit fills a 2×2 pixel
  // block in the 32×32 mask.
  for (let logicalY = 0; logicalY < MARKER_SIZE; logicalY++) {
    for (let logicalX = 0; logicalX < MARKER_SIZE; logicalX++) {
      const bitIndex = logicalY * MARKER_SIZE + logicalX;
      const byte = h[bitIndex >> 3]!;
      const bit = (byte >> (bitIndex & 7)) & 1;
      const pxBaseY = logicalY * MARKER_LARGE_BIT_REPLICATION;
      const pxBaseX = logicalX * MARKER_LARGE_BIT_REPLICATION;
      for (let dy = 0; dy < MARKER_LARGE_BIT_REPLICATION; dy++) {
        for (let dx = 0; dx < MARKER_LARGE_BIT_REPLICATION; dx++) {
          mask[(pxBaseY + dy) * MARKER_SIZE_LARGE + (pxBaseX + dx)] = bit;
        }
      }
    }
  }
  return mask;
}

/**
 * In-place LARGE stamp. Same sign-adaptive luma modulation as `stampMarker`
 * (T6 fix preserved): stamp direction chosen per-pixel based on local luma
 * to avoid white-background saturation. Detect uses |NCC| to remain
 * sign-invariant — identical contract to small.
 */
export function stampMarkerLarge(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  mask: Uint8Array,
  delta: number = MARKER_CONTRAST_DELTA,
): void {
  // Step 5.4 T3.5 — MARKER-level (not per-pixel) sign-adaptive luma.
  //
  // SMALL `stampMarker` ile FARKLI: 32×32 alan PDF metin/grafik üstüne düşünce
  // luma 127 sınırını çok kez geçer; per-pixel sign her geçişte stamp yönünü
  // ters çevirir → mask=1 pikseller yarısı +delta yarısı −delta olur, NCC
  // patch ile mask arasında korelasyonu sıfıra yakın yapar (deneysel: clean
  // PNG roundtrip dahi 3/8 NCC ≥ 0.4). Çözüm: marker bütününün ortalama luma
  // değeri ile TEK sign kararı; NCC zaten |·| (sign-invariant) olduğundan
  // detect tarafı etkilenmez.
  let lumaSum = 0;
  let pxCount = 0;
  for (let my = 0; my < MARKER_SIZE_LARGE; my++) {
    for (let mx = 0; mx < MARKER_SIZE_LARGE; mx++) {
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
  const sign = meanLuma > 127 ? -1 : 1;
  const d = sign * delta;
  for (let my = 0; my < MARKER_SIZE_LARGE; my++) {
    for (let mx = 0; mx < MARKER_SIZE_LARGE; mx++) {
      const px = x + mx;
      const py = y + my;
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (mask[my * MARKER_SIZE_LARGE + mx] !== 1) continue;
      const idx = (py * width + px) * 4;
      rgba[idx]     = Math.max(0, Math.min(255, rgba[idx]!     + d));
      rgba[idx + 1] = Math.max(0, Math.min(255, rgba[idx + 1]! + d));
      rgba[idx + 2] = Math.max(0, Math.min(255, rgba[idx + 2]! + d));
    }
  }
}

/**
 * Single LARGE marker NCC search at expected anchor ± searchWindow.
 * Identical contract to `detectMarkerAt` but operating on a 32×32 mask.
 *
 * Performans: O((2W+1)² × MARKER_PIXELS_LARGE) ≈ 17² × 1024 ≈ 296K ops per
 * marker × 8 markers ≈ 2.4M ops — JS'de < 25 ms (sharp-free, single thread).
 */
export function detectMarkerAtLarge(
  rgba: Uint8Array,
  width: number,
  height: number,
  expectedX: number,
  expectedY: number,
  mask: Uint8Array,
  searchWindow: number = 8,
  nccThreshold: number = MARKER_NCC_THRESHOLD,
): { found: boolean; ncc: number; dx: number; dy: number; detectedX: number; detectedY: number } {
  let maskSum = 0;
  for (let i = 0; i < MARKER_PIXELS_LARGE; i++) maskSum += mask[i]!;
  const maskMean = maskSum / MARKER_PIXELS_LARGE;
  let maskVar = 0;
  for (let i = 0; i < MARKER_PIXELS_LARGE; i++) {
    const d = mask[i]! - maskMean;
    maskVar += d * d;
  }
  const maskStd = Math.sqrt(maskVar);

  let bestNcc = -1;
  let bestDx = 0;
  let bestDy = 0;

  if (maskStd < 1e-6) {
    return { found: false, ncc: -1, dx: 0, dy: 0, detectedX: expectedX, detectedY: expectedY };
  }

  const patch = new Float64Array(MARKER_PIXELS_LARGE);

  for (let dy = -searchWindow; dy <= searchWindow; dy++) {
    for (let dx = -searchWindow; dx <= searchWindow; dx++) {
      const x0 = expectedX + dx;
      const y0 = expectedY + dy;
      if (x0 < 0 || y0 < 0 || x0 + MARKER_SIZE_LARGE > width || y0 + MARKER_SIZE_LARGE > height) continue;

      let sum = 0;
      for (let py = 0; py < MARKER_SIZE_LARGE; py++) {
        const rowOff = ((y0 + py) * width + x0) * 4;
        for (let px = 0; px < MARKER_SIZE_LARGE; px++) {
          const i = rowOff + px * 4;
          const luma = rgba[i]! * 0.299 + rgba[i + 1]! * 0.587 + rgba[i + 2]! * 0.114;
          patch[py * MARKER_SIZE_LARGE + px] = luma;
          sum += luma;
        }
      }
      const mean = sum / MARKER_PIXELS_LARGE;
      let varSum = 0;
      let cov = 0;
      for (let i = 0; i < MARKER_PIXELS_LARGE; i++) {
        const pd = patch[i]! - mean;
        varSum += pd * pd;
        cov += pd * (mask[i]! - maskMean);
      }
      const std = Math.sqrt(varSum);
      if (std < 1e-6) continue;
      const ncc = Math.abs(cov / (std * maskStd));
      if (ncc > bestNcc) {
        bestNcc = ncc;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }
  return {
    found: bestNcc >= nccThreshold,
    ncc: bestNcc,
    dx: bestDx,
    dy: bestDy,
    detectedX: expectedX + bestDx,
    detectedY: expectedY + bestDy,
  };
}

/**
 * Faz 5 Step 5.4 T3.5 — outer LARGE anchor positions (v3 scheme only).
 *
 * Same 8-key topology (4 corner + 4 edge-mid) as `expectedOuterAnchorsV2`,
 * but each anchor inset by `MARKER_LARGE_INSET = MARKER_SIZE + 8 = 24 px`
 * diagonally INWARD from the small marker's position. This guarantees zero
 * pixel overlap with the small markers (which occupy
 * [smallMargin..smallMargin+16] from each edge), so v3 stamping is purely
 * additive on top of v2.
 *
 * Effective LARGE margin = `smallMarginPx + MARKER_LARGE_INSET` (default
 * 32 + 24 = 56). Edge-mid LARGE markers are centred on the same midpoint
 * axis as the small ones but pushed inward perpendicular to the edge.
 *
 * Caller (route layer) passes the SAME `STEP53_OUTER_MARKER_MARGIN` it used
 * for small anchors so detection can re-derive identical positions.
 */
export function expectedOuterAnchorsLargeV3(
  width: number,
  height: number,
  smallMarginPx?: number,
): MarkerAnchor[] {
  const smallMargin = smallMarginPx ?? Math.max(8, Math.round(Math.min(width, height) * 0.01));
  const m = smallMargin + MARKER_LARGE_INSET; // LARGE top-left margin from each edge.
  const halfL = Math.floor(MARKER_SIZE_LARGE / 2);
  const midX = Math.round(width / 2) - halfL;
  const midY = Math.round(height / 2) - halfL;
  return [
    // Corners — diagonal inward inset.
    { corner: "NW", x: m, y: m },
    { corner: "NE", x: width - m - MARKER_SIZE_LARGE, y: m },
    { corner: "SW", x: m, y: height - m - MARKER_SIZE_LARGE },
    { corner: "SE", x: width - m - MARKER_SIZE_LARGE, y: height - m - MARKER_SIZE_LARGE },
    // Edge midpoints — perpendicular inward inset, axially centred.
    { corner: "N", x: midX, y: m },
    { corner: "E", x: width - m - MARKER_SIZE_LARGE, y: midY },
    { corner: "S", x: midX, y: height - m - MARKER_SIZE_LARGE },
    { corner: "W", x: m, y: midY },
  ];
}

/**
 * Faz 5 Step 5.4 T2 — outer marker spatial coverage analiz.
 *
 * 8-marker scheme'inde 5/8 hit count tek başına yeterli değil: tek bir kenara
 * yığılmış 5 hit (örn. NW + N + NE + W + E hepsi üstte) coğrafi olarak küçük
 * bir bölgeyi kaplar; affine fit nümerik olarak başarılı görünebilir ama
 * extrapolation hatası vault rect'i kanvas dışına atar. Bu helper hit'lerin
 * dağıldığı **distinct kenar sayısını** (top/bottom/left/right) raporlar.
 *
 * Kenar atama (her köşe iki kenara ait, edge-mid bir kenara):
 *   NW → top + left   N → top
 *   NE → top + right  E → right
 *   SW → bottom + left S → bottom
 *   SE → bottom + right W → left
 *
 * Caller: `distinctSides ≥ 3` gereksinimi (T2 contract). Tek köşe kırpma
 * (örn. top-left 4%) NW + W + N kaybolsa bile NE/SE/SW/E/S → bottom + right
 * + left = 3 kenar ✓. İki köşe kırpma (top-left + top-right) NW/N/NE/W/E
 * kaybolsa bile SW/S/SE → bottom + left + right = 3 kenar; ancak hit count
 * 3/8 < 5/8 olduğu için count gate önce reddeder. Tek-kenar yığılma sahnesi
 * (üst kenarda 5 hit; aşağıda 0): top + left + right = 3 kenar — geçer
 * (count + spatial gate'in **birlikte** kabul ettiği bu gerçek bir
 * marker imzasıdır, false-positive değil).
 */
export type OuterSide = "top" | "bottom" | "left" | "right";

const OUTER_SIDE_MAP: Readonly<Record<MarkerKey, ReadonlyArray<OuterSide>>> =
  Object.freeze({
    NW: ["top", "left"] as const,
    NE: ["top", "right"] as const,
    SW: ["bottom", "left"] as const,
    SE: ["bottom", "right"] as const,
    N: ["top"] as const,
    E: ["right"] as const,
    S: ["bottom"] as const,
    W: ["left"] as const,
  });

export function outerSpatialCoverage(
  hits: ReadonlyArray<{ corner: MarkerKey }>,
): { sides: ReadonlyArray<OuterSide>; distinctSides: number } {
  const set = new Set<OuterSide>();
  for (const h of hits) {
    const sides = OUTER_SIDE_MAP[h.corner];
    for (const s of sides) set.add(s);
  }
  return { sides: [...set], distinctSides: set.size };
}

/**
 * Inner 4 marker anchors — vault rect'in 4 köşesinde.
 * vaultRect 8'in katlarına yuvarlı olmalı (DCT bloğu için, T2'de garanti edilir).
 */
export function expectedInnerAnchors(vaultRect: VaultRect): MarkerAnchor[] {
  return [
    { corner: "NW", x: vaultRect.x, y: vaultRect.y },
    { corner: "NE", x: vaultRect.x + vaultRect.w - MARKER_SIZE, y: vaultRect.y },
    { corner: "SW", x: vaultRect.x, y: vaultRect.y + vaultRect.h - MARKER_SIZE },
    {
      corner: "SE",
      x: vaultRect.x + vaultRect.w - MARKER_SIZE,
      y: vaultRect.y + vaultRect.h - MARKER_SIZE,
    },
  ];
}

/**
 * Convenience: stamp tüm markers (outer + opsiyonel inner). Caller route'tan
 * tenant secret + opsiyonel vaultRect verir.
 */
export function stampAllMarkers(
  rgba: Uint8Array,
  width: number,
  height: number,
  tenantMasterSecret: Buffer | Uint8Array,
  vaultRect?: VaultRect,
  cloakId?: string,
): Array<{ corner: MarkerKey; tier: MarkerTier; x: number; y: number }> {
  const stamped: Array<{ corner: MarkerKey; tier: MarkerTier; x: number; y: number }> = [];
  for (const a of expectedOuterAnchors(width, height)) {
    const mask = deriveMarkerMask(tenantMasterSecret, "outer", a.corner, cloakId);
    stampMarker(rgba, width, height, a.x, a.y, mask);
    stamped.push({ corner: a.corner, tier: "outer", x: a.x, y: a.y });
  }
  if (vaultRect) {
    for (const a of expectedInnerAnchors(vaultRect)) {
      const mask = deriveMarkerMask(tenantMasterSecret, "inner", a.corner, cloakId);
      stampMarker(rgba, width, height, a.x, a.y, mask);
      stamped.push({ corner: a.corner, tier: "inner", x: a.x, y: a.y });
    }
  }
  return stamped;
}

/**
 * Convenience: tüm beklenen marker pozisyonlarında detect — pragmatic
 * Step 5.3 path. searchWindow küçük (default 8) → CROP_20/ROTATE_3 yakalar
 * ama CROP_60 yakalamaz (Step 5.4: full-image scan).
 */
export function detectAllMarkers(
  rgba: Uint8Array,
  width: number,
  height: number,
  tenantMasterSecret: Buffer | Uint8Array,
  vaultRect?: VaultRect,
  searchWindow: number = 8,
  cloakId?: string,
): MarkerHit[] {
  const hits: MarkerHit[] = [];
  for (const a of expectedOuterAnchors(width, height)) {
    const mask = deriveMarkerMask(tenantMasterSecret, "outer", a.corner, cloakId);
    const r = detectMarkerAt(rgba, width, height, a.x, a.y, mask, searchWindow);
    hits.push({
      corner: a.corner,
      tier: "outer",
      found: r.found,
      ncc: r.ncc,
      detectedX: r.detectedX,
      detectedY: r.detectedY,
      expectedX: a.x,
      expectedY: a.y,
      dx: r.dx,
      dy: r.dy,
    });
  }
  if (vaultRect) {
    for (const a of expectedInnerAnchors(vaultRect)) {
      const mask = deriveMarkerMask(tenantMasterSecret, "inner", a.corner, cloakId);
      const r = detectMarkerAt(rgba, width, height, a.x, a.y, mask, searchWindow);
      hits.push({
        corner: a.corner,
        tier: "inner",
        found: r.found,
        ncc: r.ncc,
        detectedX: r.detectedX,
        detectedY: r.detectedY,
        expectedX: a.x,
        expectedY: a.y,
        dx: r.dx,
        dy: r.dy,
      });
    }
  }
  return hits;
}
