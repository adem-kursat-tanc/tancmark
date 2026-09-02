import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaEventInput,
  type LearningDnaModule,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import {
  buildLearningDnaRegistry,
  type LearningDnaRegistry,
  type LearningDnaRegistryEntry,
} from "./learningDnaRegistry";
import type {
  LearningDnaDebtItem,
  LearningDnaDebtReaderReport,
} from "./learningDnaDebtReader";

export const LEARNING_DNA_RECOMMENDATION_ENGINE_VERSION =
  "learning-dna-recommendation-engine-v0.1" as const;

export type LearningDnaRecommendationCategory =
  | "technical_debt"
  | "license_debt"
  | "test_debt"
  | "live_debt"
  | "discovery_debt"
  | "finance_cost_warning"
  | "security_warning"
  | "payment_subscription_debt"
  | "launch_debt"
  | "general";

export interface LearningDnaModulePerformance {
  module: LearningDnaModule;
  eventCount: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  highRiskCount: number;
  supportScoreAverage: number;
  status: "strong" | "weak" | "watch" | "no_data";
}

export interface LearningDnaSupportRecommendation {
  recommendationId: string;
  category: LearningDnaRecommendationCategory;
  title: string;
  riskLevel: LearningDnaRiskLevel;
  decisionLevel: "recommendation";
  supportOnly: true;
  reason: string;
  nextSuggestedAction: string;
  relatedModules: LearningDnaModule[];
  relatedDebtIds: string[];
  requiresHumanApproval: boolean;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  applied: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
}

export interface LearningDnaRecommendationReport {
  status: "learning_dna_recommendation_support_only_v0.1";
  engineVersion: typeof LEARNING_DNA_RECOMMENDATION_ENGINE_VERSION;
  generatedAt: string;
  registrySummary: LearningDnaRegistry["summary"];
  modulePerformance: LearningDnaModulePerformance[];
  strongestModules: LearningDnaModule[];
  weakestModules: LearningDnaModule[];
  openDebtCount: number;
  highRiskDebtCount: number;
  riskyTopics: string[];
  recommendations: LearningDnaSupportRecommendation[];
  supportOnly: true;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  productBehaviorChanged: false;
  safety: LearningDnaDecisionSafety;
}

export interface LearningDnaRecommendationInput {
  events?: readonly LearningDnaEventInput[];
  registry?: LearningDnaRegistry;
  debtReport?: LearningDnaDebtReaderReport;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function byModule(entries: readonly LearningDnaRegistryEntry[]): Map<LearningDnaModule, LearningDnaRegistryEntry[]> {
  const grouped = new Map<LearningDnaModule, LearningDnaRegistryEntry[]>();
  for (const entry of entries) {
    grouped.set(entry.module, [...(grouped.get(entry.module) ?? []), entry]);
  }
  return grouped;
}

function performanceFor(module: LearningDnaModule, entries: readonly LearningDnaRegistryEntry[]): LearningDnaModulePerformance {
  const eventCount = entries.length;
  const successCount = entries.filter((entry) => entry.success).length;
  const failureCount = entries.filter((entry) => entry.failed).length;
  const blockedCount = entries.filter((entry) => entry.blocked).length;
  const highRiskCount = entries.filter((entry) => entry.riskLevel === "high").length;
  const supportScoreAverage =
    eventCount > 0 ? round(entries.reduce((sum, entry) => sum + entry.event.supportScore, 0) / eventCount) : 0;
  const status =
    eventCount === 0
      ? "no_data"
      : failureCount + blockedCount > successCount
        ? "weak"
        : highRiskCount > 0
          ? "watch"
          : "strong";
  return {
    module,
    eventCount,
    successCount,
    failureCount,
    blockedCount,
    highRiskCount,
    supportScoreAverage,
    status,
  };
}

function buildModulePerformance(registry: LearningDnaRegistry): LearningDnaModulePerformance[] {
  return Array.from(byModule(registry.entries).entries())
    .map(([module, entries]) => performanceFor(module, entries))
    .sort((a, b) => b.supportScoreAverage - a.supportScoreAverage || b.eventCount - a.eventCount);
}

function openDebts(report: LearningDnaDebtReaderReport | undefined): LearningDnaDebtItem[] {
  return (report?.items ?? []).filter(
    (item) => item.status === "open" || item.status === "deferred" || item.status === "support_only",
  );
}

function topicIncludes(item: LearningDnaDebtItem, needles: readonly string[]): boolean {
  const haystack = `${item.topic} ${item.heading} ${item.summary} ${item.matchedKeywords.join(" ")}`.toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function debtIdsFor(debts: readonly LearningDnaDebtItem[], needles: readonly string[]): string[] {
  return debts
    .filter((item) => topicIncludes(item, needles))
    .slice(0, 8)
    .map((item) => item.debtId);
}

function registryHasModule(registry: LearningDnaRegistry, modules: readonly LearningDnaModule[]): boolean {
  return registry.entries.some((entry) => modules.includes(entry.module));
}

function addRecommendation(
  recommendations: LearningDnaSupportRecommendation[],
  input: Omit<
    LearningDnaSupportRecommendation,
    | "recommendationId"
    | "decisionLevel"
    | "supportOnly"
    | "approvalPhrase"
    | "applied"
    | "canOpenVault"
    | "canConfirmFinal"
    | "canChangeThreshold"
    | "canChangeOwnership"
  >,
): void {
  recommendations.push({
    recommendationId: `learning-dna-rec-${String(recommendations.length + 1).padStart(2, "0")}`,
    decisionLevel: "recommendation",
    supportOnly: true,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    applied: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    ...input,
  });
}

export function buildLearningDnaRecommendationReport(
  input: LearningDnaRecommendationInput = {},
): LearningDnaRecommendationReport {
  const registry = input.registry ?? buildLearningDnaRegistry(input.events ?? []);
  const modulePerformance = buildModulePerformance(registry);
  const strongestModules = modulePerformance
    .filter((item) => item.status === "strong")
    .slice(0, 3)
    .map((item) => item.module);
  const weakestModules = modulePerformance
    .filter((item) => item.status === "weak" || item.status === "watch")
    .slice(0, 3)
    .map((item) => item.module);
  const debts = openDebts(input.debtReport);
  const highRiskDebts = debts.filter((item) => item.riskLevel === "high");
  const recommendations: LearningDnaSupportRecommendation[] = [];

  if (strongestModules.length > 0) {
    addRecommendation(recommendations, {
      category: "general",
      title: "Reuse strongest support signals first",
      riskLevel: "low",
      reason: `Strong modules: ${strongestModules.join(", ")}.`,
      nextSuggestedAction:
        "Use these modules as support-priority hints in the next dry-run report only.",
      relatedModules: strongestModules,
      relatedDebtIds: [],
      requiresHumanApproval: false,
    });
  }

  if (weakestModules.length > 0) {
    addRecommendation(recommendations, {
      category: "technical_debt",
      title: "Review weak or risky DNA signal areas",
      riskLevel: "medium",
      reason: `Weak/watch modules: ${weakestModules.join(", ")}.`,
      nextSuggestedAction:
        "Prepare a small support-only hardening task; do not change VAULT, threshold, ownership or product behavior.",
      relatedModules: weakestModules,
      relatedDebtIds: [],
      requiresHumanApproval: true,
    });
  }

  if (debts.length > 0) {
    addRecommendation(recommendations, {
      category: "technical_debt",
      title: "Plan from open Learning DNA debt",
      riskLevel: highRiskDebts.length > 0 ? "high" : "medium",
      reason: `${debts.length} open/deferred/support-only Learning DNA debt item(s) found.`,
      nextSuggestedAction:
        "Draft the next Codex task from the debt list. High-risk work requires explicit approval.",
      relatedModules: [],
      relatedDebtIds: debts.slice(0, 8).map((item) => item.debtId),
      requiresHumanApproval: true,
    });
  }

  const licenseDebtIds = debtIdsFor(debts, ["license", "sbom", "notice", "ffmpeg", "model", "asset", "font"]);
  if (licenseDebtIds.length > 0 || registryHasModule(registry, ["license_product_gate"])) {
    addRecommendation(recommendations, {
      category: "license_debt",
      title: "Keep license and product gates ahead of release",
      riskLevel: licenseDebtIds.length > 0 ? "medium" : "low",
      reason: "License/product gate signals are present in the universal DNA scope.",
      nextSuggestedAction:
        "Use license gate signals for launch planning only; do not allow unknown, GPL/AGPL or unmanifested assets into product automatically.",
      relatedModules: ["license_product_gate"],
      relatedDebtIds: licenseDebtIds,
      requiresHumanApproval: licenseDebtIds.length > 0,
    });
  }

  const testDebtIds = debtIdsFor(debts, ["test", "proof", "corpus", "real-world", "printer", "scanner"]);
  if (testDebtIds.length > 0 || registryHasModule(registry, ["format_layers", "visual", "video", "audio", "text_document"])) {
    addRecommendation(recommendations, {
      category: "test_debt",
      title: "Plan remaining proof and corpus tests safely",
      riskLevel: testDebtIds.length > 0 ? "medium" : "low",
      reason: "Format and media signals need proof tracking without changing seal/read decisions.",
      nextSuggestedAction:
        "Prepare read-only test debt reports first; run new real-world tests only under a separate approved test task.",
      relatedModules: ["format_layers", "visual", "video", "audio", "text_document"],
      relatedDebtIds: testDebtIds,
      requiresHumanApproval: true,
    });
  }

  const liveDebtIds = debtIdsFor(debts, ["live", "tanclive", "rtmp", "hls", "platform", "mediamtx"]);
  if (liveDebtIds.length > 0 || registryHasModule(registry, ["live_tanclive"])) {
    addRecommendation(recommendations, {
      category: "live_debt",
      title: "Keep TancLive signals support-only until real platform proof",
      riskLevel: liveDebtIds.length > 0 ? "medium" : "low",
      reason: "Live signals can guide readiness but cannot decide final proof or VAULT.",
      nextSuggestedAction:
        "Track live latency, disconnect, HLS/VOD and post-live ID read as advisory signals; real platform tests need explicit approval.",
      relatedModules: ["live_tanclive"],
      relatedDebtIds: liveDebtIds,
      requiresHumanApproval: true,
    });
  }

  const discoveryDebtIds = debtIdsFor(debts, ["discovery", "search", "provider", "api pilot", "brave", "exa", "dataforseo"]);
  if (discoveryDebtIds.length > 0 || registryHasModule(registry, ["discovery_search"])) {
    addRecommendation(recommendations, {
      category: "discovery_debt",
      title: "Keep Discovery findings as candidate support",
      riskLevel: discoveryDebtIds.length > 0 ? "medium" : "low",
      reason: "Discovery/Search signals are useful for hints and cost learning, not final decisions.",
      nextSuggestedAction:
        "Use provider and cost signals only for search planning; exact TancMark ID remains required for VAULT.",
      relatedModules: ["discovery_search"],
      relatedDebtIds: discoveryDebtIds,
      requiresHumanApproval: discoveryDebtIds.length > 0,
    });
  }

  const financeDebtIds = debtIdsFor(debts, ["cost", "pricing", "margin", "billing", "payment", "subscription"]);
  const paymentDebtIds = debtIdsFor(debts, ["billing", "payment", "subscription", "invoice"]);
  if (
    financeDebtIds.length > 0 ||
    registryHasModule(registry, ["pricing_learning", "cost_margin", "finance", "payment", "subscription"])
  ) {
    addRecommendation(recommendations, {
      category: paymentDebtIds.length > 0 ? "payment_subscription_debt" : "finance_cost_warning",
      title: "Treat finance and payment signals as planning only",
      riskLevel: financeDebtIds.length > 0 ? "high" : "medium",
      reason: "Finance, payment and subscription signals can affect customers and require human approval.",
      nextSuggestedAction:
        "Record only safe payment outcome summaries; never store card data, secrets or tokens in DNA.",
      relatedModules: ["finance", "payment", "subscription", "pricing_learning", "cost_margin"],
      relatedDebtIds: financeDebtIds,
      requiresHumanApproval: true,
    });
  }

  const securityDebtIds = debtIdsFor(debts, ["security", "auth", "audit", "rate", "admin", "secret", "token"]);
  if (securityDebtIds.length > 0 || registryHasModule(registry, ["security", "auth", "admin", "api"])) {
    addRecommendation(recommendations, {
      category: "security_warning",
      title: "Human-review security and admin signals",
      riskLevel: securityDebtIds.length > 0 ? "high" : "medium",
      reason: "Security and admin signals are high-impact and must not be auto-applied.",
      nextSuggestedAction:
        "Prepare a separate security hardening task; high-risk work requires APPROVE_CHIEF_BRAIN_SAFE_ACTION.",
      relatedModules: ["security", "auth", "admin", "api"],
      relatedDebtIds: securityDebtIds,
      requiresHumanApproval: true,
    });
  }

  const launchDebtIds = debtIdsFor(debts, ["launch", "marketing", "legal", "contract", "sales", "beta", "landing"]);
  if (launchDebtIds.length > 0 || registryHasModule(registry, ["product", "marketing", "legal", "launch"])) {
    addRecommendation(recommendations, {
      category: "launch_debt",
      title: "Keep product, legal and launch work gated",
      riskLevel: launchDebtIds.length > 0 ? "medium" : "low",
      reason: "Launch-facing signals affect public claims, customer expectations and legal documents.",
      nextSuggestedAction:
        "Use these signals to prepare documents and readiness checklists only; product launch still requires human approval.",
      relatedModules: ["product", "marketing", "legal", "launch"],
      relatedDebtIds: launchDebtIds,
      requiresHumanApproval: true,
    });
  }

  if (recommendations.length === 0) {
    addRecommendation(recommendations, {
      category: "general",
      title: "Keep registry in observation mode",
      riskLevel: "low",
      reason: "No weak module or open Learning DNA debt was found in the supplied dry-run scope.",
      nextSuggestedAction:
        "Continue collecting support-only events before enabling any broader Chief Brain planning.",
      relatedModules: [],
      relatedDebtIds: [],
      requiresHumanApproval: false,
    });
  }

  return {
    status: "learning_dna_recommendation_support_only_v0.1",
    engineVersion: LEARNING_DNA_RECOMMENDATION_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    registrySummary: registry.summary,
    modulePerformance,
    strongestModules,
    weakestModules,
    openDebtCount: debts.length,
    highRiskDebtCount: highRiskDebts.length,
    riskyTopics: Array.from(new Set([...weakestModules, ...highRiskDebts.map((item) => item.topic)])),
    recommendations,
    supportOnly: true,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    productBehaviorChanged: false,
    safety: learningDnaDecisionSafety(),
  };
}
