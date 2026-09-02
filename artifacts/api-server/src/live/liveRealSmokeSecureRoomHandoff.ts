import { getLiveRealSmokeBlockerReport } from "./liveRealSmokeBlockerReport";
import { buildLiveRealSmokeDecisionPacket } from "./liveRealSmokeDecisionPacket";
import { getLiveRealSmokeGoNoGoPolicy } from "./liveRealSmokeGoNoGoPolicy";
import { getLiveRealSmokePreflightChecklist } from "./liveRealSmokePreflightChecklist";
import { getLiveRealSmokeRequiredInputs } from "./liveRealSmokeRequiredInputs";
import { getLiveRealSmokeRollbackPlanPreview } from "./liveRealSmokeRollbackPlanPreview";
import { getLiveRealSmokeScenarioPlan } from "./liveRealSmokeScenarioPlan";

export const LIVE_REAL_SMOKE_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_real_smoke_go_no_go_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeSecureRoomHandoff {
  liveSessionId: string;
  goNoGoPolicySummary: ReturnType<typeof getLiveRealSmokeGoNoGoPolicy>;
  preflightChecklistSummary: ReturnType<typeof getLiveRealSmokePreflightChecklist>;
  blockerReportSummary: ReturnType<typeof getLiveRealSmokeBlockerReport>;
  requiredInputsSummary: ReturnType<typeof getLiveRealSmokeRequiredInputs>;
  scenarioPlanSummary: ReturnType<typeof getLiveRealSmokeScenarioPlan>;
  rollbackPlanSummary: ReturnType<typeof getLiveRealSmokeRollbackPlanPreview>;
  decisionPacketSummary: ReturnType<typeof buildLiveRealSmokeDecisionPacket>;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  realSecretStored: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_REAL_SMOKE_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveRealSmokeSecureRoomHandoff(liveSessionId: string): LiveRealSmokeSecureRoomHandoff {
  return {
    liveSessionId,
    goNoGoPolicySummary: getLiveRealSmokeGoNoGoPolicy(),
    preflightChecklistSummary: getLiveRealSmokePreflightChecklist(),
    blockerReportSummary: getLiveRealSmokeBlockerReport(),
    requiredInputsSummary: getLiveRealSmokeRequiredInputs(),
    scenarioPlanSummary: getLiveRealSmokeScenarioPlan(),
    rollbackPlanSummary: getLiveRealSmokeRollbackPlanPreview(),
    decisionPacketSummary: buildLiveRealSmokeDecisionPacket(liveSessionId),
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    realSecretStored: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_REAL_SMOKE_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
