import { runSignedExactMapVideoOwnershipRoute } from "../video/signedExactMapVideoOwnershipRoute";
import { runWithinCanonicalLiveExactVerification } from "../video/canonicalReaderLiveScope";
import {
  createSignedExactSealTimingMapV2,
  type PrivateSignedExactMapRegistryRow,
  type SignedExactMapKeyResolver,
} from "../video/signedExactSealTimingMapV2";
import type { LiveLocalSecretProvider } from "./liveLocalSecretProvider";
import type { LiveRollingSealMapV1 } from "./liveRollingSealMap";
import {
  resolveLiveSessionSealAuthority,
  type LiveSessionSealBindingV1,
} from "./liveSessionSealBinding";
import { LiveProductError, LiveProductStore } from "./liveProductStore";

export interface LiveAutomaticFinalVerificationResult {
  schemaVersion: "tancmark-live-automatic-final-verification-v1";
  sessionId: string;
  bindingId: string;
  verdict: "VIDEO_LAYER_VAULT" | "CANDIDATE_SUPPORT_ONLY" | "MANUAL_REVIEW" | "NOT_FOUND";
  reason: string;
  exactIdVerified: boolean;
  registryVerified: boolean;
  signatureVerified: boolean;
  tenantVerified: boolean;
  accountVerified: boolean;
  uniqueRecord: boolean;
  physicalVideoIdVerified: boolean;
  ownership: boolean;
  vault: boolean;
  confirmed: boolean;
  final: boolean;
  mapMode: string;
  decodeSummary: {
    verdict: string;
    channelAVerdict: string;
    strongFrames: number;
    vaultFrames: number;
    weakFrames: number;
    framesAttempted: number;
    channelAIdMatched: boolean;
    channelBIdMatched: boolean;
  } | null;
  signedMapDigestSha256: string;
  encoderReceiptSha256: string;
  verifiedAt: string;
  exactIdDisclosed: false;
  rawDecoderResultSerialized: false;
}

export async function createAndVerifyLiveFinalExact(input: {
  store: LiveProductStore;
  tenantId: string;
  sessionId: string;
  binding: LiveSessionSealBindingV1;
  rollingMap: LiveRollingSealMapV1;
  provider: LiveLocalSecretProvider;
}): Promise<LiveAutomaticFinalVerificationResult> {
  const authority = resolveLiveSessionSealAuthority(input.binding, input.provider);
  const paths = input.store.protectedRecordingPathAndWorkDir(input.tenantId, input.sessionId);
  const channelAFrameIdxs = input.rollingMap.receipts.flatMap((receipt) => receipt.channelAFrameIdxs);
  const channelBFrameIdxs = input.rollingMap.receipts.flatMap((receipt) => receipt.channelBFrameIdxs);
  if (channelAFrameIdxs.length < 1) throw new LiveProductError("live_final_channel_a_receipt_missing", 409);
  const authenticatedEncoderReceiptBytes = Buffer.from(JSON.stringify(input.rollingMap), "utf8");
  const encoderReceiptSha256 = LiveProductStore.sha256(authenticatedEncoderReceiptBytes);
  const envelope = await createSignedExactSealTimingMapV2({
    videoPath: paths.videoPath,
    videoIdentityHex: authority.exactIdHex,
    tenantId: input.binding.tenantId,
    accountId: input.binding.accountId,
    registryRecordId: input.binding.registryRecordId,
    registryRevision: input.binding.registryVersion,
    watermarkAlgorithmVersion: input.binding.watermarkAlgorithmVersion,
    videoWatermarkVersion: input.binding.videoWatermarkVersion,
    encoderReceiptSha256,
    channelAFrameIdxs,
    channelBFrameIdxs,
    createdAt: new Date().toISOString(),
    keyId: input.binding.physicalAegisKeyVersion,
    masterSecret: authority.masterSecret,
    tenantSalt: authority.tenantSalt,
  });
  const row: PrivateSignedExactMapRegistryRow = {
    tenantId: input.binding.tenantId,
    accountId: input.binding.accountId,
    registryRecordId: input.binding.registryRecordId,
    registryRevision: input.binding.registryVersion,
    keyId: input.binding.physicalAegisKeyVersion,
    expectedEncoderReceiptSha256: encoderReceiptSha256,
    status: "ACTIVE",
    revokedAt: null,
    supersededByRecordId: null,
    envelope,
  };
  input.store.writePrivateJsonOnce(input.tenantId, input.sessionId, "signed-map.json", envelope);
  input.store.writePrivateJsonOnce(input.tenantId, input.sessionId, "registry-row.json", row);
  const keyResolver: SignedExactMapKeyResolver = {
    async resolve(request) {
      if (
        request.tenantId !== input.binding.tenantId ||
        request.accountId !== input.binding.accountId ||
        request.keyId !== input.binding.physicalAegisKeyVersion
      ) return undefined;
      return { keyId: input.binding.physicalAegisKeyVersion, masterSecret: authority.masterSecret, tenantSalt: authority.tenantSalt, revoked: false };
    },
  };
  const decision = await runWithinCanonicalLiveExactVerification(() => runSignedExactMapVideoOwnershipRoute({
    ...paths,
    presentedVideoIdentityHex: authority.exactIdHex,
    tenantId: input.binding.tenantId,
    accountId: input.binding.accountId,
    registryRecordId: input.binding.registryRecordId,
    expectedWatermarkAlgorithmVersion: input.binding.watermarkAlgorithmVersion,
    expectedVideoWatermarkVersion: input.binding.videoWatermarkVersion,
    registry: {
      async lookup(request) {
        return request.tenantId === row.tenantId && request.accountId === row.accountId && request.registryRecordId === row.registryRecordId ? [row] : [];
      },
    },
    keyResolver,
    authenticatedEncoderReceiptBytes,
  }));
  const chain = decision.digitalEvidenceChain;
  const exact = decision.verdict === "VIDEO_LAYER_VAULT" && decision.ownership === true && decision.vault === true;
  const result: LiveAutomaticFinalVerificationResult = {
    schemaVersion: "tancmark-live-automatic-final-verification-v1",
    sessionId: input.sessionId,
    bindingId: input.binding.bindingId,
    verdict: decision.verdict,
    reason: decision.reason,
    exactIdVerified: chain.presentedFullIdentityMatched,
    registryVerified: chain.registryLookupVerified && chain.registryRecordActive,
    signatureVerified: chain.signatureVerified,
    tenantVerified: chain.tenantBound,
    accountVerified: chain.accountBound,
    uniqueRecord: chain.uniqueRegistryRecord,
    physicalVideoIdVerified: chain.physicalVideoIdVerified,
    ownership: exact,
    vault: exact,
    confirmed: exact,
    final: exact,
    mapMode: decision.mapMode,
    decodeSummary: decision.decode ? {
      verdict: decision.decode.verdict,
      channelAVerdict: decision.decode.channelAVerdict,
      strongFrames: decision.decode.strongFrames,
      vaultFrames: decision.decode.vaultFrames,
      weakFrames: decision.decode.weakFrames,
      framesAttempted: decision.decode.framesAttempted,
      channelAIdMatched: decision.decode.channelAIdMatched,
      channelBIdMatched: decision.decode.channelBIdMatched,
    } : null,
    signedMapDigestSha256: envelope.mapDigestSha256,
    encoderReceiptSha256,
    verifiedAt: new Date().toISOString(),
    exactIdDisclosed: false,
    rawDecoderResultSerialized: false,
  };
  input.store.writePrivateJsonOnce(input.tenantId, input.sessionId, "final-verification.json", result);
  return result;
}
