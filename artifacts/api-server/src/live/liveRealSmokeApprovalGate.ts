export const LIVE_REAL_SMOKE_APPROVAL_GATE_DECISION_ROLE =
  "live_real_smoke_approval_gate_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeApprovalGate {
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  requiredApprovalPhrase: "APPROVE_LIVE_REAL_SMOKE_TEST";
  requiredHumanApprovals: string[];
  requiredSecrets: string[];
  requiredInfrastructure: string[];
  requiredRollbackPlan: string[];
  requiredSecurityReview: string[];
  requiredCostApproval: string[];
  requiredTestAsset: string[];
  realSecretStored: false;
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_APPROVAL_GATE_DECISION_ROLE;
}

export function getLiveRealSmokeApprovalGate(): LiveRealSmokeApprovalGate {
  return {
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    requiredApprovalPhrase: "APPROVE_LIVE_REAL_SMOKE_TEST",
    requiredHumanApprovals: [
      "Real smoke test kapsam onayi",
      "Operator sorumlusu ve durdurma yetkilisi",
      "Secret handling onayi",
      "Rollback ve cost onayi",
    ],
    requiredSecrets: [
      "Secret manager secimi",
      "Stream key/API key/OAuth token redaction ve storage policy",
      "Revoke/rotate plani",
    ],
    requiredInfrastructure: [
      "Real SRS/MediaMTX lab",
      "OBS veya FFmpeg ingest lab",
      "HLS/player test ortami",
      "Network ve log izolasyonu",
    ],
    requiredRollbackPlan: [
      "Yayini durdurma",
      "Target push kapatma",
      "Stream key revoke/rotate",
      "Process stop ve evidence freeze",
    ],
    requiredSecurityReview: [
      "Secret value exposure kontrolu",
      "Webhook/target URL guvenligi",
      "VAULT/confirmed/final/threshold/ownership/pre-seal/DNA etkisizlik kontrolu",
    ],
    requiredCostApproval: [
      "Provider/API maliyeti",
      "Bant genisligi ve CPU",
      "Storage/VOD maliyeti",
      "Test sure limiti",
    ],
    requiredTestAsset: [
      "Izinli/dummy medya",
      "Post-live ID read matrisi",
      "Wrong ID ve ID yok negatif testleri",
    ],
    realSecretStored: false,
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_APPROVAL_GATE_DECISION_ROLE,
  };
}
