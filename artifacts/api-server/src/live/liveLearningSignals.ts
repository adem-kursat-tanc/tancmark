export const LIVE_LEARNING_SIGNALS_DECISION_ROLE =
  "live_learning_signal_catalog_only_no_vault_no_confirmed" as const;

export type LiveLearningSignalType =
  | "api_connection_attempts"
  | "provider_documents"
  | "provider_connection_results"
  | "srs_behavior"
  | "mediamtx_behavior"
  | "ats_behavior"
  | "ffmpeg_behavior"
  | "multi_drm_candidates"
  | "broadcast_latency"
  | "broadcast_dropout"
  | "stream_target_result"
  | "youtube_result"
  | "facebook_result"
  | "twitch_result"
  | "custom_rtmp_result"
  | "estimated_vs_actual_cost"
  | "watermark_durability"
  | "post_live_id_read"
  | "cache_hit_miss"
  | "player_error"
  | "viewer_buffering"
  | "webhook_event_result"
  | "license_security_risk"
  | "do_not_retry_solution"
  | "better_setting_found"
  | "test_order_learning"
  | "cpu_usage"
  | "gpu_usage"
  | "memory_usage"
  | "bandwidth_usage"
  | "recording_result"
  | "hls_segment_error"
  | "ats_latency"
  | "ats_origin_load_reduction"
  | "future_drm_license_error"
  | "secure_room_handoff_quality"
  | "social_compression_watermark_result";

export interface LiveLearningSignalCatalogEntry {
  signalType: LiveLearningSignalType;
  sourceArea: string;
  learns: string;
  decisionImpact: "none";
  supportOnly: true;
}

export interface LiveLearningSignalCatalog {
  catalogName: "live_learning_signal_catalog";
  status: "mock_first_read_only";
  signals: LiveLearningSignalCatalogEntry[];
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_LEARNING_SIGNALS_DECISION_ROLE;
}

const signals: LiveLearningSignalCatalogEntry[] = [
  signal("api_connection_attempts", "provider_api", "API baglanti denemesi basari/basarisizlik ve hata nedeni."),
  signal("provider_documents", "provider_research", "Saglayici dokuman notlari, limitler, yasaklar ve guvenlik gereksinimleri."),
  signal("provider_connection_results", "provider_api", "Saglayici baglanti sonucunun tekrar denenip denenmemesi."),
  signal("srs_behavior", "live_engine", "SRS ingest, latency, dropout ve target davranisi."),
  signal("mediamtx_behavior", "live_engine", "MediaMTX lab alternatifinin basari ve zayifliklari."),
  signal("ats_behavior", "cdn_cache", "ATS cache davranisi, edge/origin etkisi ve riskleri."),
  signal("ffmpeg_behavior", "processing", "FFmpeg isleme suresi, hata, codec ve kaynak kullanim davranisi."),
  signal("multi_drm_candidates", "drm_future", "Multi-DRM adaylari, lisans ve entegrasyon riski."),
  signal("broadcast_latency", "quality", "Canli yayin gecikmesi ve hangi ayarin daha iyi calistigi."),
  signal("broadcast_dropout", "quality", "Yayin kopmasi, tekrar baglanma ve hedefe gore hata paterni."),
  signal("stream_target_result", "target", "Stream target basari/basarisizlik sonucu."),
  signal("youtube_result", "target_youtube", "YouTube hedefinin basari, hata ve tekrar encode etkisi."),
  signal("facebook_result", "target_facebook", "Facebook hedefinin basari, hata ve platform etkisi."),
  signal("twitch_result", "target_twitch", "Twitch hedefinin basari, hata ve platform etkisi."),
  signal("custom_rtmp_result", "target_custom_rtmp", "Custom RTMP hedefinin basari ve hata sonucu."),
  signal("estimated_vs_actual_cost", "cost", "Tahmini maliyet ile olculen gercek maliyet farki."),
  signal("watermark_durability", "watermark_lab", "Canli pipeline sonrasi TancMark muhur dayanim sonucu."),
  signal("post_live_id_read", "watermark_lab", "Yayin sonrasi gercek ID okuma basari/basarisizlik sonucu."),
  signal("cache_hit_miss", "cdn_cache", "Cache hit/miss orani ve origin yuk etkisi."),
  signal("player_error", "player", "Player hata tipi, platform ve ayar baglami."),
  signal("viewer_buffering", "player_qoe", "Izleyici takilma ve QoE sinyalleri."),
  signal("webhook_event_result", "events", "Webhook/event basari, retry ve teslim davranisi."),
  signal("license_security_risk", "legal_security", "Lisans, gizlilik veya guvenlik riski."),
  signal("do_not_retry_solution", "learning_guard", "Tekrar denenmemesi gereken ayar, saglayici veya rota."),
  signal("better_setting_found", "learning_recommendation", "Daha iyi sonuc veren ayar veya test sirasi."),
  signal("test_order_learning", "learning_recommendation", "Hangi sirayla test yapmanin daha guvenli oldugu."),
  signal("cpu_usage", "infrastructure", "CPU tuketimi ve darbogaz paterni."),
  signal("gpu_usage", "infrastructure", "GPU kullanimi veya GPU gereksinim riski."),
  signal("memory_usage", "infrastructure", "Bellek kullanimi ve olasi sizinti/darbogaz."),
  signal("bandwidth_usage", "infrastructure", "Bant kullanimi ve maliyet etkisi."),
  signal("recording_result", "recording", "Canli kayit/VOD basari, hata ve dosya uretim sonucu."),
  signal("hls_segment_error", "hls", "HLS segment uretim, siralama veya erisim hatasi."),
  signal("ats_latency", "cdn_cache", "ATS edge/origin latency etkisi."),
  signal("ats_origin_load_reduction", "cdn_cache", "ATS'nin origin yukunu azaltma etkisi."),
  signal("future_drm_license_error", "drm_future", "Gelecekteki DRM lisans endpoint hata sinyali."),
  signal("secure_room_handoff_quality", "secure_room", "Live Secure Room handoff eksiksizlik ve kalite sinyali."),
  signal("social_compression_watermark_result", "watermark_lab", "Sosyal platform sikistirmesi sonrasi muhur okunabilirligi."),
];

export function getLiveLearningSignalCatalog(): LiveLearningSignalCatalog {
  return {
    catalogName: "live_learning_signal_catalog",
    status: "mock_first_read_only",
    signals,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_LEARNING_SIGNALS_DECISION_ROLE,
  };
}

function signal(
  signalType: LiveLearningSignalType,
  sourceArea: string,
  learns: string,
): LiveLearningSignalCatalogEntry {
  return {
    signalType,
    sourceArea,
    learns,
    decisionImpact: "none",
    supportOnly: true,
  };
}
