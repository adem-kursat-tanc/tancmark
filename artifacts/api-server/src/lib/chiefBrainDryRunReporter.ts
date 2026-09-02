import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaEventInput,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import {
  buildLearningDnaRegistry,
  type LearningDnaRegistry,
} from "./learningDnaRegistry";
import {
  extractLearningDnaDebts,
  type LearningDnaDebtItem,
  type LearningDnaDebtReaderReport,
} from "./learningDnaDebtReader";
import {
  buildLearningDnaRecommendationReport,
  type LearningDnaModulePerformance,
  type LearningDnaRecommendationReport,
} from "./learningDnaRecommendationEngine";
import {
  LEARNING_DNA_UNIVERSAL_COVERAGE_MAP,
  type LearningDnaUniversalCoverageEntry,
} from "./learningDnaUniversalSignalAdapters";
import {
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";
import { buildFormatDnaHealth } from "./formatDnaHealthEngine";
import { buildVideoDnaHealth } from "./videoDnaHealthEngine";
import { buildTancLiveDnaHealth } from "./tancLiveDnaHealthEngine";
import { buildImageDnaHealth } from "./imageDnaHealthEngine";
import { buildAudioDnaHealth } from "./audioDnaHealthEngine";
import { buildTextDocumentDnaHealth } from "./textDocumentDnaHealthEngine";
import { buildDiscoverySearchDnaHealth } from "./discoverySearchDnaHealthEngine";
import { buildEvidenceDnaHealth } from "./evidenceDnaHealthEngine";
import { buildLicenseProductGateDnaHealth } from "./licenseProductGateDnaHealthEngine";
import { buildSecurityDnaHealth } from "./securityDnaHealthEngine";
import { buildPricingCostDnaHealth } from "./pricingCostDnaHealthEngine";
import { buildSaasOperationsDnaHealth } from "./saasOperationsDnaHealthEngine";
import { buildSecureRoomZehirDnaHealth } from "./secureRoomZehirDnaHealthEngine";
import { buildUserSubscriptionDnaHealth } from "./userSubscriptionDnaHealthEngine";
import { buildProductMarketingLegalDnaHealth } from "./productMarketingLegalDnaHealthEngine";
import {
  buildChiefBrainSeedSummaryReport,
  type ChiefBrainSeedSummaryReport,
} from "./chiefBrainSeedSummaryHelper";
import {
  buildChiefBrainSeedRecommendationQualityScores,
  type ChiefBrainRecommendationQualityScore,
} from "./chiefBrainRecommendationQualityScore";

export const CHIEF_BRAIN_DRY_RUN_REPORTER_VERSION = "chief-brain-dry-run-reporter-v0.1" as const;

const HIERARCHICAL_DNA_PHASE_2_NAMES = [
  "Format DNA",
  "Video DNA",
  "TancLive DNA",
  "Image DNA",
  "Audio DNA",
  "Text/Document DNA",
] as const;

const HIERARCHICAL_DNA_PHASE_3_NAMES = [
  ...HIERARCHICAL_DNA_PHASE_2_NAMES,
  "Discovery/Search DNA",
  "Evidence/Delil DNA",
  "License/Product Gate DNA",
] as const;

const HIERARCHICAL_DNA_PHASE_4_NAMES = [
  ...HIERARCHICAL_DNA_PHASE_3_NAMES,
  "Security DNA",
  "Pricing/Cost DNA",
  "SaaS/Operations DNA",
] as const;

const HIERARCHICAL_DNA_FINAL_PHASE_NAMES = [
  ...HIERARCHICAL_DNA_PHASE_4_NAMES,
  "Secure Room/Zehir DNA",
  "User/Subscription DNA",
  "Product/Marketing/Legal DNA",
] as const;

export interface ChiefBrainDryRunInput {
  events?: readonly LearningDnaEventInput[];
  registry?: LearningDnaRegistry;
  debtReport?: LearningDnaDebtReaderReport;
  hierarchicalDnaHealthSummaries?: readonly HierarchicalDnaHealthSummary[];
  seedSummaryReport?: ChiefBrainSeedSummaryReport;
  recommendationQualityScores?: readonly ChiefBrainRecommendationQualityScore[];
  generatedAt?: string;
}

export interface ChiefBrainDryRunRecommendation {
  recommendationId: string;
  riskLevel: LearningDnaRiskLevel;
  title: string;
  reason: string;
  nextSuggestedAction: string;
  relatedDebtIds: string[];
  requiresHumanApproval: boolean;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  applied: false;
  canOpenVault: false;
  canConfirmFinal: false;
}

export interface ChiefBrainHierarchicalDnaPhase1Overview {
  generalStatus: string;
  mostCriticalOpenWork: string;
  firstSuggestedAction: string;
  requiresHumanApproval: boolean;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  applied: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
}

export interface ChiefBrainDryRunReport {
  status: "chief_brain_dry_run_report_only_v0.1";
  reporterVersion: typeof CHIEF_BRAIN_DRY_RUN_REPORTER_VERSION;
  generatedAt: string;
  registry: LearningDnaRegistry;
  debtReport: LearningDnaDebtReaderReport;
  recommendationReport: LearningDnaRecommendationReport;
  modulePerformance: LearningDnaModulePerformance[];
  strongestModules: LearningDnaRecommendationReport["strongestModules"];
  weakestModules: LearningDnaRecommendationReport["weakestModules"];
  riskyTopics: string[];
  universalCoverageAreas: readonly LearningDnaUniversalCoverageEntry[];
  universalCoverageDomainCount: number;
  universalCoverageSafeSummaryOnly: true;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  hierarchicalDnaPhase1Summaries: readonly HierarchicalDnaHealthSummary[];
  hierarchicalDnaPhase1Overview: ChiefBrainHierarchicalDnaPhase1Overview;
  hierarchicalDnaPhase2Summaries: readonly HierarchicalDnaHealthSummary[];
  hierarchicalDnaPhase2Overview: ChiefBrainHierarchicalDnaPhase1Overview;
  hierarchicalDnaPhase3Summaries: readonly HierarchicalDnaHealthSummary[];
  hierarchicalDnaPhase3Overview: ChiefBrainHierarchicalDnaPhase1Overview;
  hierarchicalDnaPhase4Summaries: readonly HierarchicalDnaHealthSummary[];
  hierarchicalDnaPhase4Overview: ChiefBrainHierarchicalDnaPhase1Overview;
  hierarchicalDnaFinalPhaseSummaries: readonly HierarchicalDnaHealthSummary[];
  hierarchicalDnaFinalPhaseOverview: ChiefBrainHierarchicalDnaPhase1Overview;
  seedSummaryReport: ChiefBrainSeedSummaryReport;
  seedSummaryReadOnly: true;
  seedSummaryDnaCount: number;
  seedSummaryRecordCount: number;
  recommendationQualityScores: readonly ChiefBrainRecommendationQualityScore[];
  recommendationQualityScoreCount: number;
  recommendationQualityScoreDecisionLevel: "support_advisory_recommendation_only";
  productReadyClaimsBlockedByQualityScore: boolean;
  seedDeepeningBacklog: string[];
  nextSuggestedAction: string;
  riskSummary: Record<LearningDnaRiskLevel, number>;
  openDebtCount: number;
  highRiskApprovalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  recommendations: ChiefBrainDryRunRecommendation[];
  appliedActions: [];
  chiefBrainDecides: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canChangePreSeal: false;
  productBehaviorChanged: false;
  requiresHumanApprovalForHighRisk: true;
  safety: LearningDnaDecisionSafety;
  note: string;
}

function emptyDebtReport(): LearningDnaDebtReaderReport {
  return extractLearningDnaDebts("", "no-ledger-input");
}

function riskSummary(debts: readonly LearningDnaDebtItem[]): Record<LearningDnaRiskLevel, number> {
  return {
    low: debts.filter((item) => item.riskLevel === "low").length,
    medium: debts.filter((item) => item.riskLevel === "medium").length,
    high: debts.filter((item) => item.riskLevel === "high").length,
  };
}

function firstOpenDebts(debts: readonly LearningDnaDebtItem[]): LearningDnaDebtItem[] {
  return debts
    .filter((item) => item.status === "open" || item.status === "deferred" || item.status === "support_only")
    .slice(0, 5);
}

function buildRecommendations(
  registry: LearningDnaRegistry,
  debtReport: LearningDnaDebtReaderReport,
  recommendationReport: LearningDnaRecommendationReport,
): ChiefBrainDryRunRecommendation[] {
  const openDebts = firstOpenDebts(debtReport.items);
  const recommendations: ChiefBrainDryRunRecommendation[] = [];

  recommendations.push({
    recommendationId: "chief-dry-run-01-keep-registry-support-only",
    riskLevel: "low",
    title: "Keep Learning DNA registry support-only",
    reason: `${registry.summary.entryCount} registry event(s) are advisory/support records, not final decisions.`,
    nextSuggestedAction:
      "Continue with read-only DNA registry and event schema before any Chief Brain activation.",
    relatedDebtIds: [],
    requiresHumanApproval: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    applied: false,
    canOpenVault: false,
    canConfirmFinal: false,
  });

  if (openDebts.length > 0) {
    recommendations.push({
      recommendationId: "chief-dry-run-02-read-debt-before-action",
      riskLevel: "medium",
      title: "Read debt ledger before planning next DNA work",
      reason: `${openDebts.length} Learning DNA / Chief Brain related ledger item(s) were found in dry-run scope.`,
      nextSuggestedAction:
        "Prepare a support-only task draft from the debt list; do not patch, deploy or change product behavior automatically.",
      relatedDebtIds: openDebts.map((item) => item.debtId),
      requiresHumanApproval: true,
      approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
      applied: false,
      canOpenVault: false,
      canConfirmFinal: false,
    });
  }

  if (debtReport.highRiskDebtCount > 0 || registry.summary.highRiskCount > 0) {
    recommendations.push({
      recommendationId: "chief-dry-run-03-high-risk-human-gate",
      riskLevel: "high",
      title: "High-risk items require explicit approval",
      reason:
        "High-risk registry or debt signal touches sensitive planning boundaries and cannot be auto-applied.",
      nextSuggestedAction:
        "Require APPROVE_CHIEF_BRAIN_SAFE_ACTION before any future high-risk implementation task.",
      relatedDebtIds: debtReport.items
        .filter((item) => item.riskLevel === "high")
        .map((item) => item.debtId),
      requiresHumanApproval: true,
      approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
      applied: false,
      canOpenVault: false,
      canConfirmFinal: false,
    });
  }

  for (const recommendation of recommendationReport.recommendations) {
    recommendations.push({
      recommendationId: `chief-dry-run-${recommendation.recommendationId}`,
      riskLevel: recommendation.riskLevel,
      title: recommendation.title,
      reason: recommendation.reason,
      nextSuggestedAction: recommendation.nextSuggestedAction,
      relatedDebtIds: recommendation.relatedDebtIds,
      requiresHumanApproval: recommendation.requiresHumanApproval,
      approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
      applied: false,
      canOpenVault: false,
      canConfirmFinal: false,
    });
  }

  return recommendations;
}

function buildDefaultHierarchicalDnaPhase1Summaries(
  registry: LearningDnaRegistry,
  debtReport: LearningDnaDebtReaderReport,
  generatedAt: string,
): readonly HierarchicalDnaHealthSummary[] {
  return [
    buildFormatDnaHealth({ registry, debtReport, generatedAt }),
    buildVideoDnaHealth({ registry, debtReport, generatedAt }),
    buildTancLiveDnaHealth({ registry, debtReport, generatedAt }),
  ];
}

function buildDefaultHierarchicalDnaPhase2Summaries(
  registry: LearningDnaRegistry,
  debtReport: LearningDnaDebtReaderReport,
  generatedAt: string,
): readonly HierarchicalDnaHealthSummary[] {
  return [
    buildFormatDnaHealth({ registry, debtReport, generatedAt }),
    buildVideoDnaHealth({ registry, debtReport, generatedAt }),
    buildTancLiveDnaHealth({ registry, debtReport, generatedAt }),
    buildImageDnaHealth({ registry, debtReport, generatedAt }),
    buildAudioDnaHealth({ registry, debtReport, generatedAt }),
    buildTextDocumentDnaHealth({ registry, debtReport, generatedAt }),
  ];
}

function buildDefaultHierarchicalDnaPhase3Summaries(
  registry: LearningDnaRegistry,
  debtReport: LearningDnaDebtReaderReport,
  generatedAt: string,
): readonly HierarchicalDnaHealthSummary[] {
  return [
    buildFormatDnaHealth({ registry, debtReport, generatedAt }),
    buildVideoDnaHealth({ registry, debtReport, generatedAt }),
    buildTancLiveDnaHealth({ registry, debtReport, generatedAt }),
    buildImageDnaHealth({ registry, debtReport, generatedAt }),
    buildAudioDnaHealth({ registry, debtReport, generatedAt }),
    buildTextDocumentDnaHealth({ registry, debtReport, generatedAt }),
    buildDiscoverySearchDnaHealth({ registry, debtReport, generatedAt }),
    buildEvidenceDnaHealth({ registry, debtReport, generatedAt }),
    buildLicenseProductGateDnaHealth({ registry, debtReport, generatedAt }),
  ];
}

function buildDefaultHierarchicalDnaPhase4Summaries(
  registry: LearningDnaRegistry,
  debtReport: LearningDnaDebtReaderReport,
  generatedAt: string,
): readonly HierarchicalDnaHealthSummary[] {
  return [
    buildFormatDnaHealth({ registry, debtReport, generatedAt }),
    buildVideoDnaHealth({ registry, debtReport, generatedAt }),
    buildTancLiveDnaHealth({ registry, debtReport, generatedAt }),
    buildImageDnaHealth({ registry, debtReport, generatedAt }),
    buildAudioDnaHealth({ registry, debtReport, generatedAt }),
    buildTextDocumentDnaHealth({ registry, debtReport, generatedAt }),
    buildDiscoverySearchDnaHealth({ registry, debtReport, generatedAt }),
    buildEvidenceDnaHealth({ registry, debtReport, generatedAt }),
    buildLicenseProductGateDnaHealth({ registry, debtReport, generatedAt }),
    buildSecurityDnaHealth({ registry, debtReport, generatedAt }),
    buildPricingCostDnaHealth({ registry, debtReport, generatedAt }),
    buildSaasOperationsDnaHealth({ registry, debtReport, generatedAt }),
  ];
}

function buildDefaultHierarchicalDnaFinalPhaseSummaries(
  registry: LearningDnaRegistry,
  debtReport: LearningDnaDebtReaderReport,
  generatedAt: string,
): readonly HierarchicalDnaHealthSummary[] {
  return [
    buildFormatDnaHealth({ registry, debtReport, generatedAt }),
    buildVideoDnaHealth({ registry, debtReport, generatedAt }),
    buildTancLiveDnaHealth({ registry, debtReport, generatedAt }),
    buildImageDnaHealth({ registry, debtReport, generatedAt }),
    buildAudioDnaHealth({ registry, debtReport, generatedAt }),
    buildTextDocumentDnaHealth({ registry, debtReport, generatedAt }),
    buildDiscoverySearchDnaHealth({ registry, debtReport, generatedAt }),
    buildEvidenceDnaHealth({ registry, debtReport, generatedAt }),
    buildLicenseProductGateDnaHealth({ registry, debtReport, generatedAt }),
    buildSecurityDnaHealth({ registry, debtReport, generatedAt }),
    buildPricingCostDnaHealth({ registry, debtReport, generatedAt }),
    buildSaasOperationsDnaHealth({ registry, debtReport, generatedAt }),
    buildSecureRoomZehirDnaHealth({ registry, debtReport, generatedAt }),
    buildUserSubscriptionDnaHealth({ registry, debtReport, generatedAt }),
    buildProductMarketingLegalDnaHealth({ registry, debtReport, generatedAt }),
  ];
}

function buildHierarchicalDnaPhase1Overview(
  summaries: readonly HierarchicalDnaHealthSummary[],
): ChiefBrainHierarchicalDnaPhase1Overview {
  const highRiskSummary = summaries.find(
    (summary) =>
      summary.requiredHumanApproval ||
      summary.moduleHealth.highRiskCount > 0 ||
      summary.recommendedNextActions.some((action) => action.riskLevel === "high"),
  );
  const firstAction =
    highRiskSummary?.recommendedNextActions.find((action) => action.riskLevel === "high") ??
    highRiskSummary?.recommendedNextActions[0] ??
    summaries.flatMap((summary) => summary.recommendedNextActions)[0];
  const requiresHumanApproval = summaries.some((summary) => summary.requiredHumanApproval);

  return {
    generalStatus:
      summaries.length === 0
        ? "No hierarchical DNA health summary supplied."
        : `Chief Brain dry-run read ${summaries.length} Sub DNA health summary/summaries: ${summaries
            .map((summary) => summary.dnaName)
            .join(", ")}.`,
    mostCriticalOpenWork:
      highRiskSummary?.openDebts[0]?.heading ??
      highRiskSummary?.latestRisks[0]?.method ??
      "No high-risk Phase 1 Sub DNA issue was found in the supplied dry-run scope.",
    firstSuggestedAction:
      firstAction?.nextStep ??
      "Keep Format DNA, Video DNA and TancLive DNA in read-only support mode.",
    requiresHumanApproval,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    applied: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
  };
}

export function buildChiefBrainDryRunReport(input: ChiefBrainDryRunInput = {}): ChiefBrainDryRunReport {
  const registry = input.registry ?? buildLearningDnaRegistry(input.events ?? []);
  const debtReport = input.debtReport ?? emptyDebtReport();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const suppliedHierarchicalDnaSummaries =
    input.hierarchicalDnaHealthSummaries ??
    buildDefaultHierarchicalDnaFinalPhaseSummaries(registry, debtReport, generatedAt);
  const finalPhaseNames = new Set<string>(HIERARCHICAL_DNA_FINAL_PHASE_NAMES);
  const phase4Names = new Set<string>(HIERARCHICAL_DNA_PHASE_4_NAMES);
  const phase3Names = new Set<string>(HIERARCHICAL_DNA_PHASE_3_NAMES);
  const filteredHierarchicalDnaFinalPhaseSummaries = suppliedHierarchicalDnaSummaries.filter((summary) =>
    finalPhaseNames.has(summary.dnaName),
  );
  const hierarchicalDnaFinalPhaseSummaries =
    filteredHierarchicalDnaFinalPhaseSummaries.length > 0
      ? filteredHierarchicalDnaFinalPhaseSummaries
      : buildDefaultHierarchicalDnaFinalPhaseSummaries(registry, debtReport, generatedAt);
  const filteredHierarchicalDnaPhase4Summaries = hierarchicalDnaFinalPhaseSummaries.filter((summary) =>
    phase4Names.has(summary.dnaName),
  );
  const hierarchicalDnaPhase4Summaries =
    filteredHierarchicalDnaPhase4Summaries.length > 0
      ? filteredHierarchicalDnaPhase4Summaries
      : buildDefaultHierarchicalDnaPhase4Summaries(registry, debtReport, generatedAt);
  const filteredHierarchicalDnaPhase3Summaries = hierarchicalDnaPhase4Summaries.filter((summary) =>
    phase3Names.has(summary.dnaName),
  );
  const hierarchicalDnaPhase3Summaries =
    filteredHierarchicalDnaPhase3Summaries.length > 0
      ? filteredHierarchicalDnaPhase3Summaries
      : buildDefaultHierarchicalDnaPhase3Summaries(registry, debtReport, generatedAt);
  const phase1Names = new Set<string>(HIERARCHICAL_DNA_PHASE_2_NAMES.slice(0, 3));
  const phase2Names = new Set<string>(HIERARCHICAL_DNA_PHASE_2_NAMES);
  const hierarchicalDnaPhase1Summaries = hierarchicalDnaPhase3Summaries.filter((summary) =>
    phase1Names.has(summary.dnaName),
  );
  const hierarchicalDnaPhase2Summaries = hierarchicalDnaPhase3Summaries.filter((summary) =>
    phase2Names.has(summary.dnaName),
  );
  const fallbackPhase1Summaries =
    hierarchicalDnaPhase1Summaries.length > 0
      ? hierarchicalDnaPhase1Summaries
      : buildDefaultHierarchicalDnaPhase1Summaries(registry, debtReport, generatedAt);
  const fallbackPhase2Summaries =
    hierarchicalDnaPhase2Summaries.length > 0
      ? hierarchicalDnaPhase2Summaries
      : buildDefaultHierarchicalDnaPhase2Summaries(registry, debtReport, generatedAt);
  const hierarchicalDnaPhase1Overview =
    buildHierarchicalDnaPhase1Overview(fallbackPhase1Summaries);
  const hierarchicalDnaPhase2Overview =
    buildHierarchicalDnaPhase1Overview(fallbackPhase2Summaries);
  const hierarchicalDnaPhase3Overview =
    buildHierarchicalDnaPhase1Overview(hierarchicalDnaPhase3Summaries);
  const hierarchicalDnaPhase4Overview =
    buildHierarchicalDnaPhase1Overview(hierarchicalDnaPhase4Summaries);
  const hierarchicalDnaFinalPhaseOverview =
    buildHierarchicalDnaPhase1Overview(hierarchicalDnaFinalPhaseSummaries);
  const recommendationReport = buildLearningDnaRecommendationReport({
    registry,
    debtReport,
  });
  const seedSummaryReport =
    input.seedSummaryReport ??
    buildChiefBrainSeedSummaryReport({
      generatedAt,
    });
  const recommendationQualityScores =
    input.recommendationQualityScores ??
    buildChiefBrainSeedRecommendationQualityScores(seedSummaryReport);
  const firstRecommendation = recommendationReport.recommendations[0];

  return {
    status: "chief_brain_dry_run_report_only_v0.1",
    reporterVersion: CHIEF_BRAIN_DRY_RUN_REPORTER_VERSION,
    generatedAt,
    registry,
    debtReport,
    recommendationReport,
    modulePerformance: recommendationReport.modulePerformance,
    strongestModules: recommendationReport.strongestModules,
    weakestModules: recommendationReport.weakestModules,
    riskyTopics: recommendationReport.riskyTopics,
    universalCoverageAreas: LEARNING_DNA_UNIVERSAL_COVERAGE_MAP,
    universalCoverageDomainCount: LEARNING_DNA_UNIVERSAL_COVERAGE_MAP.length,
    universalCoverageSafeSummaryOnly: true,
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    hierarchicalDnaPhase1Summaries: fallbackPhase1Summaries,
    hierarchicalDnaPhase1Overview,
    hierarchicalDnaPhase2Summaries: fallbackPhase2Summaries,
    hierarchicalDnaPhase2Overview,
    hierarchicalDnaPhase3Summaries,
    hierarchicalDnaPhase3Overview,
    hierarchicalDnaPhase4Summaries,
    hierarchicalDnaPhase4Overview,
    hierarchicalDnaFinalPhaseSummaries,
    hierarchicalDnaFinalPhaseOverview,
    seedSummaryReport,
    seedSummaryReadOnly: true,
    seedSummaryDnaCount: seedSummaryReport.totalDnaCount,
    seedSummaryRecordCount: seedSummaryReport.totalSeedRecordCount,
    recommendationQualityScores,
    recommendationQualityScoreCount: recommendationQualityScores.length,
    recommendationQualityScoreDecisionLevel: "support_advisory_recommendation_only",
    productReadyClaimsBlockedByQualityScore: recommendationQualityScores.every(
      (score) => score.canOpenVault === false && score.canConfirmFinal === false,
    ),
    seedDeepeningBacklog: seedSummaryReport.weakestOrDeepeningAreas,
    nextSuggestedAction:
      hierarchicalDnaFinalPhaseOverview.firstSuggestedAction ||
      hierarchicalDnaPhase4Overview.firstSuggestedAction ||
      (firstRecommendation?.nextSuggestedAction ??
        "Continue collecting support-only DNA events before activating any Chief Brain task."),
    riskSummary: riskSummary(debtReport.items),
    openDebtCount: debtReport.openDebtCount,
    highRiskApprovalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    recommendations: buildRecommendations(registry, debtReport, recommendationReport),
    appliedActions: [],
    chiefBrainDecides: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    canChangePreSeal: false,
    productBehaviorChanged: false,
    requiresHumanApprovalForHighRisk: true,
    safety: learningDnaDecisionSafety(),
    note:
      "This is a dry-run report foundation only. Chief Brain does not execute actions, change product behavior, open VAULT, confirm/finalize, change thresholds, or change ownership/pre-seal.",
  };
}

export function buildChiefBrainDryRunReportFromLedgerText(
  ledgerText: string,
  events: readonly LearningDnaEventInput[] = [],
): ChiefBrainDryRunReport {
  return buildChiefBrainDryRunReport({
    events,
    debtReport: extractLearningDnaDebts(ledgerText),
  });
}
