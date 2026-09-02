export const LIVE_CUSTOM_RTMP_TARGET_MOCK_DECISION_ROLE =
  "live_custom_rtmp_target_mock_support_only_no_real_push_no_vault_no_confirmed" as const;

export interface LiveCustomRtmpTargetMock {
  liveSessionId: string;
  targetId: string;
  targetType: "custom_rtmp_mock";
  targetName: "Custom RTMP Mock";
  ingestUrlPreview: "rtmp://custom.example.invalid/live/<redacted_stream_key>";
  streamKeyPresent: true;
  streamKeyValueExposed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  connectionStatusPreview: "mock_ready";
  healthStatusPreview: "mock_warning";
  retryPolicyPreview: "mock_retry_planned";
  failureReasonPreview: "custom_rtmp_requires_real_lab_validation";
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_CUSTOM_RTMP_TARGET_MOCK_DECISION_ROLE;
}

export function buildLiveCustomRtmpTargetMock(liveSessionId: string): LiveCustomRtmpTargetMock {
  return {
    liveSessionId,
    targetId: `custom_rtmp_target_mock_${liveSessionId}`,
    targetType: "custom_rtmp_mock",
    targetName: "Custom RTMP Mock",
    ingestUrlPreview: "rtmp://custom.example.invalid/live/<redacted_stream_key>",
    streamKeyPresent: true,
    streamKeyValueExposed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    connectionStatusPreview: "mock_ready",
    healthStatusPreview: "mock_warning",
    retryPolicyPreview: "mock_retry_planned",
    failureReasonPreview: "custom_rtmp_requires_real_lab_validation",
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_CUSTOM_RTMP_TARGET_MOCK_DECISION_ROLE,
  };
}
