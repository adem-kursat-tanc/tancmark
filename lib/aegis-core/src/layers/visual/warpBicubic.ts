// ──────────────────────────────────────────────────────────────────────
// warpBicubic — inverse-mapping bicubic (Catmull-Rom) RGBA warp.
// ──────────────────────────────────────────────────────────────────────
//
// Faz 5 Step 5.7-D — sharp-free Catmull-Rom 4×4 cubic interpolation.
//
// Drop-in alternative to `warpRgba` (bilinear) for cases where sub-pixel
// precision matters more than the ~3× cost: e.g. Phase B DCT detect
// buffer where the 32×32 envelope's high-frequency R3 ring (r∈[10,14])
// requires sub-pixel sample fidelity.
//
// KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu): This helper is intended for
// detection-only buffers. The main `recoverAttackedImage` chain MUST
// stay on bilinear `warpRgba` (single pass). Adding bicubic to the
// recovery chain would create a triple-bilinear-equivalent SNR
// degradation cascade; isolate bicubic to the detect side only.
//
// Properties:
//  • Identity warp is lossless at integer pixel offsets (Catmull-Rom
//    weights collapse to [0,1,0,0] at t=0).
//  • Edge-clamp boundary (no wrap, no mirror) — out-of-bounds source
//    samples are clamped to the nearest in-bounds index.
//  • Out-of-bounds DST pixels (where the inverse-mapped src lies
//    outside the source rect) get the `fill` color, identical to
//    bilinear `warpRgba` behavior.

import type { AffineMatrix, WarpOptions } from "./affineFit";

// Catmull-Rom weights (a = -0.5).
//   p0 = pixel at xi-1, p1 = xi, p2 = xi+1, p3 = xi+2
//   t  = fractional offset xs - xi, in [0, 1)
function catmullRomWeights(t: number): [number, number, number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    -0.5 * t3 + t2 - 0.5 * t,
    1.5 * t3 - 2.5 * t2 + 1,
    -1.5 * t3 + 2.0 * t2 + 0.5 * t,
    0.5 * t3 - 0.5 * t2,
  ];
}

/**
 * Inverse-mapping bicubic (Catmull-Rom) warp. RGBA in/out.
 *
 * `M` is interpreted as the dst→src map (classical inverse warp), same
 * convention as `warpRgba`. For each dst pixel (xd, yd), the source
 * coord is (xs, ys) = (a·xd + b·yd + tx, c·xd + d·yd + ty). A 4×4
 * source neighborhood around (floor(xs), floor(ys)) is sampled with
 * Catmull-Rom weights along x and y; channels are combined
 * separately and clamped to [0, 255].
 *
 * Out-of-bounds DST pixels get the `fill` color.
 * Source-side OOB samples are edge-clamped (nearest in-bounds index).
 */
export function warpRgbaBicubic(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  M: AffineMatrix,
  options?: WarpOptions,
): { rgba: Uint8Array; width: number; height: number } {
  const dstW = options?.dstWidth ?? srcW;
  const dstH = options?.dstHeight ?? srcH;
  const fr = options?.fill?.[0] ?? 0;
  const fg = options?.fill?.[1] ?? 0;
  const fb = options?.fill?.[2] ?? 0;
  const fa = options?.fill?.[3] ?? 0;
  const out = new Uint8Array(dstW * dstH * 4);
  const xMaxIn = srcW - 1;
  const yMaxIn = srcH - 1;
  for (let yd = 0; yd < dstH; yd++) {
    const baseX = M.b * yd + M.tx;
    const baseY = M.d * yd + M.ty;
    let xs = baseX;
    let ys = baseY;
    let di = yd * dstW * 4;
    for (let xd = 0; xd < dstW; xd++) {
      // OOB DST guard: if the inverse-mapped src lies completely
      // outside the source rect, paint fill (parity with warpRgba).
      if (xs < 0 || ys < 0 || xs > xMaxIn || ys > yMaxIn) {
        out[di] = fr;
        out[di + 1] = fg;
        out[di + 2] = fb;
        out[di + 3] = fa;
      } else {
        const xi = xs >= xMaxIn ? xMaxIn : Math.floor(xs);
        const yi = ys >= yMaxIn ? yMaxIn : Math.floor(ys);
        const fx = xs - xi;
        const fy = ys - yi;
        const wx = catmullRomWeights(fx);
        const wy = catmullRomWeights(fy);
        // Sample 4×4 neighborhood (xi-1..xi+2, yi-1..yi+2), edge-clamped.
        let ar = 0,
          ag = 0,
          ab = 0,
          aa = 0;
        for (let j = 0; j < 4; j++) {
          let sy = yi - 1 + j;
          if (sy < 0) sy = 0;
          else if (sy > yMaxIn) sy = yMaxIn;
          const wyj = wy[j]!;
          const rowBase = sy * srcW * 4;
          for (let i = 0; i < 4; i++) {
            let sx = xi - 1 + i;
            if (sx < 0) sx = 0;
            else if (sx > xMaxIn) sx = xMaxIn;
            const w = wyj * wx[i]!;
            const p = rowBase + sx * 4;
            ar += src[p]! * w;
            ag += src[p + 1]! * w;
            ab += src[p + 2]! * w;
            aa += src[p + 3]! * w;
          }
        }
        out[di] = ar < 0 ? 0 : ar > 255 ? 255 : Math.round(ar);
        out[di + 1] = ag < 0 ? 0 : ag > 255 ? 255 : Math.round(ag);
        out[di + 2] = ab < 0 ? 0 : ab > 255 ? 255 : Math.round(ab);
        out[di + 3] = aa < 0 ? 0 : aa > 255 ? 255 : Math.round(aa);
      }
      xs += M.a;
      ys += M.c;
      di += 4;
    }
  }
  return { rgba: out, width: dstW, height: dstH };
}
