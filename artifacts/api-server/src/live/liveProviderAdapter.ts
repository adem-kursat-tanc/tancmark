export type LiveProviderName = "srs" | "mediamtx";
export type LiveProviderType = "self_hosted_open_source";
export type LiveProviderStatus = "mock_first_primary" | "mock_first_secondary";
export type LiveProviderLicenseType = "MIT";
export type PlannedOrAdapterDependent = "planned_or_adapter_dependent";

export interface LiveProviderCapabilities {
  provider: LiveProviderName;
  providerType: LiveProviderType;
  status: LiveProviderStatus;
  licenseType: LiveProviderLicenseType;
  supportsRtmpInput: boolean;
  supportsSrtInput: boolean;
  supportsWebRtcInput: boolean;
  supportsHlsOutput: boolean;
  supportsDashOutput?: boolean;
  supportsHttpFlvOutput?: boolean;
  supportsRecording: boolean | PlannedOrAdapterDependent;
  supportsProxy?: boolean;
  supportsForwarding: boolean;
  supportsControlApi?: boolean;
  supportsTancMarkInvisibleWatermark: false;
  requiresTancMarkPreSealLayer: true;
  supportsPersonalizedABWatermark: false;
  supportsDrm: false;
  realServerProvisioned: false;
  realBroadcastEnabled: false;
}

export const LIVE_PROVIDER_DECISION_ROLE =
  "live_provider_mock_support_only_no_vault_no_confirmed" as const;

export type LiveProviderDecisionRole = typeof LIVE_PROVIDER_DECISION_ROLE;

export interface LiveProviderSummary {
  providers: LiveProviderCapabilities[];
  decisionRole: LiveProviderDecisionRole;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
}
