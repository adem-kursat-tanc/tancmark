/**
 * AEGIS Visual ECC recovery layer.
 *
 * External, candidate-only redundancy for the existing 32-bit visual ID. This
 * module does not replace the main ID carrier and does not make VAULT or
 * confirmed decisions. Callers must compare any recovered value with the
 * registered/system ID before treating it as support.
 */

export const VISUAL_ECC_RECOVERY_LAYER_ID =
  "visual-ecc-ring-soft14-margin24-v1" as const;

export const VISUAL_ECC_BITS = 32;
export const VISUAL_ECC_DATA_BYTES = 4;
export const VISUAL_ECC_PARITY_BYTES = 4;
export const VISUAL_ECC_CODE_BYTES =
  VISUAL_ECC_DATA_BYTES + VISUAL_ECC_PARITY_BYTES;
export const VISUAL_ECC_BLOCK_SIZE = 14;
export const VISUAL_ECC_PAIR_MARGIN = 24;
export const VISUAL_ECC_MAX_ADJUST = 26;
export const VISUAL_ECC_MIN_BYTE_CONFIDENCE = 4.5;

export type VisualEccConfidenceBand = "none" | "weak" | "strong";

export interface VisualEccRecoveryEmbedResult {
  embedded: boolean;
  layerId: typeof VISUAL_ECC_RECOVERY_LAYER_ID;
  carrier: "ring_soft14_margin24";
  role: "external_recovery_candidate_only";
  dataBits: number;
  parityBits: number;
  blockSize: number;
  pairMargin: number;
  reason?: "invalid_cloak_id" | "image_too_small";
}

export interface VisualEccReadResult {
  layerId: typeof VISUAL_ECC_RECOVERY_LAYER_ID;
  carrier: "ring_soft14_margin24";
  parityBytes: number[];
  parityBits: number[];
  bitConfidence: number[];
  byteConfidence: number[];
  averageConfidence: number;
}

export interface VisualEccCandidateResult {
  attempted: boolean;
  layerId: typeof VISUAL_ECC_RECOVERY_LAYER_ID;
  carrier: "ring_soft14_margin24";
  role: "candidate_support_only_no_vault";
  candidateCount: number;
  candidateSupport: boolean;
  exactParityMatch: boolean;
  bestCandidateCloakId: string | null;
  recoveredIdHex: string | null;
  recoveredMatchesExpected: boolean;
  parityBitMatches: number;
  parityByteMatches: number;
  confidenceBand: VisualEccConfidenceBand;
  averageConfidence: number;
  reason:
    | "ok"
    | "no_candidates"
    | "invalid_candidates"
    | "no_exact_match";
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
}

export interface VisualEccReadFrame {
  raw: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: 3 | 4;
}

export interface VisualEccPartialRecoveryInput {
  /**
   * Observed main 32-bit ID bytes. Erased byte values may be any value; the
   * erasurePositions list decides which symbols are reconstructed.
   */
  mainIdBytes: Uint8Array;
  /** Observed ECC parity bytes from readVisualEccRecoveryLayer. */
  parityBytes: Uint8Array;
  /** Symbol positions in the 8-byte codeword that are known erasures. */
  erasurePositions: readonly number[];
  /** Registered/system ID. If present, recovered ID must byte-equal it. */
  expectedCloakId?: string;
}

export interface VisualEccPartialRecoveryResult {
  recovered: boolean;
  recoveredIdHex: string | null;
  recoveredMatchesExpected: boolean;
  reason:
    | "ok"
    | "invalid_input"
    | "not_enough_symbols"
    | "too_many_erasures"
    | "no_consistent_codeword"
    | "ambiguous_codeword"
    | "expected_id_mismatch";
  candidates: number;
  corrected: number;
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
}

interface PointBlock {
  x: number;
  y: number;
  block: number;
}

interface EccPair {
  left: PointBlock;
  right: PointBlock;
}

interface RsPoint {
  x: number;
  y: number;
  index: number;
}

const PRIM = 0x11d;
const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
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

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a]! + LOG[b]!) % 255]!;
}

function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error("visual_ecc_gf_div_zero");
  if (a === 0) return 0;
  return EXP[(LOG[a]! - LOG[b]! + 255) % 255]!;
}

function interp(points: readonly RsPoint[], x: number): number {
  let out = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    let num = 1;
    let den = 1;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      num = gfMul(num, x ^ points[j]!.x);
      den = gfMul(den, p.x ^ points[j]!.x);
    }
    out ^= gfMul(p.y, gfDiv(num, den));
  }
  return out;
}

function rs84(data4: readonly number[]): number[] {
  if (data4.length !== VISUAL_ECC_DATA_BYTES) {
    throw new Error("visual_ecc_data_must_be_4_bytes");
  }
  const points = data4.map((y, i) => ({ x: i + 1, y: y & 0xff, index: i }));
  const code: number[] = [];
  for (let x = 1; x <= VISUAL_ECC_CODE_BYTES; x++) {
    code.push(interp(points, x));
  }
  return code;
}

function combos<T>(arr: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const picked: T[] = [];
  const rec = (start: number): void => {
    if (picked.length === k) {
      out.push(picked.slice());
      return;
    }
    for (let i = start; i <= arr.length - (k - picked.length); i++) {
      picked.push(arr[i]!);
      rec(i + 1);
      picked.pop();
    }
  };
  rec(0);
  return out;
}

function clampInt(v: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, v));
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function idx(width: number, channels: 3 | 4, x: number, y: number, c: number): number {
  return (y * width + x) * channels + c;
}

function ringBlocks(width: number, height: number, block: number): PointBlock[] {
  const pairGap = Math.max(3, Math.floor(Math.min(width, height) * 0.006));
  const zonePairCols = 4;
  const zoneRows = 2;
  const strideX = Math.max(block * 2 + pairGap + 4, Math.floor(width * 0.031));
  const strideY = Math.max(block + 8, Math.floor(height * 0.045));
  const pairWidth = block * 2 + pairGap;
  const zoneW = (zonePairCols - 1) * strideX + pairWidth;
  const zoneH = (zoneRows - 1) * strideY + block;
  const centerX = width / 2;
  const centerY = height / 2;
  const zoneOffsetX = Math.max(zoneW * 0.7, width * 0.12);
  const zoneOffsetY = Math.max(zoneH * 0.7, height * 0.1);
  const centers = [
    { x: centerX - zoneOffsetX, y: centerY - zoneOffsetY },
    { x: centerX + zoneOffsetX, y: centerY - zoneOffsetY },
    { x: centerX - zoneOffsetX, y: centerY + zoneOffsetY },
    { x: centerX + zoneOffsetX, y: centerY + zoneOffsetY },
  ];
  const out: PointBlock[] = [];
  for (const zone of centers) {
    const startX = zone.x - zoneW / 2;
    const startY = zone.y - zoneH / 2;
    for (let row = 0; row < zoneRows; row++) {
      for (let pair = 0; pair < zonePairCols; pair++) {
        const lx = startX + pair * strideX;
        const y = startY + row * strideY;
        out.push({
          x: clampInt(Math.round(lx), 0, width - block),
          y: clampInt(Math.round(y), 0, height - block),
          block,
        });
        out.push({
          x: clampInt(Math.round(lx + block + pairGap), 0, width - block),
          y: clampInt(Math.round(y), 0, height - block),
          block,
        });
      }
    }
  }
  return out.slice(0, VISUAL_ECC_BITS * 2);
}

function eccPairs(width: number, height: number): EccPair[] {
  const blocks = ringBlocks(width, height, VISUAL_ECC_BLOCK_SIZE);
  const pairs: EccPair[] = [];
  for (let i = 0; i < VISUAL_ECC_BITS; i++) {
    pairs.push({ left: blocks[i * 2]!, right: blocks[i * 2 + 1]! });
  }
  return pairs;
}

function meanY(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  channels: 3 | 4,
  p: PointBlock,
): number {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < p.block; y++) {
    for (let x = 0; x < p.block; x++) {
      const ix = idx(width, channels, p.x + x, p.y + y, 0);
      sum += 0.299 * raw[ix]! + 0.587 * raw[ix + 1]! + 0.114 * raw[ix + 2]!;
      count++;
    }
  }
  return sum / Math.max(1, count);
}

function delta(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  channels: 3 | 4,
  p: PointBlock,
  amount: number,
): void {
  for (let y = 0; y < p.block; y++) {
    for (let x = 0; x < p.block; x++) {
      const ix = idx(width, channels, p.x + x, p.y + y, 0);
      for (let c = 0; c < 3; c++) {
        raw[ix + c] = clampByte(Math.round(raw[ix + c]! + amount));
      }
    }
  }
}

function setDiff(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  channels: 3 | 4,
  left: PointBlock,
  right: PointBlock,
  target: number,
  maxAdjust: number,
): void {
  const current = meanY(raw, width, channels, left) - meanY(raw, width, channels, right);
  const adjust = Math.max(-maxAdjust, Math.min(maxAdjust, (target - current) / 2));
  delta(raw, width, channels, left, adjust);
  delta(raw, width, channels, right, -adjust);
}

function bytesToBits(bytes: readonly number[]): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) bits.push((byte >>> bit) & 1);
  }
  return bits;
}

function bitsToBytes(bits: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i + b] ?? 0);
    out.push(byte & 0xff);
  }
  return out;
}

function byteConf(conf: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < conf.length; i += 8) {
    out.push(Math.min(...conf.slice(i, i + 8)));
  }
  return out;
}

function readTrace(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  channels: 3 | 4,
  pairs: readonly EccPair[],
): { bits: number[]; conf: number[] } {
  const bits: number[] = [];
  const conf: number[] = [];
  for (const pair of pairs) {
    const diff =
      meanY(raw, width, channels, pair.left) -
      meanY(raw, width, channels, pair.right);
    bits.push(diff > 0 ? 1 : 0);
    conf.push(Math.abs(diff));
  }
  return { bits, conf };
}

function idBytesFromCloakId(cloakId: string): Uint8Array | null {
  const hex = cloakId.trim().toLowerCase();
  if (!/^[0-9a-f]{8,}$/.test(hex)) return null;
  return Uint8Array.from(Buffer.from(hex.slice(0, 8), "hex"));
}

function emptyEmbed(reason: VisualEccRecoveryEmbedResult["reason"]): VisualEccRecoveryEmbedResult {
  return {
    embedded: false,
    layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
    carrier: "ring_soft14_margin24",
    role: "external_recovery_candidate_only",
    dataBits: VISUAL_ECC_BITS,
    parityBits: VISUAL_ECC_BITS,
    blockSize: VISUAL_ECC_BLOCK_SIZE,
    pairMargin: VISUAL_ECC_PAIR_MARGIN,
    reason,
  };
}

export function visualEccIdBytesFromCloakId(cloakId: string): Uint8Array | null {
  return idBytesFromCloakId(cloakId);
}

export function visualEccCodewordFromIdBytes(idBytes: Uint8Array): Uint8Array {
  if (idBytes.length !== VISUAL_ECC_DATA_BYTES) {
    throw new Error("visual_ecc_id_must_be_4_bytes");
  }
  return Uint8Array.from(rs84([...idBytes]));
}

export function visualEccParityBytesFromCloakId(cloakId: string): Uint8Array | null {
  const idBytes = idBytesFromCloakId(cloakId);
  if (idBytes === null) return null;
  return visualEccCodewordFromIdBytes(idBytes).slice(VISUAL_ECC_DATA_BYTES);
}

export function embedVisualEccRecoveryLayer(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: 3 | 4,
  cloakId: string,
): VisualEccRecoveryEmbedResult {
  if (
    width < VISUAL_ECC_BLOCK_SIZE * 5 ||
    height < VISUAL_ECC_BLOCK_SIZE * 5
  ) {
    return emptyEmbed("image_too_small");
  }
  const parity = visualEccParityBytesFromCloakId(cloakId);
  if (parity === null) return emptyEmbed("invalid_cloak_id");
  const parityBits = bytesToBits([...parity]);
  const pairs = eccPairs(width, height);
  for (let i = 0; i < VISUAL_ECC_BITS; i++) {
    setDiff(
      raw,
      width,
      channels,
      pairs[i]!.left,
      pairs[i]!.right,
      parityBits[i] === 1 ? VISUAL_ECC_PAIR_MARGIN : -VISUAL_ECC_PAIR_MARGIN,
      VISUAL_ECC_MAX_ADJUST,
    );
  }
  return {
    embedded: true,
    layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
    carrier: "ring_soft14_margin24",
    role: "external_recovery_candidate_only",
    dataBits: VISUAL_ECC_BITS,
    parityBits: VISUAL_ECC_BITS,
    blockSize: VISUAL_ECC_BLOCK_SIZE,
    pairMargin: VISUAL_ECC_PAIR_MARGIN,
  };
}

export function readVisualEccRecoveryLayer(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: 3 | 4,
): VisualEccReadResult {
  const pairs = eccPairs(width, height);
  const trace = readTrace(raw, width, channels, pairs);
  const parityBytes = bitsToBytes(trace.bits);
  const byteConfidence = byteConf(trace.conf);
  const averageConfidence =
    trace.conf.reduce((sum, v) => sum + v, 0) / Math.max(1, trace.conf.length);
  return {
    layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
    carrier: "ring_soft14_margin24",
    parityBytes,
    parityBits: trace.bits,
    bitConfidence: trace.conf,
    byteConfidence,
    averageConfidence,
  };
}

function matches(a: readonly number[] | Uint8Array, b: readonly number[] | Uint8Array): number {
  let n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] === b[i]) n++;
  return n;
}

function bitMatches(a: readonly number[], b: readonly number[]): number {
  let n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] === b[i]) n++;
  return n;
}

function confidenceBand(bitMatchCount: number, exactParityMatch: boolean): VisualEccConfidenceBand {
  if (exactParityMatch) return "strong";
  if (bitMatchCount >= 24) return "weak";
  return "none";
}

export function verifyVisualEccRecoveryCandidate(
  raw: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: 3 | 4,
  candidateCloakIds: readonly string[],
): VisualEccCandidateResult {
  const validCandidates = candidateCloakIds
    .map((cloakId) => ({ cloakId, idBytes: idBytesFromCloakId(cloakId) }))
    .filter((x): x is { cloakId: string; idBytes: Uint8Array } => x.idBytes !== null);
  if (candidateCloakIds.length === 0) {
    return {
      attempted: false,
      layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
      carrier: "ring_soft14_margin24",
      role: "candidate_support_only_no_vault",
      candidateCount: 0,
      candidateSupport: false,
      exactParityMatch: false,
      bestCandidateCloakId: null,
      recoveredIdHex: null,
      recoveredMatchesExpected: false,
      parityBitMatches: 0,
      parityByteMatches: 0,
      confidenceBand: "none",
      averageConfidence: 0,
      reason: "no_candidates",
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    };
  }
  if (validCandidates.length === 0) {
    return {
      attempted: true,
      layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
      carrier: "ring_soft14_margin24",
      role: "candidate_support_only_no_vault",
      candidateCount: 0,
      candidateSupport: false,
      exactParityMatch: false,
      bestCandidateCloakId: null,
      recoveredIdHex: null,
      recoveredMatchesExpected: false,
      parityBitMatches: 0,
      parityByteMatches: 0,
      confidenceBand: "none",
      averageConfidence: 0,
      reason: "invalid_candidates",
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    };
  }
  const observed = readVisualEccRecoveryLayer(raw, width, height, channels);
  let best = {
    cloakId: null as string | null,
    idHex: null as string | null,
    bitMatches: 0,
    byteMatches: 0,
    exact: false,
  };
  for (const candidate of validCandidates) {
    const codeword = visualEccCodewordFromIdBytes(candidate.idBytes);
    const expectedParity = [...codeword.slice(VISUAL_ECC_DATA_BYTES)];
    const expectedBits = bytesToBits(expectedParity);
    const byteMatchCount = matches(observed.parityBytes, expectedParity);
    const bitMatchCount = bitMatches(observed.parityBits, expectedBits);
    const exact = byteMatchCount === VISUAL_ECC_PARITY_BYTES;
    if (
      bitMatchCount > best.bitMatches ||
      (bitMatchCount === best.bitMatches && byteMatchCount > best.byteMatches)
    ) {
      best = {
        cloakId: candidate.cloakId,
        idHex: Buffer.from(candidate.idBytes).toString("hex"),
        bitMatches: bitMatchCount,
        byteMatches: byteMatchCount,
        exact,
      };
    }
  }
  const exactParityMatch = best.exact;
  return {
    attempted: true,
    layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
    carrier: "ring_soft14_margin24",
    role: "candidate_support_only_no_vault",
    candidateCount: validCandidates.length,
    candidateSupport: exactParityMatch,
    exactParityMatch,
    bestCandidateCloakId: exactParityMatch ? best.cloakId : null,
    recoveredIdHex: exactParityMatch ? best.idHex : null,
    recoveredMatchesExpected: exactParityMatch,
    parityBitMatches: best.bitMatches,
    parityByteMatches: best.byteMatches,
    confidenceBand: confidenceBand(best.bitMatches, exactParityMatch),
    averageConfidence: Number(observed.averageConfidence.toFixed(4)),
    reason: exactParityMatch ? "ok" : "no_exact_match",
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
  };
}

function isBetterCandidateResult(
  next: VisualEccCandidateResult,
  current: VisualEccCandidateResult,
): boolean {
  if (next.exactParityMatch !== current.exactParityMatch) {
    return next.exactParityMatch;
  }
  if (next.parityByteMatches !== current.parityByteMatches) {
    return next.parityByteMatches > current.parityByteMatches;
  }
  if (next.parityBitMatches !== current.parityBitMatches) {
    return next.parityBitMatches > current.parityBitMatches;
  }
  return next.averageConfidence > current.averageConfidence;
}

export function verifyVisualEccRecoveryCandidateFrames(
  frames: readonly VisualEccReadFrame[],
  candidateCloakIds: readonly string[],
): VisualEccCandidateResult {
  if (frames.length === 0) {
    return {
      attempted: candidateCloakIds.length > 0,
      layerId: VISUAL_ECC_RECOVERY_LAYER_ID,
      carrier: "ring_soft14_margin24",
      role: "candidate_support_only_no_vault",
      candidateCount: 0,
      candidateSupport: false,
      exactParityMatch: false,
      bestCandidateCloakId: null,
      recoveredIdHex: null,
      recoveredMatchesExpected: false,
      parityBitMatches: 0,
      parityByteMatches: 0,
      confidenceBand: "none",
      averageConfidence: 0,
      reason: candidateCloakIds.length > 0 ? "no_exact_match" : "no_candidates",
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    };
  }

  let best = verifyVisualEccRecoveryCandidate(
    frames[0]!.raw,
    frames[0]!.width,
    frames[0]!.height,
    frames[0]!.channels,
    candidateCloakIds,
  );
  for (const frame of frames.slice(1)) {
    const next = verifyVisualEccRecoveryCandidate(
      frame.raw,
      frame.width,
      frame.height,
      frame.channels,
      candidateCloakIds,
    );
    if (isBetterCandidateResult(next, best)) best = next;
    if (best.exactParityMatch) break;
  }
  return best;
}

function decodeRs84Exhaustive(
  received: readonly number[],
  erasurePositions: readonly number[],
): {
  recovered: boolean;
  idHex?: string;
  candidates: number;
  corrected: number;
  reason?: VisualEccPartialRecoveryResult["reason"];
} {
  if (received.length !== VISUAL_ECC_CODE_BYTES) {
    return { recovered: false, candidates: 0, corrected: 0, reason: "invalid_input" };
  }
  const erased = new Set(
    erasurePositions.filter((p) => p >= 0 && p < VISUAL_ECC_CODE_BYTES),
  );
  if (erased.size > VISUAL_ECC_PARITY_BYTES) {
    return { recovered: false, candidates: 0, corrected: 0, reason: "too_many_erasures" };
  }
  const known = received
    .map((y, i) => ({ x: i + 1, y: y & 0xff, index: i }))
    .filter((p) => !erased.has(p.index));
  if (known.length < VISUAL_ECC_DATA_BYTES) {
    return { recovered: false, candidates: 0, corrected: 0, reason: "not_enough_symbols" };
  }
  // Product safety rule: recover only caller-marked erasures. High-confidence
  // wrong main-ID symbols are not silently "corrected" by ECC.
  const maxUnknownErrors = 0;
  const valid = new Map<string, { mismatches: number }>();
  for (const subset of combos(known, VISUAL_ECC_DATA_BYTES)) {
    const data = [
      interp(subset, 1),
      interp(subset, 2),
      interp(subset, 3),
      interp(subset, 4),
    ];
    const code = rs84(data);
    let mismatches = 0;
    for (const p of known) if (code[p.index] !== p.y) mismatches++;
    if (mismatches <= maxUnknownErrors) {
      valid.set(Buffer.from(data).toString("hex"), { mismatches });
    }
  }
  if (valid.size !== 1) {
    return {
      recovered: false,
      candidates: valid.size,
      corrected: 0,
      reason: valid.size === 0 ? "no_consistent_codeword" : "ambiguous_codeword",
    };
  }
  const [idHex, item] = [...valid.entries()][0]!;
  return {
    recovered: true,
    idHex,
    candidates: 1,
    corrected: erased.size + item.mismatches,
  };
}

export function recoverVisualEccIdFromPartialMain(
  input: VisualEccPartialRecoveryInput,
): VisualEccPartialRecoveryResult {
  if (
    input.mainIdBytes.length !== VISUAL_ECC_DATA_BYTES ||
    input.parityBytes.length !== VISUAL_ECC_PARITY_BYTES
  ) {
    return {
      recovered: false,
      recoveredIdHex: null,
      recoveredMatchesExpected: false,
      reason: "invalid_input",
      candidates: 0,
      corrected: 0,
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    };
  }
  const received = [...input.mainIdBytes, ...input.parityBytes];
  const rec = decodeRs84Exhaustive(received, input.erasurePositions);
  if (!rec.recovered || !rec.idHex) {
    return {
      recovered: false,
      recoveredIdHex: null,
      recoveredMatchesExpected: false,
      reason: rec.reason ?? "no_consistent_codeword",
      candidates: rec.candidates,
      corrected: rec.corrected,
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    };
  }
  const expected = input.expectedCloakId
    ? idBytesFromCloakId(input.expectedCloakId)
    : null;
  const expectedHex = expected ? Buffer.from(expected).toString("hex") : null;
  const recoveredMatchesExpected =
    expectedHex !== null && rec.idHex === expectedHex;
  if (expectedHex !== null && !recoveredMatchesExpected) {
    return {
      recovered: false,
      recoveredIdHex: rec.idHex,
      recoveredMatchesExpected: false,
      reason: "expected_id_mismatch",
      candidates: rec.candidates,
      corrected: rec.corrected,
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
    };
  }
  return {
    recovered: true,
    recoveredIdHex: rec.idHex,
    recoveredMatchesExpected,
    reason: "ok",
    candidates: rec.candidates,
    corrected: rec.corrected,
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
  };
}
