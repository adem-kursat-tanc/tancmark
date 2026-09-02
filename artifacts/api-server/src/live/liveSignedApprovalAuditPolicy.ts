export const LIVE_SIGNED_APPROVAL_AUDIT_POLICY_DECISION_ROLE =
  "live_signed_approval_audit_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveSignedApprovalAuditPolicy {
  phase: "signed_approval_audit_mock_layer";
  appendOnlyPreview: true;
  realAppendOnlyStorage: false;
  realSignatureGenerated: false;
  privateKeyUsed: false;
  deleteAllowed: false;
  updateAllowed: false;
  realCryptographicSignature: false;
  signatureShapePreviewOnly: true;
  hashChainPreviewOnly: true;
  supportOnly: true;
  realApprovalGranted: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SIGNED_APPROVAL_AUDIT_POLICY_DECISION_ROLE;
}

export function getLiveSignedApprovalAuditPolicy(): LiveSignedApprovalAuditPolicy {
  return {
    phase: "signed_approval_audit_mock_layer",
    appendOnlyPreview: true,
    realAppendOnlyStorage: false,
    realSignatureGenerated: false,
    privateKeyUsed: false,
    deleteAllowed: false,
    updateAllowed: false,
    realCryptographicSignature: false,
    signatureShapePreviewOnly: true,
    hashChainPreviewOnly: true,
    supportOnly: true,
    realApprovalGranted: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SIGNED_APPROVAL_AUDIT_POLICY_DECISION_ROLE,
  };
}
