import { getLiveActualLocalHlsPlaybackVodResult } from "./liveActualLocalHlsPlaybackVodResult";
import { getLiveActualLocalSmokeRepeatabilityResult } from "./liveActualLocalSmokeRepeatabilityResult";
import { getLiveActualLocalSmokeTestResult } from "./liveActualLocalSmokeTestResult";
import { getLiveE2ELocalLiveVodResealIdReadResult } from "./liveE2ELocalLiveVodResealIdReadResult";
import { getLiveHlsEvidencePackage } from "./liveHlsEvidencePackage";
import { getLiveHlsEvidencePdfArtifactExport } from "./liveHlsEvidencePdfArtifactExport";
import { getLivePostLiveVodResealLabResult } from "./livePostLiveVodResealLabResult";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";

export const LIVE_LOCAL_LAB_COMPLETION_SUMMARY_ROLE =
  "live_local_lab_completion_summary_read_only_no_vault_no_confirmed" as const;

export interface LiveLocalLabCompletionSummary {
  completionStatus: "local_lab_technically_passed_external_test_gate_required";
  localLabPassed: boolean;
  localSmokePassed: boolean;
  repeatabilityPassed: boolean;
  hlsPlaybackPassed: boolean;
  vodCapturePassed: boolean;
  postLiveResealPassed: boolean;
  e2eChainPassed: boolean;
  presealedHlsSurvivalPassed: boolean;
  hlsEvidencePackageReady: boolean;
  pdfArtifactReady: boolean;
  preferredEvidencePath: "hls_capture";
  rtmpDirectRole: "diagnostic_only";
  postLiveResealRole: "safest_local_reseal_strategy";
  nextRecommendedGate:
    "external_custom_rtmp_non_social_target_or_real_customer_content_local_test_with_explicit_approval";
  youtubeRecommendedAsSecondStep: true;
  socialPlatformTestsBlockedUntilExternalTargetAndSecretManagementReady: true;
  realBroadcastStarted: false;
  realApiCalled: false;
  realSecretAccepted: false;
  realExternalTargetPush: false;
  realCustomerContentUsed: false;
  dbMigration: false;
  billingCreditPaymentAdded: false;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_LOCAL_LAB_COMPLETION_SUMMARY_ROLE;
}

export function getLiveLocalLabCompletionSummary(): LiveLocalLabCompletionSummary {
  const smoke = getLiveActualLocalSmokeTestResult();
  const repeatability = getLiveActualLocalSmokeRepeatabilityResult();
  const hlsVod = getLiveActualLocalHlsPlaybackVodResult();
  const postLiveReseal = getLivePostLiveVodResealLabResult();
  const e2e = getLiveE2ELocalLiveVodResealIdReadResult();
  const presealedHls = getLivePresealedHlsSurvivalRepeatabilityResult();
  const hlsEvidencePackage = getLiveHlsEvidencePackage();
  const pdfArtifact = getLiveHlsEvidencePdfArtifactExport();

  const localSmokePassed =
    smoke.actualSmokeExecuted &&
    smoke.rtmpPublishObserved &&
    smoke.hlsManifestObserved &&
    smoke.hlsSegmentsObserved &&
    smoke.localOnly;
  const repeatabilityPassed =
    repeatability.repeatabilityExecuted &&
    repeatability.totalRuns === 3 &&
    repeatability.successfulRuns === 3 &&
    repeatability.allRunsLocalhostOnly &&
    repeatability.allRunsSyntheticOnly;
  const hlsPlaybackPassed =
    hlsVod.testExecuted &&
    hlsVod.hlsProbeSucceeded &&
    hlsVod.hlsReadableByFfmpegOrFfprobe &&
    hlsVod.codecMetadataObserved;
  const vodCapturePassed = hlsVod.vodCaptureCreated && hlsVod.vodCaptureDurationSeconds > 0;
  const postLiveResealPassed =
    postLiveReseal.testExecuted &&
    postLiveReseal.postLiveResealSucceeded &&
    postLiveReseal.embeddedIdRead &&
    postLiveReseal.idMatchExpectedLabRecord;
  const e2eChainPassed =
    e2e.testExecuted &&
    e2e.totalRuns === 2 &&
    e2e.successfulRuns === 2 &&
    e2e.postLiveResealSucceeded &&
    e2e.embeddedIdRead &&
    e2e.idMatchExpectedLabRecord;
  const presealedHlsSurvivalPassed =
    presealedHls.diagnosticsExecuted &&
    presealedHls.hlsTotalRuns === 3 &&
    presealedHls.hlsSuccessfulIdReads === 3 &&
    presealedHls.hlsExpectedIdMatches === 3;
  const hlsEvidencePackageReady =
    hlsEvidencePackage.packageType === "local_hls_live_evidence_bundle" &&
    hlsEvidencePackage.preferredLiveEvidencePath === "hls_capture" &&
    hlsEvidencePackage.rtmpDirectCaptureRole === "diagnostic_only";
  const pdfArtifactReady =
    pdfArtifact.pdfArtifactGenerated &&
    pdfArtifact.usedDedicatedTemplate &&
    pdfArtifact.claimSafetyGuardPassedBeforeRender &&
    pdfArtifact.claimSafetyGuardPassedAfterRender &&
    pdfArtifact.requiredWarningsPresent &&
    pdfArtifact.forbiddenClaimsFound.length === 0;

  return {
    completionStatus: "local_lab_technically_passed_external_test_gate_required",
    localLabPassed:
      localSmokePassed &&
      repeatabilityPassed &&
      hlsPlaybackPassed &&
      vodCapturePassed &&
      postLiveResealPassed &&
      e2eChainPassed &&
      presealedHlsSurvivalPassed &&
      hlsEvidencePackageReady &&
      pdfArtifactReady,
    localSmokePassed,
    repeatabilityPassed,
    hlsPlaybackPassed,
    vodCapturePassed,
    postLiveResealPassed,
    e2eChainPassed,
    presealedHlsSurvivalPassed,
    hlsEvidencePackageReady,
    pdfArtifactReady,
    preferredEvidencePath: "hls_capture",
    rtmpDirectRole: "diagnostic_only",
    postLiveResealRole: "safest_local_reseal_strategy",
    nextRecommendedGate:
      "external_custom_rtmp_non_social_target_or_real_customer_content_local_test_with_explicit_approval",
    youtubeRecommendedAsSecondStep: true,
    socialPlatformTestsBlockedUntilExternalTargetAndSecretManagementReady: true,
    realBroadcastStarted: false,
    realApiCalled: false,
    realSecretAccepted: false,
    realExternalTargetPush: false,
    realCustomerContentUsed: false,
    dbMigration: false,
    billingCreditPaymentAdded: false,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_LOCAL_LAB_COMPLETION_SUMMARY_ROLE,
  };
}
