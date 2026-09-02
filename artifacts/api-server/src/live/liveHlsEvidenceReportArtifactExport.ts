import {
  getLiveHlsEvidencePdfArtifactExport,
  LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH,
} from "./liveHlsEvidencePdfArtifactExport";

export const LIVE_HLS_EVIDENCE_REPORT_ARTIFACT_EXPORT_ROLE =
  "live_hls_evidence_report_artifact_export_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceReportArtifactExport {
  exportStatus: "exported_local_artifacts";
  artifactDirectory: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export";
  jsonArtifactPath: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.json";
  htmlArtifactPath: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.html";
  textArtifactPath: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.txt";
  pdfArtifactPath: typeof LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH;
  pdfGenerated: boolean;
  usedExistingPdfInfrastructure: boolean;
  pdfDecision:
    | "generated_with_dedicated_template_and_claim_safety_guard"
    | "not_generated_dedicated_pdf_artifact_missing";
  sourceBoundary: "synthetic_local_only";
  reportBoundary: "read_only_lab_result";
  realBroadcastStarted: false;
  realApiCalled: false;
  realSecretAccepted: false;
  realExternalTargetPush: false;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_REPORT_ARTIFACT_EXPORT_ROLE;
}

export function getLiveHlsEvidenceReportArtifactExport(): LiveHlsEvidenceReportArtifactExport {
  const pdfArtifact = getLiveHlsEvidencePdfArtifactExport();

  return {
    exportStatus: "exported_local_artifacts",
    artifactDirectory: "runtime/validation/live_actual_local_smoke/hls_evidence_report_export",
    jsonArtifactPath:
      "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.json",
    htmlArtifactPath:
      "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.html",
    textArtifactPath:
      "runtime/validation/live_actual_local_smoke/hls_evidence_report_export/live_hls_evidence_report.txt",
    pdfArtifactPath: LIVE_HLS_EVIDENCE_PDF_ARTIFACT_PATH,
    pdfGenerated: pdfArtifact.pdfArtifactGenerated,
    usedExistingPdfInfrastructure: pdfArtifact.pdfArtifactGenerated,
    pdfDecision: pdfArtifact.pdfArtifactGenerated
      ? "generated_with_dedicated_template_and_claim_safety_guard"
      : "not_generated_dedicated_pdf_artifact_missing",
    sourceBoundary: "synthetic_local_only",
    reportBoundary: "read_only_lab_result",
    realBroadcastStarted: false,
    realApiCalled: false,
    realSecretAccepted: false,
    realExternalTargetPush: false,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_REPORT_ARTIFACT_EXPORT_ROLE,
  };
}
