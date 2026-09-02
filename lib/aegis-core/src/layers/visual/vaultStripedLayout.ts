/**
 * Step 5.8-A.2 — Vault Striped Layout (RS(8,4) Dağıtılmış Zırh Entegrasyon Katmanı)
 *
 * Mevcut tek monolitik vault region (`vaultRegion.ts` `embedVaultV1`/
 * `extractVaultV1` 32-byte L3-DCT digest) DOKUNULMAZ — bu modül
 * paralel/ek bir transport katmanıdır: vault rect içinde 8 horizontal
 * stripe slice tanımlar, her slice'a R-channel LSB ile bir
 * stripeDistributor stripe yazar (MSB-first). Decode tarafında 8 slice
 * okunur, caller'ın işaretlediği erasure'lar ile decodeStripes çağırılır.
 *
 * Hedef: ≤4 slice tahrip olsa (overpaint, crop, sub-region tamper) bile
 * payload kurtarılabilsin → "Vault_Stripes_Recovered" semantiği.
 *
 * KIRMIZI ÇİZGİ: lib sharp-free; sadece Uint8Array. Bu lib yapı taşı —
 * mint/detect route entegrasyonu sıradaki tur (T002b). Otomatik erasure
 * tespiti (CRC vs match-against-expected fallback) route katmanında.
 *
 * Layout invariants:
 *   • stripeRect[i] = { x: rect.x, y: rect.y + i*sliceH, w: rect.w, h: sliceH }
 *   • sliceH = floor(rect.h / 8); (rect.h % 8) artık piksel kullanılmaz.
 *   • Capacity per slice = sliceH * rect.w bit (R-channel LSB; 1 bit/pixel).
 *   • Stripe payload bits = stripeLen * 8; sığmazsa throw.
 */

import type { VaultRectSpec } from "./vaultRegion.js";
import {
  encodeStripes,
  decodeStripes,
  STRIPE_N,
  type DecodeStripesResult,
} from "./stripeDistributor.js";

/** N=8 stripe = 8 horizontal slice. */
export const VAULT_STRIPE_SLICES = STRIPE_N; // = 8

export interface VaultStripeLayout {
  /** 8 horizontal sub-rects covering vault region (sliceH each). */
  stripeRects: VaultRectSpec[];
  /** Per-slice height (pixels). */
  sliceH: number;
  /** Per-slice payload capacity (bytes), R-channel LSB only. */
  capacityBytes: number;
}

/**
 * Plan stripe layout inside a vault rect. Returns null if the rect is
 * too small for 8 horizontal slices (rect.h < 8 or capacity < 1 byte).
 */
export function planVaultStripeLayout(rect: VaultRectSpec): VaultStripeLayout | null {
  if (rect.w <= 0 || rect.h < VAULT_STRIPE_SLICES) return null;
  const sliceH = Math.floor(rect.h / VAULT_STRIPE_SLICES);
  if (sliceH <= 0) return null;
  const capacityBits = sliceH * rect.w; // 1 LSB per pixel R-channel
  const capacityBytes = Math.floor(capacityBits / 8);
  if (capacityBytes < 1) return null;
  const stripeRects: VaultRectSpec[] = [];
  for (let i = 0; i < VAULT_STRIPE_SLICES; i++) {
    stripeRects.push({
      x: rect.x,
      y: rect.y + i * sliceH,
      w: rect.w,
      h: sliceH,
    });
  }
  return { stripeRects, sliceH, capacityBytes };
}

/** Write `stripe` bytes (MSB-first per byte) into R-channel LSB of slice. */
function writeStripeBitsLsb(
  fullRgba: Uint8Array,
  fullWidth: number,
  slice: VaultRectSpec,
  stripe: Uint8Array,
): void {
  const bits = stripe.length * 8;
  const cap = slice.w * slice.h;
  if (bits > cap)
    throw new Error(
      `vaultStriped: stripe ${stripe.length}B (${bits} bits) > slice cap ${cap} pixels`,
    );
  let bitIdx = 0;
  for (let py = 0; py < slice.h; py++) {
    for (let px = 0; px < slice.w; px++) {
      if (bitIdx >= bits) return;
      const byteIdx = (stripe[bitIdx >> 3]! >> (7 - (bitIdx & 7))) & 1;
      const fxy = ((slice.y + py) * fullWidth + (slice.x + px)) * 4;
      // R-channel LSB
      fullRgba[fxy] = (fullRgba[fxy]! & 0xfe) | byteIdx;
      bitIdx++;
    }
  }
}

/** Read `stripeLen` bytes (MSB-first) from R-channel LSB of slice. */
function readStripeBitsLsb(
  fullRgba: Uint8Array,
  fullWidth: number,
  slice: VaultRectSpec,
  stripeLen: number,
): Uint8Array {
  const out = new Uint8Array(stripeLen);
  const bits = stripeLen * 8;
  let bitIdx = 0;
  for (let py = 0; py < slice.h; py++) {
    for (let px = 0; px < slice.w; px++) {
      if (bitIdx >= bits) return out;
      const fxy = ((slice.y + py) * fullWidth + (slice.x + px)) * 4;
      const bit = fullRgba[fxy]! & 1;
      const byteOff = bitIdx >> 3;
      out[byteOff] = (out[byteOff]! << 1) | bit;
      // Note: shift-left builds MSB-first. After 8 bits we'll naturally
      // start filling the next byte (since we wrote it with byteOff += 1
      // every 8 bits). But we need to gate the shift so the LAST bit of
      // each byte ends in bit-0, not be over-shifted. The above works
      // because each byte gets exactly 8 shifts.
      bitIdx++;
    }
  }
  return out;
}

export interface VaultStripeEmbedResult {
  layout: VaultStripeLayout;
  stripeLen: number;
  payloadLen: number;
}

/**
 * Encode `payload` via stripeDistributor (RS(8,4)) and write 8 stripes
 * into the R-channel LSB of 8 horizontal slices in `rect`. Mutates
 * `fullRgba` in place. Returns layout + per-stripe size.
 *
 * Throws if rect is too small for 8 slices, or any stripe doesn't fit
 * its slice capacity.
 */
export function embedVaultStriped(
  fullRgba: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  rect: VaultRectSpec,
  payload: Uint8Array,
): VaultStripeEmbedResult {
  if (rect.x + rect.w > fullWidth || rect.y + rect.h > fullHeight)
    throw new Error("vaultStriped: rect out of bounds");
  const layout = planVaultStripeLayout(rect);
  if (!layout) throw new Error("vaultStriped: rect too small for 8 slices");
  const stripes = encodeStripes(payload);
  if (stripes.length !== VAULT_STRIPE_SLICES)
    throw new Error(`vaultStriped: encodeStripes returned ${stripes.length}`);
  const stripeLen = stripes[0]!.length;
  if (stripeLen > layout.capacityBytes)
    throw new Error(
      `vaultStriped: stripe ${stripeLen}B > slice cap ${layout.capacityBytes}B`,
    );
  for (let i = 0; i < VAULT_STRIPE_SLICES; i++) {
    writeStripeBitsLsb(fullRgba, fullWidth, layout.stripeRects[i]!, stripes[i]!);
  }
  return { layout, stripeLen, payloadLen: payload.length };
}

export interface VaultStripeExtractResult extends DecodeStripesResult {
  /** True iff `expectedPayload` provided and decoded data byte-equals it. */
  match: boolean;
  /** Per-slice raw bytes read (length = VAULT_STRIPE_SLICES). */
  rawStripes: Uint8Array[];
}

/**
 * Read 8 stripes from R-channel LSB of `rect`'s slices and decode via
 * stripeDistributor. Caller may mark up to 4 stripes as erasures via
 * `erasures` (positions 0..7). With `expectedPayload`, returns `match`
 * after byte-equality.
 *
 * NOT YET implemented: automatic erasure detection (CRC per stripe or
 * match-against-expected exhaustive fallback). Caller responsibility
 * (route integration layer T002b).
 */
export function extractVaultStriped(
  fullRgba: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  rect: VaultRectSpec,
  payloadLen: number,
  options?: {
    erasures?: readonly number[];
    expectedPayload?: Uint8Array;
  },
): VaultStripeExtractResult {
  if (rect.x + rect.w > fullWidth || rect.y + rect.h > fullHeight) {
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount: 0,
      erasurePositions: [],
      match: false,
      rawStripes: [],
    };
  }
  const layout = planVaultStripeLayout(rect);
  if (!layout) {
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount: 0,
      erasurePositions: [],
      match: false,
      rawStripes: [],
    };
  }
  // Determine stripeLen from payloadLen the same way encoder does.
  // padded length = ceil((payloadLen+1)/4)*4; stripeLen = padded/4.
  const paddedLen = Math.ceil((payloadLen + 1) / 4) * 4;
  const stripeLen = paddedLen / 4;
  const rawStripes: Uint8Array[] = [];
  for (let i = 0; i < VAULT_STRIPE_SLICES; i++) {
    rawStripes.push(
      readStripeBitsLsb(fullRgba, fullWidth, layout.stripeRects[i]!, stripeLen),
    );
  }
  const erasureSet = new Set<number>(options?.erasures ?? []);
  const stripesForDecode: (Uint8Array | null)[] = rawStripes.map((s, i) =>
    erasureSet.has(i) ? null : s,
  );
  const dec = decodeStripes(stripesForDecode);
  let match = false;
  if (dec.ok && options?.expectedPayload) {
    const exp = options.expectedPayload;
    if (exp.length === dec.data.length) {
      match = true;
      for (let i = 0; i < exp.length; i++) {
        if (exp[i] !== dec.data[i]) {
          match = false;
          break;
        }
      }
    }
  }
  return { ...dec, match, rawStripes };
}
