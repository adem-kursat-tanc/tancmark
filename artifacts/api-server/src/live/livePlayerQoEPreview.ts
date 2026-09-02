import type { LivePlayerProviderName } from "./livePlayerProviderMatrix";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_PLAYER_QOE_PREVIEW_DECISION_ROLE =
  "live_player_qoe_preview_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlayerQoEPreview {
  liveSessionId: string;
  startupTimeMsPreview: number;
  bufferingRatioPreview: number;
  droppedFramesPreview: number;
  playbackErrorCountPreview: number;
  averageBitratePreview: number;
  latencyMsPreview: number;
  playerProviderPreview: LivePlayerProviderName;
  networkQualityPreview: "mock_unknown" | "mock_good" | "mock_warning";
  unknownUntilRealLabMeasured: true;
  realMeasurement: false;
  realPlayerTelemetry: false;
  realViewerTracking: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PLAYER_QOE_PREVIEW_DECISION_ROLE;
}

export function buildLivePlayerQoEPreview(
  session: TancMarkLiveSession,
  providerInput?: unknown,
): LivePlayerQoEPreview {
  const active = session.status === "mock_live";
  const provider: LivePlayerProviderName = providerInput === "shaka" ? "shaka" : "videojs";
  return {
    liveSessionId: session.sessionId,
    startupTimeMsPreview: active ? 1200 : 0,
    bufferingRatioPreview: active ? 0.02 : 0,
    droppedFramesPreview: 0,
    playbackErrorCountPreview: active ? 1 : 0,
    averageBitratePreview: active ? 2800 : 0,
    latencyMsPreview: active ? 1800 : 0,
    playerProviderPreview: provider,
    networkQualityPreview: active ? "mock_good" : "mock_unknown",
    unknownUntilRealLabMeasured: true,
    realMeasurement: false,
    realPlayerTelemetry: false,
    realViewerTracking: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PLAYER_QOE_PREVIEW_DECISION_ROLE,
  };
}
