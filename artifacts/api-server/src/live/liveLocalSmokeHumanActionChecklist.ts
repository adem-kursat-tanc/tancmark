export const LIVE_LOCAL_SMOKE_HUMAN_ACTION_CHECKLIST_DECISION_ROLE =
  "live_local_smoke_human_action_checklist_no_execution_no_vault_no_confirmed" as const;

export interface LiveLocalSmokeHumanActionChecklistItem {
  step: number;
  action: string;
  requiredNow: boolean;
  canBeDoneByCodexLaterWithApproval: boolean;
  note: string;
}

export interface LiveLocalSmokeHumanActionChecklist {
  phase: "human_action_before_real_local_smoke";
  firstTarget: "custom_rtmp";
  mediamtxPortableReady: true;
  ffmpegPortableReady: true;
  obsOptionalNotInstalled: true;
  dockerOptionalDaemonNotRunning: true;
  actions: LiveLocalSmokeHumanActionChecklistItem[];
  nextSafeUserCommand: string;
  actualSmokeExecuted: false;
  realBroadcastStarted: false;
  publicSocialTargetsEnabled: false;
  realSecretStored: false;
  realApiEnabled: false;
  realPushEnabled: false;
  billingCreditPaymentAdded: false;
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_LOCAL_SMOKE_HUMAN_ACTION_CHECKLIST_DECISION_ROLE;
}

export function getLiveLocalSmokeHumanActionChecklist(): LiveLocalSmokeHumanActionChecklist {
  return {
    phase: "human_action_before_real_local_smoke",
    firstTarget: "custom_rtmp",
    mediamtxPortableReady: true,
    ffmpegPortableReady: true,
    obsOptionalNotInstalled: true,
    dockerOptionalDaemonNotRunning: true,
    actions: [
      item(
        1,
        "Bir sonraki fazda local custom RTMP smoke test icin acik onay ver.",
        true,
        false,
        "Bu fazda test baslatilmadi; sadece arac hazirligi yapildi.",
      ),
      item(
        2,
        "OBS ile gorsel kaynak kullanmak istersen OBS Studio'yu kur veya ac.",
        false,
        false,
        "Ilk smoke icin OBS zorunlu degil; portable FFmpeg test pattern yeterli.",
      ),
      item(
        3,
        "Docker container yolunu kullanmak istersen Docker Desktop'i ac.",
        false,
        false,
        "Portable MediaMTX hazir oldugu icin Docker zorunlu degil.",
      ),
      item(
        4,
        "Gercek sosyal platform stream key'i girme.",
        true,
        false,
        "Ilk test yalniz 127.0.0.1 custom_rtmp local hedefte kalmali.",
      ),
    ],
    nextSafeUserCommand:
      "TancMark Live local custom RTMP smoke testini portable MediaMTX ve FFmpeg ile baslat; sosyal hedef yok.",
    actualSmokeExecuted: false,
    realBroadcastStarted: false,
    publicSocialTargetsEnabled: false,
    realSecretStored: false,
    realApiEnabled: false,
    realPushEnabled: false,
    billingCreditPaymentAdded: false,
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_LOCAL_SMOKE_HUMAN_ACTION_CHECKLIST_DECISION_ROLE,
  };
}

function item(
  step: number,
  action: string,
  requiredNow: boolean,
  canBeDoneByCodexLaterWithApproval: boolean,
  note: string,
): LiveLocalSmokeHumanActionChecklistItem {
  return { step, action, requiredNow, canBeDoneByCodexLaterWithApproval, note };
}
