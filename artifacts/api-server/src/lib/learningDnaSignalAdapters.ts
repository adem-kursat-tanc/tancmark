import {
  buildLearningDnaRegistry,
  type LearningDnaRegistry,
} from "./learningDnaRegistry";
import type {
  LearningDnaEventInput,
  LearningDnaEventResult,
  LearningDnaEventType,
  LearningDnaGateStatus,
  LearningDnaInputType,
  LearningDnaModule,
  LearningDnaReadinessState,
  LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import type {
  LearningModule,
  LearningModuleObservation,
  LearningTestRecord,
} from "./learningDnaMemory";

export const LEARNING_DNA_SIGNAL_ADAPTERS_VERSION =
  "learning-dna-signal-adapters-v0.1" as const;

export interface LearningDnaAdapterSourceMapEntry {
  signalFamily: string;
  sourceFile: string;
  learns: string;
  registryEventType: LearningDnaEventType;
  registryModule: LearningDnaModule;
  supportOnly: true;
  canOpenVault: false;
  canConfirmFinal: false;
}

export const LEARNING_DNA_SIGNAL_SOURCE_MAP: LearningDnaAdapterSourceMapEntry[] = [
  source("gorsel", "artifacts/api-server/src/dna/visualLearningAdapter.ts", "visual placement and recovery outcomes", "read_attempt", "visual"),
  source("video", "artifacts/api-server/src/dna/videoLearningAdapter.ts", "video placement, codec/path and recovery outcomes", "read_attempt", "video"),
  source("ses", "artifacts/api-server/src/dna/audioLearningAdapter.ts", "audio placement and recovery outcomes", "read_attempt", "audio"),
  source("metin_dokuman", "artifacts/api-server/src/dna/textLearningAdapter.ts", "text/document/OCR support outcomes", "read_attempt", "text_document"),
  source("muhur_tavsiye", "artifacts/api-server/src/dna/dnaThreeTaskLearningBridge.ts", "placement advisory, seal map and search hints", "recommendation_signal", "watermark"),
  source("katman_sinyali", "artifacts/api-server/src/dna/dnaLayerSignalBridge.ts", "layer success/failure and recovery signals", "recovery_attempt", "watermark"),
  source("discovery_search", "artifacts/api-server/src/discovery/discoveryLearningMemory.ts", "provider, query and candidate usefulness", "discovery_result", "discovery_search"),
  source("pricing_learning", "artifacts/api-server/src/discovery/discoveryPricingLearning.ts", "pricing estimate and margin hints", "pricing_cost_signal", "pricing_learning"),
  source("cost_margin", "artifacts/api-server/src/discovery/discoveryCostCalibration.ts", "estimated versus measured cost", "pricing_cost_signal", "cost_margin"),
  source("live_tanclive", "artifacts/api-server/src/live/liveLearningMemory.ts", "live latency, dropout, target and ID-read support outcomes", "live_test_result", "live_tanclive"),
  source("license_product_gate", "runtime/validation/*license* and docs license reports", "license/product gate status", "license_gate_signal", "license_product_gate"),
  source("evidence_support", "artifacts/api-server/src/lib/secureRoomEvidencePackage.ts and live evidence modules", "evidence package readiness and support boundaries", "evidence_signal", "evidence"),
];

export interface DiscoverySearchLearningSignal {
  id: string;
  jobId?: string | null;
  resultCount?: number | null;
  usefulResultCount?: number | null;
  falsePositiveCount?: number | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt?: string | null;
}

export interface DiscoveryQueryOutcomeSignal {
  id: string;
  jobId: string;
  provider: string;
  resultCount: number;
  usefulCandidateCount: number;
  weakCandidateCount: number;
  falsePositiveCount: number;
  outcomeLabel: string;
  actualCostUsd: number;
  latencyMs: number;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt?: string | null;
}

export interface PricingCostLearningSignal {
  id: string;
  sampleCount?: number | null;
  estimatedCostUsd?: number | null;
  actualMeasuredCostUsd?: number | null;
  avgEstimatedCostUsd?: number | null;
  avgActualMeasuredCostUsd?: number | null;
  differencePercent?: number | null;
  avgDifferencePercent?: number | null;
  quoteAccuracyLabel?: string | null;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LiveLearningSignal {
  recordId: string;
  source: string;
  signalType: string;
  observedResult: string;
  success: boolean;
  failureReason: string | null;
  confidence: number;
  recommendedNextTest: string;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface GateLearningSignal {
  signalId: string;
  module: LearningDnaModule;
  eventType: LearningDnaEventType;
  result: LearningDnaEventResult;
  gateStatus?: Partial<LearningDnaGateStatus>;
  riskLevel?: LearningDnaRiskLevel;
  readinessState?: LearningDnaReadinessState;
  method: string;
  note?: string | null;
  nextSuggestedAction?: string | null;
}

export interface ExistingLearningSignalsInput {
  learningRecords?: readonly LearningTestRecord[];
  discoveryRecords?: readonly DiscoverySearchLearningSignal[];
  discoveryOutcomes?: readonly DiscoveryQueryOutcomeSignal[];
  pricingCostSignals?: readonly PricingCostLearningSignal[];
  liveSignals?: readonly LiveLearningSignal[];
  gateSignals?: readonly GateLearningSignal[];
}

function source(
  signalFamily: string,
  sourceFile: string,
  learns: string,
  registryEventType: LearningDnaEventType,
  registryModule: LearningDnaModule,
): LearningDnaAdapterSourceMapEntry {
  return {
    signalFamily,
    sourceFile,
    learns,
    registryEventType,
    registryModule,
    supportOnly: true,
    canOpenVault: false,
    canConfirmFinal: false,
  };
}

function clampScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function timestamp(value: string | null | undefined): string | undefined {
  return value && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function resultFromLearningRecord(record: LearningTestRecord, observation: LearningModuleObservation): LearningDnaEventResult {
  if (observation.failed) return "failure";
  if (record.idMatched || observation.idRead || observation.rescued) return "success";
  if (observation.candidateSupport) return "partial";
  return "pending";
}

function eventTypeFromLearningRecord(record: LearningTestRecord, observation: LearningModuleObservation): LearningDnaEventType {
  if (observation.rescued) return "recovery_attempt";
  if (record.scenario.includes("seal")) return "seal_attempt";
  if (record.scenario.includes("format")) return "format_test_result";
  return "read_attempt";
}

function inputTypeFromLearningModule(module: LearningModule, fileKind: string): LearningDnaInputType {
  if (module === "image") return "image";
  if (module === "video") return "video";
  if (module === "audio") return "audio";
  if (module === "text" || module === "light_ocr" || module === "heavy_ocr") {
    return fileKind.toLowerCase().includes("pdf") ? "pdf" : "document";
  }
  if (module === "evidence_package" || module === "c2pa_draft") return "evidence";
  return "unknown";
}

function registryModuleFromLearningModule(module: LearningModule): LearningDnaModule {
  if (module === "image") return "visual";
  if (module === "video") return "video";
  if (module === "audio") return "audio";
  if (module === "text" || module === "light_ocr" || module === "heavy_ocr") return "text_document";
  if (module === "evidence_package" || module === "c2pa_draft") return "evidence";
  return "watermark";
}

export function learningRecordToDnaEvents(record: LearningTestRecord): LearningDnaEventInput[] {
  return record.modules.map((observation, index) => ({
    eventId: `${record.recordId}-dna-event-${String(index + 1).padStart(2, "0")}`,
    module: registryModuleFromLearningModule(observation.module),
    eventType: eventTypeFromLearningRecord(record, observation),
    inputType: inputTypeFromLearningModule(observation.module, record.fileKind),
    result: resultFromLearningRecord(record, observation),
    confidence: observation.idRead ? 1 : observation.candidateSupport ? 0.62 : 0.25,
    supportScore: observation.idRead ? 1 : observation.candidateSupport ? 0.7 : 0.2,
    decisionLevel: observation.idRead ? "support" : "advisory",
    method: observation.module,
    supportLevel: "support-only",
    riskLevel: record.falseVault || record.idlessVault ? "high" : observation.failed ? "medium" : "low",
    readinessState: "support-only",
    recoveryHint: observation.note,
    nextSuggestedAction: observation.failed
      ? "Review this weak support signal before changing any product behavior."
      : "Keep this as support-only registry signal.",
    relatedCheckpoint: record.recordId,
    note: record.note,
  }));
}

export function learningRecordsToDnaEvents(records: readonly LearningTestRecord[]): LearningDnaEventInput[] {
  return records.flatMap((record) => learningRecordToDnaEvents(record));
}

export function discoverySearchRecordToDnaEvent(record: DiscoverySearchLearningSignal): LearningDnaEventInput {
  const useful = record.usefulResultCount ?? 0;
  const total = record.resultCount ?? 0;
  return {
    eventId: `discovery-search-${record.id}`,
    module: "discovery_search",
    eventType: "discovery_result",
    timestamp: timestamp(record.createdAt),
    inputType: "search_result",
    result: useful > 0 ? "success" : total > 0 ? "partial" : "pending",
    confidence: total > 0 ? Math.min(1, useful / Math.max(1, total)) : 0.2,
    supportScore: total > 0 ? Math.min(1, (useful + 0.5) / Math.max(1, total)) : 0.2,
    decisionLevel: "support",
    method: "discovery_search_dna",
    supportLevel: "support-only",
    riskLevel: (record.falsePositiveCount ?? 0) > 0 ? "medium" : "low",
    readinessState: "support-only",
    nextSuggestedAction: "Use as search-provider support signal only; require TancMark verification before any action.",
    relatedCheckpoint: record.jobId ?? record.id,
    note: `estimated=${record.estimatedCostUsd ?? 0}; actual=${record.actualCostUsd ?? 0}`,
  };
}

export function discoveryQueryOutcomeToDnaEvent(outcome: DiscoveryQueryOutcomeSignal): LearningDnaEventInput {
  const useful = outcome.usefulCandidateCount > 0;
  return {
    eventId: `discovery-query-${outcome.id}`,
    module: "discovery_search",
    eventType: "discovery_result",
    timestamp: timestamp(outcome.createdAt),
    inputType: "search_result",
    result: useful ? "success" : outcome.resultCount > 0 ? "partial" : "failure",
    confidence: useful ? 0.75 : outcome.resultCount > 0 ? 0.45 : 0.2,
    supportScore: useful ? 0.8 : outcome.resultCount > 0 ? 0.5 : 0.2,
    decisionLevel: "support",
    method: `provider:${outcome.provider}`,
    supportLevel: "support-only",
    riskLevel: outcome.falsePositiveCount > 0 || outcome.outcomeLabel === "failed" ? "medium" : "low",
    readinessState: "support-only",
    recoveryHint: outcome.outcomeLabel,
    nextSuggestedAction: "Tune provider/query order only as support recommendation.",
    relatedCheckpoint: outcome.jobId,
    note: `latencyMs=${outcome.latencyMs}; actualCostUsd=${outcome.actualCostUsd}`,
  };
}

export function pricingCostSignalToDnaEvent(signal: PricingCostLearningSignal): LearningDnaEventInput {
  const diff = signal.differencePercent ?? signal.avgDifferencePercent ?? 0;
  const riskLevel: LearningDnaRiskLevel = Math.abs(diff) > 50 ? "high" : Math.abs(diff) > 15 ? "medium" : "low";
  return {
    eventId: `pricing-cost-${signal.id}`,
    module: signal.sampleCount === undefined ? "cost_margin" : "pricing_learning",
    eventType: "pricing_cost_signal",
    timestamp: timestamp(signal.updatedAt ?? signal.createdAt),
    inputType: "cost",
    result: riskLevel === "high" ? "partial" : "success",
    confidence: riskLevel === "low" ? 0.7 : 0.45,
    supportScore: riskLevel === "low" ? 0.75 : 0.5,
    decisionLevel: "advisory",
    method: "pricing_cost_learning",
    supportLevel: "advisory-only",
    riskLevel,
    readinessState: "support-only",
    nextSuggestedAction: "Use cost signal for planning only; do not change billing or customer price automatically.",
    relatedCheckpoint: signal.id,
    note: `diffPercent=${diff}; quoteAccuracy=${signal.quoteAccuracyLabel ?? "unknown"}`,
  };
}

export function liveLearningSignalToDnaEvent(signal: LiveLearningSignal): LearningDnaEventInput {
  return {
    eventId: `live-learning-${signal.recordId}`,
    module: "live_tanclive",
    eventType: "live_test_result",
    inputType: "live_stream",
    result: signal.success ? "success" : "failure",
    confidence: clampScore(signal.confidence, signal.success ? 0.6 : 0.3),
    supportScore: clampScore(signal.confidence, signal.success ? 0.65 : 0.35),
    decisionLevel: "support",
    method: signal.signalType,
    supportLevel: "support-only",
    riskLevel: signal.success ? "low" : "medium",
    readinessState: "support-only",
    recoveryHint: signal.failureReason,
    nextSuggestedAction: signal.recommendedNextTest,
    relatedCheckpoint: signal.recordId,
    note: `${signal.source}: ${signal.observedResult}`,
  };
}

export function gateLearningSignalToDnaEvent(signal: GateLearningSignal): LearningDnaEventInput {
  return {
    eventId: `gate-${signal.signalId}`,
    module: signal.module,
    eventType: signal.eventType,
    inputType: signal.module === "evidence" ? "evidence" : signal.module === "security" ? "security" : "license",
    result: signal.result,
    confidence: signal.result === "success" ? 0.8 : signal.result === "blocked" ? 0.6 : 0.4,
    supportScore: signal.result === "success" ? 0.75 : 0.5,
    decisionLevel: "advisory",
    method: signal.method,
    supportLevel: "advisory-only",
    riskLevel: signal.riskLevel ?? (signal.result === "blocked" ? "high" : "low"),
    readinessState: signal.readinessState ?? "support-only",
    gateStatus: signal.gateStatus,
    nextSuggestedAction: signal.nextSuggestedAction ?? "Keep as support-only gate signal.",
    relatedCheckpoint: signal.signalId,
    note: signal.note,
  };
}

export function existingLearningSignalsToDnaEvents(input: ExistingLearningSignalsInput): LearningDnaEventInput[] {
  return [
    ...learningRecordsToDnaEvents(input.learningRecords ?? []),
    ...(input.discoveryRecords ?? []).map(discoverySearchRecordToDnaEvent),
    ...(input.discoveryOutcomes ?? []).map(discoveryQueryOutcomeToDnaEvent),
    ...(input.pricingCostSignals ?? []).map(pricingCostSignalToDnaEvent),
    ...(input.liveSignals ?? []).map(liveLearningSignalToDnaEvent),
    ...(input.gateSignals ?? []).map(gateLearningSignalToDnaEvent),
  ];
}

export function buildLearningDnaRegistryFromExistingSignals(
  input: ExistingLearningSignalsInput,
): LearningDnaRegistry {
  return buildLearningDnaRegistry(existingLearningSignalsToDnaEvents(input));
}
