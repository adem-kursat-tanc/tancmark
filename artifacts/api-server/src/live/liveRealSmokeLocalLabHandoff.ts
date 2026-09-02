import { buildLiveRealSmokeCustomRtmpLocalPlan } from "./liveRealSmokeCustomRtmpLocalPlan";
import { getLiveRealSmokeLocalLabPlan } from "./liveRealSmokeLocalLabPlan";
import { getLiveRealSmokeLocalPreflight } from "./liveRealSmokeLocalPreflight";

export const LIVE_REAL_SMOKE_LOCAL_LAB_HANDOFF_DECISION_ROLE =
  "live_real_smoke_local_lab_handoff_custom_rtmp_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeLocalLabHandoff {
  liveSessionId: string;
  localLabPlanSummary: ReturnType<typeof getLiveRealSmokeLocalLabPlan>;
  localPreflightSummary: ReturnType<typeof getLiveRealSmokeLocalPreflight>;
  customRtmpPlanSummary: ReturnType<typeof buildLiveRealSmokeCustomRtmpLocalPlan>;
  selectedEngine: "mediamtx";
  targetType: "custom_rtmp";
  readyForLocalLabSetup: true;
  readyForActualSmokeNow: false;
  humanOperatorRequired: true;
  actualSmokeExecuted: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  publicSocialTargetsEnabled: false;
  secretValuesAccepted: false;
  secretValuesLogged: false;
  billingCreditPaymentAdded: false;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_REAL_SMOKE_LOCAL_LAB_HANDOFF_DECISION_ROLE;
}

export function buildLiveRealSmokeLocalLabHandoff(liveSessionId: string): LiveRealSmokeLocalLabHandoff {
  return {
    liveSessionId,
    localLabPlanSummary: getLiveRealSmokeLocalLabPlan(),
    localPreflightSummary: getLiveRealSmokeLocalPreflight(),
    customRtmpPlanSummary: buildLiveRealSmokeCustomRtmpLocalPlan(liveSessionId),
    selectedEngine: "mediamtx",
    targetType: "custom_rtmp",
    readyForLocalLabSetup: true,
    readyForActualSmokeNow: false,
    humanOperatorRequired: true,
    actualSmokeExecuted: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    publicSocialTargetsEnabled: false,
    secretValuesAccepted: false,
    secretValuesLogged: false,
    billingCreditPaymentAdded: false,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_REAL_SMOKE_LOCAL_LAB_HANDOFF_DECISION_ROLE,
  };
}
