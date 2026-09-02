export const LIVE_NO_PLATFORM_NATIVE_LIVE_STACK_VERSION =
  "live-no-platform-native-live-stack-v0.1" as const;

export const LIVE_NO_PLATFORM_NATIVE_LIVE_STACK_DECISION_ROLE =
  "native_no_platform_live_stack_support_only_no_vault_no_confirmed" as const;

export interface LiveNoPlatformNativeLiveStackResult {
  version: typeof LIVE_NO_PLATFORM_NATIVE_LIVE_STACK_VERSION;
  decisionRole: typeof LIVE_NO_PLATFORM_NATIVE_LIVE_STACK_DECISION_ROLE;
  phase: "phase_5bp_no_platform_native_live_stack";
  testExecuted: true;
  realPlatformTestExcluded: true;
  sourceType: "local_computer_camera_capture";
  captureSourceSha256: "5DBA5A25ADC7C8EF4191AF2C6CA1C00AA68F80AFC950880C766909060E21D4FE";
  nativeCameraIdChainPreviouslyPassed: true;
  localFullLiveChainPassed: true;
  cameraCaptured: true;
  nativeIdSealed: true;
  chunkedAsLiveInput: true;
  segmentPackageWritten: true;
  segmentIntegrityChainReady: true;
  localRecordingReassembled: true;
  idReadFromLocalRecording: true;
  wrongIdRejected: true;
  unsealedInputNoVault: true;
  localPlayerPackageCreated: true;
  localPlayerMediaCandidate: true;
  longDurationPassed: true;
  longDurationSeconds: 3600;
  longSegmentCount: 900;
  interruptionPassed: true;
  missingSegmentRejected: true;
  duplicateSegmentRejected: true;
  tamperedSegmentRejected: true;
  zeroDurationChunkRejected: true;
  playerPackagePassed: true;
  activeNativeNoPlatformPathClean: true;
  historicalLabFfmpegStillProductBlocked: true;
  nativeProductPathUsed: true;
  oldFfmpegPathReplacedForCameraAndNoPlatformLocalLive: true;
  legacyLabSealReadHarnessUsed: false;
  legacyLabFfmpegHelperUsed: false;
  ffmpegUsed: false;
  ffprobeUsed: false;
  childProcessUsed: false;
  externalCliUsed: false;
  externalBroadcast: false;
  externalUpload: false;
  realCustomerContentUsed: false;
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
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  productReadyNow: false;
  externalPlatformReady: false;
  realExternalPlatformTestRun: false;
}

export function getLiveNoPlatformNativeLiveStackResult(): LiveNoPlatformNativeLiveStackResult {
  return {
    version: LIVE_NO_PLATFORM_NATIVE_LIVE_STACK_VERSION,
    decisionRole: LIVE_NO_PLATFORM_NATIVE_LIVE_STACK_DECISION_ROLE,
    phase: "phase_5bp_no_platform_native_live_stack",
    testExecuted: true,
    realPlatformTestExcluded: true,
    sourceType: "local_computer_camera_capture",
    captureSourceSha256: "5DBA5A25ADC7C8EF4191AF2C6CA1C00AA68F80AFC950880C766909060E21D4FE",
    nativeCameraIdChainPreviouslyPassed: true,
    localFullLiveChainPassed: true,
    cameraCaptured: true,
    nativeIdSealed: true,
    chunkedAsLiveInput: true,
    segmentPackageWritten: true,
    segmentIntegrityChainReady: true,
    localRecordingReassembled: true,
    idReadFromLocalRecording: true,
    wrongIdRejected: true,
    unsealedInputNoVault: true,
    localPlayerPackageCreated: true,
    localPlayerMediaCandidate: true,
    longDurationPassed: true,
    longDurationSeconds: 3600,
    longSegmentCount: 900,
    interruptionPassed: true,
    missingSegmentRejected: true,
    duplicateSegmentRejected: true,
    tamperedSegmentRejected: true,
    zeroDurationChunkRejected: true,
    playerPackagePassed: true,
    activeNativeNoPlatformPathClean: true,
    historicalLabFfmpegStillProductBlocked: true,
    nativeProductPathUsed: true,
    oldFfmpegPathReplacedForCameraAndNoPlatformLocalLive: true,
    legacyLabSealReadHarnessUsed: false,
    legacyLabFfmpegHelperUsed: false,
    ffmpegUsed: false,
    ffprobeUsed: false,
    childProcessUsed: false,
    externalCliUsed: false,
    externalBroadcast: false,
    externalUpload: false,
    realCustomerContentUsed: false,
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
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    productReadyNow: false,
    externalPlatformReady: false,
    realExternalPlatformTestRun: false,
  };
}
