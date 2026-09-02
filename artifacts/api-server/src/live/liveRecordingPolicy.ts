export interface LiveRecordingPolicy {
  recordingPolicy: "mock_recording_policy_only";
  recordingEnabledDefault: boolean;
  retentionPlan: "short_retention_3_7_days_future";
  realRecordingEnabled: false;
  liveToVodReady: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLiveRecordingPolicy(recordingEnabled = false): LiveRecordingPolicy {
  return {
    recordingPolicy: "mock_recording_policy_only",
    recordingEnabledDefault: recordingEnabled,
    retentionPlan: "short_retention_3_7_days_future",
    realRecordingEnabled: false,
    liveToVodReady: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
