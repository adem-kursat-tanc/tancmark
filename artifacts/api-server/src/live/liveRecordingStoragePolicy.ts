export const LIVE_RECORDING_STORAGE_POLICY_DECISION_ROLE =
  "live_recording_storage_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveRecordingStoragePolicy {
  shortRetentionTargetDays: readonly [3, 7];
  longArchiveEnabled: false;
  realRecordingEnabledThisPhase: false;
  recordingPathPreviewOnly: true;
  recordingPathPreview: string;
  rawPrivateContentStored: false;
  secureRoomReceivesMetadataOnly: true;
  secureRoomFileContentIncluded: false;
  realRecordingFutureAfterLab: true;
  realMediaProcessed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_RECORDING_STORAGE_POLICY_DECISION_ROLE;
}

export function getLiveRecordingStoragePolicy(): LiveRecordingStoragePolicy {
  return {
    shortRetentionTargetDays: [3, 7],
    longArchiveEnabled: false,
    realRecordingEnabledThisPhase: false,
    recordingPathPreviewOnly: true,
    recordingPathPreview: "mock://recordings/{provider}/{sessionId}/",
    rawPrivateContentStored: false,
    secureRoomReceivesMetadataOnly: true,
    secureRoomFileContentIncluded: false,
    realRecordingFutureAfterLab: true,
    realMediaProcessed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_RECORDING_STORAGE_POLICY_DECISION_ROLE,
  };
}
