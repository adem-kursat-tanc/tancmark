/**
 * Step 5.8-A.2 — RS(8,4) Stripe Distributor (Sistematik Erasure Code)
 *
 * Vault payload'ı için "Dağıtılmış Zırh" yapı taşı: K=4 data shard
 * + N-K=4 parity shard. Herhangi K=4 stripe ile recover; ≤4 stripe
 * (ankor) silinse/bozulsa bile şifre kurtarılabilir.
 *
 * Mevcut `reedsolomon.ts` byte-level GF(256) sistematik RS encoder
 * yeniden kullanılır:
 *   • Her byte pozisyonu p için: data nibble = [s[0][p], s[1][p],
 *     s[2][p], s[3][p]] (4 byte) → encode(.,4) → codeword 8 byte:
 *     `[parity[0..3], data[0..3]]` (RS lib output order — line 117-122).
 *   • 8 stripe inşa edilir: stripe[j][p] = codeword[j] for j∈[0,8).
 *   • Decode: her p için codeword[0..7] toplanır (missing=0), erasure
 *     positions decodeWithErasures'a verilir → recovered data 4 byte.
 *
 * KIRMIZI ÇİZGİ: lib sharp-free, FFT-free, native YOK. Sadece Uint8Array
 * + reedsolomon primitives.
 *
 * Performance: O(L) per byte position; L = secretLen/4. Yığın ~256 byte
 * secret → 64 pozisyon × 8C4 RS solve ≤ 5 ms (uzak bütçe).
 *
 * Pad scheme (PKCS#7-light): secret K=4'ün katı değilse 1..3 byte
 * `paddingLen` byte ile pad; padding değeri = paddingLen. Decode
 * padding'i strip eder. paddingLen=0 (tam katı) → trailer YOK.
 */

import { encode as rsEncode, decodeWithErasures } from "./reedsolomon.js";

/** 4 data + 4 parity = 8 stripe; herhangi 4 ile recover. */
export const STRIPE_K = 4 as const;
export const STRIPE_N = 8 as const;
export const STRIPE_PARITY = STRIPE_N - STRIPE_K; // = 4

export interface DecodeStripesResult {
  ok: boolean;
  data: Uint8Array;
  /** Kullanılabilir stripe sayısı (erasure değil). */
  presentCount: number;
  /** Erasure pozisyonları (decode'a verilen). */
  erasurePositions: readonly number[];
}

/**
 * Secret'i 8 stripe'a dağıt. Her stripe = `Uint8Array(stripeLen)`.
 *
 * stripeLen = ceil((secret.length + 1) / 4) * 1   (padding header dahil).
 *
 * Pad: secret'i 4-multiple uzunluğa kadar pad bytes ekle. paddingLen
 * 0..3 ∈ [0,3]; trailer son byte = paddingLen (paddingLen=0 ise son
 * byte = 0). Bu policy decoder'ın padding'i deterministik strip
 * etmesine olanak verir.
 *
 * NOT: padding scheme deterministik tek-byte trailer; bu yüzden
 * encodeStripes input length 0..2^31 → encoded shardLen = ceil((L+1)/4).
 *   • L=0 → padded length 4 (3 pad + 1 trailer=3) → shardLen=1
 *   • L=4 → padded length 8 (3 pad + 1 trailer=3) → shardLen=2
 *   • L=15 → padded length 16 (0 pad + 1 trailer=0... wait trailer hep var)
 * Daha temiz: ALWAYS append 1 trailer byte (= paddingLen ∈ [0..3]),
 * sonra zero-pad to multiple of 4. Decode son byte'ı oku, pad'i strip.
 */
export function encodeStripes(secret: Uint8Array): Uint8Array[] {
  if (secret.length > 0xffffff)
    throw new Error("encodeStripes: secret too large (>16MiB)");
  // Pad: append 1-byte trailer + zero-pad to multiple of 4.
  // trailer encodes the padding length (1..4); decoder strips 'trailer'
  // bytes from the tail of recovered data.
  const baseLen = secret.length + 1; // +1 trailer
  const paddedLen = Math.ceil(baseLen / 4) * 4;
  const tailZeros = paddedLen - baseLen; // 0..3
  const trailer = tailZeros + 1; // 1..4 (always ≥1 trailer byte)
  const padded = new Uint8Array(paddedLen);
  padded.set(secret, 0);
  // bytes [secret.length .. paddedLen-2] = zero (already zero-init)
  padded[paddedLen - 1] = trailer;
  const shardLen = paddedLen / STRIPE_K;
  // Layout shards (data slots stripe[4..7]): stripes[4+i][p] = padded[i*shardLen + p]
  // Wait: clearer to view shards row-major. Let shard[i][p] = padded[i*shardLen + p].
  const stripes: Uint8Array[] = [];
  for (let j = 0; j < STRIPE_N; j++) stripes.push(new Uint8Array(shardLen));
  for (let p = 0; p < shardLen; p++) {
    const dataIn = new Uint8Array(STRIPE_K);
    for (let i = 0; i < STRIPE_K; i++) dataIn[i] = padded[i * shardLen + p]!;
    const cw = rsEncode(dataIn, STRIPE_PARITY); // 8 bytes: [parity[0..3], data[0..3]]
    for (let j = 0; j < STRIPE_N; j++) stripes[j]![p] = cw[j]!;
  }
  return stripes;
}

/**
 * Recover secret from up to 4 missing stripes. `stripes[j] = null` ⇒
 * j-th stripe kayıp/güvensiz (erasure). En fazla 4 erasure desteklenir.
 *
 * Tüm mevcut stripe'lar aynı uzunlukta olmalı; aksi halde `ok=false`.
 *
 * Recover sonrası padding strip edilir (trailer byte stripped + zero pad).
 */
export function decodeStripes(
  stripes: ReadonlyArray<Uint8Array | null>,
): DecodeStripesResult {
  if (stripes.length !== STRIPE_N)
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount: 0,
      erasurePositions: [],
    };
  const erasurePositions: number[] = [];
  let shardLen = -1;
  for (let j = 0; j < STRIPE_N; j++) {
    const s = stripes[j];
    if (s === null || s === undefined) {
      erasurePositions.push(j);
      continue;
    }
    if (shardLen < 0) shardLen = s.length;
    else if (s.length !== shardLen) {
      return {
        ok: false,
        data: new Uint8Array(0),
        presentCount: STRIPE_N - erasurePositions.length,
        erasurePositions,
      };
    }
  }
  const presentCount = STRIPE_N - erasurePositions.length;
  if (presentCount < STRIPE_K || shardLen < 0) {
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount,
      erasurePositions,
    };
  }
  if (erasurePositions.length > STRIPE_PARITY) {
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount,
      erasurePositions,
    };
  }
  const padded = new Uint8Array(STRIPE_K * shardLen);
  let allOk = true;
  const cw = new Uint8Array(STRIPE_N);
  for (let p = 0; p < shardLen; p++) {
    for (let j = 0; j < STRIPE_N; j++) {
      const s = stripes[j];
      cw[j] = s === null || s === undefined ? 0 : s[p]!;
    }
    const r = decodeWithErasures(cw, STRIPE_PARITY, erasurePositions);
    if (!r.ok) {
      allOk = false;
      break;
    }
    for (let i = 0; i < STRIPE_K; i++) padded[i * shardLen + p] = r.data[i]!;
  }
  if (!allOk) {
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount,
      erasurePositions,
    };
  }
  // Strip trailer (last byte = trailer length 1..4).
  const trailer = padded[padded.length - 1]!;
  if (trailer < 1 || trailer > STRIPE_K) {
    return {
      ok: false,
      data: new Uint8Array(0),
      presentCount,
      erasurePositions,
    };
  }
  const dataLen = padded.length - trailer;
  const data = padded.subarray(0, dataLen);
  return { ok: true, data, presentCount, erasurePositions };
}
