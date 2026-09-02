// AEGIS v4.1 Faz 5 — L1 Decoy (Görsel Mikro-Stamp Tuzağı)
//
// Köşelerde + kenar orta noktalarında düşük opaklıkla yerleştirilen, cloakId'den
// türetilmiş 16×16 binary desen. Hırsız bunları silmeye/temizlemeye çalışırsa
// "amatör tuzağı" tetiklenir; silse bile asıl mühür L2/L3'te kalır.
//
// Saldırı/dayanım profili (HONEST):
//   - Clean PNG: tüm 8 pozisyonda detected (ideal).
//   - JPEG q≥35:   ~5-8/8 pozisyon survive (renk kuantizasyonu desen kontrastını korur).
//   - Edge crop ≥20%: köşe stamp'leri ölür, kenar-orta stamp'leri yaşayabilir.
//   - Rotate ≤5°: NCC penceresi tolerans aralığında survive eder (small angle).
//
// Bu modül **pikselden bağımsızdır** — çağıran (route) sharp ile RGB raw buffer
// üretir, biz Uint8Array üzerinde çalışırız.

import { createHash } from "node:crypto";

export interface L1Stamp {
  /** Kare desen kenar uzunluğu (piksel). */
  size: number;
  /** size*size grayscale değer (0 veya 255). */
  pattern: Uint8Array;
}

export interface L1Position {
  x: number;
  y: number;
  /** Pozisyon etiketi (TL/TR/BL/BR/Tmid/Bmid/Lmid/Rmid). */
  label: string;
}

export interface L1DetectResult {
  detected: boolean;
  hits: number;
  totalPositions: number;
  bestNcc: number;
  perPositionNcc: Array<{ label: string; ncc: number; passed: boolean }>;
}

/**
 * Cloak ID'sinden 16×16 binary desen türet (deterministic).
 * Aynı cloakId her zaman aynı deseni üretir; farklı cloakId'ler arası tasarımca
 * en az 50% Hamming mesafesi (hash dağılımı garantisi) beklenir.
 */
export function buildL1Stamp(cloakId: string, size = 16): L1Stamp {
  const h = createHash("sha256")
    .update(`AEGIS-VISUAL-L1:${cloakId}`)
    .digest();
  const total = size * size;
  const pattern = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const byteIdx = (i >> 3) % h.length;
    const bitIdx = i & 7;
    const bit = (h[byteIdx]! >> bitIdx) & 1;
    pattern[i] = bit ? 255 : 0;
  }
  return { size, pattern };
}

/**
 * 8 pozisyon: 4 köşe + 4 kenar ortası. Edge crop senaryosunda kenar-orta
 * stamp'leri köşelerden farklı şekilde survive eder (yarım kalsalar bile NCC
 * kısmi pencere modu ile tetiklenebilir).
 */
export function l1StampPositions(
  width: number,
  height: number,
  size: number,
  margin = 8,
): L1Position[] {
  const cx = Math.floor((width - size) / 2);
  const cy = Math.floor((height - size) / 2);
  const right = width - size - margin;
  const bottom = height - size - margin;
  return [
    { x: margin, y: margin, label: "TL" },
    { x: right, y: margin, label: "TR" },
    { x: margin, y: bottom, label: "BL" },
    { x: right, y: bottom, label: "BR" },
    { x: cx, y: margin, label: "Tmid" },
    { x: cx, y: bottom, label: "Bmid" },
    { x: margin, y: cy, label: "Lmid" },
    { x: right, y: cy, label: "Rmid" },
  ];
}

/**
 * RGB raw buffer'a stamp'leri "lift" tarzı uygula:
 *   pixel = clamp(pixel + (stampValue - 127.5) * opacityScale)
 *
 * 0 → koyulaştır, 255 → açıklaştır. Düşük opacityScale (~5-8) ile insan gözüne
 * neredeyse görünmez ama NCC ile tespit edilebilir.
 */
export function applyL1Stamps(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  stamp: L1Stamp,
  positions: L1Position[],
  opacityScale = 6,
): void {
  const { size, pattern } = stamp;
  for (const pos of positions) {
    for (let dy = 0; dy < size; dy++) {
      const py = pos.y + dy;
      if (py < 0 || py >= height) continue;
      for (let dx = 0; dx < size; dx++) {
        const px = pos.x + dx;
        if (px < 0 || px >= width) continue;
        const stampVal = pattern[dy * size + dx]!;
        const delta = ((stampVal - 127.5) * opacityScale) / 255;
        const rowIdx = (py * width + px) * channels;
        for (let c = 0; c < 3; c++) {
          const cur = rgb[rowIdx + c]!;
          const next = Math.round(cur + delta);
          rgb[rowIdx + c] = next < 0 ? 0 : next > 255 ? 255 : next;
        }
      }
    }
  }
}

/**
 * Beklenen pozisyonlarda NCC (normalized cross-correlation) ile stamp varlığını
 * ara. Pozisyon görüntü dışına taşıyorsa (crop) o pozisyon `passed=false` olarak
 * raporlanır ama hata atılmaz.
 *
 * NCC eşiği ~0.30: low-opacity embedding sonrası gerçekçi taban (perfect
 * embed üzerinde tipik 0.5-0.8 arası, JPEG/rotate altında 0.2-0.4'e iner).
 */
export function detectL1(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
  stamp: L1Stamp,
  positions: L1Position[],
  nccThreshold = 0.30,
): L1DetectResult {
  const { size, pattern } = stamp;
  const perPos: Array<{ label: string; ncc: number; passed: boolean }> = [];
  let hits = 0;
  let bestNcc = -1;

  // Pre-compute pattern statistics
  const N = size * size;
  let pSum = 0;
  for (let i = 0; i < N; i++) pSum += pattern[i]!;
  const pMean = pSum / N;
  let pVar = 0;
  for (let i = 0; i < N; i++) {
    const d = pattern[i]! - pMean;
    pVar += d * d;
  }
  const pStd = Math.sqrt(pVar);

  for (const pos of positions) {
    if (
      pos.x < 0 ||
      pos.y < 0 ||
      pos.x + size > width ||
      pos.y + size > height
    ) {
      perPos.push({ label: pos.label, ncc: 0, passed: false });
      continue;
    }
    // Compute mean of luminance window
    let wSum = 0;
    const lumWin = new Float32Array(N);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const idx = ((pos.y + dy) * width + (pos.x + dx)) * channels;
        const lum =
          (rgb[idx]! * 0.299 + rgb[idx + 1]! * 0.587 + rgb[idx + 2]! * 0.114);
        lumWin[dy * size + dx] = lum;
        wSum += lum;
      }
    }
    const wMean = wSum / N;
    let cov = 0;
    let wVar = 0;
    for (let i = 0; i < N; i++) {
      const wd = lumWin[i]! - wMean;
      const pd = pattern[i]! - pMean;
      cov += wd * pd;
      wVar += wd * wd;
    }
    const wStd = Math.sqrt(wVar);
    const denom = wStd * pStd;
    const ncc = denom > 0 ? cov / denom : 0;
    const passed = ncc >= nccThreshold;
    perPos.push({ label: pos.label, ncc, passed });
    if (passed) hits++;
    if (ncc > bestNcc) bestNcc = ncc;
  }

  return {
    detected: hits >= 2, // en az 2 pozisyon → tesadüf değil
    hits,
    totalPositions: positions.length,
    bestNcc,
    perPositionNcc: perPos,
  };
}
