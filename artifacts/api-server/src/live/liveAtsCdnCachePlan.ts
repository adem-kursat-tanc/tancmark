export const LIVE_ATS_CDN_CACHE_DECISION_ROLE = "support_infrastructure_only" as const;

export interface LiveAtsCdnCachePlan {
  layerName: "ats_cdn_cache_layer";
  role: "cdn_cache_edge_distribution";
  status: "blueprint_mock_first";
  licenseType: "Apache-2.0";
  commercialUseAllowed: true;
  requiresLicenseNotice: true;
  isStreamingEngine: false;
  isWatermarkEngine: false;
  isDrmEngine: false;
  realAtsServerProvisioned: false;
  realTrafficServed: false;
  tasks: string[];
  nonGoals: string[];
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ATS_CDN_CACHE_DECISION_ROLE;
}

export function getLiveAtsCdnCachePlan(): LiveAtsCdnCachePlan {
  return {
    layerName: "ats_cdn_cache_layer",
    role: "cdn_cache_edge_distribution",
    status: "blueprint_mock_first",
    licenseType: "Apache-2.0",
    commercialUseAllowed: true,
    requiresLicenseNotice: true,
    isStreamingEngine: false,
    isWatermarkEngine: false,
    isDrmEngine: false,
    realAtsServerProvisioned: false,
    realTrafficServed: false,
    tasks: [
      "Cache HLS playback manifests and segments.",
      "Cache DASH/CMAF/VOD playback pieces.",
      "Distribute .m3u8, .ts, .m4s, .mp4, thumbnail and preview assets.",
      "Reduce SRS/MediaMTX/HLS origin load in a future lab.",
      "Optimize bandwidth usage after real cache hit/miss measurement.",
      "Prepare a future mini-CDN foundation for TancMark site and Secure Classroom playback.",
    ],
    nonGoals: [
      "Camera ingest.",
      "RTMP/SRT ingest.",
      "Video encode/transcode.",
      "TancMark invisible watermark encode/read.",
      "DRM.",
      "Personalized or A/B forensic traces.",
      "VAULT/confirmed/final decision.",
    ],
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ATS_CDN_CACHE_DECISION_ROLE,
  };
}
