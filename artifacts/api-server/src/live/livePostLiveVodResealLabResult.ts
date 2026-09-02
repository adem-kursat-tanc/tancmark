export const LIVE_POST_LIVE_VOD_RESEAL_LAB_DECISION_ROLE =
  "local_post_live_vod_reseal_lab_support_only_no_vault_no_confirmed" as const;

export interface LivePostLiveVodResealLabResult {
  testExecuted: true;
  sourceType: "synthetic_local_capture";
  contentType: "video";
  source: "synthetic_local_capture";
  liveSessionId: "lab-live-local-session";
  clientId: "lab-live-local-client";
  docId: "lab-live-local-vod-doc";
  inputPath: "runtime/validation/live_actual_local_smoke/post_live_reseal/input_capture_copy.mp4";
  outputPath: "runtime/validation/live_actual_local_smoke/post_live_reseal/resealed_capture.mkv";
  requestedOutputPath: "runtime/validation/live_actual_local_smoke/post_live_reseal/resealed_capture.mp4";
  outputContainerNote: string;
  postLiveResealAttempted: true;
  postLiveResealSucceeded: true;
  idReadAttempted: true;
  embeddedIdRead: true;
  idReadBitsOrConfidence: {
    verdict: "VAULT";
    channelAVerdict: "VAULT";
    channelAIdMatched: true;
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
  idMatchExpectedLabRecord: true;
  wrongIdRejected: true;
  noIdNoVault: true;
  candidateDoesNotOpenVault: true;
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
  decisionRole: typeof LIVE_POST_LIVE_VOD_RESEAL_LAB_DECISION_ROLE;
  videoSealReadHarnessFound: true;
  partialOrAdvisoryResult: "exact_lab_read";
}

export function getLivePostLiveVodResealLabResult(): LivePostLiveVodResealLabResult {
  return {
    testExecuted: true,
    sourceType: "synthetic_local_capture",
    contentType: "video",
    source: "synthetic_local_capture",
    liveSessionId: "lab-live-local-session",
    clientId: "lab-live-local-client",
    docId: "lab-live-local-vod-doc",
    inputPath:
      "runtime/validation/live_actual_local_smoke/post_live_reseal/input_capture_copy.mp4",
    outputPath:
      "runtime/validation/live_actual_local_smoke/post_live_reseal/resealed_capture.mkv",
    requestedOutputPath:
      "runtime/validation/live_actual_local_smoke/post_live_reseal/resealed_capture.mp4",
    outputContainerNote:
      "Existing video encode route emits Matroska/FFV1 for stamped video; lab did not change core encode behavior to force MP4.",
    postLiveResealAttempted: true,
    postLiveResealSucceeded: true,
    idReadAttempted: true,
    embeddedIdRead: true,
    idReadBitsOrConfidence: {
      verdict: "VAULT",
      channelAVerdict: "VAULT",
      channelAIdMatched: true,
      channelBIdMatched: false,
      bothChannelsMatched: false,
      singleChannelMatched: true,
      finalConfirmedBy: "channel_a",
      strongFrames: 11,
      vaultFrames: 2,
      weakFrames: 0,
      anchorOnlyFrames: 9,
      aggregatedVault: false,
      matchesPerAnchor: null,
      totalFramesAttempted: 19,
      expectedPayload4Hex: "8161340a",
      wallMs: 2171,
    },
    idMatchExpectedLabRecord: true,
    wrongIdRejected: true,
    noIdNoVault: true,
    candidateDoesNotOpenVault: true,
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
    decisionRole: LIVE_POST_LIVE_VOD_RESEAL_LAB_DECISION_ROLE,
    videoSealReadHarnessFound: true,
    partialOrAdvisoryResult: "exact_lab_read",
  };
}
