export type LiveSmokeReadinessRiskLevel = "low" | "medium" | "high";

export const LIVE_SMOKE_READINESS_RISK_REPORT_DECISION_ROLE =
  "live_smoke_readiness_risk_report_support_only_no_vault_no_confirmed" as const;

export interface LiveSmokeReadinessRisk {
  key: string;
  riskLevel: LiveSmokeReadinessRiskLevel;
  explanation: string;
  mitigationPreview: string;
  humanApprovalRequired: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface LiveSmokeReadinessRiskReport {
  risks: LiveSmokeReadinessRisk[];
  highestRiskLevel: "high";
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  realCredentialStored: false;
  streamKeyValueExposed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SMOKE_READINESS_RISK_REPORT_DECISION_ROLE;
}

export function getLiveSmokeReadinessRiskReport(): LiveSmokeReadinessRiskReport {
  return {
    risks: [
      risk("secret_exposure", "high", "Stream key veya OAuth token sizarsa hedef yayin ele gecirilebilir.", "Secret manager, redaction, log scrub ve rotate/revoke plani gerekir."),
      risk("stream_key_leak", "high", "Stream key log, rapor veya UI ciktilarina sizabilir.", "Deger hic kaydedilmeden yalniz present/redacted bayragi tutulmali."),
      risk("target_api_failure", "medium", "Platform API veya custom RTMP hedefi testte reddedebilir.", "Tek hedef, kisa sure ve manual stop planiyla olculmeli."),
      risk("live_outage", "high", "Real labda ingest, engine veya target kopabilir.", "Stop/rollback, fail-safe ve operator runbook gerekir."),
      risk("cost_spike", "medium", "Bant genisligi, CPU, provider veya storage maliyeti beklenenden yuksek olabilir.", "Cost cap ve sure limiti olmadan real test acilmamali."),
      risk("false_evidence", "high", "Mock/readiness raporu gercek delil gibi yorumlanabilir.", "decisionRole support-only ve canOpenVault=false alanlari korunmali."),
      risk("watermark_not_applied", "high", "Live tasima katmani TancMark muhru basmaz.", "Mevcut muhur/pre-seal ve post-live ID read ayrica labda dogrulanmali."),
      risk("vault_misuse", "high", "Live target, player veya DNA sinyali VAULT karari sanilabilir.", "VAULT/confirmed/final/threshold karar kapilari degismeden kalmali."),
      risk("platform_policy", "medium", "YouTube veya custom RTMP hedefinin kurallari farkli olabilir.", "Provider policy ve test hesabi kosullari insan onayi ile kontrol edilmeli."),
    ],
    highestRiskLevel: "high",
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    realCredentialStored: false,
    streamKeyValueExposed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SMOKE_READINESS_RISK_REPORT_DECISION_ROLE,
  };
}

function risk(
  key: string,
  riskLevel: LiveSmokeReadinessRiskLevel,
  explanation: string,
  mitigationPreview: string,
): LiveSmokeReadinessRisk {
  return {
    key,
    riskLevel,
    explanation,
    mitigationPreview,
    humanApprovalRequired: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
