import type { DiscoveryJobRecord, DiscoveryProviderName } from "./types";
import type { DiscoveryProvider } from "./providers/DiscoveryProvider";
import { acrCloudAudioProvider } from "./providers/acrCloudAudioProvider";
import { apifyTelegramProvider } from "./providers/apifyTelegramProvider";
import { braveTextProvider } from "./providers/braveTextProvider";
import { dataForSeoVisualProvider } from "./providers/dataForSeoVisualProvider";
import { exaTextSimilarityProvider } from "./providers/exaTextSimilarityProvider";

export function getDiscoveryProviders(): DiscoveryProvider[] {
  return [
    dataForSeoVisualProvider(),
    acrCloudAudioProvider(),
    braveTextProvider(),
    exaTextSimilarityProvider(),
    apifyTelegramProvider(),
  ];
}

export function providersForJob(job: DiscoveryJobRecord): DiscoveryProvider[] {
  const requested = new Set(job.requestedLayers);
  return getDiscoveryProviders().filter((provider) => requested.has(provider.layer));
}

export function providersForNames(names: readonly DiscoveryProviderName[]): DiscoveryProvider[] {
  const all = getDiscoveryProviders();
  return names
    .map((name) => all.find((provider) => provider.name === name))
    .filter((provider): provider is DiscoveryProvider => Boolean(provider));
}
