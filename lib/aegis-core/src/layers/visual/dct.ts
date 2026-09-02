// 8×8 Type-II DCT (forward + inverse), saf TypeScript / no native deps.
//
// Pikseller [-128..127] aralığına shift edilerek girilir (JPEG geleneği).
// Çıkış float32 katsayıları [-1024..1024] aralığında olabilir.

const COS_TABLE: Float64Array = (() => {
  const t = new Float64Array(64);
  for (let n = 0; n < 8; n++) {
    for (let k = 0; k < 8; k++) {
      t[n * 8 + k] = Math.cos(((2 * n + 1) * k * Math.PI) / 16);
    }
  }
  return t;
})();
const ALPHA = (k: number): number => (k === 0 ? 1 / Math.sqrt(2) : 1);

/**
 * Forward 1D DCT over an 8-element vector.
 */
function dct1d(input: Float64Array, output: Float64Array): void {
  for (let k = 0; k < 8; k++) {
    let sum = 0;
    for (let n = 0; n < 8; n++) sum += input[n]! * COS_TABLE[n * 8 + k]!;
    output[k] = 0.5 * ALPHA(k) * sum;
  }
}
function idct1d(input: Float64Array, output: Float64Array): void {
  for (let n = 0; n < 8; n++) {
    let sum = 0;
    for (let k = 0; k < 8; k++)
      sum += ALPHA(k) * input[k]! * COS_TABLE[n * 8 + k]!;
    output[n] = 0.5 * sum;
  }
}

/**
 * Forward 8×8 DCT. Block: 64 floats already shifted by -128. Returns 64 floats.
 */
export function fdct8(block: Float64Array): Float64Array {
  const tmp = new Float64Array(64);
  const out = new Float64Array(64);
  const row = new Float64Array(8);
  const rowOut = new Float64Array(8);
  // rows
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) row[c] = block[r * 8 + c]!;
    dct1d(row, rowOut);
    for (let c = 0; c < 8; c++) tmp[r * 8 + c] = rowOut[c]!;
  }
  // cols
  const col = new Float64Array(8);
  const colOut = new Float64Array(8);
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) col[r] = tmp[r * 8 + c]!;
    dct1d(col, colOut);
    for (let r = 0; r < 8; r++) out[r * 8 + c] = colOut[r]!;
  }
  return out;
}

/**
 * Inverse 8×8 DCT. Returns 64 floats (still shifted; caller should +128 + clip).
 */
export function idct8(coeff: Float64Array): Float64Array {
  const tmp = new Float64Array(64);
  const out = new Float64Array(64);
  const col = new Float64Array(8);
  const colOut = new Float64Array(8);
  // cols
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) col[r] = coeff[r * 8 + c]!;
    idct1d(col, colOut);
    for (let r = 0; r < 8; r++) tmp[r * 8 + c] = colOut[r]!;
  }
  // rows
  const row = new Float64Array(8);
  const rowOut = new Float64Array(8);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) row[c] = tmp[r * 8 + c]!;
    idct1d(row, rowOut);
    for (let c = 0; c < 8; c++) out[r * 8 + c] = rowOut[c]!;
  }
  return out;
}

/**
 * RGB → Y (BT.601 luma).
 */
export function rgbToLuma(
  rgb: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
): Float64Array {
  const luma = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgb[i * channels]!;
    const g = rgb[i * channels + 1]!;
    const b = rgb[i * channels + 2]!;
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}
