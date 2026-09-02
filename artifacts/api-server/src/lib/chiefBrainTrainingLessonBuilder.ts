import fs from "node:fs";
import path from "node:path";
import {
  createChiefBrainTrainingLesson,
  validateChiefBrainTrainingLesson,
  type ChiefBrainTrainingLesson,
} from "./chiefBrainTrainingLessonSchema";
import {
  buildChiefBrainSeedSummaryReport,
  type ChiefBrainSeedSummaryReport,
} from "./chiefBrainSeedSummaryHelper";
import {
  extractLearningDnaDebts,
  type LearningDnaDebtReaderReport,
} from "./learningDnaDebtReader";
import type { LearningDnaRiskLevel } from "./learningDnaEventSchema";
import type { LocalSeedDnaName } from "./localSeedKnowledgeSchema";

export const CHIEF_BRAIN_TRAINING_LESSON_BUILDER_VERSION =
  "chief-brain-training-lesson-builder-v0.1" as const;

export interface ChiefBrainTrainingSourceBundle {
  seedSummaryReport?: ChiefBrainSeedSummaryReport;
  weeklyIntelligenceText?: string;
  codexLessonText?: string;
  securityLessonText?: string;
  debtReport?: LearningDnaDebtReaderReport;
  repoRoot?: string;
  lessonDate?: string;
}

export interface ChiefBrainTrainingLessonBuildReport {
  builderVersion: typeof CHIEF_BRAIN_TRAINING_LESSON_BUILDER_VERSION;
  generatedAt: string;
  lesson: ChiefBrainTrainingLesson;
  dnaSummaryCount: number;
  seedRecordCount: number;
  weeklyIntelligenceRead: boolean;
  codexLessonRead: boolean;
  securityLessonRead: boolean;
  openDebtCount: number;
  highRiskDebtCount: number;
  conflictDetected: boolean;
  readOnly: true;
  filesWritten: 0;
  actionsApplied: 0;
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

const DEFAULT_WEEKLY_REPORT = "docs/weekly_intelligence/TANCMARK_WEEKLY_INTELLIGENCE_2026-06-30.md";
const DEFAULT_CODEX_LESSON =
  "docs/codex_development_lessons/TANCMARK_CODEX_DEVELOPMENT_LESSON_2026-06-30.md";
const DEFAULT_SECURITY_LESSON =
  "docs/security_dna_lessons/TANCMARK_SECURITY_DNA_LESSON_2026-06-30.md";
const DEFAULT_DEBT_LEDGER = "docs/TANCMARK_DEFERRED_WORK_LEDGER.md";

function safeReadText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).slice(0, 16);
}

function riskRank(risk: LearningDnaRiskLevel): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

function riskLevelFromDebt(debtReport: LearningDnaDebtReaderReport): LearningDnaRiskLevel {
  if (debtReport.highRiskDebtCount > 0) return "high";
  if (debtReport.items.some((item) => item.riskLevel === "medium")) return "medium";
  return "low";
}

function textHas(text: string, needles: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

function relatedDnaFromTexts(
  seedSummary: ChiefBrainSeedSummaryReport,
  weeklyText: string,
  codexText: string,
  securityText: string,
): LocalSeedDnaName[] {
  const names = new Set<LocalSeedDnaName>();
  for (const summary of seedSummary.dnaSummaries) {
    if (summary.seedRecordCount > 0 && names.size < 16) names.add(summary.dnaName);
  }
  if (textHas(weeklyText, ["Pricing/Cost DNA"])) names.add("Pricing/Cost DNA");
  if (textHas(weeklyText, ["License/Product Gate DNA"])) names.add("License/Product Gate DNA");
  if (textHas(codexText, ["Codex / Development", "Codex/Development"])) {
    names.add("Codex/Development DNA");
  }
  if (textHas(securityText, ["Security DNA"])) names.add("Security DNA");
  return Array.from(names);
}

function detectConflict(weeklyText: string, securityText: string, debtReport: LearningDnaDebtReaderReport): boolean {
  const productPush = textHas(weeklyText, ["product-ready", "launch", "pricing"]);
  const safetyBlock = textHas(securityText, ["human approval", "does not act alone", "cannot"]) ||
    debtReport.highRiskDebtCount > 0;
  return productPush && safetyBlock;
}

function priorityReasoning(
  debtReport: LearningDnaDebtReaderReport,
  conflictDetected: boolean,
): string[] {
  const reasons: string[] = [
    "Pick launch blockers before nice-to-have product improvements.",
    "License, security and sensitive-data risks outrank product benefit.",
    "Real-test gates stay ahead of marketing or sales claims.",
  ];
  if (debtReport.highRiskDebtCount > 0) {
    reasons.push("High-risk debt needs human approval before any implementation task.");
  }
  if (conflictDetected) {
    reasons.push("When DNA suggestions conflict, choose the safer support-only path first.");
  }
  return reasons;
}

function qualityScore(seedSummary: ChiefBrainSeedSummaryReport, debtReport: LearningDnaDebtReaderReport): number {
  const coverageScore = seedSummary.allDnaCovered ? 0.45 : 0.2;
  const riskScore = debtReport.highRiskDebtCount > 0 ? 0.25 : 0.35;
  const approvalScore = 0.2;
  const evidenceScore = seedSummary.totalSeedRecordCount >= 166 ? 0.1 : 0.05;
  return Math.min(1, coverageScore + riskScore + approvalScore + evidenceScore);
}

export function buildChiefBrainTrainingLesson(
  input: ChiefBrainTrainingSourceBundle = {},
): ChiefBrainTrainingLessonBuildReport {
  const repoRoot = path.resolve(input.repoRoot ?? process.cwd());
  const seedSummaryReport = input.seedSummaryReport ?? buildChiefBrainSeedSummaryReport();
  const weeklyText =
    input.weeklyIntelligenceText ?? safeReadText(path.join(repoRoot, DEFAULT_WEEKLY_REPORT));
  const codexText = input.codexLessonText ?? safeReadText(path.join(repoRoot, DEFAULT_CODEX_LESSON));
  const securityText =
    input.securityLessonText ?? safeReadText(path.join(repoRoot, DEFAULT_SECURITY_LESSON));
  const debtReport =
    input.debtReport ??
    extractLearningDnaDebts(safeReadText(path.join(repoRoot, DEFAULT_DEBT_LEDGER)), DEFAULT_DEBT_LEDGER);

  const conflictDetected = detectConflict(weeklyText, securityText, debtReport);
  const riskLevel = riskLevelFromDebt(debtReport);
  const relatedDnaEngines = relatedDnaFromTexts(seedSummaryReport, weeklyText, codexText, securityText);
  const strongest = seedSummaryReport.strongestKnowledgeAreas.slice(0, 4);
  const weakest = seedSummaryReport.weakestOrDeepeningAreas.slice(0, 5);
  const openDebts = debtReport.items
    .filter((item) => item.status === "open" || item.status === "deferred" || item.status === "support_only")
    .sort((left, right) => riskRank(right.riskLevel) - riskRank(left.riskLevel))
    .slice(0, 4);

  const lesson = createChiefBrainTrainingLesson({
    lessonId: `chief-brain-training-lesson-${input.lessonDate ?? new Date().toISOString().slice(0, 10)}`,
    lessonDate: input.lessonDate,
    relatedDnaEngines,
    inputSignals: unique([
      "16 DNA seed summaries",
      "weekly intelligence report",
      "Codex / Development lesson",
      "Security lesson",
      "deferred work ledger",
      ...openDebts.map((item) => `debt:${item.debtId}`),
    ]),
    conflictDetected,
    priorityReasoning: priorityReasoning(debtReport, conflictDetected),
    riskLevel,
    humanApprovalRequired: riskLevel === "high" || conflictDetected,
    suggestedNextAction:
      openDebts[0]?.heading ??
      "Prepare a support-only task proposal for the highest-risk open blocker.",
    whyThisAction:
      openDebts[0]?.summary ??
      "Chief Brain should choose the safest useful next task by combining DNA summaries, weekly signals and lesson outcomes.",
    whatWorkedPreviously: unique([
      ...strongest,
      "Codex and Security lesson cycles made red lines explicit.",
      "Contracts and typechecks improved recommendation confidence.",
    ]),
    whatFailedPreviously: unique([
      ...weakest,
      ...(conflictDetected ? ["Some product benefit signals conflict with safety or launch-gate signals."] : []),
    ]),
    recommendationQualityScore: qualityScore(seedSummaryReport, debtReport),
  });
  const validation = validateChiefBrainTrainingLesson(lesson);

  return {
    builderVersion: CHIEF_BRAIN_TRAINING_LESSON_BUILDER_VERSION,
    generatedAt: new Date().toISOString(),
    lesson,
    dnaSummaryCount: seedSummaryReport.totalDnaCount,
    seedRecordCount: seedSummaryReport.totalSeedRecordCount,
    weeklyIntelligenceRead: weeklyText.length > 0,
    codexLessonRead: codexText.length > 0,
    securityLessonRead: securityText.length > 0,
    openDebtCount: debtReport.openDebtCount,
    highRiskDebtCount: debtReport.highRiskDebtCount,
    conflictDetected,
    readOnly: true,
    filesWritten: 0,
    actionsApplied: 0,
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
      "Chief Brain training builder reads local DNA summaries, lessons and debt notes to improve support-only recommendation quality. It writes no files, applies no actions, changes no product behavior, calls no external APIs and cannot open VAULT or create final decisions.",
  };
}
