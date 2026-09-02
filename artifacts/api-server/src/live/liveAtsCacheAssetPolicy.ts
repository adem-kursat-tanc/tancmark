export const LIVE_ATS_CACHE_ASSET_POLICY_DECISION_ROLE =
  "ats_cache_asset_policy_only_no_vault_no_confirmed" as const;

export interface LiveAtsCacheAssetPolicy {
  policyName: "live_ats_cache_asset_policy";
  cacheableAssets: string[];
  sensitiveNonCacheable: string[];
  rules: string[];
  personalTokensCached: false;
  secretValuesLogged: false;
  drmLicenseEndpointCached: false;
  secureRoomPayloadCached: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ATS_CACHE_ASSET_POLICY_DECISION_ROLE;
}

export function getLiveAtsCacheAssetPolicy(): LiveAtsCacheAssetPolicy {
  return {
    policyName: "live_ats_cache_asset_policy",
    cacheableAssets: [
      "HLS playlist .m3u8",
      "HLS segment .ts",
      "CMAF segment .m4s",
      "VOD MP4 pieces",
      "Thumbnail images",
      "GIF previews",
      "Storyboard/timeline previews",
      "Subtitle/caption files",
    ],
    sensitiveNonCacheable: [
      "DRM license requests",
      "Personal viewer tokens",
      "User-specific signed URLs",
      "Viewer identity URLs",
      "Secure Room private evidence payload",
      "Secret/stream key values",
      "Raw private uploads",
      "Live watermark ID secrets",
    ],
    rules: [
      "Personal tokens are never cached.",
      "Secret values are never logged.",
      "DRM license endpoints are never cached.",
      "Secure Room private evidence payloads are never cached.",
      "Only public or authorized playback assets may be cached with explicit cache rules.",
    ],
    personalTokensCached: false,
    secretValuesLogged: false,
    drmLicenseEndpointCached: false,
    secureRoomPayloadCached: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ATS_CACHE_ASSET_POLICY_DECISION_ROLE,
  };
}
