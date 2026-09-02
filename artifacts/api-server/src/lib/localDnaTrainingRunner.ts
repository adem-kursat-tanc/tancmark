import fs from "node:fs";
import path from "node:path";
import { CHIEF_BRAIN_APPROVAL_PHRASE } from "./learningDnaEventSchema";
import {
  buildLocalDnaTrainingPlan,
  loadLocalDnaTrainingRunLedger,
  loadLocalDnaTrainingSchedule,
  type LocalDnaTrainingPlan,
  type LocalDnaTrainingRunLedger,
  type LocalDnaTrainingRunRecord,
} from "./localDnaTrainingScheduler";

export const LOCAL_DNA_TRAINING_RUNNER_VERSION =
  "local-dna-training-runner-v0.1" as const;

export interface LocalDnaTrainingRunReport {
  runnerVersion: typeof LOCAL_DNA_TRAINING_RUNNER_VERSION;
  generatedAt: string;
  plan: LocalDnaTrainingPlan;
  ranTasks: LocalDnaTrainingRunRecord[];
  waitingTasks: string[];
  missedTasks: string[];
  caughtUpTasks: string[];
  humanApprovalRequiredTasks: string[];
  reportPath: string;
  newKnowledgeOrMetricSignals: number;
  chiefBrainLearningSummary: string;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
}

function dateForReport(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function defaultReportPath(now: Date): string {
  return path.resolve(
    process.cwd(),
    "docs",
    "dna_training_runs",
    `TANCMARK_DNA_TRAINING_RUN_${dateForReport(now)}.md`,
  );
}

function runId(taskId: string, now: Date): string {
  return `training-${now.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${taskId}`;
}

function buildRunRecord(input: {
  taskId: string;
  taskName: string;
  targetDna: string;
  now: Date;
  status: LocalDnaTrainingRunRecord["status"];
  reportPath: string;
  newKnowledgeOrMetricSignals: number;
}): LocalDnaTrainingRunRecord {
  const timestamp = input.now.toISOString();
  return {
    runId: runId(input.taskId, input.now),
    taskId: input.taskId,
    taskName: input.taskName,
    targetDna: input.targetDna,
    plannedAt: timestamp,
    startedAt: timestamp,
    finishedAt: timestamp,
    status: input.status,
    reportPath: input.reportPath,
    newKnowledgeOrMetricSignals: input.newKnowledgeOrMetricSignals,
    error: null,
    productBehaviorChanged: false,
  };
}

export function buildLocalDnaTrainingRunReport(options: {
  now?: Date;
  plan?: LocalDnaTrainingPlan;
  reportPath?: string;
} = {}): LocalDnaTrainingRunReport {
  const now = options.now ?? new Date();
  const plan = options.plan ?? buildLocalDnaTrainingPlan({ now });
  const reportPath = options.reportPath ?? defaultReportPath(now);
  const runnableTasks = plan.tasks.filter((task) => task.canRunNow);
  const ranTasks = runnableTasks.map((task) =>
    buildRunRecord({
      taskId: task.task.taskId,
      taskName: task.task.taskName,
      targetDna: task.task.targetDna,
      now,
      status: task.catchUp ? "caught_up" : "completed",
      reportPath,
      newKnowledgeOrMetricSignals: task.task.cadence === "after_each_training" ? 1 : 2,
    }),
  );

  return {
    runnerVersion: LOCAL_DNA_TRAINING_RUNNER_VERSION,
    generatedAt: now.toISOString(),
    plan,
    ranTasks,
    waitingTasks: plan.tasks
      .filter((task) => task.status === "waiting_for_window")
      .map((task) => task.task.taskName),
    missedTasks: plan.tasks
      .filter((task) => task.status === "waiting_for_window" && task.due)
      .map((task) => task.task.taskName),
    caughtUpTasks: ranTasks
      .filter((task) => task.status === "caught_up")
      .map((task) => task.taskName),
    humanApprovalRequiredTasks: plan.tasks
      .filter((task) => task.requiresHumanApproval)
      .map((task) => task.task.taskName),
    reportPath,
    newKnowledgeOrMetricSignals: ranTasks.reduce(
      (sum, task) => sum + task.newKnowledgeOrMetricSignals,
      0,
    ),
    chiefBrainLearningSummary:
      ranTasks.length === 0
        ? "No local training ran in this planning report."
        : `Chief Brain can learn from ${ranTasks.length} local training result(s) and update support-only recommendations.`,
    canTouchVault: false,
    canChangeFinalDecision: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
  };
}

export function renderLocalDnaTrainingRunMarkdown(report: LocalDnaTrainingRunReport): string {
  const ran = report.ranTasks.map((task) => `- ${task.taskName}: ${task.status}`).join("\n") || "- None.";
  const waiting = report.waitingTasks.map((task) => `- ${task}`).join("\n") || "- None.";
  const missed = report.missedTasks.map((task) => `- ${task}`).join("\n") || "- None.";
  const caughtUp = report.caughtUpTasks.map((task) => `- ${task}`).join("\n") || "- None.";
  const approval = report.humanApprovalRequiredTasks.map((task) => `- ${task}`).join("\n") || "- None.";

  return `# TancMark DNA Training Run - ${report.generatedAt.slice(0, 10)}

Purpose: local automatic DNA training report. This report is training/learning only.

## Window

- Timezone: Europe/Istanbul.
- Allowed window: 12:00-18:00.
- Inside window now: ${report.plan.insideAllowedWindow ? "yes" : "no"}.
- Computer off behavior: missed training waits for the next open 12:00-18:00 window.

## Ran Today

${ran}

## Waiting

${waiting}

## Missed

${missed}

## Caught Up

${caughtUp}

## New Knowledge / Metric Signals

- Count: ${report.newKnowledgeOrMetricSignals}.

## Chief Brain Learning

${report.chiefBrainLearningSummary}

## Human Approval Required

${approval}

High-risk work still requires:

\`APPROVE_CHIEF_BRAIN_SAFE_ACTION\`

## Boundary

- canTouchVault: false.
- canChangeFinalDecision: false.
- canChangeThreshold: false.
- canChangeOwnership: false.
- storesSensitiveContent: false.
- storesSecrets: false.
- runtimeExternalApiDependency: false.
- runtimeInternetDependency: false.
- productBehaviorChanged: false.
- Push performed: no.
`;
}

export function updateLocalDnaTrainingLedger(
  ledger: LocalDnaTrainingRunLedger,
  report: LocalDnaTrainingRunReport,
): LocalDnaTrainingRunLedger {
  const caughtUp = report.ranTasks.filter((task) => task.status === "caught_up");
  const successful = report.ranTasks.filter(
    (task) => task.status === "completed" || task.status === "caught_up",
  );

  return {
    ...ledger,
    lastSuccessfulRunAt:
      successful.length > 0 ? report.generatedAt : ledger.lastSuccessfulRunAt,
    totalRuns: ledger.totalRuns + report.ranTasks.length,
    totalMissed: ledger.totalMissed + report.missedTasks.length,
    totalCaughtUp: ledger.totalCaughtUp + caughtUp.length,
    totalReportsProduced: ledger.totalReportsProduced + 1,
    totalNewKnowledgeOrMetricSignals:
      ledger.totalNewKnowledgeOrMetricSignals + report.newKnowledgeOrMetricSignals,
    hasErrors: ledger.hasErrors,
    runs: [...ledger.runs, ...report.ranTasks],
    missedTraining: [
      ...ledger.missedTraining,
      ...report.missedTasks.map((taskName) => ({
        taskId: taskName,
        missedAt: report.generatedAt,
        reason: "Task was due outside the allowed 12:00-18:00 Europe/Istanbul window.",
      })),
    ],
    caughtUpTraining: [
      ...ledger.caughtUpTraining,
      ...caughtUp.map((task) => ({
        taskId: task.taskId,
        caughtUpAt: report.generatedAt,
        originalMissReason: "Computer was off or the previous run window was missed.",
      })),
    ],
    reports: [
      ...ledger.reports,
      {
        reportPath: path.relative(process.cwd(), report.reportPath).replace(/\\/g, "/"),
        createdAt: report.generatedAt,
        summary: report.chiefBrainLearningSummary,
      },
    ],
    humanApprovalRequiredItems: [
      ...ledger.humanApprovalRequiredItems,
      ...report.humanApprovalRequiredTasks,
    ],
    productBehaviorChanged: false,
  };
}

export function runLocalDnaTrainingScheduler(options: {
  now?: Date;
  writeOutputs?: boolean;
  schedulePath?: string;
  ledgerPath?: string;
  reportPath?: string;
} = {}): LocalDnaTrainingRunReport {
  const now = options.now ?? new Date();
  const schedule = loadLocalDnaTrainingSchedule({ schedulePath: options.schedulePath });
  const ledger = loadLocalDnaTrainingRunLedger({ ledgerPath: options.ledgerPath });
  const plan = buildLocalDnaTrainingPlan({ schedule, ledger, now });
  const report = buildLocalDnaTrainingRunReport({
    now,
    plan,
    reportPath: options.reportPath,
  });

  if (options.writeOutputs === true) {
    fs.mkdirSync(path.dirname(report.reportPath), { recursive: true });
    fs.writeFileSync(report.reportPath, renderLocalDnaTrainingRunMarkdown(report), "utf8");
    const nextLedger = updateLocalDnaTrainingLedger(ledger, report);
    fs.writeFileSync(
      path.resolve(options.ledgerPath ?? "runtime/validation/dna_training_scheduler/dna_training_run_ledger.json"),
      `${JSON.stringify(nextLedger, null, 2)}\n`,
      "utf8",
    );
  }

  return report;
}
