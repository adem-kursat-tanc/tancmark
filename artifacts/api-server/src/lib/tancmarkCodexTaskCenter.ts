import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import type { LocalSeedDnaName } from "./localSeedKnowledgeSchema";
import {
  createTancmarkCodexTaskPackage,
  validateTancmarkCodexTaskPackage,
  type TancmarkCodexTaskApprovalStatus,
  type TancmarkCodexTaskPackage,
} from "./tancmarkCodexTaskCenterSchema";

export const TANCMARK_CODEX_TASK_CENTER_VERSION =
  "tancmark-codex-task-center-v0.1" as const;
export const TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE_TEXT =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export interface ChiefBrainToCodexTaskInput {
  recommendationId: string;
  sourceDna?: LocalSeedDnaName | "Chief Brain / Root DNA";
  sourceDnaList?: readonly LocalSeedDnaName[];
  title: string;
  reason: string;
  affectedModules?: readonly string[];
  riskLevel?: LearningDnaRiskLevel;
  approvalStatus?: TancmarkCodexTaskApprovalStatus;
  expectedChecks?: readonly string[];
  expectedReports?: readonly string[];
  codexPromptDraft?: string;
}

export interface CodexTaskReleaseDecision {
  taskId: string;
  canReleaseToCodex: boolean;
  reason: string;
  approvalPhraseRequired: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  productBehaviorChanged: false;
}

export interface CodexTaskLearningFeedback {
  taskId: string;
  status: "learning_feedback_prepared";
  resultSummary: string;
  checkpoint: string | null;
  checksPassed: boolean;
  learningFeedbackTargetDna: Array<LocalSeedDnaName | "Chief Brain / Root DNA">;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  productBehaviorChanged: false;
}

function defaultPrompt(input: ChiefBrainToCodexTaskInput): string {
  return [
    `Amaç: ${input.title}`,
    "",
    "Kırmızı çizgiler:",
    "- VAULT/final/threshold/ownership/pre-seal/core mühür mantığına dokunma.",
    "- Hassas veri, secret, müşteri içeriği saklama.",
    "- Dış runtime API/internet bağımlılığı ekleme.",
    "- Push yapma.",
    "",
    `Gerekçe: ${input.reason}`,
    "",
    "Beklenen çıktı: scoped uygulama, rapor, contract/typecheck/git diff --check ve checkpoint.",
  ].join("\n");
}

export function buildCodexTaskCandidateFromChiefBrain(
  input: ChiefBrainToCodexTaskInput,
): TancmarkCodexTaskPackage {
  const riskLevel = input.riskLevel ?? "medium";
  return createTancmarkCodexTaskPackage({
    sourceDna: input.sourceDna ?? "Chief Brain / Root DNA",
    sourceChiefBrainRecommendation: input.recommendationId,
    taskTitle: input.title,
    taskReason: input.reason,
    affectedModules: input.affectedModules,
    riskLevel,
    requiresHumanApproval: riskLevel === "high",
    approvalStatus: input.approvalStatus,
    codexPromptDraft: input.codexPromptDraft ?? defaultPrompt(input),
    expectedChecks: input.expectedChecks,
    expectedReports: input.expectedReports,
    learningFeedbackTargetDna: [
      ...(input.sourceDnaList ?? []),
      input.sourceDna ?? "Chief Brain / Root DNA",
      "Codex/Development DNA",
    ],
  });
}

export function decideCodexTaskRelease(
  task: TancmarkCodexTaskPackage,
): CodexTaskReleaseDecision {
  const validation = validateTancmarkCodexTaskPackage(task);
  if (!validation.ok) {
    return {
      taskId: task.taskId,
      canReleaseToCodex: false,
      reason: `Blocked by task safety validation: ${validation.blockedReasons.join(", ")}`,
      approvalPhraseRequired: TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE_TEXT,
      canTouchVault: false,
      canChangeFinalDecision: false,
      canChangeThreshold: false,
      canChangeOwnership: false,
      productBehaviorChanged: false,
    };
  }
  if (task.riskLevel === "high" && task.approvalStatus !== "approved_by_human") {
    return {
      taskId: task.taskId,
      canReleaseToCodex: false,
      reason: "High-risk task is waiting for human approval phrase.",
      approvalPhraseRequired: TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE_TEXT,
      canTouchVault: false,
      canChangeFinalDecision: false,
      canChangeThreshold: false,
      canChangeOwnership: false,
      productBehaviorChanged: false,
    };
  }

  return {
    taskId: task.taskId,
    canReleaseToCodex: task.canDispatchToCodex,
    reason: task.canDispatchToCodex
      ? "Task package can be handed to Codex as a controlled prompt."
      : "Task package is not ready for Codex.",
    approvalPhraseRequired: TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE_TEXT,
    canTouchVault: false,
    canChangeFinalDecision: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    productBehaviorChanged: false,
  };
}

export function prepareCodexTaskLearningFeedback(input: {
  task: TancmarkCodexTaskPackage;
  resultSummary: string;
  checkpoint?: string | null;
  checksPassed?: boolean;
}): CodexTaskLearningFeedback {
  return {
    taskId: input.task.taskId,
    status: "learning_feedback_prepared",
    resultSummary: input.resultSummary.trim().slice(0, 1000),
    checkpoint: input.checkpoint ?? null,
    checksPassed: input.checksPassed === true,
    learningFeedbackTargetDna: input.task.learningFeedbackTargetDna,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    productBehaviorChanged: false,
  };
}

export function buildCodexTaskCenterSafetySummary() {
  return {
    centerVersion: TANCMARK_CODEX_TASK_CENTER_VERSION,
    chain:
      "Sub DNA learns -> Chief Brain recommends -> human approval gate -> Codex task package -> Codex result -> DNA learning feedback",
    executesTasksAutomatically: false,
    highRiskApprovalPhrase: TANCMARK_CODEX_TASK_CENTER_APPROVAL_PHRASE_TEXT,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    safety: learningDnaDecisionSafety(),
  };
}
