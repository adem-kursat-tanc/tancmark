import { getLiveRealSmokeLocalLabPlan } from "./liveRealSmokeLocalLabPlan";

export const LIVE_REAL_SMOKE_LOCAL_PREFLIGHT_DECISION_ROLE =
  "live_real_smoke_local_preflight_custom_rtmp_only_no_vault_no_confirmed" as const;

export type LiveRealSmokeLocalPreflightStatus =
  | "ready_plan"
  | "ready_safe"
  | "blocked_requires_operator"
  | "blocked_by_policy";

export interface LiveRealSmokeLocalPreflightCheck {
  checkKey: string;
  title: string;
  status: LiveRealSmokeLocalPreflightStatus;
  requiredBeforeActualSmoke: boolean;
  details: string;
}

export interface LiveRealSmokeLocalPreflight {
  preflightStatus: "local_lab_preflight_preview";
  selectedEngine: "mediamtx";
  targetType: "custom_rtmp";
  readyForLocalLabSetup: true;
  readyForActualSmokeNow: false;
  actualSmokeExecuted: false;
  localEngineReady: false;
  localConfigReady: true;
  secretRedactionReady: true;
  publicSocialTargetsEnabled: false;
  missingForActualSmoke: string[];
  checks: LiveRealSmokeLocalPreflightCheck[];
  supportOnlyBoundary: {
    mayChangeAfterRealLocalLab: string[];
    mustRemainFalseAlways: string[];
  };
  humanOperatorRequired: true;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_REAL_SMOKE_LOCAL_PREFLIGHT_DECISION_ROLE;
}

export function getLiveRealSmokeLocalPreflight(): LiveRealSmokeLocalPreflight {
  const plan = getLiveRealSmokeLocalLabPlan();
  return {
    preflightStatus: "local_lab_preflight_preview",
    selectedEngine: plan.selectedEngine,
    targetType: plan.targetType,
    readyForLocalLabSetup: true,
    readyForActualSmokeNow: false,
    actualSmokeExecuted: false,
    localEngineReady: false,
    localConfigReady: true,
    secretRedactionReady: true,
    publicSocialTargetsEnabled: false,
    missingForActualSmoke: [
      "MediaMTX binary/container operator tarafindan hazirlanmali ve baslatilmali.",
      "FFmpeg veya OBS test kaynagi operator tarafindan hazirlanmali.",
      "1935/8888/9997 portlarinin local-only bos oldugu gercek makinede dogrulanmali.",
      "Kisa sureli manual stop/rollback operator tarafindan uygulanmali.",
    ],
    checks: [
      check("selected_engine", "MediaMTX selected for first local custom RTMP lab", "ready_plan", true, "SRS korunur; ilk local lab icin MediaMTX daha sade."),
      check("local_only_policy", "Local-only policy", "ready_safe", true, "127.0.0.1 adresleri kullanilir; public sosyal hedef yok."),
      check("custom_rtmp_only", "Custom RTMP only", "ready_safe", true, "YouTube/Facebook/Twitch/TikTok gercek hedefleri kapali."),
      check("local_config", "MediaMTX local config", "ready_plan", true, "runtime/validation/mediamtx_custom_rtmp_smoke.yml hazirlanir."),
      check("local_engine_process", "MediaMTX process running", "blocked_requires_operator", true, "TancMark bu fazda process baslatmaz; operator baslatir."),
      check("test_source", "FFmpeg or OBS test source", "blocked_requires_operator", true, "Kisa test pattern icin FFmpeg/OBS gerekir."),
      check("port_check", "Local ports free", "blocked_requires_operator", true, "1935/8888/9997 portlari gercek makinede operator tarafindan kontrol edilir."),
      check("secret_redaction", "Secret redaction", "ready_safe", true, "Bu local test secret gerektirmez; secret loglanmaz."),
      check("rollback_plan", "Rollback plan", "ready_plan", true, "Stop source, stop MediaMTX, verify ports, report result."),
      check("social_targets", "Public social targets", "blocked_by_policy", true, "YouTube/Facebook/Twitch bu ilk gercek local smoke testte kullanilmaz."),
    ],
    supportOnlyBoundary: {
      mayChangeAfterRealLocalLab: [
        "localEngineReady",
        "localRtmpIngestObserved",
        "localHlsPreviewObserved",
        "actualSmokeExecuted",
      ],
      mustRemainFalseAlways: [
        "canOpenVault",
        "vaultEligible",
        "confirmed",
        "final",
        "realApiEnabled",
        "publicSocialTargetsEnabled",
        "billingCreditPaymentAdded",
      ],
    },
    humanOperatorRequired: true,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_REAL_SMOKE_LOCAL_PREFLIGHT_DECISION_ROLE,
  };
}

function check(
  checkKey: string,
  title: string,
  status: LiveRealSmokeLocalPreflightStatus,
  requiredBeforeActualSmoke: boolean,
  details: string,
): LiveRealSmokeLocalPreflightCheck {
  return { checkKey, title, status, requiredBeforeActualSmoke, details };
}
