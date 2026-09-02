// Reed-Solomon over GF(256) (primitive poly 0x11d, alpha=2).
//
// Convention: ALL polynomials low-coefficient-first (p[0] = constant term,
// p[k] = coefficient of x^k). Bytes in `encode/decode` are byte-arrays;
// internally we work in poly form.
//
// API:
//   - encode(data, parityLen) → Uint8Array (data || parity), len = data + parity
//   - decode(codeword, parityLen) → { ok, data, corrected }
//   - decode garantisi: ⌊parityLen/2⌋ byte hata düzeltebilir.

const PRIM = 0x11d;

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIM;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[(LOG[a]! + LOG[b]!) % 255]!;
const gfDiv = (a: number, b: number): number => {
  if (a === 0) return 0;
  if (b === 0) throw new Error("gf_div_zero");
  return EXP[(LOG[a]! + 255 - LOG[b]!) % 255]!;
};
const gfPow = (a: number, n: number): number => {
  if (a === 0) return 0;
  return EXP[(((LOG[a]! * n) % 255) + 255) % 255]!;
};
const gfInv = (a: number): number => EXP[(255 - LOG[a]!) % 255]!;

// Low-coefficient-first poly ops -----------------------------------------------
function polyEval(p: number[], x: number): number {
  // p[0]=constant, evaluate via Horner from highest down
  let y = 0;
  for (let i = p.length - 1; i >= 0; i--) y = gfMul(y, x) ^ p[i]!;
  return y;
}
function polyMul(p: number[], q: number[]): number[] {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++) r[i + j] ^= gfMul(p[i]!, q[j]!);
  return r;
}
function polyAdd(p: number[], q: number[]): number[] {
  const len = Math.max(p.length, q.length);
  const r = new Array(len).fill(0);
  for (let i = 0; i < p.length; i++) r[i] = p[i]!;
  for (let i = 0; i < q.length; i++) r[i] ^= q[i]!;
  return r;
}
// Polynomial mod x^k — keep low-degree terms only.
function polyModXk(p: number[], k: number): number[] {
  return p.slice(0, k);
}
// Formal derivative.
function polyDeriv(p: number[]): number[] {
  if (p.length <= 1) return [0];
  const r = new Array(p.length - 1).fill(0);
  for (let i = 1; i < p.length; i++) {
    // d/dx (a_i x^i) = i * a_i x^(i-1). In char-2 GF, only odd i contribute.
    r[i - 1] = i % 2 === 1 ? p[i]! : 0;
  }
  return r;
}

// Generator g(x) = ∏_{i=0..nsym-1} (x - α^i) = ∏ (x + α^i) in GF(2^k)
const GEN_CACHE = new Map<number, number[]>();
function generator(parityLen: number): number[] {
  const cached = GEN_CACHE.get(parityLen);
  if (cached) return cached;
  let g: number[] = [1]; // constant 1
  for (let i = 0; i < parityLen; i++) {
    // (x + α^i) in low-first = [α^i, 1]
    g = polyMul(g, [gfPow(2, i), 1]);
  }
  GEN_CACHE.set(parityLen, g);
  return g;
}

// Encode: codeword(x) = m(x) * x^nsym - (m(x)*x^nsym mod g(x))
// In low-first form, m(x)*x^nsym means SHIFT msg up by nsym positions:
// data byte[k] becomes coefficient of x^(nsym + k).
//
// Output array layout (byte order): [data[0], data[1], ..., data[k-1],
//                                    parity[0], parity[1], ..., parity[nsym-1]]
// where data[k] is coefficient of x^(nsym + k) and parity[j] is coefficient
// of x^j. So when reading back as poly, build from output:
//   poly[j] for j<nsym = parity[j]; poly[nsym+k] = data[k].
export function encode(data: Uint8Array, parityLen: number): Uint8Array {
  if (parityLen <= 0 || parityLen > 254)
    throw new Error("parityLen out of range (1..254)");
  const gen = generator(parityLen);
  // m_shifted poly low-first: [0]*nsym then data ascending
  const N = data.length + parityLen;
  const buf: number[] = new Array(N).fill(0);
  for (let k = 0; k < data.length; k++) buf[parityLen + k] = data[k]!;
  // Synthetic division: divide buf by gen, remainder lives in low coefficients
  for (let i = N - 1; i >= parityLen; i--) {
    const coef = buf[i]!;
    if (coef !== 0) {
      // gen[gen.length-1] = 1 (monic), subtract gen * coef from positions
      // i, i-1, ..., i-(gen.length-1).
      for (let j = 0; j < gen.length; j++) {
        buf[i - (gen.length - 1) + j] ^= gfMul(gen[j]!, coef);
      }
    }
  }
  // buf low coefficients [0..parityLen-1] = parity remainder
  // For final codeword: combine parity (low) + data (high)
  const out = new Uint8Array(N);
  for (let j = 0; j < parityLen; j++) out[j] = buf[j]!;
  for (let k = 0; k < data.length; k++) out[parityLen + k] = data[k]!;
  return out;
}

// Decode helpers ------------------------------------------------------------
function bufToPoly(buf: Uint8Array, parityLen: number): number[] {
  // Same layout as encode output. Result: poly low-first.
  const dataLen = buf.length - parityLen;
  const poly = new Array<number>(buf.length).fill(0);
  for (let j = 0; j < parityLen; j++) poly[j] = buf[j]!;
  for (let k = 0; k < dataLen; k++) poly[parityLen + k] = buf[parityLen + k]!;
  return poly;
}

function calcSyndromes(poly: number[], nsym: number): number[] {
  // S_j = poly(α^j) for j=0..nsym-1
  const synd = new Array<number>(nsym);
  for (let j = 0; j < nsym; j++) synd[j] = polyEval(poly, gfPow(2, j));
  return synd;
}

function findErrorLocator(synd: number[]): number[] | null {
  // Berlekamp-Massey, low-first poly convention.
  // Λ(x), B(x) with Λ[0]=1.
  let L = 0;
  let lambda: number[] = [1];
  let B: number[] = [1];
  let m = 1;
  let b = 1;
  for (let n = 0; n < synd.length; n++) {
    let delta = synd[n]!;
    for (let i = 1; i <= L; i++) {
      delta ^= gfMul(lambda[i]!, synd[n - i]!);
    }
    if (delta === 0) {
      m += 1;
    } else if (2 * L <= n) {
      const T = lambda.slice();
      // lambda <- lambda - (delta/b) * x^m * B
      const factor = gfDiv(delta, b);
      const shifted = new Array(B.length + m).fill(0);
      for (let i = 0; i < B.length; i++) shifted[i + m] = gfMul(B[i]!, factor);
      lambda = polyAdd(lambda, shifted);
      L = n + 1 - L;
      B = T;
      b = delta;
      m = 1;
    } else {
      const factor = gfDiv(delta, b);
      const shifted = new Array(B.length + m).fill(0);
      for (let i = 0; i < B.length; i++) shifted[i + m] = gfMul(B[i]!, factor);
      lambda = polyAdd(lambda, shifted);
      m += 1;
    }
  }
  // Trim trailing zeros (high)
  while (lambda.length > 1 && lambda[lambda.length - 1] === 0) lambda.pop();
  if (L > Math.floor(synd.length / 2)) return null;
  return lambda;
}

function findErrorPositions(lambda: number[], n: number): number[] | null {
  // Λ has roots at α^(-i) where i is the power-position (degree in poly).
  // Test x = α^(-i) for i=0..n-1.
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = EXP[(255 - i) % 255]!;
    if (polyEval(lambda, x) === 0) positions.push(i);
  }
  if (positions.length !== lambda.length - 1) return null;
  return positions;
}

export function decode(
  codeword: Uint8Array,
  parityLen: number,
): { ok: boolean; data: Uint8Array; corrected: number } {
  const dataLen = codeword.length - parityLen;
  const poly = bufToPoly(codeword, parityLen);
  const synd = calcSyndromes(poly, parityLen);
  if (synd.every((s) => s === 0)) {
    const data = new Uint8Array(dataLen);
    for (let k = 0; k < dataLen; k++) data[k] = poly[parityLen + k]!;
    return { ok: true, data, corrected: 0 };
  }
  const lambda = findErrorLocator(synd);
  if (!lambda) {
    return zeroCorrectedFail(poly, parityLen, dataLen);
  }
  const positions = findErrorPositions(lambda, codeword.length);
  if (!positions || positions.length === 0) {
    return zeroCorrectedFail(poly, parityLen, dataLen);
  }
  // Error evaluator Ω(x) = (S(x) * Λ(x)) mod x^nsym
  const sPoly = synd; // already low-first
  const omega = polyModXk(polyMul(sPoly, lambda), parityLen);
  const lambdaPrime = polyDeriv(lambda);
  // Forney: e_i = X_i * Ω(X_i^-1) / Λ'(X_i^-1), where X_i = α^(positions[i])
  const corrected = poly.slice();
  for (const pos of positions) {
    const Xi = gfPow(2, pos);
    const XiInv = gfInv(Xi);
    const num = gfMul(Xi, polyEval(omega, XiInv));
    const den = polyEval(lambdaPrime, XiInv);
    if (den === 0) return zeroCorrectedFail(poly, parityLen, dataLen);
    const mag = gfDiv(num, den);
    corrected[pos] = corrected[pos]! ^ mag;
  }
  // Re-syndrome check
  const synd2 = calcSyndromes(corrected, parityLen);
  if (!synd2.every((s) => s === 0)) {
    const data = new Uint8Array(dataLen);
    for (let k = 0; k < dataLen; k++) data[k] = corrected[parityLen + k]!;
    return { ok: false, data, corrected: positions.length };
  }
  const data = new Uint8Array(dataLen);
  for (let k = 0; k < dataLen; k++) data[k] = corrected[parityLen + k]!;
  return { ok: true, data, corrected: positions.length };
}

function zeroCorrectedFail(
  poly: number[],
  parityLen: number,
  dataLen: number,
): { ok: false; data: Uint8Array; corrected: number } {
  const data = new Uint8Array(dataLen);
  for (let k = 0; k < dataLen; k++) data[k] = poly[parityLen + k]!;
  return { ok: false, data, corrected: 0 };
}

// ── Faz 5 Step 5.7-B — Erasure-aware RS decoder ───────────────────────
//
// Standard Wicker/Bhargava formulation:
//
//   1. Erasure locator Γ(x) = ∏_{i=0..e-1} (1 + α^{p_i}·x)   (low-first)
//   2. Modified syndromes T(x) = (S(x)·Γ(x)) mod x^r
//   3. Run BM on (T_e, T_{e+1}, …, T_{r-1}) → error locator σ(x)
//   4. Combined locator τ(x) = σ(x) · Γ(x)
//   5. Find ALL roots of τ → positions
//   6. Ω(x) = (S(x)·τ(x)) mod x^r,  e_i = X_i·Ω(X_i⁻¹)/τ'(X_i⁻¹)
//   7. Apply magnitudes; verify re-syndrome ≡ 0.
//
// Capacity: 2·errors + erasures ≤ parityLen. Pure-erasures path tolerates
// up to `parityLen` erasures with zero unknown errors. Caller responsible
// for ensuring erasurePositions ⊂ [0, n) and unique.
//
// KIRMIZI ÇİZGİ #3 (Match Field Decisive): erasure positions are derived
// from PIXEL-DERIVED extraction confidence (low-conf bits flagged) and
// optionally from a reliability prior that DISAGREES with the extracted
// value. The decoder reconstructs values purely from RS parity (also
// pixel-derived). The vault digest is NEVER injected as a bit value;
// the caller MUST byte-equal the decoded result against its expected
// digest as a separate match check.
export function decodeWithErasures(
  codeword: Uint8Array,
  parityLen: number,
  erasurePositions: readonly number[],
): {
  ok: boolean;
  data: Uint8Array;
  corrected: number;
  erasuresApplied: number;
} {
  const n = codeword.length;
  const dataLen = n - parityLen;
  const poly = bufToPoly(codeword, parityLen);
  // Dedupe + bounds-check erasures; cap at parityLen.
  const seen = new Set<number>();
  const erasures: number[] = [];
  for (const p of erasurePositions) {
    if (p < 0 || p >= n || seen.has(p)) continue;
    seen.add(p);
    erasures.push(p);
    if (erasures.length === parityLen) break;
  }
  const e = erasures.length;
  if (e === 0) {
    const r = decode(codeword, parityLen);
    return { ...r, erasuresApplied: 0 };
  }
  const synd = calcSyndromes(poly, parityLen);
  if (synd.every((s) => s === 0)) {
    const data = new Uint8Array(dataLen);
    for (let k = 0; k < dataLen; k++) data[k] = poly[parityLen + k]!;
    return { ok: true, data, corrected: 0, erasuresApplied: 0 };
  }
  // Step 1: erasure locator Γ(x) = ∏ (1 + α^{p_i}·x)
  let gamma: number[] = [1];
  for (const pos of erasures) {
    const Xi = gfPow(2, pos);
    gamma = polyMul(gamma, [1, Xi]);
  }
  // Step 2: modified syndromes T(x) = S(x)·Γ(x) mod x^r
  const T = polyModXk(polyMul(synd, gamma), parityLen);
  // Step 3: BM on T_e..T_{r-1}; if r==e (full erasures), skip BM, σ=1.
  let sigma: number[];
  if (e >= parityLen) {
    sigma = [1];
  } else {
    const tForBm = T.slice(e);
    const sigmaCand = findErrorLocator(tForBm);
    if (!sigmaCand) {
      const data = new Uint8Array(dataLen);
      for (let k = 0; k < dataLen; k++) data[k] = poly[parityLen + k]!;
      return { ok: false, data, corrected: 0, erasuresApplied: e };
    }
    sigma = sigmaCand;
  }
  // Step 4: combined locator τ(x) = σ(x) · Γ(x)
  const tau = polyMul(sigma, gamma);
  // Step 5: find ALL roots of τ
  const positions = findErrorPositions(tau, n);
  if (!positions || positions.length === 0) {
    const data = new Uint8Array(dataLen);
    for (let k = 0; k < dataLen; k++) data[k] = poly[parityLen + k]!;
    return { ok: false, data, corrected: 0, erasuresApplied: e };
  }
  // Step 6: Forney magnitudes
  const omega = polyModXk(polyMul(synd, tau), parityLen);
  const tauPrime = polyDeriv(tau);
  const corrected = poly.slice();
  for (const pos of positions) {
    const Xi = gfPow(2, pos);
    const XiInv = gfInv(Xi);
    const num = gfMul(Xi, polyEval(omega, XiInv));
    const den = polyEval(tauPrime, XiInv);
    if (den === 0) {
      const data = new Uint8Array(dataLen);
      for (let k = 0; k < dataLen; k++) data[k] = poly[parityLen + k]!;
      return { ok: false, data, corrected: 0, erasuresApplied: e };
    }
    const mag = gfDiv(num, den);
    corrected[pos] = corrected[pos]! ^ mag;
  }
  // Step 7: verify
  const synd2 = calcSyndromes(corrected, parityLen);
  const ok = synd2.every((s) => s === 0);
  const data = new Uint8Array(dataLen);
  for (let k = 0; k < dataLen; k++) data[k] = corrected[parityLen + k]!;
  return { ok, data, corrected: positions.length, erasuresApplied: e };
}
