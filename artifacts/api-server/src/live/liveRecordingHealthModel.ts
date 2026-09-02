import { buildLiveRecordingManifest } from "./liveRecordingManifest";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_RECORDING_HEALTH_DECISION_ROLE =
  "live_recording_health_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveRecordingHealthModel {
  liveSessionId: string;
  recordingStarted: boolean;
  segmentWritePreview: "mock_ok" | "mock_not_started";
  manifestReadyPreview: boolean;
  vodAssetReadyPreview: boolean;
  postLiveResealRecommended: true;
  recordingId: string;
  vodAssetId: string;
  realRecording: false;
  realMediaProcessed: false;
  realWebhookSent: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_RECORDING_HEALTH_DECISION_ROLE;
}

export function buildLiveRecordingHealthModel(session: TancMarkLiveSession): LiveRecordingHealthModel {
  const manifest = buildLiveRecordingManifest(session);
  const started = session.recordingEnabled && session.status !== "draft";
  return {
    liveSessionId: session.sessionId,
    recordingStarted: started,
    segmentWritePreview: started ? "mock_ok" : "mock_not_started",
    manifestReadyPreview: started,
    vodAssetReadyPreview: session.status === "stopped",
    postLiveResealRecommended: true,
    recordingId: manifest.recordingId,
    vodAssetId: manifest.vodAssetId,
    realRecording: false,
    realMediaProcessed: false,
    realWebhookSent: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_RECORDING_HEALTH_DECISION_ROLE,
  };
}
