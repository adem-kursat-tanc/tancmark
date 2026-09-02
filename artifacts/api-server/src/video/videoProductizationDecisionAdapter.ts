import type { SignedExactMapVideoOwnershipRouteResult } from "./signedExactMapVideoOwnershipRoute";
import {
  decideVideoPrimaryV2,
  type VideoPrimaryScopedDecisionV2,
} from "./videoPrimaryDecisionV2";

/**
 * Product boundary adapter. Keep every authenticated registry binding
 * independent from exact timing-map validity: delivery transforms may require
 * physical recovery without invalidating the already verified revision.
 */
export function adaptSignedExactMapRouteToVideoPrimaryDecision(input: {
  internalResult: SignedExactMapVideoOwnershipRouteResult;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
}): VideoPrimaryScopedDecisionV2 {
  const { internalResult } = input;
  const internalDecode = internalResult.decode;
  return decideVideoPrimaryV2({
    identityInputStatus: "VALID",
    claimedTenantId: input.tenantId,
    claimedAccountId: input.accountId,
    claimedRegistryRecordId: input.registryRecordId,
    claimedRegistryRevision: input.registryRevision,
    locatorMode: "TARGETED_FULL_ID_NOT_USED",
    locator: {
      status: "NOT_USED_TARGETED_FULL_ID",
      locator32: 0,
      records: [],
    },
    mapEvidence: {
      status: internalResult.verdict === "MANUAL_REVIEW"
        ? "MANUAL_REVIEW"
        : internalResult.digitalEvidenceChain.registryLookupVerified &&
            internalResult.digitalEvidenceChain.signatureVerified &&
            internalResult.digitalEvidenceChain.exactMapVerified
          ? "VALIDATED"
          : internalResult.digitalEvidenceChain.registryLookupVerified &&
              internalResult.digitalEvidenceChain.signatureVerified &&
              internalResult.digitalEvidenceChain.presentedFullIdentityMatched &&
              internalResult.mapMode === "VFR_SAFE_PHYSICAL_RECOVERY"
            ? "RECOVERY_REQUIRED"
            : "NOT_FOUND",
      registryLookupVerified:
        internalResult.digitalEvidenceChain.registryLookupVerified,
      uniqueRegistryRecord:
        internalResult.digitalEvidenceChain.uniqueRegistryRecord,
      signatureVerified:
        internalResult.digitalEvidenceChain.signatureVerified,
      exactMapVerified:
        internalResult.digitalEvidenceChain.exactMapVerified,
      tenantBound: internalResult.digitalEvidenceChain.tenantBound,
      accountBound: internalResult.digitalEvidenceChain.accountBound,
      registryRecordBound:
        internalResult.digitalEvidenceChain.registryRecordBound,
      registryRevisionBound:
        internalResult.digitalEvidenceChain.registryRevisionBound,
      registryRecordActive:
        internalResult.digitalEvidenceChain.registryRecordActive,
      physicalKeyVersionBound:
        internalResult.digitalEvidenceChain.physicalKeyVersionBound,
      presentedVideoIdentityMatched:
        internalResult.digitalEvidenceChain.presentedFullIdentityMatched,
    },
    physicalEvidence: {
      channelAMatched: internalDecode?.channelAIdMatched === true,
      channelBMatched: internalDecode?.channelBIdMatched === true,
      bothChannelsMatched: internalDecode?.bothChannelsMatched === true,
      finalConfirmedBy: internalDecode?.finalConfirmedBy ?? "none",
      locatorCandidateObserved:
        internalDecode !== undefined && internalDecode.verdict !== "NOT_FOUND",
    },
    audioExactIntegrity: "AUDIO_EXACT_INTEGRITY_NOT_MEASURED",
    mapMode: internalResult.mapMode,
  });
}
