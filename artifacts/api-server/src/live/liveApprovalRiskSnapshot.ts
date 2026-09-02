export const LIVE_APPROVAL_RISK_SNAPSHOT_DECISION_ROLE =
  "live_approval_risk_snapshot_support_only_no_vault_no_confirmed" as const;

export type LiveApprovalRiskLevel = "medium" | "high";

export interface LiveApprovalRiskItem {
  riskKey:
    | "accidental_real_broadcast"
    | "secret_leak"
    | "target_api_failure"
    | "cost_spike"
    | "rollback_gap"
    | "vault_final_misinterpretation"
    | "platform_policy";
  title: string;
  riskLevel: LiveApprovalRiskLevel;
  mitigationPreview: string;
  humanApprovalRequired: true;
  supportOnly: true;
}

export interface LiveApprovalRiskSnapshot {
  liveSessionId: string;
  risks: LiveApprovalRiskItem[];
  realApprovalGranted: false;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_RISK_SNAPSHOT_DECISION_ROLE;
}

export function buildLiveApprovalRiskSnapshot(liveSessionId: string): LiveApprovalRiskSnapshot {
  return {
    liveSessionId,
    risks: [
      risk(
        "accidental_real_broadcast",
        "Yanlislikla gercek yayin baslatma riski",
        "high",
        "Start/connect/push butonlari ayrik onay ve rollback drill olmadan eklenmemeli.",
      ),
      risk(
        "secret_leak",
        "Secret sizintisi riski",
        "high",
        "Secret manager, redaction, revoke/rotate plani ve no-log kontrolleri tamamlanmali.",
      ),
      risk(
        "target_api_failure",
        "Target API hata riski",
        "medium",
        "Tek hedef, kisa sureli ve rollback hazir real-lab planindan once API acilmamali.",
      ),
      risk(
        "cost_spike",
        "Maliyet patlamasi riski",
        "medium",
        "Sure, bandwidth, storage ve provider limitleri onay kapsaminda sinirlanmali.",
      ),
      risk(
        "rollback_gap",
        "Rollback eksikligi riski",
        "high",
        "Yayin durdurma, target disable, key rotate ve evidence freeze adimlari onceden test edilmeli.",
      ),
      risk(
        "vault_final_misinterpretation",
        "VAULT/final yanlis anlasilma riski",
        "high",
        "Approval audit yalniz destek gorunumu olmali; VAULT/confirmed/final alanlari false kalmali.",
      ),
      risk(
        "platform_policy",
        "Platform policy riski",
        "medium",
        "YouTube/custom RTMP kullanim sartlari ve test icerigi onceden incelenmeli.",
      ),
    ],
    realApprovalGranted: false,
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_RISK_SNAPSHOT_DECISION_ROLE,
  };
}

function risk(
  riskKey: LiveApprovalRiskItem["riskKey"],
  title: string,
  riskLevel: LiveApprovalRiskLevel,
  mitigationPreview: string,
): LiveApprovalRiskItem {
  return {
    riskKey,
    title,
    riskLevel,
    mitigationPreview,
    humanApprovalRequired: true,
    supportOnly: true,
  };
}
