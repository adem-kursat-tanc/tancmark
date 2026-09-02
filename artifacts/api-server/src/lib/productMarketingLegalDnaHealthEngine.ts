import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const PRODUCT_MARKETING_LEGAL_DNA_HEALTH_ENGINE_VERSION =
  "product-marketing-legal-dna-health-engine-v0.1" as const;

export interface ProductMarketingLegalDnaHealthSummary extends HierarchicalDnaHealthSummary {
  productMarketingLegalEngineVersion: typeof PRODUCT_MARKETING_LEGAL_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  productReadinessSignals: string[];
  marketingReadinessSignals: string[];
  legalReadinessSignals: string[];
  launchDebtSignals: string[];
  canPublishClaimOrLegalFinal: false;
  nextProductMarketingLegalWork: string;
}

const PRODUCT_MARKETING_LEGAL_LEARNS_FROM_SIGNALS = [
  "landing page",
  "demo video",
  "sales document",
  "pricing packages",
  "beta customer",
  "terms of use",
  "privacy policy",
  "brand/patent/utility model",
  "launch debts",
  "legal text gaps",
] as const;

const PRODUCT_MARKETING_LEGAL_ENGINE_CONFIG = {
  dnaName: "Product/Marketing/Legal DNA",
  modules: ["product", "marketing", "legal", "launch", "pricing_learning", "license_product_gate"] as const,
  eventTypes: [
    "product_signal",
    "marketing_signal",
    "legal_signal",
    "launch_signal",
    "pricing_cost_signal",
    "license_gate_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "product",
    "marketing",
    "landing",
    "demo",
    "sales",
    "pricing",
    "beta",
    "terms",
    "privacy",
    "legal",
    "brand",
    "patent",
    "utility model",
    "launch",
  ] as const,
  readinessNote:
    "Product/Marketing/Legal DNA summarizes launch readiness only; it cannot publish claims, approve legal text or change pricing.",
  defaultActions: [
    {
      riskLevel: "high" as const,
      title: "Keep legal and launch claims human-reviewed",
      reason:
        "Sales claims, legal texts, pricing packages and patent/brand statements require human/legal approval before launch.",
      nextStep:
        "Require APPROVE_CHIEF_BRAIN_SAFE_ACTION before any high-risk product, marketing or legal launch task.",
      requiresHumanApproval: true,
    },
  ],
};

export function buildProductMarketingLegalDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): ProductMarketingLegalDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(PRODUCT_MARKETING_LEGAL_ENGINE_CONFIG, input);

  return {
    ...base,
    productMarketingLegalEngineVersion: PRODUCT_MARKETING_LEGAL_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: PRODUCT_MARKETING_LEGAL_LEARNS_FROM_SIGNALS,
    productReadinessSignals: [
      "Creator App and TancLive product state summary",
      "pricing package readiness summary",
      "beta customer feedback summary without customer content",
    ],
    marketingReadinessSignals: [
      "landing page readiness summary",
      "demo video readiness summary",
      "sales document readiness summary",
    ],
    legalReadinessSignals: [
      "terms of use gap summary",
      "privacy policy gap summary",
      "brand/patent/utility model review summary",
    ],
    launchDebtSignals: [
      "launch debt summary",
      "legal text missing-item summary",
      "human/legal approval required for final wording",
    ],
    canPublishClaimOrLegalFinal: false,
    nextProductMarketingLegalWork:
      "Create a read-only Product/Marketing/Legal matrix for launch pages, sales claims, legal text and brand/patent readiness.",
  };
}
