/**
 * AEGIS T007.10 — Projection-Profile Sanity Check.
 *
 * Amaç: TripleShield cardinal pre-search içinde "yanlış kardinal kilidi"
 * (false-cardinal lock) saldırısını engellemek. R1 NCC tek başına yeterli
 * değil — özellikle 90°-rotated text orientation flip yarattığında bir
 * yanlış kardinal yüksek R1 verebiliyor. Ek bir "bu cardinal'da metin
 * gerçekten yatay mı?" sanity sorusu sorulur:
 *
 *   - Text-bearing dökümanlarda yatay projeksiyon profili (her satırın
 *     toplam edge-magnitude'u) yüksek varyans gösterir (text rows = peak,
 *     boş rows = valley).
 *   - Yanlış kardinal'a döndürülmüş image'da text dikey olur → yatay
 *     projeksiyon düz (varyans düşük).
 *
 * Skor: `horizontalScore / verticalScore` oranı.
 *   - >> 1 (1.5+): metin yatay (DOĞRU cardinal)
 *   - ~ 1.0: text-fakir veya tam diyagonal (kararsız)
 *   - << 1 (0.66 altı): metin dikey (YANLIŞ cardinal — 90° flip)
 *
 * Sharp-free, pure RGBA → luma → row/column variance. Downsample destekli.
 *
 * KIRMIZI ÇİZGİLER intakt:
 *   - aegis-core sharp-free (sadece TypedArray + Math).
 *   - Decisive değil — sadece R1 NCC'ye ek tie-breaker / penalty.
 *   - Match Field intact: image içeriği üzerine değil, ORIENTATION inference.
 */

const DEFAULTS = {
  downsampleFactor: 4,
  minSpan: 32, // alt sınır pixel boyutu (downsample sonrası)
};

export interface ProjectionProfileResult {
  horizontalVar: number;
  verticalVar: number;
  ratio: number; // horizontalVar / verticalVar (clamped denominator)
  isHorizontalText: boolean; // ratio >= 1.5
  isVerticalText: boolean; // ratio <= 0.667
  edgePixelEstimate: number;
}

function rgbaToLuma(
  rgba: Uint8Array,
  width: number,
  height: number,
  ds: number,
): { luma: Float32Array; w: number; h: number } {
  const w = Math.max(1, Math.floor(width / ds));
  const h = Math.max(1, Math.floor(height / ds));
  const luma = new Float32Array(w * h);
  for (let dy = 0; dy < h; dy++) {
    const sy = Math.min(height - 1, dy * ds);
    for (let dx = 0; dx < w; dx++) {
      const sx = Math.min(width - 1, dx * ds);
      const i = (sy * width + sx) * 4;
      luma[dy * w + dx] =
        0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    }
  }
  return { luma, w, h };
}

function rowEdgeProfile(luma: Float32Array, w: number, h: number): Float64Array {
  // Yatay edge magnitude per-row: each row → sum of |luma[x]-luma[x+1]|.
  // Yüksek bant text satırlarında, alçak bant boş satırlarda.
  const profile = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    const base = y * w;
    for (let x = 0; x < w - 1; x++) {
      s += Math.abs(luma[base + x + 1]! - luma[base + x]!);
    }
    profile[y] = s;
  }
  return profile;
}

function colEdgeProfile(luma: Float32Array, w: number, h: number): Float64Array {
  // Dikey edge magnitude per-column: each col → sum of |luma[y]-luma[y+1]|.
  const profile = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h - 1; y++) {
      s += Math.abs(luma[(y + 1) * w + x]! - luma[y * w + x]!);
    }
    profile[x] = s;
  }
  return profile;
}

function variance(arr: Float64Array): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i]!;
  const mean = sum / arr.length;
  let v = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i]! - mean;
    v += d * d;
  }
  return v / arr.length;
}

/**
 * "Bu görüntüde metin yatay mı?" projeksiyon profili sanity check.
 *
 * @returns ratio >= 1.5 → text horizontally aligned (correct cardinal).
 *          ratio <= 0.667 → text vertical (wrong cardinal — likely 90° flip).
 *          else: ambiguous / text-poor.
 */
export function projectionProfileSanity(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts: Partial<typeof DEFAULTS> = {},
): ProjectionProfileResult {
  const o = { ...DEFAULTS, ...opts };
  if (rgba.length < width * height * 4) {
    throw new Error(
      `projectionProfileSanity: rgba too small (${rgba.length} < ${width * height * 4})`,
    );
  }
  const { luma, w, h } = rgbaToLuma(rgba, width, height, Math.max(1, o.downsampleFactor | 0));
  if (w < o.minSpan || h < o.minSpan) {
    return {
      horizontalVar: 0,
      verticalVar: 0,
      ratio: 1,
      isHorizontalText: false,
      isVerticalText: false,
      edgePixelEstimate: 0,
    };
  }
  // Row profile uses HORIZONTAL gradient summed per-row.
  // For HORIZONTAL text, each text row has many horizontal edges → high
  // value, each gap row → low value → high VARIANCE across rows.
  const rowProf = rowEdgeProfile(luma, w, h);
  // Col profile uses VERTICAL gradient summed per-column. For VERTICAL
  // text (wrong cardinal), each text column has many vertical edges →
  // high value, gap columns → low → high VARIANCE across columns.
  const colProf = colEdgeProfile(luma, w, h);
  const hVar = variance(rowProf);
  const vVar = variance(colProf);
  const denom = Math.max(vVar, 1e-6);
  const ratio = hVar / denom;
  let edgeSum = 0;
  for (let i = 0; i < rowProf.length; i++) edgeSum += rowProf[i]!;
  // Edge-density gate: if substrate is mostly blank (low total horizontal
  // edge magnitude per pixel), neither flag fires. Empirik 0.5 eşik 245-on-
  // -245 background için sıfırı kapatır, real text için 5+'a çıkar.
  const edgeDensity = edgeSum / Math.max(1, w * h);
  const hasText = edgeDensity >= 0.5;
  return {
    horizontalVar: hVar,
    verticalVar: vVar,
    ratio,
    isHorizontalText: hasText && ratio >= 1.25,
    isVerticalText: hasText && ratio <= 0.8,
    edgePixelEstimate: Math.round(edgeSum),
  };
}
