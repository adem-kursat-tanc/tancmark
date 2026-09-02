export const LIVE_APPROVAL_SIGNATURE_PREVIEW_DECISION_ROLE =
  "live_approval_signature_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalSignaturePreview {
  liveSessionId: string;
  signatureAlgorithmPreview: "ed25519_future_preview";
  publicKeyIdPreview: "PUBLIC_KEY_ID_MOCK_PREVIEW";
  signatureValuePreview: "REDACTED_MOCK_SIGNATURE";
  realSignatureGenerated: false;
  privateKeyUsed: false;
  signatureVerifiableNow: false;
  futureRealSignatureRequired: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_SIGNATURE_PREVIEW_DECISION_ROLE;
}

export function buildLiveApprovalSignaturePreview(liveSessionId: string): LiveApprovalSignaturePreview {
  return {
    liveSessionId,
    signatureAlgorithmPreview: "ed25519_future_preview",
    publicKeyIdPreview: "PUBLIC_KEY_ID_MOCK_PREVIEW",
    signatureValuePreview: "REDACTED_MOCK_SIGNATURE",
    realSignatureGenerated: false,
    privateKeyUsed: false,
    signatureVerifiableNow: false,
    futureRealSignatureRequired: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_SIGNATURE_PREVIEW_DECISION_ROLE,
  };
}
