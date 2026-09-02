export type LiveExternalProviderKind = "custom_rtmp" | "youtube" | "twitch" | "facebook" | "tiktok" | "instagram" | "webhook" | "cdn";
export interface LiveExternalProviderConfig {
  provider: LiveExternalProviderKind;
  enabled: false;
  status: "NOT_CONFIGURED" | "DEFERRED";
  endpointConfigured: false;
  credentialsConfigured: false;
  failClosed: true;
  userConfigured: true;
  credentialValuesReturned: false;
}
export interface LiveExternalProviderAdapter {
  readonly kind: LiveExternalProviderKind;
  status(): LiveExternalProviderConfig;
  /** Implementations must accept an opaque secret-store reference, never a raw credential. */
  configure(input: { endpoint: string; credentialReference: string }): Promise<void>;
  /** A failed adapter must stop only its external push and may not downgrade protected output. */
  stop(reason: "CONFIGURATION_INVALID" | "CREDENTIAL_UNAVAILABLE" | "TARGET_FAILED" | "OWNER_REQUESTED"): Promise<void>;
}

export function getUnconfiguredLiveProviderAdapters(): LiveExternalProviderConfig[] {
  return (["custom_rtmp", "youtube", "twitch", "facebook", "tiktok", "instagram", "webhook", "cdn"] as const).map(
    (provider) => ({
      provider,
      enabled: false,
      status: provider === "custom_rtmp" || provider === "webhook" ? "NOT_CONFIGURED" : "DEFERRED",
      endpointConfigured: false,
      credentialsConfigured: false,
      failClosed: true,
      userConfigured: true,
      credentialValuesReturned: false,
    }),
  );
}

export function validateExternalProviderConfigurationShape(value: unknown): { provider: LiveExternalProviderKind; endpoint: string; credentialReference: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("live_external_provider_config_invalid");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["provider", "endpoint", "credentialReference"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("live_external_provider_raw_credential_or_unknown_field_rejected");
  if (!(getUnconfiguredLiveProviderAdapters().some((row) => row.provider === input["provider"]))) throw new Error("live_external_provider_kind_invalid");
  if (typeof input["endpoint"] !== "string" || input["endpoint"].length > 2048 || /[\r\n\0]/.test(input["endpoint"])) throw new Error("live_external_provider_endpoint_invalid");
  let endpoint: URL;
  try {
    endpoint = new URL(input["endpoint"]);
  } catch {
    throw new Error("live_external_provider_endpoint_invalid");
  }
  if (!(["rtmps:", "https:"] as const).includes(endpoint.protocol as "rtmps:" | "https:") || !endpoint.hostname || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error("live_external_provider_endpoint_invalid");
  }
  for (const key of endpoint.searchParams.keys()) {
    if (/(?:secret|token|key|password|credential|signature)/i.test(key)) throw new Error("live_external_provider_endpoint_credential_rejected");
  }
  if (typeof input["credentialReference"] !== "string" || !/^(?:vault|env|secretref|aws-secrets|azure-keyvault|gcp-secret|k8s-secret):\/\/[A-Za-z0-9][A-Za-z0-9._:/-]{2,247}$/.test(input["credentialReference"])) {
    throw new Error("live_external_provider_credential_reference_invalid");
  }
  return { provider: input["provider"] as LiveExternalProviderKind, endpoint: input["endpoint"], credentialReference: input["credentialReference"] };
}

export function redactExternalProviderConfiguration(input: { provider: LiveExternalProviderKind; endpoint: string; credentialReference: string }): Record<string, unknown> {
  return { provider: input.provider, endpointConfigured: true, credentialReferenceConfigured: true, endpoint: "[redacted]", credentialReference: "[redacted]", credentialValuesReturned: false };
}
