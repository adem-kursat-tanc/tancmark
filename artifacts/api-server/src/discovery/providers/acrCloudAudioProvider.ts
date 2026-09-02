import { createMockFirstDiscoveryProvider } from "./mockProviderBase";
import type { DiscoveryProvider } from "./DiscoveryProvider";

export function acrCloudAudioProvider(): DiscoveryProvider {
  return createMockFirstDiscoveryProvider({
    name: "acrcloud",
    layer: "audio",
    endpointName: "custom_bucket_audio_fingerprint",
    resultType: "audio_match",
    platform: "audio_fingerprint",
    title: "Mock audio fingerprint candidate",
    snippet: "ACRCloud mock candidate discovered from derived audio fingerprint.",
    confidence: 0.71,
    payloadType: "fingerprint",
    matchReason: "mock_audio_candidate_from_fingerprint_only",
    unitCount() {
      return 1;
    },
  });
}
