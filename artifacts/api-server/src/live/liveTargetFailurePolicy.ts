export type LiveTargetFailureReason =
  | "missing_stream_key"
  | "expired_credential_future"
  | "target_unreachable_future"
  | "platform_api_rejected_future"
  | "bitrate_too_high_preview"
  | "reconnect_needed_preview"
  | "target_abuse_risk_preview";

export const LIVE_TARGET_FAILURE_POLICY_DECISION_ROLE =
  "live_target_failure_policy_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetFailurePolicyEntry {
  failureReason: LiveTargetFailureReason;
  recommendedAction: string;
  retryAllowedPreview: boolean;
  fallbackTargetPreview: string;
  humanApprovalRequiredForRealAction: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_FAILURE_POLICY_DECISION_ROLE;
}

export interface LiveTargetFailurePolicy {
  scenarios: LiveTargetFailurePolicyEntry[];
  realTargetActionEnabled: false;
  autoDisableTargetEnabled: false;
  autoReconnectEnabled: false;
  humanApprovalRequiredForRealAction: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_FAILURE_POLICY_DECISION_ROLE;
}

export function getLiveTargetFailurePolicy(): LiveTargetFailurePolicy {
  return {
    scenarios: [
      entry("missing_stream_key", "Keep mock-only and request a redacted credential shape in future setup.", false, "none"),
      entry("expired_credential_future", "Plan OAuth refresh handling in a later approved lab.", false, "custom_rtmp_mock"),
      entry("target_unreachable_future", "Try backup target only in a future real lab.", true, "youtube_mock"),
      entry("platform_api_rejected_future", "Review provider API policy and rate limits before real connection.", false, "custom_rtmp_mock"),
      entry("bitrate_too_high_preview", "Lower bitrate preview in isolated lab before real push.", true, "twitch_mock"),
      entry("reconnect_needed_preview", "Measure reconnect behavior in approved engine lab.", true, "facebook_mock"),
      entry("target_abuse_risk_preview", "Route to manual review; do not auto-push.", false, "none"),
    ],
    realTargetActionEnabled: false,
    autoDisableTargetEnabled: false,
    autoReconnectEnabled: false,
    humanApprovalRequiredForRealAction: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_FAILURE_POLICY_DECISION_ROLE,
  };
}

function entry(
  failureReason: LiveTargetFailureReason,
  recommendedAction: string,
  retryAllowedPreview: boolean,
  fallbackTargetPreview: string,
): LiveTargetFailurePolicyEntry {
  return {
    failureReason,
    recommendedAction,
    retryAllowedPreview,
    fallbackTargetPreview,
    humanApprovalRequiredForRealAction: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_FAILURE_POLICY_DECISION_ROLE,
  };
}
