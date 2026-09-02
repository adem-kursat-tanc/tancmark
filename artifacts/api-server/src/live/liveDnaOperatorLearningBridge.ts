import type { LivePreSmokeOperatorChecklist } from "./livePreSmokeOperatorChecklist";
import type { LiveSecretRedactionDryRunForm } from "./liveSecretRedactionDryRunForm";

export const LIVE_DNA_OPERATOR_LEARNING_DECISION_ROLE =
  "live_dna_operator_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveDnaOperatorLearningRecord {
  signalType:
    | "missing_runbook_step"
    | "frequent_risk"
    | "secret_redaction_issue"
    | "rollback_gap"
    | "cost_approval_gap"
    | "real_lab_blocker"
    | "target_specific_readiness_gap";
  summary: string;
  humanApprovalRequired: true;
  autoApply: false;
  supportOnly: true;
}

export interface LiveDnaOperatorLearningBridge {
  liveSessionId: string;
  learningRecords: LiveDnaOperatorLearningRecord[];
  learnedFrom: string[];
  autoRealSmokeStartEnabled: false;
  autoSecretAcceptEnabled: false;
  autoConfigDeployEnabled: false;
  autoApiConnectionEnabled: false;
  humanApprovalRequired: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DNA_OPERATOR_LEARNING_DECISION_ROLE;
}

export function buildLiveDnaOperatorLearningBridge(input: {
  liveSessionId: string;
  preSmokeChecklist?: LivePreSmokeOperatorChecklist;
  secretRedaction?: LiveSecretRedactionDryRunForm;
}): LiveDnaOperatorLearningBridge {
  const checklistMissing = input.preSmokeChecklist?.missingBeforeRealSmoke ?? [];
  const secretIssue = input.secretRedaction?.detectedSecretLikeValue ?? false;

  return {
    liveSessionId: input.liveSessionId,
    learningRecords: [
      record("missing_runbook_step", "Operator runbook real-lab onayi olmadan gercek teste gecemez."),
      record("frequent_risk", "Secret exposure, live outage, false evidence ve VAULT misuse riskleri operator onayi ister."),
      record(
        "secret_redaction_issue",
        secretIssue
          ? "Secret-like input dry-run formda yakalandi ve redacted preview'a cevrildi."
          : "Secret redaction formu real secret saklamadan mock kontrol uretir.",
      ),
      record("rollback_gap", "Gercek rollback drill henuz yok; runbook preview olarak kalir."),
      record("cost_approval_gap", checklistMissing.includes("Gercek cost approval") ? "Cost approval eksik." : "Cost approval real smoke oncesi zorunlu."),
      record("real_lab_blocker", "Real SRS/MediaMTX, OBS ingest, HLS playback ve stream key handling henuz kapali."),
      record("target_specific_readiness_gap", "YouTube ve custom RTMP hazirliklari mock-first; real provider davranisi olculmedi."),
    ],
    learnedFrom: [
      "operator_runbook",
      "secret_redaction_dry_run",
      "pre_smoke_checklist",
      "rollback_runbook",
      "real_smoke_approval_gate",
    ],
    autoRealSmokeStartEnabled: false,
    autoSecretAcceptEnabled: false,
    autoConfigDeployEnabled: false,
    autoApiConnectionEnabled: false,
    humanApprovalRequired: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DNA_OPERATOR_LEARNING_DECISION_ROLE,
  };
}

function record(
  signalType: LiveDnaOperatorLearningRecord["signalType"],
  summary: string,
): LiveDnaOperatorLearningRecord {
  return {
    signalType,
    summary,
    humanApprovalRequired: true,
    autoApply: false,
    supportOnly: true,
  };
}
