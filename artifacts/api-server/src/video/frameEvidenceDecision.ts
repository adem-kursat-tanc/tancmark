/**
 * Shared, side-effect-free frame evidence rules.
 *
 * The offline exact reader and Live watermark worker deliberately import this
 * module so the keyed L1 thresholds and fail-closed decision stay single-source.
 */
export const STRONG_R1_THR = 0.30;
export const FRAME_VAULT_MIN_STRONG_ANCHORS = 2;

const FRAME_VAULT_BYTE = 3;
const FRAME_VAULT_STRONG = 2;
const FRAME_WEAK_BYTE = 2;
const FRAME_WEAK_STRONG = 2;

export function buildA5StrongL1ByteMatchMask(input: {
  l1Decoded4: Uint8Array;
  expected4: Uint8Array;
  l1R1Per: readonly number[];
}): boolean[] {
  return [0, 1, 2, 3].map((index) =>
    input.l1R1Per[index] !== undefined &&
    input.l1R1Per[index]! >= STRONG_R1_THR &&
    input.l1Decoded4[index] === input.expected4[index]
  );
}

/**
 * Fail-closed per-frame decision. L3 may support WEAK observation but never
 * supplies a VAULT byte. Strong evidence requires keyed L1 equality at the
 * same anchor where the keyed R1 finder passed its unchanged threshold.
 */
export function decideFrameEvidence(input: {
  l1PayloadMatch: boolean;
  strongL1ByteMatchMask: readonly boolean[];
  combinedByteMatches: number;
  strongAnchors: number;
}): { frameVault: boolean; frameWeak: boolean; strongL1ByteMatches: number } {
  const strongL1ByteMatches = input.strongL1ByteMatchMask.filter(Boolean).length;
  const frameVault =
    (input.l1PayloadMatch &&
      strongL1ByteMatches >= FRAME_VAULT_MIN_STRONG_ANCHORS &&
      input.strongAnchors >= FRAME_VAULT_MIN_STRONG_ANCHORS) ||
    (strongL1ByteMatches >= FRAME_VAULT_BYTE &&
      input.strongAnchors >= FRAME_VAULT_STRONG);
  const frameWeak =
    !frameVault &&
    input.combinedByteMatches >= FRAME_WEAK_BYTE &&
    input.strongAnchors >= FRAME_WEAK_STRONG;
  return { frameVault, frameWeak, strongL1ByteMatches };
}
