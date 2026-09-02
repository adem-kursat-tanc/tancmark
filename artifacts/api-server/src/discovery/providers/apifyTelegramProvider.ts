import { createMockFirstDiscoveryProvider } from "./mockProviderBase";
import type { DiscoveryProvider } from "./DiscoveryProvider";

export function apifyTelegramProvider(): DiscoveryProvider {
  return createMockFirstDiscoveryProvider({
    name: "apify_telegram",
    layer: "telegram",
    endpointName: "public_telegram_search",
    resultType: "telegram_message",
    platform: "telegram",
    title: "Mock Telegram candidate",
    snippet: "Apify Telegram mock candidate discovered from derived public-channel query terms.",
    confidence: 0.62,
    payloadType: "query",
    matchReason: "mock_telegram_candidate_from_metadata_query",
    unitCount(input) {
      return Math.max(1, input.telegramQueries.length);
    },
  });
}
