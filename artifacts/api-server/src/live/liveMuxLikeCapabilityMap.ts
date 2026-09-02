export type LiveCapabilityStatus =
  | "mock-first"
  | "future"
  | "external-provider"
  | "tancmark-core"
  | "research-only"
  | "not-in-this-phase";

export interface LiveMuxLikeCapability {
  capabilityKey: string;
  displayName: string;
  muxEquivalent: string;
  selectedOpenSourceOrProvider: string;
  status: LiveCapabilityStatus;
  canOpenVault: false;
  decisionRole: "live_capability_support_only_no_vault_no_confirmed";
  needsTancMarkPreSeal: boolean;
  needsExternalProvider: boolean;
  needsRealServer: boolean;
  userVisible: boolean;
  marketingClaimStatus: "can_describe_as_mock_plan" | "future_only" | "do_not_market_as_live";
  notes: string;
}

const ROLE = "live_capability_support_only_no_vault_no_confirmed" as const;

export function getLiveMuxLikeCapabilityMap(): LiveMuxLikeCapability[] {
  return [
    cap("live_ingest", "Live ingest", "Live input", "SRS / MediaMTX", "mock-first", true, false, true, true, "can_describe_as_mock_plan", "Mock ingest only."),
    cap("rtmps_input", "RTMPS input", "RTMPS ingest", "SRS candidate", "future", true, false, true, true, "future_only", "TLS/RTMPS to be validated later."),
    cap("srt_input", "SRT input", "SRT ingest", "SRS / MediaMTX", "mock-first", true, false, true, true, "can_describe_as_mock_plan", "Protocol support candidate."),
    cap("obs_input", "OBS input", "RTMP ingest from OBS", "SRS / MediaMTX", "mock-first", true, false, true, true, "can_describe_as_mock_plan", "OBS is a client-side source option."),
    cap("browser_mobile_future_input", "Browser/mobile future input", "Direct upload/record input", "WebRTC future", "future", true, false, true, true, "future_only", "Not implemented now."),
    cap("encoding_transcoding", "Encoding/transcoding", "Encoding ladder", "FFmpeg CLI external", "future", true, false, true, false, "future_only", "External CLI plan only."),
    cap("adaptive_bitrate", "Adaptive bitrate", "ABR streaming", "SRS/FFmpeg/CDN future", "future", true, false, true, true, "future_only", "Needs real lab."),
    cap("multi_quality_output", "Multi-quality output", "Renditions", "FFmpeg/SRS future", "future", true, false, true, true, "future_only", "Mock status only."),
    cap("low_latency", "Low latency", "Low-latency live", "SRS/WebRTC candidate", "future", true, false, true, true, "future_only", "Needs real server testing."),
    cap("simulcast_multistream", "Simulcast/multistream", "Simulcast targets", "SRS/MediaMTX forwarding", "future", true, false, true, true, "future_only", "Mock target model only."),
    cap("youtube_target", "YouTube target", "Live simulcast target", "custom RTMP mock target", "future", true, true, true, true, "future_only", "No real YouTube connection."),
    cap("facebook_target", "Facebook target", "Live simulcast target", "custom RTMP mock target", "future", true, true, true, true, "future_only", "No real Facebook connection."),
    cap("twitch_target", "Twitch target", "Live simulcast target", "custom RTMP mock target", "future", true, true, true, true, "future_only", "No real Twitch connection."),
    cap("custom_rtmp_target", "Custom RTMP target", "Custom RTMP restream", "SRS/MediaMTX forwarding", "mock-first", true, false, true, true, "can_describe_as_mock_plan", "Mock target only."),
    cap("future_tiktok", "Future TikTok", "Social target", "future external/social adapter", "future", true, true, true, true, "future_only", "No real TikTok connection."),
    cap("future_instagram", "Future Instagram", "Social target", "future external/social adapter", "future", true, true, true, true, "future_only", "No real Instagram connection."),
    cap("cdn_delivery", "CDN/delivery", "Global delivery", "ATS blueprint + BunnyCDN / Cloudflare future", "mock-first", false, true, true, true, "can_describe_as_mock_plan", "ATS blueprint exists; real traffic deferred."),
    cap("ats_cache_layer", "ATS CDN/cache layer", "Edge cache", "Apache Traffic Server", "mock-first", false, false, true, true, "can_describe_as_mock_plan", "Cache blueprint only; not ingest, watermark or DRM."),
    cap("own_site_hls_delivery", "Own-site HLS delivery", "Playback URL", "SRS/MediaMTX HLS", "future", true, false, true, true, "future_only", "Requires real lab."),
    cap("live_to_vod_recording", "Live-to-VOD recording", "Recording asset", "MediaMTX / FFmpeg future", "future", true, false, true, true, "future_only", "No real recording now."),
    cap("short_retention", "Short retention 3-7 days", "Asset retention", "storage policy future", "future", false, false, true, true, "future_only", "Policy only."),
    cap("token_signed_url", "Token/signed URL", "Playback access control", "app/CDN future", "future", false, true, true, true, "future_only", "Not implemented now."),
    cap("external_multi_drm", "External Multi-DRM", "DRM", "EZDRM / BuyDRM / Axinom / castLabs / DoveRunner", "external-provider", false, true, true, true, "future_only", "Future premium provider."),
    cap("player", "Player", "Video player", "Shaka Player / Video.js", "future", false, false, false, true, "future_only", "No player app in this phase."),
    cap("analytics_qoe", "Analytics/QoE", "Mux Data-like analytics", "OpenQoE future", "research-only", false, false, true, true, "future_only", "Future analytics."),
    cap("live_dna_learning_brain", "Live DNA learning brain", "Operational learning", "TancMark Live DNA mock brain", "mock-first", false, false, false, true, "can_describe_as_mock_plan", "Learns, summarizes and recommends; no auto repair or decision authority."),
    cap("webhook_event_bus", "Webhook/event bus", "Events", "internal event model future", "future", false, false, true, false, "future_only", "No webhook delivery now."),
    cap("thumbnail", "Thumbnail", "Thumbnail generation", "FFmpeg future", "future", false, false, true, true, "future_only", "No media processing now."),
    cap("gif", "GIF", "Animated preview", "FFmpeg future", "future", false, false, true, true, "future_only", "No media processing now."),
    cap("captions_subtitles", "Captions/subtitles", "Text tracks", "future workflow", "future", false, false, true, true, "future_only", "Not in this phase."),
    cap("clipping", "Clipping", "Clip creation", "FFmpeg future", "future", false, false, true, true, "future_only", "No clip generation now."),
    cap("general_tancmark_live_preseal", "General TancMark live pre-seal", "Pre-seal before live", "TancMark core future lab", "tancmark-core", true, false, false, true, "future_only", "Not connected now."),
    cap("post_live_reseal_recommendation", "Post-live re-seal recommendation", "Post-event protection", "TancMark advisory future", "future", true, false, false, true, "future_only", "Recommendation only."),
    cap("secure_room_handoff", "Secure Room handoff", "Evidence support", "TancMark Secure Room", "mock-first", false, false, false, true, "can_describe_as_mock_plan", "Support-only handoff."),
    cap("future_personalized_forensic_watermark", "Future personalized forensic watermark", "Per-viewer watermark", "TancMark premium R&D", "research-only", true, false, true, false, "future_only", "Not ready now."),
    cap("future_ab_forensic_watermark", "Future A/B forensic watermark", "A/B forensic standard", "DASH-IF/ETSI research", "research-only", true, false, true, false, "future_only", "Research-only."),
    cap("future_encrypted_streaming", "Future encrypted streaming", "Encrypted streaming", "External DRM + TancMark future", "future", false, true, true, true, "future_only", "Not this phase."),
    cap("future_secure_classroom", "Future Secure Classroom", "Education product", "TancMark future", "future", true, true, true, true, "future_only", "Future product."),
  ];
}

function cap(
  capabilityKey: string,
  displayName: string,
  muxEquivalent: string,
  selectedOpenSourceOrProvider: string,
  status: LiveCapabilityStatus,
  needsTancMarkPreSeal: boolean,
  needsExternalProvider: boolean,
  needsRealServer: boolean,
  userVisible: boolean,
  marketingClaimStatus: LiveMuxLikeCapability["marketingClaimStatus"],
  notes: string,
): LiveMuxLikeCapability {
  return {
    capabilityKey,
    displayName,
    muxEquivalent,
    selectedOpenSourceOrProvider,
    status,
    canOpenVault: false,
    decisionRole: ROLE,
    needsTancMarkPreSeal,
    needsExternalProvider,
    needsRealServer,
    userVisible,
    marketingClaimStatus,
    notes,
  };
}
