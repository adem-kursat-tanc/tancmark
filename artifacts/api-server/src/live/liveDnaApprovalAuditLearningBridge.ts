import type { LiveApprovalActorPreview } from "./liveApprovalActorPreview";
import type { LiveApprovalHashChainPreview } from "./liveApprovalHashChainPreview";
import type { LiveApprovalImmutabilityValidatorPreview } from "./liveApprovalImmutabilityValidator";
import type { LiveApprovalSignaturePreview } from "./liveApprovalSignaturePreview";
import type { LiveAppendOnlyApprovalLogMock } from "./liveAppendOnlyApprovalLogMock";

export const LIVE_DNA_APPROVAL_AUDIT_LEARNING_DECISION_ROLE =
  "live_dna_approval_audit_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveDnaApprovalAuditLearningRecord {
  signalType:
    | "missing_actor_identity"
    | "missing_scope"
    | "missing_risk_snapshot"
    | "missing_rollback"
    | "missing_cost_approval"
    | "missing_security_review"
    | "future_audit_chain_break"
    | "ui_language_risk";
  summary: string;
  humanApprovalRequired: true;
  autoApply: false;
  supportOnly: true;
}

export interface LiveDnaApprovalAuditLearningBridge {
  liveSessionId: string;
  learningRecords: LiveDnaApprovalAuditLearningRecord[];
  learnedFrom: string[];
  autoApprovalEnabled: false;
  autoRealSmokeStartEnabled: false;
  autoSecretAcceptEnabled: false;
  autoProductionConfigDeployEnabled: false;
  autoApiConnectionEnabled: false;
  humanApprovalRequired: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DNA_APPROVAL_AUDIT_LEARNING_DECISION_ROLE;
}

export function buildLiveDnaApprovalAuditLearningBridge(input: {
  liveSessionId: string;
  actorPreview?: LiveApprovalActorPreview;
  appendOnlyLog?: LiveAppendOnlyApprovalLogMock;
  hashChain?: LiveApprovalHashChainPreview;
  signaturePreview?: LiveApprovalSignaturePreview;
  immutabilityValidator?: LiveApprovalImmutabilityValidatorPreview;
}): LiveDnaApprovalAuditLearningBridge {
  const entryCount = input.appendOnlyLog?.entries.length ?? 0;
  const chainValid = input.hashChain?.chainValidPreview ?? false;
  const signatureReady = input.signaturePreview?.signatureVerifiableNow ?? false;
  const actorVerified = input.actorPreview?.identityVerified ?? false;

  return {
    liveSessionId: input.liveSessionId,
    learningRecords: [
      record("missing_actor_identity", actorVerified ? "Actor preview var; real identity verification yok." : "Actor identity real olarak dogrulanmadi."),
      record("missing_scope", "Approval scope mock preview olarak var; real approval scope degil."),
      record("missing_risk_snapshot", "Risk snapshot preview var; real security/cost approval degil."),
      record("missing_rollback", "Rollback drill future; real smoke oncesi zorunlu."),
      record("missing_cost_approval", "Cost approval real workflow'a bagli degil."),
      record("missing_security_review", "Security review real workflow'a bagli degil."),
      record(
        "future_audit_chain_break",
        `Hash-chain preview ${chainValid ? "gecerli gorunuyor" : "eksik"}; ${entryCount} mock kayit var; signature verifiable now=${signatureReady}.`,
      ),
      record("ui_language_risk", "Signed audit preview dili real approval/signature gibi anlasilmamali."),
    ],
    learnedFrom: [
      "approval_actor_identity_preview",
      "signed_approval_audit_policy",
      "append_only_approval_log_mock",
      "approval_hash_chain_preview",
      "approval_signature_preview",
      "approval_immutability_validator_preview",
    ],
    autoApprovalEnabled: false,
    autoRealSmokeStartEnabled: false,
    autoSecretAcceptEnabled: false,
    autoProductionConfigDeployEnabled: false,
    autoApiConnectionEnabled: false,
    humanApprovalRequired: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DNA_APPROVAL_AUDIT_LEARNING_DECISION_ROLE,
  };
}

function record(
  signalType: LiveDnaApprovalAuditLearningRecord["signalType"],
  summary: string,
): LiveDnaApprovalAuditLearningRecord {
  return {
    signalType,
    summary,
    humanApprovalRequired: true,
    autoApply: false,
    supportOnly: true,
  };
}
