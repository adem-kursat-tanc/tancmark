import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const DISCOVERY_SEARCH_DNA_HEALTH_ENGINE_VERSION =
  "discovery-search-dna-health-engine-v0.1" as const;

export interface DiscoverySearchDnaHealthSummary extends HierarchicalDnaHealthSummary {
  discoverySearchEngineVersion: typeof DISCOVERY_SEARCH_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestSearchPaths: string[];
  weakestSearchPaths: string[];
  realApiPilotRemaining: true;
  candidateOnlyResults: string[];
  reliableSourceSignals: string[];
  costRiskSignals: string[];
  canDiscoveryOpenVault: false;
  nextDiscoveryWork: string;
}

const DISCOVERY_SEARCH_LEARNS_FROM_SIGNALS = [
  "web search",
  "leak search",
  "copy search",
  "candidate results",
  "similar content results",
  "useful search route",
  "reliable source",
  "real API pilot debt",
  "API cost",
  "support/advisory only result",
] as const;

const DISCOVERY_SEARCH_ENGINE_CONFIG = {
  dnaName: "Discovery/Search DNA",
  modules: ["discovery_search", "pricing_learning", "cost_margin", "evidence", "license_product_gate"] as const,
  eventTypes: [
    "discovery_signal",
    "discovery_result",
    "pricing_cost_signal",
    "finance_cost_signal",
    "evidence_signal",
    "license_gate_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "discovery",
    "search",
    "web search",
    "leak",
    "copy",
    "candidate",
    "similar",
    "provider",
    "api",
    "pilot",
    "cost",
    "google",
    "github",
    "cse",
  ] as const,
  readinessNote:
    "Discovery/Search DNA summarizes search usefulness, source quality and cost only; candidates cannot open VAULT.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Keep Discovery results support-only until real API pilot",
      reason:
        "Discovery can find useful candidates, but real API pilots and false-positive controls remain separate product-readiness gates.",
      nextStep:
        "Prepare a support-only Discovery matrix for provider quality, candidate usefulness, source reliability and API cost.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildDiscoverySearchDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): DiscoverySearchDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(DISCOVERY_SEARCH_ENGINE_CONFIG, input);

  return {
    ...base,
    discoverySearchEngineVersion: DISCOVERY_SEARCH_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: DISCOVERY_SEARCH_LEARNS_FROM_SIGNALS,
    strongestSearchPaths: [
      "mock-first Discovery gateway and provider readiness summaries",
      "source/cost/provider panels that keep real API use opt-in",
      "search hints that stay candidate/support only",
    ],
    weakestSearchPaths: [
      "real external API pilots are still open debt",
      "closed/private pages cannot be treated as automatic proof",
      "similar content can create false positives without exact TancMark ID",
    ],
    realApiPilotRemaining: true,
    candidateOnlyResults: [
      "similar content result",
      "web search candidate",
      "copy/leak search hint",
      "source reliability signal without exact embedded ID",
    ],
    reliableSourceSignals: [
      "repeatable provider result",
      "low false-positive candidate history",
      "known public source with timestamped support evidence",
    ],
    costRiskSignals: [
      "high-cost provider query",
      "uncalibrated API quota",
      "real API pilot pending before package pricing claim",
    ],
    canDiscoveryOpenVault: false,
    nextDiscoveryWork:
      "Create a read-only Discovery provider/cost/candidate matrix, then run real API pilots only under explicit approval.",
  };
}
