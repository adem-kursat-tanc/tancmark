import { buildLiveAppendOnlyApprovalLogMock } from "./liveAppendOnlyApprovalLogMock";
import { buildLiveApprovalActorPreview } from "./liveApprovalActorPreview";
import { buildLiveApprovalHashChainPreview } from "./liveApprovalHashChainPreview";
import { buildLiveApprovalImmutabilityValidatorPreview } from "./liveApprovalImmutabilityValidator";
import { buildLiveApprovalSignaturePreview } from "./liveApprovalSignaturePreview";
import { buildLiveDnaApprovalAuditLearningBridge } from "./liveDnaApprovalAuditLearningBridge";
import { getLiveApprovalActorIdentityPolicy } from "./liveApprovalActorIdentityPolicy";
import { getLiveSignedApprovalAuditPolicy } from "./liveSignedApprovalAuditPolicy";

export const LIVE_APPROVAL_IDENTITY_SECURE_ROOM_DECISION_ROLE =
  "live_approval_identity_signed_audit_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalIdentitySecureRoomHandoff {
  liveSessionId: string;
  actorIdentitySummary: ReturnType<typeof buildLiveApprovalActorPreview>;
  actorIdentityPolicySummary: ReturnType<typeof getLiveApprovalActorIdentityPolicy>;
  signedAuditPolicySummary: ReturnType<typeof getLiveSignedApprovalAuditPolicy>;
  appendOnlyLogSummary: ReturnType<typeof buildLiveAppendOnlyApprovalLogMock>;
  hashChainSummary: ReturnType<typeof buildLiveApprovalHashChainPreview>;
  signaturePreviewSummary: ReturnType<typeof buildLiveApprovalSignaturePreview>;
  immutabilityValidatorSummary: ReturnType<typeof buildLiveApprovalImmutabilityValidatorPreview>;
  liveDnaApprovalAuditLearningSummary: ReturnType<typeof buildLiveDnaApprovalAuditLearningBridge>;
  realApprovalGranted: false;
  realSignatureGenerated: false;
  privateKeyUsed: false;
  realAppendOnlyStorage: false;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  realSecretStored: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_APPROVAL_IDENTITY_SECURE_ROOM_DECISION_ROLE;
}

export function buildLiveApprovalIdentitySecureRoomHandoff(
  liveSessionId: string,
): LiveApprovalIdentitySecureRoomHandoff {
  const actorIdentitySummary = buildLiveApprovalActorPreview(liveSessionId);
  const appendOnlyLogSummary = buildLiveAppendOnlyApprovalLogMock(liveSessionId);
  const hashChainSummary = buildLiveApprovalHashChainPreview(liveSessionId);
  const signaturePreviewSummary = buildLiveApprovalSignaturePreview(liveSessionId);
  const immutabilityValidatorSummary = buildLiveApprovalImmutabilityValidatorPreview(liveSessionId);
  const liveDnaApprovalAuditLearningSummary = buildLiveDnaApprovalAuditLearningBridge({
    liveSessionId,
    actorPreview: actorIdentitySummary,
    appendOnlyLog: appendOnlyLogSummary,
    hashChain: hashChainSummary,
    signaturePreview: signaturePreviewSummary,
    immutabilityValidator: immutabilityValidatorSummary,
  });

  return {
    liveSessionId,
    actorIdentitySummary,
    actorIdentityPolicySummary: getLiveApprovalActorIdentityPolicy(),
    signedAuditPolicySummary: getLiveSignedApprovalAuditPolicy(),
    appendOnlyLogSummary,
    hashChainSummary,
    signaturePreviewSummary,
    immutabilityValidatorSummary,
    liveDnaApprovalAuditLearningSummary,
    realApprovalGranted: false,
    realSignatureGenerated: false,
    privateKeyUsed: false,
    realAppendOnlyStorage: false,
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    realSecretStored: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_APPROVAL_IDENTITY_SECURE_ROOM_DECISION_ROLE,
  };
}
