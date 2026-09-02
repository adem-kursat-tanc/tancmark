import type { DiscoveryConfig } from "./config";
import type { DiscoveryProviderName } from "./types";

export type DiscoveryProviderEnvKey =
  | "DATAFORSEO_LOGIN"
  | "DATAFORSEO_PASSWORD"
  | "ACRCLOUD_ACCESS_KEY"
  | "ACRCLOUD_ACCESS_SECRET"
  | "ACRCLOUD_CUSTOM_BUCKET_ID"
  | "BRAVE_SEARCH_API_KEY"
  | "EXA_API_KEY"
  | "APIFY_TOKEN";

export type DiscoveryProviderRuntimeEnvKey =
  | "DISCOVERY_ENABLE_REAL_API"
  | "DISCOVERY_MAX_COST_USD_DEFAULT"
  | "DISCOVERY_SIGNED_URL_TTL_SECONDS";

export type DiscoveryEnvLike = Record<string, string | undefined>;

export interface DiscoveryProviderEnvValidation {
  provider: DiscoveryProviderName;
  enabledByEnv: boolean;
  requiredEnvKeys: DiscoveryProviderEnvKey[];
  missingEnvKeys: DiscoveryProviderEnvKey[];
  hasAllRequiredKeys: boolean;
  signedUrlTtlSeconds: number;
  maxAllowedCostUsd: number;
  secretValuesLogged: false;
}

export const DISCOVERY_PROVIDER_ENV_KEYS: Record<DiscoveryProviderName, DiscoveryProviderEnvKey[]> = {
  dataforseo: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  acrcloud: ["ACRCLOUD_ACCESS_KEY", "ACRCLOUD_ACCESS_SECRET", "ACRCLOUD_CUSTOM_BUCKET_ID"],
  brave: ["BRAVE_SEARCH_API_KEY"],
  exa: ["EXA_API_KEY"],
  apify_telegram: ["APIFY_TOKEN"],
};

export const DISCOVERY_RUNTIME_ENV_KEYS: DiscoveryProviderRuntimeEnvKey[] = [
  "DISCOVERY_ENABLE_REAL_API",
  "DISCOVERY_MAX_COST_USD_DEFAULT",
  "DISCOVERY_SIGNED_URL_TTL_SECONDS",
];

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateDiscoveryProviderEnv(
  provider: DiscoveryProviderName,
  config: DiscoveryConfig,
  env: DiscoveryEnvLike = process.env,
): DiscoveryProviderEnvValidation {
  const requiredEnvKeys = DISCOVERY_PROVIDER_ENV_KEYS[provider];
  const missingEnvKeys = requiredEnvKeys.filter((key) => !hasValue(env[key]));
  return {
    provider,
    enabledByEnv: config.realApiEnabled,
    requiredEnvKeys,
    missingEnvKeys,
    hasAllRequiredKeys: missingEnvKeys.length === 0,
    signedUrlTtlSeconds: config.signedUrlTtlSeconds,
    maxAllowedCostUsd: config.defaultMaxCostUsd,
    secretValuesLogged: false,
  };
}

