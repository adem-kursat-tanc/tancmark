import { buildLiveDnaOperatorLearningBridge } from "./liveDnaOperatorLearningBridge";
import { getLivePreSmokeOperatorChecklist } from "./livePreSmokeOperatorChecklist";
import { getLiveRealSmokeApprovalGate } from "./liveRealSmokeApprovalGate";
import { buildLiveSecretRedactionDryRunForm } from "./liveSecretRedactionDryRunForm";
import { getLiveSingleTargetOperatorRunbook } from "./liveSingleTargetOperatorRunbook";
import { getLiveSmokeRollbackRunbook } from "./liveSmokeRollbackRunbook";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_OPERATOR_RUNBOOK_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_operator_runbook_secret_redaction_support_only_no_vault_no_confirmed" as const;

export interface LiveOperatorRunbookSecureRoomHandoff {
  liveSessionId: string;
  operatorRunbookSummary: ReturnType<typeof getLiveSingleTargetOperatorRunbook>;
  secretRedactionSummary: ReturnType<typeof buildLiveSecretRedactionDryRunForm>;
  preSmokeChecklistSummary: ReturnType<typeof getLivePreSmokeOperatorChecklist>;
  rollbackRunbookSummary: ReturnType<typeof getLiveSmokeRollbackRunbook>;
  realSmokeApprovalGateSummary: ReturnType<typeof getLiveRealSmokeApprovalGate>;
  liveDnaOperatorLearningSummary: ReturnType<typeof buildLiveDnaOperatorLearningBridge>;
  realSecretStored: false;
  realSmokeAllowed: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  streamKeyValueExposed: false;
  tokenValueExposed: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_OPERATOR_RUNBOOK_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveOperatorRunbookSecureRoomHandoff(
  session: TancMarkLiveSession,
  targetType?: unknown,
): LiveOperatorRunbookSecureRoomHandoff {
  const secretRedactionSummary = buildLiveSecretRedactionDryRunForm({ targetType });
  const preSmokeChecklistSummary = getLivePreSmokeOperatorChecklist(targetType);
  const liveDnaOperatorLearningSummary = buildLiveDnaOperatorLearningBridge({
    liveSessionId: session.sessionId,
    preSmokeChecklist: preSmokeChecklistSummary,
    secretRedaction: secretRedactionSummary,
  });

  return {
    liveSessionId: session.sessionId,
    operatorRunbookSummary: getLiveSingleTargetOperatorRunbook(targetType),
    secretRedactionSummary,
    preSmokeChecklistSummary,
    rollbackRunbookSummary: getLiveSmokeRollbackRunbook(),
    realSmokeApprovalGateSummary: getLiveRealSmokeApprovalGate(),
    liveDnaOperatorLearningSummary,
    realSecretStored: false,
    realSmokeAllowed: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    streamKeyValueExposed: false,
    tokenValueExposed: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_OPERATOR_RUNBOOK_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
