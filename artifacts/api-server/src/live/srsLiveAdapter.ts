import type { LiveProviderCapabilities } from "./liveProviderAdapter";

export function getSrsLiveAdapterCapabilities(): LiveProviderCapabilities {
  return {
    provider: "srs",
    providerType: "self_hosted_open_source",
    status: "mock_first_primary",
    licenseType: "MIT",
    supportsRtmpInput: true,
    supportsSrtInput: true,
    supportsWebRtcInput: true,
    supportsHlsOutput: true,
    supportsDashOutput: true,
    supportsHttpFlvOutput: true,
    supportsRecording: "planned_or_adapter_dependent",
    supportsForwarding: true,
    supportsTancMarkInvisibleWatermark: false,
    requiresTancMarkPreSealLayer: true,
    supportsPersonalizedABWatermark: false,
    supportsDrm: false,
    realServerProvisioned: false,
    realBroadcastEnabled: false,
  };
}
