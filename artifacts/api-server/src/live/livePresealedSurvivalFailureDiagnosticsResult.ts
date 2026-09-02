export const LIVE_PRESEALED_SURVIVAL_FAILURE_DIAGNOSTICS_DECISION_ROLE =
  "presealed_survival_failure_diagnostics_support_only_no_vault_no_confirmed" as const;

export interface LivePresealedSurvivalFailureDiagnosticsResult {
  diagnosticsExecuted: true;
  baselinePresealedDirectRead: {
    embeddedIdRead: true;
    survivalVerdict: "VAULT";
    codec: "ffv1";
    container: "matroska,webm";
    frameCount: 180;
    fps: 15;
  };
  remuxOnlyTest: {
    embeddedIdRead: true;
    survivalVerdict: "VAULT";
    codec: "ffv1";
    container: "matroska,webm";
  };
  reencodeOnlyTest: {
    embeddedIdRead: true;
    survivalVerdict: "VAULT";
    codec: "h264";
    container: "mov,mp4,m4a,3gp,3g2,mj2";
  };
  rtmpPublishPathTest: {
    embeddedIdRead: false;
    survivalVerdict: "NOT_FOUND";
    codec: "h264";
    frameCount: 32;
  };
  hlsCapturePathTest: {
    embeddedIdRead: true;
    survivalVerdict: "VAULT";
    codec: "h264";
    hlsCaptureStable: true;
  };
  suspectedBreakPoint: {
    primary: "rtmp_publish_breaks";
    classes: string[];
    explanation: string;
  };
  recommendedNextLabStep: string;
  evidenceSummaryPath: "runtime/validation/live_actual_local_smoke/presealed_source/presealed_survival_failure_diagnostics_summary.json";
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  dbMigration: false;
  billingCreditPaymentAdded: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_PRESEALED_SURVIVAL_FAILURE_DIAGNOSTICS_DECISION_ROLE;
}

export function getLivePresealedSurvivalFailureDiagnosticsResult(): LivePresealedSurvivalFailureDiagnosticsResult {
  return {
    diagnosticsExecuted: true,
    baselinePresealedDirectRead: {
      embeddedIdRead: true,
      survivalVerdict: "VAULT",
      codec: "ffv1",
      container: "matroska,webm",
      frameCount: 180,
      fps: 15,
    },
    remuxOnlyTest: {
      embeddedIdRead: true,
      survivalVerdict: "VAULT",
      codec: "ffv1",
      container: "matroska,webm",
    },
    reencodeOnlyTest: {
      embeddedIdRead: true,
      survivalVerdict: "VAULT",
      codec: "h264",
      container: "mov,mp4,m4a,3gp,3g2,mj2",
    },
    rtmpPublishPathTest: {
      embeddedIdRead: false,
      survivalVerdict: "NOT_FOUND",
      codec: "h264",
      frameCount: 32,
    },
    hlsCapturePathTest: {
      embeddedIdRead: true,
      survivalVerdict: "VAULT",
      codec: "h264",
      hlsCaptureStable: true,
    },
    suspectedBreakPoint: {
      primary: "rtmp_publish_breaks",
      classes: [
        "container_remux_survives",
        "rtmp_publish_breaks",
        "timebase_gop_damage_suspected",
      ],
      explanation:
        "Direct read, remux, standalone re-encode, and HLS capture read the ID; the short RTMP direct capture path misses the readable stamped evidence, likely due capture window/timebase/GOP alignment.",
    },
    recommendedNextLabStep:
      "Keep post-live re-seal as the reliable local strategy; next lab-only work should run longer/segment-aligned RTMP capture attribution before considering any live watermark hardening.",
    evidenceSummaryPath:
      "runtime/validation/live_actual_local_smoke/presealed_source/presealed_survival_failure_diagnostics_summary.json",
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    dbMigration: false,
    billingCreditPaymentAdded: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_PRESEALED_SURVIVAL_FAILURE_DIAGNOSTICS_DECISION_ROLE,
  };
}
