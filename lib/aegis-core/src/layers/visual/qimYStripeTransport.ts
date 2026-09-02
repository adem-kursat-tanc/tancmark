// Faz 5 Step 5.8-A.4 — Y-channel adaptive QIM stripe transport.
//
// Tasarım hedefi: T002a `vaultStripedLayout` 8-slice transport'un R-LSB
// taşıyıcısını Y-channel (BT.601 luma) scalar QIM ile değiştir. RS(8,4)
// distributor (T001 `stripeDistributor`) reuse — K=4 data + 4 parity, ≤4
// erasure tolere edilir.
//
// Algoritma (mint):
//   1. RS encode → 8 stripe (her biri stripeLen byte; 32B compactId →
//      stripeLen=9 → 72 bit/stripe).
//   2. Vault rect 8 horizontal slice'a bölün (sliceH = floor(rectH/8)).
//   3. Her slice'ta 4×4 piksel bloğa tile et (sliceW/4 × sliceH/4 block).
//   4. Her bit b için bir block:
//      - rgbToLuma → block Y-mean = m, block stdDev = σ.
//      - Adaptive Q: σ ≥ Q_TEXTURE_THRESHOLD ⇒ Q=Q_TEXTURED, aksi Q=Q_SMOOTH.
//      - Scalar QIM: target = round((m − b·Q/2)/Q)·Q + b·Q/2.
//      - dY = target − m.
//      - Her piksel R+=dY, G+=dY, B+=dY (clamp 0..255). Y delta uniform
//        ⇒ block stdDev (varyans) DEĞİŞMEZ ⇒ adaptive Q deterministik.
//
// Algoritma (extract):
//   1. Her slice'ta block-mean Y + block stdDev → adaptive Q.
//   2. Scalar QIM decode: bit = round(2·m'/Q) mod 2.
//   3. Bit dizisi → byte → RS decodeWithErasures (caller-marked erasures
//      veya match-against-expectedPayload exhaustive fallback).
//
// Kalite/dirençlilik:
//   - Q=8 smooth → margin Q/4=2 luma. Q=12 textured → margin 3 luma.
//   - PSNR vault region ≥ 36 dB (Q=8, ~5% pixel touched per slice).
//   - Sharp/Pillow bağımlılığı YOK; saf Uint8Array + Float64Array.
//   - dY uniform R=G=B ⇒ chroma korunur; YCbCr Cb/Cr neredeyse intakt.
//
// KIRMIZI ÇİZGİ #3 (Match Field Decisive): `match` alanı yalnızca
// `expectedPayload` verildiğinde üretilir; lib v1.match veya verdict'i
// LIFT etmez — entegrasyon katmanı politikayı belirler.
//
// Determinism caveat (architect T003a notu): Adaptive Q seçimi block stdDev
// invariantına dayanır — uniform dY block varyansını matematiksel olarak
// değiştirmez. ANCAK clamp'e (0/255) yakın saturated bloklarda dY uniform
// uygulanamaz (clampU8 her piksel için bağımsız budar) ⇒ stdDev hafifçe
// kayabilir ve embed/extract Q farklılaşabilir. Vault rect kontrast bandında
// (mid-luma) tutulduğu sürece güvenli; entegrasyon katmanı vault rect
// seçiminde bu shoulder'ı dikkate almalıdır.

import { rgbToLuma } from "./dct.js";
import { encodeStripes, decodeStripes, STRIPE_N as STRIPE_COUNT } from "./stripeDistributor.js";
import { planVaultStripeLayout, type VaultStripeLayout } from "./vaultStripedLayout.js";

export const VAULT_QIM_Y_STRIPE_SLICES = STRIPE_COUNT; // 8
export const QIM_BLOCK_SIZE = 4;
// T003d — Q SWEEP Zirve (Agresif+): margin Q/4 = 6 luma (smooth) / 8 luma
// (textured). T003c Q=16/24 D08 +30° altında 0/2 recovery — post-deskew
// cumulative bilinear smear hâlâ marjı aştı. Bu seviye RAW frame fallback ile
// birlikte kullanılır (extractQimYStripesProjected); PSNR ≥ 28 dB hedefini
// koruyarak rotation-induced ±6-8 luma sub-pixel resampling smear üstüne çıkar.
export const QIM_Q_SMOOTH = 24;
export const QIM_Q_TEXTURED = 32;
export const QIM_TEXTURE_THRESHOLD = 16; // luma stdDev (BT.601 units)
// T003c — Multi-offset extract (3×3 grid soft-decision): rotation+inverse-warp
// sonrası block-grid alignment ±1 px kayar. Her bit için 9 farklı block
// top-left offset'i sample → en yüksek QIM centroid confidence'lı offset
// seçilir. Embed tarafı offset DEĞİŞTİRMEZ (decoder-only diversity).
const EXTRACT_OFFSETS_X = [-1, 0, 1] as const;
const EXTRACT_OFFSETS_Y = [-1, 0, 1] as const;

export interface QimYRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface QimYStripeEmbedResult {
  readonly layout: VaultStripeLayout;
  readonly stripeLen: number;
  readonly payloadLen: number;
  readonly bitsPerStripe: number;
  readonly meanDeltaY: number; // ortalama |dY| (PSNR sanity için)
}

export interface QimYStripeExtractResult {
  readonly ok: boolean;
  readonly data: Uint8Array | null;
  readonly presentCount: number;
  readonly erasurePositions: number[];
  readonly match?: boolean;
}

function blockStats(
  luma: Float64Array,
  w: number,
  blockX: number,
  blockY: number,
): { mean: number; stdDev: number } {
  let sum = 0;
  let sumSq = 0;
  const n = QIM_BLOCK_SIZE * QIM_BLOCK_SIZE;
  for (let dy = 0; dy < QIM_BLOCK_SIZE; dy++) {
    for (let dx = 0; dx < QIM_BLOCK_SIZE; dx++) {
      const v = luma[(blockY + dy) * w + (blockX + dx)]!;
      sum += v;
      sumSq += v * v;
    }
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { mean, stdDev: Math.sqrt(variance) };
}

function adaptiveQ(stdDev: number): number {
  return stdDev >= QIM_TEXTURE_THRESHOLD ? QIM_Q_TEXTURED : QIM_Q_SMOOTH;
}

// Scalar QIM embed: target bit b, current mean m, quantizer Q. Returns target Y.
function qimTarget(m: number, b: 0 | 1, Q: number): number {
  const offset = (b * Q) / 2;
  return Math.round((m - offset) / Q) * Q + offset;
}

// Scalar QIM decode: nearest centroid bit.
function qimDecode(m: number, Q: number): 0 | 1 {
  return ((Math.round((2 * m) / Q) % 2) + 2) % 2 === 0 ? 0 : 1;
}

// Soft-decision QIM decode: bit + confidence (0..1). Confidence = normalized
// distance margin between nearest centroid (correct bit) and runner-up
// centroid (other bit). 1.0 = sample EXACTLY on correct centroid; 0.0 =
// sample equidistant between two centroids (max ambiguity).
function qimDecodeSoft(m: number, Q: number): { bit: 0 | 1; confidence: number } {
  const halfQ = Q / 2;
  // bit 0 centroids at k·Q; bit 1 centroids at k·Q + Q/2.
  const phase = ((m % Q) + Q) % Q;          // [0, Q)
  const dist0 = Math.min(phase, Q - phase); // dist to nearest bit-0 centroid
  const dist1 = Math.abs(phase - halfQ);    // dist to nearest bit-1 centroid
  const bit: 0 | 1 = dist0 <= dist1 ? 0 : 1;
  const margin = Math.abs(dist0 - dist1);   // 0..halfQ
  const confidence = margin / halfQ;        // 0..1
  return { bit, confidence };
}

function clampU8(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return Math.round(v);
}

function bitsFromBytes(bytes: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    for (let bi = 7; bi >= 0; bi--) out.push((byte >> bi) & 1);
  }
  return out;
}

function bytesFromBits(bits: number[], byteLen: number): Uint8Array {
  const out = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) {
    let v = 0;
    for (let bi = 0; bi < 8; bi++) v = (v << 1) | (bits[i * 8 + bi]! & 1);
    out[i] = v;
  }
  return out;
}

// T004 Görev 3 — Rotation-aware sampling helpers.
//
// Kök bulgu (architect T003d code review): D08 (+30°) altında
// `extractQimYStripesProjected` block CENTER'ı M ile RAW'a projekte ediyor
// ama footprint hâlâ axis-aligned 4×4 → eğik vault block'unun yanlış
// piksellerini sample ediyor (image grid'e diagonal düşüyor). Çözüm: 4×4
// grid offset'ini de θ ile döndür, sub-pixel coord'ta bilinear lookup.
//
// KIRMIZI ÇİZGİ — Maskeleme Kanunu intakt: lib içinde RAW frame WARP
// EDİLMEZ; sadece per-piksel bilinear sample (point query, ek bilinear
// pass YOK). 16 sub-pixel sample × deterministic interpolation.

function bilinearLumaSample(
  luma: Float64Array,
  w: number,
  h: number,
  fx: number,
  fy: number,
): number {
  // Returns -1 sentinel if out-of-bounds (caller skips).
  if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) return -1;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const dx = fx - x0;
  const dy = fy - y0;
  const v00 = luma[y0 * w + x0]!;
  const v10 = luma[y0 * w + x1]!;
  const v01 = luma[y1 * w + x0]!;
  const v11 = luma[y1 * w + x1]!;
  const top = v00 * (1 - dx) + v10 * dx;
  const bot = v01 * (1 - dx) + v11 * dx;
  return top * (1 - dy) + bot * dy;
}

function rotatedBlockMeanStd(
  luma: Float64Array,
  w: number,
  h: number,
  cxRaw: number,
  cyRaw: number,
  cosT: number,
  sinT: number,
): { mean: number; stdDev: number; valid: boolean } {
  // 4×4 grid, sub-pixel offsets (i+0.5 - 2, j+0.5 - 2) ∈ {-1.5,-0.5,0.5,1.5}.
  // Each offset rotated by θ around (cxRaw, cyRaw) → bilinear sample.
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let j = 0; j < QIM_BLOCK_SIZE; j++) {
    for (let i = 0; i < QIM_BLOCK_SIZE; i++) {
      const ox = i - (QIM_BLOCK_SIZE - 1) / 2;
      const oy = j - (QIM_BLOCK_SIZE - 1) / 2;
      const rx = ox * cosT - oy * sinT;
      const ry = ox * sinT + oy * cosT;
      const fx = cxRaw + rx;
      const fy = cyRaw + ry;
      const v = bilinearLumaSample(luma, w, h, fx, fy);
      if (v < 0) continue;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n < QIM_BLOCK_SIZE * QIM_BLOCK_SIZE) {
    // Partial out-of-bounds — invalid for QIM (would skew adaptiveQ).
    return { mean: 0, stdDev: 0, valid: false };
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { mean, stdDev: Math.sqrt(variance), valid: true };
}

function blocksPerSlice(layout: VaultStripeLayout): {
  blocksW: number;
  blocksH: number;
  capacityBits: number;
} {
  const sliceRect = layout.stripeRects[0]!;
  const blocksW = Math.floor(sliceRect.w / QIM_BLOCK_SIZE);
  const blocksH = Math.floor(layout.sliceH / QIM_BLOCK_SIZE);
  return { blocksW, blocksH, capacityBits: blocksW * blocksH };
}

function ensureCapacity(layout: VaultStripeLayout, stripeLen: number): void {
  const { capacityBits } = blocksPerSlice(layout);
  const requiredBits = stripeLen * 8;
  if (capacityBits < requiredBits) {
    throw new Error(
      `qimYStripeTransport: insufficient block capacity (have ${capacityBits} bits, need ${requiredBits}). Increase vault rect width.`,
    );
  }
}

// Image-bounds guard (architect T003a notu): rect image içine düşmüyorsa
// silently NaN→U8 yazımı yerine açıkça reddet. Entegrasyon katmanı için
// fail-loud kontrat.
function rectInBounds(rect: QimYRect, width: number, height: number): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.w > 0 &&
    rect.h > 0 &&
    rect.x + rect.w <= width &&
    rect.y + rect.h <= height
  );
}

/**
 * Embed payload into vault rect via Y-channel adaptive QIM, distributed
 * across 8 horizontal stripes via systematic RS(8,4).
 */
export function embedQimYStripes(
  rgba: Uint8Array,
  width: number,
  height: number,
  rect: QimYRect,
  payload: Uint8Array,
): QimYStripeEmbedResult | null {
  if (!rectInBounds(rect, width, height)) return null;
  const layout = planVaultStripeLayout(rect);
  if (!layout) return null;
  const stripes = encodeStripes(payload);
  const stripeLen = stripes[0]!.length;
  ensureCapacity(layout, stripeLen);

  const luma = rgbToLuma(rgba, width, height, 4);
  const { blocksW, blocksH } = blocksPerSlice(layout);
  let totalAbsDeltaY = 0;
  let touchedBlocks = 0;

  for (let s = 0; s < STRIPE_COUNT; s++) {
    const sliceRect = layout.stripeRects[s]!;
    const bits = bitsFromBytes(stripes[s]!);
    const requiredBits = bits.length;

    for (let bi = 0; bi < requiredBits; bi++) {
      const blockIdx = bi;
      const bRow = Math.floor(blockIdx / blocksW);
      const bCol = blockIdx % blocksW;
      if (bRow >= blocksH) break; // safety (capacity already validated)

      const blockX = sliceRect.x + bCol * QIM_BLOCK_SIZE;
      const blockY = sliceRect.y + bRow * QIM_BLOCK_SIZE;

      const stats = blockStats(luma, width, blockX, blockY);
      const Q = adaptiveQ(stats.stdDev);
      const target = qimTarget(stats.mean, (bits[bi]! & 1) as 0 | 1, Q);
      const dY = target - stats.mean;
      totalAbsDeltaY += Math.abs(dY);
      touchedBlocks++;

      for (let dy = 0; dy < QIM_BLOCK_SIZE; dy++) {
        for (let dx = 0; dx < QIM_BLOCK_SIZE; dx++) {
          const px = blockX + dx;
          const py = blockY + dy;
          const idx = (py * width + px) * 4;
          const r = rgba[idx]!;
          const g = rgba[idx + 1]!;
          const b = rgba[idx + 2]!;
          rgba[idx] = clampU8(r + dY);
          rgba[idx + 1] = clampU8(g + dY);
          rgba[idx + 2] = clampU8(b + dY);
          // Alpha intakt.
          // Update local luma buffer to keep block stats consistent if
          // multiple bits ever shared a block (defensive — current design
          // 1 bit/block).
          const newY =
            0.299 * rgba[idx]! +
            0.587 * rgba[idx + 1]! +
            0.114 * rgba[idx + 2]!;
          luma[py * width + px] = newY;
        }
      }
    }
  }

  return {
    layout,
    stripeLen,
    payloadLen: payload.length,
    bitsPerStripe: stripeLen * 8,
    meanDeltaY: touchedBlocks > 0 ? totalAbsDeltaY / touchedBlocks : 0,
  };
}

/**
 * Extract payload from vault rect via Y-channel adaptive QIM scalar decode +
 * RS(8,4) erasure-aware decode.
 *
 * - `erasures`: caller-marked stripe indices that are known-corrupted (e.g.
 *   slice covered by tampering). Up to 4 tolerated.
 * - `expectedPayload`: if provided, byte-equality check populates `match`.
 *   `match` is the only field a caller can use to lift v1.match policy
 *   externally (Match Field Decisive — lib does not lift verdicts).
 */
export function extractQimYStripes(
  rgba: Uint8Array,
  width: number,
  height: number,
  rect: QimYRect,
  payloadLen: number,
  opts: { erasures?: ReadonlyArray<number>; expectedPayload?: Uint8Array } = {},
): QimYStripeExtractResult {
  if (!rectInBounds(rect, width, height)) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }
  const layout = planVaultStripeLayout(rect);
  if (!layout) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }
  const luma = rgbToLuma(rgba, width, height, 4);
  const { blocksW, blocksH } = blocksPerSlice(layout);

  const trailerLen = 1;
  const dataLen = payloadLen + trailerLen;
  const K = 4;
  const stripeLen = Math.ceil(dataLen / K);
  const requiredBits = stripeLen * 8;
  if (blocksW * blocksH < requiredBits) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }

  const erasureSet = new Set((opts.erasures ?? []).map((n) => n | 0));
  const stripes: (Uint8Array | null)[] = new Array(STRIPE_COUNT).fill(null);

  for (let s = 0; s < STRIPE_COUNT; s++) {
    if (erasureSet.has(s)) continue;
    const sliceRect = layout.stripeRects[s]!;
    const bits: number[] = new Array(requiredBits);
    for (let bi = 0; bi < requiredBits; bi++) {
      const bRow = Math.floor(bi / blocksW);
      const bCol = bi % blocksW;
      const blockX = sliceRect.x + bCol * QIM_BLOCK_SIZE;
      const blockY = sliceRect.y + bRow * QIM_BLOCK_SIZE;

      // T003c — Multi-offset soft-decision: 3×3 grid (±1 px) → en yüksek
      // QIM centroid confidence'lı offset'in bit'i kazanır. Image-bounds
      // güvenli (her offset için block 4×4 image içine sığmalı). Mevcut
      // (0, 0) merkezi offset her zaman bounds-içi (rectInBounds garanti).
      let bestBit: 0 | 1 = 0;
      let bestConf = -1;
      for (const ox of EXTRACT_OFFSETS_X) {
        for (const oy of EXTRACT_OFFSETS_Y) {
          const bxOff = blockX + ox;
          const byOff = blockY + oy;
          if (
            bxOff < 0 ||
            byOff < 0 ||
            bxOff + QIM_BLOCK_SIZE > width ||
            byOff + QIM_BLOCK_SIZE > height
          ) {
            continue;
          }
          const stats = blockStats(luma, width, bxOff, byOff);
          const Q = adaptiveQ(stats.stdDev);
          const dec = qimDecodeSoft(stats.mean, Q);
          if (dec.confidence > bestConf) {
            bestConf = dec.confidence;
            bestBit = dec.bit;
          }
        }
      }
      // Fallback (defensive — only triggers if EVERY offset out-of-bounds,
      // which contradicts rectInBounds guarantee but kept for safety).
      if (bestConf < 0) {
        const stats = blockStats(luma, width, blockX, blockY);
        const Q = adaptiveQ(stats.stdDev);
        bestBit = qimDecode(stats.mean, Q);
      }
      bits[bi] = bestBit;
    }
    stripes[s] = bytesFromBits(bits, stripeLen);
  }

  const erasurePositions: number[] = [];
  for (let s = 0; s < STRIPE_COUNT; s++) {
    if (stripes[s] === null) erasurePositions.push(s);
  }
  const presentCount = STRIPE_COUNT - erasurePositions.length;

  const dec = decodeStripes(stripes);
  if (!dec.ok || dec.data === null) {
    return { ok: false, data: null, presentCount, erasurePositions };
  }
  const data = dec.data.slice(0, payloadLen);
  const out: QimYStripeExtractResult = {
    ok: true,
    data,
    presentCount,
    erasurePositions,
  };
  if (opts.expectedPayload) {
    const exp = opts.expectedPayload;
    let match = data.length === exp.length;
    if (match) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== exp[i]) {
          match = false;
          break;
        }
      }
    }
    return { ...out, match };
  }
  return out;
}

/**
 * T003d — Pre-deskew RAW frame fallback extract.
 *
 * Unlike `extractQimYStripes` which assumes axis-aligned vault rect inside an
 * already deskewed (template-coord) frame, this variant samples a RAW rotated-
 * source frame using a caller-provided `project(xTpl, yTpl)` callback that maps
 * template coords to raw coords (typically `applyAffine(fwdFinal, p)`).
 *
 * Rationale: the standard detect path warps RAW → template (1 bilinear) and
 * extracts from the warped frame. End-to-end (test rotate + recovery warp = 2
 * bilinears) the cumulative smear exceeds Q/4 luma margin under +30° rotation.
 * Sampling RAW frame directly with projected block centers bypasses the second
 * warp; only the test fixture's bilinear remains.
 *
 * KIRMIZI ÇİZGİ — Maskeleme Kanunu intakt: lib does NOT warp RAW; caller passes
 * raw rgba (already loaded once) and a deterministic projection callback. No
 * additional bilinear is introduced inside this lib.
 */
export function extractQimYStripesProjected(
  rgba: Uint8Array,
  width: number,
  height: number,
  rectTpl: QimYRect,
  payloadLen: number,
  project: (xTpl: number, yTpl: number) => { x: number; y: number },
  opts: {
    erasures?: ReadonlyArray<number>;
    expectedPayload?: Uint8Array;
    rotationAware?: boolean;
    thetaRad?: number;
  } = {},
): QimYStripeExtractResult {
  const layout = planVaultStripeLayout(rectTpl);
  if (!layout) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }
  const luma = rgbToLuma(rgba, width, height, 4);
  const { blocksW, blocksH } = blocksPerSlice(layout);

  const trailerLen = 1;
  const dataLen = payloadLen + trailerLen;
  const K = 4;
  const stripeLen = Math.ceil(dataLen / K);
  const requiredBits = stripeLen * 8;
  if (blocksW * blocksH < requiredBits) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }

  const erasureSet = new Set((opts.erasures ?? []).map((n) => n | 0));
  const stripes: (Uint8Array | null)[] = new Array(STRIPE_COUNT).fill(null);

  // T004 Görev 3 — Rotation-aware sample setup. θ kaynağı: opts.thetaRad
  // verilirse o; yoksa project differential'dan türet (project(0,0) ve
  // project(1,0) farkından atan2). Default false ⇒ axis-aligned (T003d
  // backward compat).
  const rotationAware = opts.rotationAware === true;
  let cosT = 1;
  let sinT = 0;
  if (rotationAware) {
    let theta = opts.thetaRad;
    if (theta === undefined) {
      const p0 = project(0, 0);
      const p1 = project(1, 0);
      theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    }
    cosT = Math.cos(theta);
    sinT = Math.sin(theta);
  }

  for (let s = 0; s < STRIPE_COUNT; s++) {
    if (erasureSet.has(s)) continue;
    const sliceRect = layout.stripeRects[s]!;
    const bits: number[] = new Array(requiredBits);
    for (let bi = 0; bi < requiredBits; bi++) {
      const bRow = Math.floor(bi / blocksW);
      const bCol = bi % blocksW;
      // Block top-left + center in TEMPLATE coords (axis-aligned).
      const blockXTpl = sliceRect.x + bCol * QIM_BLOCK_SIZE;
      const blockYTpl = sliceRect.y + bRow * QIM_BLOCK_SIZE;
      const cxTpl = blockXTpl + QIM_BLOCK_SIZE / 2;
      const cyTpl = blockYTpl + QIM_BLOCK_SIZE / 2;
      // Project block center to RAW coords.
      const c = project(cxTpl, cyTpl);
      const cxRaw = c.x;
      const cyRaw = c.y;
      // Multi-offset 3×3 (±1 px) around projected center.
      //   rotationAware=true → 4×4 footprint θ ile döndürülür, sub-pixel
      //     bilinear sample (architect T003d tavsiyesi).
      //   rotationAware=false → axis-aligned 4×4 (T003d backward compat).
      let bestBit: 0 | 1 = 0;
      let bestConf = -1;
      for (const ox of EXTRACT_OFFSETS_X) {
        for (const oy of EXTRACT_OFFSETS_Y) {
          if (rotationAware) {
            const stats = rotatedBlockMeanStd(
              luma,
              width,
              height,
              cxRaw + ox,
              cyRaw + oy,
              cosT,
              sinT,
            );
            if (!stats.valid) continue;
            const Q = adaptiveQ(stats.stdDev);
            const dec = qimDecodeSoft(stats.mean, Q);
            if (dec.confidence > bestConf) {
              bestConf = dec.confidence;
              bestBit = dec.bit;
            }
          } else {
            const bx = Math.round(cxRaw - QIM_BLOCK_SIZE / 2) + ox;
            const by = Math.round(cyRaw - QIM_BLOCK_SIZE / 2) + oy;
            if (
              bx < 0 ||
              by < 0 ||
              bx + QIM_BLOCK_SIZE > width ||
              by + QIM_BLOCK_SIZE > height
            ) {
              continue;
            }
            const stats = blockStats(luma, width, bx, by);
            const Q = adaptiveQ(stats.stdDev);
            const dec = qimDecodeSoft(stats.mean, Q);
            if (dec.confidence > bestConf) {
              bestConf = dec.confidence;
              bestBit = dec.bit;
            }
          }
        }
      }
      bits[bi] = bestConf < 0 ? 0 : bestBit;
    }
    stripes[s] = bytesFromBits(bits, stripeLen);
  }

  const erasurePositions: number[] = [];
  for (let s = 0; s < STRIPE_COUNT; s++) {
    if (stripes[s] === null) erasurePositions.push(s);
  }
  const presentCount = STRIPE_COUNT - erasurePositions.length;

  const dec = decodeStripes(stripes);
  if (!dec.ok || dec.data === null) {
    return { ok: false, data: null, presentCount, erasurePositions };
  }
  const data = dec.data.slice(0, payloadLen);
  const out: QimYStripeExtractResult = {
    ok: true,
    data,
    presentCount,
    erasurePositions,
  };
  if (opts.expectedPayload) {
    const exp = opts.expectedPayload;
    let match = data.length === exp.length;
    if (match) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== exp[i]) {
          match = false;
          break;
        }
      }
    }
    return { ...out, match };
  }
  return out;
}
