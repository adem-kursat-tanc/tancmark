import fs from "node:fs";
import path from "node:path";
import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";

export const DNA_LEARNING_METRICS_TRACKER_VERSION =
  "dna-learning-metrics-tracker-v0.1" as const;

export interface DnaLearningMetricEntry {
  dnaName: string;
  totalSeedKnowledgeRecords: number;
  totalLessonsReceived: number;
  totalWeeklyKnowledgeUpdates: number;
  totalObservedEvents: number;
  totalRecommendationsGenerated: number;
  totalRecommendationsAccepted: number;
  totalRecommendationsRejected: number;
  totalRiskSignals: number;
  totalDebtSignals: number;
  confidenceScoreBefore: number;
  confidenceScoreAfter: number;
  recommendationQualityBefore: number;
  recommendationQualityAfter: number;
  riskCalibrationChange: number;
  priorityCalibrationChange: number;
  affectedModules: string[];
  lastTrainingDate: string | null;
  lastWeeklySynthesisDate: string | null;
  learningDeltaSummary: string;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  decisionLevel: "learning_metrics_only";
}

export interface DnaLearningMetricsLedger {
  schemaVersion: "dna-learning-metrics-ledger-v0.1";
  generatedAt: string;
  purpose: "measurable_learning_metrics_only_not_model_weights";
  cadence: {
    chiefBrainTrainingEveryTwoDays: true;
    codexDevelopmentLessonEveryTwoDays: true;
    securityLessonEveryTwoDays: true;
    weeklyIntelligenceEveryWeek: true;
    weeklyChiefBrainSynthesisExtra: true;
    weeklySynthesisReplacesTwoDayTraining: false;
  };
  totalSeedKnowledgeRecords: number;
  totalDnaEntries: number;
  includesChiefBrainRootDna: true;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  metrics: DnaLearningMetricEntry[];
}

export interface DnaLearningMetricsSummary {
  trackerVersion: typeof DNA_LEARNING_METRICS_TRACKER_VERSION;
  generatedAt: string;
  dnaCount: number;
  includesChiefBrainRootDna: boolean;
  totalSeedKnowledgeRecords: number;
  totalLessonsReceived: number;
  totalWeeklyKnowledgeUpdates: number;
  totalRiskSignals: number;
  totalDebtSignals: number;
  fastestLearningDna: string[];
  needsMoreKnowledgeDna: string[];
  chiefBrainQualityChange: number;
  averageConfidenceBefore: number;
  averageConfidenceAfter: number;
  averageRecommendationQualityBefore: number;
  averageRecommendationQualityAfter: number;
  cadence: DnaLearningMetricsLedger["cadence"];
  readOnly: true;
  productBehaviorChanged: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
  note: string;
}

function defaultLedgerPath(): string {
  return path.resolve(
    process.cwd(),
    "runtime",
    "validation",
    "dna_learning_metrics",
    "dna_learning_metrics_ledger.json",
  );
}

function readLedger(filePath: string): DnaLearningMetricsLedger {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as DnaLearningMetricsLedger;
}

function avg(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function metricDelta(entry: DnaLearningMetricEntry): number {
  return Number(
    (
      entry.confidenceScoreAfter -
      entry.confidenceScoreBefore +
      entry.recommendationQualityAfter -
      entry.recommendationQualityBefore
    ).toFixed(3),
  );
}

export function loadDnaLearningMetricsLedger(options: {
  ledgerPath?: string;
} = {}): DnaLearningMetricsLedger {
  return readLedger(path.resolve(options.ledgerPath ?? defaultLedgerPath()));
}

export function buildDnaLearningMetricsSummary(options: {
  ledger?: DnaLearningMetricsLedger;
  generatedAt?: string;
} = {}): DnaLearningMetricsSummary {
  const ledger = options.ledger ?? loadDnaLearningMetricsLedger();
  const metrics = ledger.metrics;
  const chiefBrain = metrics.find((entry) => entry.dnaName === "Chief Brain / Root DNA");
  const sortedByDelta = [...metrics].sort((left, right) => metricDelta(right) - metricDelta(left));
  const sortedByNeed = [...metrics].sort(
    (left, right) =>
      left.totalSeedKnowledgeRecords + left.totalLessonsReceived * 3 -
      (right.totalSeedKnowledgeRecords + right.totalLessonsReceived * 3),
  );

  return {
    trackerVersion: DNA_LEARNING_METRICS_TRACKER_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    dnaCount: metrics.length,
    includesChiefBrainRootDna: ledger.includesChiefBrainRootDna,
    totalSeedKnowledgeRecords: ledger.totalSeedKnowledgeRecords,
    totalLessonsReceived: metrics.reduce((sum, entry) => sum + entry.totalLessonsReceived, 0),
    totalWeeklyKnowledgeUpdates: metrics.reduce((sum, entry) => sum + entry.totalWeeklyKnowledgeUpdates, 0),
    totalRiskSignals: metrics.reduce((sum, entry) => sum + entry.totalRiskSignals, 0),
    totalDebtSignals: metrics.reduce((sum, entry) => sum + entry.totalDebtSignals, 0),
    fastestLearningDna: sortedByDelta.slice(0, 5).map((entry) => entry.dnaName),
    needsMoreKnowledgeDna: sortedByNeed.slice(0, 5).map((entry) => entry.dnaName),
    chiefBrainQualityChange: chiefBrain
      ? Number((chiefBrain.recommendationQualityAfter - chiefBrain.recommendationQualityBefore).toFixed(3))
      : 0,
    averageConfidenceBefore: avg(metrics.map((entry) => entry.confidenceScoreBefore)),
    averageConfidenceAfter: avg(metrics.map((entry) => entry.confidenceScoreAfter)),
    averageRecommendationQualityBefore: avg(metrics.map((entry) => entry.recommendationQualityBefore)),
    averageRecommendationQualityAfter: avg(metrics.map((entry) => entry.recommendationQualityAfter)),
    cadence: ledger.cadence,
    readOnly: true,
    productBehaviorChanged: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
    note:
      "DNA learning metrics are measurable counters only, not neural-network weights. The tracker reads a local ledger, summarizes learning deltas and does not change product behavior or make final decisions.",
  };
}
