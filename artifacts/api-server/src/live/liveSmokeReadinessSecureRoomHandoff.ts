import { getLiveCustomRtmpSmokeReadiness } from "./liveCustomRtmpSmokeReadiness";
import { getLiveRealLabGateSummary } from "./liveRealLabGateSummary";
import { getLiveSmokeReadinessRiskReport } from "./liveSmokeReadinessRiskReport";
import { getLiveSmokeTestReadinessChecklist } from "./liveSmokeTestReadinessChecklist";
import { getLiveYouTubeSmokeReadiness } from "./liveYouTubeSmokeReadiness";
import { parseLiveSmokeTargetType, type LiveSingleTargetSmokeTargetType } from "./liveSingleTargetSmokeReadiness";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_SMOKE_READINESS_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_smoke_readiness_secure_room_handoff_support_only_no_vault_no_confirmed" as const;

export interface LiveSmokeReadinessSecureRoomHandoff {
  liveSessionId: string;
  targetType: LiveSingleTargetSmokeTargetType;
  readinessSummary: ReturnType<typeof getLiveYouTubeSmokeReadiness> | ReturnType<typeof getLiveCustomRtmpSmokeReadiness>;
  checklistSummary: ReturnType<typeof getLiveSmokeTestReadinessChecklist>;
  realLabGateSummary: ReturnType<typeof getLiveRealLabGateSummary>;
  riskReportSummary: ReturnType<typeof getLiveSmokeReadinessRiskReport>;
  secureRoomEvidenceRole: "readiness_handoff_only";
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  realCredentialStored: false;
  realStreamKeyUsed: false;
  streamKeyValueExposed: false;
  tokenValueExposed: false;
  realRtmpSrtWebRtcHlsTraffic: false;
  realServerStarted: false;
  realPlayerLoaded: false;
  realFfmpegExecuted: false;
  realWebhookSent: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_SMOKE_READINESS_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveSmokeReadinessSecureRoomHandoff(
  session: TancMarkLiveSession,
  targetTypeInput?: unknown,
): LiveSmokeReadinessSecureRoomHandoff {
  const targetType = parseLiveSmokeTargetType(targetTypeInput);
  const readinessSummary =
    targetType === "custom_rtmp_mock"
      ? getLiveCustomRtmpSmokeReadiness(session.sessionId)
      : getLiveYouTubeSmokeReadiness(session.sessionId);

  return {
    liveSessionId: session.sessionId,
    targetType,
    readinessSummary,
    checklistSummary: getLiveSmokeTestReadinessChecklist(),
    realLabGateSummary: getLiveRealLabGateSummary(),
    riskReportSummary: getLiveSmokeReadinessRiskReport(),
    secureRoomEvidenceRole: "readiness_handoff_only",
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    realCredentialStored: false,
    realStreamKeyUsed: false,
    streamKeyValueExposed: false,
    tokenValueExposed: false,
    realRtmpSrtWebRtcHlsTraffic: false,
    realServerStarted: false,
    realPlayerLoaded: false,
    realFfmpegExecuted: false,
    realWebhookSent: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_SMOKE_READINESS_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
