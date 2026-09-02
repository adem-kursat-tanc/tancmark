import { getLiveEvidencePathPolicy } from "./liveEvidencePathPolicy";
import { getLiveHlsEvidenceDecisionBoundary } from "./liveHlsEvidenceDecisionBoundary";
import { getLiveHlsEvidencePackage } from "./liveHlsEvidencePackage";
import { getLiveHlsEvidenceSourceSummary } from "./liveHlsEvidenceSourceSummary";
import { getLivePostLiveVodResealLabResult } from "./livePostLiveVodResealLabResult";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "./livePresealedHlsSurvivalRepeatabilityResult";

export const LIVE_HLS_SECURE_ROOM_BUNDLE_DECISION_ROLE =
  "live_hls_secure_room_bundle_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceSecureRoomBundle {
  secureRoomBundleId: "secure_room_live_hls_local_evidence_bundle_v1";
  evidencePackageSummary: ReturnType<typeof getLiveHlsEvidencePackage>;
  sourceSummary: ReturnType<typeof getLiveHlsEvidenceSourceSummary>;
  decisionBoundarySummary: ReturnType<typeof getLiveHlsEvidenceDecisionBoundary>;
  hlsPolicySummary: ReturnType<typeof getLiveEvidencePathPolicy>;
  postLiveResealSummary: {
    postLiveResealSucceeded: true;
    embeddedIdRead: true;
    role: "safest_local_reseal_strategy";
  };
  rtmpDiagnosticSummary: {
    role: "diagnostic_only";
    rtmpCapture4sEmbeddedIdRead: false;
    rtmpCapture8sEmbeddedIdRead: true;
    rtmpCapture12sEmbeddedIdRead: false;
    rtmpCapture15sEmbeddedIdRead: false;
  };
  wrongIdSafetySummary: {
    wrongIdRejected: true;
    decisionImpact: "no_vault_no_confirmed_no_final";
  };
  noIdNoVaultSummary: {
    noIdNoVault: true;
    decisionImpact: "no_vault_no_confirmed_no_final";
  };
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  realSecretUsed: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_HLS_SECURE_ROOM_BUNDLE_DECISION_ROLE;
}

export function buildLiveHlsEvidenceSecureRoomBundle(): LiveHlsEvidenceSecureRoomBundle {
  const evidencePackageSummary = getLiveHlsEvidencePackage();
  const hlsRepeatability = getLivePresealedHlsSurvivalRepeatabilityResult();
  const postLiveReseal = getLivePostLiveVodResealLabResult();

  return {
    secureRoomBundleId: "secure_room_live_hls_local_evidence_bundle_v1",
    evidencePackageSummary,
    sourceSummary: getLiveHlsEvidenceSourceSummary(),
    decisionBoundarySummary: getLiveHlsEvidenceDecisionBoundary(),
    hlsPolicySummary: getLiveEvidencePathPolicy(),
    postLiveResealSummary: {
      postLiveResealSucceeded: postLiveReseal.postLiveResealSucceeded,
      embeddedIdRead: postLiveReseal.embeddedIdRead,
      role: evidencePackageSummary.postLiveResealRole,
    },
    rtmpDiagnosticSummary: {
      role: evidencePackageSummary.rtmpDirectCaptureRole,
      rtmpCapture4sEmbeddedIdRead: hlsRepeatability.rtmpCapture4sResult.embeddedIdRead,
      rtmpCapture8sEmbeddedIdRead: hlsRepeatability.rtmpCapture8sResult.embeddedIdRead,
      rtmpCapture12sEmbeddedIdRead: hlsRepeatability.rtmpCapture12sResult.embeddedIdRead,
      rtmpCapture15sEmbeddedIdRead: hlsRepeatability.rtmpCapture15sResult.embeddedIdRead,
    },
    wrongIdSafetySummary: {
      wrongIdRejected: true,
      decisionImpact: "no_vault_no_confirmed_no_final",
    },
    noIdNoVaultSummary: {
      noIdNoVault: true,
      decisionImpact: "no_vault_no_confirmed_no_final",
    },
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    realSecretUsed: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_HLS_SECURE_ROOM_BUNDLE_DECISION_ROLE,
  };
}
