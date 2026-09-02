import { getLiveActualLocalHlsPlaybackVodResult } from "./liveActualLocalHlsPlaybackVodResult";
import { getLiveActualLocalSmokeRepeatabilityResult } from "./liveActualLocalSmokeRepeatabilityResult";
import { getLiveActualLocalSmokeTestResult } from "./liveActualLocalSmokeTestResult";
import { getLiveE2ELocalLiveVodResealIdReadResult } from "./liveE2ELocalLiveVodResealIdReadResult";
import { getLivePostLiveVodResealLabResult } from "./livePostLiveVodResealLabResult";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";
import { getLivePresealedLocalSourceSurvivalResult } from "./livePresealedLocalSourceSurvivalResult";
import { getLivePresealedSurvivalFailureDiagnosticsResult } from "./livePresealedSurvivalFailureDiagnosticsResult";

export const LIVE_HLS_EVIDENCE_SOURCE_SUMMARY_DECISION_ROLE =
  "live_hls_evidence_source_summary_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceSourceSummary {
  usesSyntheticContentOnly: true;
  usesLocalhostOnly: true;
  usesNoPublicSocialTarget: true;
  usesNoRealSecret: true;
  usesNoCustomerContent: true;
  mediaEngine: "mediamtx";
  capturePath: "hls_capture";
  diagnosticPath: "rtmp_direct_capture";
  resealPath: "post_live_reseal";
  evidenceFiles: string[];
  summaryFiles: string[];
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_HLS_EVIDENCE_SOURCE_SUMMARY_DECISION_ROLE;
}

export function getLiveHlsEvidenceSourceSummary(): LiveHlsEvidenceSourceSummary {
  const smoke = getLiveActualLocalSmokeTestResult();
  const repeatability = getLiveActualLocalSmokeRepeatabilityResult();
  const hlsVod = getLiveActualLocalHlsPlaybackVodResult();
  const postLiveReseal = getLivePostLiveVodResealLabResult();
  const e2e = getLiveE2ELocalLiveVodResealIdReadResult();
  const presealed = getLivePresealedLocalSourceSurvivalResult();
  const diagnostics = getLivePresealedSurvivalFailureDiagnosticsResult();
  const hlsRepeatability = getLivePresealedHlsSurvivalRepeatabilityResult();

  return {
    usesSyntheticContentOnly: true,
    usesLocalhostOnly: true,
    usesNoPublicSocialTarget: true,
    usesNoRealSecret: true,
    usesNoCustomerContent: true,
    mediaEngine: "mediamtx",
    capturePath: "hls_capture",
    diagnosticPath: "rtmp_direct_capture",
    resealPath: "post_live_reseal",
    evidenceFiles: [
      smoke.mediamtxLog,
      smoke.ffmpegOutLog,
      smoke.hlsMasterManifestLog,
      hlsVod.vodCapturePath,
      postLiveReseal.inputPath,
      postLiveReseal.outputPath,
      presealed.preSealedSourcePath,
      presealed.vodCapturePath,
      hlsRepeatability.evidenceSummaryPath,
    ],
    summaryFiles: [
      repeatability.evidenceSummaryPath,
      hlsVod.evidenceSummaryPath,
      e2e.evidenceSummaryPath,
      presealed.evidenceSummaryPath,
      diagnostics.evidenceSummaryPath,
      hlsRepeatability.evidenceSummaryPath,
    ],
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_HLS_EVIDENCE_SOURCE_SUMMARY_DECISION_ROLE,
  };
}
