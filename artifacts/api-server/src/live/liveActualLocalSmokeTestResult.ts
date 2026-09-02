export const LIVE_ACTUAL_LOCAL_SMOKE_TEST_RESULT_DECISION_ROLE =
  "live_actual_local_custom_rtmp_smoke_result_no_vault_no_confirmed" as const;

export interface LiveActualLocalSmokeTestResult {
  actualSmokeExecuted: true;
  targetType: "custom_rtmp";
  engine: "mediamtx";
  mediaSource: "synthetic";
  durationSeconds: 15;
  startedAtLocal: string;
  endedAtLocal: string;
  mediamtxStarted: true;
  ffmpegSyntheticStreamSent: true;
  rtmpPublishObserved: true;
  hlsManifestObserved: true;
  hlsManifestStatus: 200;
  hlsManifestBytes: 414;
  hlsVariantPlaylistObserved: true;
  hlsVariantUris: string[];
  hlsSegmentsObserved: true;
  localOnly: true;
  unexpectedPublicListenersObserved: false;
  rtmpUrl: "rtmp://127.0.0.1:1935/tancmark_custom_rtmp_smoke";
  hlsUrl: "http://127.0.0.1:8888/tancmark_custom_rtmp_smoke/index.m3u8";
  cleanup: {
    ffmpegStopped: true;
    mediamtxStopped: true;
    portsReleased: true;
    checkedPorts: number[];
  };
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
  logDirectory: "runtime/validation/live_actual_local_smoke";
  mediamtxLog: "runtime/validation/live_actual_local_smoke/mediamtx.log";
  mediamtxErrLog: "runtime/validation/live_actual_local_smoke/mediamtx.err.log";
  ffmpegOutLog: "runtime/validation/live_actual_local_smoke/ffmpeg.out.log";
  ffmpegErrLog: "runtime/validation/live_actual_local_smoke/ffmpeg.err.log";
  hlsMasterManifestLog: "runtime/validation/live_actual_local_smoke/hls_master.m3u8";
  hlsVariantManifestLog: "runtime/validation/live_actual_local_smoke/hls_variant_sample.m3u8";
  decisionRole: typeof LIVE_ACTUAL_LOCAL_SMOKE_TEST_RESULT_DECISION_ROLE;
}

export function getLiveActualLocalSmokeTestResult(): LiveActualLocalSmokeTestResult {
  return {
    actualSmokeExecuted: true,
    targetType: "custom_rtmp",
    engine: "mediamtx",
    mediaSource: "synthetic",
    durationSeconds: 15,
    startedAtLocal: "2026-06-20T15:05:06.7686848+03:00",
    endedAtLocal: "2026-06-20T15:05:28.1726144+03:00",
    mediamtxStarted: true,
    ffmpegSyntheticStreamSent: true,
    rtmpPublishObserved: true,
    hlsManifestObserved: true,
    hlsManifestStatus: 200,
    hlsManifestBytes: 414,
    hlsVariantPlaylistObserved: true,
    hlsVariantUris: [
      "audio2_stream.m3u8?session=54ddbf6e-54f3-4862-b801-de5e45724e8a",
      "video1_stream.m3u8?session=54ddbf6e-54f3-4862-b801-de5e45724e8a",
    ],
    hlsSegmentsObserved: true,
    localOnly: true,
    unexpectedPublicListenersObserved: false,
    rtmpUrl: "rtmp://127.0.0.1:1935/tancmark_custom_rtmp_smoke",
    hlsUrl: "http://127.0.0.1:8888/tancmark_custom_rtmp_smoke/index.m3u8",
    cleanup: {
      ffmpegStopped: true,
      mediamtxStopped: true,
      portsReleased: true,
      checkedPorts: [1935, 8888, 9997, 8554, 8892],
    },
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
    logDirectory: "runtime/validation/live_actual_local_smoke",
    mediamtxLog: "runtime/validation/live_actual_local_smoke/mediamtx.log",
    mediamtxErrLog: "runtime/validation/live_actual_local_smoke/mediamtx.err.log",
    ffmpegOutLog: "runtime/validation/live_actual_local_smoke/ffmpeg.out.log",
    ffmpegErrLog: "runtime/validation/live_actual_local_smoke/ffmpeg.err.log",
    hlsMasterManifestLog: "runtime/validation/live_actual_local_smoke/hls_master.m3u8",
    hlsVariantManifestLog: "runtime/validation/live_actual_local_smoke/hls_variant_sample.m3u8",
    decisionRole: LIVE_ACTUAL_LOCAL_SMOKE_TEST_RESULT_DECISION_ROLE,
  };
}
