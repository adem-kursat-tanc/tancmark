import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
} from "./learningDnaEventSchema";
import {
  decideCodexTaskRelease,
  type CodexTaskReleaseDecision,
} from "./tancmarkCodexTaskCenter";
import type { TancmarkCodexTaskPackage } from "./tancmarkCodexTaskCenterSchema";

export const TANCMARK_CODEX_TASK_REPORT_BUILDER_VERSION =
  "tancmark-codex-task-report-builder-v0.1" as const;

export interface TancmarkCodexTaskReport {
  builderVersion: typeof TANCMARK_CODEX_TASK_REPORT_BUILDER_VERSION;
  generatedAt: string;
  taskCount: number;
  pendingApprovalCount: number;
  highRiskCount: number;
  readyForCodexCount: number;
  completedCount: number;
  tasks: TancmarkCodexTaskPackage[];
  releaseDecisions: CodexTaskReleaseDecision[];
  learningFeedbackTargets: string[];
  readOnly: true;
  executesTasksAutomatically: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  note: string;
}

export function buildTancmarkCodexTaskReport(input: {
  tasks?: readonly TancmarkCodexTaskPackage[];
  generatedAt?: string;
} = {}): TancmarkCodexTaskReport {
  const tasks = [...(input.tasks ?? [])];
  const releaseDecisions = tasks.map((task) => decideCodexTaskRelease(task));
  const learningFeedbackTargets = Array.from(
    new Set(tasks.flatMap((task) => task.learningFeedbackTargetDna)),
  );

  return {
    builderVersion: TANCMARK_CODEX_TASK_REPORT_BUILDER_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    taskCount: tasks.length,
    pendingApprovalCount: tasks.filter((task) => task.approvalStatus === "pending_human_approval").length,
    highRiskCount: tasks.filter((task) => task.riskLevel === "high").length,
    readyForCodexCount: releaseDecisions.filter((decision) => decision.canReleaseToCodex).length,
    completedCount: tasks.filter((task) => task.status === "completed").length,
    tasks,
    releaseDecisions,
    learningFeedbackTargets,
    readOnly: true,
    executesTasksAutomatically: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    note:
      "This report shows pending, approval-gated and completed Codex task packages. It is read-only and cannot execute tasks, change product behavior, open VAULT or create final decisions.",
  };
}

export function buildEmptyTancmarkCodexTaskReport(): TancmarkCodexTaskReport {
  return buildTancmarkCodexTaskReport();
}
