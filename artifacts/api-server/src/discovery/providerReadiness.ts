import type { DiscoveryConfig } from "./config";
import { getDiscoveryProviders } from "./providerRegistry";
import { validateDiscoveryProviderEnv, type DiscoveryEnvLike } from "./providerEnvValidation";
import { getDiscoveryProviderPrivacyPolicy } from "./providerPrivacyPolicy";
import type { DiscoveryProviderName } from "./types";

export type DiscoveryProviderReadinessStatus =
  | "ready"
  | "missing_keys"
  | "disabled_by_env"
  | "blocked_by_privacy"
  | "blocked_by_cost_cap"
  | "mock_only";

export interface DiscoveryProviderReadiness {
  provider: DiscoveryProviderName;
  enabledByEnv: boolean;
  requiredEnvKeys: string[];
  missingEnvKeys: string[];
  hasAllRequiredKeys: boolean;
  realApiAllowed: boolean;
  mockAvailable: true;
  privacyMode: string;
  allowedPayloadTypes: string[];
  signedUrlRequired: boolean;
  signedUrlTtlSeconds: number;
  maxAllowedCostUsd: number;
  readinessStatus: DiscoveryProviderReadinessStatus;
  canExecuteRealCall: boolean;
  reason: string;
  secretValuesLogged: false;
  supportOnly: true;
  decisionRole: "provider_readiness_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function buildDiscoveryProviderReadiness(
  provider: DiscoveryProviderName,
  config: DiscoveryConfig,
  env: DiscoveryEnvLike = process.env,
): DiscoveryProviderReadiness {
  const envValidation = validateDiscoveryProviderEnv(provider, config, env);
  const privacyPolicy = getDiscoveryProviderPrivacyPolicy(provider);
  let readinessStatus: DiscoveryProviderReadinessStatus = "ready";
  let reason = "provider_ready_for_feature_gated_real_call";

  if (!config.realApiEnabled) {
    readinessStatus = "mock_only";
    reason = "real_api_disabled_by_env";
  } else if (!envValidation.hasAllRequiredKeys) {
    readinessStatus = "missing_keys";
    reason = "required_provider_env_keys_missing";
  }

  const realApiAllowed = config.realApiEnabled && envValidation.hasAllRequiredKeys;
  return {
    provider,
    enabledByEnv: config.realApiEnabled,
    requiredEnvKeys: envValidation.requiredEnvKeys,
    missingEnvKeys: envValidation.missingEnvKeys,
    hasAllRequiredKeys: envValidation.hasAllRequiredKeys,
    realApiAllowed,
    mockAvailable: true,
    privacyMode: privacyPolicy.privacyMode,
    allowedPayloadTypes: privacyPolicy.allowedPayloadTypes,
    signedUrlRequired: privacyPolicy.signedUrlRequired,
    signedUrlTtlSeconds: config.signedUrlTtlSeconds,
    maxAllowedCostUsd: config.defaultMaxCostUsd,
    readinessStatus,
    canExecuteRealCall: realApiAllowed,
    reason,
    secretValuesLogged: false,
    supportOnly: true,
    decisionRole: "provider_readiness_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

export function listDiscoveryProviderReadiness(
  config: DiscoveryConfig,
  env: DiscoveryEnvLike = process.env,
): DiscoveryProviderReadiness[] {
  return getDiscoveryProviders().map((provider) =>
    buildDiscoveryProviderReadiness(provider.name, config, env),
  );
}

