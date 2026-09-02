export const LIVE_HLS_EVIDENCE_DECISION_ROLE =
  "live_hls_evidence_package_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceDecisionBoundary {
  packageRole: "evidence_support_package";
  boundaryStatements: string[];
  wrongIdSafetyRule: "wrong_id_rejected";
  noIdNoVaultRule: "no_id_no_vault";
  finalDecisionRequirement: "real_tancmark_id_read_plus_registered_system_match";
  realCustomerGuarantee: "not_an_automatic_guarantee_for_real_customer_content";
  canOpenVault: false;
  canConfirm: false;
  canFinalize: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_HLS_EVIDENCE_DECISION_ROLE;
}

export function getLiveHlsEvidenceDecisionBoundary(): LiveHlsEvidenceDecisionBoundary {
  return {
    packageRole: "evidence_support_package",
    boundaryStatements: [
      "HLS evidence package is a support evidence bundle, not a product final decision.",
      "It cannot open VAULT.",
      "It cannot set confirmed.",
      "It cannot set final.",
      "Partial, advisory, and candidate results are not final decisions.",
      "Wrong ID remains rejected.",
      "No ID means no VAULT.",
      "Product final decision still requires a real TancMark ID read plus a registered system match.",
      "Local synthetic lab results are not an automatic guarantee for real customer content.",
    ],
    wrongIdSafetyRule: "wrong_id_rejected",
    noIdNoVaultRule: "no_id_no_vault",
    finalDecisionRequirement: "real_tancmark_id_read_plus_registered_system_match",
    realCustomerGuarantee: "not_an_automatic_guarantee_for_real_customer_content",
    canOpenVault: false,
    canConfirm: false,
    canFinalize: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_HLS_EVIDENCE_DECISION_ROLE,
  };
}
