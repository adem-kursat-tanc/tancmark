export type LiveFeatureStatus =
  | "mock_first_now"
  | "future_phase"
  | "external_dependency"
  | "research_only"
  | "not_supported_now"
  | "prohibited_this_phase";

export interface LiveFeatureStatusEntry {
  featureKey: string;
  displayName: string;
  status: LiveFeatureStatus;
  decisionRole: "live_feature_status_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  note: string;
}

const ROLE = "live_feature_status_no_vault_no_confirmed" as const;

export function getLiveFeatureStatusMatrix(): LiveFeatureStatusEntry[] {
  return [
    entry("srs_engine", "SRS engine", "mock_first_now", "Primary open-source live engine candidate."),
    entry("mediamtx_alternative", "MediaMTX alternative", "mock_first_now", "Secondary/lab-friendly open-source engine candidate."),
    entry("ffmpeg_processing", "FFmpeg processing", "future_phase", "External CLI processing plan; build/license must be checked."),
    entry("shaka_player", "Shaka Player", "future_phase", "Player candidate for HLS/DASH and future DRM workflows."),
    entry("video_js", "Video.js", "future_phase", "Simple web player candidate."),
    entry("openqoe", "OpenQoE analytics", "research_only", "Future QoE analytics candidate."),
    entry("ats_cache_layer", "ATS CDN/cache layer", "mock_first_now", "Apache Traffic Server cache blueprint; no real ATS traffic in this phase."),
    entry("external_cdn", "Bunny/Cloudflare CDN", "external_dependency", "Future external CDN adapter; ATS remains blueprint/mock-first."),
    entry("live_dna_learning_brain", "Live DNA learning brain", "mock_first_now", "Learns, summarizes and recommends only; no auto apply or decision authority."),
    entry("multi_drm", "Multi-DRM", "external_dependency", "Future premium provider integration only."),
    entry("general_live_preseal", "General live TancMark pre-seal", "future_phase", "Future lab; not connected to current watermark logic."),
    entry("personalized_forensic_watermark", "Personalized forensic watermark", "research_only", "Future premium R&D."),
    entry("ab_forensic_watermark", "A/B forensic watermark", "research_only", "Future premium R&D and standards research."),
    entry("real_broadcast", "Real broadcast", "prohibited_this_phase", "No real broadcast in this phase."),
    entry("real_api", "Real provider API", "prohibited_this_phase", "No real external API call in this phase."),
    entry("payment_billing", "Payment/billing", "prohibited_this_phase", "No credit, payment, billing or package behavior."),
  ];
}

function entry(
  featureKey: string,
  displayName: string,
  status: LiveFeatureStatus,
  note: string,
): LiveFeatureStatusEntry {
  return {
    featureKey,
    displayName,
    status,
    decisionRole: ROLE,
    canOpenVault: false,
    confirmed: false,
    final: false,
    note,
  };
}
