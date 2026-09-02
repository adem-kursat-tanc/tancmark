import type { DiscoveryConfig } from "./config";
import { buildDiscoveryProviderReadiness, type DiscoveryProviderReadiness } from "./providerReadiness";
import type { DiscoveryEnvLike } from "./providerEnvValidation";
import {
  getDiscoveryProviderPrivacyPolicy,
  isDiscoveryProviderPayloadAllowed,
  isDiscoverySignedUrlTtlSafe,
} from "./providerPrivacyPolicy";
import type { DiscoveryProvider, DiscoveryProviderRequest } from "./providers/DiscoveryProvider";
import type { DiscoveryJobRecord, DiscoveryProviderName } from "./types";
import { getDiscoveryNoAutoEnforcementPolicy } from "./discoveryEnforcementPolicy";
import { getTelegramPublicOnlyPolicy } from "./telegramPublicOnlyPolicy";

export type DiscoveryProviderSafetyGateMode = "real_allowed" | "mock_fallback" | "blocked";

export interface DiscoveryProviderSafetyGateRequest {
  provider: DiscoveryProviderName;
  endpointName: string;
  payloadType: string;
  sentOriginalContent: boolean;
  unitCount: number;
}

export interface DiscoveryProviderSafetyGateInput {
  job: DiscoveryJobRecord;
  provider: DiscoveryProvider;
  request: DiscoveryProviderSafetyGateRequest | DiscoveryProviderRequest;
  config: DiscoveryConfig;
  estimatedCostUsd: number;
  plannedCostBeforeUsd: number;
  env?: DiscoveryEnvLike;
}

export interface DiscoveryProviderSafetyGateResult {
  provider: DiscoveryProviderName;
  endpointName: string;
  canExecuteRealCall: boolean;
  mode: DiscoveryProviderSafetyGateMode;
  status: "allowed" | "blocked";
  reason: string;
  blockedReasons: string[];
  readiness: DiscoveryProviderReadiness;
  payloadType: string;
  allowedPayloadTypes: string[];
  estimatedCostUsd: number;
  plannedCostBeforeUsd: number;
  maxAllowedCostUsd: number;
  userConfirmedExternalSearch: boolean;
  sentOriginalContent: boolean;
  signedUrlTtlSeconds: number;
  externalApiCalled: false;
  publicSourcesOnly: true;
  privateGroupScanAllowed: false;
  loginBypassAllowed: false;
  paywallBypassAllowed: false;
  drmBypassAllowed: false;
  autoEnforcementEnabled: false;
  autoDmcaEnabled: false;
  autoComplaintEnabled: false;
  platformComplaintApiEnabled: false;
  telegramPublicOnlyPolicy:
    | ReturnType<typeof getTelegramPublicOnlyPolicy>
    | null;
  supportOnly: true;
  decisionRole: "provider_safety_gate_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function evaluateDiscoveryProviderSafetyGate(
  input: DiscoveryProviderSafetyGateInput,
): DiscoveryProviderSafetyGateResult {
  const { job, provider, request, config, estimatedCostUsd, plannedCostBeforeUsd, env } = input;
  const readiness = buildDiscoveryProviderReadiness(provider.name, config, env);
  const privacyPolicy = getDiscoveryProviderPrivacyPolicy(provider.name);
  const noAutoEnforcementPolicy = getDiscoveryNoAutoEnforcementPolicy();
  const blockedReasons: string[] = [];

  if (!config.realApiEnabled) blockedReasons.push("real_api_disabled_by_env");
  if (!readiness.hasAllRequiredKeys) blockedReasons.push("provider_env_keys_missing");
  if (job.userConfirmedExternalSearch !== true) {
    blockedReasons.push("user_external_search_not_confirmed");
  }
  if (!isDiscoveryProviderPayloadAllowed(provider.name, request.payloadType)) {
    blockedReasons.push("payload_type_not_allowed");
  }
  if (request.sentOriginalContent !== false) {
    blockedReasons.push("original_content_payload_blocked");
  }
  if (!isDiscoverySignedUrlTtlSafe(provider.name, request.payloadType, config.signedUrlTtlSeconds)) {
    blockedReasons.push("signed_url_ttl_too_long");
  }
  if (plannedCostBeforeUsd + estimatedCostUsd > job.maxAllowedCostUsd) {
    blockedReasons.push("max_allowed_cost_exceeded");
  }

  const canExecuteRealCall = blockedReasons.length === 0;
  const mode: DiscoveryProviderSafetyGateMode = canExecuteRealCall
    ? "real_allowed"
    : blockedReasons.includes("max_allowed_cost_exceeded")
      ? "blocked"
      : "mock_fallback";

  return {
    provider: provider.name,
    endpointName: request.endpointName,
    canExecuteRealCall,
    mode,
    status: canExecuteRealCall ? "allowed" : "blocked",
    reason: canExecuteRealCall ? "real_call_allowed_by_safety_gate" : blockedReasons[0] ?? "blocked",
    blockedReasons,
    readiness,
    payloadType: request.payloadType,
    allowedPayloadTypes: privacyPolicy.allowedPayloadTypes,
    estimatedCostUsd,
    plannedCostBeforeUsd,
    maxAllowedCostUsd: job.maxAllowedCostUsd,
    userConfirmedExternalSearch: job.userConfirmedExternalSearch === true,
    sentOriginalContent: request.sentOriginalContent,
    signedUrlTtlSeconds: config.signedUrlTtlSeconds,
    externalApiCalled: false,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    autoEnforcementEnabled: false,
    autoDmcaEnabled: noAutoEnforcementPolicy.autoDmcaEnabled,
    autoComplaintEnabled: noAutoEnforcementPolicy.autoComplaintEnabled,
    platformComplaintApiEnabled: noAutoEnforcementPolicy.platformComplaintApiEnabled,
    telegramPublicOnlyPolicy: provider.name === "apify_telegram" ? getTelegramPublicOnlyPolicy() : null,
    supportOnly: true,
    decisionRole: "provider_safety_gate_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
