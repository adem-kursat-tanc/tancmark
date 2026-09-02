import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const PRICING_COST_DNA_HEALTH_ENGINE_VERSION = "pricing-cost-dna-health-engine-v0.1" as const;

export interface PricingCostDnaHealthSummary extends HierarchicalDnaHealthSummary {
  pricingCostEngineVersion: typeof PRICING_COST_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  expensiveOperations: string[];
  packageLossRisks: string[];
  costlyModules: string[];
  priceLimitReviewItems: string[];
  canChangePricesOrCharge: false;
  nextPricingCostWork: string;
}

const PRICING_COST_LEARNS_FROM_SIGNALS = [
  "operation cost",
  "package profitability",
  "credit usage",
  "expensive operation warning",
  "live streaming cost",
  "Discovery API cost",
  "storage cost",
  "loss-making usage type",
  "price/margin suggestions",
] as const;

const PRICING_COST_ENGINE_CONFIG = {
  dnaName: "Pricing/Cost DNA",
  modules: [
    "pricing_learning",
    "cost_margin",
    "finance",
    "usage_limit",
    "live_tanclive",
    "discovery_search",
    "storage",
  ] as const,
  eventTypes: [
    "pricing_cost_signal",
    "finance_cost_signal",
    "usage_limit_signal",
    "live_signal",
    "discovery_signal",
    "storage_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "pricing",
    "price",
    "cost",
    "margin",
    "credit",
    "kontor",
    "package",
    "profit",
    "loss",
    "expensive",
    "live cost",
    "discovery api",
    "storage",
    "bandwidth",
    "compute",
    "finance",
  ] as const,
  readinessNote:
    "Pricing/Cost DNA summarizes cost pressure only; it cannot change prices, charge customers or modify package limits.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Build package cost and margin matrix",
      reason:
        "Live, Discovery, storage and compute costs must be summarized before package pricing and limits are finalized.",
      nextStep:
        "Prepare a support-only cost matrix for expensive operations, loss risks and price/limit review items.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildPricingCostDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): PricingCostDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(PRICING_COST_ENGINE_CONFIG, input);

  return {
    ...base,
    pricingCostEngineVersion: PRICING_COST_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: PRICING_COST_LEARNS_FROM_SIGNALS,
    expensiveOperations: [
      "real external Discovery API queries",
      "long live stream recording and storage",
      "large media processing and bandwidth-heavy delivery",
    ],
    packageLossRisks: [
      "unlimited live/video use without bandwidth and storage limits",
      "high-volume Discovery API usage without quota",
      "large file storage without retention and package limits",
    ],
    costlyModules: [
      "TancLive bandwidth/storage",
      "Discovery real API providers",
      "large video and evidence package storage",
    ],
    priceLimitReviewItems: [
      "package credits and fair-use limits",
      "expensive operation warnings",
      "per-module cost calibration before launch pricing",
    ],
    canChangePricesOrCharge: false,
    nextPricingCostWork:
      "Create a read-only Pricing/Cost matrix, then calibrate package limits before any billing or pricing change.",
  };
}
