import { createMockFirstDiscoveryProvider } from "./mockProviderBase";
import type { DiscoveryProvider } from "./DiscoveryProvider";

export function dataForSeoVisualProvider(): DiscoveryProvider {
  return createMockFirstDiscoveryProvider({
    name: "dataforseo",
    layer: "visual",
    endpointName: "visual_reverse_search_or_video_metadata",
    resultType: "image_match",
    platform: "web_visual",
    title: "Mock visual candidate",
    snippet: "DataForSEO mock candidate discovered from derived keyframe hashes.",
    confidence: 0.74,
    payloadType: "signed_url",
    matchReason: "mock_visual_candidate_from_keyframe_or_video_metadata",
    unitCount(input) {
      return Math.max(1, input.assets.filter((asset) => asset.assetType === "keyframe").length);
    },
  });
}
