export const LIVE_LOCAL_CAMERA_CAPTURE_PROBE_VERSION =
  "live-local-camera-capture-probe-v0.1" as const;

export const LIVE_LOCAL_CAMERA_CAPTURE_PROBE_DECISION_ROLE =
  "live_local_camera_capture_probe_support_only_no_vault_no_confirmed" as const;

export interface LiveLocalCameraCaptureProbeResult {
  version: typeof LIVE_LOCAL_CAMERA_CAPTURE_PROBE_VERSION;
  decisionRole: typeof LIVE_LOCAL_CAMERA_CAPTURE_PROBE_DECISION_ROLE;
  testExecuted: true;
  captureSucceeded: true;
  sourceType: "local_computer_camera_browser_mediarecorder";
  detectedCameraDevices: readonly [
    "Integrated Camera",
    "AVer USB VCam",
  ];
  capturePath: "operator-data/TancMark_Camera_Test/local_camera_capture.webm";
  summaryPath: "operator-data/TancMark_Camera_Test/local_camera_capture_summary.json";
  rawCaptureCommittedToGit: false;
  localhostOnly: true;
  externalBroadcast: false;
  externalUpload: false;
  browserMediaRecorderUsed: true;
  browserMediaRecorderEncodedNewCameraCapture: true;
  reencodedExistingMedia: false;
  mimeType: "video/webm;codecs=vp9";
  sizeBytes: 49164;
  sha256: "5DBA5A25ADC7C8EF4191AF2C6CA1C00AA68F80AFC950880C766909060E21D4FE";
  headerHex: "1A45DFA39F4286810142F7810142F281";
  width: 1280;
  height: 720;
  durationMs: 4026;
  frameSampleCount: 16;
  frameVarianceObserved: true;
  productReadyNow: false;
  controlledLabEvidence: true;
  operatorLocalCameraContentUsed: true;
  realCustomerContentUsed: false;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchUsed: false;
  sourceModified: false;
  mediaPayloadModified: false;
  transcodesVideo: false;
  reencodesAudio: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
  dnaCanDecideAlone: false;
}

export function getLiveLocalCameraCaptureProbeResult(): LiveLocalCameraCaptureProbeResult {
  return {
    version: LIVE_LOCAL_CAMERA_CAPTURE_PROBE_VERSION,
    decisionRole: LIVE_LOCAL_CAMERA_CAPTURE_PROBE_DECISION_ROLE,
    testExecuted: true,
    captureSucceeded: true,
    sourceType: "local_computer_camera_browser_mediarecorder",
    detectedCameraDevices: [
      "Integrated Camera",
      "AVer USB VCam",
    ],
    capturePath: "operator-data/TancMark_Camera_Test/local_camera_capture.webm",
    summaryPath: "operator-data/TancMark_Camera_Test/local_camera_capture_summary.json",
    rawCaptureCommittedToGit: false,
    localhostOnly: true,
    externalBroadcast: false,
    externalUpload: false,
    browserMediaRecorderUsed: true,
    browserMediaRecorderEncodedNewCameraCapture: true,
    reencodedExistingMedia: false,
    mimeType: "video/webm;codecs=vp9",
    sizeBytes: 49164,
    sha256: "5DBA5A25ADC7C8EF4191AF2C6CA1C00AA68F80AFC950880C766909060E21D4FE",
    headerHex: "1A45DFA39F4286810142F7810142F281",
    width: 1280,
    height: 720,
    durationMs: 4026,
    frameSampleCount: 16,
    frameVarianceObserved: true,
    productReadyNow: false,
    controlledLabEvidence: true,
    operatorLocalCameraContentUsed: true,
    realCustomerContentUsed: false,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsed: false,
    sourceModified: false,
    mediaPayloadModified: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
  };
}
