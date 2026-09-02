export const LIVE_ACTUAL_LOCAL_SMOKE_REPEATABILITY_RESULT_DECISION_ROLE =
  "live_actual_local_custom_rtmp_repeatability_result_no_vault_no_confirmed" as const;

export interface LiveActualLocalSmokeRepeatabilityResult {
  repeatabilityExecuted: true;
  targetType: "custom_rtmp";
  engine: "mediamtx";
  mediaSource: "synthetic";
  runDurationSeconds: 10;
  totalRuns: 3;
  successfulRuns: 3;
  failedRuns: 0;
  rtmpPublishObservedCount: 3;
  hlsManifestObservedCount: 3;
  hlsSegmentObservedCount: 3;
  allRunsLocalhostOnly: true;
  allRunsSyntheticOnly: true;
  allPortsClosedAfterRuns: true;
  unexpectedPublicListenersObserved: false;
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
  evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/repeatability_summary.json";
  runDirectories: string[];
  decisionRole: typeof LIVE_ACTUAL_LOCAL_SMOKE_REPEATABILITY_RESULT_DECISION_ROLE;
}

export function getLiveActualLocalSmokeRepeatabilityResult(): LiveActualLocalSmokeRepeatabilityResult {
  return {
    repeatabilityExecuted: true,
    targetType: "custom_rtmp",
    engine: "mediamtx",
    mediaSource: "synthetic",
    runDurationSeconds: 10,
    totalRuns: 3,
    successfulRuns: 3,
    failedRuns: 0,
    rtmpPublishObservedCount: 3,
    hlsManifestObservedCount: 3,
    hlsSegmentObservedCount: 3,
    allRunsLocalhostOnly: true,
    allRunsSyntheticOnly: true,
    allPortsClosedAfterRuns: true,
    unexpectedPublicListenersObserved: false,
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
    evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/repeatability_summary.json",
    runDirectories: [
      "runtime/validation/live_actual_local_smoke/repeatability/run1",
      "runtime/validation/live_actual_local_smoke/repeatability/run2",
      "runtime/validation/live_actual_local_smoke/repeatability/run3",
    ],
    decisionRole: LIVE_ACTUAL_LOCAL_SMOKE_REPEATABILITY_RESULT_DECISION_ROLE,
  };
}
