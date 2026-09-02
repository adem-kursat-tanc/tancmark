/**
 * T6 Low-Band Redundancy — v0.6.3 (default OFF; flag V06_T6_LOWBAND=1).
 *
 * v0.6 → v0.6.1 → v0.6.2 → v0.6.3:
 *   - v0.6: T6 wrap yalnız 8 stamped PNG'ye → 56 sampled frame'de 8 sinyal +
 *     48 gürültü → matching ≈ random.
 *   - v0.6.1: tüm 90 frame'e DC shift; ANCHOR_OFFSETS lib aynası → ana mühür
 *     32×32 patch içine basıldı → recompress regresyon.
 *   - v0.6.2: T6_SAFE_CARRIERS (yer disjoint) + stamped frame atla (frame
 *     disjoint encode-side); ANCAK **iki ardışık FFV1 re-encode pass** (replace
 *     + post-process) stamped frame'leri ekstra roundtrip'e soktu → ana mühür
 *     byte sinyali zayıfladı, recompress regresyon hafifledi ama çözülmedi.
 *   - v0.6.3: AEGIS DNA tam simetri — **TEK FFV1 pass** + **T6 kendi
 *     deterministik frame haritası**:
 *     (a) `getT6FrameMap(totalFrames)` SLOT_COUNT eşit dağılımlı 11 frame
 *     idx üretir; encoder bu frame'lerin orijinalini extract eder, T6 DC
 *     shift'i uygular, ana mühür PNG'leriyle BİRLİKTE replaceFramesInVideo'ya
 *     gönderir → TEK FFV1 encode pass.
 *     (b) Stamped frame ile çakışan T6 slot ENCODER tarafından atlanır
 *     (yer öncelik ana mühürün); decode aynı statik haritayı kullanır,
 *     çakışan slot'tan T6 sinyali okuyamaz ama 11-K slot dolu = 3(11-K)
 *     bit hâlâ oylanır.
 *     (c) `applyT6FullPassPostProcess` DEPRECATED — artık çağrılmaz; v0.6.2
 *     uyumluluğu için kod kalır ama encode yolundan tamamen çıktı.
 *
 * Mimari (v0.6.3):
 *   - Encode-side (T6 ON): tripleShield stamp (8 PNG) + T6 frame map extract
 *     + applyT6EncodeToPng (≤11 PNG, stamped'larla çakışan atlanır) →
 *     birleşik liste → replaceFramesInVideo (TEK FFV1 pass).
 *   - Decode-side (T6 ON, A1-A5 NOT_FOUND): `getT6FrameMap(totalFrames)`
 *     ile aynı frame idx'leri üretilir → o timestamp'lerden extract →
 *     decodeT6 oylama. Aynı harita = aynı bölge = AEGIS DNA simetri.
 *   - 3 T6_SAFE_CARRIERS × 11 slot = 33 ≥ 32 bit; en kötü 2 çakışmada bile
 *     27 bit oylanır.
 *
 * KIRMIZI ÇİZGİ:
 *   - lib/aegis-core dokunulmaz.
 *   - tripleShield.ts dokunulmaz.
 *   - Mevcut payload4/CRC zinciri dokunulmaz; T6 aynı payload4'ü kodlar.
 *   - Mevcut A1-A5 verdict dokunulmaz; T6 ayrı telemetry alanı.
 *   - T6 OFF yolu byte-identical v0.5A (per-stamp T6 wrap kaldırıldı, OFF iken
 *     hiçbir T6 kodu çalışmaz).
 *
 * FP profili:
 *   Random 32-bit match olasılığı = 2^-32 ≈ 2.3×10^-10. T6_VAULT yalnız
 *   bit-exact 32/32 verir. Daha azı T6_CANDIDATE (sinyal göstergesi, delil değil).
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { runFfmpeg } from "./ffmpegHelper";
import type { T6Telemetry, T6Verdict } from "./t6Types";

// === T6_SAFE_CARRIERS (v0.6.2) ===
// Lib tripleShield.ts ANCHOR_OFFSETS = {C00:(-76,-76), C01:(44,-76),
//   C10:(-76,44), C11:(44,44)} → 4× 32×32 anchor patch (top-left ofset).
// Ana patch alanları: x ∈ {[cx-76..cx-44], [cx+44..cx+76]} ve y aynı.
// T6_SAFE_CARRIERS direkt 8×8 sub-block TOP-LEFT ofseti verir; merkezde "+"
// şeklinde N/E/S konumları, ana patch'lerin "L köşelerine" değmeden.
const T6_SAFE_CARRIERS = [
  // T6N: 8×8 sub-block [cx-4..cx+3, cy-32..cy-25]. Ana üst-patch bottom Y=cy-44
  //  ile gap=12px; X ana sol/sağ patch arası boşluğun ortası.
  { id: "T6N", dx: -4, dy: -32 },
  // T6E: 8×8 [cx+24..cx+31, cy-4..cy+3]. Ana sağ-patch left X=cx+44 ile gap=13px.
  { id: "T6E", dx: 24, dy: -4 },
  // T6S: 8×8 [cx-4..cx+3, cy+24..cy+31]. Ana alt-patch top Y=cy+44 ile gap=13px.
  { id: "T6S", dx: -4, dy: 24 },
] as const;
const SUB_BLOCK = 8;
const SUB_CENTER = SUB_BLOCK / 2; // 4 — sub-block center offset from top-left

/** DC shift miktarı: 8×8 patch'in 64 pikseline ±SHIFT_PER_PIXEL luma ekle.
 *  DCT-II DC ≈ 8 × (mean_centered). Yani per-pixel ±2 → DC ±16 birim.
 *  JPEG q50 luma DC quant step ≈ 16 ile aynı boyut → sub-quantize görünür
 *  ama gözle fark edilemez (8×8 patch ≈ 0.05% frame alanı). F1/F2a/F2b
 *  Δ < quant step ölçümünden geliyor. */
const SHIFT_PER_PIXEL = 2;
/** 11 zamansal slot × 3 anchor = 33 ≥ 32 bit. */
const SLOT_COUNT = 11;
/** Bit-exact verdict eşiği. */
const T6_VAULT_BITS = 32;
/** T6_CANDIDATE alt eşiği (32-bit sinyal var ama tam bit-exact değil). */
const T6_CANDIDATE_BITS = 22; // ≥22/32 ≈ %69 → random P ≈ 4.3×10⁻³ (sinyal göstergesi, delil değil)

export function t6IsEnabled(): boolean {
  return process.env.V06_T6_LOWBAND === "1";
}

// === 8×8 DCT-II (separable, naive — N=8 yeterli hızlı) ===
const DCT_C: number[][] = (() => {
  const N = 8;
  const M: number[][] = [];
  for (let k = 0; k < N; k++) {
    const row: number[] = [];
    const ck = k === 0 ? 1 / Math.sqrt(2) : 1;
    for (let n = 0; n < N; n++) row.push(ck * Math.cos(((2 * n + 1) * k * Math.PI) / (2 * N)));
    M.push(row);
  }
  return M;
})();
function dctDC(block: number[][]): number {
  const N = 8;
  // F[0][0] = (c0·c0)·sum_y sum_x block[y][x] = (1/2)·(1/2)·sum·... but for separable
  // 8-point DCT-II with our normalization: F[0][0] = (1/8) · Σ block (after -128).
  // Simpler direct path: just compute via two 1-D passes consistent with dct8.
  const tmp: number[] = Array(N).fill(0);
  for (let y = 0; y < N; y++) {
    let s = 0;
    for (let x = 0; x < N; x++) s += block[y]![x]! * DCT_C[0]![x]!;
    tmp[y] = s * 0.5;
  }
  let dc = 0;
  for (let y = 0; y < N; y++) dc += tmp[y]! * DCT_C[0]![y]!;
  return dc * 0.5;
}

function readY8x8FromRaw(raw: Buffer, W: number, H: number, cx: number, cy: number): number[][] {
  const x0 = Math.max(0, Math.min(W - 8, cx - 4));
  const y0 = Math.max(0, Math.min(H - 8, cy - 4));
  const blk: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const off = ((y0 + y) * W + (x0 + x)) * 3;
    const r = raw[off]!, g = raw[off + 1]!, b = raw[off + 2]!;
    blk[y]![x] = (0.299 * r + 0.587 * g + 0.114 * b) - 128;
  }
  return blk;
}

/** Compute (slot, bitInSlot) → bit position mapping.
 *  bit position = (3·slot + bitInSlot) mod 32. */
function bitPosition(slot: number, bitInSlot: number): number {
  return (3 * slot + bitInSlot) % 32;
}

/** payload4 (Buffer, 4 bytes) → 32-bit array (MSB-first within each byte). */
function payloadToBits(payload4: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = payload4[i]!;
    for (let b = 7; b >= 0; b--) bits.push((byte >>> b) & 1);
  }
  return bits;
}

/** 32-bit array → 4-byte hex string. */
function bitsToHex(bits: number[]): string {
  const buf = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] ?? 0);
    buf[i] = byte;
  }
  return buf.toString("hex");
}

// =====================================================================
// v0.6.3 T6 FRAME MAP — encode + decode aynı haritayı kullanır.
// =====================================================================

/** T6 yer/zaman haritası: totalFrames'e bağlı deterministik frame idx listesi.
 *  SLOT_COUNT=11 eşit dağılım. Encode + decode aynı fonksiyondan üretir.
 *  Çakışma toleransı: stamped frame ile çakışan slot encoder tarafından
 *  ATLANIR (yer öncelik ana mühürün); decode haritada görür ama o frame'de
 *  T6 sinyali olmadığı için ~0 DC shift verir (gürültü oy). */
export function getT6FrameMap(totalFrames: number): Array<{ idx: number; slot: number }> {
  if (totalFrames <= 0) return [];
  const out: Array<{ idx: number; slot: number }> = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    // Slot ortası: idx = floor((slot + 0.5) * totalFrames / SLOT_COUNT).
    // 0..totalFrames-1 sınırında kalır.
    const idx = Math.min(
      totalFrames - 1,
      Math.max(0, Math.floor(((slot + 0.5) * totalFrames) / SLOT_COUNT)),
    );
    out.push({ idx, slot });
  }
  return out;
}

// =====================================================================
// ENCODE-SIDE: PNG buffer'ı T6 ile post-process et.
// =====================================================================

export interface T6EncodeOptions {
  /** Tüm stamped frame'lerin tam listesi (deterministik sıra). */
  stampedFrameIdxs: number[];
  /** Bu frame'in stampedFrameIdxs içindeki konumu (ordinal). */
  frameIdx: number;
  /** Video toplam frame sayısı (slot eşlemesi için). */
  totalFrames: number;
  /** payload4 (CRC32, 4 byte). */
  payload4: Buffer;
}

/** Encode-time slot: stamped frame'in **video içindeki konumuna** göre slot
 *  belirlenir (decode-time aynı formülü kullanır → ordinal eşleme gerekmez). */
function slotForFrameIdx(frameIdx: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  const norm = frameIdx / totalFrames; // 0..~1
  return Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(norm * SLOT_COUNT)));
}

/** Apply T6 DC shift to a stamped PNG buffer. Returns a new PNG buffer with
 *  3 carrier anchors (C00/C01/C11) sub-8×8 luma ±SHIFT_PER_PIXEL according to
 *  payload4 bits at the slot derived from the frame's index. */
export async function applyT6EncodeToPng(
  pngBuffer: Buffer,
  opts: T6EncodeOptions,
): Promise<Buffer> {
  const meta = await sharp(pngBuffer).metadata();
  const W = meta.width;
  const H = meta.height;
  if (!W || !H) throw new Error("t6LowBand: missing PNG dimensions");

  // Convert to RGBA raw so we can write per-pixel deltas.
  const img = sharp(pngBuffer).ensureAlpha();
  const rgba = await img.raw().toBuffer(); // length = W*H*4

  const cx_center = Math.floor(W / 2);
  const cy_center = Math.floor(H / 2);
  const slot = slotForFrameIdx(opts.frameIdx, opts.totalFrames);
  const payloadBits = payloadToBits(opts.payload4);

  for (let carrierIdx = 0; carrierIdx < T6_SAFE_CARRIERS.length; carrierIdx++) {
    const a = T6_SAFE_CARRIERS[carrierIdx]!;
    // v0.6.2: dx/dy ZATEN 8×8 sub-block TOP-LEFT (eski ANCHOR_PATCH+SUB_OFFSET
    // hesabı kaldırıldı; T6 carrier'ları ana mühür anchor'larından disjoint).
    const subX = cx_center + a.dx;
    const subY = cy_center + a.dy;

    const bitIdx = bitPosition(slot, carrierIdx);
    const bit = payloadBits[bitIdx]!;
    const delta = bit === 1 ? +SHIFT_PER_PIXEL : -SHIFT_PER_PIXEL;

    // Apply uniform luma delta to the 8×8 patch (in-place).
    // R,G,B each shifted by delta (luma ≈ delta after BT.601).
    for (let y = 0; y < SUB_BLOCK; y++) {
      for (let x = 0; x < SUB_BLOCK; x++) {
        const px = subX + x;
        const py = subY + y;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const off = (py * W + px) * 4; // RGBA
        rgba[off]     = Math.max(0, Math.min(255, rgba[off]!     + delta));
        rgba[off + 1] = Math.max(0, Math.min(255, rgba[off + 1]! + delta));
        rgba[off + 2] = Math.max(0, Math.min(255, rgba[off + 2]! + delta));
      }
    }
  }

  // v0.6.1: compressionLevel 9 → 1 (post-process tek tüketici FFV1 → kayıpsız
  // re-encode; PNG sıkıştırma derecesi pixel veri üzerinde etkili değil, yalnız
  // disk yazma süresini etkiler. 90 frame × ~400ms tasarrufu).
  const out = await sharp(rgba, {
    raw: { width: W, height: H, channels: 4 },
  }).png({ compressionLevel: 1 }).toBuffer();
  return out;
}

// =====================================================================
// DECODE-SIDE: A1-A5 NOT_FOUND ise + flag açıksa T6 fallback.
// =====================================================================

export interface T6DecodeInput {
  /** Hangi frame PNG'ler ölçülecek (decode-side extract edilmiş yollar).
   *  v0.6.3: `slot` opsiyonel — varsa `getT6FrameMap`'in döndürdüğü slot
   *  doğrudan kullanılır (DNA tam simetri); yoksa tsSec/durationSec'ten
   *  yaklaşık hesaplanır (geri uyum, kenar durum). */
  framePaths: Array<{ tsSec: number; pngPath: string; slot?: number }>;
  videoDurationSec: number;
  /** Beklenen payload4 (decode tarafında zaten biliniyor — bit-exact compare). */
  expectedPayload4: Buffer;
}

interface CarrierVote {
  positive: number; // bit=1 oyları
  negative: number; // bit=0 oyları
}

/** Decode T6: 3 carrier × per-frame DC delta sign vote → 32-bit payload.
 *  Bit-exact 32/32 = T6_VAULT. ≥22/32 = T6_CANDIDATE. Diğer = T6_NONE. */
export async function decodeT6(input: T6DecodeInput): Promise<T6Telemetry> {
  const t0 = Date.now();
  const expectedHex = input.expectedPayload4.toString("hex");
  const carriers = T6_SAFE_CARRIERS.map((c) => c.id);

  if (input.framePaths.length === 0) {
    return {
      enabled: true, attempted: true,
      carriers, frameCount: 0,
      framesPerSlot: new Array(SLOT_COUNT).fill(0),
      candidatePayloadHex: "", expectedPayloadHex: expectedHex,
      matchingBits: 0, parityOk: false, hashOk: false,
      verdict: "T6_NONE", wallMs: Date.now() - t0,
      note: "T6 decode: hiç frame yok",
    };
  }

  // bit position → vote tally.
  const votes: CarrierVote[] = Array.from({ length: 32 }, () => ({ positive: 0, negative: 0 }));
  const framesPerSlot = new Array(SLOT_COUNT).fill(0);

  for (const fr of input.framePaths) {
    // v0.6.3 AEGIS DNA: explicit `slot` varsa onu kullan (encode-side
    // getT6FrameMap ile bire bir simetri). Yoksa eski tsSec/durationSec
    // yaklaşımı (geri uyum, kenar durum: kısa video, manuel framePaths).
    const slot = typeof fr.slot === "number"
      ? Math.max(0, Math.min(SLOT_COUNT - 1, fr.slot))
      : Math.max(0, Math.min(SLOT_COUNT - 1,
          Math.floor((fr.tsSec / Math.max(0.001, input.videoDurationSec)) * SLOT_COUNT)));
    framesPerSlot[slot]++;

    let rgb: Buffer;
    let W: number; let H: number;
    try {
      const meta = await sharp(fr.pngPath).metadata();
      W = meta.width ?? 0; H = meta.height ?? 0;
      if (!W || !H) continue;
      rgb = await sharp(fr.pngPath).removeAlpha().raw().toBuffer();
    } catch {
      continue;
    }
    if (rgb.length < W * H * 3) continue;

    const cx_center = Math.floor(W / 2);
    const cy_center = Math.floor(H / 2);

    for (let carrierIdx = 0; carrierIdx < T6_SAFE_CARRIERS.length; carrierIdx++) {
      const a = T6_SAFE_CARRIERS[carrierIdx]!;
      // v0.6.2: dx/dy = sub-block TOP-LEFT; +SUB_CENTER(4) = sub-block center.
      const subCx = cx_center + a.dx + SUB_CENTER;
      const subCy = cy_center + a.dy + SUB_CENTER;
      const block = readY8x8FromRaw(rgb, W, H, subCx, subCy);
      const dc = dctDC(block);

      // v0.6.2: Self-reference radius 24 → 8 px. Yeni T6_SAFE_CARRIERS
      // ana mührün 32×32 patch'lerine 12-15 px uzaklıkta; ±8 px komşu
      // referans bloklar ana patch'lerle veya diğer T6 carrier'larıyla
      // ÇAKIŞMAZ (matematik kanıtı dosya başında).
      const refOffsets = [[+8, 0], [-8, 0], [0, +8], [0, -8]];
      let refSum = 0; let refN = 0;
      for (const [dx, dy] of refOffsets) {
        const rcx = subCx + (dx ?? 0);
        const rcy = subCy + (dy ?? 0);
        if (rcx < 4 || rcx >= W - 4 || rcy < 4 || rcy >= H - 4) continue;
        refSum += dctDC(readY8x8FromRaw(rgb, W, H, rcx, rcy));
        refN++;
      }
      if (refN === 0) continue;
      const refDC = refSum / refN;

      const bitIdx = bitPosition(slot, carrierIdx);
      if (dc > refDC) votes[bitIdx]!.positive++;
      else if (dc < refDC) votes[bitIdx]!.negative++;
    }
  }

  // Majority vote per bit. Tie or no votes → bit unknown (treated as 0, but
  // matching is bit-exact so unknown bits will simply fail to match unless
  // expected is 0).
  const recoveredBits: number[] = votes.map((v) =>
    v.positive > v.negative ? 1 : 0,
  );
  const expectedBits = payloadToBits(input.expectedPayload4);
  let matching = 0;
  for (let i = 0; i < 32; i++) if (recoveredBits[i] === expectedBits[i]) matching++;

  const candidateHex = bitsToHex(recoveredBits);
  const parityOk = matching === T6_VAULT_BITS;
  // hashOk: bit-exact AND candidate equals expected payload4 hash (sanity gate).
  // Burada zaten payload4 = CRC32(idBuffer) olduğu için bit-exact = hash match.
  const hashOk = parityOk && candidateHex === expectedHex;

  let verdict: T6Verdict = "T6_NONE";
  if (parityOk && hashOk) verdict = "T6_VAULT";
  else if (matching >= T6_CANDIDATE_BITS) verdict = "T6_CANDIDATE";

  return {
    enabled: true, attempted: true,
    carriers, frameCount: input.framePaths.length,
    framesPerSlot,
    candidatePayloadHex: candidateHex,
    expectedPayloadHex: expectedHex,
    matchingBits: matching,
    parityOk, hashOk, verdict,
    wallMs: Date.now() - t0,
    note: verdict === "T6_VAULT"
      ? `bit-exact 32/32 + hash invariant geçti`
      : verdict === "T6_CANDIDATE"
        ? `sinyal göstergesi (${matching}/32 bit eşleşti, delil değil)`
        : `T6 sinyali yetersiz (${matching}/32 bit)`,
  };
}

// =====================================================================
// v0.6.1: T6 sampling helpers + full-pass post-process encode.
// =====================================================================

/** T6-özel uniform örneklem: tüm dur aralığını (ε pad ile) ÖRNEKLER.
 *
 *  ffmpegHelper.sampleTimestamps `pad=0.3s` ile [0.3, dur-0.3] aralığını
 *  döndürür → dur=3s'de tsSec/dur ∈ [0.1, 0.9] → SLOT_COUNT=11 ile slot ∈
 *  [1, 9] → slot 0 ve 10 hiç ölçülmez → bit 0,1,2,30,31 her zaman ölü oy.
 *  Bu fonksiyon ε=%1 pad ile slot 0..10'u eksiksiz kapsar. */
export function t6SampleTimestamps(durationSec: number, count: number): number[] {
  if (count <= 0) return [];
  const safeDur = Math.max(0.5, durationSec);
  const eps = Math.min(0.02, safeDur * 0.01); // %1 küçük emniyet pad
  const start = eps;
  const end = Math.max(start + 0.05, safeDur - eps);
  if (count === 1) return [(start + end) / 2];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(start + ((end - start) * i) / (count - 1));
  }
  return out;
}

/** v0.6.2 T6 ON post-process pass — AEGIS DNA/harita ilkesi uygulanmış.
 *
 *  Stamped (tripleShield) video → tüm frame'leri PNG'ye extract et →
 *  **stampedFrameIdxs İÇİNDE OLMAYAN** frame'lere T6 DC shift uygula
 *  (stamped frame'ler T6 uygulamadan bırakılır → ana mühür sinyalini
 *  korur, T6 ile çakışmaz) → FFV1 lossless re-encode.
 *
 *  Bu fonksiyon yalnız T6 ON path'inden çağrılır. T6 OFF iken encodeVideo
 *  bu fonksiyonu hiç çağırmaz → byte-identical v0.5A.
 *
 *  AEGIS DNA HARİTASI (v0.6.2):
 *    - **Yer haritası**: T6_SAFE_CARRIERS, ana mührün 32×32 anchor
 *      patch'lerinden disjoint 3 sub-block (merkez "+" N/E/S).
 *    - **Frame haritası**: stampedFrameIdxs = ana mührün kullandığı
 *      kareler → T6 onlara dokunmaz. T6 yalnız kullanılmayan ~82 frame'i
 *      kendi alanı olarak kullanır.
 *    - **Decode yönü**: T6 decode tarafı stamped/unstamped ayrımı
 *      yapmadan tüm frame'leri okur; stamped frame'lerden gelen ~0 DC
 *      shift "noise" oyu olur, unstamped çoğunluktan gelen sinyal majority
 *      vote'u kazanır. */
export async function applyT6FullPassPostProcess(
  inPath: string,
  outPath: string,
  payload4: Buffer,
  fps: number,
  stampedFrameIdxs: ReadonlySet<number>,
): Promise<{ totalFrames: number; t6AppliedFrames: number; skippedStampedFrames: number; wallMs: number }> {
  const t0 = Date.now();
  const tmpDir = path.join(path.dirname(outPath), `_t6pp_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    // 1) Extract all frames from stamped video. FFV1 → PNG = lossless.
    await runFfmpeg([
      "-i", inPath,
      "-vsync", "0",
      "-f", "image2",
      path.join(tmpDir, "f_%06d.png"),
    ], 180_000);

    // 2) Apply T6 DC shift to each frame (absolute ordinal index → slot).
    //    SKIP frames in stampedFrameIdxs — they retain pure tripleShield
    //    signal without T6 overlay (AEGIS DNA frame-disjoint).
    const files = fs.readdirSync(tmpDir)
      .filter((f) => f.startsWith("f_") && f.endsWith(".png"))
      .sort();
    const N = files.length;
    if (N === 0) throw new Error("t6 post-process: no frames extracted");
    let applied = 0;
    let skipped = 0;
    for (let i = 0; i < N; i++) {
      if (stampedFrameIdxs.has(i)) {
        skipped++;
        continue; // ana mührün karesi — T6 dokunmaz
      }
      const fp = path.join(tmpDir, files[i]!);
      const buf = fs.readFileSync(fp);
      const modified = await applyT6EncodeToPng(buf, {
        stampedFrameIdxs: [],
        frameIdx: i,
        totalFrames: N,
        payload4,
      });
      fs.writeFileSync(fp, modified);
      applied++;
    }

    // 3) Re-encode with FFV1 lossless. -threads 1 for bit-identical output.
    await runFfmpeg([
      "-threads", "1",
      "-framerate", String(fps),
      "-i", path.join(tmpDir, "f_%06d.png"),
      "-c:v", "ffv1",
      "-level", "3",
      "-pix_fmt", "yuv420p",
      outPath,
    ], 180_000);

    return {
      totalFrames: N,
      t6AppliedFrames: applied,
      skippedStampedFrames: skipped,
      wallMs: Date.now() - t0,
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/** Helper: extract Y from a PNG via sharp + measure single T6 carrier DC.
 *  Exported for diagnostic smoke tests if needed. */
export async function _measureAnchorDC(pngPath: string, carrierIdx: 0 | 1 | 2): Promise<number> {
  const meta = await sharp(pngPath).metadata();
  const W = meta.width ?? 0; const H = meta.height ?? 0;
  const rgb = await sharp(pngPath).removeAlpha().raw().toBuffer();
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  const a = T6_SAFE_CARRIERS[carrierIdx]!;
  const subCx = cx + a.dx + SUB_CENTER;
  const subCy = cy + a.dy + SUB_CENTER;
  return dctDC(readY8x8FromRaw(rgb, W, H, subCx, subCy));
}

