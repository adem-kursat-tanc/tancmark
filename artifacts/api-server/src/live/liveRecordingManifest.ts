import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_RECORDING_MANIFEST_DECISION_ROLE =
  "live_recording_manifest_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveRecordingManifest {
  liveSessionId: string;
  recordingId: string;
  vodAssetId: string;
  hlsManifestPreview: string;
  segmentCountPreview: number;
  durationSecondsPreview: number;
  segmentDurationSecondsPreview: number;
  retentionDaysPreview: 3 | 7;
  vodMp4Preview: string;
  thumbnailsPreview: string[];
  clipsPreview: string[];
  realRecordingCreated: false;
  realHlsSegmentsGenerated: false;
  realVodMp4Created: false;
  realMediaProcessed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_RECORDING_MANIFEST_DECISION_ROLE;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "mock_live";
}

export function buildLiveRecordingManifest(session: TancMarkLiveSession): LiveRecordingManifest {
  const liveSessionId = safeId(session.sessionId);
  const recordingId = `${liveSessionId}_recording_mock`;
  const vodAssetId = `${liveSessionId}_vod_mock`;
  const durationSecondsPreview = session.status === "stopped" ? 900 : 300;
  const segmentDurationSecondsPreview = 6;
  const segmentCountPreview = Math.ceil(durationSecondsPreview / segmentDurationSecondsPreview);

  return {
    liveSessionId,
    recordingId,
    vodAssetId,
    hlsManifestPreview: `mock://vod/${recordingId}/index.m3u8`,
    segmentCountPreview,
    durationSecondsPreview,
    segmentDurationSecondsPreview,
    retentionDaysPreview: session.recordingEnabled ? 7 : 3,
    vodMp4Preview: `mock://vod/${vodAssetId}/recording.mp4`,
    thumbnailsPreview: [`mock://vod/${vodAssetId}/thumbnail_001.jpg`, `mock://vod/${vodAssetId}/thumbnail_002.jpg`],
    clipsPreview: [`mock://vod/${vodAssetId}/clip_001.mp4`],
    realRecordingCreated: false,
    realHlsSegmentsGenerated: false,
    realVodMp4Created: false,
    realMediaProcessed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_RECORDING_MANIFEST_DECISION_ROLE,
  };
}
