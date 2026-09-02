// Faz 5 Step 5.8-A.5 (T005) — DCT Mid-Band Stripe Transport.
//
// MOTİVASYON (architect onaylı): Y-QIM (luma-domain) stripe taşıyıcısı D08
// (+30°) altında PDFKit text-noise + sharp.rotate(white-pad) + cascade Hough
// deskew + invDeskew warp **kümülatif** smear zinciri tarafından sıfırlandı.
// 4×4 piksel block-mean Q=24/32 margin=6/8 luma bütçesi yetersiz (T003c, T003d,
// T004G3 üç tur HONEST FAIL kanıtı). Bu modül aynı 8-stripe RS(8,4) layout'u
// LUMA-DOMAIN yerine 8×8 BLOCK DCT MID-BAND coefficient'lara taşır.
//
// Avantaj: DCT katsayısı 64 pikselin ağırlıklı toplamı; per-piksel ±5 luma
// smear coefficient seviyesinde damping görür. Mid-band (k1+k2≈5..7) hem
// bilinear smear (low-pass) hem rotation-aware projection altında low-freq
// (DC/k≤2 yumuşak değişim) ve high-freq (k≥6 gürültü) bandlardan daha selektif
// kalır. Faz 5.5 DCT-Concentric Marker (R1/R2/R3 ringler) bu thesis'i marker
// katmanında zaten kanıtladı; bu modül stripe transport'a aynı dersi uygular.
//
// MİMARİ (stripe layout uyumlu):
//   • Mevcut `planVaultStripeLayout` (vault rect → 8 horizontal slice).
//   • Per slice: tile 8×8 block grid (sliceW/8 × sliceH/8 blocks).
//   • Per block: 4 mid-band coefficient pozisyonu (DCT_MID_POSITIONS) ⇒
//     4 bit/block; stripeLen=9 byte = 72 bit/stripe; ⇒ ≥18 block/slice yeterli.
//     256×64 vault: sliceH=8 ⇒ 32 horizontal block × 1 vertical = 32 block/slice.
//   • QIM scalar quantization per coefficient: Q=32 ⇒ margin Q/4=8 coefficient
//     birimi (≈±1 luma block-genelinde idct sonrası).
//
// EMBED:
//   1. RGB → Y luma (BT.601).
//   2. Per stripe i: encodeStripes(payload)[i] = stripeLen byte, MSB-first bit
//      stream → block-by-block 4 bit/block.
//   3. Per block: 8×8 luma → fdct8 → coefficient[mid-pos] = QIM target;
//      idct8 → newLuma. delta = newLuma − oldLuma per piksel. Uniform RGB
//      delta (R+=d, G+=d, B+=d, clamp 0..255) → chroma intakt, Y aynı dY.
//
// EXTRACT:
//   1. Per block: 8×8 luma → fdct8 → mid-band coefficient'ları → QIM nearest
//      centroid → 4 bit. Block bit'lerini concatenate → stripe bytes.
//   2. RS decode (caller-marked erasures); expectedPayload byte-equal → match.
//
// PROJECTED EXTRACT (rotation/warp dirençli):
//   • Block center'ı template-space'de tanımla; her sample piksel offset
//     `project(xT,yT)` ile RAW'a taşı; sub-pixel bilinear lookup ile 8×8
//     luma footprint reconstruct → fdct8.
//   • Multi-offset 3×3 (template-space ±1 px shift) — her shift için decode +
//     en yüksek "QIM confidence" (residual ortalaması) seçilir.
//
// KIRMIZI ÇİZGİLER:
//   • lib içinde RAW warp YOK — sadece per-piksel bilinear point query
//     (Maskeleme Kanunu).
//   • `match` yalnız `expectedPayload` byte-equal (Match Field Decisive).
//   • sharp/native bağımlılık YOK (Uint8Array + Float64Array).
//   • Y-QIM modülü dokunulmaz (LegacyTransport olarak korunur — feature flag
//     route katmanında).

import { fdct8, idct8, rgbToLuma } from "./dct.js";
import { encodeStripes, decodeStripes, STRIPE_N as STRIPE_COUNT } from "./stripeDistributor.js";
import { planVaultStripeLayout, type VaultStripeLayout } from "./vaultStripedLayout.js";

export const VAULT_DCT_STRIPE_SLICES = STRIPE_COUNT; // 8
export const DCT_BLOCK_SIZE = 8;
/**
 * QIM quantization step on DCT coefficient axis. Q=64 → margin Q/4=16 per
 * coefficient. T005 ilk turda Q=32 sentetik +30°'de bile RS decode ok=false
 * verdi (cumulative bilinear smear coefficient'ları ±10-12 birim oynatıyor).
 * Q=64 + low-mid band (k1+k2 ∈ [3..5]) bilinear low-pass altında daha dirençli.
 * idct8 perturbation 64 piksele yayılır ⇒ pixel RMS ≈ Q/(4·√64) ≈ ±2 luma →
 * PSNR ≥ 36 dB hedefi (T6 sanity).
 */
export const DCT_QIM_Q = 128;
/**
 * 4 LOW-mid-band positions per 8×8 block — diagonal cluster k1+k2 ∈ [3..5].
 * (1,2) ve (2,1) bilinear smear (low-pass filter) altında çok daha dirençli;
 * (2,2) ve (1,3)/(3,1) bant'ı tamamlar. T005 ilk Q=32 + [(2,3),(3,2),(3,3),
 * (2,4)] (k1+k2 ∈ [5..7]) HONEST FAIL kanıtı: high-freq mid-band smear'a
 * dayanmadı.
 */
export const DCT_MID_POSITIONS: readonly (readonly [number, number])[] = [
  [1, 2],
  [2, 1],
  [2, 2],
  [1, 3],
] as const;
export const DCT_BITS_PER_BLOCK = DCT_MID_POSITIONS.length;

/** Decoder-only template-space ±1 px alignment search (3×3 grid). */
const EXTRACT_OFFSETS_X = [-1, 0, 1] as const;
const EXTRACT_OFFSETS_Y = [-1, 0, 1] as const;

export interface DctStripeRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DctStripeEmbedResult {
  readonly layout: VaultStripeLayout;
  readonly stripeLen: number;
  readonly payloadLen: number;
  readonly bitsPerStripe: number;
  readonly blocksPerStripe: number;
}

export interface DctStripeExtractResult {
  readonly ok: boolean;
  readonly data: Uint8Array | null;
  readonly presentCount: number;
  readonly erasurePositions: number[];
  readonly match?: boolean;
}

// ── QIM helpers ──────────────────────────────────────────────────────────
function qimTarget(c: number, b: 0 | 1, Q: number): number {
  const offset = (b * Q) / 2;
  return Math.round((c - offset) / Q) * Q + offset;
}
function qimDecode(c: number, Q: number): { bit: 0 | 1; conf: number } {
  // Two centroids: round(c/Q)*Q (bit=0) and round((c-Q/2)/Q)*Q + Q/2 (bit=1).
  const c0 = Math.round(c / Q) * Q;
  const c1 = Math.round((c - Q / 2) / Q) * Q + Q / 2;
  const d0 = Math.abs(c - c0);
  const d1 = Math.abs(c - c1);
  if (d0 <= d1) return { bit: 0, conf: d1 - d0 };
  return { bit: 1, conf: d0 - d1 };
}

// ── Bilinear luma sampler (per-pixel point query; OOB → -1) ──────────────
function bilinearLuma(luma: Float64Array, w: number, h: number, fx: number, fy: number): number {
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

// ── Block sampler: axis-aligned 8×8 (embed + axis extract) ───────────────
function readBlockAxisAligned(
  luma: Float64Array,
  w: number,
  blockX: number,
  blockY: number,
): Float64Array {
  const out = new Float64Array(64);
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      out[dy * 8 + dx] = luma[(blockY + dy) * w + (blockX + dx)]! - 128;
    }
  }
  return out;
}

// ── Block sampler: rotation-aware (project 64 sample points to raw, bilinear) ─
// `project(xT,yT)` template→raw mapping. Returns null if any sample OOB.
function readBlockProjected(
  luma: Float64Array,
  w: number,
  h: number,
  blockX: number, // template-space top-left x
  blockY: number, // template-space top-left y
  project: (xT: number, yT: number) => { x: number; y: number },
): Float64Array | null {
  const out = new Float64Array(64);
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      // Sample at pixel center (xT+0.5, yT+0.5) for sub-pixel symmetry.
      const xT = blockX + dx + 0.5;
      const yT = blockY + dy + 0.5;
      const p = project(xT, yT);
      const v = bilinearLuma(luma, w, h, p.x - 0.5, p.y - 0.5);
      if (v < 0) return null;
      out[dy * 8 + dx] = v - 128;
    }
  }
  return out;
}

// ── Embed ───────────────────────────────────────────────────────────────
/**
 * Embed RS(8,4)-distributed payload into vault rect via 8×8 DCT mid-band
 * QIM. Mutates `fullRgba` in place. Returns layout + per-stripe stats.
 */
export function embedDctStripes(
  fullRgba: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  rect: DctStripeRect,
  payload: Uint8Array,
): DctStripeEmbedResult {
  if (rect.x + rect.w > fullWidth || rect.y + rect.h > fullHeight)
    throw new Error("dctStripe: rect out of bounds");
  if (rect.x < 0 || rect.y < 0) throw new Error("dctStripe: rect negative origin");
  const layout = planVaultStripeLayout(rect);
  if (!layout) throw new Error("dctStripe: rect too small for 8 slices");
  const stripes = encodeStripes(payload);
  if (stripes.length !== VAULT_DCT_STRIPE_SLICES)
    throw new Error(`dctStripe: encodeStripes returned ${stripes.length}`);
  const stripeLen = stripes[0]!.length;
  const bitsPerStripe = stripeLen * 8;
  const sliceH = layout.sliceH;
  if (sliceH < DCT_BLOCK_SIZE)
    throw new Error(`dctStripe: sliceH=${sliceH} < block=${DCT_BLOCK_SIZE}`);
  const blocksPerRow = Math.floor(rect.w / DCT_BLOCK_SIZE);
  const blocksPerCol = Math.floor(sliceH / DCT_BLOCK_SIZE);
  const blocksPerStripe = blocksPerRow * blocksPerCol;
  const requiredBlocks = Math.ceil(bitsPerStripe / DCT_BITS_PER_BLOCK);
  if (blocksPerStripe < requiredBlocks)
    throw new Error(
      `dctStripe: ${blocksPerStripe} block/slice < ${requiredBlocks} need (${bitsPerStripe} bit / ${DCT_BITS_PER_BLOCK} bpb)`,
    );

  // Convert full RGBA → luma (fast path: full image; we mutate per-block).
  const luma = rgbToLuma(fullRgba, fullWidth, fullHeight, 4);

  for (let s = 0; s < VAULT_DCT_STRIPE_SLICES; s++) {
    const sliceRect = layout.stripeRects[s]!;
    const stripe = stripes[s]!;
    let bitIdx = 0;
    outer: for (let by = 0; by < blocksPerCol; by++) {
      for (let bx = 0; bx < blocksPerRow; bx++) {
        if (bitIdx >= bitsPerStripe) break outer;
        const blockX = sliceRect.x + bx * DCT_BLOCK_SIZE;
        const blockY = sliceRect.y + by * DCT_BLOCK_SIZE;
        const blk = readBlockAxisAligned(luma, fullWidth, blockX, blockY);
        const coeff = fdct8(blk);
        for (let p = 0; p < DCT_BITS_PER_BLOCK; p++) {
          if (bitIdx >= bitsPerStripe) break;
          const [ku, kv] = DCT_MID_POSITIONS[p]!;
          const ki = ku * 8 + kv;
          const c = coeff[ki]!;
          const bit = ((stripe[bitIdx >> 3]! >> (7 - (bitIdx & 7))) & 1) as 0 | 1;
          coeff[ki] = qimTarget(c, bit, DCT_QIM_Q);
          bitIdx++;
        }
        const newBlk = idct8(coeff);
        // Apply delta to RGBA uniformly (chroma intakt).
        for (let dy = 0; dy < 8; dy++) {
          for (let dx = 0; dx < 8; dx++) {
            const oldY = blk[dy * 8 + dx]!;
            const newY = newBlk[dy * 8 + dx]!;
            const delta = newY - oldY;
            const px = ((blockY + dy) * fullWidth + (blockX + dx)) * 4;
            for (let ch = 0; ch < 3; ch++) {
              const v = fullRgba[px + ch]! + delta;
              fullRgba[px + ch] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
            }
            // Update luma cache for downstream blocks (in case slices touch).
            luma[(blockY + dy) * fullWidth + (blockX + dx)] = newY + 128;
          }
        }
      }
    }
  }

  return {
    layout,
    stripeLen,
    payloadLen: payload.length,
    bitsPerStripe,
    blocksPerStripe,
  };
}

// ── Extract (axis-aligned, no projection) ────────────────────────────────
function decodeStripeFromBlocks(
  luma: Float64Array,
  fullWidth: number,
  sliceX: number,
  sliceY: number,
  blocksPerRow: number,
  blocksPerCol: number,
  stripeLen: number,
  // optional projection for rotation-aware sample
  project?: (xT: number, yT: number) => { x: number; y: number },
  fullHeight?: number,
): { stripe: Uint8Array; conf: number } | null {
  const bits = stripeLen * 8;
  const out = new Uint8Array(stripeLen);
  let totalConf = 0;
  let bitIdx = 0;
  for (let by = 0; by < blocksPerCol; by++) {
    for (let bx = 0; bx < blocksPerRow; bx++) {
      if (bitIdx >= bits) break;
      const blockX = sliceX + bx * DCT_BLOCK_SIZE;
      const blockY = sliceY + by * DCT_BLOCK_SIZE;
      const blk = project
        ? readBlockProjected(luma, fullWidth, fullHeight!, blockX, blockY, project)
        : readBlockAxisAligned(luma, fullWidth, blockX, blockY);
      if (!blk) return null;
      const coeff = fdct8(blk);
      for (let p = 0; p < DCT_BITS_PER_BLOCK; p++) {
        if (bitIdx >= bits) break;
        const [ku, kv] = DCT_MID_POSITIONS[p]!;
        const c = coeff[ku * 8 + kv]!;
        const dec = qimDecode(c, DCT_QIM_Q);
        const byteOff = bitIdx >> 3;
        out[byteOff] = ((out[byteOff]! << 1) | dec.bit) & 0xff;
        totalConf += dec.conf;
        bitIdx++;
      }
    }
  }
  return { stripe: out, conf: totalConf / Math.max(1, bits) };
}

/**
 * Axis-aligned extract: identity projection equivalent. Used for clean
 * roundtrip + integration parity tests.
 */
export function extractDctStripes(
  fullRgba: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  rect: DctStripeRect,
  payloadLen: number,
  options?: {
    erasures?: readonly number[];
    expectedPayload?: Uint8Array;
  },
): DctStripeExtractResult {
  return extractDctStripesProjected(
    fullRgba,
    fullWidth,
    fullHeight,
    rect,
    payloadLen,
    (xT, yT) => ({ x: xT, y: yT }),
    options,
  );
}

/**
 * Projected extract: sample 8×8 block centered in template-space, mapped to
 * raw via `project(xT,yT)`. 3×3 multi-offset (template-space ±1 px) soft
 * decision. Match yalnız expectedPayload byte-equal.
 */
export function extractDctStripesProjected(
  fullRgba: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  rect: DctStripeRect,
  payloadLen: number,
  project: (xT: number, yT: number) => { x: number; y: number },
  options?: {
    erasures?: readonly number[];
    expectedPayload?: Uint8Array;
  },
): DctStripeExtractResult {
  const layout = planVaultStripeLayout(rect);
  if (!layout) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }
  const sliceH = layout.sliceH;
  if (sliceH < DCT_BLOCK_SIZE) {
    return { ok: false, data: null, presentCount: 0, erasurePositions: [] };
  }
  const blocksPerRow = Math.floor(rect.w / DCT_BLOCK_SIZE);
  const blocksPerCol = Math.floor(sliceH / DCT_BLOCK_SIZE);
  const paddedLen = Math.ceil((payloadLen + 1) / 4) * 4;
  const stripeLen = paddedLen / 4;

  const luma = rgbToLuma(fullRgba, fullWidth, fullHeight, 4);

  // Per stripe: try 3×3 template-space ±1 offset; pick the one that gives
  // best BYTE-EQUAL match against expected stripe (eğer expected verilirse,
  // RS decode sonrası), aksi halde en yüksek QIM confidence.
  const stripes: Uint8Array[] = [];
  for (let s = 0; s < VAULT_DCT_STRIPE_SLICES; s++) {
    const sliceRect = layout.stripeRects[s]!;
    let best: { stripe: Uint8Array; conf: number } | null = null;
    for (const dy of EXTRACT_OFFSETS_Y) {
      for (const dx of EXTRACT_OFFSETS_X) {
        const projShift = (xT: number, yT: number) => project(xT + dx, yT + dy);
        const got = decodeStripeFromBlocks(
          luma,
          fullWidth,
          sliceRect.x,
          sliceRect.y,
          blocksPerRow,
          blocksPerCol,
          stripeLen,
          projShift,
          fullHeight,
        );
        if (!got) continue;
        if (!best || got.conf > best.conf) best = got;
      }
    }
    stripes.push(best ? best.stripe : new Uint8Array(stripeLen));
  }

  const erasureSet = new Set<number>(options?.erasures ?? []);
  const stripesForDecode: (Uint8Array | null)[] = stripes.map((s, i) =>
    erasureSet.has(i) ? null : s,
  );
  const dec = decodeStripes(stripesForDecode);
  let match: boolean | undefined;
  if (options?.expectedPayload) {
    match = false;
    if (dec.ok && dec.data.length === options.expectedPayload.length) {
      match = true;
      for (let i = 0; i < options.expectedPayload.length; i++) {
        if (dec.data[i] !== options.expectedPayload[i]) {
          match = false;
          break;
        }
      }
    }
  }
  return {
    ok: dec.ok,
    data: dec.ok ? dec.data : null,
    presentCount: dec.presentCount,
    erasurePositions: [...dec.erasurePositions],
    ...(match !== undefined ? { match } : {}),
  };
}
