import { LiveProductError, LiveProductStore } from "./liveProductStore";

export const LIVE_ROLLING_SEAL_MAP_SCHEMA = "tancmark-live-rolling-seal-map-v1" as const;

export interface LiveRollingSealReceiptV1 {
  schemaVersion: "tancmark-live-rolling-seal-receipt-v1";
  bindingId: string;
  sessionId: string;
  sequence: number;
  decodedFrameOffset: number;
  decodedFrameCount: number;
  channelAFrameIdxs: number[];
  channelBFrameIdxs: number[];
  framePts: Array<{ ordinal: number; pts: string; timeBase: string }>;
  watermarkAlgorithmVersion: string;
  sourceFragmentDigestSha256: string;
  outputFragmentDigestSha256: string;
  previousReceiptDigestSha256: string;
  createdAt: string;
  receiptDigestSha256: string;
}

export interface LiveRollingSealMapV1 {
  schemaVersion: typeof LIVE_ROLLING_SEAL_MAP_SCHEMA;
  bindingId: string;
  sessionId: string;
  genesisDigestSha256: string;
  receipts: LiveRollingSealReceiptV1[];
  chainHeadSha256: string;
  finalizedAt: string | null;
  finalReceiptDigestSha256: string | null;
}

type UnsignedReceipt = Omit<LiveRollingSealReceiptV1, "receiptDigestSha256">;

function receiptDigest(receipt: UnsignedReceipt): string {
  return LiveProductStore.stableDigest(receipt);
}

export function createLiveRollingSealMap(bindingId: string, sessionId: string): LiveRollingSealMapV1 {
  const genesisDigestSha256 = LiveProductStore.sha256(`tancmark-live-rolling-seal-map-v1\0${bindingId}\0${sessionId}`);
  return {
    schemaVersion: LIVE_ROLLING_SEAL_MAP_SCHEMA,
    bindingId,
    sessionId,
    genesisDigestSha256,
    receipts: [],
    chainHeadSha256: genesisDigestSha256,
    finalizedAt: null,
    finalReceiptDigestSha256: null,
  };
}

export function validateLiveRollingSealMap(map: LiveRollingSealMapV1): void {
  if (map.schemaVersion !== LIVE_ROLLING_SEAL_MAP_SCHEMA || map.receipts.length > 1_000_000) {
    throw new LiveProductError("live_rolling_seal_map_invalid", 409);
  }
  let chain = map.genesisDigestSha256;
  let sequence = 0;
  for (const receipt of map.receipts) {
    const { receiptDigestSha256, ...unsigned } = receipt;
    if (
      receipt.schemaVersion !== "tancmark-live-rolling-seal-receipt-v1" ||
      receipt.bindingId !== map.bindingId ||
      receipt.sessionId !== map.sessionId ||
      receipt.sequence !== sequence ||
      receipt.previousReceiptDigestSha256 !== chain ||
      receiptDigest(unsigned) !== receiptDigestSha256
    ) throw new LiveProductError("live_rolling_seal_map_invalid", 409);
    chain = receiptDigestSha256;
    sequence += 1;
  }
  if (map.chainHeadSha256 !== chain) throw new LiveProductError("live_rolling_seal_map_invalid", 409);
  const expectedFinal = map.finalizedAt === null
    ? null
    : LiveProductStore.stableDigest({ schemaVersion: map.schemaVersion, bindingId: map.bindingId, sessionId: map.sessionId, chainHeadSha256: map.chainHeadSha256, receiptCount: map.receipts.length, finalizedAt: map.finalizedAt });
  if (map.finalReceiptDigestSha256 !== expectedFinal) throw new LiveProductError("live_rolling_seal_map_invalid", 409);
}

export function appendLiveRollingSealReceipt(
  map: LiveRollingSealMapV1,
  input: Omit<UnsignedReceipt, "schemaVersion" | "previousReceiptDigestSha256">,
): LiveRollingSealMapV1 {
  validateLiveRollingSealMap(map);
  if (map.finalizedAt !== null || input.sequence !== map.receipts.length) throw new LiveProductError("live_rolling_seal_map_state_conflict", 409);
  const unsigned: UnsignedReceipt = {
    schemaVersion: "tancmark-live-rolling-seal-receipt-v1",
    ...input,
    previousReceiptDigestSha256: map.chainHeadSha256,
  };
  const receipt: LiveRollingSealReceiptV1 = { ...unsigned, receiptDigestSha256: receiptDigest(unsigned) };
  return { ...map, receipts: [...map.receipts, receipt], chainHeadSha256: receipt.receiptDigestSha256 };
}

export function finalizeLiveRollingSealMap(map: LiveRollingSealMapV1, finalizedAt = new Date().toISOString()): LiveRollingSealMapV1 {
  validateLiveRollingSealMap(map);
  if (map.finalizedAt !== null) return map;
  const finalReceiptDigestSha256 = LiveProductStore.stableDigest({ schemaVersion: map.schemaVersion, bindingId: map.bindingId, sessionId: map.sessionId, chainHeadSha256: map.chainHeadSha256, receiptCount: map.receipts.length, finalizedAt });
  return { ...map, finalizedAt, finalReceiptDigestSha256 };
}
