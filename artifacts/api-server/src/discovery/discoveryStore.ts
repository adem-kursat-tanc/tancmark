import {
  DISCOVERY_DECISION_ROLE,
  type DiscoveryApiCall,
  type DiscoveryCostSummary,
  type DiscoveryJobInput,
  type DiscoveryJobRecord,
  type DiscoveryJobSnapshot,
  type DiscoveryLayer,
  type DiscoveryMediaAsset,
  type DiscoveryProcessingMetric,
  type DiscoveryResult,
  type DiscoverySecureRoomHandoff,
} from "./types";

let sequence = 0;

const jobs = new Map<string, DiscoveryJobRecord>();
const mediaAssets = new Map<string, DiscoveryMediaAsset[]>();
const apiCalls = new Map<string, DiscoveryApiCall[]>();
const processingMetrics = new Map<string, DiscoveryProcessingMetric[]>();
const results = new Map<string, DiscoveryResult[]>();
const handoffs = new Map<string, DiscoverySecureRoomHandoff>();

function now(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}`;
}

export function defaultRequestedLayers(input: DiscoveryJobInput): DiscoveryLayer[] {
  if (input.requestedLayers && input.requestedLayers.length > 0) {
    return Array.from(new Set(input.requestedLayers));
  }
  switch (input.scanType) {
    case "hybrid_video":
      return ["visual", "audio", "metadata_text", "video_metadata", "telegram"];
    case "visual_only":
      return ["visual"];
    case "audio_only":
      return ["audio"];
    case "text_only":
      return ["metadata_text"];
    case "telegram_only":
      return ["telegram"];
  }
}

export function createDiscoveryJob(input: DiscoveryJobInput, defaultMaxCostUsd: number): DiscoveryJobRecord {
  const id = nextId("disc");
  const timestamp = now();
  const job: DiscoveryJobRecord = {
    ...input,
    id,
    userId: input.userId ?? null,
    docId: input.docId ?? null,
    sourceContentId: input.sourceContentId ?? null,
    uploadRef: input.uploadRef ?? null,
    tags: input.tags ?? [],
    keywords: input.keywords ?? [],
    requestedLayers: defaultRequestedLayers(input),
    status: "queued",
    estimatedExternalApiCostUsd: 0,
    actualExternalApiCostUsd: 0,
    estimatedComputeCostUsd: 0,
    estimatedStorageCostUsd: 0,
    estimatedQueueCostUsd: 0,
    estimatedReportCostUsd: 0,
    totalEstimatedInternalCostUsd: 0,
    totalActualMeasuredCostUsd: 0,
    costConfidence: "low",
    maxAllowedCostUsd:
      typeof input.maxAllowedCostUsd === "number" && Number.isFinite(input.maxAllowedCostUsd)
        ? Math.max(0, input.maxAllowedCostUsd)
        : defaultMaxCostUsd,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    errorMessage: null,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: DISCOVERY_DECISION_ROLE,
  };
  jobs.set(id, job);
  mediaAssets.set(id, []);
  apiCalls.set(id, []);
  processingMetrics.set(id, []);
  results.set(id, []);
  return job;
}

export function getDiscoveryJob(jobId: string): DiscoveryJobRecord | null {
  return jobs.get(jobId) ?? null;
}

export function updateDiscoveryJob(jobId: string, patch: Partial<DiscoveryJobRecord>): DiscoveryJobRecord {
  const current = jobs.get(jobId);
  if (!current) throw new Error(`Discovery job not found: ${jobId}`);
  const updated = { ...current, ...patch, updatedAt: now() };
  jobs.set(jobId, updated);
  return updated;
}

export function appendDiscoveryMediaAssets(jobId: string, rows: DiscoveryMediaAsset[]): void {
  mediaAssets.set(jobId, [...(mediaAssets.get(jobId) ?? []), ...rows]);
}

export function appendDiscoveryApiCalls(jobId: string, rows: DiscoveryApiCall[]): void {
  apiCalls.set(jobId, [...(apiCalls.get(jobId) ?? []), ...rows]);
}

export function appendDiscoveryProcessingMetrics(jobId: string, rows: DiscoveryProcessingMetric[]): void {
  processingMetrics.set(jobId, [...(processingMetrics.get(jobId) ?? []), ...rows]);
}

export function appendDiscoveryResults(jobId: string, rows: DiscoveryResult[]): void {
  results.set(jobId, [...(results.get(jobId) ?? []), ...rows]);
}

export function setDiscoverySecureRoomHandoff(jobId: string, row: DiscoverySecureRoomHandoff): void {
  handoffs.set(jobId, row);
}

export function getDiscoveryMediaAssets(jobId: string): DiscoveryMediaAsset[] {
  return [...(mediaAssets.get(jobId) ?? [])];
}

export function getDiscoveryApiCalls(jobId: string): DiscoveryApiCall[] {
  return [...(apiCalls.get(jobId) ?? [])];
}

export function getDiscoveryProcessingMetrics(jobId: string): DiscoveryProcessingMetric[] {
  return [...(processingMetrics.get(jobId) ?? [])];
}

export function getDiscoveryResults(jobId: string): DiscoveryResult[] {
  return [...(results.get(jobId) ?? [])];
}

export function getDiscoverySecureRoomHandoff(jobId: string): DiscoverySecureRoomHandoff | null {
  return handoffs.get(jobId) ?? null;
}

export function getDiscoverySnapshot(jobId: string, costSummary: DiscoveryCostSummary): DiscoveryJobSnapshot {
  const job = getDiscoveryJob(jobId);
  const secureRoomHandoff = getDiscoverySecureRoomHandoff(jobId);
  if (!job) throw new Error(`Discovery job not found: ${jobId}`);
  if (!secureRoomHandoff) throw new Error(`Discovery handoff not found: ${jobId}`);
  return {
    job,
    mediaAssets: getDiscoveryMediaAssets(jobId),
    apiCalls: getDiscoveryApiCalls(jobId),
    processingMetrics: getDiscoveryProcessingMetrics(jobId),
    results: getDiscoveryResults(jobId),
    costSummary,
    secureRoomHandoff,
  };
}

export function markDiscoveryHandoffSent(jobId: string, secureRoomId: string | null = null): DiscoverySecureRoomHandoff {
  const current = getDiscoverySecureRoomHandoff(jobId);
  if (!current) throw new Error(`Discovery handoff not found: ${jobId}`);
  const updated: DiscoverySecureRoomHandoff = {
    ...current,
    secureRoomId,
    handoffStatus: "sent",
    sentAt: now(),
  };
  handoffs.set(jobId, updated);
  return updated;
}

export function resetDiscoveryMemoryForTests(): void {
  sequence = 0;
  jobs.clear();
  mediaAssets.clear();
  apiCalls.clear();
  processingMetrics.clear();
  results.clear();
  handoffs.clear();
}
