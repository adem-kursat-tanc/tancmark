import type { LiveProviderCapabilities } from "./liveProviderAdapter";

export function getMediaMtxLiveAdapterCapabilities(): LiveProviderCapabilities {
  return {
    provider: "mediamtx",
    providerType: "self_hosted_open_source",
    status: "mock_first_secondary",
    licenseType: "MIT",
    supportsRtmpInput: true,
    supportsSrtInput: true,
    supportsWebRtcInput: true,
    supportsHlsOutput: true,
    supportsRecording: true,
    supportsProxy: true,
    supportsForwarding: true,
    supportsControlApi: true,
    supportsTancMarkInvisibleWatermark: false,
    requiresTancMarkPreSealLayer: true,
    supportsPersonalizedABWatermark: false,
    supportsDrm: false,
    realServerProvisioned: false,
    realBroadcastEnabled: false,
  };
}
