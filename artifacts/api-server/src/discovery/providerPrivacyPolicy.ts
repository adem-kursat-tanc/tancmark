import type { DiscoveryProviderRequest } from "./providers/DiscoveryProvider";
import type { DiscoveryProviderName } from "./types";

export type DiscoveryProviderPrivacyMode =
  "digest_metadata_fingerprint_or_short_lived_url_only_no_original_content";

export type DiscoveryProviderAllowedPayload =
  | DiscoveryProviderRequest["payloadType"]
  | "url"
  | "image_hash"
  | "audio_fingerprint";

export interface DiscoveryProviderPrivacyPolicy {
  provider: DiscoveryProviderName;
  privacyMode: DiscoveryProviderPrivacyMode;
  allowedPayloadTypes: DiscoveryProviderAllowedPayload[];
  signedUrlRequired: boolean;
  signedUrlMaxTtlSeconds: number;
  sentOriginalContentAllowed: false;
  rawFullAudioAllowed: false;
  publicSourcesOnly: true;
  privateGroupScanAllowed: false;
  loginBypassAllowed: false;
  paywallBypassAllowed: false;
  drmBypassAllowed: false;
  platformComplaintApiEnabled: false;
  supportOnly: true;
  decisionRole: "provider_privacy_policy_no_vault_no_confirmed";
}

const SIGNED_URL_MAX_TTL_SECONDS = 900;

export const DISCOVERY_PROVIDER_PRIVACY_POLICIES: Record<
  DiscoveryProviderName,
  DiscoveryProviderPrivacyPolicy
> = {
  dataforseo: {
    provider: "dataforseo",
    privacyMode: "digest_metadata_fingerprint_or_short_lived_url_only_no_original_content",
    allowedPayloadTypes: ["signed_url", "hash", "image_hash", "metadata"],
    signedUrlRequired: false,
    signedUrlMaxTtlSeconds: SIGNED_URL_MAX_TTL_SECONDS,
    sentOriginalContentAllowed: false,
    rawFullAudioAllowed: false,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    platformComplaintApiEnabled: false,
    supportOnly: true,
    decisionRole: "provider_privacy_policy_no_vault_no_confirmed",
  },
  acrcloud: {
    provider: "acrcloud",
    privacyMode: "digest_metadata_fingerprint_or_short_lived_url_only_no_original_content",
    allowedPayloadTypes: ["fingerprint", "audio_fingerprint", "metadata"],
    signedUrlRequired: false,
    signedUrlMaxTtlSeconds: SIGNED_URL_MAX_TTL_SECONDS,
    sentOriginalContentAllowed: false,
    rawFullAudioAllowed: false,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    platformComplaintApiEnabled: false,
    supportOnly: true,
    decisionRole: "provider_privacy_policy_no_vault_no_confirmed",
  },
  brave: {
    provider: "brave",
    privacyMode: "digest_metadata_fingerprint_or_short_lived_url_only_no_original_content",
    allowedPayloadTypes: ["query", "metadata"],
    signedUrlRequired: false,
    signedUrlMaxTtlSeconds: SIGNED_URL_MAX_TTL_SECONDS,
    sentOriginalContentAllowed: false,
    rawFullAudioAllowed: false,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    platformComplaintApiEnabled: false,
    supportOnly: true,
    decisionRole: "provider_privacy_policy_no_vault_no_confirmed",
  },
  exa: {
    provider: "exa",
    privacyMode: "digest_metadata_fingerprint_or_short_lived_url_only_no_original_content",
    allowedPayloadTypes: ["query", "metadata", "url"],
    signedUrlRequired: false,
    signedUrlMaxTtlSeconds: SIGNED_URL_MAX_TTL_SECONDS,
    sentOriginalContentAllowed: false,
    rawFullAudioAllowed: false,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    platformComplaintApiEnabled: false,
    supportOnly: true,
    decisionRole: "provider_privacy_policy_no_vault_no_confirmed",
  },
  apify_telegram: {
    provider: "apify_telegram",
    privacyMode: "digest_metadata_fingerprint_or_short_lived_url_only_no_original_content",
    allowedPayloadTypes: ["query", "metadata"],
    signedUrlRequired: false,
    signedUrlMaxTtlSeconds: SIGNED_URL_MAX_TTL_SECONDS,
    sentOriginalContentAllowed: false,
    rawFullAudioAllowed: false,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    platformComplaintApiEnabled: false,
    supportOnly: true,
    decisionRole: "provider_privacy_policy_no_vault_no_confirmed",
  },
};

export function getDiscoveryProviderPrivacyPolicy(
  provider: DiscoveryProviderName,
): DiscoveryProviderPrivacyPolicy {
  return DISCOVERY_PROVIDER_PRIVACY_POLICIES[provider];
}

function equivalentPayloads(payloadType: string): DiscoveryProviderAllowedPayload[] {
  if (payloadType === "hash") return ["hash", "image_hash"];
  if (payloadType === "fingerprint") return ["fingerprint", "audio_fingerprint"];
  return [payloadType as DiscoveryProviderAllowedPayload];
}

export function isDiscoveryProviderPayloadAllowed(
  provider: DiscoveryProviderName,
  payloadType: string,
): boolean {
  const allowed = new Set(getDiscoveryProviderPrivacyPolicy(provider).allowedPayloadTypes);
  return equivalentPayloads(payloadType).some((candidate) => allowed.has(candidate));
}

export function isDiscoverySignedUrlTtlSafe(
  provider: DiscoveryProviderName,
  payloadType: string,
  ttlSeconds: number,
): boolean {
  if (payloadType !== "signed_url") return true;
  const policy = getDiscoveryProviderPrivacyPolicy(provider);
  return ttlSeconds > 0 && ttlSeconds <= policy.signedUrlMaxTtlSeconds;
}
