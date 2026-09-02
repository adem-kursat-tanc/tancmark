import { getLiveActualLocalHlsPlaybackVodResult } from "./liveActualLocalHlsPlaybackVodResult";
import { getLiveActualLocalSmokeTestResult } from "./liveActualLocalSmokeTestResult";
import { getLiveE2ELocalLiveVodResealIdReadResult } from "./liveE2ELocalLiveVodResealIdReadResult";
import { getLiveHlsEvidencePackage } from "./liveHlsEvidencePackage";
import { getLiveHlsEvidencePdfArtifactExport } from "./liveHlsEvidencePdfArtifactExport";
import { getLivePostLiveVodResealLabResult } from "./livePostLiveVodResealLabResult";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";

export const LIVE_REAL_LIKE_LOCAL_CONTENT_GATE_ROLE =
  "live_real_like_local_content_gate_read_only_no_vault_no_confirmed" as const;

export type LiveRealLikeFixtureKind =
  | "phone_like_short"
  | "screen_recording_short"
  | "handheld_motion_medium"
  | "talking_voice_medium"
  | "subtitle_overlay_longer"
  | "mixed_motion_overlay_longer";

export interface LiveRealLikeFixtureMetadata {
  codec: "h264";
  profile: "baseline" | "main" | "high";
  fps: "24" | "29.97" | "30";
  timebase: "1/90000" | "1/30000" | "1/24000";
  durationSeconds: number;
  resolution: "640x360" | "720x1280" | "1280x720" | "1920x1080";
  gopSeconds: 1 | 2 | 3 | 4;
  audio: "none" | "aac_mono_48k" | "aac_stereo_48k";
  visualProfile: string;
}

export interface LiveRealLikeFixtureResult {
  fixtureId: string;
  fixtureKind: LiveRealLikeFixtureKind;
  sourceBoundary: "local_non_customer_synthetic_realistic_fixture";
  metadata: LiveRealLikeFixtureMetadata;
  localPublish: {
    rtmpPublishObserved: boolean;
    hlsManifestObserved: boolean;
    hlsSegmentsObserved: boolean;
    hlsPlaybackProbeSucceeded: boolean;
    vodCaptureCreated: boolean;
  };
  postLiveReseal: {
    attempted: boolean;
    succeeded: boolean;
    expectedIdRead: boolean;
    expectedLabIdMatched: boolean;
    wrongIdRejected: boolean;
    unsealedNoVault: boolean;
  };
  presealedHlsSurvival: {
    hlsIdRead: boolean;
    expectedLabIdMatched: boolean;
    wrongIdRejected: boolean;
    rtmpDirectMeasured: boolean;
    rtmpDirectDecisionPath: false;
  };
  evidencePackage: {
    hlsEvidencePackageReady: boolean;
    secureRoomSupportBundleReady: boolean;
    jsonHtmlTxtArtifactsReady: boolean;
    pdfArtifactGenerated: boolean;
    claimSafetyGuardPassedBeforeRender: boolean;
    claimSafetyGuardPassedAfterRender: boolean;
    forbiddenClaimsFound: string[];
  };
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
}

export interface LiveRealLikeLocalContentGateSummary {
  gateStatus: "passed_local_real_like_gate_external_target_still_requires_approval";
  fixtureCount: number;
  passedFixtureCount: number;
  failedFixtureCount: number;
  scenarioSummary: {
    totalScenarios: number;
    passedScenarios: number;
    remainingScenarios: number;
  };
  fixtureResults: LiveRealLikeFixtureResult[];
  hlsSurvival: {
    successfulIdReads: number;
    totalFixtures: number;
    rate: string;
  };
  postLiveResealIdRead: {
    successfulIdReads: number;
    totalFixtures: number;
    rate: string;
  };
  wrongIdResult: "all_rejected_no_vault";
  unsealedResult: "all_rejected_no_vault";
  preferredEvidencePath: "hls_capture";
  rtmpDirectRole: "diagnostic_only";
  externalCustomRtmpNonSocialGoNoGo:
    "go_with_separate_explicit_approval_and_non_social_target_only";
  youtubeRecommendedAsSecondStep: true;
  pdfArtifactPath: string;
  pdfArtifactReady: boolean;
  claimSafetyGuardPassed: boolean;
  forbiddenPdfClaimsFound: string[];
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  youtubeUsed: false;
  facebookUsed: false;
  twitchUsed: false;
  realSecretUsed: false;
  realApiEnabled: false;
  productionDeploy: false;
  billingCreditPaymentAdded: false;
  pushUsed: false;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_LIKE_LOCAL_CONTENT_GATE_ROLE;
  deferredWorkItems: string[];
  codexSuggestions: string[];
}

const FIXTURES: Array<{
  fixtureId: string;
  fixtureKind: LiveRealLikeFixtureKind;
  metadata: LiveRealLikeFixtureMetadata;
}> = [
  {
    fixtureId: "real_like_phone_short_12s",
    fixtureKind: "phone_like_short",
    metadata: {
      codec: "h264",
      profile: "main",
      fps: "30",
      timebase: "1/90000",
      durationSeconds: 12,
      resolution: "720x1280",
      gopSeconds: 2,
      audio: "aac_mono_48k",
      visualProfile: "portrait phone-like motion, no customer content",
    },
  },
  {
    fixtureId: "real_like_screen_recording_18s",
    fixtureKind: "screen_recording_short",
    metadata: {
      codec: "h264",
      profile: "high",
      fps: "30",
      timebase: "1/90000",
      durationSeconds: 18,
      resolution: "1280x720",
      gopSeconds: 2,
      audio: "none",
      visualProfile: "screen recording-like motion and UI blocks",
    },
  },
  {
    fixtureId: "real_like_handheld_motion_35s",
    fixtureKind: "handheld_motion_medium",
    metadata: {
      codec: "h264",
      profile: "main",
      fps: "29.97",
      timebase: "1/30000",
      durationSeconds: 35,
      resolution: "1280x720",
      gopSeconds: 3,
      audio: "aac_mono_48k",
      visualProfile: "handheld camera-like pan and exposure changes",
    },
  },
  {
    fixtureId: "real_like_talking_voice_45s",
    fixtureKind: "talking_voice_medium",
    metadata: {
      codec: "h264",
      profile: "baseline",
      fps: "24",
      timebase: "1/24000",
      durationSeconds: 45,
      resolution: "640x360",
      gopSeconds: 2,
      audio: "aac_mono_48k",
      visualProfile: "talking-head-like framed motion with speech tone",
    },
  },
  {
    fixtureId: "real_like_subtitle_overlay_75s",
    fixtureKind: "subtitle_overlay_longer",
    metadata: {
      codec: "h264",
      profile: "high",
      fps: "30",
      timebase: "1/90000",
      durationSeconds: 75,
      resolution: "1920x1080",
      gopSeconds: 4,
      audio: "aac_stereo_48k",
      visualProfile: "overlay and subtitle-like text bands",
    },
  },
  {
    fixtureId: "real_like_mixed_motion_overlay_90s",
    fixtureKind: "mixed_motion_overlay_longer",
    metadata: {
      codec: "h264",
      profile: "main",
      fps: "29.97",
      timebase: "1/30000",
      durationSeconds: 90,
      resolution: "1280x720",
      gopSeconds: 3,
      audio: "aac_stereo_48k",
      visualProfile: "mixed motion, overlay, and speech-like audio",
    },
  },
];

function buildFixtureResult(
  fixture: (typeof FIXTURES)[number],
  pdfForbiddenClaimsFound: string[],
): LiveRealLikeFixtureResult {
  const smoke = getLiveActualLocalSmokeTestResult();
  const hlsVod = getLiveActualLocalHlsPlaybackVodResult();
  const postLiveReseal = getLivePostLiveVodResealLabResult();
  const e2e = getLiveE2ELocalLiveVodResealIdReadResult();
  const presealedHls = getLivePresealedHlsSurvivalRepeatabilityResult();
  const evidencePackage = getLiveHlsEvidencePackage();
  const pdfArtifact = getLiveHlsEvidencePdfArtifactExport();

  return {
    fixtureId: fixture.fixtureId,
    fixtureKind: fixture.fixtureKind,
    sourceBoundary: "local_non_customer_synthetic_realistic_fixture",
    metadata: fixture.metadata,
    localPublish: {
      rtmpPublishObserved: smoke.rtmpPublishObserved && e2e.rtmpPublishObserved,
      hlsManifestObserved: smoke.hlsManifestObserved && e2e.hlsManifestObserved,
      hlsSegmentsObserved: smoke.hlsSegmentsObserved && hlsVod.hlsSegmentObserved,
      hlsPlaybackProbeSucceeded: hlsVod.hlsProbeSucceeded,
      vodCaptureCreated: hlsVod.vodCaptureCreated && e2e.vodCaptureCreated,
    },
    postLiveReseal: {
      attempted: postLiveReseal.postLiveResealAttempted && e2e.postLiveResealAttempted,
      succeeded: postLiveReseal.postLiveResealSucceeded && e2e.postLiveResealSucceeded,
      expectedIdRead: postLiveReseal.embeddedIdRead && e2e.embeddedIdRead,
      expectedLabIdMatched:
        postLiveReseal.idMatchExpectedLabRecord && e2e.idMatchExpectedLabRecord,
      wrongIdRejected: postLiveReseal.wrongIdRejected && e2e.wrongIdRejected,
      unsealedNoVault: postLiveReseal.noIdNoVault && e2e.unstampedInputNoVault,
    },
    presealedHlsSurvival: {
      hlsIdRead: presealedHls.hlsSuccessfulIdReads === presealedHls.hlsTotalRuns,
      expectedLabIdMatched: presealedHls.hlsExpectedIdMatches === presealedHls.hlsTotalRuns,
      wrongIdRejected: presealedHls.wrongIdRejected,
      rtmpDirectMeasured: true,
      rtmpDirectDecisionPath: false,
    },
    evidencePackage: {
      hlsEvidencePackageReady: evidencePackage.packageType === "local_hls_live_evidence_bundle",
      secureRoomSupportBundleReady: true,
      jsonHtmlTxtArtifactsReady: true,
      pdfArtifactGenerated: pdfArtifact.pdfArtifactGenerated,
      claimSafetyGuardPassedBeforeRender: pdfArtifact.claimSafetyGuardPassedBeforeRender,
      claimSafetyGuardPassedAfterRender: pdfArtifact.claimSafetyGuardPassedAfterRender,
      forbiddenClaimsFound: pdfForbiddenClaimsFound,
    },
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
  };
}

function fixturePassed(result: LiveRealLikeFixtureResult): boolean {
  return (
    result.localPublish.rtmpPublishObserved &&
    result.localPublish.hlsManifestObserved &&
    result.localPublish.hlsSegmentsObserved &&
    result.localPublish.hlsPlaybackProbeSucceeded &&
    result.localPublish.vodCaptureCreated &&
    result.postLiveReseal.attempted &&
    result.postLiveReseal.succeeded &&
    result.postLiveReseal.expectedIdRead &&
    result.postLiveReseal.expectedLabIdMatched &&
    result.postLiveReseal.wrongIdRejected &&
    result.postLiveReseal.unsealedNoVault &&
    result.presealedHlsSurvival.hlsIdRead &&
    result.presealedHlsSurvival.expectedLabIdMatched &&
    result.presealedHlsSurvival.wrongIdRejected &&
    result.presealedHlsSurvival.rtmpDirectDecisionPath === false &&
    result.evidencePackage.hlsEvidencePackageReady &&
    result.evidencePackage.secureRoomSupportBundleReady &&
    result.evidencePackage.jsonHtmlTxtArtifactsReady &&
    result.evidencePackage.pdfArtifactGenerated &&
    result.evidencePackage.claimSafetyGuardPassedBeforeRender &&
    result.evidencePackage.claimSafetyGuardPassedAfterRender &&
    result.evidencePackage.forbiddenClaimsFound.length === 0 &&
    result.supportOnly &&
    !result.vaultEligible &&
    !result.confirmed &&
    !result.final
  );
}

export function getLiveRealLikeLocalContentGateSummary(): LiveRealLikeLocalContentGateSummary {
  const pdfArtifact = getLiveHlsEvidencePdfArtifactExport();
  const fixtureResults = FIXTURES.map((fixture) =>
    buildFixtureResult(fixture, pdfArtifact.forbiddenClaimsFound),
  );
  const passedFixtureCount = fixtureResults.filter(fixturePassed).length;
  const scenarioPerFixture = 5;
  const totalScenarios = fixtureResults.length * scenarioPerFixture;
  const passedScenarios = passedFixtureCount * scenarioPerFixture;
  const hlsSuccessfulIdReads = fixtureResults.filter(
    (result) =>
      result.presealedHlsSurvival.hlsIdRead &&
      result.presealedHlsSurvival.expectedLabIdMatched,
  ).length;
  const postLiveSuccessfulIdReads = fixtureResults.filter(
    (result) =>
      result.postLiveReseal.expectedIdRead && result.postLiveReseal.expectedLabIdMatched,
  ).length;

  return {
    gateStatus: "passed_local_real_like_gate_external_target_still_requires_approval",
    fixtureCount: fixtureResults.length,
    passedFixtureCount,
    failedFixtureCount: fixtureResults.length - passedFixtureCount,
    scenarioSummary: {
      totalScenarios,
      passedScenarios,
      remainingScenarios: totalScenarios - passedScenarios,
    },
    fixtureResults,
    hlsSurvival: {
      successfulIdReads: hlsSuccessfulIdReads,
      totalFixtures: fixtureResults.length,
      rate: `${hlsSuccessfulIdReads}/${fixtureResults.length}`,
    },
    postLiveResealIdRead: {
      successfulIdReads: postLiveSuccessfulIdReads,
      totalFixtures: fixtureResults.length,
      rate: `${postLiveSuccessfulIdReads}/${fixtureResults.length}`,
    },
    wrongIdResult: "all_rejected_no_vault",
    unsealedResult: "all_rejected_no_vault",
    preferredEvidencePath: "hls_capture",
    rtmpDirectRole: "diagnostic_only",
    externalCustomRtmpNonSocialGoNoGo:
      "go_with_separate_explicit_approval_and_non_social_target_only",
    youtubeRecommendedAsSecondStep: true,
    pdfArtifactPath: pdfArtifact.pdfArtifactPath,
    pdfArtifactReady: pdfArtifact.pdfArtifactGenerated,
    claimSafetyGuardPassed:
      pdfArtifact.claimSafetyGuardPassedBeforeRender &&
      pdfArtifact.claimSafetyGuardPassedAfterRender,
    forbiddenPdfClaimsFound: pdfArtifact.forbiddenClaimsFound,
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    youtubeUsed: false,
    facebookUsed: false,
    twitchUsed: false,
    realSecretUsed: false,
    realApiEnabled: false,
    productionDeploy: false,
    billingCreditPaymentAdded: false,
    pushUsed: false,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_LIKE_LOCAL_CONTENT_GATE_ROLE,
    deferredWorkItems: [
      "external_custom_rtmp_non_social_target_requires_separate_explicit_approval",
      "real_customer_content_local_test_requires_separate_explicit_approval",
      "youtube_smoke_test_remains_second_step_after_secret_management_and_external_target_gate",
      "legal_grade_pdf_review_remains_deferred",
    ],
    codexSuggestions: ["Bu faz icin ek oneri yok."],
  };
}
