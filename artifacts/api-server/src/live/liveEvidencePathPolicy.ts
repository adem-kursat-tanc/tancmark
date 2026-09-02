import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";

export const LIVE_EVIDENCE_PATH_POLICY_DECISION_ROLE =
  "live_evidence_path_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveEvidencePathPolicy {
  preferredLiveEvidencePath: "hls_capture";
  rtmpDirectCaptureRole: "diagnostic_only";
  postLiveResealRole: "safest_local_reseal_strategy";
  hlsCaptureReason: string[];
  rtmpDiagnosticReason: string[];
  productDecisionImpact: {
    vaultEligible: false;
    confirmed: false;
    final: false;
    supportOnly: true;
  };
  protectedCore: {
    thresholdChanged: false;
    ownershipPreSealChanged: false;
    dnaGateChanged: false;
    watermarkReadAlgorithmChanged: false;
  };
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  realApiEnabled: false;
  realBroadcastStarted: false;
  realMediaProcessedNow: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_EVIDENCE_PATH_POLICY_DECISION_ROLE;
}

export function getLiveEvidencePathPolicy(): LiveEvidencePathPolicy {
  const repeatability = getLivePresealedHlsSurvivalRepeatabilityResult();

  return {
    preferredLiveEvidencePath: "hls_capture",
    rtmpDirectCaptureRole: "diagnostic_only",
    postLiveResealRole: "safest_local_reseal_strategy",
    hlsCaptureReason: [
      `${repeatability.hlsSuccessfulIdReads}/${repeatability.hlsTotalRuns} successful ID reads in local synthetic lab`,
      `${repeatability.hlsExpectedIdMatches}/${repeatability.hlsTotalRuns} expected lab ID matches`,
      "HLS capture was repeatable across the local pre-sealed survival matrix",
    ],
    rtmpDiagnosticReason: [
      "RTMP direct capture was inconsistent across 4s/8s/12s/15s windows",
      "Timebase/GOP/window sensitivity is suspected",
      "RTMP direct capture is not reliable enough for product evidence/read decisions",
    ],
    productDecisionImpact: {
      vaultEligible: false,
      confirmed: false,
      final: false,
      supportOnly: true,
    },
    protectedCore: {
      thresholdChanged: false,
      ownershipPreSealChanged: false,
      dnaGateChanged: false,
      watermarkReadAlgorithmChanged: false,
    },
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    realApiEnabled: false,
    realBroadcastStarted: false,
    realMediaProcessedNow: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_EVIDENCE_PATH_POLICY_DECISION_ROLE,
  };
}
