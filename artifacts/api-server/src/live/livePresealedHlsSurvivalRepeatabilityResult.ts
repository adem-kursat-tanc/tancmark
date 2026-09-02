export const LIVE_PRESEALED_HLS_SURVIVAL_REPEATABILITY_DECISION_ROLE =
  "presealed_hls_survival_repeatability_support_only_no_vault_no_confirmed" as const;

export interface LivePresealedHlsSurvivalRepeatabilityResult {
  diagnosticsExecuted: true;
  hlsTotalRuns: 3;
  hlsSuccessfulIdReads: 3;
  hlsExpectedIdMatches: 3;
  rtmpCapture4sResult: {
    embeddedIdRead: false;
    survivalVerdict: "NOT_FOUND";
    frameCount: 31;
    keyframeCount: 1;
  };
  rtmpCapture8sResult: {
    embeddedIdRead: true;
    survivalVerdict: "VAULT";
    frameCount: 89;
    keyframeCount: 1;
  };
  rtmpCapture12sResult: {
    embeddedIdRead: false;
    survivalVerdict: "NOT_FOUND";
    frameCount: 150;
    keyframeCount: 1;
  };
  rtmpCapture15sResult: {
    embeddedIdRead: false;
    survivalVerdict: "NOT_FOUND";
    frameCount: 194;
    keyframeCount: 1;
  };
  classification: string[];
  recommendedLiveEvidencePath: string;
  recommendedNextLabStep: string;
  wrongIdRejected: true;
  unstampedInputNoVault: true;
  evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/presealed_source/hls_survival_repeatability_rtmp_window_summary.json";
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  dbMigration: false;
  billingCreditPaymentAdded: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_PRESEALED_HLS_SURVIVAL_REPEATABILITY_DECISION_ROLE;
}

export function getLivePresealedHlsSurvivalRepeatabilityResult(): LivePresealedHlsSurvivalRepeatabilityResult {
  return {
    diagnosticsExecuted: true,
    hlsTotalRuns: 3,
    hlsSuccessfulIdReads: 3,
    hlsExpectedIdMatches: 3,
    rtmpCapture4sResult: {
      embeddedIdRead: false,
      survivalVerdict: "NOT_FOUND",
      frameCount: 31,
      keyframeCount: 1,
    },
    rtmpCapture8sResult: {
      embeddedIdRead: true,
      survivalVerdict: "VAULT",
      frameCount: 89,
      keyframeCount: 1,
    },
    rtmpCapture12sResult: {
      embeddedIdRead: false,
      survivalVerdict: "NOT_FOUND",
      frameCount: 150,
      keyframeCount: 1,
    },
    rtmpCapture15sResult: {
      embeddedIdRead: false,
      survivalVerdict: "NOT_FOUND",
      frameCount: 194,
      keyframeCount: 1,
    },
    classification: [
      "hls_capture_survives_repeatably",
      "rtmp_direct_capture_short_window_fails",
      "rtmp_direct_capture_longer_window_recovers",
      "rtmp_direct_capture_unreliable_for_id_read",
      "hls_capture_preferred_for_live_evidence",
      "timebase_gop_window_damage_confirmed",
    ],
    recommendedLiveEvidencePath:
      "hls_capture_preferred_for_live_evidence; keep post_live_reseal as safest confirmed local strategy",
    recommendedNextLabStep:
      "Use HLS capture for pre-sealed survival evidence in local lab; keep RTMP direct capture as diagnostic-only unless a longer-window matrix proves reliable.",
    wrongIdRejected: true,
    unstampedInputNoVault: true,
    evidenceSummaryPath:
      "runtime/validation/live_actual_local_smoke/presealed_source/hls_survival_repeatability_rtmp_window_summary.json",
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    dbMigration: false,
    billingCreditPaymentAdded: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_PRESEALED_HLS_SURVIVAL_REPEATABILITY_DECISION_ROLE,
  };
}
