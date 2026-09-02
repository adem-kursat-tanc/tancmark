import { getLiveApprovalAuditPolicy } from "./liveApprovalAuditPolicy";
import { buildLiveApprovalAuditTimelineMock } from "./liveApprovalAuditTimelineMock";
import { buildLiveApprovalRiskSnapshot } from "./liveApprovalRiskSnapshot";
import { buildLiveApprovalScopePreview } from "./liveApprovalScopePreview";
import { buildLiveDnaApprovalLearningBridge } from "./liveDnaApprovalLearningBridge";

export const LIVE_APPROVAL_AUDIT_SECURE_ROOM_DECISION_ROLE =
  "live_approval_audit_timeline_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalAuditSecureRoomHandoff {
  liveSessionId: string;
  approvalPolicySummary: ReturnType<typeof getLiveApprovalAuditPolicy>;
  approvalTimelineSummary: ReturnType<typeof buildLiveApprovalAuditTimelineMock>;
  approvalScopeSummary: ReturnType<typeof buildLiveApprovalScopePreview>;
  riskSnapshotSummary: ReturnType<typeof buildLiveApprovalRiskSnapshot>;
  liveDnaApprovalLearningSummary: ReturnType<typeof buildLiveDnaApprovalLearningBridge>;
  realApprovalGranted: false;
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
  decisionRole: typeof LIVE_APPROVAL_AUDIT_SECURE_ROOM_DECISION_ROLE;
}

export function buildLiveApprovalAuditSecureRoomHandoff(
  liveSessionId: string,
  targetType?: unknown,
): LiveApprovalAuditSecureRoomHandoff {
  const approvalTimelineSummary = buildLiveApprovalAuditTimelineMock(liveSessionId);
  const approvalScopeSummary = buildLiveApprovalScopePreview(liveSessionId, targetType);
  const riskSnapshotSummary = buildLiveApprovalRiskSnapshot(liveSessionId);
  const liveDnaApprovalLearningSummary = buildLiveDnaApprovalLearningBridge({
    liveSessionId,
    timeline: approvalTimelineSummary,
    scopePreview: approvalScopeSummary,
    riskSnapshot: riskSnapshotSummary,
  });

  return {
    liveSessionId,
    approvalPolicySummary: getLiveApprovalAuditPolicy(),
    approvalTimelineSummary,
    approvalScopeSummary,
    riskSnapshotSummary,
    liveDnaApprovalLearningSummary,
    realApprovalGranted: false,
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
    decisionRole: LIVE_APPROVAL_AUDIT_SECURE_ROOM_DECISION_ROLE,
  };
}
