import type { LiveApprovalRiskSnapshot } from "./liveApprovalRiskSnapshot";
import type { LiveApprovalScopePreview } from "./liveApprovalScopePreview";
import type { LiveApprovalAuditTimelineMock } from "./liveApprovalAuditTimelineMock";

export const LIVE_DNA_APPROVAL_LEARNING_DECISION_ROLE =
  "live_dna_approval_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveDnaApprovalLearningRecord {
  signalType:
    | "missing_approval"
    | "frequent_approval_risk"
    | "target_readiness_hint"
    | "rollback_gap"
    | "security_approval_gap"
    | "cost_approval_gap"
    | "ui_language_risk";
  summary: string;
  humanApprovalRequired: true;
  autoApply: false;
  supportOnly: true;
}

export interface LiveDnaApprovalLearningBridge {
  liveSessionId: string;
  learningRecords: LiveDnaApprovalLearningRecord[];
  learnedFrom: string[];
  autoApprovalEnabled: false;
  autoRealSmokeStartEnabled: false;
  autoSecretAcceptEnabled: false;
  autoConfigDeployEnabled: false;
  autoApiConnectionEnabled: false;
  humanApprovalRequired: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DNA_APPROVAL_LEARNING_DECISION_ROLE;
}

export function buildLiveDnaApprovalLearningBridge(input: {
  liveSessionId: string;
  timeline?: LiveApprovalAuditTimelineMock;
  scopePreview?: LiveApprovalScopePreview;
  riskSnapshot?: LiveApprovalRiskSnapshot;
}): LiveDnaApprovalLearningBridge {
  const highRiskCount = input.riskSnapshot?.risks.filter((risk) => risk.riskLevel === "high").length ?? 0;
  const targetType = input.scopePreview?.targetTypePreview ?? "youtube";
  const eventCount = input.timeline?.approvalEvents.length ?? 0;

  return {
    liveSessionId: input.liveSessionId,
    learningRecords: [
      record("missing_approval", `${eventCount} mock approval event kaydi var; gercek onay alinmadi.`),
      record("frequent_approval_risk", `${highRiskCount} high approval risk sinyali goruldu.`),
      record("target_readiness_hint", `${targetType} hedefi icin real test yalniz gelecekte explicit lab onayi ile dusunulebilir.`),
      record("rollback_gap", "Rollback drill ve key rotate/revoke adimlari real smoke oncesi zorunlu."),
      record("security_approval_gap", "Secret, target URL, webhook ve VAULT etkisizlik review'u eksikse test baslamaz."),
      record("cost_approval_gap", "Cost approval olmadan bandwidth/storage/provider maliyet riski kapatilmaz."),
      record("ui_language_risk", "Readiness UI dili real approval veya start izni gibi anlasilmamali."),
    ],
    learnedFrom: [
      "approval_audit_policy",
      "approval_audit_timeline_mock",
      "approval_scope_preview",
      "approval_risk_snapshot",
    ],
    autoApprovalEnabled: false,
    autoRealSmokeStartEnabled: false,
    autoSecretAcceptEnabled: false,
    autoConfigDeployEnabled: false,
    autoApiConnectionEnabled: false,
    humanApprovalRequired: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DNA_APPROVAL_LEARNING_DECISION_ROLE,
  };
}

function record(
  signalType: LiveDnaApprovalLearningRecord["signalType"],
  summary: string,
): LiveDnaApprovalLearningRecord {
  return {
    signalType,
    summary,
    humanApprovalRequired: true,
    autoApply: false,
    supportOnly: true,
  };
}
