import { createMockFirstDiscoveryProvider } from "./mockProviderBase";
import type { DiscoveryProvider } from "./DiscoveryProvider";

export function exaTextSimilarityProvider(): DiscoveryProvider {
  return createMockFirstDiscoveryProvider({
    name: "exa",
    layer: "metadata_text",
    endpointName: "similar_content_search",
    resultType: "text_match",
    platform: "semantic_web",
    title: "Mock semantic similarity candidate",
    snippet: "Exa mock candidate discovered from derived metadata and description terms.",
    confidence: 0.7,
    payloadType: "metadata",
    matchReason: "mock_semantic_candidate_from_metadata_only",
    unitCount() {
      return 1;
    },
  });
}
