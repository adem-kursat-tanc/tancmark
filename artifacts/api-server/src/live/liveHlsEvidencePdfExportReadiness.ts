export const LIVE_HLS_EVIDENCE_PDF_EXPORT_READINESS_ROLE =
  "live_hls_evidence_pdf_export_readiness_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidencePdfExportReadiness {
  pdfExportReadinessStatus: "audited_pdf_deferred";
  existingPdfGeneratorFound: true;
  existingPdfGeneratorName: "reportGenerator.ts PDFKit forensic generator; liveHlsEvidencePdfReadyExport.ts PDF-ready mock";
  safeToGeneratePdfNow: false;
  pdfGenerated: false;
  pdfArtifactPath: null;
  reasonIfNotGenerated: string;
  jsonArtifactPath: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.json";
  htmlArtifactPath: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.html";
  textArtifactPath: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.txt";
  sourceBoundary: "synthetic_local_only";
  generatorAudit: {
    pdfkitDependencyPresent: true;
    pdfParseDependencyPresent: true;
    forensicPdfGeneratorPresent: true;
    liveDedicatedPdfGeneratorPresent: false;
    existingGeneratorRisk: "domain_specific_forensic_generator_not_safe_for_live_hls_evidence_without_separate_template_audit";
    newExternalDependencyAdded: false;
  };
  safetyBoundary: {
    reportLanguageRequiresSupportOnly: true;
    noLegalFinalProofClaim: true;
    noVaultClaim: true;
    noConfirmedOwnershipClaim: true;
    noRealCustomerContentClaim: true;
    finalDecisionRequiresRealIdAndRegistryMatch: true;
  };
  realBroadcastStarted: false;
  realApiCalled: false;
  realSecretAccepted: false;
  realExternalTargetPush: false;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_EXPORT_READINESS_ROLE;
}

export function getLiveHlsEvidencePdfExportReadiness(): LiveHlsEvidencePdfExportReadiness {
  return {
    pdfExportReadinessStatus: "audited_pdf_deferred",
    existingPdfGeneratorFound: true,
    existingPdfGeneratorName: "reportGenerator.ts PDFKit forensic generator; liveHlsEvidencePdfReadyExport.ts PDF-ready mock",
    safeToGeneratePdfNow: false,
    pdfGenerated: false,
    pdfArtifactPath: null,
    reasonIfNotGenerated:
      "PDFKit/reportGenerator.ts exists for existing forensic/text reports, and Live has a PDF-ready mock payload, but there is no dedicated audited Live HLS evidence PDF generator/template. Reusing the forensic generator would risk wrong domain language and legal-proof confusion, so PDF export stays deferred.",
    jsonArtifactPath:
      "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.json",
    htmlArtifactPath:
      "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.html",
    textArtifactPath:
      "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.txt",
    sourceBoundary: "synthetic_local_only",
    generatorAudit: {
      pdfkitDependencyPresent: true,
      pdfParseDependencyPresent: true,
      forensicPdfGeneratorPresent: true,
      liveDedicatedPdfGeneratorPresent: false,
      existingGeneratorRisk: "domain_specific_forensic_generator_not_safe_for_live_hls_evidence_without_separate_template_audit",
      newExternalDependencyAdded: false,
    },
    safetyBoundary: {
      reportLanguageRequiresSupportOnly: true,
      noLegalFinalProofClaim: true,
      noVaultClaim: true,
      noConfirmedOwnershipClaim: true,
      noRealCustomerContentClaim: true,
      finalDecisionRequiresRealIdAndRegistryMatch: true,
    },
    realBroadcastStarted: false,
    realApiCalled: false,
    realSecretAccepted: false,
    realExternalTargetPush: false,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_EXPORT_READINESS_ROLE,
  };
}
