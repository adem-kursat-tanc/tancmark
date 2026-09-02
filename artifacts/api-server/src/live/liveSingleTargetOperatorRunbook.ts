import { parseLiveSmokeTargetType, type LiveSingleTargetSmokeTargetType } from "./liveSingleTargetSmokeReadiness";

export type LiveOperatorRunbookRiskLevel = "low" | "medium" | "high";

export const LIVE_SINGLE_TARGET_OPERATOR_RUNBOOK_DECISION_ROLE =
  "live_single_target_operator_runbook_support_only_no_vault_no_confirmed" as const;

export interface LiveOperatorRunbookStep {
  stepId: string;
  section: string;
  title: string;
  description: string;
  requiredBeforeRealTest: boolean;
  riskLevel: LiveOperatorRunbookRiskLevel;
  humanApprovalRequired: true;
  supportOnly: true;
}

export interface LiveSingleTargetOperatorRunbook {
  targetType: LiveSingleTargetSmokeTargetType;
  phase: "operator_runbook_mock_only";
  steps: LiveOperatorRunbookStep[];
  readyForRealSmoke: false;
  readyForMockChecklist: true;
  humanApprovalRequiredBeforeRealSmoke: true;
  realSecretAccepted: false;
  realSecretStored: false;
  realBroadcastStarted: false;
  realApiEnabled: false;
  realPushEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SINGLE_TARGET_OPERATOR_RUNBOOK_DECISION_ROLE;
}

export function getLiveSingleTargetOperatorRunbook(targetTypeInput?: unknown): LiveSingleTargetOperatorRunbook {
  const targetType = parseLiveSmokeTargetType(targetTypeInput);
  const targetName = targetType === "custom_rtmp_mock" ? "custom RTMP" : "YouTube";

  return {
    targetType,
    phase: "operator_runbook_mock_only",
    steps: [
      step("prep_scope", "hazirlik", "Test kapsamini yaz", `${targetName} icin test amaci, sure limiti ve durdurma sahibi onceden yazilir.`, true, "medium"),
      step("asset_dummy", "test_varliklari", "Izinli test varligi sec", "Gercek kullanici icerigi veya gizli medya kullanmadan dummy/izinli test varligi secilir.", true, "medium"),
      step("engine_check", "yayin_motoru_kontrolu", "Engine dry-run kontrolu", "SRS/MediaMTX config dry-run ve port planlari okunur; real server baslatilmaz.", true, "high"),
      step("target_choice", "target_secimi", "Tek hedef sec", `${targetName} disinda ek hedef eklenmez; simulcast acilmaz.`, true, "medium"),
      step("secret_safety", "secret_guvenligi", "Secret redaction dry-run calistir", "Stream key/API key/OAuth token degeri saklanmadan redaction validator ile kontrol edilir.", true, "high"),
      step("obs_ready", "obs_hazirligi", "OBS hazirlik notu", "OBS ingest sadece ilerideki real lab icin operator notu olarak tutulur; baglanti acilmaz.", true, "medium"),
      step("duration_limit", "test_suresi", "Sure limiti belirle", "Real lab onayi olursa kisa sureli, izole ve durdurulabilir test penceresi belirlenir.", true, "medium"),
      step("recording_vod", "kayit_vod_kontrolu", "Recording/VOD dry-run kontrolu", "Recording/VOD mock pipeline okunur; gercek kayit veya medya isleme yoktur.", true, "medium"),
      step("player_check", "player_kontrolu", "Player mock kontrolu", "Shaka/Video.js mock shell ve playback page preview kontrol edilir; real playback yoktur.", true, "medium"),
      step("event_health", "event_health_kontrolu", "Event/health mock kontrolu", "Event bus, health ve webhook preview kontrol edilir; webhook gonderilmez.", true, "medium"),
      step("rollback_ready", "rollback", "Rollback runbook hazirla", "Stop, revoke, process stop, output disable ve evidence freeze adimlari preview olarak hazirlanir.", true, "high"),
      step("post_report", "test_sonrasi_rapor", "Test sonrasi rapor taslagi", "Post-test Secure Room ve PROJECT_REPORT notu icin taslak hazirlanir; karar kapilari degismez.", true, "low"),
    ],
    readyForRealSmoke: false,
    readyForMockChecklist: true,
    humanApprovalRequiredBeforeRealSmoke: true,
    realSecretAccepted: false,
    realSecretStored: false,
    realBroadcastStarted: false,
    realApiEnabled: false,
    realPushEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SINGLE_TARGET_OPERATOR_RUNBOOK_DECISION_ROLE,
  };
}

function step(
  stepId: string,
  section: string,
  title: string,
  description: string,
  requiredBeforeRealTest: boolean,
  riskLevel: LiveOperatorRunbookRiskLevel,
): LiveOperatorRunbookStep {
  return {
    stepId,
    section,
    title,
    description,
    requiredBeforeRealTest,
    riskLevel,
    humanApprovalRequired: true,
    supportOnly: true,
  };
}
