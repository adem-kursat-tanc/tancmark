export const LIVE_ARCHITECTURE_DECISION_ROLE =
  "live_open_source_blueprint_no_vault_no_confirmed" as const;

export interface LiveOpenSourceArchitecture {
  architectureName: "tancmark_live_open_source_mux_like";
  primaryStreamingEngine: "srs";
  secondaryStreamingEngine: "mediamtx";
  processingEngine: "ffmpeg_cli_external";
  webPlayerCandidates: readonly ["shaka_player", "video_js"];
  analyticsCandidate: "openqoe_future";
  cdnStrategy: "external_cdn_future";
  drmStrategy: "external_multi_drm_provider_future";
  tancmarkWatermarkStrategy: "separate_preseal_live_lab_future";
  personalizedWatermarkStrategy: "future_premium_rd";
  status: "blueprint_mock_first";
  realBroadcastEnabled: false;
  realServerProvisioned: false;
  realDrmEnabled: false;
  realWatermarkConnected: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ARCHITECTURE_DECISION_ROLE;
}

export function getLiveOpenSourceArchitecture(): LiveOpenSourceArchitecture {
  return {
    architectureName: "tancmark_live_open_source_mux_like",
    primaryStreamingEngine: "srs",
    secondaryStreamingEngine: "mediamtx",
    processingEngine: "ffmpeg_cli_external",
    webPlayerCandidates: ["shaka_player", "video_js"],
    analyticsCandidate: "openqoe_future",
    cdnStrategy: "external_cdn_future",
    drmStrategy: "external_multi_drm_provider_future",
    tancmarkWatermarkStrategy: "separate_preseal_live_lab_future",
    personalizedWatermarkStrategy: "future_premium_rd",
    status: "blueprint_mock_first",
    realBroadcastEnabled: false,
    realServerProvisioned: false,
    realDrmEnabled: false,
    realWatermarkConnected: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ARCHITECTURE_DECISION_ROLE,
  };
}
