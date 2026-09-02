export const LIVE_POST_LIVE_RESEAL_DECISION_ROLE =
  "live_post_live_reseal_policy_advisory_no_vault_no_confirmed" as const;

export interface LivePostLiveResealPolicy {
  policyName: "post_live_reseal_recommendation";
  livePreSealFutureLab: true;
  postLiveResealRecommended: true;
  recommendation:
    "recorded_vod_should_be_resealed_with_tancmark_after_live_session_before_distribution_when_user_approves";
  strongerOwnershipEvidence: true;
  ownershipPreSealRulePreserved: true;
  blockDifferentClientExactIdPreserved: true;
  postLiveResealCanOpenVaultByItself: false;
  finalDecisionRequiresRealIdReadAndRegistryMatch: true;
  realResealExecuted: false;
  tancmarkWatermarkApplied: false;
  tancmarkIdRead: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_POST_LIVE_RESEAL_DECISION_ROLE;
  rules: readonly string[];
}

export function getLivePostLiveResealPolicy(): LivePostLiveResealPolicy {
  return {
    policyName: "post_live_reseal_recommendation",
    livePreSealFutureLab: true,
    postLiveResealRecommended: true,
    recommendation:
      "recorded_vod_should_be_resealed_with_tancmark_after_live_session_before_distribution_when_user_approves",
    strongerOwnershipEvidence: true,
    ownershipPreSealRulePreserved: true,
    blockDifferentClientExactIdPreserved: true,
    postLiveResealCanOpenVaultByItself: false,
    finalDecisionRequiresRealIdReadAndRegistryMatch: true,
    realResealExecuted: false,
    tancmarkWatermarkApplied: false,
    tancmarkIdRead: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_POST_LIVE_RESEAL_DECISION_ROLE,
    rules: [
      "Canli yayin sirasinda genel pre-seal future lab'dadir.",
      "Yayin bittikten sonra kaydin tekrar TancMark ile muhurlenmesi onerilir.",
      "Post-live re-seal daha saglam sahiplik kaniti uretir.",
      "Re-seal oncesi ownership/pre-seal kurali korunur.",
      "Farkli client exact ID varsa blok kurali korunur.",
      "Post-live re-seal VAULT acmaz; sadece muhurleme akisi onerir.",
      "Final karar yine gercek ID okuma + sistem kaydi eslesmesiyle olur.",
    ],
  };
}
