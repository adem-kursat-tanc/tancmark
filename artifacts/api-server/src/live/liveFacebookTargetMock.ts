export const LIVE_FACEBOOK_TARGET_MOCK_DECISION_ROLE =
  "live_facebook_target_mock_support_only_no_real_push_no_vault_no_confirmed" as const;

export interface LiveFacebookTargetMock {
  liveSessionId: string;
  targetId: string;
  targetType: "facebook_mock";
  targetName: "Facebook Live Mock";
  ingestUrlPreview: "rtmps://live-api-s.facebook.com:443/rtmp/<redacted_stream_key>";
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
  decisionRole: typeof LIVE_FACEBOOK_TARGET_MOCK_DECISION_ROLE;
}

export function buildLiveFacebookTargetMock(liveSessionId: string): LiveFacebookTargetMock {
  return {
    liveSessionId,
    targetId: `facebook_target_mock_${liveSessionId}`,
    targetType: "facebook_mock",
    targetName: "Facebook Live Mock",
    ingestUrlPreview: "rtmps://live-api-s.facebook.com:443/rtmp/<redacted_stream_key>",
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
    decisionRole: LIVE_FACEBOOK_TARGET_MOCK_DECISION_ROLE,
  };
}
