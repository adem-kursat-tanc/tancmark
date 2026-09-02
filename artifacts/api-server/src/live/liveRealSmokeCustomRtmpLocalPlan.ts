import { getLiveRealSmokeLocalLabPlan } from "./liveRealSmokeLocalLabPlan";
import { getLiveRealSmokeLocalPreflight } from "./liveRealSmokeLocalPreflight";

export const LIVE_REAL_SMOKE_CUSTOM_RTMP_LOCAL_PLAN_DECISION_ROLE =
  "live_real_smoke_custom_rtmp_local_plan_no_execution_no_vault_no_confirmed" as const;

export interface LiveRealSmokeCustomRtmpLocalPlan {
  liveSessionId: string;
  targetType: "custom_rtmp";
  selectedEngine: "mediamtx";
  maxDurationSeconds: 15;
  localRtmpUrl: string;
  localHlsPreviewUrl: string;
  configPath: "runtime/validation/mediamtx_custom_rtmp_smoke.yml";
  mediamtxRunCommandPreview: string;
  ffmpegTestPatternCommandPreview: string;
  dockerFallbackCommandPreview: string;
  willExecuteCommandsNow: false;
  actualSmokeExecuted: false;
  canRunWithoutHumanAction: false;
  requiresHumanOperatorAction: true;
  preflightSummary: ReturnType<typeof getLiveRealSmokeLocalPreflight>;
  localLabPlanSummary: ReturnType<typeof getLiveRealSmokeLocalLabPlan>;
  resultToCollectAfterManualRun: string[];
  successCriteria: string[];
  rollbackCommandsPreview: string[];
  secretValuesAccepted: false;
  secretValuesLogged: false;
  publicSocialTargetsEnabled: false;
  realApiEnabled: false;
  realPushEnabled: false;
  billingCreditPaymentAdded: false;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_REAL_SMOKE_CUSTOM_RTMP_LOCAL_PLAN_DECISION_ROLE;
}

export function buildLiveRealSmokeCustomRtmpLocalPlan(
  liveSessionId = "tancmark_custom_rtmp_smoke",
): LiveRealSmokeCustomRtmpLocalPlan {
  const safeSessionId = cleanSessionId(liveSessionId);
  const localRtmpUrl = `rtmp://127.0.0.1:1935/${safeSessionId}`;
  const localHlsPreviewUrl = `http://127.0.0.1:8888/${safeSessionId}/index.m3u8`;
  return {
    liveSessionId: safeSessionId,
    targetType: "custom_rtmp",
    selectedEngine: "mediamtx",
    maxDurationSeconds: 15,
    localRtmpUrl,
    localHlsPreviewUrl,
    configPath: "runtime/validation/mediamtx_custom_rtmp_smoke.yml",
    mediamtxRunCommandPreview: "mediamtx runtime/validation/mediamtx_custom_rtmp_smoke.yml",
    ffmpegTestPatternCommandPreview:
      `ffmpeg -hide_banner -re -f lavfi -i testsrc=size=1280x720:rate=15 -f lavfi -i sine=frequency=1000:sample_rate=48000 -t 10 -c:v libx264 -preset ultrafast -g 30 -c:a aac -f flv ${localRtmpUrl}`,
    dockerFallbackCommandPreview:
      "docker run --rm --name tancmark-mediamtx-local -p 127.0.0.1:1935:1935 -p 127.0.0.1:8888:8888 -p 127.0.0.1:9997:9997 bluenviron/mediamtx:latest",
    willExecuteCommandsNow: false,
    actualSmokeExecuted: false,
    canRunWithoutHumanAction: false,
    requiresHumanOperatorAction: true,
    preflightSummary: getLiveRealSmokeLocalPreflight(),
    localLabPlanSummary: getLiveRealSmokeLocalLabPlan(),
    resultToCollectAfterManualRun: [
      "MediaMTX process/container calisti mi?",
      "FFmpeg/OBS 10 saniyelik test pattern gonderebildi mi?",
      "HLS preview local URL olustu mu?",
      "Stop/rollback sonrasi 1935/8888/9997 portlari kapandi mi?",
      "Loglarda secret veya public target bilgisi var mi?",
    ],
    successCriteria: [
      "Local RTMP ingest kabul edildi.",
      "Local HLS preview olustu.",
      "Test 10-15 saniye icinde durduruldu.",
      "Public sosyal hedefe push yapilmadi.",
      "Secret girilmedi/loglanmadi.",
      "VAULT/confirmed/final karar kapilari etkilenmedi.",
    ],
    rollbackCommandsPreview: [
      "FFmpeg/OBS penceresini durdur veya Ctrl+C.",
      "MediaMTX penceresini durdur veya Ctrl+C.",
      "Docker kullanildiysa: docker stop tancmark-mediamtx-local",
      "Port kontrolu: Get-NetTCPConnection -LocalPort 1935,8888,9997 -ErrorAction SilentlyContinue",
    ],
    secretValuesAccepted: false,
    secretValuesLogged: false,
    publicSocialTargetsEnabled: false,
    realApiEnabled: false,
    realPushEnabled: false,
    billingCreditPaymentAdded: false,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_REAL_SMOKE_CUSTOM_RTMP_LOCAL_PLAN_DECISION_ROLE,
  };
}

function cleanSessionId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return cleaned || "tancmark_custom_rtmp_smoke";
}
