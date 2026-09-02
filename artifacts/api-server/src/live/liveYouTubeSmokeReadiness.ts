import { getLiveAccessPolicies } from "./liveAccessPolicy";
import { getLiveEngineConfigPolicy } from "./liveEngineConfigPolicy";
import { getLiveFfmpegExternalCliPolicy } from "./liveFfmpegExternalCliPolicy";
import { getLivePlayerPolicy } from "./livePlayerPolicy";
import { getLiveTargetCredentialPolicy } from "./liveTargetCredentialPolicy";
import { buildLiveYouTubeTargetMock } from "./liveYouTubeTargetMock";
import {
  LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE,
  getLiveSingleTargetSmokeReadiness,
  type LiveReadinessCheck,
} from "./liveSingleTargetSmokeReadiness";

export const LIVE_YOUTUBE_SMOKE_READINESS_DECISION_ROLE =
  "live_youtube_smoke_readiness_support_only_no_vault_no_confirmed" as const;

export interface LiveYouTubeSmokeReadiness {
  targetType: "youtube_mock";
  checklist: ReturnType<typeof getLiveSingleTargetSmokeReadiness>;
  targetMockPreview: ReturnType<typeof buildLiveYouTubeTargetMock>;
  credentialPolicy: ReturnType<typeof getLiveTargetCredentialPolicy>;
  engineConfigPolicy: ReturnType<typeof getLiveEngineConfigPolicy>;
  ffmpegPolicy: ReturnType<typeof getLiveFfmpegExternalCliPolicy>;
  accessPolicyCount: number;
  playerPolicy: ReturnType<typeof getLivePlayerPolicy>;
  readyForMockChecklist: true;
  readyForRealLab: false;
  humanApprovalRequiredBeforeRealLab: true;
  missingForRealLab: string[];
  checks: LiveReadinessCheck[];
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  realCredentialStored: false;
  realStreamKeyUsed: false;
  streamKeyValueExposed: false;
  realRtmpSrtWebRtcHlsTraffic: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  parentDecisionRole: typeof LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE;
  decisionRole: typeof LIVE_YOUTUBE_SMOKE_READINESS_DECISION_ROLE;
}

export function getLiveYouTubeSmokeReadiness(sessionId = "live-youtube-smoke-readiness-preview"): LiveYouTubeSmokeReadiness {
  const checklist = getLiveSingleTargetSmokeReadiness("youtube_mock");

  return {
    targetType: "youtube_mock",
    checklist,
    targetMockPreview: buildLiveYouTubeTargetMock(sessionId),
    credentialPolicy: getLiveTargetCredentialPolicy(),
    engineConfigPolicy: getLiveEngineConfigPolicy(),
    ffmpegPolicy: getLiveFfmpegExternalCliPolicy(),
    accessPolicyCount: getLiveAccessPolicies().length,
    playerPolicy: getLivePlayerPolicy(),
    readyForMockChecklist: true,
    readyForRealLab: false,
    humanApprovalRequiredBeforeRealLab: true,
    missingForRealLab: [
      "Gercek YouTube hesabi/yayin yetkisi",
      "Gercek OAuth/API akisi",
      "Secret manager icinde stream key saklama/rotasyon karari",
      "Tek hedef icin yayin ve geri alma plani",
      "Post-live ID okuma ve Secure Room delil lab plani",
    ],
    checks: checklist.checks,
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    realCredentialStored: false,
    realStreamKeyUsed: false,
    streamKeyValueExposed: false,
    realRtmpSrtWebRtcHlsTraffic: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    parentDecisionRole: LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE,
    decisionRole: LIVE_YOUTUBE_SMOKE_READINESS_DECISION_ROLE,
  };
}
