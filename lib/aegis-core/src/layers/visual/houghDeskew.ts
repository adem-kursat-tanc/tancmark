/**
 * Faz 5 Step 5.4 T3 — Hough-style rotation deskew (sharp-free, pure TS).
 *
 * Amaç: Step 5.4 T2'nin v2-8marker detect path'inde Pass 1 (FAST=8 px) +
 * Pass 2 (COARSE ≤96 px) `<5/8` hit ile döndüğünde, kaynak görseldeki
 * |θ| ∈ [3°, 15°] aralığındaki yamukluğu tespit edip route katmanına
 * "deskew açısı" raporla. Route θ'yı `warpRgba(invertAffine(rotationAffine(
 * −θ_rad, cx, cy)))` ile uygular ve outer FAST scan'i tek seferlik tekrar
 * eder. |θ| < 3° veya confidence < eşik ⇒ `null` (dürüst kapsam-dışı).
 *
 * Algoritma — accumulator-based deskew (NOT line Hough):
 *   1. RGBA → luma (BT.601) ve `downsampleFactor` (default 2 = %25 piksel).
 *   2. Sobel 3×3 → her piksel için (gx, gy, magnitude). 1-px border atılır.
 *   3. Magnitude eşiği: tepe %5 piksel (histogram-bin reverse-CDF). Min
 *      `minEdgePixels` (default 1000) altında ⇒ `null` (edge-poor).
 *   4. Her edge piksel için **gradient açısı** α = atan2(gy, gx). α'yı
 *      π/2 ile MOD'lar ve [−π/4, π/4]'e katlarız:
 *        folded = ((α + π/4) mod π/2) − π/4
 *      Bu fold axis-aligned (0°, 90°, 180°, 270°) edge'lerin hepsini 0°'a
 *      eşler — temiz görselde folded ≈ 0 etrafında yığılır. Görsel θ
 *      kadar döndürülmüşse axis-aligned edge'ler θ'a kayar ⇒ folded ≈ θ.
 *   5. θ histogram (`numBins` = 2·⌈maxAngle/binWidth⌉ + 1; default 61 bin
 *      ±15°/0.5°). Her edge magnitude ile ağırlıklandırılır.
 *   6. Peak bin → `peakVal`; tüm bin'lerin (sıfırlar dahil) ortalaması → `meanVal`.
 *      `confidence = peakVal / meanVal`. < `minConfidence` (default 3.0)
 *      ⇒ `null`.
 *   7. Sub-pixel parabolik refinement (3-nokta vertex form) — ±0.1° hassas.
 *   8. |θ_refined| < `minAngleDeg` (default 1.0°) ⇒ `null` (deskew gereksiz).
 *
 * Numerical stability: edge-piksel koordinatları doğrudan kullanılmaz —
 * yalnız gradient YÖNü (translation-invariant) histograma katkıda bulunur.
 * Bu, point-based homography'de gerekli olan Hartley normalize'in
 * accumulator-based deskew'deki muadilidir (orientation hesabı koordinattan
 * bağımsız).
 *
 * Sharp-free kontratı: `lib/aegis-core` içinde sadece Uint8Array + Math.*
 * primitives; native bağımlılık YOK.
 *
 * Performans bütçesi (ölçüm hedefi):
 *   - 1280×2160 RGBA, downsample 2 ⇒ 640×1080 ≈ 691K luma piksel.
 *   - Sobel: 4 ops/piksel × 691K = ~3M ops.
 *   - Histogram + θ-bin: ~%5 edge ⇒ ~35K edge × O(1) = ~35K ops.
 *   - Toplam: ~3M ops, Node 24'te <500ms hedef. Yalnız Pass 3 (T2 <5/8) path'inde devreye girer ⇒ clean image hiç ödemez.
 *
 * Aralık dürüstlüğü: maxAngleDeg=15° dışındaki rotation'lar (ör. ±30°)
 * folded space'te ya peak'i ±π/4 sınırına düşürür (yanlış bin) ya da
 * histogram'a hiç katkı yapmaz (folded < −maxAngleRad gate). Confidence
 * eşiği bu durumda zaten düşer ⇒ honest `null`.
 */

export interface HoughDeskewOptions {
  /** Linear downsample factor (≥1). Default 2 ⇒ ¼ piksel maliyet. */
  downsampleFactor?: number;
  /** |θ_refined| < bu değer ⇒ null (deskew gereksiz). Default 1.0°. */
  minAngleDeg?: number;
  /** Histogram θ kapsamı: ±maxAngleDeg. Default 15°. */
  maxAngleDeg?: number;
  /** Bin genişliği (derece). Default 0.5°. */
  binWidthDeg?: number;
  /** peak/mean(allBins) oranı bu değerin altında ⇒ null. Default 3.0. */
  minConfidence?: number;
  /** Sobel magnitude tepe percentile. Default 0.05 (top %5). */
  edgePercentile?: number;
  /** Edge piksel sayısı bu değerden az ⇒ null (edge-poor). Default 1000. */
  minEdgePixels?: number;
}

export interface HoughDeskewResult {
  /** Tespit edilen rotation, derece. CCW pozitif. Aralık [−maxAngleDeg, +maxAngleDeg]. */
  thetaDeg: number;
  /** peak / mean(allBins). Yüksek = belirgin yapısal hizalama. */
  confidence: number;
  /** Histograma katkıda bulunan toplam edge piksel sayısı. */
  edgePixelCount: number;
  /** Peak bin'in toplam ağırlığı (debug). */
  peakBinWeight: number;
  /** Tüm bin'lerin ortalama ağırlığı = peak/conf gürültü tabanı (debug). */
  meanBinWeight: number;
}

const DEFAULTS: Required<HoughDeskewOptions> = {
  downsampleFactor: 2,
  minAngleDeg: 1.0,
  maxAngleDeg: 15.0,
  binWidthDeg: 0.5,
  minConfidence: 3.0,
  edgePercentile: 0.05,
  minEdgePixels: 1000,
};

const MAG_HIST_BINS = 256;

/**
 * Estimate rotation angle θ ∈ [−maxAngleDeg, +maxAngleDeg] of `rgba` so
 * that warping by `−θ` deskews the image. Returns `null` when:
 *   • image too small (post-downsample <8×8)
 *   • edge-poor (<minEdgePixels above magnitude threshold)
 *   • peak/mean(allBins) confidence < minConfidence
 *   • |θ_refined| < minAngleDeg (no significant rotation)
 */
export function estimateRotationAngle(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts: HoughDeskewOptions = {},
): HoughDeskewResult | null {
  const o: Required<HoughDeskewOptions> = { ...DEFAULTS, ...opts };
  if (rgba.length < width * height * 4) {
    throw new Error(
      `estimateRotationAngle: rgba.length=${rgba.length} < width*height*4=${
        width * height * 4
      }`,
    );
  }
  if (o.maxAngleDeg <= 0 || o.maxAngleDeg > 44) {
    throw new Error(
      `estimateRotationAngle: maxAngleDeg must be in (0, 44]; got ${o.maxAngleDeg}`,
    );
  }
  if (o.binWidthDeg <= 0 || o.binWidthDeg > o.maxAngleDeg) {
    throw new Error(
      `estimateRotationAngle: binWidthDeg must be in (0, maxAngleDeg]; got ${o.binWidthDeg}`,
    );
  }

  // ── 1. Downsample to luma (BT.601). ──────────────────────────────────
  const ds = Math.max(1, o.downsampleFactor | 0);
  const dw = Math.max(1, Math.floor(width / ds));
  const dh = Math.max(1, Math.floor(height / ds));
  if (dw < 8 || dh < 8) return null;
  const luma = new Float32Array(dw * dh);
  for (let dy = 0; dy < dh; dy++) {
    const sy = Math.min(height - 1, dy * ds);
    for (let dx = 0; dx < dw; dx++) {
      const sx = Math.min(width - 1, dx * ds);
      const i = (sy * width + sx) * 4;
      luma[dy * dw + dx] =
        0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    }
  }

  // ── 2. Sobel 3×3 → gx, gy, magnitude. 1-px border skipped. ──────────
  const W = dw;
  const H = dh;
  const gx = new Float32Array(W * H);
  const gy = new Float32Array(W * H);
  const mag = new Float32Array(W * H);
  let maxMag = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const tl = luma[i - W - 1]!;
      const t = luma[i - W]!;
      const tr = luma[i - W + 1]!;
      const l = luma[i - 1]!;
      const r = luma[i + 1]!;
      const bl = luma[i + W - 1]!;
      const b = luma[i + W]!;
      const br = luma[i + W + 1]!;
      const gxv = -tl + tr - 2 * l + 2 * r - bl + br;
      const gyv = -tl - 2 * t - tr + bl + 2 * b + br;
      gx[i] = gxv;
      gy[i] = gyv;
      const m = Math.hypot(gxv, gyv);
      mag[i] = m;
      if (m > maxMag) maxMag = m;
    }
  }
  if (maxMag < 1e-6) return null; // uniform image

  // ── 3. Magnitude reverse-CDF ile top-percentile threshold. ──────────
  const histM = new Int32Array(MAG_HIST_BINS);
  const interiorPx = (W - 2) * (H - 2);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const m = mag[y * W + x]!;
      let bin = Math.floor((m / maxMag) * MAG_HIST_BINS);
      if (bin >= MAG_HIST_BINS) bin = MAG_HIST_BINS - 1;
      histM[bin]!++;
    }
  }
  const targetCount = Math.max(
    o.minEdgePixels,
    Math.floor(interiorPx * o.edgePercentile),
  );
  let acc = 0;
  let threshBin = MAG_HIST_BINS - 1;
  for (let bin = MAG_HIST_BINS - 1; bin >= 0; bin--) {
    acc += histM[bin]!;
    if (acc >= targetCount) {
      threshBin = bin;
      break;
    }
  }
  const magThresh = (threshBin / MAG_HIST_BINS) * maxMag;

  // ── 4. θ histogram. Folded gradient angle ∈ [−π/4, π/4]. ────────────
  const binWidthRad = (o.binWidthDeg * Math.PI) / 180;
  const maxAngleRad = (o.maxAngleDeg * Math.PI) / 180;
  const halfBins = Math.ceil(o.maxAngleDeg / o.binWidthDeg);
  const numBins = 2 * halfBins + 1;
  const thetaHist = new Float32Array(numBins);
  const QUARTER_PI = Math.PI / 4;
  const HALF_PI = Math.PI / 2;
  let edgePixelCount = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const m = mag[i]!;
      if (m < magThresh) continue;
      // Fold gradient angle to [−π/4, π/4]:
      //   folded = ((α + π/4) mod π/2) − π/4
      let alpha = Math.atan2(gy[i]!, gx[i]!);
      // Use stable modulo (handles negative α correctly).
      let shifted = alpha + QUARTER_PI;
      let folded = shifted - Math.floor(shifted / HALF_PI) * HALF_PI - QUARTER_PI;
      if (folded < -maxAngleRad || folded > maxAngleRad) continue;
      const binIdx = halfBins + Math.round(folded / binWidthRad);
      if (binIdx >= 0 && binIdx < numBins) {
        thetaHist[binIdx]! += m;
        edgePixelCount++;
      }
    }
  }
  if (edgePixelCount < o.minEdgePixels) return null;

  // ── 5. Peak bin. ─────────────────────────────────────────────────────
  let peakBin = 0;
  let peakVal = thetaHist[0]!;
  for (let bin = 1; bin < numBins; bin++) {
    const v = thetaHist[bin]!;
    if (v > peakVal) {
      peakVal = v;
      peakBin = bin;
    }
  }
  if (peakVal <= 0) return null;

  // ── 6. Confidence = peak / mean(all bins). ──────────────────────────
  //   Tüm bin'ler dahil (sıfırlar dahil) ortalama gürültü tabanı:
  //     • Tek bin doldurulmuş (smooth gratings) ⇒ conf ≈ numBins (~61).
  //     • Uniform dağılım (rastgele) ⇒ conf ≈ 1.
  //   Önceki nonzero-median formülü tek bin durumunda 1.0 verip yanlış
  //   reject ediyordu (en güçlü "tek yön" sinyalini en zayıf gibi gösteriyordu).
  let totalW = 0;
  for (let bin = 0; bin < numBins; bin++) totalW += thetaHist[bin]!;
  const meanW = totalW / numBins;
  const confidence = meanW > 0 ? peakVal / meanW : peakVal;

  // ── 7. Parabolic sub-pixel refinement (vertex of fitted parabola). ──
  let refinedBin = peakBin;
  if (peakBin > 0 && peakBin < numBins - 1) {
    const ym1 = thetaHist[peakBin - 1]!;
    const y0 = thetaHist[peakBin]!;
    const y1 = thetaHist[peakBin + 1]!;
    const denom = ym1 - 2 * y0 + y1;
    if (Math.abs(denom) > 1e-9) {
      const offset = (ym1 - y1) / (2 * denom);
      if (offset > -1 && offset < 1) refinedBin = peakBin + offset;
    }
  }
  const thetaRad = (refinedBin - halfBins) * binWidthRad;
  const thetaDeg = (thetaRad * 180) / Math.PI;

  // ── 8. Confidence + minimum-angle gates. ────────────────────────────
  if (confidence < o.minConfidence) return null;
  if (Math.abs(thetaDeg) < o.minAngleDeg) return null;

  return {
    thetaDeg,
    confidence,
    edgePixelCount,
    peakBinWeight: peakVal,
    meanBinWeight: meanW,
  };
}
