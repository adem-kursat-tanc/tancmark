/**
 * Step 5.8-A.3 SPIKE — 1D radial intensity profile + scale correlation
 * (sharp-free, FFT-free, pure-TS).
 *
 * Amaç: Phase C detector-first hattının ikinci primitifi. Wide-Hough
 * (`estimateRotationAngle` `maxAngleDeg=44`) θ tahmini verir; bu lib
 * ölçek (uniform scale) tahmini için **1D log-radial intensity profile**
 * çıkarır. Self-correlation tek başına identity ⇒ peak shift=0 (faydasız);
 * faydalı kullanım: encode-time reference profile fingerprint cloak
 * header'da saklanır, detect-time current profile vs reference 1D NCC
 * → scale ratio. **Bu skeleton** yalnız `extractRadialEnergyProfile` +
 * basit cross-correlation primitifi sağlar; reference profile saklama
 * + entegrasyonu T5.8-A.7 Spatial Coordinate Key turunda yapılır
 * (mesafe oranı vektörü ile birlikte).
 *
 * Algoritma:
 *   1. RGBA → luma (BT.601), downsample factor uygulanır.
 *   2. Görsel merkezini (cx, cy) = (w/2, h/2) seç.
 *   3. r ∈ [rMin, rMax] log-bin örnekleme (numRBins, default 64).
 *      r_k = rMin · (rMax/rMin)^(k/(numRBins-1))
 *   4. Her r_k için θ ∈ [0, 2π) numThetaSamples (default 128) örnekle;
 *      bilinear sample luma → ortalama → profile[k].
 *   5. Profile [0, 1] aralığa normalize (max-min).
 *
 * 1D NCC (`crossCorrelate1D`):
 *   • iki profile arasında shift ∈ [-maxShift, +maxShift] üzerinde NCC.
 *   • Çıktı: { peakShift, peakNcc, peakIndex }.
 *   • Sign convention (smoke + entegrasyon ile kilitli):
 *       scale_ratio_b_to_a = exp(-peakShift × dLog)
 *     (b daha BÜYÜK ise peak r yönünde sağa kayar; correlation `b`'yi
 *      `a` üzerine sola kaydırarak hizalar → peakShift NEGATİF.)
 *
 * Sharp-free kontratı: Uint8Array + Math.* primitives, native YOK.
 *
 * Performance bütçesi:
 *   • profile extraction 64×128 sample × bilinear = 8192 sample,
 *     downsample factor 1 ile ~1280×2160 görselde <50 ms.
 *   • cross-corr 64-bin × 21-shift = 1344 ops; <1 ms.
 */

export interface RadialProfileOptions {
  /** Linear downsample (luma sample stride). Default 1. */
  downsampleFactor?: number;
  /** Inner radius (pixels, post-downsample). Default 8. */
  rMin?: number;
  /**
   * Outer radius (pixels, post-downsample). Default min(w,h)/4 (auto).
   * Ham sayı verilirse override.
   */
  rMax?: number;
  /** Log-spaced radial bin count. Default 64. */
  numRBins?: number;
  /** Angular samples per radial bin. Default 128. */
  numThetaSamples?: number;
}

export interface RadialProfileResult {
  /** Length=numRBins, normalized [0,1]. */
  profile: Float32Array;
  /** rMin (post-DS pixel). */
  rMin: number;
  /** rMax (post-DS pixel). */
  rMax: number;
  /** numRBins (= profile.length). */
  numRBins: number;
  /** Image center used (post-DS coords). */
  cx: number;
  cy: number;
}

const PROFILE_DEFAULTS: Required<RadialProfileOptions> = {
  downsampleFactor: 1,
  rMin: 8,
  rMax: 0, // 0 ⇒ auto (min(w,h)/4)
  numRBins: 64,
  numThetaSamples: 128,
};

/**
 * Extract a 1D log-radial luma intensity profile around the image center.
 * Returns null on degenerate inputs (image too small, rMin >= rMax).
 */
export function extractRadialEnergyProfile(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts: RadialProfileOptions = {},
): RadialProfileResult | null {
  const o: Required<RadialProfileOptions> = { ...PROFILE_DEFAULTS, ...opts };
  if (rgba.length < width * height * 4) {
    throw new Error(
      `extractRadialEnergyProfile: rgba.length=${rgba.length} < w*h*4=${width * height * 4}`,
    );
  }
  if (o.numRBins < 4 || o.numThetaSamples < 4) return null;

  const ds = Math.max(1, o.downsampleFactor | 0);
  const dw = Math.max(1, Math.floor(width / ds));
  const dh = Math.max(1, Math.floor(height / ds));
  if (dw < 16 || dh < 16) return null;

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

  const cx = (dw - 1) / 2;
  const cy = (dh - 1) / 2;
  const autoRMax = Math.floor(Math.min(dw, dh) / 4);
  const rMax = o.rMax > 0 ? Math.min(o.rMax, autoRMax * 2) : autoRMax;
  const rMin = Math.max(2, Math.min(o.rMin, rMax - 4));
  if (rMin >= rMax) return null;

  const N = o.numRBins;
  const T = o.numThetaSamples;
  const profile = new Float32Array(N);
  const logRMin = Math.log(rMin);
  const logRMax = Math.log(rMax);
  const dLog = (logRMax - logRMin) / Math.max(1, N - 1);
  const dTheta = (2 * Math.PI) / T;

  for (let k = 0; k < N; k++) {
    const r = Math.exp(logRMin + dLog * k);
    let acc = 0;
    let cnt = 0;
    for (let t = 0; t < T; t++) {
      const ang = t * dTheta;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= dw || y0 + 1 >= dh) continue;
      const fx = x - x0;
      const fy = y - y0;
      const i00 = y0 * dw + x0;
      const v00 = luma[i00]!;
      const v10 = luma[i00 + 1]!;
      const v01 = luma[i00 + dw]!;
      const v11 = luma[i00 + dw + 1]!;
      const v =
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy +
        v11 * fx * fy;
      acc += v;
      cnt++;
    }
    profile[k] = cnt > 0 ? acc / cnt : 0;
  }

  // Normalize to [0, 1] (min-max) for shift-invariant NCC ranking.
  let mn = Infinity;
  let mx = -Infinity;
  for (let k = 0; k < N; k++) {
    const v = profile[k]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const range = mx - mn;
  if (range < 1e-9) {
    // Degenerate flat profile (uniform image at sample radii).
    return { profile, rMin, rMax, numRBins: N, cx, cy };
  }
  for (let k = 0; k < N; k++) {
    profile[k] = (profile[k]! - mn) / range;
  }

  return { profile, rMin, rMax, numRBins: N, cx, cy };
}

export interface CrossCorrResult {
  /** Best shift index (negative = b shifted left vs a). */
  peakShift: number;
  /** NCC value at peak ∈ [-1, 1]. */
  peakNcc: number;
  /** Mean NCC across all candidate shifts (noise floor). */
  meanNcc: number;
  /** confidence = peakNcc / max(|meanNcc|, 0.01). */
  confidence: number;
}

/**
 * 1D normalized cross-correlation between two equal-length profiles
 * across integer shifts ∈ [-maxShift, +maxShift]. For log-radial
 * profiles, peakShift × dLog = log(scale_ratio_b_to_a).
 *
 * Returns null if input lengths mismatch or maxShift too large.
 */
export function crossCorrelate1D(
  a: Float32Array,
  b: Float32Array,
  maxShift: number,
): CrossCorrResult | null {
  if (a.length !== b.length) return null;
  const N = a.length;
  if (maxShift < 0 || maxShift >= N - 2) return null;

  // Mean-center for NCC numerator (Pearson over overlap).
  // For each shift s ∈ [-maxShift, +maxShift], compute correlation
  // over the overlap window: a[i+max(0,s)] vs b[i+max(0,-s)].
  let peakShift = 0;
  let peakNcc = -2;
  const allNcc: number[] = [];
  for (let s = -maxShift; s <= maxShift; s++) {
    const aStart = Math.max(0, s);
    const bStart = Math.max(0, -s);
    const len = N - Math.abs(s);
    if (len < 4) {
      allNcc.push(0);
      continue;
    }
    let aSum = 0;
    let bSum = 0;
    for (let i = 0; i < len; i++) {
      aSum += a[aStart + i]!;
      bSum += b[bStart + i]!;
    }
    const aMean = aSum / len;
    const bMean = bSum / len;
    let num = 0;
    let aVar = 0;
    let bVar = 0;
    for (let i = 0; i < len; i++) {
      const da = a[aStart + i]! - aMean;
      const db = b[bStart + i]! - bMean;
      num += da * db;
      aVar += da * da;
      bVar += db * db;
    }
    const denom = Math.sqrt(aVar * bVar);
    const ncc = denom > 1e-9 ? num / denom : 0;
    allNcc.push(ncc);
    if (ncc > peakNcc) {
      peakNcc = ncc;
      peakShift = s;
    }
  }

  let sum = 0;
  for (const v of allNcc) sum += v;
  const meanNcc = sum / allNcc.length;
  const confidence = peakNcc / Math.max(0.01, Math.abs(meanNcc));

  return { peakShift, peakNcc, meanNcc, confidence };
}
