import type { DiscoveryProviderName } from "./types";

export interface DiscoveryConfig {
  realApiEnabled: boolean;
  defaultKeyframeCount: number;
  defaultMaxCostUsd: number;
  signedUrlTtlSeconds: number;
  computeCostPerWorkerSecondUsd: number;
  storageCostPerGbDayUsd: number;
  queueCostUsd: number;
  reportCostUsd: number;
  secureRoomHandoffCostUsd: number;
  providerUnitCostsUsd: Record<DiscoveryProviderName, number>;
  providerTimeoutMs: number;
  providerRetryLimit: number;
  credentialsAvailable: Record<DiscoveryProviderName, boolean>;
  quoteEnabled: boolean;
  quoteMode: "internal_preview";
  marginMultiplierDefault: number;
  riskBufferPercentDefault: number;
  maxAutoVerificationCandidates: number;
  quoteUnitConversionFactor: number;
  candidateVerificationUnitCostUsd: number;
}

type EnvLike = Record<string, string | undefined>;

function parseFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildDiscoveryConfig(env: EnvLike = process.env): DiscoveryConfig {
  return {
    realApiEnabled: parseFlag(env["DISCOVERY_ENABLE_REAL_API"], false),
    defaultKeyframeCount: Math.max(
      1,
      Math.floor(parsePositiveNumber(env["DISCOVERY_KEYFRAME_COUNT_DEFAULT"], 3)),
    ),
    defaultMaxCostUsd: parsePositiveNumber(env["DISCOVERY_MAX_COST_USD_DEFAULT"], 1),
    signedUrlTtlSeconds: parsePositiveNumber(env["DISCOVERY_SIGNED_URL_TTL_SECONDS"], 300),
    computeCostPerWorkerSecondUsd: parsePositiveNumber(
      env["DISCOVERY_COMPUTE_COST_PER_WORKER_SECOND_USD"],
      0.00004,
    ),
    storageCostPerGbDayUsd: parsePositiveNumber(
      env["DISCOVERY_STORAGE_COST_PER_GB_DAY_USD"],
      0.0008,
    ),
    queueCostUsd: parsePositiveNumber(env["DISCOVERY_QUEUE_COST_USD"], 0.0001),
    reportCostUsd: parsePositiveNumber(env["DISCOVERY_REPORT_COST_USD"], 0.0002),
    secureRoomHandoffCostUsd: parsePositiveNumber(
      env["DISCOVERY_SECURE_ROOM_HANDOFF_COST_USD"],
      0.0001,
    ),
    providerUnitCostsUsd: {
      dataforseo: parsePositiveNumber(env["DISCOVERY_DATAFORSEO_UNIT_COST_USD"], 0.003),
      acrcloud: parsePositiveNumber(env["DISCOVERY_ACRCLOUD_UNIT_COST_USD"], 0.006),
      brave: parsePositiveNumber(env["DISCOVERY_BRAVE_UNIT_COST_USD"], 0.005),
      exa: parsePositiveNumber(env["DISCOVERY_EXA_UNIT_COST_USD"], 0.007),
      apify_telegram: parsePositiveNumber(env["DISCOVERY_APIFY_TELEGRAM_UNIT_COST_USD"], 0.01),
    },
    providerTimeoutMs: parsePositiveNumber(env["DISCOVERY_PROVIDER_TIMEOUT_MS"], 8000),
    providerRetryLimit: Math.floor(parsePositiveNumber(env["DISCOVERY_PROVIDER_RETRY_LIMIT"], 1)),
    credentialsAvailable: {
      dataforseo: hasValue(env["DATAFORSEO_LOGIN"]) && hasValue(env["DATAFORSEO_PASSWORD"]),
      acrcloud:
        hasValue(env["ACRCLOUD_ACCESS_KEY"]) &&
        hasValue(env["ACRCLOUD_ACCESS_SECRET"]) &&
        hasValue(env["ACRCLOUD_CUSTOM_BUCKET_ID"]),
      brave: hasValue(env["BRAVE_SEARCH_API_KEY"]),
      exa: hasValue(env["EXA_API_KEY"]),
      apify_telegram: hasValue(env["APIFY_TOKEN"]),
    },
    quoteEnabled: parseFlag(env["DISCOVERY_QUOTE_ENABLED"], false),
    quoteMode: "internal_preview",
    marginMultiplierDefault: parsePositiveNumber(env["DISCOVERY_MARGIN_MULTIPLIER_DEFAULT"], 1.8),
    riskBufferPercentDefault: parsePositiveNumber(env["DISCOVERY_RISK_BUFFER_PERCENT_DEFAULT"], 0.15),
    maxAutoVerificationCandidates: Math.max(
      1,
      Math.floor(parsePositiveNumber(env["DISCOVERY_MAX_AUTO_VERIFICATION_CANDIDATES"], 100)),
    ),
    quoteUnitConversionFactor: parsePositiveNumber(env["DISCOVERY_QUOTE_UNIT_CONVERSION_FACTOR"], 100),
    candidateVerificationUnitCostUsd: parsePositiveNumber(
      env["DISCOVERY_CANDIDATE_VERIFICATION_UNIT_COST_USD"],
      0.0005,
    ),
  };
}
