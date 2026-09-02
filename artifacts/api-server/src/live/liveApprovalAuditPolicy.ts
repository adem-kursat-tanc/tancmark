export const LIVE_APPROVAL_AUDIT_POLICY_DECISION_ROLE =
  "live_approval_audit_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalAuditPolicy {
  phase: "approval_audit_timeline_read_only_layer";
  acceptsRealApproval: false;
  acceptsApprovalPhraseNow: false;
  requiredApprovalPhrasePreview: "APPROVE_LIVE_REAL_SMOKE_TEST";
  startsRealSmokeTest: false;
  acceptsRealSecret: false;
  storesRealSecret: false;
  realApiEnabled: false;
  realTargetPushEnabled: false;
  realBroadcastStarted: false;
  approvalDataRole: "audit_timeline_preview_only";
  policyRules: string[];
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_AUDIT_POLICY_DECISION_ROLE;
}

export function getLiveApprovalAuditPolicy(): LiveApprovalAuditPolicy {
  return {
    phase: "approval_audit_timeline_read_only_layer",
    acceptsRealApproval: false,
    acceptsApprovalPhraseNow: false,
    requiredApprovalPhrasePreview: "APPROVE_LIVE_REAL_SMOKE_TEST",
    startsRealSmokeTest: false,
    acceptsRealSecret: false,
    storesRealSecret: false,
    realApiEnabled: false,
    realTargetPushEnabled: false,
    realBroadcastStarted: false,
    approvalDataRole: "audit_timeline_preview_only",
    policyRules: [
      "Bu fazda gercek onay kabul edilmez.",
      "APPROVE_LIVE_REAL_SMOKE_TEST bu fazda gercek onay olarak islenmez.",
      "Gercek smoke test baslatilmaz.",
      "Gercek secret kabul edilmez veya saklanmaz.",
      "Gercek API, target push veya yayin yoktur.",
      "Bu katman yalniz audit/timeline preview katmanidir.",
      "Approval audit verisi supportOnly kalir.",
      "VAULT/confirmed/final kararina etki etmez.",
    ],
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_AUDIT_POLICY_DECISION_ROLE,
  };
}
