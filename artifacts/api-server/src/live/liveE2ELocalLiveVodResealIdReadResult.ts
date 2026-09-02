export const LIVE_E2E_LOCAL_LIVE_VOD_RESEAL_IDREAD_DECISION_ROLE =
  "local_e2e_live_vod_reseal_idread_support_only_no_vault_no_confirmed" as const;

export interface LiveE2ELocalLiveVodResealIdReadResult {
  testExecuted: true;
  totalRuns: number;
  successfulRuns: number;
  mediaSource: "synthetic";
  targetType: "custom_rtmp";
  engine: "mediamtx";
  localhostOnly: true;
  rtmpPublishObserved: true;
  hlsManifestObserved: true;
  vodCaptureCreated: true;
  postLiveResealAttempted: true;
  postLiveResealSucceeded: true;
  idReadAttempted: true;
  embeddedIdRead: true;
  idMatchExpectedLabRecord: true;
  wrongIdRejected: true;
  unstampedInputNoVault: true;
  candidateDoesNotOpenVault: true;
  allPortsClosedAfterRuns: true;
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
  evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/e2e_chain/e2e_local_live_vod_reseal_idread_summary.json";
  decisionRole: typeof LIVE_E2E_LOCAL_LIVE_VOD_RESEAL_IDREAD_DECISION_ROLE;
}

export function getLiveE2ELocalLiveVodResealIdReadResult(): LiveE2ELocalLiveVodResealIdReadResult {
  return {
    testExecuted: true,
    totalRuns: 2,
    successfulRuns: 2,
    mediaSource: "synthetic",
    targetType: "custom_rtmp",
    engine: "mediamtx",
    localhostOnly: true,
    rtmpPublishObserved: true,
    hlsManifestObserved: true,
    vodCaptureCreated: true,
    postLiveResealAttempted: true,
    postLiveResealSucceeded: true,
    idReadAttempted: true,
    embeddedIdRead: true,
    idMatchExpectedLabRecord: true,
    wrongIdRejected: true,
    unstampedInputNoVault: true,
    candidateDoesNotOpenVault: true,
    allPortsClosedAfterRuns: true,
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
      "runtime/validation/live_actual_local_smoke/e2e_chain/e2e_local_live_vod_reseal_idread_summary.json",
    decisionRole: LIVE_E2E_LOCAL_LIVE_VOD_RESEAL_IDREAD_DECISION_ROLE,
  };
}
