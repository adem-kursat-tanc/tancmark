export const LIVE_REAL_SMOKE_LOCAL_LAB_PLAN_DECISION_ROLE =
  "live_real_smoke_local_lab_plan_custom_rtmp_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeLocalLabPlan {
  phase: "controlled_real_lab_preparation";
  selectedEngine: "mediamtx";
  targetType: "custom_rtmp";
  selectionReason: string[];
  localOnly: true;
  publicSocialTargetsEnabled: false;
  youtubeRealTestEnabled: false;
  facebookRealTestEnabled: false;
  twitchRealTestEnabled: false;
  tiktokRealTestEnabled: false;
  billingCreditPaymentAdded: false;
  requiresHumanOperatorAction: true;
  canRunWithoutHumanAction: false;
  readyForLocalLabSetup: true;
  readyForActualSmokeNow: false;
  actualSmokeExecuted: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  secretValuesAccepted: false;
  secretValuesLogged: false;
  localAddresses: {
    rtmpIngestUrl: string;
    hlsPreviewUrl: string;
    apiUrl: string;
  };
  requiredPorts: Array<{
    port: number;
    purpose: string;
    bind: "127.0.0.1";
    publicExposureAllowed: false;
  }>;
  requiredTools: Array<{
    tool: "mediamtx" | "ffmpeg_or_obs" | "docker_optional";
    requiredForActualSmoke: boolean;
    currentPhaseAction: "operator_install_or_start" | "optional_fallback";
    note: string;
  }>;
  testFlowPreview: string[];
  successCriteria: string[];
  rollbackPlan: string[];
  operatorTasks: string[];
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_LOCAL_LAB_PLAN_DECISION_ROLE;
}

export function getLiveRealSmokeLocalLabPlan(): LiveRealSmokeLocalLabPlan {
  return {
    phase: "controlled_real_lab_preparation",
    selectedEngine: "mediamtx",
    targetType: "custom_rtmp",
    selectionReason: [
      "MediaMTX tek binary ile calisabildigi icin ilk local lab icin SRS'e gore daha sade.",
      "RTMP ingest ve HLS preview icin yeterli; sosyal platform API gerekmez.",
      "MIT lisansli ve local-only kisa smoke test icin hafif bir aday.",
      "SRS primary aday olarak korunur; ancak ilk kucuk custom RTMP lab icin MediaMTX daha dusuk operasyon yukudur.",
    ],
    localOnly: true,
    publicSocialTargetsEnabled: false,
    youtubeRealTestEnabled: false,
    facebookRealTestEnabled: false,
    twitchRealTestEnabled: false,
    tiktokRealTestEnabled: false,
    billingCreditPaymentAdded: false,
    requiresHumanOperatorAction: true,
    canRunWithoutHumanAction: false,
    readyForLocalLabSetup: true,
    readyForActualSmokeNow: false,
    actualSmokeExecuted: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    secretValuesAccepted: false,
    secretValuesLogged: false,
    localAddresses: {
      rtmpIngestUrl: "rtmp://127.0.0.1:1935/tancmark_custom_rtmp_smoke",
      hlsPreviewUrl: "http://127.0.0.1:8888/tancmark_custom_rtmp_smoke/index.m3u8",
      apiUrl: "http://127.0.0.1:9997",
    },
    requiredPorts: [
      { port: 1935, purpose: "local RTMP ingest", bind: "127.0.0.1", publicExposureAllowed: false },
      { port: 8888, purpose: "local HLS preview", bind: "127.0.0.1", publicExposureAllowed: false },
      { port: 9997, purpose: "local MediaMTX API/health preview", bind: "127.0.0.1", publicExposureAllowed: false },
    ],
    requiredTools: [
      {
        tool: "mediamtx",
        requiredForActualSmoke: true,
        currentPhaseAction: "operator_install_or_start",
        note: "MediaMTX binary veya operator tarafindan baslatilan local container gerekir.",
      },
      {
        tool: "ffmpeg_or_obs",
        requiredForActualSmoke: true,
        currentPhaseAction: "operator_install_or_start",
        note: "Kisa test pattern yayini icin FFmpeg veya OBS gerekir.",
      },
      {
        tool: "docker_optional",
        requiredForActualSmoke: false,
        currentPhaseAction: "optional_fallback",
        note: "Docker sadece MediaMTX'i binary yerine container ile baslatmak istenirse opsiyoneldir.",
      },
    ],
    testFlowPreview: [
      "MediaMTX local-only config ile baslatilir.",
      "Kisa test pattern RTMP olarak sadece 127.0.0.1 hedefe gonderilir.",
      "HLS preview local adreste gorunur mu kontrol edilir.",
      "10-15 saniye icinde test durdurulur.",
      "Loglarda secret olmadigi, public hedefe push olmadigi ve rollback yapildigi raporlanir.",
    ],
    successCriteria: [
      "MediaMTX local process/health ayakta.",
      "RTMP ingest 127.0.0.1:1935 uzerinden kabul edildi.",
      "HLS preview 127.0.0.1:8888 uzerinden olustu.",
      "Test suresi 15 saniyeyi asmadi.",
      "Public sosyal hedef, secret, billing, VAULT/confirmed/final etkisi olmadi.",
    ],
    rollbackPlan: [
      "FFmpeg/OBS test pattern yayini durdur.",
      "MediaMTX process/container durdur.",
      "1935/8888/9997 portlarinda listener kalmadigini kontrol et.",
      "Olusan gecici recording/log dosyasi varsa silmeden once raporla; secret icermedigini dogrula.",
      "PROJECT_REPORT'a sonuc yaz.",
    ],
    operatorTasks: [
      "MediaMTX kur veya Docker'i ac.",
      "FFmpeg kur veya OBS ac.",
      "Local-only config dosyasini kullan.",
      "Gercek sosyal hedef/stream key girme.",
      "Testi en fazla 10-15 saniye calistir.",
    ],
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_LOCAL_LAB_PLAN_DECISION_ROLE,
  };
}
