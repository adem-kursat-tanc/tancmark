import { getLiveEvidencePathPolicy } from "./liveEvidencePathPolicy";

export const LIVE_EVIDENCE_PATH_CLASSIFIER_DECISION_ROLE =
  "live_evidence_path_classifier_support_only_no_vault_no_confirmed" as const;

export type LiveEvidencePathClass =
  | "hls_capture_preferred"
  | "rtmp_direct_diagnostic_only"
  | "post_live_reseal_recommended"
  | "social_transcode_future_unknown"
  | "external_target_future_unknown";

export interface LiveEvidencePathClassification {
  className: LiveEvidencePathClass;
  role: string;
  reason: string;
  vaultEligible: false;
  confirmed: false;
  final: false;
  supportOnly: true;
}

export interface LiveEvidencePathClassifier {
  classifications: LiveEvidencePathClassification[];
  preferredLiveEvidencePath: "hls_capture";
  rtmpDirectCaptureRole: "diagnostic_only";
  postLiveResealRole: "safest_local_reseal_strategy";
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
  decisionRole: typeof LIVE_EVIDENCE_PATH_CLASSIFIER_DECISION_ROLE;
}

function supportOnlyClassification(
  className: LiveEvidencePathClass,
  role: string,
  reason: string,
): LiveEvidencePathClassification {
  return {
    className,
    role,
    reason,
    vaultEligible: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  };
}

export function getLiveEvidencePathClassifier(): LiveEvidencePathClassifier {
  const policy = getLiveEvidencePathPolicy();

  return {
    classifications: [
      supportOnlyClassification(
        "hls_capture_preferred",
        "preferred_local_lab_evidence_path",
        "Local synthetic pre-sealed HLS capture read the expected ID 3/3 times; it remains support-only until a product evidence pipeline is explicitly designed.",
      ),
      supportOnlyClassification(
        "rtmp_direct_diagnostic_only",
        policy.rtmpDirectCaptureRole,
        "RTMP direct capture produced inconsistent 4s/8s/12s/15s reads and must not be treated as the product evidence/read path.",
      ),
      supportOnlyClassification(
        "post_live_reseal_recommended",
        policy.postLiveResealRole,
        "Post-live re-seal remains the safest local re-seal strategy, but it needs a separate real-product phase before product use.",
      ),
      supportOnlyClassification(
        "social_transcode_future_unknown",
        "future_lab_required",
        "YouTube/Facebook/Twitch/TikTok/social transcode survival has not been tested in this phase.",
      ),
      supportOnlyClassification(
        "external_target_future_unknown",
        "future_lab_required",
        "External custom RTMP target evidence behavior has not been tested in this phase.",
      ),
    ],
    preferredLiveEvidencePath: policy.preferredLiveEvidencePath,
    rtmpDirectCaptureRole: policy.rtmpDirectCaptureRole,
    postLiveResealRole: policy.postLiveResealRole,
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
    decisionRole: LIVE_EVIDENCE_PATH_CLASSIFIER_DECISION_ROLE,
  };
}
