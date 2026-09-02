import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_HEALTH_SIGNAL_DECISION_ROLE =
  "live_health_signal_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveHealthSignalModel {
  liveSessionId: string;
  ingestBitratePreview: number;
  outputBitratePreview: number;
  latencyMsPreview: number;
  droppedFramesPreview: number;
  reconnectCountPreview: number;
  targetFailureCountPreview: number;
  recordingLagPreview: number;
  hlsSegmentDelayPreview: number;
  playerBufferingPreview: number;
  cpuUsagePreview: number;
  memoryUsagePreview: number;
  bandwidthUsagePreview: number;
  realMeasurement: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HEALTH_SIGNAL_DECISION_ROLE;
}

export function buildLiveHealthSignalModel(session: TancMarkLiveSession): LiveHealthSignalModel {
  const active = session.status === "mock_live";
  return {
    liveSessionId: session.sessionId,
    ingestBitratePreview: active ? 4500 : 0,
    outputBitratePreview: active ? 4200 : 0,
    latencyMsPreview: active ? 1800 : 0,
    droppedFramesPreview: active ? 12 : 0,
    reconnectCountPreview: active ? 1 : 0,
    targetFailureCountPreview: active ? 1 : 0,
    recordingLagPreview: session.recordingEnabled ? 2 : 0,
    hlsSegmentDelayPreview: active ? 1 : 0,
    playerBufferingPreview: active ? 3 : 0,
    cpuUsagePreview: active ? 42 : 0,
    memoryUsagePreview: active ? 512 : 0,
    bandwidthUsagePreview: active ? 6 : 0,
    realMeasurement: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HEALTH_SIGNAL_DECISION_ROLE,
  };
}
