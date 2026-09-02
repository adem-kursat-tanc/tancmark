import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_QOE_SIGNAL_DECISION_ROLE =
  "live_qoe_signal_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveQoESignalPreview {
  liveSessionId: string;
  playerBufferingPreview: number;
  startupTimeMsPreview: number;
  playbackErrorCountPreview: number;
  averageLatencyMsPreview: number;
  realPlayerTelemetry: false;
  realViewerTracking: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_QOE_SIGNAL_DECISION_ROLE;
}

export function buildLiveQoESignalPreview(session: TancMarkLiveSession): LiveQoESignalPreview {
  const active = session.status === "mock_live";
  return {
    liveSessionId: session.sessionId,
    playerBufferingPreview: active ? 3 : 0,
    startupTimeMsPreview: active ? 900 : 0,
    playbackErrorCountPreview: active ? 1 : 0,
    averageLatencyMsPreview: active ? 1800 : 0,
    realPlayerTelemetry: false,
    realViewerTracking: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_QOE_SIGNAL_DECISION_ROLE,
  };
}
