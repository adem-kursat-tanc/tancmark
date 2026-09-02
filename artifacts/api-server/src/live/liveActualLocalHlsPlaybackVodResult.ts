export const LIVE_ACTUAL_LOCAL_HLS_PLAYBACK_VOD_RESULT_DECISION_ROLE =
  "live_local_hls_playback_vod_smoke_support_only_no_vault_no_confirmed" as const;

export interface LiveActualLocalHlsPlaybackVodResult {
  testExecuted: true;
  targetType: "custom_rtmp";
  engine: "mediamtx";
  mediaSource: "synthetic";
  localhostOnly: true;
  rtmpPublishObserved: true;
  hlsManifestObserved: true;
  hlsSegmentObserved: true;
  hlsProbeSucceeded: true;
  hlsReadableByFfmpegOrFfprobe: true;
  codecMetadataObserved: true;
  vodCaptureCreated: true;
  vodCaptureSource: "local_rtmp_after_hls_probe";
  vodCapturePath: "runtime/validation/live_actual_local_smoke/vod_capture/local_smoke_capture.mp4";
  vodCaptureDurationSeconds: number;
  allPortsClosedAfterTest: true;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  realCustomerContentUsed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  billingCreditPaymentAdded: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/hls_playback_vod_summary.json";
  decisionRole: typeof LIVE_ACTUAL_LOCAL_HLS_PLAYBACK_VOD_RESULT_DECISION_ROLE;
}

export function getLiveActualLocalHlsPlaybackVodResult(): LiveActualLocalHlsPlaybackVodResult {
  return {
    testExecuted: true,
    targetType: "custom_rtmp",
    engine: "mediamtx",
    mediaSource: "synthetic",
    localhostOnly: true,
    rtmpPublishObserved: true,
    hlsManifestObserved: true,
    hlsSegmentObserved: true,
    hlsProbeSucceeded: true,
    hlsReadableByFfmpegOrFfprobe: true,
    codecMetadataObserved: true,
    vodCaptureCreated: true,
    vodCaptureSource: "local_rtmp_after_hls_probe",
    vodCapturePath: "runtime/validation/live_actual_local_smoke/vod_capture/local_smoke_capture.mp4",
    vodCaptureDurationSeconds: 4,
    allPortsClosedAfterTest: true,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    realCustomerContentUsed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    billingCreditPaymentAdded: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/hls_playback_vod_summary.json",
    decisionRole: LIVE_ACTUAL_LOCAL_HLS_PLAYBACK_VOD_RESULT_DECISION_ROLE,
  };
}
