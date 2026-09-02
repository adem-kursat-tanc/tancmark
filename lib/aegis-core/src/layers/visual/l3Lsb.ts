// AEGIS v4.1 Faz 5 — L3 Quantum Vault Layer (LSB Steganografi v1)
//
// Bu iterasyonun TASARIM TERCİHİ: en az anlamlı bit (LSB) steganografisi.
// 256-bit vault payload digest'i (sha256 hex / 32 bytes) görüntünün B kanalı LSB'sine
// MASSIVE REPETITION (image bit kapasitesi / 256 ≈ thousands) ile gömülür.
// Detection: pixel başına bit oyu → majority-vote ile 256 bit reconstruct.
//
// AÇIK SINIRLAMA (HONEST):
//   - Lossless PNG roundtrip: ~%99 bit recovery (ideal). Vault digest match → vault-confirmed.
//   - JPEG (her quality): kuantizasyon LSB'yi bozar → recovery rate ~50% (chance) → MATCH YOK.
//   - Crop / Rotate: pixel offset / interpolation → MATCH YOK.
//
// Bu mimari "lossless distribution" kanalı için adlidir. CROP/ROTATE/JPEG dirençli
// vault-confirmed için DCT/DWT + 4-corner sync markers + Reed-Solomon ECC gereklidir
// (Step 5.2 — Robust Watermarking).
//
// HUKUKİ KORUMA: extract sonrası MAJORITY voting >= MIN_VOTE_RATIO eşiği
// uygulanır. Eşik altında "no_signal" döner — gürültülü görüntüden uydurma
// digest üretmez (false-positive vault lookup'ı engeller).

const PAYLOAD_BYTES = 32; // sha256 = 256 bits
const PAYLOAD_BITS = PAYLOAD_BYTES * 8;
const SYNC_HEADER = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1]; // 16-bit prelude

export interface L3EmbedPlan {
  /** Payload bit sayısı (varsayılan 256). */
  payloadBits: number;
  /** Her bit için kullanılacak repeat count (image kapasitesine göre auto). */
  repeatPerBit: number;
}

export interface L3DetectResult {
  detected: boolean;
  /** Recover edilen payload digest (hex), no_signal ise boş string. */
  digestHex: string;
  /** Ortalama bit-vote consensus (0.5 = chance, 1.0 = unanimous). */
  meanVoteRatio: number;
  /** Sync header match orany (0..1). */
  syncMatchRatio: number;
  /** Toplam okunan bit slot sayısı. */
  totalSlots: number;
}

/**
 * Bit gömme: her bit'i `channels` (R,G,B) tüm kanallara ve repeat sayısı kadar
 * pixel'e yazar. Payload prefix'inde 16-bit sync header bulunur.
 *
 * Embed sırası: pixel-major, channel-minor. Kapasite hesabı tek B kanalı yerine
 * R+G+B kullanılarak 3× artar.
 */
export function embedL3Lsb(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  payloadDigestHex: string,
): L3EmbedPlan {
  if (payloadDigestHex.length !== PAYLOAD_BYTES * 2) {
    throw new Error(
      `L3 payload must be ${PAYLOAD_BYTES} bytes hex (got ${payloadDigestHex.length} chars)`,
    );
  }
  const payloadBits = hexToBits(payloadDigestHex); // length 256
  const fullStream: number[] = [...SYNC_HEADER, ...payloadBits];
  const totalBits = fullStream.length;

  // Capacity = pixel_count * 3 (R,G,B). Slot stride = 1 (consecutive).
  const totalPixels = width * height;
  const totalSlots = totalPixels * 3;
  const repeatPerBit = Math.floor(totalSlots / totalBits);
  if (repeatPerBit < 4) {
    throw new Error(
      `L3 image too small: ${totalSlots} slots / ${totalBits} bits = ${repeatPerBit}× repeat (need ≥4)`,
    );
  }
  // Embed: stream[i % totalBits] → slot i
  const slotsToWrite = repeatPerBit * totalBits;
  for (let s = 0; s < slotsToWrite; s++) {
    const bit = fullStream[s % totalBits]!;
    const pixIdx = Math.floor(s / 3);
    const chanIdx = s % 3;
    const byteIdx = pixIdx * channels + chanIdx;
    const cur = rgb[byteIdx]!;
    rgb[byteIdx] = (cur & 0xfe) | bit;
  }
  return { payloadBits: PAYLOAD_BITS, repeatPerBit };
}

/**
 * Detection: aynı sırayla LSB'leri okur, her bit slot için majority vote yapar,
 * sync header'ı doğrular, payload digest'i hex olarak döndürür.
 *
 * MIN_VOTE_RATIO 0.85 (varsayılan): bir bit slot için en az %85 oyların aynı
 * yöne gitmesi gerekir, aksi halde "noisy" → no_signal.
 *
 * `repeatPerBitOverride` smoke testleri için: aynı encoder parametresini geçer.
 * Aksi halde resim boyutundan otomatik hesaplanır (encoder ile uyumlu).
 */
export function extractL3Lsb(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  options: {
    minVoteRatio?: number;
    minSyncRatio?: number;
    repeatPerBitOverride?: number;
  } = {},
): L3DetectResult {
  const minVoteRatio = options.minVoteRatio ?? 0.85;
  const minSyncRatio = options.minSyncRatio ?? 0.875; // 14/16
  const totalBits = SYNC_HEADER.length + PAYLOAD_BITS;
  const totalSlots = width * height * 3;
  const repeatPerBit =
    options.repeatPerBitOverride ?? Math.floor(totalSlots / totalBits);
  if (repeatPerBit < 1) {
    return {
      detected: false,
      digestHex: "",
      meanVoteRatio: 0,
      syncMatchRatio: 0,
      totalSlots,
    };
  }
  // For each bit position 0..totalBits-1, count 1s across its repeat slots.
  const bitOnes = new Int32Array(totalBits);
  const bitTotal = new Int32Array(totalBits);
  const slotsToRead = repeatPerBit * totalBits;
  for (let s = 0; s < slotsToRead; s++) {
    const pixIdx = Math.floor(s / 3);
    const chanIdx = s % 3;
    const byteIdx = pixIdx * channels + chanIdx;
    if (byteIdx >= rgb.length) break;
    const lsb = rgb[byteIdx]! & 1;
    const bitPos = s % totalBits;
    if (lsb) bitOnes[bitPos]!++;
    bitTotal[bitPos]!++;
  }
  // Majority vote per bit
  const recovered: number[] = [];
  let totalConsensus = 0;
  let validBits = 0;
  for (let b = 0; b < totalBits; b++) {
    const ones = bitOnes[b]!;
    const tot = bitTotal[b]!;
    if (tot === 0) {
      recovered.push(0);
      continue;
    }
    const ratio = ones / tot;
    const decided = ratio >= 0.5 ? 1 : 0;
    const consensus = decided === 1 ? ratio : 1 - ratio;
    recovered.push(decided);
    totalConsensus += consensus;
    validBits++;
  }
  const meanVoteRatio = validBits > 0 ? totalConsensus / validBits : 0;

  // Sync header check
  let syncOk = 0;
  for (let i = 0; i < SYNC_HEADER.length; i++) {
    if (recovered[i] === SYNC_HEADER[i]) syncOk++;
  }
  const syncMatchRatio = syncOk / SYNC_HEADER.length;

  if (
    meanVoteRatio < minVoteRatio ||
    syncMatchRatio < minSyncRatio
  ) {
    return {
      detected: false,
      digestHex: "",
      meanVoteRatio,
      syncMatchRatio,
      totalSlots,
    };
  }
  // Extract payload portion (after sync header)
  const payloadBitsRecovered = recovered.slice(
    SYNC_HEADER.length,
    SYNC_HEADER.length + PAYLOAD_BITS,
  );
  const digestHex = bitsToHex(payloadBitsRecovered);
  return {
    detected: true,
    digestHex,
    meanVoteRatio,
    syncMatchRatio,
    totalSlots,
  };
}

function hexToBits(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    for (let b = 0; b < 8; b++) out.push((byte >> b) & 1);
  }
  return out;
}

function bitsToHex(bits: number[]): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let b = 0; b < 8; b++) v |= (bits[i + b]! & 1) << b;
    hex += v.toString(16).padStart(2, "0");
  }
  return hex;
}

export const L3_INTERNALS = { SYNC_HEADER, PAYLOAD_BITS, PAYLOAD_BYTES };
