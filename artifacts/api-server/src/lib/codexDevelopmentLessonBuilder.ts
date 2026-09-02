import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  createCodexDevelopmentLesson,
  validateCodexDevelopmentLesson,
  type CodexDevelopmentCommandQuality,
  type CodexDevelopmentLesson,
} from "./codexDevelopmentLessonSchema";

export const CODEX_DEVELOPMENT_LESSON_BUILDER_VERSION =
  "codex-development-lesson-builder-v0.1" as const;

export interface CodexDevelopmentValidationSignal {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface CodexDevelopmentLessonBuilderInput {
  lessonDate?: string;
  relatedCheckpoint?: string;
  relatedModule?: string;
  checkpointReports?: readonly string[];
  validationSignals?: readonly CodexDevelopmentValidationSignal[];
  changedFiles?: readonly string[];
  promptNotes?: readonly string[];
  missingContextNotes?: readonly string[];
  repoRoot?: string;
}

export interface CodexDevelopmentLessonBuildReport {
  builderVersion: typeof CODEX_DEVELOPMENT_LESSON_BUILDER_VERSION;
  generatedAt: string;
  lesson: CodexDevelopmentLesson;
  commandQuality: CodexDevelopmentCommandQuality;
  validationSignalCount: number;
  passedValidationCount: number;
  changedFileCount: number;
  riskyFileCount: number;
  readOnly: true;
  filesWritten: 0;
  productBehaviorChanged: false;
  externalRuntimeAccess: false;
  runtimeInternetDependency: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  validationOk: boolean;
  blockedReasons: string[];
  note: string;
}

const DEFAULT_REPORTS = [
  "docs/TANCMARK_SYSTEM_MEMORY.md",
  "docs/TANCMARK_DEFERRED_WORK_LEDGER.md",
  "docs/PROJECT_REPORT.md",
  "docs/TANCMARK_CLOSED_LOOP_LEARNING_DNA_MODEL_ARCHITECTURE.md",
];

const RISKY_PATH_MARKERS = [
  "lib/aegis-core/",
  "vault",
  "final",
  "threshold",
  "ownership",
  "preSeal",
  "preseal",
  "payment",
  "secret",
  "auth",
  "routes/",
  "video/",
];

function safeReadText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function readDefaultReports(repoRoot: string): string[] {
  return DEFAULT_REPORTS
    .map((relPath) => safeReadText(path.join(repoRoot, relPath)))
    .filter((text): text is string => typeof text === "string" && text.length > 0);
}

function readGitChangedFiles(repoRoot: string): string[] {
  try {
    return execFileSync("git", ["diff", "--name-only"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function includesAny(text: string, markers: readonly string[]): boolean {
  const normalized = text.replace(/\\/g, "/");
  return markers.some((marker) => normalized.includes(marker));
}

function riskyFiles(changedFiles: readonly string[]): string[] {
  return changedFiles.filter((filePath) => includesAny(filePath, RISKY_PATH_MARKERS)).slice(0, 12);
}

function commandQualityFor(
  validationSignals: readonly CodexDevelopmentValidationSignal[],
  riskyFileCount: number,
  missingContextCount: number,
): CodexDevelopmentCommandQuality {
  if (validationSignals.length === 0) return "mixed";
  const failedCount = validationSignals.filter((signal) => !signal.passed).length;
  if (failedCount === 0 && riskyFileCount === 0 && missingContextCount === 0) return "strong";
  if (failedCount > 1 || riskyFileCount > 3) return "weak";
  return "mixed";
}

function validationLessons(validationSignals: readonly CodexDevelopmentValidationSignal[]): string[] {
  if (validationSignals.length === 0) {
    return ["Record contract, API typecheck, root typecheck and git diff --check results in every major task."];
  }
  return validationSignals
    .map((signal) =>
      signal.passed
        ? `${signal.name} passed and should remain part of the close-out gate.`
        : `${signal.name} failed or was blocked; explain the reason before checkpoint.`,
    )
    .slice(0, 8);
}

function reportSignals(reports: readonly string[]): string[] {
  const joined = reports.join("\n").toLowerCase();
  const signals: string[] = [];
  if (joined.includes("contract")) signals.push("Contracts made phase boundaries testable.");
  if (joined.includes("typecheck")) signals.push("Typecheck catches integration mistakes before checkpoint.");
  if (joined.includes("git diff")) signals.push("git diff checks protect against noisy or unsafe edits.");
  if (joined.includes("no vault") || joined.includes("canopenvault: false")) {
    signals.push("VAULT and final boundaries must be repeated in every lesson.");
  }
  if (joined.includes("sensitive") || joined.includes("secret")) {
    signals.push("Sensitive data and secret storage gates must stay visible in every phase.");
  }
  return signals.length > 0 ? signals : ["Checkpoint reports should say what passed, what failed and what remains deferred."];
}

export function buildCodexDevelopmentLesson(
  input: CodexDevelopmentLessonBuilderInput = {},
): CodexDevelopmentLessonBuildReport {
  const repoRoot = path.resolve(input.repoRoot ?? process.cwd());
  const checkpointReports = input.checkpointReports?.length
    ? [...input.checkpointReports]
    : readDefaultReports(repoRoot);
  const validationSignals = [...(input.validationSignals ?? [])];
  const changedFiles = input.changedFiles?.length ? [...input.changedFiles] : readGitChangedFiles(repoRoot);
  const risky = riskyFiles(changedFiles);
  const missingContext = unique([
    ...(input.missingContextNotes ?? []),
    ...(input.promptNotes?.some((note) => note.toLowerCase().includes("missing")) ? ["Prompt mentions missing context."] : []),
  ]);
  const commandQuality = commandQualityFor(validationSignals, risky.length, missingContext.length);
  const passedValidationCount = validationSignals.filter((signal) => signal.passed).length;
  const reportBasedSignals = reportSignals(checkpointReports);

  const lesson = createCodexDevelopmentLesson({
    lessonId: `codex-development-lesson-${input.lessonDate ?? new Date().toISOString().slice(0, 10)}`,
    lessonDate: input.lessonDate,
    relatedCheckpoint: input.relatedCheckpoint,
    relatedModule: input.relatedModule ?? "Codex/Development DNA",
    commandQuality,
    whatWorked: [
      ...reportBasedSignals,
      "Clear red lines kept lesson output away from product behavior and core decision logic.",
      "Contracts plus typechecks gave a repeatable close-out gate.",
    ],
    whatFailed: [
      ...(validationSignals.filter((signal) => !signal.passed).map((signal) => `${signal.name} did not pass: ${signal.detail ?? "no detail"}`)),
      ...(missingContext.length > 0 ? ["Missing context can make Codex choose the wrong file, date or success rule."] : []),
    ],
    repeatedRisk: [
      "Forgetting VAULT/final/threshold/ownership boundaries would turn support lessons into unsafe product behavior.",
      "Skipping contract/typecheck/git diff can hide broken integrations.",
      "Letting lesson files store customer content, secrets or raw reports would break the privacy boundary.",
    ],
    riskyFiles: risky.length > 0 ? risky : [
      "Core seal/read, VAULT/final, threshold, ownership/pre-seal, auth, payment and customer-content files.",
    ],
    testsThatCaughtIssues: validationLessons(validationSignals),
    missingContext: missingContext.length > 0 ? missingContext : [
      "Ask for repo path, exact phase name, required output files, contracts and final report fields when they are missing.",
    ],
    betterPromptPattern: [
      "Start with goal and non-negotiable red lines.",
      "Name files to read, files to create and files to update.",
      "State contract, typecheck, git diff and checkpoint requirements.",
      "Say what must not change: VAULT, final, threshold, ownership, pre-seal and core seal/read.",
      "Require a short final report with checkpoint, git status and push status.",
    ],
    rollbackNeeded: validationSignals.some((signal) => !signal.passed) || risky.length > 0,
    nextSafeDevelopmentAdvice: [
      "Keep every Codex lesson read-only and support-only.",
      "Treat risky file changes as human-review items before implementation.",
      "Repeat this lesson cycle every 2 days with fresh validation evidence.",
    ],
  });
  const validation = validateCodexDevelopmentLesson(lesson);

  return {
    builderVersion: CODEX_DEVELOPMENT_LESSON_BUILDER_VERSION,
    generatedAt: new Date().toISOString(),
    lesson,
    commandQuality,
    validationSignalCount: validationSignals.length,
    passedValidationCount,
    changedFileCount: changedFiles.length,
    riskyFileCount: risky.length,
    readOnly: true,
    filesWritten: 0,
    productBehaviorChanged: false,
    externalRuntimeAccess: false,
    runtimeInternetDependency: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    validationOk: validation.ok,
    blockedReasons: validation.blockedReasons,
    note:
      "Codex Development Lesson Builder reads local development signals and returns a support-only lesson. It writes no files, calls no external APIs, changes no product behavior and cannot open VAULT or produce final decisions.",
  };
}
