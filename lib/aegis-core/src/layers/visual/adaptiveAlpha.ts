/**
 * AEGIS T007 — Adaptive amplitude tuning for TripleShield (lib reconstruction)
 *
 * Maps local luma standard deviation → BPSK amplitude α for each
 * TripleShield anchor stamp.
 *
 *   - Quieter substrate (low std, e.g. plain white) → smaller α to stay
 *     under the visible-artifact threshold.
 *   - Noisier substrate (text-heavy, high std) → larger α so the carrier
 *     survives JPEG quantisation + bilinear-warp attenuation.
 *
 * Range α ∈ [20, 80]; linear in std with slope 1.2 above the floor.
 *
 * SHARP-FREE: pure pixel/byte arithmetic. lib/aegis-core sharp dependency
 * forbidden.
 */

export const ADAPTIVE_ALPHA_MIN = 20;
export const ADAPTIVE_ALPHA_MAX = 80;
export const ADAPTIVE_ALPHA_SLOPE = 1.2;
export const ADAPTIVE_ALPHA_PATCH_SIZE = 32;

/** BT.601 luma standard deviation over a 32×32 patch at top-left (x, y).
 *  Out-of-bounds samples are skipped (not clamped) so partial patches
 *  near image edges do not bias the std with edge-replicated pixels. */
export function computeLocalLumaStd(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let py = 0; py < ADAPTIVE_ALPHA_PATCH_SIZE; py++) {
    const sy = y + py;
    if (sy < 0 || sy >= height) continue;
    for (let px = 0; px < ADAPTIVE_ALPHA_PATCH_SIZE; px++) {
      const sx = x + px;
      if (sx < 0 || sx >= width) continue;
      const i = (sy * width + sx) * 4;
      const luma = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
      sum += luma;
      sumSq += luma * luma;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return Math.sqrt(variance);
}

/** Map a local luma std (typically 0..50 for paper-like substrates with
 *  text) → α ∈ [ADAPTIVE_ALPHA_MIN, ADAPTIVE_ALPHA_MAX]. */
export function alphaForStd(std: number): number {
  const a = ADAPTIVE_ALPHA_MIN + ADAPTIVE_ALPHA_SLOPE * std;
  if (a < ADAPTIVE_ALPHA_MIN) return ADAPTIVE_ALPHA_MIN;
  if (a > ADAPTIVE_ALPHA_MAX) return ADAPTIVE_ALPHA_MAX;
  return a;
}
