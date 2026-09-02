// Sobel Gradient-Orientation GPS — sharp-free.
//
// AMAÇ: Bir görüntünün hangi cardinal'a (0°/90°/180°/270°) hizalı olduğunu
// piksel akış yönlerinden saptamak. Projection-profile (T007.10 LANDED ama
// dense text üzerinde tunable değil) yerine Sobel gradient-açı histogram
// majority vote. Yoğun text dokümanlarında: yatay text → vertical gradient
// dominant (Y-edges; satır altı/üstü yüksek kontrast) → açı modu ≈ 90° from
// horizontal-axis. 90° döndürülmüş text → horizontal gradient dominant → mod
// ≈ 0°. Bu invariant text yoğunluğundan bağımsız, sadece glyph stroke
// yönüne bağlı.
//
// API:
//   sobelOrientationVote(rgba, width, height, opts?) →
//     { dominantAxis: "horizontal"|"vertical"|"ambiguous",
//       horizontalEnergy, verticalEnergy, ratio, peakBin, totalSamples }
//
// SEMANTIC:
//   - "horizontal" : text rows yatay (gradient'ler dikey) — cardinal=0/180.
//   - "vertical"   : text columns dikey (gradient'ler yatay) — cardinal=90/270.
//   - "ambiguous"  : ratio eşik altı.
//
// PARAMS:
//   downsampleFactor (default 4) — perf için.
//   magThreshold (default 24) — düşük-magnitude pikselleri ele.
//   ratioStrong (default 1.4) — dominant axis için min energy ratio.
//
// KIRMIZI ÇİZGİLER:
//   - sharp-free (TypedArray + Math).
//   - decisive değil; harness composite score'a tie-breaker katkı.

export interface SobelOrientationVoteOptions {
  downsampleFactor?: number;
  magThreshold?: number;
  ratioStrong?: number;
}

export interface SobelOrientationVoteResult {
  dominantAxis: "horizontal" | "vertical" | "ambiguous";
  horizontalEnergy: number;
  verticalEnergy: number;
  ratio: number;
  peakBin: number;
  totalSamples: number;
}

const DEFAULT_OPTS: Required<SobelOrientationVoteOptions> = {
  downsampleFactor: 4,
  magThreshold: 24,
  ratioStrong: 1.4,
};

export function sobelOrientationVote(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts: SobelOrientationVoteOptions = {},
): SobelOrientationVoteResult {
  const { downsampleFactor, magThreshold, ratioStrong } = { ...DEFAULT_OPTS, ...opts };
  const ds = Math.max(1, downsampleFactor | 0);

  // Build downsampled luma plane (BT.601).
  const W = Math.floor(width / ds);
  const H = Math.floor(height / ds);
  if (W < 4 || H < 4) {
    return {
      dominantAxis: "ambiguous",
      horizontalEnergy: 0,
      verticalEnergy: 0,
      ratio: 1,
      peakBin: 0,
      totalSamples: 0,
    };
  }
  const luma = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = y * ds;
    for (let x = 0; x < W; x++) {
      const sx = x * ds;
      const idx = (sy * width + sx) * 4;
      luma[y * W + x] =
        0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
    }
  }

  // Sobel 3×3. Bin gradients into 18-bin half-circle histogram (10° bins).
  // Then collapse onto two cardinal axes:
  //   horizontalEnergy = bins around 0° (gradient pointing horizontal → vertical edges, i.e. text columns)
  //   verticalEnergy   = bins around 90° (gradient pointing vertical → horizontal edges, i.e. text rows)
  // Half-circle: angle = atan2(gy, gx) modded into [0, 180).
  const NBINS = 18;
  const hist = new Float64Array(NBINS);
  let totalSamples = 0;

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      // Sobel X: [[-1,0,1],[-2,0,2],[-1,0,1]]
      const gx =
        -luma[i - W - 1] - 2 * luma[i - 1] - luma[i + W - 1] +
         luma[i - W + 1] + 2 * luma[i + 1] + luma[i + W + 1];
      // Sobel Y: [[-1,-2,-1],[0,0,0],[1,2,1]]
      const gy =
        -luma[i - W - 1] - 2 * luma[i - W] - luma[i - W + 1] +
         luma[i + W - 1] + 2 * luma[i + W] + luma[i + W + 1];
      const mag = Math.hypot(gx, gy);
      if (mag < magThreshold) continue;
      // Half-circle angle in [0, 180).
      let theta = Math.atan2(gy, gx) * (180 / Math.PI);
      if (theta < 0) theta += 180;
      if (theta >= 180) theta -= 180;
      const bin = Math.min(NBINS - 1, Math.floor(theta / (180 / NBINS)));
      hist[bin] += mag;
      totalSamples++;
    }
  }

  if (totalSamples === 0) {
    return {
      dominantAxis: "ambiguous",
      horizontalEnergy: 0,
      verticalEnergy: 0,
      ratio: 1,
      peakBin: 0,
      totalSamples: 0,
    };
  }

  // Cardinal energy collapse:
  //   "horizontal-text" axis (rows of text → horizontal-running edges → gradient
  //   vector mostly VERTICAL → bins around 90°, i.e. bin index ≈ 9).
  //   "vertical-text" axis  (cols of text → vertical-running edges → gradient
  //   vector mostly HORIZONTAL → bins around 0°/180°, i.e. bin index ≈ 0 or 17).
  // Tolerance ±2 bins (≈ ±20°) per axis.
  let verticalEnergy = 0; // gradient vertical → text rows horizontal
  let horizontalEnergy = 0; // gradient horizontal → text rows vertical
  const VBIN_CENTER = 9; // 90°
  const HBIN_CENTER_A = 0; // 0°
  const HBIN_CENTER_B = NBINS - 1; // 170° (wraps to 0°)
  const TOL = 2;
  for (let b = 0; b < NBINS; b++) {
    const dV = Math.min(Math.abs(b - VBIN_CENTER), NBINS - Math.abs(b - VBIN_CENTER));
    if (dV <= TOL) verticalEnergy += hist[b];
    const dHA = Math.min(Math.abs(b - HBIN_CENTER_A), NBINS - Math.abs(b - HBIN_CENTER_A));
    const dHB = Math.min(Math.abs(b - HBIN_CENTER_B), NBINS - Math.abs(b - HBIN_CENTER_B));
    if (dHA <= TOL || dHB <= TOL) horizontalEnergy += hist[b];
  }

  let peakBin = 0;
  let peakVal = -Infinity;
  for (let b = 0; b < NBINS; b++) {
    if (hist[b] > peakVal) {
      peakVal = hist[b];
      peakBin = b;
    }
  }

  const safeMin = 1e-9;
  const ratio = (verticalEnergy + safeMin) / (horizontalEnergy + safeMin);
  let dominantAxis: SobelOrientationVoteResult["dominantAxis"];
  if (ratio >= ratioStrong) dominantAxis = "horizontal"; // vertical gradient → horizontal text
  else if (ratio <= 1 / ratioStrong) dominantAxis = "vertical"; // horizontal gradient → vertical text
  else dominantAxis = "ambiguous";

  return {
    dominantAxis,
    horizontalEnergy,
    verticalEnergy,
    ratio,
    peakBin,
    totalSamples,
  };
}
