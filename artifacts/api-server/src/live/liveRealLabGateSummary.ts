export const LIVE_REAL_LAB_GATE_SUMMARY_DECISION_ROLE =
  "live_real_lab_gate_summary_support_only_no_vault_no_confirmed" as const;

export interface LiveRealLabGateSummary {
  liveRealLabAllowed: false;
  canProceedToRealBroadcast: false;
  reason: string;
  requiredApprovals: string[];
  requiredSecrets: string[];
  requiredInfrastructure: string[];
  requiredTestAssets: string[];
  requiredRollbackPlan: string[];
  requiredSecurityReview: string[];
  requiredCostApproval: string[];
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  realCredentialStored: false;
  realStreamKeyUsed: false;
  streamKeyValueExposed: false;
  realServerStarted: false;
  realFfmpegExecuted: false;
  realPlayerLoaded: false;
  realWebhookSent: false;
  billingCreditPaymentAdded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_LAB_GATE_SUMMARY_DECISION_ROLE;
}

export function getLiveRealLabGateSummary(): LiveRealLabGateSummary {
  return {
    liveRealLabAllowed: false,
    canProceedToRealBroadcast: false,
    reason:
      "Bu faz yalniz single-target smoke readiness checklist uretir; gercek lab, yayin, API, stream key veya medya trafigi acilmaz.",
    requiredApprovals: [
      "APPROVE_LIVE_SAFE_IMPROVEMENT",
      "Tek hedef icin acik real-lab smoke test onayi",
      "Hedef platform/API/stream key kullanim onayi",
      "Rollback ve maliyet onayi",
    ],
    requiredSecrets: [
      "Secret manager secimi",
      "Stream key saklama ve rotasyon politikasi",
      "OAuth token saklama ve redaction politikasi",
      "Loglarda secret degeri olmamasi icin kontrol",
    ],
    requiredInfrastructure: [
      "Real SRS veya MediaMTX lab kurulumu",
      "OBS/FFmpeg ingest test ortami",
      "HLS/playback test ortami",
      "Ayrik test agi ve durdurma/rollback proseduru",
    ],
    requiredTestAssets: [
      "Kisa tek hedef test yayini icin dummy/izinli medya",
      "TancMark ID okuma ve post-live analiz matrisi",
      "Secure Room delil handoff senaryosu",
      "Wrong-ID ve idless negatif guvenlik senaryolari",
    ],
    requiredRollbackPlan: [
      "Yayini hemen durdurma",
      "Stream key rotate/revoke",
      "Provider target disable",
      "Gecebilirse gecici lab dosyalarini ve secret referanslarini temizleme",
    ],
    requiredSecurityReview: [
      "Stream key/token exposure kontrolu",
      "Webhook/target URL SSRF ve log riski kontrolu",
      "VAULT/confirmed/final/threshold/ownership/pre-seal etkisi olmamasi kontrolu",
      "DNA'nin ID uretmemesi ve karar kapisina karismamasi kontrolu",
    ],
    requiredCostApproval: [
      "Provider/API maliyeti",
      "Sunucu bant genisligi ve CPU",
      "Storage/VOD maliyeti",
      "Test suresi ve hedef sayisi limiti",
    ],
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    realCredentialStored: false,
    realStreamKeyUsed: false,
    streamKeyValueExposed: false,
    realServerStarted: false,
    realFfmpegExecuted: false,
    realPlayerLoaded: false,
    realWebhookSent: false,
    billingCreditPaymentAdded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_LAB_GATE_SUMMARY_DECISION_ROLE,
  };
}
