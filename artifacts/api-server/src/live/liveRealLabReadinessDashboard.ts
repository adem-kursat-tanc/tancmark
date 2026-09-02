import { getLiveAccessPolicies } from "./liveAccessPolicy";
import { getLiveDomainReferrerPolicy } from "./liveDomainReferrerPolicy";
import { buildLiveDnaOperatorLearningBridge } from "./liveDnaOperatorLearningBridge";
import { getLiveDnaSummary } from "./liveDna";
import { getLiveEngineCompatibilityMatrix } from "./liveEngineCompatibilityMatrix";
import { getLiveEngineConfigPolicy } from "./liveEngineConfigPolicy";
import { getLiveEventTypeDefinitions } from "./liveEventTypes";
import { getLiveFfmpegExternalCliPolicy } from "./liveFfmpegExternalCliPolicy";
import { getLivePlayerPolicy } from "./livePlayerPolicy";
import { getLivePlayerProviderMatrix } from "./livePlayerProviderMatrix";
import { getLivePostLiveResealPolicy } from "./livePostLiveResealPolicy";
import { getLivePreSmokeOperatorChecklist } from "./livePreSmokeOperatorChecklist";
import { getLiveRecordingPolicy } from "./liveRecordingPolicy";
import { buildLiveSecretRedactionDryRunForm } from "./liveSecretRedactionDryRunForm";
import { getLiveSingleTargetOperatorRunbook } from "./liveSingleTargetOperatorRunbook";
import { getLiveSmokeTestReadinessChecklist } from "./liveSmokeTestReadinessChecklist";
import { getLiveSmokeRollbackRunbook } from "./liveSmokeRollbackRunbook";
import { getLiveTargetCatalog } from "./liveTargetCatalog";
import { getLiveTargetCredentialPolicy } from "./liveTargetCredentialPolicy";
import { getLiveTargetFailurePolicy } from "./liveTargetFailurePolicy";
import { buildLiveWebhookPayloadPreviewCatalog } from "./liveWebhookPayloadPreview";
import { getLiveYouTubeSmokeReadiness } from "./liveYouTubeSmokeReadiness";
import { getLiveCustomRtmpSmokeReadiness } from "./liveCustomRtmpSmokeReadiness";
import { getSrsLiveAdapterCapabilities } from "./srsLiveAdapter";
import { getMediaMtxLiveAdapterCapabilities } from "./mediaMtxLiveAdapter";

export const LIVE_REAL_LAB_READINESS_DASHBOARD_DECISION_ROLE =
  "live_real_lab_readiness_dashboard_read_only_no_vault_no_confirmed" as const;

export interface LiveReadinessDashboardSecureRoomSummary {
  evidenceRole: "readiness_dashboard_preview_only";
  secureRoomHandoffAvailable: true;
  realEvidenceFromSmokeTest: false;
  realSecretStored: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  streamKeyValueExposed: false;
  tokenValueExposed: false;
  vaultEligible: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface LiveRealLabReadinessDashboard {
  panelName: "TancMark Live Real-Lab Readiness";
  overallStatus: "mock_ready_not_real_lab_allowed";
  warning: string;
  readyForMockReview: true;
  readyForRealSmoke: false;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  realSecretStored: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  realSmokeTestStarted: false;
  realSocialApiCalled: false;
  realTargetPushStarted: false;
  realPlayerLoaded: false;
  realStreamLoaded: false;
  realPlaybackEnabled: false;
  realFfmpegExecuted: false;
  realMediaProcessed: false;
  realWebhookSent: false;
  realDrmProviderConnected: false;
  billingCreditPaymentAdded: false;
  tokenValueExposed: false;
  streamKeyValueExposed: false;
  apiKeyValueExposed: false;
  oauthTokenValueExposed: false;
  signedUrlSecretExposed: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  operatorRunbookSummary: ReturnType<typeof getLiveSingleTargetOperatorRunbook>;
  secretRedactionSummary: ReturnType<typeof buildLiveSecretRedactionDryRunForm>;
  smokeChecklistSummary: ReturnType<typeof getLiveSmokeTestReadinessChecklist>;
  rollbackSummary: ReturnType<typeof getLiveSmokeRollbackRunbook>;
  youtubeReadinessSummary: ReturnType<typeof getLiveYouTubeSmokeReadiness>;
  customRtmpReadinessSummary: ReturnType<typeof getLiveCustomRtmpSmokeReadiness>;
  targetReadinessSummary: {
    targetCatalog: ReturnType<typeof getLiveTargetCatalog>;
    targetCredentialPolicy: ReturnType<typeof getLiveTargetCredentialPolicy>;
    targetFailurePolicy: ReturnType<typeof getLiveTargetFailurePolicy>;
    realApiEnabled: false;
    realPushEnabled: false;
    streamKeyValueExposed: false;
    supportOnly: true;
  };
  playerReadinessSummary: {
    playerPolicy: ReturnType<typeof getLivePlayerPolicy>;
    providerMatrix: ReturnType<typeof getLivePlayerProviderMatrix>;
    realPlayerLoaded: false;
    realStreamLoaded: false;
    realPlaybackEnabled: false;
    drmEnabled: false;
    supportOnly: true;
  };
  accessReadinessSummary: {
    accessPolicies: ReturnType<typeof getLiveAccessPolicies>;
    domainReferrerPolicy: ReturnType<typeof getLiveDomainReferrerPolicy>;
    tokenValueExposed: false;
    signedUrlSecretExposed: false;
    realAccessEnforced: false;
    realTokenGenerated: false;
    realSignedUrlGenerated: false;
    supportOnly: true;
  };
  eventHealthSummary: {
    eventTypeDefinitions: ReturnType<typeof getLiveEventTypeDefinitions>;
    webhookPayloadPreviews: ReturnType<typeof buildLiveWebhookPayloadPreviewCatalog>;
    realWebhookSent: false;
    realNetworkCall: false;
    supportOnly: true;
  };
  engineReadinessSummary: {
    engineConfigPolicy: ReturnType<typeof getLiveEngineConfigPolicy>;
    compatibilityMatrix: ReturnType<typeof getLiveEngineCompatibilityMatrix>;
    srsCapabilities: ReturnType<typeof getSrsLiveAdapterCapabilities>;
    mediaMtxCapabilities: ReturnType<typeof getMediaMtxLiveAdapterCapabilities>;
    realServerStarted: false;
    realConfigWritten: false;
    realPortsOpened: false;
    supportOnly: true;
  };
  ffmpegVodReadinessSummary: {
    ffmpegPolicy: ReturnType<typeof getLiveFfmpegExternalCliPolicy>;
    recordingPolicy: ReturnType<typeof getLiveRecordingPolicy>;
    postLiveResealPolicy: ReturnType<typeof getLivePostLiveResealPolicy>;
    realFfmpegExecuted: false;
    realMediaProcessed: false;
    supportOnly: true;
  };
  secureRoomSummary: LiveReadinessDashboardSecureRoomSummary;
  liveDnaLearningSummary: {
    liveDnaSummary: ReturnType<typeof getLiveDnaSummary>;
    operatorLearning: ReturnType<typeof buildLiveDnaOperatorLearningBridge>;
    autoRealSmokeStartEnabled: false;
    autoSecretAcceptEnabled: false;
    autoConfigDeployEnabled: false;
    autoApiConnectionEnabled: false;
    supportOnly: true;
  };
  supportOnly: true;
  canOpenVault: false;
  decisionRole: typeof LIVE_REAL_LAB_READINESS_DASHBOARD_DECISION_ROLE;
}

export function getLiveRealLabReadinessDashboard(): LiveRealLabReadinessDashboard {
  const operatorRunbookSummary = getLiveSingleTargetOperatorRunbook("youtube_mock");
  const secretRedactionSummary = buildLiveSecretRedactionDryRunForm({ targetType: "youtube_mock" });
  const smokeChecklistSummary = getLiveSmokeTestReadinessChecklist();
  const liveDnaOperatorLearning = buildLiveDnaOperatorLearningBridge({
    liveSessionId: "live_dashboard_readiness_preview",
    preSmokeChecklist: getLivePreSmokeOperatorChecklist("youtube_mock"),
    secretRedaction: secretRedactionSummary,
  });

  return {
    panelName: "TancMark Live Real-Lab Readiness",
    overallStatus: "mock_ready_not_real_lab_allowed",
    warning:
      "Bu ekran yalnizca hazirlik ve guvenlik kontrol panelidir. Gercek yayin, gercek secret, gercek API, gercek target push veya gercek smoke test baslatmaz.",
    readyForMockReview: true,
    readyForRealSmoke: false,
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    realSecretStored: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    realSmokeTestStarted: false,
    realSocialApiCalled: false,
    realTargetPushStarted: false,
    realPlayerLoaded: false,
    realStreamLoaded: false,
    realPlaybackEnabled: false,
    realFfmpegExecuted: false,
    realMediaProcessed: false,
    realWebhookSent: false,
    realDrmProviderConnected: false,
    billingCreditPaymentAdded: false,
    tokenValueExposed: false,
    streamKeyValueExposed: false,
    apiKeyValueExposed: false,
    oauthTokenValueExposed: false,
    signedUrlSecretExposed: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    operatorRunbookSummary,
    secretRedactionSummary,
    smokeChecklistSummary,
    rollbackSummary: getLiveSmokeRollbackRunbook(),
    youtubeReadinessSummary: getLiveYouTubeSmokeReadiness(),
    customRtmpReadinessSummary: getLiveCustomRtmpSmokeReadiness(),
    targetReadinessSummary: {
      targetCatalog: getLiveTargetCatalog(),
      targetCredentialPolicy: getLiveTargetCredentialPolicy(),
      targetFailurePolicy: getLiveTargetFailurePolicy(),
      realApiEnabled: false,
      realPushEnabled: false,
      streamKeyValueExposed: false,
      supportOnly: true,
    },
    playerReadinessSummary: {
      playerPolicy: getLivePlayerPolicy(),
      providerMatrix: getLivePlayerProviderMatrix(),
      realPlayerLoaded: false,
      realStreamLoaded: false,
      realPlaybackEnabled: false,
      drmEnabled: false,
      supportOnly: true,
    },
    accessReadinessSummary: {
      accessPolicies: getLiveAccessPolicies(),
      domainReferrerPolicy: getLiveDomainReferrerPolicy(),
      tokenValueExposed: false,
      signedUrlSecretExposed: false,
      realAccessEnforced: false,
      realTokenGenerated: false,
      realSignedUrlGenerated: false,
      supportOnly: true,
    },
    eventHealthSummary: {
      eventTypeDefinitions: getLiveEventTypeDefinitions(),
      webhookPayloadPreviews: buildLiveWebhookPayloadPreviewCatalog(),
      realWebhookSent: false,
      realNetworkCall: false,
      supportOnly: true,
    },
    engineReadinessSummary: {
      engineConfigPolicy: getLiveEngineConfigPolicy(),
      compatibilityMatrix: getLiveEngineCompatibilityMatrix(),
      srsCapabilities: getSrsLiveAdapterCapabilities(),
      mediaMtxCapabilities: getMediaMtxLiveAdapterCapabilities(),
      realServerStarted: false,
      realConfigWritten: false,
      realPortsOpened: false,
      supportOnly: true,
    },
    ffmpegVodReadinessSummary: {
      ffmpegPolicy: getLiveFfmpegExternalCliPolicy(),
      recordingPolicy: getLiveRecordingPolicy(true),
      postLiveResealPolicy: getLivePostLiveResealPolicy(),
      realFfmpegExecuted: false,
      realMediaProcessed: false,
      supportOnly: true,
    },
    secureRoomSummary: {
      evidenceRole: "readiness_dashboard_preview_only",
      secureRoomHandoffAvailable: true,
      realEvidenceFromSmokeTest: false,
      realSecretStored: false,
      realBroadcastStarted: false,
      realApiEnabled: false,
      realPushEnabled: false,
      streamKeyValueExposed: false,
      tokenValueExposed: false,
      vaultEligible: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    },
    liveDnaLearningSummary: {
      liveDnaSummary: getLiveDnaSummary(),
      operatorLearning: liveDnaOperatorLearning,
      autoRealSmokeStartEnabled: false,
      autoSecretAcceptEnabled: false,
      autoConfigDeployEnabled: false,
      autoApiConnectionEnabled: false,
      supportOnly: true,
    },
    supportOnly: true,
    canOpenVault: false,
    decisionRole: LIVE_REAL_LAB_READINESS_DASHBOARD_DECISION_ROLE,
  };
}
