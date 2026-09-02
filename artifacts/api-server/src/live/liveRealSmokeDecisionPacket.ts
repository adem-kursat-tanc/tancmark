import {
  LIVE_REAL_SMOKE_NO_GO_DECISION,
  LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE,
  getLiveRealSmokeGoNoGoPolicy,
} from "./liveRealSmokeGoNoGoPolicy";
import { getLiveRealSmokePreflightChecklist } from "./liveRealSmokePreflightChecklist";
import { getLiveRealSmokeBlockerReport } from "./liveRealSmokeBlockerReport";
import { getLiveRealSmokeRequiredInputs } from "./liveRealSmokeRequiredInputs";
import { getLiveRealSmokeScenarioPlan } from "./liveRealSmokeScenarioPlan";
import { getLiveRealSmokeRollbackPlanPreview } from "./liveRealSmokeRollbackPlanPreview";

export const LIVE_REAL_SMOKE_DECISION_PACKET_DECISION_ROLE =
  "live_real_smoke_decision_packet_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeDecisionPacket {
  liveSessionId: string;
  packetStatus: "readonly_go_no_go_preview";
  goDecision: typeof LIVE_REAL_SMOKE_NO_GO_DECISION;
  recommendedFirstRealTarget: "custom_rtmp";
  youtubeRecommendedAsSecondStep: true;
  readyForMockReview: true;
  readyForRealSmoke: false;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  requiredApprovalPhrase: typeof LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE;
  approvalPhraseAcceptedNow: false;
  realSecretAcceptedNow: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  goNoGoPolicySummary: ReturnType<typeof getLiveRealSmokeGoNoGoPolicy>;
  preflightChecklistSummary: ReturnType<typeof getLiveRealSmokePreflightChecklist>;
  blockerReportSummary: ReturnType<typeof getLiveRealSmokeBlockerReport>;
  requiredInputsSummary: ReturnType<typeof getLiveRealSmokeRequiredInputs>;
  scenarioPlanSummary: ReturnType<typeof getLiveRealSmokeScenarioPlan>;
  rollbackPlanSummary: ReturnType<typeof getLiveRealSmokeRollbackPlanPreview>;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_REAL_SMOKE_DECISION_PACKET_DECISION_ROLE;
}

export function buildLiveRealSmokeDecisionPacket(liveSessionId: string): LiveRealSmokeDecisionPacket {
  return {
    liveSessionId,
    packetStatus: "readonly_go_no_go_preview",
    goDecision: LIVE_REAL_SMOKE_NO_GO_DECISION,
    recommendedFirstRealTarget: "custom_rtmp",
    youtubeRecommendedAsSecondStep: true,
    readyForMockReview: true,
    readyForRealSmoke: false,
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    requiredApprovalPhrase: LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE,
    approvalPhraseAcceptedNow: false,
    realSecretAcceptedNow: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    goNoGoPolicySummary: getLiveRealSmokeGoNoGoPolicy(),
    preflightChecklistSummary: getLiveRealSmokePreflightChecklist(),
    blockerReportSummary: getLiveRealSmokeBlockerReport(),
    requiredInputsSummary: getLiveRealSmokeRequiredInputs(),
    scenarioPlanSummary: getLiveRealSmokeScenarioPlan(),
    rollbackPlanSummary: getLiveRealSmokeRollbackPlanPreview(),
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_REAL_SMOKE_DECISION_PACKET_DECISION_ROLE,
  };
}
