export const LIVE_HLS_EVIDENCE_PDF_TEMPLATE_POLICY_ROLE =
  "live_hls_evidence_pdf_template_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidencePdfTemplatePolicy {
  templateName: "TancMark Live HLS Evidence Dedicated PDF Template";
  reportType: "live_hls_local_evidence_pdf_template";
  templateScope: "live_hls_local_evidence_only";
  sourceBoundary: "synthetic_local_only";
  supportOnly: true;
  canOpenVault: false;
  canConfirm: false;
  canFinalize: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  legalFinalProofClaimed: false;
  realCustomerContentClaimed: false;
  realPdfGenerated: false;
  pdfGenerationDeferred: true;
  newExternalDependencyAllowed: false;
  genericPdfGeneratorUsage:
    "future_only_after_claim_safety_guard_template_review_and_dedicated_integration";
  decisionStatements: string[];
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_TEMPLATE_POLICY_ROLE;
}

export function getLiveHlsEvidencePdfTemplatePolicy(): LiveHlsEvidencePdfTemplatePolicy {
  return {
    templateName: "TancMark Live HLS Evidence Dedicated PDF Template",
    reportType: "live_hls_local_evidence_pdf_template",
    templateScope: "live_hls_local_evidence_only",
    sourceBoundary: "synthetic_local_only",
    supportOnly: true,
    canOpenVault: false,
    canConfirm: false,
    canFinalize: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    legalFinalProofClaimed: false,
    realCustomerContentClaimed: false,
    realPdfGenerated: false,
    pdfGenerationDeferred: true,
    newExternalDependencyAllowed: false,
    genericPdfGeneratorUsage:
      "future_only_after_claim_safety_guard_template_review_and_dedicated_integration",
    decisionStatements: [
      "This PDF template is only for the Live HLS local evidence report.",
      "The report is supportOnly.",
      "The report does not open VAULT/confirmed/final.",
      "The report is not final legal proof.",
      "The report is not a real customer-content result.",
      "The report summarizes synthetic/local lab evidence only.",
      "Real PDF generation is deferred to a separate approved phase.",
      "The existing generic PDF generator may only be reused later after claim safety guard, template review, and dedicated Live HLS integration.",
      "No new external PDF dependency is added by this policy.",
    ],
    decisionRole: LIVE_HLS_EVIDENCE_PDF_TEMPLATE_POLICY_ROLE,
  };
}
