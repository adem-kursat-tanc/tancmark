import { buildLiveHealthSignalModel, type LiveHealthSignalModel } from "./liveHealthSignalModel";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_HEALTH_MONITOR_MOCK_DECISION_ROLE =
  "live_health_monitor_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveHealthMonitorMock {
  liveSessionId: string;
  status: TancMarkLiveSession["status"];
  healthStatus: "mock_healthy" | "mock_warning" | "mock_stopped" | "mock_failed";
  signals: LiveHealthSignalModel;
  warnings: string[];
  realServerChecked: false;
  realBroadcastMeasured: false;
  realNetworkCall: false;
  realWebhookSent: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HEALTH_MONITOR_MOCK_DECISION_ROLE;
}

export function buildLiveHealthMonitorMock(session: TancMarkLiveSession): LiveHealthMonitorMock {
  const signals = buildLiveHealthSignalModel(session);
  const warnings: string[] = [];
  if (signals.latencyMsPreview > 1500) warnings.push("latency_high_preview");
  if (signals.targetFailureCountPreview > 0) warnings.push("target_failure_preview");
  if (signals.playerBufferingPreview > 0) warnings.push("player_buffering_preview");
  return {
    liveSessionId: session.sessionId,
    status: session.status,
    healthStatus:
      session.status === "failed"
        ? "mock_failed"
        : session.status === "stopped"
          ? "mock_stopped"
          : warnings.length > 0
            ? "mock_warning"
            : "mock_healthy",
    signals,
    warnings,
    realServerChecked: false,
    realBroadcastMeasured: false,
    realNetworkCall: false,
    realWebhookSent: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HEALTH_MONITOR_MOCK_DECISION_ROLE,
  };
}
