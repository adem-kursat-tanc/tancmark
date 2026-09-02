import { getLiveHlsEvidenceReportModel } from "./liveHlsEvidenceReportModel";

export const LIVE_HLS_EVIDENCE_REPORT_DASHBOARD_ROLE =
  "live_hls_evidence_report_dashboard_summary_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceReportDashboardSummary {
  reportStatus: "pdf_ready_mock";
  hlsCapturePreferred: true;
  rtmpDirectDiagnosticOnly: true;
  postLiveResealStrategy: "safest_local_reseal_strategy";
  sourceBoundary: "synthetic_local_only";
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_REPORT_DASHBOARD_ROLE;
}

export function getLiveHlsEvidenceReportDashboardSummary(): LiveHlsEvidenceReportDashboardSummary {
  const report = getLiveHlsEvidenceReportModel();

  return {
    reportStatus: "pdf_ready_mock",
    hlsCapturePreferred: true,
    rtmpDirectDiagnosticOnly: true,
    postLiveResealStrategy: report.postLiveResealRole,
    sourceBoundary: report.sourceBoundary,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_REPORT_DASHBOARD_ROLE,
  };
}
