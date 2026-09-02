import type { TancMarkLiveSession } from "./liveSessionModel";

export interface LiveHealthMonitorPlan {
  sessionId: string;
  status: TancMarkLiveSession["status"];
  healthStatus: "mock_healthy" | "mock_stopped" | "mock_failed";
  metricsPlanned: readonly string[];
  realServerChecked: false;
  realBroadcastChecked: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function buildLiveHealthMonitorPlan(session: TancMarkLiveSession): LiveHealthMonitorPlan {
  return {
    sessionId: session.sessionId,
    status: session.status,
    healthStatus:
      session.status === "failed" ? "mock_failed" : session.status === "stopped" ? "mock_stopped" : "mock_healthy",
    metricsPlanned: ["ingest_state", "target_state", "recording_state", "future_qoe"],
    realServerChecked: false,
    realBroadcastChecked: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
