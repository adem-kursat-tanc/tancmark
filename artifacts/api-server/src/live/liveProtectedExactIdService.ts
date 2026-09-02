import { runSignedExactMapVideoOwnershipRoute } from "../video/signedExactMapVideoOwnershipRoute";
import { signedExactMapDbRegistry, signedExactMapProductKeyResolver } from "../video/signedExactMapDbRegistry";
import { LiveProductError, LiveProductStore } from "./liveProductStore";
import { noteLiveProtectedExactCallFinished, noteLiveProtectedExactCallStarted } from "./liveExactIdentityAuthorityAdapter";

export interface LiveProtectedExactIdInput {
  tenantId: string; sessionId: string; expectedIdHex: string; accountId: string; registryRecordId: string;
  expectedWatermarkAlgorithmVersion: string; expectedVideoWatermarkVersion: string;
}

/** Calls the existing protected reader/registry/decision chain unchanged. */
export async function verifyStoppedLiveRecordingExactId(store: LiveProductStore, input: LiveProtectedExactIdInput): Promise<Record<string, unknown>> {
  if (!/^[0-9a-f]{64}$/.test(input.expectedIdHex)) throw new LiveProductError("live_expected_id_must_be_64_hex", 400);
  for (const value of [input.accountId, input.registryRecordId, input.expectedWatermarkAlgorithmVersion, input.expectedVideoWatermarkVersion]) if (!value || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) throw new LiveProductError("live_exact_verify_binding_invalid", 400);
  const session = store.requireSession(input.tenantId, input.sessionId);
  if (session.status !== "STOPPED") throw new LiveProductError("live_protected_verify_requires_stopped", 409);
  if (!session.expectedIdSha256 || session.expectedIdSha256 !== LiveProductStore.sha256(`expected-id\0${input.expectedIdHex}`)) throw new LiveProductError("live_expected_id_binding_mismatch", 404);
  const paths = store.protectedRecordingPathAndWorkDir(input.tenantId, input.sessionId);
  noteLiveProtectedExactCallStarted();
  let result: Awaited<ReturnType<typeof runSignedExactMapVideoOwnershipRoute>>;
  try {
    result = await runSignedExactMapVideoOwnershipRoute({ ...paths, presentedVideoIdentityHex: input.expectedIdHex, tenantId: input.tenantId, accountId: input.accountId, registryRecordId: input.registryRecordId, expectedWatermarkAlgorithmVersion: input.expectedWatermarkAlgorithmVersion, expectedVideoWatermarkVersion: input.expectedVideoWatermarkVersion, registry: signedExactMapDbRegistry, keyResolver: signedExactMapProductKeyResolver });
    noteLiveProtectedExactCallFinished({ verdict: result.verdict });
  } catch (error) {
    noteLiveProtectedExactCallFinished(null, error);
    throw error;
  }
  store.appendEvent(input.tenantId, input.sessionId, "protected-exact-id.verified", { verdict: result.verdict, reason: result.reason, registryLookupVerified: result.digitalEvidenceChain.registryLookupVerified, signatureVerified: result.digitalEvidenceChain.signatureVerified, physicalVideoIdVerified: result.digitalEvidenceChain.physicalVideoIdVerified });
  return {
    scopedProtectedVideoDecision: {
      verdict: result.verdict, reason: result.reason, videoImageLayerOwnershipVerified: result.ownership, videoImageLayerVaultEligible: result.vault, ownershipScope: result.ownershipScope, mapMode: result.mapMode,
      digitalEvidenceChain: { registryLookupVerified: result.digitalEvidenceChain.registryLookupVerified, uniqueRegistryRecord: result.digitalEvidenceChain.uniqueRegistryRecord, signatureVerified: result.digitalEvidenceChain.signatureVerified, tenantBound: result.digitalEvidenceChain.tenantBound, accountBound: result.digitalEvidenceChain.accountBound, registryRecordActive: result.digitalEvidenceChain.registryRecordActive, presentedFullIdentityMatched: result.digitalEvidenceChain.presentedFullIdentityMatched, physicalVideoIdVerified: result.digitalEvidenceChain.physicalVideoIdVerified },
      decode: result.decode ? { verdict: result.decode.verdict, channelAVerdict: result.decode.channelAVerdict, strongFrames: result.decode.strongFrames, vaultFrames: result.decode.vaultFrames, weakFrames: result.decode.weakFrames, framesAttempted: result.decode.framesAttempted, channelAIdMatched: result.decode.channelAIdMatched, channelBIdMatched: result.decode.channelBIdMatched } : null,
    },
    liveTransportEvidence: { supportOnly: true, ownership: false, vault: false, canOpenVault: false, confirmed: false, final: false },
    expectedIdDisclosedInResponse: false,
    rawDecoderResultSerialized: false,
  };
}
