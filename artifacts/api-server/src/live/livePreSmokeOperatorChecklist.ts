import { getLiveRealSmokeApprovalGate } from "./liveRealSmokeApprovalGate";
import { getLiveSmokeRollbackRunbook } from "./liveSmokeRollbackRunbook";
import { buildLiveSecretRedactionDryRunForm } from "./liveSecretRedactionDryRunForm";
import { getLiveSingleTargetOperatorRunbook } from "./liveSingleTargetOperatorRunbook";
import { getLiveSingleTargetSmokeReadiness } from "./liveSingleTargetSmokeReadiness";

export const LIVE_PRE_SMOKE_OPERATOR_CHECKLIST_DECISION_ROLE =
  "live_pre_smoke_operator_checklist_support_only_no_vault_no_confirmed" as const;

export interface LivePreSmokeOperatorChecklistItem {
  key: string;
  label: string;
  mockStatus: "ready_mock" | "missing_before_real_smoke";
  supportOnly: true;
}

export interface LivePreSmokeOperatorChecklist {
  readyForRealSmoke: false;
  readyForMockChecklist: true;
  missingBeforeRealSmoke: string[];
  humanApprovalRequiredBeforeRealSmoke: true;
  checklist: LivePreSmokeOperatorChecklistItem[];
  targetReadinessSummary: ReturnType<typeof getLiveSingleTargetSmokeReadiness>;
  runbookSummary: ReturnType<typeof getLiveSingleTargetOperatorRunbook>;
  rollbackSummary: ReturnType<typeof getLiveSmokeRollbackRunbook>;
  secretRedactionSummary: ReturnType<typeof buildLiveSecretRedactionDryRunForm>;
  realSmokeApprovalGateSummary: ReturnType<typeof getLiveRealSmokeApprovalGate>;
  realSecretStored: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PRE_SMOKE_OPERATOR_CHECKLIST_DECISION_ROLE;
}

export function getLivePreSmokeOperatorChecklist(targetType?: unknown): LivePreSmokeOperatorChecklist {
  return {
    readyForRealSmoke: false,
    readyForMockChecklist: true,
    missingBeforeRealSmoke: [
      "APPROVE_LIVE_REAL_SMOKE_TEST onayi",
      "Gercek secret management ve rotation/revoke plani",
      "Gercek cost approval",
      "Gercek security review",
      "Gercek rollback drill",
      "Gercek post-test report owner",
    ],
    humanApprovalRequiredBeforeRealSmoke: true,
    checklist: [
      item("system_memory_current", "System Memory guncel mi?", "ready_mock"),
      item("deferred_ledger_current", "Deferred Work Ledger guncel mi?", "ready_mock"),
      item("target_readiness", "Target readiness hazir mi?", "ready_mock"),
      item("runbook_ready", "Operator runbook hazir mi?", "ready_mock"),
      item("rollback_ready", "Rollback hazir mi?", "ready_mock"),
      item("secret_redaction_passed", "Secret redaction test gecti mi?", "ready_mock"),
      item("real_lab_approval", "Real lab approval var mi?", "missing_before_real_smoke"),
      item("cost_approval", "Cost approval var mi?", "missing_before_real_smoke"),
      item("security_review", "Security review var mi?", "missing_before_real_smoke"),
      item("test_duration", "Test duration belirlendi mi?", "missing_before_real_smoke"),
      item("post_test_report_template", "Post-test report template hazir mi?", "ready_mock"),
    ],
    targetReadinessSummary: getLiveSingleTargetSmokeReadiness(targetType),
    runbookSummary: getLiveSingleTargetOperatorRunbook(targetType),
    rollbackSummary: getLiveSmokeRollbackRunbook(),
    secretRedactionSummary: buildLiveSecretRedactionDryRunForm({ targetType }),
    realSmokeApprovalGateSummary: getLiveRealSmokeApprovalGate(),
    realSecretStored: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PRE_SMOKE_OPERATOR_CHECKLIST_DECISION_ROLE,
  };
}

function item(
  key: string,
  label: string,
  mockStatus: "ready_mock" | "missing_before_real_smoke",
): LivePreSmokeOperatorChecklistItem {
  return { key, label, mockStatus, supportOnly: true };
}
