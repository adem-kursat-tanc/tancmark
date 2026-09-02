import { getLiveHlsEvidencePackage } from "./liveHlsEvidencePackage";
import { getLiveHlsEvidencePdfReadyExport } from "./liveHlsEvidencePdfReadyExport";
import { getLiveHlsEvidenceReportDecisionText } from "./liveHlsEvidenceReportDecisionText";
import { getLiveHlsEvidenceReportModel } from "./liveHlsEvidenceReportModel";
import { getLiveHlsEvidenceReportRiskSummary } from "./liveHlsEvidenceReportRiskSummary";

export const LIVE_HLS_EVIDENCE_REPORT_EXPORT_ROLE =
  "live_hls_evidence_report_export_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceReportSecureRoomExport {
  secureRoomExportId: "secure_room_live_hls_evidence_report_export_v1";
  reportModelSummary: ReturnType<typeof getLiveHlsEvidenceReportModel>;
  pdfReadyExportSummary: ReturnType<typeof getLiveHlsEvidencePdfReadyExport>;
  decisionTextSummary: ReturnType<typeof getLiveHlsEvidenceReportDecisionText>;
  riskSummary: ReturnType<typeof getLiveHlsEvidenceReportRiskSummary>;
  evidencePackageSummary: ReturnType<typeof getLiveHlsEvidencePackage>;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_REPORT_EXPORT_ROLE;
}

export function buildLiveHlsEvidenceReportSecureRoomExport(): LiveHlsEvidenceReportSecureRoomExport {
  return {
    secureRoomExportId: "secure_room_live_hls_evidence_report_export_v1",
    reportModelSummary: getLiveHlsEvidenceReportModel(),
    pdfReadyExportSummary: getLiveHlsEvidencePdfReadyExport(),
    decisionTextSummary: getLiveHlsEvidenceReportDecisionText(),
    riskSummary: getLiveHlsEvidenceReportRiskSummary(),
    evidencePackageSummary: getLiveHlsEvidencePackage(),
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_REPORT_EXPORT_ROLE,
  };
}
