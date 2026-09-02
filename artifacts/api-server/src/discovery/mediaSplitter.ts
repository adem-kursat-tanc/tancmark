import { createHash } from "node:crypto";
import type { DiscoveryConfig } from "./config";
import type {
  DiscoveryJobRecord,
  DiscoveryLayer,
  DiscoveryMediaAsset,
  DiscoveryProcessingMetric,
} from "./types";

export interface DiscoveryMediaPlan {
  assets: DiscoveryMediaAsset[];
  metrics: DiscoveryProcessingMetric[];
  metadataQueries: string[];
  telegramQueries: string[];
}

function now(): string {
  return new Date().toISOString();
}

function stableId(prefix: string, parts: readonly unknown[]): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}_${digest}`;
}

function stableSha(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function cleanString(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStrings(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 20);
}

function addMetric(
  metrics: DiscoveryProcessingMetric[],
  jobId: string,
  metricType: DiscoveryProcessingMetric["metricType"],
  durationMs: number,
  inputBytes: number,
  outputBytes: number,
  notes: string,
): void {
  metrics.push({
    id: stableId("metric", [jobId, metricType, durationMs, inputBytes, outputBytes, notes]),
    jobId,
    metricType,
    durationMs,
    inputBytes,
    outputBytes,
    estimatedCostUsd: 0,
    notes,
    createdAt: now(),
  });
}

function requested(job: DiscoveryJobRecord, layer: DiscoveryLayer): boolean {
  return job.requestedLayers.includes(layer);
}

function buildQueryTerms(job: DiscoveryJobRecord): string[] {
  return [
    cleanString(job.title),
    cleanString(job.instructorName),
    cleanString(job.description),
    ...cleanStrings(job.tags),
    ...cleanStrings(job.keywords),
  ].filter((value): value is string => Boolean(value));
}

export function buildDiscoveryMediaPlan(
  job: DiscoveryJobRecord,
  config: DiscoveryConfig,
): DiscoveryMediaPlan {
  const assets: DiscoveryMediaAsset[] = [];
  const metrics: DiscoveryProcessingMetric[] = [];
  const createdAt = now();
  const inputBytes = Math.max(0, job.fileSizeBytes ?? 0);
  const durationSec = Math.max(0, job.durationSec ?? 0);

  addMetric(metrics, job.id, "upload", 1, inputBytes, inputBytes, "upload_ref_registered_only");

  if (requested(job, "visual") || requested(job, "video_metadata")) {
    const keyframeCount =
      job.mediaType === "video" || job.scanType === "hybrid_video"
        ? config.defaultKeyframeCount
        : job.mediaType === "image"
          ? 1
          : 0;
    const frameBytes = Math.max(1024, Math.floor(inputBytes / Math.max(keyframeCount || 1, 1) / 20));
    for (let index = 0; index < keyframeCount; index += 1) {
      const timestampSec =
        durationSec > 0 ? Math.round(((index + 1) * durationSec * 1000) / (keyframeCount + 1)) / 1000 : index;
      assets.push({
        id: stableId("asset", [job.id, "keyframe", index]),
        jobId: job.id,
        assetType: "keyframe",
        localRef: `mock://discovery/${job.id}/keyframe-${index}.jpg`,
        storageRef: null,
        sha256: stableSha([job.id, "keyframe", index, timestampSec]),
        sizeBytes: frameBytes,
        durationSec: null,
        frameIndex: index,
        timestampSec,
        redacted: true,
        sentToExternalProvider: false,
        externalPayloadType: "hash",
        createdAt,
      });
    }
    addMetric(
      metrics,
      job.id,
      "keyframe_extract",
      18 * Math.max(keyframeCount, 1),
      inputBytes,
      frameBytes * keyframeCount,
      `mock_keyframe_count=${keyframeCount}`,
    );
  }

  if (requested(job, "audio")) {
    const outputBytes = Math.max(2048, Math.floor(inputBytes / 6));
    assets.push({
      id: stableId("asset", [job.id, "audio_extract"]),
      jobId: job.id,
      assetType: "audio_extract",
      localRef: `mock://discovery/${job.id}/audio-fingerprint.bin`,
      storageRef: null,
      sha256: stableSha([job.id, "audio_extract", job.sourceContentId ?? job.uploadRef]),
      sizeBytes: outputBytes,
      durationSec: durationSec || null,
      frameIndex: null,
      timestampSec: null,
      redacted: true,
      sentToExternalProvider: false,
      externalPayloadType: "fingerprint",
      createdAt,
    });
    addMetric(metrics, job.id, "audio_extract", 42, inputBytes, outputBytes, "mock_audio_fingerprint_only");
  }

  const queryTerms = buildQueryTerms(job);
  const queryText = queryTerms.join(" ").slice(0, 500);
  if (requested(job, "metadata_text") || requested(job, "telegram")) {
    assets.push({
      id: stableId("asset", [job.id, "query_pack"]),
      jobId: job.id,
      assetType: "query_pack",
      localRef: null,
      storageRef: null,
      sha256: stableSha([job.id, "query_pack", queryText]),
      sizeBytes: Buffer.byteLength(queryText, "utf8"),
      durationSec: null,
      frameIndex: null,
      timestampSec: null,
      redacted: true,
      sentToExternalProvider: false,
      externalPayloadType: "query",
      createdAt,
    });
    addMetric(
      metrics,
      job.id,
      "query_pack",
      5,
      Buffer.byteLength(queryText, "utf8"),
      Buffer.byteLength(queryText, "utf8"),
      "metadata_terms_to_query_pack",
    );
  }

  return {
    assets,
    metrics,
    metadataQueries: requested(job, "metadata_text") ? queryTerms.slice(0, 8) : [],
    telegramQueries: requested(job, "telegram")
      ? queryTerms
          .map((term) => term.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim())
          .filter((term) => term.length > 0)
          .slice(0, 8)
      : [],
  };
}
