/**
 * Faz 5 Step 5.3 T3 — Affine fit + warp (sharp-free, saf TypeScript).
 *
 * Konvansiyon: AffineMatrix `M = [a b tx; c d ty]` ve transform tanımı
 *   [xd, yd, 1]ᵀ = M · [xs, ys, 1]ᵀ
 *   ⇒ xd = a·xs + b·ys + tx
 *      yd = c·xs + d·ys + ty
 *
 *   xd, yd: dst (target/known) coordinates.
 *   xs, ys: src coordinates.
 *
 * `warpRgba(src, M)`: M `dst → src` map olarak yorumlanır (inverse mapping).
 *   Her dst pixel (xd, yd) için src coord = (a·xd + b·yd + tx, …). Bilinear
 *   sample. Out-of-bounds → fill color (default transparent). Bu klasik image
 *   warp konvansiyonudur — ESTIMATION sonucu olan `forward dst→src` matrisini
 *   doğrudan warpRgba'ya geçirebilirsin.
 *
 * Hız: warp O(W·H·4); 1024×1024 RGBA için ~30ms (Node 20). Affine fit O(N)
 *   point pair, 3×3 lineer sistem (Gaussian eliminasyon, partial pivoting).
 *   N≥3 zorunlu; over-determined (N≥4) least-squares — RANSAC YOK
 *   (marker hit'leri zaten HMAC-doğrulanmış pozisyonlar).
 *
 * 6-DoF affine yeterli mi? Step 5.3 hedefi rotate + translate + uniform scale
 *   + mild shear envelope — hepsi 6-DoF içinde. 8-DoF homography (perspective)
 *   Step 5.4'te.
 */

export interface Point2 {
  x: number;
  y: number;
}

export interface AffineMatrix {
  a: number;
  b: number;
  tx: number;
  c: number;
  d: number;
  ty: number;
}

export interface AffineFitResult {
  matrix: AffineMatrix;
  /** Mean squared distance between predicted dst and observed dst (pixels). */
  rmsResidualPx: number;
  /** Maximum single-point residual (pixels). */
  maxResidualPx: number;
  /** Number of point pairs used. */
  n: number;
}

export const IDENTITY_AFFINE: Readonly<AffineMatrix> = Object.freeze({
  a: 1,
  b: 0,
  tx: 0,
  c: 0,
  d: 1,
  ty: 0,
});

/**
 * Solve a 3×3 linear system A·x = b in place. Gaussian elimination with
 * partial pivoting. Throws on singular system.
 */
function solve3x3(A: number[][], b: number[]): [number, number, number] {
  // Build augmented matrix
  const M: number[][] = [
    [A[0]![0]!, A[0]![1]!, A[0]![2]!, b[0]!],
    [A[1]![0]!, A[1]![1]!, A[1]![2]!, b[1]!],
    [A[2]![0]!, A[2]![1]!, A[2]![2]!, b[2]!],
  ];
  for (let col = 0; col < 3; col++) {
    // Partial pivot
    let pivot = col;
    let maxAbs = Math.abs(M[col]![col]!);
    for (let r = col + 1; r < 3; r++) {
      const v = Math.abs(M[r]![col]!);
      if (v > maxAbs) {
        maxAbs = v;
        pivot = r;
      }
    }
    if (pivot !== col) {
      const tmp = M[col]!;
      M[col] = M[pivot]!;
      M[pivot] = tmp;
    }
    const piv = M[col]![col]!;
    if (Math.abs(piv) < 1e-12) {
      throw new Error("affineFit: singular system (collinear point set?)");
    }
    for (let r = col + 1; r < 3; r++) {
      const factor = M[r]![col]! / piv;
      for (let c = col; c < 4; c++) {
        M[r]![c] = M[r]![c]! - factor * M[col]![c]!;
      }
    }
  }
  // Back substitute
  const x: [number, number, number] = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let s = M[r]![3]!;
    for (let c = r + 1; c < 3; c++) s -= M[r]![c]! * x[c]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

/**
 * Least-squares fit of a 6-DoF affine transform from N≥3 (src, dst) point
 * pairs. Source-and-target convention is "dst = M·src" — fitAffine returns
 * the FORWARD map src→dst.
 *
 * Math: normal equations decouple into two independent 3×3 systems
 *   x-channel: [a b tx]ᵀ from sum xs·xd, ys·xd, xd
 *   y-channel: [c d ty]ᵀ from sum xs·yd, ys·yd, yd
 * Both share the same Gram matrix [[Σxs², Σxs·ys, Σxs], …]. We compute it
 * once and solve twice.
 */
export function fitAffine(src: ReadonlyArray<Point2>, dst: ReadonlyArray<Point2>): AffineFitResult {
  if (src.length !== dst.length) {
    throw new Error(`affineFit: src(${src.length}) and dst(${dst.length}) length mismatch`);
  }
  const n = src.length;
  if (n < 3) throw new Error(`affineFit: need ≥3 pairs (got ${n})`);

  let sxx = 0;
  let sxy = 0;
  let sx = 0;
  let syy = 0;
  let sy = 0;
  // Σ1 = n
  let xdSx = 0;
  let xdSy = 0;
  let xdS = 0;
  let ydSx = 0;
  let ydSy = 0;
  let ydS = 0;
  for (let i = 0; i < n; i++) {
    const xs = src[i]!.x;
    const ys = src[i]!.y;
    const xd = dst[i]!.x;
    const yd = dst[i]!.y;
    sxx += xs * xs;
    sxy += xs * ys;
    sx += xs;
    syy += ys * ys;
    sy += ys;
    xdSx += xd * xs;
    xdSy += xd * ys;
    xdS += xd;
    ydSx += yd * xs;
    ydSy += yd * ys;
    ydS += yd;
  }
  const gram: number[][] = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const [a, b, tx] = solve3x3(gram, [xdSx, xdSy, xdS]);
  const [c, d, ty] = solve3x3(gram, [ydSx, ydSy, ydS]);
  const matrix: AffineMatrix = { a, b, tx, c, d, ty };

  // Residuals
  let sqSum = 0;
  let maxR = 0;
  for (let i = 0; i < n; i++) {
    const p = applyAffine(matrix, src[i]!);
    const dx = p.x - dst[i]!.x;
    const dy = p.y - dst[i]!.y;
    const r = Math.hypot(dx, dy);
    sqSum += dx * dx + dy * dy;
    if (r > maxR) maxR = r;
  }
  const rms = Math.sqrt(sqSum / n);
  return { matrix, rmsResidualPx: rms, maxResidualPx: maxR, n };
}

/** Apply affine forward: returns M·src. */
export function applyAffine(m: AffineMatrix, p: Point2): Point2 {
  return {
    x: m.a * p.x + m.b * p.y + m.tx,
    y: m.c * p.x + m.d * p.y + m.ty,
  };
}

/** Compose two affines: result(p) = m1(m2(p)) — i.e., apply m2 first, then m1. */
export function composeAffine(m1: AffineMatrix, m2: AffineMatrix): AffineMatrix {
  return {
    a: m1.a * m2.a + m1.b * m2.c,
    b: m1.a * m2.b + m1.b * m2.d,
    tx: m1.a * m2.tx + m1.b * m2.ty + m1.tx,
    c: m1.c * m2.a + m1.d * m2.c,
    d: m1.c * m2.b + m1.d * m2.d,
    ty: m1.c * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

/** Invert an affine. Throws on singular (det≈0). */
export function invertAffine(m: AffineMatrix): AffineMatrix {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) {
    throw new Error("invertAffine: singular matrix (det≈0)");
  }
  const ia = m.d / det;
  const ib = -m.b / det;
  const ic = -m.c / det;
  const id = m.a / det;
  return {
    a: ia,
    b: ib,
    tx: -(ia * m.tx + ib * m.ty),
    c: ic,
    d: id,
    ty: -(ic * m.tx + id * m.ty),
  };
}

/** Build a rotation-around-(cx,cy) matrix. Angle in radians, CCW positive. */
export function rotationAffine(angleRad: number, cx: number = 0, cy: number = 0): AffineMatrix {
  const cs = Math.cos(angleRad);
  const sn = Math.sin(angleRad);
  // Rotate around (cx, cy): T(cx,cy) · R(θ) · T(-cx,-cy)
  return {
    a: cs,
    b: -sn,
    tx: cx - cs * cx + sn * cy,
    c: sn,
    d: cs,
    ty: cy - sn * cx - cs * cy,
  };
}

/** Pure translation matrix. */
export function translationAffine(dx: number, dy: number): AffineMatrix {
  return { a: 1, b: 0, tx: dx, c: 0, d: 1, ty: dy };
}

// ──────────────────────────────────────────────────────────────────────
// Faz 5 Step 5.3 T6 — Architect's "T4 3 Kanun":
//
//   1) Hartley normalization at the fitAffine call site (numerical
//      conditioning when point coordinates are large, e.g. 1280×720).
//   2) Wrapper conventions: simulateForwardWarp / recoverAttackedImage —
//      semantic helpers that prevent off-by-one inversion bugs at call sites.
//   3) Coverage ratio gate — caller checks what fraction of expected anchors
//      end up in-bounds after the estimated affine; <0.95 → reject as
//      "geometric correction unreliable".
// ──────────────────────────────────────────────────────────────────────

/**
 * Build a similarity matrix that maps `pts` to a centroid-zero set with
 * mean distance √2 from origin. Returns `{normalized, T, Tinv}` where:
 *   - normalized[i] = T · pts[i]
 *   - T = [[s,0,-s·cx],[0,s,-s·cy]]   (forward, applied as affine)
 *   - Tinv = inverse of T (so original = Tinv · normalized)
 *
 * If the input degenerates (all points equal), returns identity.
 */
export function hartleyNormalize2D(
  pts: ReadonlyArray<Point2>,
): { normalized: Point2[]; T: AffineMatrix; Tinv: AffineMatrix } {
  const n = pts.length;
  if (n === 0) {
    return { normalized: [], T: { ...IDENTITY_AFFINE }, Tinv: { ...IDENTITY_AFFINE } };
  }
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  let meanDist = 0;
  for (const p of pts) {
    meanDist += Math.hypot(p.x - cx, p.y - cy);
  }
  meanDist /= n;
  const s = meanDist > 1e-9 ? Math.SQRT2 / meanDist : 1;
  const T: AffineMatrix = { a: s, b: 0, tx: -s * cx, c: 0, d: s, ty: -s * cy };
  const Tinv: AffineMatrix = { a: 1 / s, b: 0, tx: cx, c: 0, d: 1 / s, ty: cy };
  const normalized = pts.map((p) => ({ x: s * (p.x - cx), y: s * (p.y - cy) }));
  return { normalized, T, Tinv };
}

/**
 * Hartley-normalized affine fit. Returns the same {matrix, residuals} shape
 * as `fitAffine` but in original (un-normalized) coordinates. Use this at
 * the route layer when point coordinates are large (>>1) — the normal
 * equations otherwise become ill-conditioned (Σx² dominates Σx, Σ1).
 *
 *   matrix_orig = Tinv_dst · matrix_norm · T_src
 */
export function fitAffineNormalized(
  src: ReadonlyArray<Point2>,
  dst: ReadonlyArray<Point2>,
): AffineFitResult {
  if (src.length !== dst.length) {
    throw new Error(
      `fitAffineNormalized: src(${src.length}) and dst(${dst.length}) length mismatch`,
    );
  }
  const sN = hartleyNormalize2D(src);
  const dN = hartleyNormalize2D(dst);
  const fitN = fitAffine(sN.normalized, dN.normalized);
  // matrix_orig = Tinv_dst ∘ matrix_norm ∘ T_src
  const intermediate = composeAffine(fitN.matrix, sN.T);
  const matrix = composeAffine(dN.Tinv, intermediate);
  // Recompute residuals in original coords
  let sqSum = 0;
  let maxR = 0;
  for (let i = 0; i < src.length; i++) {
    const p = applyAffine(matrix, src[i]!);
    const dx = p.x - dst[i]!.x;
    const dy = p.y - dst[i]!.y;
    const r = Math.hypot(dx, dy);
    sqSum += dx * dx + dy * dy;
    if (r > maxR) maxR = r;
  }
  return {
    matrix,
    rmsResidualPx: Math.sqrt(sqSum / src.length),
    maxResidualPx: maxR,
    n: src.length,
  };
}

/**
 * Coverage ratio gate. Given a list of EXPECTED anchor positions (in template
 * coordinates) and an estimated forward map `M_src_to_dst` (template → attacked
 * image), returns the fraction of points whose mapped position lies inside the
 * attacked image bounds [0, attackedW] × [0, attackedH].
 *
 * Use case: marker detection on a heavily-cropped image may still produce 3-4
 * coincidental matches → the affine fit succeeds but pushes the vault rect off
 * canvas. coverage <0.95 ⇒ reject → INSUFFICIENT/OCCLUDED verdict.
 */
export function computeCoverageRatio(
  expectedSrcPoints: ReadonlyArray<Point2>,
  M_src_to_dst: AffineMatrix,
  attackedW: number,
  attackedH: number,
): number {
  if (expectedSrcPoints.length === 0) return 0;
  let inside = 0;
  for (const p of expectedSrcPoints) {
    const q = applyAffine(M_src_to_dst, p);
    if (q.x >= 0 && q.x < attackedW && q.y >= 0 && q.y < attackedH) inside++;
  }
  return inside / expectedSrcPoints.length;
}

/**
 * Semantic wrapper — synthesize an attack: forward-warp `src` by `M_src_to_dst`.
 * Internally calls `warpRgba(src, invertAffine(M))` to honor the dst→src
 * inverse-mapping convention. Use ONLY for synthetic test setups.
 */
export function simulateForwardWarp(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  M_src_to_dst: AffineMatrix,
  options?: WarpOptions,
): { rgba: Uint8Array; width: number; height: number } {
  return warpRgba(src, srcW, srcH, invertAffine(M_src_to_dst), options);
}

/**
 * Semantic wrapper — recover an attacked image given the estimated map
 * (template → observed). Equivalent to `simulateForwardWarp(attacked,
 * M_template_to_observed)`'s inverse: warpRgba treats the matrix as dst→src
 * directly. Provided as a named call site so route code reads naturally:
 *
 *   const recovered = recoverAttackedImage(attackedRgba, w, h, M);
 *   // recovered[expected] = attacked[observed]
 */
export function recoverAttackedImage(
  attacked: Uint8Array,
  attackedW: number,
  attackedH: number,
  M_template_to_observed: AffineMatrix,
  options?: WarpOptions,
): { rgba: Uint8Array; width: number; height: number } {
  return warpRgba(attacked, attackedW, attackedH, M_template_to_observed, options);
}

// ──────────────────────────────────────────────────────────────────────
// warpRgba — inverse-mapping bilinear warp.
// ──────────────────────────────────────────────────────────────────────

export interface WarpOptions {
  /** Output canvas size. Default = src size. */
  dstWidth?: number;
  dstHeight?: number;
  /** Out-of-bounds fill RGBA. Default = transparent black. */
  fill?: [number, number, number, number];
}

/**
 * Inverse-mapping bilinear warp.
 *
 * `M` is interpreted as the dst→src map (classical inverse warp). For each
 * dst pixel (xd, yd), the source coord is
 *   (xs, ys) = (a·xd + b·yd + tx, c·xd + d·yd + ty).
 *
 * Out-of-bounds dst pixels get the `fill` color.
 *
 * To produce a rotated version of an image (forward simulation), pass
 * `invertAffine(R)` where R is the forward rotation. To recover from a
 * detected attack matrix `R̂` (estimated by fitAffine on detected markers),
 * pass `R̂` directly.
 */
export function warpRgba(
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
    // Hot inner: cache row's affine constants
    const baseX = M.b * yd + M.tx;
    const baseY = M.d * yd + M.ty;
    let xs = baseX;
    let ys = baseY;
    let di = yd * dstW * 4;
    for (let xd = 0; xd < dstW; xd++) {
      if (xs < 0 || ys < 0 || xs > xMaxIn || ys > yMaxIn) {
        out[di] = fr;
        out[di + 1] = fg;
        out[di + 2] = fb;
        out[di + 3] = fa;
      } else {
        // Clamp x1/y1 to last in-bounds index so xs == srcW-1 exactly still
        // samples (with weight on i00 only). Keeps identity warp lossless.
        const x0 = xs >= xMaxIn ? xMaxIn : xs | 0;
        const y0 = ys >= yMaxIn ? yMaxIn : ys | 0;
        const x1 = x0 < xMaxIn ? x0 + 1 : x0;
        const y1 = y0 < yMaxIn ? y0 + 1 : y0;
        const fx = xs - x0;
        const fy = ys - y0;
        const i00 = (y0 * srcW + x0) * 4;
        const i01 = (y0 * srcW + x1) * 4;
        const i10 = (y1 * srcW + x0) * 4;
        const i11 = (y1 * srcW + x1) * 4;
        const w00 = (1 - fx) * (1 - fy);
        const w01 = fx * (1 - fy);
        const w10 = (1 - fx) * fy;
        const w11 = fx * fy;
        for (let c = 0; c < 4; c++) {
          const v =
            src[i00 + c]! * w00 +
            src[i01 + c]! * w01 +
            src[i10 + c]! * w10 +
            src[i11 + c]! * w11;
          out[di + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        }
      }
      xs += M.a;
      ys += M.c;
      di += 4;
    }
  }
  return { rgba: out, width: dstW, height: dstH };
}
