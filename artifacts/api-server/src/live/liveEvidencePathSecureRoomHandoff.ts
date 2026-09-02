import { getLiveEvidencePathClassifier } from "./liveEvidencePathClassifier";
import { getLiveEvidencePathPolicy } from "./liveEvidencePathPolicy";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";

export const LIVE_EVIDENCE_PATH_SECURE_ROOM_DECISION_ROLE =
  "live_evidence_path_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveEvidencePathSecureRoomHandoff {
  policySummary: ReturnType<typeof getLiveEvidencePathPolicy>;
  classifierSummary: ReturnType<typeof getLiveEvidencePathClassifier>;
  preferredLiveEvidencePath: "hls_capture";
  rtmpDirectCaptureRole: "diagnostic_only";
  hlsRepeatabilitySummary: {
    hlsTotalRuns: 3;
    hlsSuccessfulIdReads: 3;
    hlsExpectedIdMatches: 3;
    summary: string;
  };
  rtmpWindowSensitivitySummary: {
    rtmpCapture4sEmbeddedIdRead: false;
    rtmpCapture8sEmbeddedIdRead: true;
    rtmpCapture12sEmbeddedIdRead: false;
    rtmpCapture15sEmbeddedIdRead: false;
    summary: string;
  };
  postLiveResealSummary: {
    role: "safest_local_reseal_strategy";
    needsSeparateProductPhase: true;
  };
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  realApiEnabled: false;
  realBroadcastStarted: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_EVIDENCE_PATH_SECURE_ROOM_DECISION_ROLE;
}

export function buildLiveEvidencePathSecureRoomHandoff(): LiveEvidencePathSecureRoomHandoff {
  const policySummary = getLiveEvidencePathPolicy();
  const classifierSummary = getLiveEvidencePathClassifier();
  const repeatability = getLivePresealedHlsSurvivalRepeatabilityResult();

  return {
    policySummary,
    classifierSummary,
    preferredLiveEvidencePath: policySummary.preferredLiveEvidencePath,
    rtmpDirectCaptureRole: policySummary.rtmpDirectCaptureRole,
    hlsRepeatabilitySummary: {
      hlsTotalRuns: repeatability.hlsTotalRuns,
      hlsSuccessfulIdReads: repeatability.hlsSuccessfulIdReads,
      hlsExpectedIdMatches: repeatability.hlsExpectedIdMatches,
      summary: "HLS capture is the preferred local lab evidence path because it read the expected ID 3/3 times.",
    },
    rtmpWindowSensitivitySummary: {
      rtmpCapture4sEmbeddedIdRead: repeatability.rtmpCapture4sResult.embeddedIdRead,
      rtmpCapture8sEmbeddedIdRead: repeatability.rtmpCapture8sResult.embeddedIdRead,
      rtmpCapture12sEmbeddedIdRead: repeatability.rtmpCapture12sResult.embeddedIdRead,
      rtmpCapture15sEmbeddedIdRead: repeatability.rtmpCapture15sResult.embeddedIdRead,
      summary: "RTMP direct capture is diagnostic-only because the 4s/8s/12s/15s read matrix was inconsistent.",
    },
    postLiveResealSummary: {
      role: policySummary.postLiveResealRole,
      needsSeparateProductPhase: true,
    },
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    realApiEnabled: false,
    realBroadcastStarted: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_EVIDENCE_PATH_SECURE_ROOM_DECISION_ROLE,
  };
}
