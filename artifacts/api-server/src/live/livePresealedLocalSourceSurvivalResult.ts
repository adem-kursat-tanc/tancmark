export const LIVE_PRESEALED_LOCAL_SOURCE_SURVIVAL_DECISION_ROLE =
  "local_presealed_source_survival_support_only_no_vault_no_confirmed" as const;

export interface LivePresealedLocalSourceSurvivalResult {
  testExecuted: true;
  sourceType: "synthetic_presealed_local_source";
  targetType: "custom_rtmp";
  engine: "mediamtx";
  localhostOnly: true;
  syntheticSourceCreated: true;
  preSealAttempted: true;
  preSealSucceeded: true;
  preSealedSourcePath: "runtime/validation/live_actual_local_smoke/presealed_source/presealed_source.mkv";
  rtmpPublishObserved: true;
  hlsManifestObserved: true;
  vodCaptureCreated: true;
  vodCapturePath: "runtime/validation/live_actual_local_smoke/presealed_source/live_pipeline_capture.mp4";
  idReadAttempted: true;
  embeddedIdRead: boolean;
  idReadBitsOrConfidence: {
    verdict: "VAULT" | "WEAK_SIGNAL" | "NOT_FOUND";
    channelAVerdict: "VAULT" | "WEAK_SIGNAL" | "NOT_FOUND";
    channelAIdMatched: boolean;
    channelBIdMatched: boolean;
    bothChannelsMatched: boolean;
    singleChannelMatched: boolean;
    finalConfirmedBy: "channel_a" | "channel_b" | "both" | "none";
    strongFrames: number;
    vaultFrames: number;
    weakFrames: number;
    anchorOnlyFrames: number;
    aggregatedVault: boolean;
    matchesPerAnchor: number[] | null;
    totalFramesAttempted: number;
    expectedPayload4Hex: string;
    wallMs: number;
  };
  idMatchExpectedLabRecord: boolean;
  wrongIdRejected: true;
  unstampedInputNoVault: true;
  candidateDoesNotOpenVault: true;
  allPortsClosedAfterTest: true;
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  billingCreditPaymentAdded: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/presealed_source/presealed_live_survival_summary.json";
  decisionRole: typeof LIVE_PRESEALED_LOCAL_SOURCE_SURVIVAL_DECISION_ROLE;
}

export function getLivePresealedLocalSourceSurvivalResult(): LivePresealedLocalSourceSurvivalResult {
  return {
    testExecuted: true,
    sourceType: "synthetic_presealed_local_source",
    targetType: "custom_rtmp",
    engine: "mediamtx",
    localhostOnly: true,
    syntheticSourceCreated: true,
    preSealAttempted: true,
    preSealSucceeded: true,
    preSealedSourcePath:
      "runtime/validation/live_actual_local_smoke/presealed_source/presealed_source.mkv",
    rtmpPublishObserved: true,
    hlsManifestObserved: true,
    vodCaptureCreated: true,
    vodCapturePath:
      "runtime/validation/live_actual_local_smoke/presealed_source/live_pipeline_capture.mp4",
    idReadAttempted: true,
    embeddedIdRead: false,
    idReadBitsOrConfidence: {
      verdict: "NOT_FOUND",
      channelAVerdict: "NOT_FOUND",
      channelAIdMatched: false,
      channelBIdMatched: false,
      bothChannelsMatched: false,
      singleChannelMatched: false,
      finalConfirmedBy: "none",
      strongFrames: 0,
      vaultFrames: 0,
      weakFrames: 0,
      anchorOnlyFrames: 0,
      aggregatedVault: false,
      matchesPerAnchor: [0, 0, 0, 0],
      totalFramesAttempted: 33,
      expectedPayload4Hex: "33163074",
      wallMs: 4328,
    },
    idMatchExpectedLabRecord: false,
    wrongIdRejected: true,
    unstampedInputNoVault: true,
    candidateDoesNotOpenVault: true,
    allPortsClosedAfterTest: true,
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    billingCreditPaymentAdded: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    evidenceSummaryPath:
      "runtime/validation/live_actual_local_smoke/presealed_source/presealed_live_survival_summary.json",
    decisionRole: LIVE_PRESEALED_LOCAL_SOURCE_SURVIVAL_DECISION_ROLE,
  };
}
