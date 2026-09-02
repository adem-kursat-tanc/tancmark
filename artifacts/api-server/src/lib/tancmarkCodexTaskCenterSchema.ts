import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import type { LocalSeedDnaName } from "./localSeedKnowledgeSchema";

export const TANCMARK_CODEX_TASK_CENTER_SCHEMA_VERSION =
  "tancmark-codex-task-center-schema-v0.1" as const;
export const TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export type TancmarkCodexTaskApprovalStatus =
  | "pending_human_approval"
  | "approved_by_human"
  | "rejected_by_human"
  | "not_required_low_risk";

export type TancmarkCodexTaskStatus =
  | "draft"
  | "waiting_human_approval"
  | "ready_for_codex"
  | "completed"
  | "rejected"
  | "learning_feedback_prepared";

export type TancmarkCodexTaskDecisionLevel =
  "human_approved_codex_task_candidate";

export interface TancmarkCodexTaskPackage {
  schemaVersion: typeof TANCMARK_CODEX_TASK_CENTER_SCHEMA_VERSION;
  taskId: string;
  createdAt: string;
  sourceDna: LocalSeedDnaName | "Chief Brain / Root DNA";
  sourceChiefBrainRecommendation: string;
  taskTitle: string;
  taskReason: string;
  affectedModules: string[];
  riskLevel: LearningDnaRiskLevel;
  requiresHumanApproval: boolean;
  approvalPhraseRequired: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  approvalStatus: TancmarkCodexTaskApprovalStatus;
  codexPromptDraft: string;
  expectedChecks: string[];
  expectedReports: string[];
  expectedCheckpoint: string;
  canModifyProduct: false;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  status: TancmarkCodexTaskStatus;
  resultSummary: string | null;
  learningFeedbackTargetDna: Array<LocalSeedDnaName | "Chief Brain / Root DNA">;
  canDispatchToCodex: boolean;
  productBehaviorChanged: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  decisionLevel: TancmarkCodexTaskDecisionLevel;
  safety: LearningDnaDecisionSafety;
}

export interface TancmarkCodexTaskValidation {
  ok: boolean;
  blockedReasons: string[];
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
}

export interface TancmarkCodexTaskPackageInput {
  taskId?: string;
  createdAt?: string;
  sourceDna?: LocalSeedDnaName | "Chief Brain / Root DNA";
  sourceChiefBrainRecommendation: string;
  taskTitle: string;
  taskReason: string;
  affectedModules?: readonly string[];
  riskLevel?: LearningDnaRiskLevel;
  requiresHumanApproval?: boolean;
  approvalStatus?: TancmarkCodexTaskApprovalStatus;
  codexPromptDraft?: string;
  expectedChecks?: readonly string[];
  expectedReports?: readonly string[];
  expectedCheckpoint?: string;
  resultSummary?: string | null;
  learningFeedbackTargetDna?: readonly (LocalSeedDnaName | "Chief Brain / Root DNA")[];
}

function cleanTimestamp(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function cleanText(value: unknown, fallback: string, maxLength = 800): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function cleanList(values: unknown, fallback: readonly string[], maxLength = 160): string[] {
  const rawValues = Array.isArray(values) ? values : fallback;
  return rawValues
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.slice(0, maxLength))
    .slice(0, 20);
}

function cleanRisk(value: unknown): LearningDnaRiskLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "task";
}

function approvalStatusFor(
  riskLevel: LearningDnaRiskLevel,
  requiresHumanApproval: boolean,
  requestedStatus: TancmarkCodexTaskApprovalStatus | undefined,
): TancmarkCodexTaskApprovalStatus {
  if (requestedStatus === "approved_by_human" && requiresHumanApproval) return requestedStatus;
  if (requestedStatus === "rejected_by_human") return requestedStatus;
  if (!requiresHumanApproval && riskLevel === "low") return "not_required_low_risk";
  return "pending_human_approval";
}

function taskStatusFor(
  approvalStatus: TancmarkCodexTaskApprovalStatus,
): TancmarkCodexTaskStatus {
  if (approvalStatus === "approved_by_human" || approvalStatus === "not_required_low_risk") {
    return "ready_for_codex";
  }
  if (approvalStatus === "rejected_by_human") return "rejected";
  return "waiting_human_approval";
}

export function createTancmarkCodexTaskPackage(
  input: TancmarkCodexTaskPackageInput,
): TancmarkCodexTaskPackage {
  const createdAt = cleanTimestamp(input.createdAt);
  const riskLevel = cleanRisk(input.riskLevel);
  const requiresHumanApproval =
    input.requiresHumanApproval === true || riskLevel === "high";
  const approvalStatus = approvalStatusFor(
    riskLevel,
    requiresHumanApproval,
    input.approvalStatus,
  );
  const status = taskStatusFor(approvalStatus);
  const taskTitle = cleanText(input.taskTitle, "Untitled Codex task", 180);
  const learningFeedbackTargetDna = Array.from(
    new Set(input.learningFeedbackTargetDna ?? [input.sourceDna ?? "Chief Brain / Root DNA"]),
  );

  return {
    schemaVersion: TANCMARK_CODEX_TASK_CENTER_SCHEMA_VERSION,
    taskId:
      cleanText(input.taskId, "", 160) ||
      `codex-task-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${slug(taskTitle)}`,
    createdAt,
    sourceDna: input.sourceDna ?? "Chief Brain / Root DNA",
    sourceChiefBrainRecommendation: cleanText(
      input.sourceChiefBrainRecommendation,
      "chief_brain_recommendation_not_recorded",
      240,
    ),
    taskTitle,
    taskReason: cleanText(input.taskReason, "Task reason not recorded.", 800),
    affectedModules: cleanList(input.affectedModules, ["docs", "runtime/validation"]),
    riskLevel,
    requiresHumanApproval,
    approvalPhraseRequired: TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE,
    approvalStatus,
    codexPromptDraft: cleanText(
      input.codexPromptDraft,
      "Prepare a scoped Codex task. Do not touch VAULT, final decisions, threshold, ownership, pre-seal or core seal/read logic. Do not push.",
      2400,
    ),
    expectedChecks: cleanList(input.expectedChecks, [
      "phase contract",
      "related existing contracts",
      "API typecheck",
      "root typecheck",
      "git diff --check",
    ]),
    expectedReports: cleanList(input.expectedReports, [
      "short final report",
      "checkpoint hash",
      "git status",
    ]),
    expectedCheckpoint: cleanText(input.expectedCheckpoint, "checkpoint required after successful validation", 240),
    canModifyProduct: false,
    canTouchVault: false,
    canChangeFinalDecision: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    status,
    resultSummary: input.resultSummary ? cleanText(input.resultSummary, "", 1000) : null,
    learningFeedbackTargetDna,
    canDispatchToCodex:
      status === "ready_for_codex" &&
      (requiresHumanApproval === false || approvalStatus === "approved_by_human"),
    productBehaviorChanged: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    decisionLevel: "human_approved_codex_task_candidate",
    safety: learningDnaDecisionSafety(),
  };
}

export function validateTancmarkCodexTaskPackage(
  task: Partial<TancmarkCodexTaskPackage>,
): TancmarkCodexTaskValidation {
  const blockedReasons: string[] = [];

  if (task.schemaVersion !== TANCMARK_CODEX_TASK_CENTER_SCHEMA_VERSION) {
    blockedReasons.push("schema_version_mismatch");
  }
  if (task.canModifyProduct !== false) blockedReasons.push("can_modify_product_not_false");
  if (task.canTouchVault !== false) blockedReasons.push("can_touch_vault_not_false");
  if (task.canChangeFinalDecision !== false) blockedReasons.push("can_change_final_not_false");
  if (task.canChangeThreshold !== false) blockedReasons.push("can_change_threshold_not_false");
  if (task.canChangeOwnership !== false) blockedReasons.push("can_change_ownership_not_false");
  if (task.storesSensitiveContent !== false) blockedReasons.push("stores_sensitive_content");
  if (task.productBehaviorChanged !== false) blockedReasons.push("product_behavior_changed");
  if (task.runtimeExternalApiDependency !== false) blockedReasons.push("runtime_external_api");
  if (task.runtimeInternetDependency !== false) blockedReasons.push("runtime_internet");
  if (task.approvalPhraseRequired !== CHIEF_BRAIN_APPROVAL_PHRASE) {
    blockedReasons.push("approval_phrase_mismatch");
  }
  if (
    task.riskLevel === "high" &&
    task.approvalStatus !== "approved_by_human" &&
    task.canDispatchToCodex !== false
  ) {
    blockedReasons.push("unapproved_high_risk_can_dispatch");
  }
  if (task.safety?.canOpenVault !== false) blockedReasons.push("safety_can_open_vault_not_false");
  if (task.safety?.canConfirmFinal !== false) blockedReasons.push("safety_can_confirm_final_not_false");
  if (task.safety?.canChangeThreshold !== false) blockedReasons.push("safety_threshold_not_false");
  if (task.safety?.canChangeOwnership !== false) blockedReasons.push("safety_ownership_not_false");
  if (task.safety?.storesSensitiveContent !== false) blockedReasons.push("safety_sensitive_not_false");
  if (task.safety?.storesSecrets !== false) blockedReasons.push("safety_secrets_not_false");

  return {
    ok: blockedReasons.length === 0,
    blockedReasons,
    canTouchVault: false,
    canChangeFinalDecision: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
  };
}
