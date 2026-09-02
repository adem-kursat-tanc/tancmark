import {
  buildDnaLearningMetricsSummary,
  type DnaLearningMetricsSummary,
} from "./dnaLearningMetricsTracker";
import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";

export const CHIEF_BRAIN_WEEKLY_SYNTHESIS_BUILDER_VERSION =
  "chief-brain-weekly-synthesis-builder-v0.1" as const;

export interface ChiefBrainWeeklySynthesisReport {
  builderVersion: typeof CHIEF_BRAIN_WEEKLY_SYNTHESIS_BUILDER_VERSION;
  generatedAt: string;
  cadence: {
    chiefBrainTrainingEveryTwoDays: true;
    weeklySynthesisExtra: true;
    weeklySynthesisReplacesTwoDayTraining: false;
  };
  metricsSummary: DnaLearningMetricsSummary;
  dnaCount: number;
  fastestLearningDna: string[];
  needsMoreKnowledgeDna: string[];
  chiefBrainQualityChange: number;
  weeklyLearningSummary: string;
  highRiskHumanApprovalRequired: true;
  readOnly: true;
  actionsApplied: 0;
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

export function buildChiefBrainWeeklySynthesisReport(options: {
  metricsSummary?: DnaLearningMetricsSummary;
  generatedAt?: string;
} = {}): ChiefBrainWeeklySynthesisReport {
  const metricsSummary = options.metricsSummary ?? buildDnaLearningMetricsSummary();

  return {
    builderVersion: CHIEF_BRAIN_WEEKLY_SYNTHESIS_BUILDER_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    cadence: {
      chiefBrainTrainingEveryTwoDays: true,
      weeklySynthesisExtra: true,
      weeklySynthesisReplacesTwoDayTraining: false,
    },
    metricsSummary,
    dnaCount: metricsSummary.dnaCount,
    fastestLearningDna: metricsSummary.fastestLearningDna,
    needsMoreKnowledgeDna: metricsSummary.needsMoreKnowledgeDna,
    chiefBrainQualityChange: metricsSummary.chiefBrainQualityChange,
    weeklyLearningSummary:
      `Weekly synthesis read ${metricsSummary.dnaCount} DNA metric entries, ` +
      `${metricsSummary.totalSeedKnowledgeRecords} seed records, ` +
      `${metricsSummary.totalLessonsReceived} lesson signals and ` +
      `${metricsSummary.totalWeeklyKnowledgeUpdates} weekly update signals.`,
    highRiskHumanApprovalRequired: true,
    readOnly: true,
    actionsApplied: 0,
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
      "Weekly synthesis is extra training on top of the 2-day Chief Brain cycle. It reads local DNA learning metrics only and does not apply actions, change product behavior, call external APIs, open VAULT or create final decisions.",
  };
}
