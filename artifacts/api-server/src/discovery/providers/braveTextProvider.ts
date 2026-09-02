import { createMockFirstDiscoveryProvider } from "./mockProviderBase";
import type { DiscoveryProvider } from "./DiscoveryProvider";

export function braveTextProvider(): DiscoveryProvider {
  return createMockFirstDiscoveryProvider({
    name: "brave",
    layer: "metadata_text",
    endpointName: "web_text_search",
    resultType: "text_match",
    platform: "web",
    title: "Mock web text candidate",
    snippet: "Brave mock candidate discovered from metadata-derived query terms.",
    confidence: 0.68,
    payloadType: "query",
    matchReason: "mock_text_candidate_from_metadata_query",
    unitCount(input) {
      return Math.max(1, input.metadataQueries.length);
    },
  });
}
