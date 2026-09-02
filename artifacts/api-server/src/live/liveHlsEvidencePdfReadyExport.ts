import { getLiveHlsEvidenceReportDecisionText } from "./liveHlsEvidenceReportDecisionText";
import { getLiveHlsEvidenceReportModel } from "./liveHlsEvidenceReportModel";
import { getLiveHlsEvidenceReportRiskSummary } from "./liveHlsEvidenceReportRiskSummary";

export const LIVE_HLS_EVIDENCE_PDF_READY_EXPORT_ROLE =
  "live_hls_evidence_pdf_ready_export_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidencePdfReadyExport {
  title: "TancMark Live HLS Evidence Report";
  subtitle: "PDF-ready mock export for local synthetic lab evidence";
  generatedFor: "local_lab_only";
  sections: {
    executiveSummary: string;
    sourceBoundary: string;
    testChainSummary: string;
    hlsEvidencePath: string;
    rtmpDiagnosticOnly: string;
    postLiveReseal: string;
    idReadResults: string;
    wrongIdAndNoIdSafety: string;
    decisionBoundary: string;
    limitations: string;
    nextSteps: string;
  };
  htmlPreview: string;
  textPreview: string;
  footer: {
    supportOnly: true;
    noVaultNoConfirmedNoFinal: true;
    syntheticLocalOnly: true;
    notLegalFinalProof: true;
  };
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_READY_EXPORT_ROLE;
}

export function getLiveHlsEvidencePdfReadyExport(): LiveHlsEvidencePdfReadyExport {
  const report = getLiveHlsEvidenceReportModel();
  const decisionText = getLiveHlsEvidenceReportDecisionText();
  const riskSummary = getLiveHlsEvidenceReportRiskSummary();
  const executiveSummary =
    "Local synthetic lab evidence: HLS capture is preferred; RTMP direct is diagnostic-only; post-live re-seal is the safest local re-seal strategy. This is not VAULT/confirmed/final.";

  return {
    title: "TancMark Live HLS Evidence Report",
    subtitle: "PDF-ready mock export for local synthetic lab evidence",
    generatedFor: "local_lab_only",
    sections: {
      executiveSummary,
      sourceBoundary: "Source boundary: synthetic_local_only; not real customer content.",
      testChainSummary:
        `HLS pre-sealed ID reads ${report.hlsRepeatabilitySummary.hlsSuccessfulIdReads}/${report.hlsRepeatabilitySummary.hlsTotalRuns}; ` +
        `E2E local live/VOD/re-seal ${report.e2eChainSummary.successfulRuns}/${report.e2eChainSummary.totalRuns}.`,
      hlsEvidencePath: "HLS capture is the preferred local live evidence/read path.",
      rtmpDiagnosticOnly: "RTMP direct capture is diagnostic-only and is not a product evidence/read path.",
      postLiveReseal: "Post-live re-seal is the safest local re-seal strategy observed in this lab.",
      idReadResults:
        "ID reads were observed in HLS/pre-sealed repeatability and post-live re-seal local lab paths; this does not create final ownership proof.",
      wrongIdAndNoIdSafety: "Wrong ID remains rejected; no ID means no VAULT.",
      decisionBoundary: decisionText.summaryText,
      limitations: riskSummary.risks.map((risk) => `${risk.riskKey}: ${risk.explanation}`).join(" | "),
      nextSteps:
        "Deferred: real PDF export, real customer-content live evidence report, legal-grade evidence package review, product post-live re-seal report, external target evidence report, and YouTube evidence report.",
    },
    htmlPreview:
      "<h1>TancMark Live HLS Evidence Report</h1><p>Local synthetic lab evidence. VAULT/confirmed/final degildir. Not legal final proof.</p>",
    textPreview:
      "TancMark Live HLS Evidence Report - local synthetic lab evidence. VAULT/confirmed/final degildir. Gercek musteri icerigi degildir. Kesin hukuki final proof degildir.",
    footer: {
      supportOnly: true,
      noVaultNoConfirmedNoFinal: true,
      syntheticLocalOnly: true,
      notLegalFinalProof: true,
    },
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_READY_EXPORT_ROLE,
  };
}
