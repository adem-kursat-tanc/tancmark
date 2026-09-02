/**
 * Faz 5 Step 5.3 T2 — Vault Region (V1 compactId DCT + V3 pHash integrity)
 *
 * Görselin merkezindeki sabit bir sub-rect'e (default %20 alan, 8'in
 * katlarına yuvarlı) iki kanal yazar:
 *
 *   • V1 — compactId carrier: vault_anchor.payloadDigestSha256'nın ilk
 *     32 byte'ı RS(64,32)-encode + DCT QIM ile sub-rect'e gömülür.
 *     Step 5.2 `embedL3Dct` doğrudan sub-rect üzerinde reuse edilir.
 *
 *   • V3 — pHash integrity: sub-rect luma 32×32'ye downsample → 32×32 DCT
 *     → top 8×8 low-freq (DC hariç) → median threshold → 64-bit hash.
 *     Embed anında hesaplanıp `vault_metadata` jsonb'ye saklanır;
 *     verify anında recompute + Hamming distance ≤ kalibrasyon eşiği.
 *
 *   • V2 — DB-resident PQC: yeni anahtar yok. compactId match'i
 *     `vault_anchors_digest_idx` üzerinden ML-DSA-65 imza doğrulamasını
 *     tetikler (mevcut `verifyVaultAnchorRaw` path'i).
 *
 * Tasarım:
 *   • lib `sharp`-free; sadece Uint8Array + Float64Array.
 *   • Sub-rect koordinatları 8'in katı garantili → l3Dct grid hizalanır.
 *   • Tüm fonksiyonlar pure: yeni buffer/dizi döner; in-place mutation
 *     sadece `embedVaultV1` içinde sub-rect kopyasında olur, caller'a
 *     full-image dışı sızmaz.
 */

import { embedL3Dct, extractL3Dct, L3_DCT_DIGEST_BYTES } from "./l3Dct.js";

export interface VaultRectSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Target ~20% area of full image. */
const VAULT_AREA_TARGET = 0.20;

/** Minimum vault edge (px). l3Dct 528-bit payload kapasite kuralı:
 *   blocks = floor(side/8)² · coefs/blok = 3 → bit kapasitesi.
 *   • 96² → 12² = 144 blok × 3 = 432 bit  → THROW (yetmez).
 *   • 112² → 14² = 196 blok × 3 = 588 bit → tight (1.11 rep).
 *   • 128² → 16² = 256 blok × 3 = 768 bit → 1.45 rep (architect-recommended floor).
 *  pHash 32×32 downsample bin kararlılığı için de ≥128 sağlıklı (≥4px/bin).
 *  Daha küçük döndürmek = embedVaultV1 throw → caller `null` görmeli. */
const VAULT_MIN_EDGE = 128;

/** Cap so vault rect doesn't dominate image (max 60% of min edge). */
const VAULT_MAX_RATIO = 0.6;

/**
 * Center sub-rect with area ≈ 20% of image (square, side snapped to multiple of 8).
 * Non-square görsellerde area-based hesap (sqrt(W·H·0.20)) kullanılır → minEdge
 * tabanlı eski yaklaşımın 1280×720'de %11'e düşme bug'ı kapanır.
 *
 * Returns null if a payload-safe vault region (≥128×128 / ≥VAULT_MIN_EDGE)
 * fit etmiyorsa — caller yumuşak başarısız olmalı (vault layer skip).
 */
export function computeVaultRect(width: number, height: number): VaultRectSpec | null {
  // Area-based ideal side
  let side = Math.floor(Math.sqrt(width * height * VAULT_AREA_TARGET) / 8) * 8;
  // Cap by image dim (must fit and not dominate)
  const minEdge = Math.min(width, height);
  const maxSide = Math.floor((minEdge * VAULT_MAX_RATIO) / 8) * 8;
  if (side > maxSide) side = maxSide;
  // Floor: V1 payload + pHash stability
  if (side < VAULT_MIN_EDGE) return null;
  const x = Math.floor((width - side) / 2 / 8) * 8;
  const y = Math.floor((height - side) / 2 / 8) * 8;
  return { x, y, w: side, h: side };
}

/** Extract RGBA sub-rect into a tightly-packed new buffer. */
export function extractRgbaSubRect(
  rgba: Uint8Array,
  width: number,
  rect: VaultRectSpec,
): Uint8Array {
  const out = new Uint8Array(rect.w * rect.h * 4);
  for (let r = 0; r < rect.h; r++) {
    const srcStart = ((rect.y + r) * width + rect.x) * 4;
    const dstStart = r * rect.w * 4;
    out.set(rgba.subarray(srcStart, srcStart + rect.w * 4), dstStart);
  }
  return out;
}

/** Write a sub-rect RGBA buffer back into a full-image RGBA buffer. */
export function writeRgbaSubRect(
  fullRgba: Uint8Array,
  fullWidth: number,
  rect: VaultRectSpec,
  sub: Uint8Array,
): void {
  for (let r = 0; r < rect.h; r++) {
    const dstStart = ((rect.y + r) * fullWidth + rect.x) * 4;
    const srcStart = r * rect.w * 4;
    fullRgba.set(sub.subarray(srcStart, srcStart + rect.w * 4), dstStart);
  }
}

export interface VaultV1EmbedResult {
  bitsEmbedded: number;
  blocksUsed: number;
  bitCapacity: number;
  repeatCount: number;
}

/**
 * V1 — embed compactId (32 bytes) into vault sub-rect via L3-DCT.
 * Mutates `fullRgba` IN PLACE within the sub-rect.
 */
export function embedVaultV1(
  fullRgba: Uint8Array,
  width: number,
  height: number,
  rect: VaultRectSpec,
  compactId: Uint8Array,
): VaultV1EmbedResult {
  if (compactId.length !== L3_DCT_DIGEST_BYTES) {
    throw new Error(`vault V1 compactId must be ${L3_DCT_DIGEST_BYTES} bytes`);
  }
  if (rect.x + rect.w > width || rect.y + rect.h > height) {
    throw new Error("vault rect out of bounds");
  }
  const sub = extractRgbaSubRect(fullRgba, width, rect);
  const r = embedL3Dct(sub, rect.w, rect.h, 4, compactId);
  writeRgbaSubRect(fullRgba, width, rect, r.rgb);
  return {
    bitsEmbedded: r.bitsEmbedded,
    blocksUsed: r.blocksUsed,
    bitCapacity: r.bitCapacity,
    repeatCount: r.repeatCount,
  };
}

export interface VaultV1ExtractResult {
  detected: boolean;
  rsOk: boolean;
  syncMatchRatio: number;
  compactId: Uint8Array | null;
  rsCorrected: number;
  voteAvgConfidence: number;
  /**
   * `expectedCompactId` verildiğinde TRUE iff RS-decode sonucu byte-byte eşleşir.
   * Architect guard (T2 review): caller'ın yanlışlıkla `rsOk` veya `detected`
   * üzerinden karar vermesini önler — L3-DCT noise altında non-vault sub-rect
   * dahi rsOk=true verebilir, kritik kapı `match`'tir.
   */
  match: boolean;
}

/**
 * V1 — extract compactId from vault sub-rect via L3-DCT.
 *
 * `expectedCompactId` opsiyonel: verildiğinde extractVaultV1 byte-byte equality
 * kontrolü yapar ve `match` field'ını döner. T6 entegrasyon kontratı:
 *
 *   const r = extractVaultV1(rgba, w, h, rect, { expectedCompactId: anchor.payloadDigestSha256 });
 *   if (r.match) {  // ← TEK doğru gate. detected/rsOk değil.
 *     // V2 PQC verify, vault-confirmed yolu açılır.
 *   }
 */
export function extractVaultV1(
  fullRgba: Uint8Array,
  width: number,
  height: number,
  rect: VaultRectSpec,
  options?: { maxOffsetBlocks?: number; expectedCompactId?: Uint8Array | Buffer },
): VaultV1ExtractResult {
  if (rect.x + rect.w > width || rect.y + rect.h > height) {
    return {
      detected: false,
      rsOk: false,
      syncMatchRatio: 0,
      compactId: null,
      rsCorrected: 0,
      voteAvgConfidence: 0,
      match: false,
    };
  }
  const sub = extractRgbaSubRect(fullRgba, width, rect);
  const r = extractL3Dct(sub, rect.w, rect.h, 4, { maxOffsetBlocks: options?.maxOffsetBlocks });
  let match = false;
  if (r.digest && options?.expectedCompactId) {
    const exp = options.expectedCompactId;
    if (exp.length === r.digest.length) {
      match = true;
      for (let i = 0; i < exp.length; i++) {
        if (exp[i] !== r.digest[i]) {
          match = false;
          break;
        }
      }
    }
  }
  return {
    detected: r.detected,
    rsOk: r.rsOk,
    syncMatchRatio: r.syncMatchRatio,
    compactId: r.digest,
    rsCorrected: r.rsCorrected,
    voteAvgConfidence: r.voteAvgConfidence,
    match,
  };
}

// ──────────────────────────────────────────────────────────────────────
// V3 — perceptual hash (pHash). Standard pHash flow:
//   1. Convert to luma, downsample to 32×32 via box filter (mean of bins).
//   2. 32×32 forward DCT.
//   3. Take top 8×8 low-freq block, drop DC, median-threshold remaining 63
//      coefficients → 63-bit hash (we pad to 64 bits with parity).
// ──────────────────────────────────────────────────────────────────────

const PHASH_BITS = 64;
const PHASH_LOWFREQ = 8;
const PHASH_DOWNSAMPLE = 32;

/** RGBA sub-rect → Float64Array luma (BT.601). */
function rgbaSubToLuma(sub: Uint8Array, w: number, h: number): Float64Array {
  const luma = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = sub[i * 4]!;
    const g = sub[i * 4 + 1]!;
    const b = sub[i * 4 + 2]!;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}

/** Downsample luma to 32×32 via mean-of-bin box filter. */
function downsampleLuma32(luma: Float64Array, w: number, h: number): Float64Array {
  const out = new Float64Array(PHASH_DOWNSAMPLE * PHASH_DOWNSAMPLE);
  for (let oy = 0; oy < PHASH_DOWNSAMPLE; oy++) {
    const y0 = Math.floor((oy * h) / PHASH_DOWNSAMPLE);
    const y1 = Math.floor(((oy + 1) * h) / PHASH_DOWNSAMPLE);
    for (let ox = 0; ox < PHASH_DOWNSAMPLE; ox++) {
      const x0 = Math.floor((ox * w) / PHASH_DOWNSAMPLE);
      const x1 = Math.floor(((ox + 1) * w) / PHASH_DOWNSAMPLE);
      let sum = 0;
      let count = 0;
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          sum += luma[py * w + px]!;
          count++;
        }
      }
      out[oy * PHASH_DOWNSAMPLE + ox] = count > 0 ? sum / count : 0;
    }
  }
  return out;
}

/** N×N 1D DCT-II (orthonormal). */
function dctN1d(input: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n);
  const sqrtInv = Math.sqrt(1 / n);
  const sqrt2 = Math.sqrt(2 / n);
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += input[i]! * Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n));
    }
    out[k] = (k === 0 ? sqrtInv : sqrt2) * sum;
  }
  return out;
}

/** N×N 2D DCT (separable). N=32 → ~64K ops, ~1ms. */
function dct2d(input: Float64Array, n: number): Float64Array {
  const tmp = new Float64Array(n * n);
  const out = new Float64Array(n * n);
  const row = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) row[c] = input[r * n + c]!;
    const rd = dctN1d(row, n);
    for (let c = 0; c < n; c++) tmp[r * n + c] = rd[c]!;
  }
  const col = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) col[r] = tmp[r * n + c]!;
    const cd = dctN1d(col, n);
    for (let r = 0; r < n; r++) out[r * n + c] = cd[r]!;
  }
  return out;
}

/**
 * Compute 64-bit pHash of vault sub-rect. Returns a Buffer of 8 bytes.
 * Stable under JPEG, brightness/contrast, mild noise; sensitive to crop
 * inside the vault region or content tampering.
 */
export function computeVaultPHash(
  fullRgba: Uint8Array,
  width: number,
  height: number,
  rect: VaultRectSpec,
): Buffer {
  if (rect.x + rect.w > width || rect.y + rect.h > height) {
    throw new Error("vault rect out of bounds");
  }
  const sub = extractRgbaSubRect(fullRgba, width, rect);
  const luma = rgbaSubToLuma(sub, rect.w, rect.h);
  const downsampled = downsampleLuma32(luma, rect.w, rect.h);
  const coeff = dct2d(downsampled, PHASH_DOWNSAMPLE);

  // Top-left 8×8 low-freq block, skip DC (0,0). 63 coefficients.
  const lowFreq: number[] = [];
  for (let r = 0; r < PHASH_LOWFREQ; r++) {
    for (let c = 0; c < PHASH_LOWFREQ; c++) {
      if (r === 0 && c === 0) continue;
      lowFreq.push(coeff[r * PHASH_DOWNSAMPLE + c]!);
    }
  }
  // Median threshold
  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;

  const hash = Buffer.alloc(8);
  for (let i = 0; i < 64; i++) {
    // i = 0 → DC slot (set to 1 by convention, since DC excluded). i = 1..63 → lowFreq[i-1]
    const v = i === 0 ? median + 1 : lowFreq[i - 1]!;
    if (v > median) {
      hash[i >> 3]! |= 1 << (7 - (i & 7));
    }
  }
  return hash;
}

/**
 * Hamming distance between two 64-bit pHashes. Typical thresholds:
 *   • ≤ 8 → essentially identical (clean roundtrip + JPEG Q60+).
 *   • 9–14 → similar but mild manipulation likely.
 *   • ≥ 15 → meaningfully different content (TAMPER_SUSPECTED candidate).
 */
export function pHashHamming(a: Buffer | Uint8Array, b: Buffer | Uint8Array): number {
  if (a.length !== b.length) throw new Error("pHash length mismatch");
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = (a[i]! ^ b[i]!) & 0xff;
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export const VAULT_REGION_PHASH_BITS = PHASH_BITS;

// ──────────────────────────────────────────────────────────────────────
// Faz 5 Step 5.3 T6 — "Maskeleme Kanunu" (Mask Law).
//
// extractVaultV1 köşelerine basılan 4 inner sync marker'ı RS-decoder'dan
// ÖNCE NÖTR LUMA ile maskelemek ZORUNLU. Marker stamp aksi halde DCT
// majority-vote'unu yanlış codeword'e çekiyor (rsOk=true, match=false).
//
// Kural: pHash ÖNCE hesaplanır (final marker'lı state — embed sırası ile
// simetri). Mask SADECE compactId extraction için. Gri tonu vault rect'in
// marker-dışı bölgesinden hesaplanır → tampered/occluded subrect'lerde
// kararlı kalır.
// ──────────────────────────────────────────────────────────────────────

export interface InnerMarkerPatch {
  /** Pixel-space x of patch top-left (full image coords). */
  x: number;
  /** Pixel-space y of patch top-left (full image coords). */
  y: number;
  /** Patch edge length (px). Square. */
  size: number;
}

/**
 * Compute the mean luma of the vault sub-rect EXCLUDING the 4 inner-marker
 * patches. This is the neutral fill used by `maskInnerMarkerPatches`.
 *
 * Patches outside the rect are simply ignored. Returns 128 if no non-patch
 * pixels remain (edge case — degenerate input).
 */
export function computeVaultRectMeanLumaExcludingPatches(
  fullRgba: Uint8Array,
  width: number,
  height: number,
  rect: VaultRectSpec,
  patches: ReadonlyArray<InnerMarkerPatch>,
): number {
  let sum = 0;
  let count = 0;
  const xMax = Math.min(width, rect.x + rect.w);
  const yMax = Math.min(height, rect.y + rect.h);
  for (let y = rect.y; y < yMax; y++) {
    for (let x = rect.x; x < xMax; x++) {
      let inPatch = false;
      for (const p of patches) {
        if (x >= p.x && x < p.x + p.size && y >= p.y && y < p.y + p.size) {
          inPatch = true;
          break;
        }
      }
      if (inPatch) continue;
      const i = (y * width + x) * 4;
      const r = fullRgba[i]!;
      const g = fullRgba[i + 1]!;
      const b = fullRgba[i + 2]!;
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }
  return count > 0 ? sum / count : 128;
}

/**
 * Fill the 4 inner-marker patches with neutral luma (R=G=B=fillValue), in
 * place on `fullRgba`. Alpha is preserved. Pixels outside image bounds are
 * skipped silently.
 *
 * Caller MUST compute pHash on the un-masked image first (per embed-time
 * convention); this mask is only applied right before `extractVaultV1`.
 */
export function maskInnerMarkerPatches(
  fullRgba: Uint8Array,
  width: number,
  height: number,
  patches: ReadonlyArray<InnerMarkerPatch>,
  fillValue: number,
): void {
  const v = Math.max(0, Math.min(255, Math.round(fillValue)));
  for (const p of patches) {
    const xMax = Math.min(width, p.x + p.size);
    const yMax = Math.min(height, p.y + p.size);
    const x0 = Math.max(0, p.x);
    const y0 = Math.max(0, p.y);
    for (let y = y0; y < yMax; y++) {
      let i = (y * width + x0) * 4;
      for (let x = x0; x < xMax; x++) {
        fullRgba[i] = v;
        fullRgba[i + 1] = v;
        fullRgba[i + 2] = v;
        i += 4;
      }
    }
  }
}
