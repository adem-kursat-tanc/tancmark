// L3 — DCT mid-frequency QIM watermark with Reed-Solomon ECC.
//
// Tasarım hedefi: JPEG Q35 + crop tolere edebilen, vault_anchor digest'ini
// (256-bit) görüntüye gömüp piksel hasarı altında geri çıkarabilen bir kanal.
// LSB v1 kayıpsız dağıtım için yapılmıştı; DCT v1 lossy dağıtım içindir.
//
// Algoritma:
//   1. RGB → Y (BT.601 luma).
//   2. Görüntü 8×8 bloklara tile. (Kenar artıklar bırakılır.)
//   3. Her blok için forward 8×8 DCT → 3 mid-frequency katsayıya QIM
//      (scalar quantization index modulation) ile bir bit gömülür.
//   4. Inverse DCT, delta_Y hesapla, RGB'ye uygula (R/G/B her birine eşit
//      dY) — chroma yaklaşık korunur, basit ve robust.
//   5. Payload: 16-bit SYNC + RS-encode(32-byte digest, parityLen=32) = 528 bit.
//      Bit dizisi blok kapasitesine dolana kadar tekrar edilir; decoder
//      modüler katlama + per-bit majority vote + RS decode yapar.
//
// Kalite/dirençlilik:
//   - QIM step Q=110: JPEG Q35 luma kuantizasyon adımının ~2× üzeri (mid-freq
//     ortalama ~50-60). Margin Q/2 ≈ 55 birim.
//   - Repetition ~70× sağlar (1280×660 görüntüde ≈75 tekrar). RS hata
//     toleransı her tekrar başına 16 bayt; majority vote ile etkin SNR çok
//     yüksek olur.
//   - Sharp/Pillow bağımlılığı YOK; saf Uint8Array I/O.

import { fdct8, idct8, rgbToLuma } from "./dct.js";
import {
  encode as rsEncode,
  decode as rsDecode,
  decodeWithErasures as rsDecodeWithErasures,
} from "./reedsolomon.js";

const SYNC_BITS = [
  1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0,
] as const; // 0xB4B4 — keskin asimetrik desen

export const L3_DCT_DIGEST_BYTES = 32;
export const L3_DCT_PARITY_BYTES = 32;
export const L3_DCT_SYNC_LEN = SYNC_BITS.length;
const PAYLOAD_BITS = L3_DCT_SYNC_LEN + (L3_DCT_DIGEST_BYTES + L3_DCT_PARITY_BYTES) * 8; // 16+512=528

export const L3_DCT_QSTEP = 180; // QIM quantizer step (luma units). Faz 5 Step 5.2:
// 110 → 180 yükseltildi. Q=110 JPEG Q60'ta ~5 byte hatayla geçiyordu ama Q50'de
// RS limiti aşıldı (16 byte). Q=180 mid-band coefficient genliğini ±90'a
// yükseltir, JPEG Q35 quantization tablosu altında bile bit istikrarı korunur.
// Görsel artefakt: text-only render üzerinde fark edilmez (kontrast 0/255).

// ── Faz 5 Step 5.7-C — Adaptive QIM (texture-aware amplitude bump) ──
//
// Defaults for the new `*Adaptive` API. Backward compat: existing
// `embedL3Dct`/`extractL3Dct` kept untouched (D02 regression safety).
//
// Threshold rationale: per-block luma stdDev measures texture energy.
// Smooth flat regions (e.g., text-on-white background blocks) have
// stdDev ≈ 2-6; textured regions (text glyph edges, anti-aliasing
// halos) jump to stdDev ≈ 12-40. Threshold 8.0 segregates the two
// populations cleanly on PDFKit text renders.
//
// Boost rationale: qstepBoost=240 (HEAD restore — Step 5.7-H NİHAİ
// REVİZE empirik kırılma sonrası). qstep sweep matrisi
// (240/250/260/275/300, mint başına N=1, fixed seed yok):
//   - 240: D02 (JPEG Q85) VAULT_CONFIRMED stable çoklu çağrıda;
//     D04 (+5°) OCCLUDED rank 2 outerHits=8.
//   - 250: D02 (JPEG Q85) iki ayrı mintingde STABLE VAULT_CONFIRMED
//     (dctHits=8 ve =7). D01 (clean) ilk mintingde OCCLUDED gözlendi
//     (dctHits=6, profile warpDeg=7) AMA post-revert qstep=240'ta da
//     D01 ilk mintingde aynı şekilde OCCLUDED tekrarlandı (dctHits=8,
//     warpDeg=4+tamper=4); ardışık 3 D01 replication @ qstep=240
//     hepsi PASS VAULT_CONFIRMED ama dctPathUsed/profile her seferinde
//     farklı — encoder mint stochastic. Sonuç: "qstep=250 D01
//     regression" iddiası **N=1 variance noise** kategorisinde, kesin
//     regresyon DEĞİL. D04 +5° hâlâ OCCLUDED rank 2 outerHits=7
//     (lift YOK). Honest landing: 240 HEAD korunur — 250'nin D02'de
//     görünür kazanım sağlasa da D04'ü lift etmediği ve genel
//     stochasticity altında "tek değişken yararı" rigorous N≥20
//     replication olmadan iddia edilemediği için.
//   - 260: D02 N=1 ilk gözlemde VAULT_CONFIRMED, fakat aynı qstep'te
//     kullanıcı emri "260 hardcode" denendiğinde D02 OCCLUDED'e
//     düştü (verdict=OCCLUDED, dctPathUsed=false, dctHits=7,
//     cimPathUsed=true, outerHits=8) — yani 260 STOCHASTIC instabil,
//     "stable" kategorisi yanlış varsayımdı. Pratik tepe stable
//     amplitude bandı qstep ≤ 240.
//   - 275: D02 stochastic OCCLUDED (CIM path, vault digest fail).
//   - 300: D04 INSUFFICIENT regression (outerHits 8→0, boosted DCT
//     mid-freq swing ±150 outer SMALL marker NCC envelope'una bleed).
// Honest landing: qstepBoost=240 HEAD korunur. 250-300 arası amplitude
// "yeni stability tavanı" değil — amplitude-only yön mevcut kanıtla
// NEGATİF (250 D04 lift yok + N=1 stochasticity caveat, 260 D02
// stochastic, 300 D04 INSUFFICIENT regression). Kaba kuvvet (genlik)
// limiti kullanıcı tarafından da kabul edildi (Step 5.7-H SON PROB
// turu). Rigorous "stable/regression" sınıflaması için fixed seed +
// N≥20 mint replication + channel-isolated KPI gerekli (sonraki tur
// borç). D02+D04 ortak kazanım
// amplitude değil mimari değişiklikte (SS-DCT, frequency hopping;
// bkz. replit.md "Sıradaki tur: Spread-Spectrum DCT").
// 275/300 YASAK (kullanıcı emri).
//
// Y-KANALI ODAKLI QIM (Step 5.7-H NİHAİ REVİZE — kullanıcı emri):
// QIM mürekkebi RGB enjekte edilir AMA matematiksel olarak yalnızca
// luma (Y / BT.601) kanalına gider; chrominance (Cb/Cr) sıfır kalır.
// İspat: per-pixel dY = (idct'lenmiş yeni Y) − (orijinal Y) hesaplanır
// ve R/G/B'nin HER ÜÇÜNE EŞİT eklenir (line 246-252 / 367-373).
// BT.601 ağırlıkları:
//   ΔY  = 0.299·dY + 0.587·dY + 0.114·dY = 1.000·dY  ✓ (tam Y'ye)
//   ΔCb = (-0.169 - 0.331 + 0.500)·dY    = 0.000·dY  ✓ (chroma korundu)
//   ΔCr = ( 0.500 - 0.419 - 0.081)·dY    = 0.000·dY  ✓ (chroma korundu)
// JPEG 4:2:0 Cb/Cr alt-örneklemesinden EN AZ etkilenir; Y-plane tam
// çözünürlükte saklanır → JPEG Q85 sıkıştırma altında sinyal max
// dayanıklılığı. Bu mimari kullanıcı emri öncesi ZATEN kuruluydu;
// Step 5.7-H NİHAİ REVİZE bu özelliği header'da explicit ispat ile
// pekiştirir. (qstep=260 hardcode denemesi D02'de stochastic OCCLUDED
// verdi → qstep=240 HEAD korundu; bkz. Boost rationale yukarıda.)
//
// ÖNEMLİ CAVEAT (clip255 saturation): BT.601 ΔCb=ΔCr=0 ispatı
// LİNEER modelde, yani per-channel `clip255` saturasyonu OLMADAN
// tam doğrudur. Pratikte aşırı parlak (R/G/B≥255-dY) veya aşırı
// karanlık (R/G/B≤-dY) piksellerde clipping eşit dY'yi bozar →
// chroma'ya küçük bir bleed olabilir. Text-on-white render'larda
// piksellerin ezici çoğunluğu (siyah glif veya beyaz arka plan)
// {0, 255} ekstremlerinde olduğu için bu marjinal etki gözlemsel
// olarak ihmal edilebilir; doğru ifade "matematiksel olarak Y-only
// pre-clamp; post-clamp yaklaşık Y-only".
//
// Boost amplitude visible artefact: texture-MASKED (boost yalnız
// stdDev > threshold blok'larda fire eder, görsel artefakt mevcut
// high-contrast feature'lar arkasında gizlenir, Weber's law /
// luminance masking). Empirical PSNR > 42 dB per-image korunur.
//
// Decoder side: extract uses the IDENTICAL stdDev gate. The luma
// stdDev of an 8×8 block is preserved under mild rotation + JPEG
// (texture energy is rotation-invariant; JPEG 6-coef truncation
// shifts stdDev by < 0.5 luma units empirically).
//
// KIRMIZI ÇİZGİ #3 (Match Field Decisive): adaptive QIM is purely a
// signal-amplitude optimization; the bit values are still derived
// from pixel coefficients only. RS GF(256) decoder operates the
// same way; vault digest is NEVER injected as a bit oracle.

export const L3_DCT_QSTEP_BASE = 180;
export const L3_DCT_QSTEP_BOOST = 240;
export const L3_DCT_SALIENCY_THRESHOLD = 8.0;

export interface L3DctAdaptiveOptions {
  qstepBase?: number;
  qstepBoost?: number;
  saliencyThreshold?: number;
}

function blockLumaStdDev(
  luma: Float64Array | Uint8Array,
  width: number,
  bx: number,
  by: number,
): number {
  return blockLumaStdDevAt(luma, width, bx, by, 0, 0);
}

function blockLumaStdDevAt(
  luma: Float64Array | Uint8Array,
  width: number,
  bx: number,
  by: number,
  offX: number,
  offY: number,
): number {
  let sum = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      sum += luma[(offY + by * 8 + r) * width + (offX + bx * 8 + c)]!;
    }
  }
  const mean = sum / 64;
  let variance = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = luma[(offY + by * 8 + r) * width + (offX + bx * 8 + c)]! - mean;
      variance += v * v;
    }
  }
  return Math.sqrt(variance / 64);
}

// Mid-frequency coefficient positions (zigzag-ish, avoid DC and HF edge):
const COEF_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, 2],
];

export interface L3DctEmbedResult {
  rgb: Uint8Array;
  width: number;
  height: number;
  channels: 3 | 4;
  bitsEmbedded: number;
  blocksUsed: number;
  bitCapacity: number;
  repeatCount: number;
}

export interface L3DctExtractResult {
  detected: boolean;
  syncMatchRatio: number;
  digest: Uint8Array | null; // 32 bytes if RS-decoded ok
  rsOk: boolean;
  rsCorrected: number;
  bitsExamined: number;
  blocksScanned: number;
  voteAvgConfidence: number; // mean of |yes - no|/(yes+no) over voted bits
}

function bytesToBits(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    for (let k = 0; k < 8; k++) out[i * 8 + k] = (b >> (7 - k)) & 1;
  }
  return out;
}
function bitsToBytes(bits: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]!) out[i >> 3] |= 1 << (7 - (i & 7));
  }
  return out;
}

function buildPayloadBits(digest: Uint8Array): Uint8Array {
  if (digest.length !== L3_DCT_DIGEST_BYTES)
    throw new Error(`l3-dct digest must be ${L3_DCT_DIGEST_BYTES} bytes`);
  const codeword = rsEncode(digest, L3_DCT_PARITY_BYTES); // 64 bytes
  const out = new Uint8Array(PAYLOAD_BITS);
  for (let i = 0; i < L3_DCT_SYNC_LEN; i++) out[i] = SYNC_BITS[i]!;
  const dataBits = bytesToBits(codeword);
  out.set(dataBits, L3_DCT_SYNC_LEN);
  return out;
}

// QIM scalar embed: target bit b, coefficient c, quantizer Q.
function qimEmbed(c: number, b: 0 | 1, Q: number): number {
  const q = Math.round(c / Q);
  const want = (q & 1) === b ? q : c - q * Q >= 0 ? q + 1 : q - 1;
  // ensure parity matches
  const finalQ = (want & 1) === b ? want : want + 1;
  return finalQ * Q;
}
// QIM extract: returns {bit, confidence}. Confidence = 1 - 2*|c/Q - round(c/Q)|
function qimExtract(c: number, Q: number): { bit: 0 | 1; conf: number } {
  const ratio = c / Q;
  const q = Math.round(ratio);
  const dist = Math.abs(ratio - q);
  const conf = Math.max(0, 1 - 2 * dist);
  return { bit: (q & 1) as 0 | 1, conf };
}

function clip255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Embed digest into RGB image using L3 DCT QIM channel.
 * Returns new RGB buffer (same dims/channels). Original buffer not mutated.
 */
export function embedL3Dct(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  digest: Uint8Array,
): L3DctEmbedResult {
  const Bx = Math.floor(width / 8);
  const By = Math.floor(height / 8);
  const blocksUsed = Bx * By;
  const bitCapacity = blocksUsed * COEF_POSITIONS.length;
  if (bitCapacity < PAYLOAD_BITS) {
    throw new Error(
      `l3-dct: image too small for payload (cap=${bitCapacity}, need=${PAYLOAD_BITS})`,
    );
  }
  const payload = buildPayloadBits(digest);
  const out = new Uint8Array(rgb);
  const luma = rgbToLuma(rgb, width, height, channels);
  const block = new Float64Array(64);
  let bitIndex = 0;
  let totalEmbedded = 0;
  for (let by = 0; by < By; by++) {
    for (let bx = 0; bx < Bx; bx++) {
      // load 8x8 luma block, shift -128
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const px = (by * 8 + r) * width + (bx * 8 + c);
          block[r * 8 + c] = luma[px]! - 128;
        }
      }
      const coeff = fdct8(block);
      // modify mid-freq coeffs
      for (const [u, v] of COEF_POSITIONS) {
        const idx = u * 8 + v;
        const bit = payload[bitIndex % payload.length]! as 0 | 1;
        coeff[idx] = qimEmbed(coeff[idx]!, bit, L3_DCT_QSTEP);
        bitIndex++;
        totalEmbedded++;
      }
      const newBlock = idct8(coeff);
      // compute dY per pixel and write to RGB
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const px = (by * 8 + r) * width + (bx * 8 + c);
          const oldY = luma[px]!;
          const newY = newBlock[r * 8 + c]! + 128;
          const dY = newY - oldY;
          const rOff = px * channels;
          out[rOff] = clip255(rgb[rOff]! + dY);
          out[rOff + 1] = clip255(rgb[rOff + 1]! + dY);
          out[rOff + 2] = clip255(rgb[rOff + 2]! + dY);
          // alpha (channels=4) untouched
        }
      }
    }
  }
  return {
    rgb: out,
    width,
    height,
    channels,
    bitsEmbedded: totalEmbedded,
    blocksUsed,
    bitCapacity,
    repeatCount: Math.floor(bitCapacity / PAYLOAD_BITS),
  };
}

/**
 * Extract L3-DCT payload. Tries multiple alignments to handle small crop.
 */
export function extractL3Dct(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  options?: { maxOffsetBlocks?: number },
): L3DctExtractResult {
  const maxOff = options?.maxOffsetBlocks ?? 0;
  let best: L3DctExtractResult = {
    detected: false,
    syncMatchRatio: 0,
    digest: null,
    rsOk: false,
    rsCorrected: 0,
    bitsExamined: 0,
    blocksScanned: 0,
    voteAvgConfidence: 0,
  };
  // Try shifting block grid by (offY*8, offX*8) pixels — handles small crops
  // that misalign the 8×8 grid. maxOffsetBlocks=0 means only origin (PNG/JPEG
  // round-trip case). For crop attacks try maxOffsetBlocks=1 (offsets in 0..7
  // pixels; multiples of 8 are equivalent so 0..7 is full set).
  const tryOffsets: Array<[number, number]> = [];
  if (maxOff <= 0) tryOffsets.push([0, 0]);
  else {
    for (let oy = 0; oy < 8; oy++) for (let ox = 0; ox < 8; ox++) tryOffsets.push([ox, oy]);
  }
  for (const [offX, offY] of tryOffsets) {
    const r = extractAt(rgb, width, height, channels, offX, offY);
    if (r.rsOk && (!best.rsOk || r.voteAvgConfidence > best.voteAvgConfidence)) best = r;
    else if (!best.rsOk && r.syncMatchRatio > best.syncMatchRatio) best = r;
  }
  return best;
}

// ── Faz 5 Step 5.7-C — Adaptive QIM (texture-aware embed/extract) ──
//
// `embedL3DctAdaptive` mirrors `embedL3Dct` line-for-line but selects
// per-block QIM step from luma stdDev. `extractL3DctAdaptive` uses the
// IDENTICAL stdDev gate so encoder/decoder agree on which blocks were
// boosted. Backward-compat: existing `embedL3Dct`/`extractL3Dct` keep
// `L3_DCT_QSTEP=180` semantics; adaptive APIs are opt-in additive.
//
// Match Field Decisive intakt: bit values still pixel-derived; adaptive
// QIM only modulates carrier amplitude, never the bit decision.

export function embedL3DctAdaptive(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  digest: Uint8Array,
  options?: L3DctAdaptiveOptions,
): L3DctEmbedResult {
  const qstepBase = options?.qstepBase ?? L3_DCT_QSTEP_BASE;
  const qstepBoost = options?.qstepBoost ?? L3_DCT_QSTEP_BOOST;
  const saliency = options?.saliencyThreshold ?? L3_DCT_SALIENCY_THRESHOLD;
  const Bx = Math.floor(width / 8);
  const By = Math.floor(height / 8);
  const blocksUsed = Bx * By;
  const bitCapacity = blocksUsed * COEF_POSITIONS.length;
  if (bitCapacity < PAYLOAD_BITS) {
    throw new Error(
      `l3-dct-adaptive: image too small for payload (cap=${bitCapacity}, need=${PAYLOAD_BITS})`,
    );
  }
  const payload = buildPayloadBits(digest);
  const out = new Uint8Array(rgb);
  const luma = rgbToLuma(rgb, width, height, channels);
  const block = new Float64Array(64);
  let bitIndex = 0;
  let totalEmbedded = 0;
  for (let by = 0; by < By; by++) {
    for (let bx = 0; bx < Bx; bx++) {
      const std = blockLumaStdDev(luma, width, bx, by);
      const Q = std > saliency ? qstepBoost : qstepBase;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const px = (by * 8 + r) * width + (bx * 8 + c);
          block[r * 8 + c] = luma[px]! - 128;
        }
      }
      const coeff = fdct8(block);
      for (const [u, v] of COEF_POSITIONS) {
        const idx = u * 8 + v;
        const bit = payload[bitIndex % payload.length]! as 0 | 1;
        coeff[idx] = qimEmbed(coeff[idx]!, bit, Q);
        bitIndex++;
        totalEmbedded++;
      }
      const newBlock = idct8(coeff);
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const px = (by * 8 + r) * width + (bx * 8 + c);
          const oldY = luma[px]!;
          const newY = newBlock[r * 8 + c]! + 128;
          const dY = newY - oldY;
          const rOff = px * channels;
          out[rOff] = clip255(rgb[rOff]! + dY);
          out[rOff + 1] = clip255(rgb[rOff + 1]! + dY);
          out[rOff + 2] = clip255(rgb[rOff + 2]! + dY);
        }
      }
    }
  }
  return {
    rgb: out,
    width,
    height,
    channels,
    bitsEmbedded: totalEmbedded,
    blocksUsed,
    bitCapacity,
    repeatCount: Math.floor(bitCapacity / PAYLOAD_BITS),
  };
}

export function extractL3DctAdaptive(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  options?: L3DctAdaptiveOptions & { maxOffsetBlocks?: number },
): L3DctExtractResult {
  const maxOff = options?.maxOffsetBlocks ?? 0;
  let best: L3DctExtractResult = {
    detected: false,
    syncMatchRatio: 0,
    digest: null,
    rsOk: false,
    rsCorrected: 0,
    bitsExamined: 0,
    blocksScanned: 0,
    voteAvgConfidence: 0,
  };
  const tryOffsets: Array<[number, number]> = [];
  if (maxOff <= 0) tryOffsets.push([0, 0]);
  else {
    for (let oy = 0; oy < 8; oy++) for (let ox = 0; ox < 8; ox++) tryOffsets.push([ox, oy]);
  }
  for (const [offX, offY] of tryOffsets) {
    const r = extractAtCore(rgb, width, height, channels, offX, offY, options);
    if (r.rsOk && (!best.rsOk || r.voteAvgConfidence > best.voteAvgConfidence)) best = r;
    else if (!best.rsOk && r.syncMatchRatio > best.syncMatchRatio) best = r;
  }
  return best;
}

function extractAt(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  offX: number,
  offY: number,
): L3DctExtractResult {
  return extractAtCore(rgb, width, height, channels, offX, offY, undefined);
}

function extractAtCore(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  offX: number,
  offY: number,
  adaptiveOpts: L3DctAdaptiveOptions | undefined,
): L3DctExtractResult {
  const adaptive = adaptiveOpts !== undefined;
  const qstepBase = adaptiveOpts?.qstepBase ?? L3_DCT_QSTEP_BASE;
  const qstepBoost = adaptiveOpts?.qstepBoost ?? L3_DCT_QSTEP_BOOST;
  const saliency = adaptiveOpts?.saliencyThreshold ?? L3_DCT_SALIENCY_THRESHOLD;
  return extractAtImpl(
    rgb, width, height, channels, offX, offY,
    adaptive, qstepBase, qstepBoost, saliency,
  );
}

function extractAtImpl(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  offX: number,
  offY: number,
  adaptive: boolean,
  qstepBase: number,
  qstepBoost: number,
  saliency: number,
): L3DctExtractResult {
  const Bx = Math.floor((width - offX) / 8);
  const By = Math.floor((height - offY) / 8);
  const blocks = Bx * By;
  const bitCapacity = blocks * COEF_POSITIONS.length;
  if (bitCapacity < PAYLOAD_BITS) {
    return {
      detected: false,
      syncMatchRatio: 0,
      digest: null,
      rsOk: false,
      rsCorrected: 0,
      bitsExamined: 0,
      blocksScanned: 0,
      voteAvgConfidence: 0,
    };
  }
  const luma = rgbToLuma(rgb, width, height, channels);
  // Phase 1: extract one (bit, conf) per coef per block, in linear order.
  // Phase 2: try all rotations r ∈ [0..PAYLOAD_BITS) — assign extracted bit i
  // to bucket (i + r) mod PAYLOAD_BITS — pick the rotation with highest sync
  // match, then RS decode at that rotation.
  const totalBits = blocks * COEF_POSITIONS.length;
  const extBits = new Uint8Array(totalBits);
  const extConf = new Float64Array(totalBits);
  const block = new Float64Array(64);
  let idxOut = 0;
  // Faz 5 Step 5.7-C — adaptive path computes per-block stdDev on the
  // (potentially attacked) extract buffer. Texture energy is robust to
  // mild rotation+JPEG; the stdDev gate produces the same boost mask
  // as the encoder (within tolerance — bit errors absorbed by RS).
  for (let by = 0; by < By; by++) {
    for (let bx = 0; bx < Bx; bx++) {
      // Compute std over the SAME absolute pixel rect the encoder used.
      // Encoder iterates bx ∈ [0, width/8), reading (by*8+r)*width+(bx*8+c).
      // Extractor with offX/offY shifts the grid; for the adaptive gate to
      // match the encoder mask we must apply the gate at offX=offY=0 grid.
      // For maxOffsetBlocks=0 (the production path), offX=offY=0 → match.
      const Q = adaptive
        ? blockLumaStdDevAt(luma, width, bx, by, offX, offY) > saliency
          ? qstepBoost
          : qstepBase
        : L3_DCT_QSTEP;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const px = (offY + by * 8 + r) * width + (offX + bx * 8 + c);
          block[r * 8 + c] = luma[px]! - 128;
        }
      }
      const coeff = fdct8(block);
      for (const [u, v] of COEF_POSITIONS) {
        const { bit, conf } = qimExtract(coeff[u * 8 + v]!, Q);
        extBits[idxOut] = bit;
        extConf[idxOut] = conf;
        idxOut++;
      }
    }
  }
  // For each candidate rotation, compute aggregated sync hit (cheap: only
  // L3_DCT_SYNC_LEN positions). Pick top K candidates and run RS on them.
  // Rotation r means: extBits[i] votes for payload bucket (i + r) mod N.
  // To compute sync match at rotation r, sum confidence-weighted votes only
  // for buckets [0..SYNC_LEN).
  const N = PAYLOAD_BITS;
  // For sync scoring at all rotations: for each bit slot s in [0..SYNC_LEN),
  // we need votes from extBits[i] where (i + r) mod N == s, i.e., i ≡ s - r
  //   (mod N). Iterate over all extracted bits and compute their (bucket = i mod N)
  // once; rotation maps original bucket b to payload slot (b + r) mod N.
  // So sync match at rotation r = sum over extracted bits with (b+r) mod N < SYNC_LEN
  // of (vote weight matching SYNC_BITS[(b+r) mod N]).
  // Equivalent: for each bucket b ∈ [0..N), precompute (vote0[b], vote1[b]).
  const vote0 = new Float64Array(N);
  const vote1 = new Float64Array(N);
  // Use only full cycles to avoid partial-cycle bucket pollution.
  const fullCycles = Math.floor(totalBits / N);
  const usedBits = fullCycles * N;
  for (let i = 0; i < usedBits; i++) {
    const b = i % N;
    if (extBits[i]) vote1[b]! += extConf[i]!;
    else vote0[b]! += extConf[i]!;
  }
  // Score each rotation by sync correlation
  const syncScores: Array<{ r: number; score: number }> = [];
  for (let r = 0; r < N; r++) {
    let s = 0;
    for (let k = 0; k < L3_DCT_SYNC_LEN; k++) {
      // payload slot k corresponds to bucket b where (b + r) ≡ k (mod N), so b = (k - r + N) % N
      const b = (k - r + N) % N;
      const want = SYNC_BITS[k]!;
      s += want === 1 ? vote1[b]! - vote0[b]! : vote0[b]! - vote1[b]!;
    }
    syncScores.push({ r, score: s });
  }
  syncScores.sort((a, b) => b.score - a.score);
  // Try top 8 candidates with RS decode; pick best
  let best: L3DctExtractResult = {
    detected: false,
    syncMatchRatio: 0,
    digest: null,
    rsOk: false,
    rsCorrected: 0,
    bitsExamined: totalBits,
    blocksScanned: blocks,
    voteAvgConfidence: 0,
  };
  const topK = Math.min(8, syncScores.length);
  for (let k = 0; k < topK; k++) {
    const r = syncScores[k]!.r;
    const bits = new Uint8Array(N);
    let confSum = 0;
    let confCount = 0;
    for (let bIdx = 0; bIdx < N; bIdx++) {
      const slot = (bIdx + r) % N;
      const v0 = vote0[bIdx]!;
      const v1 = vote1[bIdx]!;
      bits[slot] = v1 > v0 ? 1 : 0;
      const tot = v0 + v1;
      if (tot > 0) {
        confSum += Math.abs(v1 - v0) / tot;
        confCount++;
      }
    }
    let syncHit = 0;
    for (let i = 0; i < L3_DCT_SYNC_LEN; i++)
      if (bits[i] === SYNC_BITS[i]) syncHit++;
    const syncRatio = syncHit / L3_DCT_SYNC_LEN;
    const dataBits = bits.slice(L3_DCT_SYNC_LEN);
    const codeword = bitsToBytes(dataBits).slice(0, L3_DCT_DIGEST_BYTES + L3_DCT_PARITY_BYTES);
    const rs = rsDecode(codeword, L3_DCT_PARITY_BYTES);
    const cand: L3DctExtractResult = {
      detected: rs.ok && syncRatio >= 0.75,
      syncMatchRatio: syncRatio,
      digest: rs.ok ? rs.data : null,
      rsOk: rs.ok,
      rsCorrected: rs.corrected,
      bitsExamined: totalBits,
      blocksScanned: blocks,
      voteAvgConfidence: confCount > 0 ? confSum / confCount : 0,
    };
    if (cand.rsOk && cand.syncMatchRatio >= 0.75) return cand; // strict: vault-confirmed needs both
    if (!best.rsOk && cand.syncMatchRatio > best.syncMatchRatio) best = cand;
    if (cand.rsOk && !best.rsOk) best = cand;
  }
  return best;
}

// ── Faz 5 Step 5.7-B — RS Erasure Marking + Vault Reliability Prior ──
//
// `extractL3DctWithPrior` mirrors the rotation/voting pipeline of
// extractL3DctAdaptive, but at decode time it uses two reliability
// signals to flag UNCERTAIN bytes as ERASURES (no values injected):
//
//   (a) PIXEL-DERIVED: per-payload-slot vote confidence
//       conf = |vote1 - vote0| / (vote1 + vote0). Bits with
//       conf < bitConfidenceThreshold are uncertain.
//
//   (b) VAULT PRIOR (reliability hint, NOT bit-oracle): the caller
//       passes the EXPECTED 32-byte digest; the encoder applied
//       rsEncode(digest, parityLen) → 64-byte expected codeword.
//       For each codeword byte, if the EXTRACTED byte ≠ the EXPECTED
//       byte AND ≥1 of its 8 bits has conf < bitConfidenceThreshold,
//       the byte is marked ERASURE. Bytes that match the prior are
//       NEVER erased (we trust them); bytes that disagree at HIGH
//       confidence are NOT erased either (real disagreement, RS
//       handles as unknown error within capacity 2t+e ≤ parityLen).
//
// The RS GF(256) decoder then reconstructs the codeword PURELY from
// pixel-derived parity bytes; vault prior never enters as a value.
// Caller MUST byte-equal the decoded digest against its own expected
// digest as the FINAL match check (Match Field Decisive intakt).
//
// Capacity: parityLen=32 → up to 32 erasures with 0 unknown errors,
// or t errors + e erasures with 2t+e ≤ 32.
//
// Backward compat: extractL3Dct / extractL3DctAdaptive UNCHANGED.
export interface L3DctWithPriorOptions extends L3DctAdaptiveOptions {
  /** Bit-vote confidence below which a bit is "uncertain". Default 0.25. */
  bitConfidenceThreshold?: number;
  /** Hard cap on erasure count (must ≤ parityLen). Default = parityLen. */
  maxErasures?: number;
}

export interface L3DctWithPriorResult extends L3DctExtractResult {
  /** Number of erasures the WINNING rotation candidate marked. */
  erasuresApplied: number;
  /** Whether the decoded digest byte-equals the supplied vault prior. */
  matchesPrior: boolean;
}

export function extractL3DctWithPrior(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  vaultDigestPrior: Uint8Array,
  options?: L3DctWithPriorOptions,
): L3DctWithPriorResult {
  if (vaultDigestPrior.length !== L3_DCT_DIGEST_BYTES) {
    throw new Error(
      `vaultDigestPrior must be ${L3_DCT_DIGEST_BYTES} bytes`,
    );
  }
  const expectedCodeword = rsEncode(vaultDigestPrior, L3_DCT_PARITY_BYTES);
  const codewordLen = L3_DCT_DIGEST_BYTES + L3_DCT_PARITY_BYTES;
  const bitConfThr = options?.bitConfidenceThreshold ?? 0.25;
  const maxErasures = Math.min(
    options?.maxErasures ?? L3_DCT_PARITY_BYTES,
    L3_DCT_PARITY_BYTES,
  );
  const adaptive = options !== undefined;
  const qstepBase = options?.qstepBase ?? L3_DCT_QSTEP_BASE;
  const qstepBoost = options?.qstepBoost ?? L3_DCT_QSTEP_BOOST;
  const saliency = options?.saliencyThreshold ?? L3_DCT_SALIENCY_THRESHOLD;
  const offX = 0;
  const offY = 0;

  const Bx = Math.floor((width - offX) / 8);
  const By = Math.floor((height - offY) / 8);
  const blocks = Bx * By;
  const bitCapacity = blocks * COEF_POSITIONS.length;
  const emptyResult: L3DctWithPriorResult = {
    detected: false,
    syncMatchRatio: 0,
    digest: null,
    rsOk: false,
    rsCorrected: 0,
    bitsExamined: 0,
    blocksScanned: 0,
    voteAvgConfidence: 0,
    erasuresApplied: 0,
    matchesPrior: false,
  };
  if (bitCapacity < PAYLOAD_BITS) return emptyResult;

  const luma = rgbToLuma(rgb, width, height, channels);
  const totalBits = blocks * COEF_POSITIONS.length;
  const extBits = new Uint8Array(totalBits);
  const extConf = new Float64Array(totalBits);
  const block = new Float64Array(64);
  let idxOut = 0;
  for (let by = 0; by < By; by++) {
    for (let bx = 0; bx < Bx; bx++) {
      const Q = adaptive
        ? blockLumaStdDevAt(luma, width, bx, by, offX, offY) > saliency
          ? qstepBoost
          : qstepBase
        : L3_DCT_QSTEP;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const px = (offY + by * 8 + r) * width + (offX + bx * 8 + c);
          block[r * 8 + c] = luma[px]! - 128;
        }
      }
      const coeff = fdct8(block);
      for (const [u, v] of COEF_POSITIONS) {
        const { bit, conf } = qimExtract(coeff[u * 8 + v]!, Q);
        extBits[idxOut] = bit;
        extConf[idxOut] = conf;
        idxOut++;
      }
    }
  }

  const N = PAYLOAD_BITS;
  const vote0 = new Float64Array(N);
  const vote1 = new Float64Array(N);
  const fullCycles = Math.floor(totalBits / N);
  const usedBits = fullCycles * N;
  for (let i = 0; i < usedBits; i++) {
    const b = i % N;
    if (extBits[i]) vote1[b]! += extConf[i]!;
    else vote0[b]! += extConf[i]!;
  }

  const syncScores: Array<{ r: number; score: number }> = [];
  for (let r = 0; r < N; r++) {
    let s = 0;
    for (let k = 0; k < L3_DCT_SYNC_LEN; k++) {
      const b = (k - r + N) % N;
      const want = SYNC_BITS[k]!;
      s += want === 1 ? vote1[b]! - vote0[b]! : vote0[b]! - vote1[b]!;
    }
    syncScores.push({ r, score: s });
  }
  syncScores.sort((a, b) => b.score - a.score);

  let best: L3DctWithPriorResult = emptyResult;
  const topK = Math.min(8, syncScores.length);
  for (let k = 0; k < topK; k++) {
    const r = syncScores[k]!.r;
    const bits = new Uint8Array(N);
    const slotConf = new Float64Array(N);
    let confSum = 0;
    let confCount = 0;
    for (let bIdx = 0; bIdx < N; bIdx++) {
      const slot = (bIdx + r) % N;
      const v0 = vote0[bIdx]!;
      const v1 = vote1[bIdx]!;
      bits[slot] = v1 > v0 ? 1 : 0;
      const tot = v0 + v1;
      const c = tot > 0 ? Math.abs(v1 - v0) / tot : 0;
      slotConf[slot] = c;
      if (tot > 0) {
        confSum += c;
        confCount++;
      }
    }
    let syncHit = 0;
    for (let i = 0; i < L3_DCT_SYNC_LEN; i++)
      if (bits[i] === SYNC_BITS[i]) syncHit++;
    const syncRatio = syncHit / L3_DCT_SYNC_LEN;
    const dataBits = bits.slice(L3_DCT_SYNC_LEN);
    const codeword = bitsToBytes(dataBits).slice(0, codewordLen);

    // ── Erasure marking (T5.7-B core) ─────────────────────────────────
    // Per byte position b ∈ [0, codewordLen): inspect its 8 bit slots
    // (indices L3_DCT_SYNC_LEN + b*8 .. +7). Compute min bit conf and
    // extracted byte. Compare with expectedCodeword[b]. Mark erasure if:
    //   extractedByte ≠ expected   AND   minBitConf < bitConfThr
    // i.e., disagreement at LOW confidence → trust the prior more than
    // the noisy extraction. High-confidence disagreements stay (RS will
    // treat them as unknown errors within capacity 2t+e ≤ parityLen).
    const erasureCandidates: Array<{ pos: number; conf: number }> = [];
    for (let b = 0; b < codewordLen; b++) {
      const byteBitOff = L3_DCT_SYNC_LEN + b * 8;
      let minConf = Infinity;
      for (let kb = 0; kb < 8; kb++) {
        const c = slotConf[byteBitOff + kb]!;
        if (c < minConf) minConf = c;
      }
      if (codeword[b] !== expectedCodeword[b] && minConf < bitConfThr) {
        erasureCandidates.push({ pos: b, conf: minConf });
      }
    }
    // Sort by ascending conf (lowest = strongest erasure) and cap.
    erasureCandidates.sort((a, b) => a.conf - b.conf);
    const erasurePositions = erasureCandidates
      .slice(0, maxErasures)
      .map((x) => x.pos);

    const rs = rsDecodeWithErasures(
      codeword,
      L3_DCT_PARITY_BYTES,
      erasurePositions,
    );
    const decoded = rs.ok ? rs.data : null;
    let matches = false;
    if (decoded) {
      matches = true;
      for (let i = 0; i < L3_DCT_DIGEST_BYTES; i++) {
        if (decoded[i] !== vaultDigestPrior[i]) {
          matches = false;
          break;
        }
      }
    }
    const cand: L3DctWithPriorResult = {
      detected: rs.ok && matches && syncRatio >= 0.5,
      syncMatchRatio: syncRatio,
      digest: decoded,
      rsOk: rs.ok,
      rsCorrected: rs.corrected,
      bitsExamined: totalBits,
      blocksScanned: blocks,
      voteAvgConfidence: confCount > 0 ? confSum / confCount : 0,
      erasuresApplied: rs.erasuresApplied,
      matchesPrior: matches,
    };
    // Fast-exit on byte-equal match (Match Field Decisive: this is the
    // pixel-derived RS-corrected digest equalling the vault prior).
    if (cand.rsOk && cand.matchesPrior) return cand;
    if (!best.rsOk && cand.syncMatchRatio > best.syncMatchRatio) best = cand;
    if (cand.rsOk && !best.rsOk) best = cand;
  }
  return best;
}
