export const LIVE_TWITCH_TARGET_MOCK_DECISION_ROLE =
  "live_twitch_target_mock_support_only_no_real_push_no_vault_no_confirmed" as const;

export interface LiveTwitchTargetMock {
  liveSessionId: string;
  targetId: string;
  targetType: "twitch_mock";
  targetName: "Twitch Mock";
  ingestUrlPreview: "rtmp://live.twitch.tv/app/<redacted_stream_key>";
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
  decisionRole: typeof LIVE_TWITCH_TARGET_MOCK_DECISION_ROLE;
}

export function buildLiveTwitchTargetMock(liveSessionId: string): LiveTwitchTargetMock {
  return {
    liveSessionId,
    targetId: `twitch_target_mock_${liveSessionId}`,
    targetType: "twitch_mock",
    targetName: "Twitch Mock",
    ingestUrlPreview: "rtmp://live.twitch.tv/app/<redacted_stream_key>",
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
    decisionRole: LIVE_TWITCH_TARGET_MOCK_DECISION_ROLE,
  };
}
