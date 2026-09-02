export const LIVE_APPROVAL_ACTOR_PREVIEW_DECISION_ROLE =
  "live_approval_actor_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalActorPreview {
  liveSessionId: string;
  actorIdPreview: "actor_preview_operator_001";
  actorRolePreview: "operator";
  actorDisplayNamePreview: "Mock Operator";
  organizationPreview: "TancMark Live Lab Preview";
  approvalAuthorityPreview: "future_real_lab_operator";
  identityVerified: false;
  realApprovalGranted: false;
  realSignatureAccepted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_ACTOR_PREVIEW_DECISION_ROLE;
}

export function buildLiveApprovalActorPreview(liveSessionId: string): LiveApprovalActorPreview {
  return {
    liveSessionId,
    actorIdPreview: "actor_preview_operator_001",
    actorRolePreview: "operator",
    actorDisplayNamePreview: "Mock Operator",
    organizationPreview: "TancMark Live Lab Preview",
    approvalAuthorityPreview: "future_real_lab_operator",
    identityVerified: false,
    realApprovalGranted: false,
    realSignatureAccepted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_ACTOR_PREVIEW_DECISION_ROLE,
  };
}
