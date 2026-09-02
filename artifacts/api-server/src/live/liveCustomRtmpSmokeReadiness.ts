import { getLiveEngineConfigPolicy } from "./liveEngineConfigPolicy";
import { getLiveFfmpegExternalCliPolicy } from "./liveFfmpegExternalCliPolicy";
import { buildLiveCustomRtmpTargetMock } from "./liveCustomRtmpTargetMock";
import { getLivePlayerPolicy } from "./livePlayerPolicy";
import { getLiveTargetCredentialPolicy } from "./liveTargetCredentialPolicy";
import {
  LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE,
  getLiveSingleTargetSmokeReadiness,
  type LiveReadinessCheck,
} from "./liveSingleTargetSmokeReadiness";

export const LIVE_CUSTOM_RTMP_SMOKE_READINESS_DECISION_ROLE =
  "live_custom_rtmp_smoke_readiness_support_only_no_vault_no_confirmed" as const;

export interface LiveCustomRtmpSmokeReadiness {
  targetType: "custom_rtmp_mock";
  checklist: ReturnType<typeof getLiveSingleTargetSmokeReadiness>;
  targetMockPreview: ReturnType<typeof buildLiveCustomRtmpTargetMock>;
  credentialPolicy: ReturnType<typeof getLiveTargetCredentialPolicy>;
  engineConfigPolicy: ReturnType<typeof getLiveEngineConfigPolicy>;
  ffmpegPolicy: ReturnType<typeof getLiveFfmpegExternalCliPolicy>;
  playerPolicy: ReturnType<typeof getLivePlayerPolicy>;
  readyForMockChecklist: true;
  readyForRealLab: false;
  riskLevel: "high";
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
  decisionRole: typeof LIVE_CUSTOM_RTMP_SMOKE_READINESS_DECISION_ROLE;
}

export function getLiveCustomRtmpSmokeReadiness(
  sessionId = "live-custom-rtmp-smoke-readiness-preview",
): LiveCustomRtmpSmokeReadiness {
  const checklist = getLiveSingleTargetSmokeReadiness("custom_rtmp_mock");

  return {
    targetType: "custom_rtmp_mock",
    checklist,
    targetMockPreview: buildLiveCustomRtmpTargetMock(sessionId),
    credentialPolicy: getLiveTargetCredentialPolicy(),
    engineConfigPolicy: getLiveEngineConfigPolicy(),
    ffmpegPolicy: getLiveFfmpegExternalCliPolicy(),
    playerPolicy: getLivePlayerPolicy(),
    readyForMockChecklist: true,
    readyForRealLab: false,
    riskLevel: "high",
    humanApprovalRequiredBeforeRealLab: true,
    missingForRealLab: [
      "Gercek RTMP endpoint sahibi ve platform politikasi",
      "Gercek stream key icin secret management",
      "SRS/MediaMTX/FFmpeg real lab kurulumu",
      "Yayin kabul, reconnect, rate-limit ve rollback olcumu",
      "Yayin sonrasi TancMark ID okuma matrisi",
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
    decisionRole: LIVE_CUSTOM_RTMP_SMOKE_READINESS_DECISION_ROLE,
  };
}
