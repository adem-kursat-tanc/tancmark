import fs from "node:fs";
import path from "node:path";
import { CHIEF_BRAIN_APPROVAL_PHRASE } from "./learningDnaEventSchema";

export const LOCAL_DNA_TRAINING_SCHEDULER_VERSION =
  "local-dna-training-scheduler-v0.1" as const;
export const LOCAL_DNA_TRAINING_APPROVAL_PHRASE =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export type DnaTrainingCadence = "every_2_days" | "weekly" | "after_each_training";
export type DnaTrainingPlanStatus =
  | "due_now"
  | "waiting_for_window"
  | "not_due"
  | "metrics_after_training";

export interface LocalDnaTrainingTask {
  taskId: string;
  taskName: string;
  targetDna: string;
  cadence: DnaTrainingCadence;
  allowedWindowStart: "12:00";
  allowedWindowEnd: "18:00";
  timezone: "Europe/Istanbul";
  requiresHumanApproval: false;
  productChanging: false;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
}

export interface LocalDnaTrainingSchedule {
  schemaVersion: "local-dna-training-schedule-v0.1";
  generatedAt: string;
  timezone: "Europe/Istanbul";
  allowedWindowStart: "12:00";
  allowedWindowEnd: "18:00";
  purpose: "local_automatic_training_only_no_product_behavior_change";
  computerOffBehavior: string;
  trainingTasksRequireHumanApproval: false;
  highRiskWorkRequiresHumanApproval: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  tasks: LocalDnaTrainingTask[];
}

export interface LocalDnaTrainingRunRecord {
  runId: string;
  taskId: string;
  taskName: string;
  targetDna: string;
  plannedAt: string;
  startedAt: string;
  finishedAt: string | null;
  status: "completed" | "missed" | "caught_up" | "blocked_human_approval_required" | "skipped";
  reportPath: string | null;
  newKnowledgeOrMetricSignals: number;
  error: string | null;
  productBehaviorChanged: false;
}

export interface LocalDnaTrainingRunLedger {
  schemaVersion: "local-dna-training-run-ledger-v0.1";
  generatedAt: string;
  timezone: "Europe/Istanbul";
  allowedWindowStart: "12:00";
  allowedWindowEnd: "18:00";
  purpose: "local_training_run_tracking_only_no_product_behavior_change";
  lastSuccessfulRunAt: string | null;
  totalRuns: number;
  totalMissed: number;
  totalCaughtUp: number;
  totalReportsProduced: number;
  totalNewKnowledgeOrMetricSignals: number;
  hasErrors: boolean;
  runs: LocalDnaTrainingRunRecord[];
  missedTraining: Array<{ taskId: string; missedAt: string; reason: string }>;
  caughtUpTraining: Array<{ taskId: string; caughtUpAt: string; originalMissReason: string }>;
  reports: Array<{ reportPath: string; createdAt: string; summary: string }>;
  humanApprovalRequiredItems: string[];
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  pushPerformed: false;
}

export interface TurkeyClock {
  timezone: "Europe/Istanbul";
  isoDate: string;
  timeHHMM: string;
  minutesSinceMidnight: number;
}

export interface LocalDnaTrainingTaskPlan {
  task: LocalDnaTrainingTask;
  status: DnaTrainingPlanStatus;
  due: boolean;
  catchUp: boolean;
  requiresHumanApproval: boolean;
  reason: string;
  canRunNow: boolean;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  productBehaviorChanged: false;
}

export interface LocalDnaTrainingPlan {
  schedulerVersion: typeof LOCAL_DNA_TRAINING_SCHEDULER_VERSION;
  generatedAt: string;
  turkeyClock: TurkeyClock;
  insideAllowedWindow: boolean;
  allowedWindowStart: "12:00";
  allowedWindowEnd: "18:00";
  timezone: "Europe/Istanbul";
  dueTaskCount: number;
  catchUpTaskCount: number;
  waitingTaskCount: number;
  tasks: LocalDnaTrainingTaskPlan[];
  trainingTasksRequireHumanApproval: false;
  highRiskWorkRequiresHumanApproval: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  canTouchVault: false;
  canChangeFinalDecision: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
}

function defaultSchedulePath(): string {
  return path.resolve(
    process.cwd(),
    "runtime",
    "validation",
    "dna_training_scheduler",
    "dna_training_schedule.json",
  );
}

function defaultRunLedgerPath(): string {
  return path.resolve(
    process.cwd(),
    "runtime",
    "validation",
    "dna_training_scheduler",
    "dna_training_run_ledger.json",
  );
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function twoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

function minuteOfDay(value: "12:00" | "18:00" | string): number {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return hour * 60 + minute;
}

function dateNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function daysBetween(leftIsoDate: string, rightIsoDate: string): number {
  return Math.max(0, dateNumber(rightIsoDate) - dateNumber(leftIsoDate));
}

function recordDate(record: LocalDnaTrainingRunRecord): string {
  return record.finishedAt?.slice(0, 10) ?? record.startedAt.slice(0, 10);
}

function cadenceDays(cadence: DnaTrainingCadence): number {
  if (cadence === "every_2_days") return 2;
  if (cadence === "weekly") return 7;
  return 0;
}

function latestSuccessfulRun(
  taskId: string,
  ledger: LocalDnaTrainingRunLedger,
): LocalDnaTrainingRunRecord | undefined {
  return [...ledger.runs]
    .filter((run) => run.taskId === taskId && (run.status === "completed" || run.status === "caught_up"))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
}

export function getTurkeyClock(now: Date = new Date()): TurkeyClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? "00";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));

  return {
    timezone: "Europe/Istanbul",
    isoDate: `${year}-${month}-${day}`,
    timeHHMM: `${twoDigits(hour)}:${twoDigits(minute)}`,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function loadLocalDnaTrainingSchedule(options: {
  schedulePath?: string;
} = {}): LocalDnaTrainingSchedule {
  return readJsonFile<LocalDnaTrainingSchedule>(path.resolve(options.schedulePath ?? defaultSchedulePath()));
}

export function loadLocalDnaTrainingRunLedger(options: {
  ledgerPath?: string;
} = {}): LocalDnaTrainingRunLedger {
  return readJsonFile<LocalDnaTrainingRunLedger>(path.resolve(options.ledgerPath ?? defaultRunLedgerPath()));
}

export function isInsideLocalTrainingWindow(
  schedule: Pick<LocalDnaTrainingSchedule, "allowedWindowStart" | "allowedWindowEnd">,
  clock: TurkeyClock,
): boolean {
  return (
    clock.minutesSinceMidnight >= minuteOfDay(schedule.allowedWindowStart) &&
    clock.minutesSinceMidnight < minuteOfDay(schedule.allowedWindowEnd)
  );
}

function taskDueState(input: {
  task: LocalDnaTrainingTask;
  ledger: LocalDnaTrainingRunLedger;
  clock: TurkeyClock;
  insideAllowedWindow: boolean;
  baseDueTaskCount: number;
}): Pick<LocalDnaTrainingTaskPlan, "status" | "due" | "catchUp" | "reason" | "canRunNow"> {
  const { task, ledger, clock, insideAllowedWindow, baseDueTaskCount } = input;

  if (task.cadence === "after_each_training") {
    const due = baseDueTaskCount > 0;
    return {
      status: due ? "metrics_after_training" : "not_due",
      due,
      catchUp: false,
      reason: due
        ? "Metrics update follows due training tasks."
        : "No training task is due, so metrics update waits.",
      canRunNow: due && insideAllowedWindow,
    };
  }

  const lastRun = latestSuccessfulRun(task.taskId, ledger);
  const interval = cadenceDays(task.cadence);
  const due =
    !lastRun ||
    daysBetween(recordDate(lastRun), clock.isoDate) >= interval;
  const catchUp =
    due &&
    !!lastRun &&
    daysBetween(recordDate(lastRun), clock.isoDate) > interval;

  if (!due) {
    return {
      status: "not_due",
      due: false,
      catchUp: false,
      reason: "Task cadence has not elapsed yet.",
      canRunNow: false,
    };
  }

  if (!insideAllowedWindow) {
    return {
      status: "waiting_for_window",
      due: true,
      catchUp,
      reason: "Task is due but outside the 12:00-18:00 Europe/Istanbul window.",
      canRunNow: false,
    };
  }

  return {
    status: "due_now",
    due: true,
    catchUp,
    reason: catchUp
      ? "Missed training is caught up inside the allowed window."
      : "Task is due inside the allowed window.",
    canRunNow: true,
  };
}

export function buildLocalDnaTrainingPlan(options: {
  schedule?: LocalDnaTrainingSchedule;
  ledger?: LocalDnaTrainingRunLedger;
  now?: Date;
} = {}): LocalDnaTrainingPlan {
  const schedule = options.schedule ?? loadLocalDnaTrainingSchedule();
  const ledger = options.ledger ?? loadLocalDnaTrainingRunLedger();
  const clock = getTurkeyClock(options.now);
  const insideAllowedWindow = isInsideLocalTrainingWindow(schedule, clock);

  const baseTasks = schedule.tasks.filter((task) => task.cadence !== "after_each_training");
  const baseDueTaskCount = baseTasks.filter((task) =>
    taskDueState({ task, ledger, clock, insideAllowedWindow, baseDueTaskCount: 0 }).due,
  ).length;

  const tasks = schedule.tasks.map((task): LocalDnaTrainingTaskPlan => {
    const state = taskDueState({
      task,
      ledger,
      clock,
      insideAllowedWindow,
      baseDueTaskCount,
    });
    const requiresHumanApproval = false;

    return {
      task,
      status: state.status,
      due: state.due,
      catchUp: state.catchUp,
      requiresHumanApproval,
      reason: state.reason,
      canRunNow: state.canRunNow && !requiresHumanApproval && task.productChanging === false,
      canTouchVault: false,
      canChangeFinalDecision: false,
      canChangeThreshold: false,
      canChangeOwnership: false,
      productBehaviorChanged: false,
    };
  });

  return {
    schedulerVersion: LOCAL_DNA_TRAINING_SCHEDULER_VERSION,
    generatedAt: new Date().toISOString(),
    turkeyClock: clock,
    insideAllowedWindow,
    allowedWindowStart: schedule.allowedWindowStart,
    allowedWindowEnd: schedule.allowedWindowEnd,
    timezone: "Europe/Istanbul",
    dueTaskCount: tasks.filter((task) => task.due).length,
    catchUpTaskCount: tasks.filter((task) => task.catchUp).length,
    waitingTaskCount: tasks.filter((task) => task.status === "waiting_for_window").length,
    tasks,
    trainingTasksRequireHumanApproval: false,
    highRiskWorkRequiresHumanApproval: true,
    approvalPhrase: LOCAL_DNA_TRAINING_APPROVAL_PHRASE,
    canTouchVault: false,
    canChangeFinalDecision: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
  };
}
