export const LIVE_YOUTUBE_TARGET_MOCK_DECISION_ROLE =
  "live_youtube_target_mock_support_only_no_real_push_no_vault_no_confirmed" as const;

export interface LiveYouTubeTargetMock {
  liveSessionId: string;
  targetId: string;
  targetType: "youtube_mock";
  targetName: "YouTube Live Mock";
  ingestUrlPreview: "rtmp://a.rtmp.youtube.com/live2/<redacted_stream_key>";
  streamKeyPresent: true;
  streamKeyValueExposed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  connectionStatusPreview: "mock_ready";
  healthStatusPreview: "mock_healthy";
  retryPolicyPreview: "mock_retry_planned";
  failureReasonPreview: null;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_YOUTUBE_TARGET_MOCK_DECISION_ROLE;
}

export function buildLiveYouTubeTargetMock(liveSessionId: string): LiveYouTubeTargetMock {
  return {
    liveSessionId,
    targetId: `youtube_target_mock_${liveSessionId}`,
    targetType: "youtube_mock",
    targetName: "YouTube Live Mock",
    ingestUrlPreview: "rtmp://a.rtmp.youtube.com/live2/<redacted_stream_key>",
    streamKeyPresent: true,
    streamKeyValueExposed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    connectionStatusPreview: "mock_ready",
    healthStatusPreview: "mock_healthy",
    retryPolicyPreview: "mock_retry_planned",
    failureReasonPreview: null,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_YOUTUBE_TARGET_MOCK_DECISION_ROLE,
  };
}
