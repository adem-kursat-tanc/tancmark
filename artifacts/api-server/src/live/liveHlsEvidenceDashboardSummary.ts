import { getLiveHlsEvidencePackage } from "./liveHlsEvidencePackage";
import { buildLiveHlsEvidenceSecureRoomBundle } from "./liveHlsEvidenceSecureRoomBundle";

export const LIVE_HLS_EVIDENCE_DASHBOARD_DECISION_ROLE =
  "live_hls_evidence_dashboard_summary_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceDashboardSummary {
  title: "HLS Local Evidence Bundle";
  preferredPath: "HLS capture";
  rtmpDirect: "diagnostic-only";
  postLiveReseal: "safest local reseal strategy";
  source: "synthetic/local only";
  localLabSuccessSummary: string;
  secureRoomBundleAvailable: true;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_DASHBOARD_DECISION_ROLE;
}

export function getLiveHlsEvidenceDashboardSummary(): LiveHlsEvidenceDashboardSummary {
  const evidencePackage = getLiveHlsEvidencePackage();
  const secureRoomBundle = buildLiveHlsEvidenceSecureRoomBundle();

  return {
    title: "HLS Local Evidence Bundle",
    preferredPath: "HLS capture",
    rtmpDirect: "diagnostic-only",
    postLiveReseal: "safest local reseal strategy",
    source: "synthetic/local only",
    localLabSuccessSummary:
      `Local RTMP repeatability ${evidencePackage.localRtmpRepeatabilityStatus.successfulRuns}/${evidencePackage.localRtmpRepeatabilityStatus.totalRuns}; ` +
      `HLS pre-sealed ID reads ${evidencePackage.hlsRepeatabilityStatus.hlsSuccessfulIdReads}/${evidencePackage.hlsRepeatabilityStatus.hlsTotalRuns}; ` +
      `E2E live to VOD to re-seal ${evidencePackage.e2eChainStatus.successfulRuns}/${evidencePackage.e2eChainStatus.totalRuns}.`,
    secureRoomBundleAvailable: secureRoomBundle.supportOnly,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_DASHBOARD_DECISION_ROLE,
  };
}
