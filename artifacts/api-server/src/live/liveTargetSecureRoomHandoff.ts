import { buildLiveDnaTargetLearningBridge } from "./liveDnaTargetLearningBridge";
import { getLiveTargetCatalog } from "./liveTargetCatalog";
import { getLiveTargetCredentialPolicy } from "./liveTargetCredentialPolicy";
import { buildLiveTargetEventBridge } from "./liveTargetEventBridge";
import { getLiveTargetFailurePolicy } from "./liveTargetFailurePolicy";
import { getLatestLiveSimulcastPlanMock } from "./liveSimulcastPlanMock";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_TARGET_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_target_routing_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetSecureRoomHandoff {
  liveSessionId: string;
  targetCatalogSummary: {
    targetCount: number;
    targets: ReturnType<typeof getLiveTargetCatalog>;
  };
  credentialPolicySummary: ReturnType<typeof getLiveTargetCredentialPolicy>;
  simulcastPlanSummary: ReturnType<typeof getLatestLiveSimulcastPlanMock>;
  targetEventSummary: ReturnType<typeof buildLiveTargetEventBridge>;
  targetFailurePolicySummary: ReturnType<typeof getLiveTargetFailurePolicy>;
  liveDnaTargetLearningSummary: ReturnType<typeof buildLiveDnaTargetLearningBridge>;
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  realCredentialStored: false;
  streamKeyValueExposed: false;
  tokenValueExposed: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_TARGET_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveTargetSecureRoomHandoff(session: TancMarkLiveSession): LiveTargetSecureRoomHandoff {
  const catalog = getLiveTargetCatalog();
  const simulcastPlan = getLatestLiveSimulcastPlanMock(session);
  const targetEventSummary = buildLiveTargetEventBridge(session.sessionId, simulcastPlan);
  const liveDnaTargetLearningSummary = buildLiveDnaTargetLearningBridge({
    liveSessionId: session.sessionId,
    targetEvents: targetEventSummary,
    simulcastPlan,
  });

  return {
    liveSessionId: session.sessionId,
    targetCatalogSummary: {
      targetCount: catalog.length,
      targets: catalog,
    },
    credentialPolicySummary: getLiveTargetCredentialPolicy(),
    simulcastPlanSummary: simulcastPlan,
    targetEventSummary,
    targetFailurePolicySummary: getLiveTargetFailurePolicy(),
    liveDnaTargetLearningSummary,
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    realCredentialStored: false,
    streamKeyValueExposed: false,
    tokenValueExposed: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_TARGET_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
