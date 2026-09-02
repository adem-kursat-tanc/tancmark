export const LIVE_REAL_SMOKE_GO_NO_GO_DECISION_ROLE =
  "live_real_smoke_go_no_go_policy_support_only_no_vault_no_confirmed" as const;

export const LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE = "APPROVE_LIVE_REAL_SMOKE_TEST" as const;
export const LIVE_REAL_SMOKE_NO_GO_DECISION =
  "NO_GO_UNTIL_HUMAN_APPROVAL_AND_REAL_LAB_SETUP" as const;

export interface LiveRealSmokeGoNoGoPolicy {
  phase: "real_smoke_go_no_go_final_decision_packet";
  allowsRealSmokeNow: false;
  acceptsApprovalPhraseNow: false;
  requiredApprovalPhrase: typeof LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE;
  approvalPhraseFutureOnly: true;
  acceptsRealSecretNow: false;
  startsRealBroadcastNow: false;
  startsRealSmokeTestNow: false;
  realApiEnabled: false;
  realTargetPushEnabled: false;
  realPlayerStarted: false;
  realFfmpegExecuted: false;
  realServerStarted: false;
  goDecision: typeof LIVE_REAL_SMOKE_NO_GO_DECISION;
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_GO_NO_GO_DECISION_ROLE;
}

export function getLiveRealSmokeGoNoGoPolicy(): LiveRealSmokeGoNoGoPolicy {
  return {
    phase: "real_smoke_go_no_go_final_decision_packet",
    allowsRealSmokeNow: false,
    acceptsApprovalPhraseNow: false,
    requiredApprovalPhrase: LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE,
    approvalPhraseFutureOnly: true,
    acceptsRealSecretNow: false,
    startsRealBroadcastNow: false,
    startsRealSmokeTestNow: false,
    realApiEnabled: false,
    realTargetPushEnabled: false,
    realPlayerStarted: false,
    realFfmpegExecuted: false,
    realServerStarted: false,
    goDecision: LIVE_REAL_SMOKE_NO_GO_DECISION,
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_GO_NO_GO_DECISION_ROLE,
  };
}
