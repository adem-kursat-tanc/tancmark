// AEGIS v4.1 Faz 5 — L2 Structural (Anlamsal Piksel Alfabesi)
//
// Cloak ID'nin küçük bir hash payload'ını (varsayılan 16 bit) RENDER edilen
// metnin satır aralıklarına ±swing piksel kaydırarak kodlar ("mors alfabesi").
//
// Kodlama protokolü:
//   - sha256("L2:" + cloakId)'den ilk 16 bit alınır → bits[0..15].
//   - Render edilecek satır sayısı N için, gap_i = baseSpacing + (bits[i % 16] ? +swing : -swing).
//   - Encoder satır arası gap'leri (line spacing) belirler; decoder ölçer.
//
// Decoder iki modda çalışır:
//   (A) Blind decode: pikselden satır taban çizgilerini bul (horizontal-projection
//       peaks), gap'lerden bit dizisi çıkar, ilk 16 biti payload candidate
//       olarak döndür. Çağıran bunu DB lookup veya candidate set ile eşleştirir.
//   (B) Verifier mode (önerilen): bilinen candidate cloakId listesinden expected
//       bit dizisini hesapla, ölçülen bitlerle Hamming similarity. >0.75 ise
//       "detected".
//
// Saldırı/dayanım profili (HONEST):
//   - Clean PNG / JPEG: line projection peaks net → gap ölçümü ±1 px hassasiyet → high recall.
//   - Edge crop ≤20%: bazı satırlar kaybolur, 4+ gap kalırsa kısmi decode.
//   - Rotate ≥3°: horizontal projection bozulur — ön Hough deskew gerekir
//     (Step 5.2'de eklenecek). Bu iterasyonda rotate altında detect başarısız.

import { createHash } from "node:crypto";

export interface L2EncodePlan {
  baseSpacing: number;
  swing: number;
  /** Her satır için target gap (line baseline'ları arasındaki dikey mesafe). */
  gaps: number[];
  /** Encoded bits (LSB-first). */
  bits: number[];
}

export interface L2DetectResult {
  detected: boolean;
  measuredGaps: number[];
  decodedBits: number[];
  /** Verifier modunda: en iyi adayın benzerliği (0..1). */
  bestCandidateSimilarity: number;
  /** Verifier modunda: en iyi aday cloakId. */
  bestCandidateId: string | null;
  /** Blind modunda: ham 16-bit payload (hex). */
  blindPayloadHex: string;
}

/** sha256("L2:" + cloakId) ilk N bitini döndür (LSB-first per byte). */
export function cloakIdToBits(cloakId: string, nBits = 16): number[] {
  const h = createHash("sha256")
    .update(`AEGIS-VISUAL-L2:${cloakId}`)
    .digest();
  const bits: number[] = [];
  for (let i = 0; i < nBits; i++) {
    const byte = h[(i >> 3) % h.length]!;
    bits.push((byte >> (i & 7)) & 1);
  }
  return bits;
}

/**
 * N satırlık render planı: her satır için gap = base + (bit ? +swing : -swing).
 * Bits payload boyundan büyük N için tekrar eder (repetition code).
 */
export function planL2Spacing(
  cloakId: string,
  lineCount: number,
  baseSpacing: number,
  swing: number,
  payloadBits = 16,
): L2EncodePlan {
  const bits = cloakIdToBits(cloakId, payloadBits);
  const gaps: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    const b = bits[i % payloadBits]!;
    gaps.push(baseSpacing + (b ? swing : -swing));
  }
  return { baseSpacing, swing, gaps, bits };
}

/**
 * RGB pikselden satır taban çizgilerini bul:
 *   1. Luminance row-sum profile (her satırın "darklık" yoğunluğu).
 *   2. Threshold ile "metin" / "boşluk" segmentleri ayır.
 *   3. Her metin segmentinin ortasını baseline kabul et.
 *   4. Ardışık baseline'lar arası mesafeleri (gaps) döndür.
 */
export function measureLineGaps(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
): number[] {
  // Row darkness: mean of (255 - lum) per row — daha koyu satır = daha yüksek değer
  const rowDark = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const rowStart = y * width * channels;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x * channels;
      const lum = rgb[i]! * 0.299 + rgb[i + 1]! * 0.587 + rgb[i + 2]! * 0.114;
      sum += 255 - lum;
    }
    rowDark[y] = sum / width;
  }
  // Adaptive threshold: mean + 0.3 * (max - mean)
  let maxV = 0;
  let meanV = 0;
  for (let y = 0; y < height; y++) {
    if (rowDark[y]! > maxV) maxV = rowDark[y]!;
    meanV += rowDark[y]!;
  }
  meanV /= height;
  const thr = meanV + 0.30 * (maxV - meanV);
  // Segment text bands
  const baselines: number[] = [];
  let inBand = false;
  let bandStart = 0;
  for (let y = 0; y < height; y++) {
    const isText = rowDark[y]! > thr;
    if (isText && !inBand) {
      bandStart = y;
      inBand = true;
    } else if (!isText && inBand) {
      const center = Math.floor((bandStart + y - 1) / 2);
      baselines.push(center);
      inBand = false;
    }
  }
  if (inBand) {
    baselines.push(Math.floor((bandStart + height - 1) / 2));
  }
  // Compute gaps
  const gaps: number[] = [];
  for (let i = 1; i < baselines.length; i++) {
    gaps.push(baselines[i]! - baselines[i - 1]!);
  }
  return gaps;
}

/**
 * Verifier mode: candidate cloakId listesinden expected bit dizisini hesapla,
 * ölçülen gap'lerden çıkardığın bitlerle karşılaştır.
 */
export function detectL2(
  measuredGaps: number[],
  baseSpacing: number,
  swing: number,
  candidateCloakIds: string[],
  threshold = 0.70,
  payloadBits = 16,
): L2DetectResult {
  // Decode bits from gaps: gap > base → 1, gap < base → 0
  const decoded: number[] = measuredGaps.map((g) => (g >= baseSpacing ? 1 : 0));
  const blindPayload = decoded.slice(0, payloadBits);
  while (blindPayload.length < payloadBits) blindPayload.push(0);
  // hex
  let hex = "";
  for (let byte = 0; byte < payloadBits / 8; byte++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v |= (blindPayload[byte * 8 + b]! & 1) << b;
    hex += v.toString(16).padStart(2, "0");
  }

  if (candidateCloakIds.length === 0) {
    return {
      detected: false,
      measuredGaps,
      decodedBits: decoded,
      bestCandidateSimilarity: 0,
      bestCandidateId: null,
      blindPayloadHex: hex,
    };
  }

  let bestSim = 0;
  let bestId: string | null = null;
  for (const cid of candidateCloakIds) {
    const expectedBits = cloakIdToBits(cid, payloadBits);
    let matches = 0;
    let total = 0;
    for (let i = 0; i < decoded.length; i++) {
      const eb = expectedBits[i % payloadBits]!;
      if (decoded[i]! === eb) matches++;
      total++;
    }
    const sim = total > 0 ? matches / total : 0;
    if (sim > bestSim) {
      bestSim = sim;
      bestId = cid;
    }
  }
  return {
    detected: bestSim >= threshold,
    measuredGaps,
    decodedBits: decoded,
    bestCandidateSimilarity: bestSim,
    bestCandidateId: bestId,
    blindPayloadHex: hex,
  };
}
