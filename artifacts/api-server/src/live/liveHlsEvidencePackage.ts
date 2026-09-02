import { getLiveActualLocalHlsPlaybackVodResult } from "./liveActualLocalHlsPlaybackVodResult";
import { getLiveActualLocalSmokeRepeatabilityResult } from "./liveActualLocalSmokeRepeatabilityResult";
import { getLiveActualLocalSmokeTestResult } from "./liveActualLocalSmokeTestResult";
import { getLiveE2ELocalLiveVodResealIdReadResult } from "./liveE2ELocalLiveVodResealIdReadResult";
import { getLiveEvidencePathPolicy } from "./liveEvidencePathPolicy";
import { LIVE_HLS_EVIDENCE_DECISION_ROLE } from "./liveHlsEvidenceDecisionBoundary";
import { getLivePostLiveVodResealLabResult } from "./livePostLiveVodResealLabResult";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";
import { getLivePresealedLocalSourceSurvivalResult } from "./livePresealedLocalSourceSurvivalResult";

export interface LiveHlsEvidencePackage {
  packageId: "live_hls_local_evidence_bundle_v1";
  packageType: "local_hls_live_evidence_bundle";
  preferredLiveEvidencePath: "hls_capture";
  rtmpDirectCaptureRole: "diagnostic_only";
  postLiveResealRole: "safest_local_reseal_strategy";
  sourceType: "synthetic_local_only";
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  actualLocalSmokeStatus: {
    actualSmokeExecuted: true;
    rtmpPublishObserved: true;
    hlsManifestObserved: true;
    hlsSegmentsObserved: true;
  };
  localRtmpRepeatabilityStatus: {
    totalRuns: 3;
    successfulRuns: 3;
    rtmpPublishObservedCount: 3;
    hlsManifestObservedCount: 3;
    hlsSegmentObservedCount: 3;
  };
  hlsPlaybackVodStatus: {
    hlsProbeSucceeded: true;
    hlsReadableByFfmpegOrFfprobe: true;
    vodCaptureCreated: true;
  };
  hlsRepeatabilityStatus: {
    hlsTotalRuns: 3;
    hlsSuccessfulIdReads: 3;
    hlsExpectedIdMatches: 3;
    status: "passed";
  };
  e2eChainStatus: {
    totalRuns: number;
    successfulRuns: number;
    embeddedIdRead: true;
    idMatchExpectedLabRecord: true;
    status: "passed";
  };
  postLiveResealStatus: {
    postLiveResealSucceeded: true;
    embeddedIdRead: true;
    idMatchExpectedLabRecord: true;
    status: "passed";
  };
  presealedHlsSurvivalStatus: {
    hlsSuccessfulIdReads: 3;
    hlsExpectedIdMatches: 3;
    status: "passed";
  };
  presealedDirectPipelineStatus: {
    embeddedIdRead: boolean;
    survivalVerdict: "VAULT" | "WEAK_SIGNAL" | "NOT_FOUND";
    status: "diagnostic_not_product_failure";
  };
  rtmpDiagnosticStatus: {
    rtmpCapture4sEmbeddedIdRead: false;
    rtmpCapture8sEmbeddedIdRead: true;
    rtmpCapture12sEmbeddedIdRead: false;
    rtmpCapture15sEmbeddedIdRead: false;
    status: "diagnostic_only_inconsistent";
  };
  wrongIdRejected: true;
  noIdNoVault: true;
  candidateDoesNotOpenVault: true;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_DECISION_ROLE;
}

export function getLiveHlsEvidencePackage(): LiveHlsEvidencePackage {
  const smoke = getLiveActualLocalSmokeTestResult();
  const repeatability = getLiveActualLocalSmokeRepeatabilityResult();
  const hlsVod = getLiveActualLocalHlsPlaybackVodResult();
  const postLiveReseal = getLivePostLiveVodResealLabResult();
  const e2e = getLiveE2ELocalLiveVodResealIdReadResult();
  const presealed = getLivePresealedLocalSourceSurvivalResult();
  const hlsRepeatability = getLivePresealedHlsSurvivalRepeatabilityResult();
  const policy = getLiveEvidencePathPolicy();

  return {
    packageId: "live_hls_local_evidence_bundle_v1",
    packageType: "local_hls_live_evidence_bundle",
    preferredLiveEvidencePath: policy.preferredLiveEvidencePath,
    rtmpDirectCaptureRole: policy.rtmpDirectCaptureRole,
    postLiveResealRole: policy.postLiveResealRole,
    sourceType: "synthetic_local_only",
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    actualLocalSmokeStatus: {
      actualSmokeExecuted: smoke.actualSmokeExecuted,
      rtmpPublishObserved: smoke.rtmpPublishObserved,
      hlsManifestObserved: smoke.hlsManifestObserved,
      hlsSegmentsObserved: smoke.hlsSegmentsObserved,
    },
    localRtmpRepeatabilityStatus: {
      totalRuns: repeatability.totalRuns,
      successfulRuns: repeatability.successfulRuns,
      rtmpPublishObservedCount: repeatability.rtmpPublishObservedCount,
      hlsManifestObservedCount: repeatability.hlsManifestObservedCount,
      hlsSegmentObservedCount: repeatability.hlsSegmentObservedCount,
    },
    hlsPlaybackVodStatus: {
      hlsProbeSucceeded: hlsVod.hlsProbeSucceeded,
      hlsReadableByFfmpegOrFfprobe: hlsVod.hlsReadableByFfmpegOrFfprobe,
      vodCaptureCreated: hlsVod.vodCaptureCreated,
    },
    hlsRepeatabilityStatus: {
      hlsTotalRuns: hlsRepeatability.hlsTotalRuns,
      hlsSuccessfulIdReads: hlsRepeatability.hlsSuccessfulIdReads,
      hlsExpectedIdMatches: hlsRepeatability.hlsExpectedIdMatches,
      status: "passed",
    },
    e2eChainStatus: {
      totalRuns: e2e.totalRuns,
      successfulRuns: e2e.successfulRuns,
      embeddedIdRead: e2e.embeddedIdRead,
      idMatchExpectedLabRecord: e2e.idMatchExpectedLabRecord,
      status: "passed",
    },
    postLiveResealStatus: {
      postLiveResealSucceeded: postLiveReseal.postLiveResealSucceeded,
      embeddedIdRead: postLiveReseal.embeddedIdRead,
      idMatchExpectedLabRecord: postLiveReseal.idMatchExpectedLabRecord,
      status: "passed",
    },
    presealedHlsSurvivalStatus: {
      hlsSuccessfulIdReads: hlsRepeatability.hlsSuccessfulIdReads,
      hlsExpectedIdMatches: hlsRepeatability.hlsExpectedIdMatches,
      status: "passed",
    },
    presealedDirectPipelineStatus: {
      embeddedIdRead: presealed.embeddedIdRead,
      survivalVerdict: presealed.idReadBitsOrConfidence.verdict,
      status: "diagnostic_not_product_failure",
    },
    rtmpDiagnosticStatus: {
      rtmpCapture4sEmbeddedIdRead: hlsRepeatability.rtmpCapture4sResult.embeddedIdRead,
      rtmpCapture8sEmbeddedIdRead: hlsRepeatability.rtmpCapture8sResult.embeddedIdRead,
      rtmpCapture12sEmbeddedIdRead: hlsRepeatability.rtmpCapture12sResult.embeddedIdRead,
      rtmpCapture15sEmbeddedIdRead: hlsRepeatability.rtmpCapture15sResult.embeddedIdRead,
      status: "diagnostic_only_inconsistent",
    },
    wrongIdRejected: true,
    noIdNoVault: true,
    candidateDoesNotOpenVault: true,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_DECISION_ROLE,
  };
}
