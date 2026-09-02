import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import type {
  ChiefBrainSeedSummaryReport,
} from "./chiefBrainSeedSummaryHelper";
import type {
  LocalSeedDnaName,
} from "./localSeedKnowledgeSchema";

export const CHIEF_BRAIN_RECOMMENDATION_QUALITY_SCORE_VERSION =
  "chief-brain-recommendation-quality-score-v0.1" as const;

export type ChiefBrainRecommendationDecisionLevel =
  | "support"
  | "advisory"
  | "recommendation";

export interface ChiefBrainRecommendationQualityInput {
  recommendationId: string;
  title: string;
  relatedDnaNames: readonly LocalSeedDnaName[];
  seedSummary: ChiefBrainSeedSummaryReport;
  basedOnSeedKnowledge: boolean;
  hasRealTancMarkOutcome: boolean;
  relatedDebtIds?: readonly string[];
  riskLevel: LearningDnaRiskLevel;
  requiresHumanApproval?: boolean;
  decisionLevel: ChiefBrainRecommendationDecisionLevel;
  claimsProductReady?: boolean;
  claimsFinalDecision?: boolean;
}

export interface ChiefBrainRecommendationQualityScore {
  scorerVersion: typeof CHIEF_BRAIN_RECOMMENDATION_QUALITY_SCORE_VERSION;
  recommendationId: string;
  title: string;
  relatedDnaNames: LocalSeedDnaName[];
  sourceSeedRecordCount: number;
  hasSeedKnowledgeSupport: boolean;
  hasRealTancMarkOutcome: boolean;
  relatedDebtIds: string[];
  riskLevel: LearningDnaRiskLevel;
  productReadyClaimBlocked: boolean;
  finalDecisionClaimBlocked: boolean;
  knowledgeCoverageScore: number;
  realOutcomeSupportScore: number;
  riskAwarenessScore: number;
  debtAlignmentScore: number;
  humanApprovalRequired: boolean;
  recommendationConfidence: number;
  decisionLevel: ChiefBrainRecommendationDecisionLevel;
  supportOnly: true;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  productBehaviorChanged: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
  explanation: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function riskAwarenessScore(
  riskLevel: LearningDnaRiskLevel,
  humanApprovalRequired: boolean,
): number {
  if (riskLevel === "high") return humanApprovalRequired ? 1 : 0.25;
  if (riskLevel === "medium") return humanApprovalRequired ? 0.9 : 0.65;
  return 0.85;
}

function seedRecordCountFor(
  seedSummary: ChiefBrainSeedSummaryReport,
  relatedDnaNames: readonly LocalSeedDnaName[],
): number {
  return seedSummary.dnaSummaries
    .filter((summary) => relatedDnaNames.includes(summary.dnaName))
    .reduce((sum, summary) => sum + summary.seedRecordCount, 0);
}

export function scoreChiefBrainRecommendationQuality(
  input: ChiefBrainRecommendationQualityInput,
): ChiefBrainRecommendationQualityScore {
  const relatedDnaNames = Array.from(new Set(input.relatedDnaNames));
  const sourceSeedRecordCount = seedRecordCountFor(input.seedSummary, relatedDnaNames);
  const hasSeedKnowledgeSupport = input.basedOnSeedKnowledge && sourceSeedRecordCount > 0;
  const productReadyClaimBlocked = input.claimsProductReady === true;
  const finalDecisionClaimBlocked = input.claimsFinalDecision === true;
  const relatedDebtIds = Array.from(new Set(input.relatedDebtIds ?? []));
  const humanApprovalRequired =
    input.requiresHumanApproval === true ||
    input.riskLevel === "high" ||
    productReadyClaimBlocked ||
    finalDecisionClaimBlocked;

  const knowledgeCoverageScore = round(
    clamp01(sourceSeedRecordCount / Math.max(1, relatedDnaNames.length * 8)),
  );
  const realOutcomeSupportScore = input.hasRealTancMarkOutcome ? 1 : 0;
  const riskScore = riskAwarenessScore(input.riskLevel, humanApprovalRequired);
  const debtAlignmentScore = relatedDebtIds.length > 0 ? 1 : 0.4;
  const blockedPenalty = productReadyClaimBlocked || finalDecisionClaimBlocked ? 0.35 : 1;
  const recommendationConfidence = round(
    clamp01(
      ((knowledgeCoverageScore * 0.4) +
        (realOutcomeSupportScore * 0.25) +
        (riskScore * 0.2) +
        (debtAlignmentScore * 0.15)) *
        blockedPenalty,
    ),
  );

  return {
    scorerVersion: CHIEF_BRAIN_RECOMMENDATION_QUALITY_SCORE_VERSION,
    recommendationId: input.recommendationId,
    title: input.title,
    relatedDnaNames,
    sourceSeedRecordCount,
    hasSeedKnowledgeSupport,
    hasRealTancMarkOutcome: input.hasRealTancMarkOutcome,
    relatedDebtIds,
    riskLevel: input.riskLevel,
    productReadyClaimBlocked,
    finalDecisionClaimBlocked,
    knowledgeCoverageScore,
    realOutcomeSupportScore,
    riskAwarenessScore: round(riskScore),
    debtAlignmentScore,
    humanApprovalRequired,
    recommendationConfidence,
    decisionLevel: input.decisionLevel,
    supportOnly: true,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    productBehaviorChanged: false,
    requiresHumanApprovalForHighRisk: true,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
    explanation:
      productReadyClaimBlocked || finalDecisionClaimBlocked
        ? "Recommendation quality score blocked product-ready/final claim and kept the result support-only."
        : "Recommendation quality score is support-only and cannot apply actions or create final decisions.",
  };
}

export function buildChiefBrainSeedRecommendationQualityScores(
  seedSummary: ChiefBrainSeedSummaryReport,
): ChiefBrainRecommendationQualityScore[] {
  return [
    scoreChiefBrainRecommendationQuality({
      recommendationId: "seed-quality-01-text-document-deepening",
      title: "Deepen Text/Document print-scan and copy-paste seed topics",
      relatedDnaNames: ["Text/Document DNA"],
      seedSummary,
      basedOnSeedKnowledge: true,
      hasRealTancMarkOutcome: false,
      relatedDebtIds: [],
      riskLevel: "low",
      requiresHumanApproval: false,
      decisionLevel: "recommendation",
    }),
    scoreChiefBrainRecommendationQuality({
      recommendationId: "seed-quality-02-discovery-api-pilot",
      title: "Prepare Discovery real API pilot outcome summaries",
      relatedDnaNames: ["Discovery/Search DNA", "Pricing/Cost DNA"],
      seedSummary,
      basedOnSeedKnowledge: true,
      hasRealTancMarkOutcome: false,
      relatedDebtIds: [],
      riskLevel: "high",
      requiresHumanApproval: true,
      decisionLevel: "recommendation",
    }),
    scoreChiefBrainRecommendationQuality({
      recommendationId: "seed-quality-03-tanclive-platform-results",
      title: "Prepare TancLive real platform result summaries",
      relatedDnaNames: ["TancLive DNA", "Evidence/Delil DNA"],
      seedSummary,
      basedOnSeedKnowledge: true,
      hasRealTancMarkOutcome: false,
      relatedDebtIds: [],
      riskLevel: "high",
      requiresHumanApproval: true,
      decisionLevel: "recommendation",
    }),
    scoreChiefBrainRecommendationQuality({
      recommendationId: "seed-quality-04-pricing-unit-cost",
      title: "Prepare real unit-cost measurement summaries",
      relatedDnaNames: ["Pricing/Cost DNA", "SaaS/Operations DNA"],
      seedSummary,
      basedOnSeedKnowledge: true,
      hasRealTancMarkOutcome: false,
      relatedDebtIds: [],
      riskLevel: "medium",
      requiresHumanApproval: true,
      decisionLevel: "recommendation",
    }),
  ];
}
