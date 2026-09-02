export const LIVE_LOCAL_CAMERA_CAPTURE_TO_ID_CHAIN_VERSION =
  "live-local-camera-native-id-chain-v0.2" as const;

export const LIVE_LOCAL_CAMERA_CAPTURE_TO_ID_CHAIN_DECISION_ROLE =
  "native_camera_capture_id_chain_exact_id_support_only_no_vault_no_confirmed" as const;

export interface LiveLocalCameraCaptureToIdChainResult {
  version: typeof LIVE_LOCAL_CAMERA_CAPTURE_TO_ID_CHAIN_VERSION;
  decisionRole: typeof LIVE_LOCAL_CAMERA_CAPTURE_TO_ID_CHAIN_DECISION_ROLE;
  phase: "phase_5bo_native_camera_capture_id_chain";
  testExecuted: true;
  sourceType: "local_computer_camera_capture";
  captureSourceSha256: "5DBA5A25ADC7C8EF4191AF2C6CA1C00AA68F80AFC950880C766909060E21D4FE";
  sourceIntact: true;
  nativeProductPathUsed: true;
  nativeCameraIdProductPathReady: true;
  oldFfmpegPathReplaced: true;
  legacyLabSealReadHarnessUsed: false;
  legacyLabFfmpegHelperUsed: false;
  ffmpegUsed: false;
  ffprobeUsed: false;
  childProcessUsed: false;
  externalCliUsed: false;
  postCaptureNativeSealAttempted: true;
  postCaptureNativeSealSucceeded: true;
  nativeEnvelopeEmbedded: true;
  idReadAttempted: true;
  exactIdRead: true;
  idMatchExpectedLabRecord: true;
  wrongIdRejected: true;
  unsealedInputNoVault: true;
  tamperRejected: true;
  mediaPayloadModified: false;
  sourceFileModified: false;
  reencodedExistingMedia: false;
  transcodesVideo: false;
  reencodesAudio: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
  dnaCanDecideAlone: false;
  localhostOnly: true;
  externalBroadcast: false;
  externalUpload: false;
  realCustomerContentUsed: false;
  operatorLocalCameraContentUsed: true;
  rawCameraCaptureCommittedToGit: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  fullLiveBroadcastProductReady: false;
  sealedOutputSha256: "41A8171D65469B58B6603B80F91D2526F2003CF8B9D031A96A8B6E35F74B62F1";
  payload4Hex: "6652F6D6";
  envelopeBytes: 1549;
}

export function getLiveLocalCameraCaptureToIdChainResult(): LiveLocalCameraCaptureToIdChainResult {
  return {
    version: LIVE_LOCAL_CAMERA_CAPTURE_TO_ID_CHAIN_VERSION,
    decisionRole: LIVE_LOCAL_CAMERA_CAPTURE_TO_ID_CHAIN_DECISION_ROLE,
    phase: "phase_5bo_native_camera_capture_id_chain",
    testExecuted: true,
    sourceType: "local_computer_camera_capture",
    captureSourceSha256: "5DBA5A25ADC7C8EF4191AF2C6CA1C00AA68F80AFC950880C766909060E21D4FE",
    sourceIntact: true,
    nativeProductPathUsed: true,
    nativeCameraIdProductPathReady: true,
    oldFfmpegPathReplaced: true,
    legacyLabSealReadHarnessUsed: false,
    legacyLabFfmpegHelperUsed: false,
    ffmpegUsed: false,
    ffprobeUsed: false,
    childProcessUsed: false,
    externalCliUsed: false,
    postCaptureNativeSealAttempted: true,
    postCaptureNativeSealSucceeded: true,
    nativeEnvelopeEmbedded: true,
    idReadAttempted: true,
    exactIdRead: true,
    idMatchExpectedLabRecord: true,
    wrongIdRejected: true,
    unsealedInputNoVault: true,
    tamperRejected: true,
    mediaPayloadModified: false,
    sourceFileModified: false,
    reencodedExistingMedia: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
    localhostOnly: true,
    externalBroadcast: false,
    externalUpload: false,
    realCustomerContentUsed: false,
    operatorLocalCameraContentUsed: true,
    rawCameraCaptureCommittedToGit: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    fullLiveBroadcastProductReady: false,
    sealedOutputSha256: "41A8171D65469B58B6603B80F91D2526F2003CF8B9D031A96A8B6E35F74B62F1",
    payload4Hex: "6652F6D6",
    envelopeBytes: 1549,
  };
}
