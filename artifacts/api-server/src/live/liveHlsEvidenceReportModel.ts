import { getLiveHlsEvidenceDecisionBoundary } from "./liveHlsEvidenceDecisionBoundary";
import { getLiveHlsEvidencePackage } from "./liveHlsEvidencePackage";
import { buildLiveHlsEvidenceSecureRoomBundle } from "./liveHlsEvidenceSecureRoomBundle";

export const LIVE_HLS_EVIDENCE_REPORT_MODEL_ROLE =
  "live_hls_evidence_report_model_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceReportModel {
  reportId: "live_hls_local_evidence_report_v1";
  reportType: "live_hls_local_evidence_report";
  sourceBoundary: "synthetic_local_only";
  preferredLiveEvidencePath: "hls_capture";
  rtmpDirectCaptureRole: "diagnostic_only";
  postLiveResealRole: "safest_local_reseal_strategy";
  secureRoomBundleId: string;
  evidencePackageId: string;
  localLabSummary: string;
  hlsRepeatabilitySummary: ReturnType<typeof getLiveHlsEvidencePackage>["hlsRepeatabilityStatus"];
  e2eChainSummary: ReturnType<typeof getLiveHlsEvidencePackage>["e2eChainStatus"];
  postLiveResealSummary: ReturnType<typeof getLiveHlsEvidencePackage>["postLiveResealStatus"];
  presealedHlsSurvivalSummary: ReturnType<typeof getLiveHlsEvidencePackage>["presealedHlsSurvivalStatus"];
  wrongIdSafetySummary: ReturnType<typeof buildLiveHlsEvidenceSecureRoomBundle>["wrongIdSafetySummary"];
  noIdNoVaultSummary: ReturnType<typeof buildLiveHlsEvidenceSecureRoomBundle>["noIdNoVaultSummary"];
  decisionBoundary: ReturnType<typeof getLiveHlsEvidenceDecisionBoundary>;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_REPORT_MODEL_ROLE;
}

export function getLiveHlsEvidenceReportModel(): LiveHlsEvidenceReportModel {
  const evidencePackage = getLiveHlsEvidencePackage();
  const secureRoomBundle = buildLiveHlsEvidenceSecureRoomBundle();

  return {
    reportId: "live_hls_local_evidence_report_v1",
    reportType: "live_hls_local_evidence_report",
    sourceBoundary: "synthetic_local_only",
    preferredLiveEvidencePath: evidencePackage.preferredLiveEvidencePath,
    rtmpDirectCaptureRole: evidencePackage.rtmpDirectCaptureRole,
    postLiveResealRole: evidencePackage.postLiveResealRole,
    secureRoomBundleId: secureRoomBundle.secureRoomBundleId,
    evidencePackageId: evidencePackage.packageId,
    localLabSummary:
      "Local synthetic HLS evidence report: HLS capture preferred, RTMP direct diagnostic-only, post-live re-seal safest local strategy.",
    hlsRepeatabilitySummary: evidencePackage.hlsRepeatabilityStatus,
    e2eChainSummary: evidencePackage.e2eChainStatus,
    postLiveResealSummary: evidencePackage.postLiveResealStatus,
    presealedHlsSurvivalSummary: evidencePackage.presealedHlsSurvivalStatus,
    wrongIdSafetySummary: secureRoomBundle.wrongIdSafetySummary,
    noIdNoVaultSummary: secureRoomBundle.noIdNoVaultSummary,
    decisionBoundary: getLiveHlsEvidenceDecisionBoundary(),
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_REPORT_MODEL_ROLE,
  };
}
