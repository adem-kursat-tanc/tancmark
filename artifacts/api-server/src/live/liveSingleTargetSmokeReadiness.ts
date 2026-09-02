export type LiveSingleTargetSmokeTargetType = "youtube_mock" | "custom_rtmp_mock";
export type LiveSingleTargetReadinessStatus = "ready_for_mock_checklist" | "blocked_for_real_lab";
export type LiveReadinessCheckStatus = "ready_mock" | "blocked_real_lab" | "deferred_future";

export const LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE =
  "live_single_target_smoke_readiness_support_only_no_vault_no_confirmed" as const;

export interface LiveReadinessCheck {
  key: string;
  label: string;
  status: LiveReadinessCheckStatus;
  detail: string;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface LiveSingleTargetSmokeReadiness {
  targetType: LiveSingleTargetSmokeTargetType;
  targetDisplayName: string;
  readinessStatus: LiveSingleTargetReadinessStatus;
  readyForMockChecklist: true;
  readyForRealLab: false;
  checks: LiveReadinessCheck[];
  requiredBeforeRealTest: string[];
  blockingItems: string[];
  warnings: string[];
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
  billingCreditPaymentAdded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE;
}

export function readinessCheck(
  key: string,
  label: string,
  status: LiveReadinessCheckStatus,
  detail: string,
): LiveReadinessCheck {
  return {
    key,
    label,
    status,
    detail,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

export function getLiveSingleTargetSmokeReadiness(
  targetType: unknown = "youtube_mock",
): LiveSingleTargetSmokeReadiness {
  return parseLiveSmokeTargetType(targetType) === "custom_rtmp_mock"
    ? buildCustomRtmpBase()
    : buildYouTubeBase();
}

export function getLiveSingleTargetSmokeReadinessCatalog(): LiveSingleTargetSmokeReadiness[] {
  return [buildYouTubeBase(), buildCustomRtmpBase()];
}

export function parseLiveSmokeTargetType(value: unknown): LiveSingleTargetSmokeTargetType {
  return value === "custom_rtmp_mock" ? "custom_rtmp_mock" : "youtube_mock";
}

function buildYouTubeBase(): LiveSingleTargetSmokeReadiness {
  return buildReadiness({
    targetType: "youtube_mock",
    targetDisplayName: "YouTube single-target mock readiness",
    warnings: [
      "YouTube icin gercek OAuth/API, stream key ve target push bu fazda kapali kalir.",
      "Bu cikti yalniz smoke-test hazirlik listesidir; gercek yayin testi degildir.",
    ],
    targetSpecificChecks: [
      readinessCheck(
        "youtube_account_future",
        "YouTube kanal/hesap hazirligi",
        "blocked_real_lab",
        "Gercek YouTube hesabi ve yayin yetkisi ileride insan onayli real lab gerektirir.",
      ),
      readinessCheck(
        "youtube_oauth_future",
        "YouTube OAuth/API",
        "blocked_real_lab",
        "OAuth ve YouTube API bu fazda baglanmadi.",
      ),
      readinessCheck(
        "youtube_stream_key_future",
        "YouTube stream key",
        "blocked_real_lab",
        "Gercek stream key kullanilmaz, saklanmaz, loglanmaz ve expose edilmez.",
      ),
    ],
  });
}

function buildCustomRtmpBase(): LiveSingleTargetSmokeReadiness {
  return buildReadiness({
    targetType: "custom_rtmp_mock",
    targetDisplayName: "Custom RTMP single-target mock readiness",
    warnings: [
      "Custom RTMP URL ve stream key bu fazda yalniz redacted/mock shape olarak ele alinir.",
      "Gercek RTMP/SRT/WebRTC/HLS trafigi, real push veya real engine lab calistirilmaz.",
    ],
    targetSpecificChecks: [
      readinessCheck(
        "custom_rtmp_url_future",
        "Custom RTMP endpoint",
        "blocked_real_lab",
        "Gercek RTMP endpoint ileride ayri onayli labda girilebilir; bu fazda baglanti yoktur.",
      ),
      readinessCheck(
        "custom_rtmp_stream_key_future",
        "Custom RTMP stream key",
        "blocked_real_lab",
        "Gercek stream key degeri tutulmaz, kullanilmaz, loglanmaz ve expose edilmez.",
      ),
      readinessCheck(
        "custom_rtmp_provider_risk",
        "Bilinmeyen RTMP hedef riski",
        "blocked_real_lab",
        "Hedef saglayici, rate-limit, yeniden encode ve yayin kabul davranisi gercek lab olmadan bilinmez.",
      ),
    ],
  });
}

function buildReadiness(input: {
  targetType: LiveSingleTargetSmokeTargetType;
  targetDisplayName: string;
  targetSpecificChecks: LiveReadinessCheck[];
  warnings: string[];
}): LiveSingleTargetSmokeReadiness {
  return {
    targetType: input.targetType,
    targetDisplayName: input.targetDisplayName,
    readinessStatus: "ready_for_mock_checklist",
    readyForMockChecklist: true,
    readyForRealLab: false,
    checks: [
      readinessCheck(
        "target_routing_mock_present",
        "Target routing mock hazir",
        "ready_mock",
        "Target catalog, mock target modeli ve route plan karar degistirmeden raporlanabilir.",
      ),
      readinessCheck(
        "credential_policy_present",
        "Credential redaction policy hazir",
        "ready_mock",
        "Secret/token/key degerleri saklanmaz ve ciktilarda expose edilmez.",
      ),
      readinessCheck(
        "engine_config_dry_run_present",
        "SRS/MediaMTX config dry-run hazir",
        "ready_mock",
        "Config preview vardir; gercek server, port, firewall veya trafik yoktur.",
      ),
      readinessCheck(
        "ffmpeg_vod_dry_run_present",
        "FFmpeg/VOD dry-run hazir",
        "ready_mock",
        "Komut ve VOD plan preview vardir; FFmpeg calistirilmaz ve medya islenmez.",
      ),
      readinessCheck(
        "access_token_mock_present",
        "Access/token/signed URL mock hazir",
        "ready_mock",
        "Gercek token veya signed URL uretilmez; yalniz policy/preview vardir.",
      ),
      readinessCheck(
        "player_mock_present",
        "Player shell mock hazir",
        "ready_mock",
        "Gercek player yuklenmez, stream cekilmez ve playback baslatilmaz.",
      ),
      readinessCheck(
        "event_webhook_mock_present",
        "Event/webhook mock hazir",
        "ready_mock",
        "Event ve webhook payload preview vardir; gercek webhook veya network call yoktur.",
      ),
      ...input.targetSpecificChecks,
    ],
    requiredBeforeRealTest: [
      "Acik insan onayi ve real-lab kapsam onayi",
      "Secret management ve stream key saklama/loglamama kontrolu",
      "SRS/MediaMTX veya secili engine real lab kurulumu",
      "OBS/FFmpeg ingest ve rollback plani",
      "Tek hedef icin cost/rate-limit ve platform policy onayi",
      "Yayin sonrasi ID okuma ve Secure Room delil planinin ayrica onaylanmasi",
    ],
    blockingItems: [
      "realApiEnabled=false",
      "realPushEnabled=false",
      "realBroadcastStarted=false",
      "realCredentialStored=false",
      "streamKeyValueExposed=false",
      "realRtmpSrtWebRtcHlsTraffic=false",
      "realServerStarted=false",
      "realFfmpegExecuted=false",
      "realWebhookSent=false",
    ],
    warnings: input.warnings,
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
    billingCreditPaymentAdded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SINGLE_TARGET_SMOKE_READINESS_DECISION_ROLE,
  };
}
