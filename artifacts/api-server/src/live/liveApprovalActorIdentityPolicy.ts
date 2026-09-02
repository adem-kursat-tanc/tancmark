export const LIVE_APPROVAL_ACTOR_IDENTITY_POLICY_DECISION_ROLE =
  "live_approval_actor_identity_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalActorIdentityPolicy {
  phase: "approval_actor_identity_mock_layer";
  verifiesRealIdentity: false;
  realSignatureAccepted: false;
  acceptsRealApproval: false;
  startsRealSmokeTest: false;
  personalDataMinimized: true;
  actorIdentityRole: "support_only_preview";
  requiredFutureIdentityFields: string[];
  actorIdPreview: "actor_preview_operator_001";
  actorRolePreview: "operator";
  actorDisplayNamePreview: "Mock Operator";
  organizationPreview: "TancMark Live Lab Preview";
  approvalAuthorityPreview: "future_real_lab_operator";
  identityVerified: false;
  realApprovalGranted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_ACTOR_IDENTITY_POLICY_DECISION_ROLE;
}

export function getLiveApprovalActorIdentityPolicy(): LiveApprovalActorIdentityPolicy {
  return {
    phase: "approval_actor_identity_mock_layer",
    verifiesRealIdentity: false,
    realSignatureAccepted: false,
    acceptsRealApproval: false,
    startsRealSmokeTest: false,
    personalDataMinimized: true,
    actorIdentityRole: "support_only_preview",
    requiredFutureIdentityFields: [
      "actorId",
      "actorRole",
      "organization",
      "approvalAuthority",
      "identityVerificationStatus",
      "approvalScope",
      "approvalTimestamp",
    ],
    actorIdPreview: "actor_preview_operator_001",
    actorRolePreview: "operator",
    actorDisplayNamePreview: "Mock Operator",
    organizationPreview: "TancMark Live Lab Preview",
    approvalAuthorityPreview: "future_real_lab_operator",
    identityVerified: false,
    realApprovalGranted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_ACTOR_IDENTITY_POLICY_DECISION_ROLE,
  };
}
