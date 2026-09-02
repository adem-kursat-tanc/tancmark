import { getLiveCustomRtmpSmokeReadiness } from "./liveCustomRtmpSmokeReadiness";
import { getLiveRealLabGateSummary } from "./liveRealLabGateSummary";
import { getLiveSmokeReadinessRiskReport } from "./liveSmokeReadinessRiskReport";
import { getLiveYouTubeSmokeReadiness } from "./liveYouTubeSmokeReadiness";
import { readinessCheck, type LiveReadinessCheck } from "./liveSingleTargetSmokeReadiness";

export const LIVE_SMOKE_TEST_READINESS_CHECKLIST_DECISION_ROLE =
  "live_smoke_test_readiness_checklist_support_only_no_vault_no_confirmed" as const;

export interface LiveSmokeReadinessSection {
  sectionKey: string;
  title: string;
  checks: LiveReadinessCheck[];
}

export interface LiveSmokeTestReadinessChecklist {
  phase: "single_target_smoke_test_readiness_mock_only";
  readyForMockChecklist: true;
  readyForRealLab: false;
  sections: LiveSmokeReadinessSection[];
  youtubeReadiness: ReturnType<typeof getLiveYouTubeSmokeReadiness>;
  customRtmpReadiness: ReturnType<typeof getLiveCustomRtmpSmokeReadiness>;
  realLabGateSummary: ReturnType<typeof getLiveRealLabGateSummary>;
  riskReportSummary: ReturnType<typeof getLiveSmokeReadinessRiskReport>;
  secureRoomHandoffAvailable: true;
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  realCredentialStored: false;
  realStreamKeyUsed: false;
  streamKeyValueExposed: false;
  realRtmpSrtWebRtcHlsTraffic: false;
  realServerStarted: false;
  realPlayerLoaded: false;
  realFfmpegExecuted: false;
  realWebhookSent: false;
  realDrmProviderConnected: false;
  billingCreditPaymentAdded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SMOKE_TEST_READINESS_CHECKLIST_DECISION_ROLE;
}

export function getLiveSmokeTestReadinessChecklist(): LiveSmokeTestReadinessChecklist {
  return {
    phase: "single_target_smoke_test_readiness_mock_only",
    readyForMockChecklist: true,
    readyForRealLab: false,
    sections: [
      section("engine_readiness", "SRS/MediaMTX engine readiness", [
        readinessCheck("srs_config_preview", "SRS config preview", "ready_mock", "SRS config dry-run hazir; real server yok."),
        readinessCheck("mediamtx_config_preview", "MediaMTX config preview", "ready_mock", "MediaMTX config dry-run hazir; real server yok."),
        readinessCheck("real_engine_lab", "Real engine lab", "blocked_real_lab", "Gercek server/port/firewall/trafik acilmadi."),
      ]),
      section("target_readiness", "YouTube/custom RTMP target readiness", [
        readinessCheck("youtube_readiness", "YouTube mock readiness", "ready_mock", "YouTube target readiness mock-only raporlanir."),
        readinessCheck("custom_rtmp_readiness", "Custom RTMP mock readiness", "ready_mock", "Custom RTMP target readiness mock-only raporlanir."),
        readinessCheck("real_target_push", "Real target push", "blocked_real_lab", "Gercek target push/API/stream key kullanimi yok."),
      ]),
      section("processing_readiness", "FFmpeg/VOD readiness", [
        readinessCheck("ffmpeg_dry_run", "FFmpeg dry-run", "ready_mock", "Komut preview vardir; FFmpeg calismaz."),
        readinessCheck("vod_mock_pipeline", "Recording/VOD mock pipeline", "ready_mock", "VOD/manifest preview vardir; medya islenmez."),
      ]),
      section("access_readiness", "Access/token readiness", [
        readinessCheck("access_policy_mock", "Access policy mock", "ready_mock", "Policy preview vardir; real enforcement yok."),
        readinessCheck("signed_url_mock", "Signed URL mock", "ready_mock", "Redacted mock vardir; real imza yok."),
        readinessCheck("real_token_generation", "Real token generation", "blocked_real_lab", "Gercek token/signed URL uretilmez."),
      ]),
      section("player_readiness", "Player readiness", [
        readinessCheck("player_shell_mock", "Player shell mock", "ready_mock", "Shaka/Video.js mock shell vardir."),
        readinessCheck("real_playback", "Real playback", "blocked_real_lab", "Gercek HLS/DASH/WebRTC stream cekilmez."),
      ]),
      section("event_readiness", "Event/webhook readiness", [
        readinessCheck("event_bus_mock", "Event bus mock", "ready_mock", "Mock event timeline vardir."),
        readinessCheck("webhook_payload_preview", "Webhook payload preview", "ready_mock", "Payload preview vardir; gercek webhook yok."),
      ]),
      section("credential_safety", "Target credential safety readiness", [
        readinessCheck("credential_redaction", "Credential redaction", "ready_mock", "Stream key/token degerleri expose edilmez."),
        readinessCheck("secret_storage_future", "Secret storage future", "blocked_real_lab", "Production secret storage henuz yoktur."),
      ]),
      section("real_lab_gate", "Real lab gate summary", [
        readinessCheck("human_approval_required", "Human approval required", "blocked_real_lab", "APPROVE_LIVE_SAFE_IMPROVEMENT ve ayrik real-lab onayi gerekir."),
        readinessCheck("billing_not_added", "Billing/credit/payment", "ready_mock", "Bu fazda billingCreditPaymentAdded=false kalir."),
        readinessCheck("vault_boundary", "VAULT boundary", "ready_mock", "Readiness raporlari VAULT/confirmed/final acmaz."),
      ]),
    ],
    youtubeReadiness: getLiveYouTubeSmokeReadiness(),
    customRtmpReadiness: getLiveCustomRtmpSmokeReadiness(),
    realLabGateSummary: getLiveRealLabGateSummary(),
    riskReportSummary: getLiveSmokeReadinessRiskReport(),
    secureRoomHandoffAvailable: true,
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    realCredentialStored: false,
    realStreamKeyUsed: false,
    streamKeyValueExposed: false,
    realRtmpSrtWebRtcHlsTraffic: false,
    realServerStarted: false,
    realPlayerLoaded: false,
    realFfmpegExecuted: false,
    realWebhookSent: false,
    realDrmProviderConnected: false,
    billingCreditPaymentAdded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SMOKE_TEST_READINESS_CHECKLIST_DECISION_ROLE,
  };
}

function section(sectionKey: string, title: string, checks: LiveReadinessCheck[]): LiveSmokeReadinessSection {
  return { sectionKey, title, checks };
}
