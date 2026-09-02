import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionLevel,
  type LearningDnaDecisionSafety,
  type LearningDnaEventInput,
  type LearningDnaEventType,
  type LearningDnaModule,
  type LearningDnaReadinessState,
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

export const HIERARCHICAL_DNA_BASE_ENGINE_VERSION =
  "hierarchical-dna-base-engine-v0.1" as const;

export type HierarchicalDnaHealthStatus = "strong" | "watch" | "weak" | "no_data";

export interface HierarchicalDnaModuleHealth {
  status: HierarchicalDnaHealthStatus;
  eventCount: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  highRiskCount: number;
  supportScoreAverage: number;
}

export interface HierarchicalDnaDebtSummary {
  debtId: string;
  topic: string;
  heading: string;
  status: string;
  riskLevel: LearningDnaRiskLevel;
}

export interface HierarchicalDnaRiskSummary {
  eventId: string;
  module: LearningDnaModule;
  eventType: LearningDnaEventType;
  riskLevel: LearningDnaRiskLevel;
  readinessState: LearningDnaReadinessState;
  method: string;
}

export interface HierarchicalDnaPatternSummary {
  method: string;
  count: number;
  modules: LearningDnaModule[];
}

export interface HierarchicalDnaCostSignal {
  eventId: string;
  module: LearningDnaModule;
  method: string;
  riskLevel: LearningDnaRiskLevel;
  supportScore: number;
}

export interface HierarchicalDnaProductReadiness {
  productReadyCount: number;
  supportOnlyCount: number;
  labOnlyCount: number;
  deferredCount: number;
  status: "product_ready_signals_present" | "support_only" | "lab_or_deferred_present" | "no_data";
  note: string;
}

export interface HierarchicalDnaRecommendedAction {
  actionId: string;
  riskLevel: LearningDnaRiskLevel;
  title: string;
  reason: string;
  nextStep: string;
  requiresHumanApproval: boolean;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  applied: false;
}

export interface HierarchicalDnaHealthSummary {
  engineVersion: typeof HIERARCHICAL_DNA_BASE_ENGINE_VERSION;
  dnaName: string;
  generatedAt: string;
  moduleHealth: HierarchicalDnaModuleHealth;
  openDebts: HierarchicalDnaDebtSummary[];
  latestRisks: HierarchicalDnaRiskSummary[];
  successPatterns: HierarchicalDnaPatternSummary[];
  failurePatterns: HierarchicalDnaPatternSummary[];
  costSignals: HierarchicalDnaCostSignal[];
  productReadiness: HierarchicalDnaProductReadiness;
  recommendedNextActions: HierarchicalDnaRecommendedAction[];
  requiredHumanApproval: boolean;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  decisionLevel: LearningDnaDecisionLevel;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  productBehaviorChanged: false;
  safety: LearningDnaDecisionSafety;
  note: string;
}

export interface HierarchicalDnaBaseEngineConfig {
  dnaName: string;
  modules: readonly LearningDnaModule[];
  eventTypes: readonly LearningDnaEventType[];
  debtKeywords: readonly string[];
  defaultActions: readonly Omit<
    HierarchicalDnaRecommendedAction,
    "actionId" | "approvalPhrase" | "applied"
  >[];
  readinessNote: string;
}

export interface HierarchicalDnaBaseEngineInput {
  events?: readonly LearningDnaEventInput[];
  registry?: LearningDnaRegistry;
  debtReport?: LearningDnaDebtReaderReport;
  generatedAt?: string;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function registryFromInput(input: HierarchicalDnaBaseEngineInput): LearningDnaRegistry {
  return input.registry ?? buildLearningDnaRegistry(input.events ?? []);
}

function matchesConfig(entry: LearningDnaRegistryEntry, config: HierarchicalDnaBaseEngineConfig): boolean {
  return config.modules.includes(entry.module) || config.eventTypes.includes(entry.eventType);
}

function debtMatches(item: LearningDnaDebtItem, keywords: readonly string[]): boolean {
  const haystack = `${item.topic} ${item.heading} ${item.summary} ${item.matchedKeywords.join(" ")}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function moduleHealth(entries: readonly LearningDnaRegistryEntry[]): HierarchicalDnaModuleHealth {
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
      : highRiskCount > 0 || blockedCount > 0
        ? "watch"
        : failureCount > successCount
          ? "weak"
          : "strong";

  return {
    status,
    eventCount,
    successCount,
    failureCount,
    blockedCount,
    highRiskCount,
    supportScoreAverage,
  };
}

function openDebts(
  debtReport: LearningDnaDebtReaderReport | undefined,
  config: HierarchicalDnaBaseEngineConfig,
): HierarchicalDnaDebtSummary[] {
  return (debtReport?.items ?? [])
    .filter((item) => item.status === "open" || item.status === "deferred" || item.status === "support_only")
    .filter((item) => debtMatches(item, config.debtKeywords))
    .slice(0, 8)
    .map((item) => ({
      debtId: item.debtId,
      topic: item.topic,
      heading: item.heading,
      status: item.status,
      riskLevel: item.riskLevel,
    }));
}

function latestRisks(entries: readonly LearningDnaRegistryEntry[]): HierarchicalDnaRiskSummary[] {
  return entries
    .filter((entry) => entry.riskLevel !== "low" || entry.failed || entry.blocked)
    .slice(-8)
    .reverse()
    .map((entry) => ({
      eventId: entry.eventId,
      module: entry.module,
      eventType: entry.eventType,
      riskLevel: entry.riskLevel,
      readinessState: entry.readinessState,
      method: entry.method,
    }));
}

function patterns(
  entries: readonly LearningDnaRegistryEntry[],
  mode: "success" | "failure",
): HierarchicalDnaPatternSummary[] {
  const grouped = new Map<string, { count: number; modules: Set<LearningDnaModule> }>();
  for (const entry of entries) {
    const selected = mode === "success" ? entry.success : entry.failed || entry.blocked;
    if (!selected) continue;
    const key = entry.method || entry.eventType;
    const current = grouped.get(key) ?? { count: 0, modules: new Set<LearningDnaModule>() };
    current.count += 1;
    current.modules.add(entry.module);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([method, value]) => ({
      method,
      count: value.count,
      modules: Array.from(value.modules),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function costSignals(entries: readonly LearningDnaRegistryEntry[]): HierarchicalDnaCostSignal[] {
  return entries
    .filter(
      (entry) =>
        entry.eventType === "pricing_cost_signal" ||
        entry.eventType === "finance_cost_signal" ||
        entry.module === "cost_margin" ||
        entry.module === "pricing_learning" ||
        entry.module === "finance",
    )
    .slice(-8)
    .reverse()
    .map((entry) => ({
      eventId: entry.eventId,
      module: entry.module,
      method: entry.method,
      riskLevel: entry.riskLevel,
      supportScore: entry.event.supportScore,
    }));
}

function productReadiness(
  entries: readonly LearningDnaRegistryEntry[],
  config: HierarchicalDnaBaseEngineConfig,
): HierarchicalDnaProductReadiness {
  const productReadyCount = entries.filter((entry) => entry.readinessState === "product-ready").length;
  const supportOnlyCount = entries.filter((entry) => entry.readinessState === "support-only").length;
  const labOnlyCount = entries.filter((entry) => entry.readinessState === "lab-only").length;
  const deferredCount = entries.filter((entry) => entry.readinessState === "deferred").length;
  const status =
    entries.length === 0
      ? "no_data"
      : labOnlyCount > 0 || deferredCount > 0
        ? "lab_or_deferred_present"
        : productReadyCount > 0
          ? "product_ready_signals_present"
          : "support_only";

  return {
    productReadyCount,
    supportOnlyCount,
    labOnlyCount,
    deferredCount,
    status,
    note: config.readinessNote,
  };
}

function recommendedActions(
  config: HierarchicalDnaBaseEngineConfig,
  health: HierarchicalDnaModuleHealth,
  debts: readonly HierarchicalDnaDebtSummary[],
  risks: readonly HierarchicalDnaRiskSummary[],
): HierarchicalDnaRecommendedAction[] {
  const base: HierarchicalDnaRecommendedAction[] = config.defaultActions.map((action, index) => ({
    ...action,
    actionId: `${config.dnaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-action-${String(index + 1).padStart(2, "0")}`,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    applied: false,
  }));

  if (debts.length > 0 || risks.some((risk) => risk.riskLevel === "high") || health.highRiskCount > 0) {
    base.push({
      actionId: `${config.dnaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-action-high-risk-gate`,
      riskLevel: "high",
      title: "Require human approval before high-risk DNA work",
      reason: "This domain has open debt, blocked/high-risk events, or launch-impacting uncertainty.",
      nextStep: "APPROVE_CHIEF_BRAIN_SAFE_ACTION gerekir before any high-risk implementation task.",
      requiresHumanApproval: true,
      approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
      applied: false,
    });
  }

  return base;
}

function decisionLevelFor(actions: readonly HierarchicalDnaRecommendedAction[]): LearningDnaDecisionLevel {
  return actions.some((action) => action.riskLevel === "high" || action.requiresHumanApproval)
    ? "recommendation"
    : "support";
}

export function buildHierarchicalDnaHealthSummary(
  config: HierarchicalDnaBaseEngineConfig,
  input: HierarchicalDnaBaseEngineInput = {},
): HierarchicalDnaHealthSummary {
  const registry = registryFromInput(input);
  const entries = registry.entries.filter((entry) => matchesConfig(entry, config));
  const debts = openDebts(input.debtReport, config);
  const health = moduleHealth(entries);
  const risks = latestRisks(entries);
  const actions = recommendedActions(config, health, debts, risks);

  return {
    engineVersion: HIERARCHICAL_DNA_BASE_ENGINE_VERSION,
    dnaName: config.dnaName,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    moduleHealth: health,
    openDebts: debts,
    latestRisks: risks,
    successPatterns: patterns(entries, "success"),
    failurePatterns: patterns(entries, "failure"),
    costSignals: costSignals(entries),
    productReadiness: productReadiness(entries, config),
    recommendedNextActions: actions,
    requiredHumanApproval: actions.some((action) => action.requiresHumanApproval),
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    decisionLevel: decisionLevelFor(actions),
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    productBehaviorChanged: false,
    safety: learningDnaDecisionSafety(),
    note:
      "Hierarchical Sub DNA health summary is support/advisory/recommendation only. It reads safe DNA events and debt summaries, and cannot execute actions or change product behavior.",
  };
}
