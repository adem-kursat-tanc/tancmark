export type LivePlaybackAuthorizationScenario =
  | "viewer_allowed"
  | "viewer_denied"
  | "token_expired"
  | "wrong_domain"
  | "wrong_referrer"
  | "missing_token"
  | "future_drm_required";

export type LivePlaybackRiskLevel = "low" | "medium" | "high";

export const LIVE_PLAYBACK_AUTHORIZATION_DECISION_ROLE =
  "live_playback_authorization_mock_support_only_no_access_enforcement_no_vault_no_confirmed" as const;

export interface LivePlaybackAuthorizationMock {
  scenario: LivePlaybackAuthorizationScenario;
  authorizedPreview: boolean;
  reason: string;
  riskLevel: LivePlaybackRiskLevel;
  userMessage: string;
  secureRoomNote: string;
  liveDnaLearningSignal: string;
  realAccessEnforced: false;
  realTokenValidated: false;
  realSignedUrlValidated: false;
  drmEnabled: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_PLAYBACK_AUTHORIZATION_DECISION_ROLE;
}

const scenarios: LivePlaybackAuthorizationScenario[] = [
  "viewer_allowed",
  "viewer_denied",
  "token_expired",
  "wrong_domain",
  "wrong_referrer",
  "missing_token",
  "future_drm_required",
];

export function getLivePlaybackAuthorizationScenarios(): LivePlaybackAuthorizationScenario[] {
  return scenarios;
}

export function parseLivePlaybackAuthorizationScenario(value: unknown): LivePlaybackAuthorizationScenario {
  return scenarios.includes(value as LivePlaybackAuthorizationScenario)
    ? (value as LivePlaybackAuthorizationScenario)
    : "viewer_allowed";
}

export function buildLivePlaybackAuthorizationMock(
  scenarioInput: unknown = "viewer_allowed",
): LivePlaybackAuthorizationMock {
  const scenario = parseLivePlaybackAuthorizationScenario(scenarioInput);
  const fields = scenarioFields(scenario);
  return {
    scenario,
    ...fields,
    realAccessEnforced: false,
    realTokenValidated: false,
    realSignedUrlValidated: false,
    drmEnabled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_PLAYBACK_AUTHORIZATION_DECISION_ROLE,
  };
}

function scenarioFields(
  scenario: LivePlaybackAuthorizationScenario,
): Pick<
  LivePlaybackAuthorizationMock,
  "authorizedPreview" | "reason" | "riskLevel" | "userMessage" | "secureRoomNote" | "liveDnaLearningSignal"
> {
  switch (scenario) {
    case "viewer_denied":
      return {
        authorizedPreview: false,
        reason: "viewer_not_allowed_mock",
        riskLevel: "medium",
        userMessage: "Viewer would be denied by the mock access policy preview.",
        secureRoomNote: "Mock denied access event; no real access enforcement happened.",
        liveDnaLearningSignal: "denied_access",
      };
    case "token_expired":
      return {
        authorizedPreview: false,
        reason: "token_expired_mock",
        riskLevel: "medium",
        userMessage: "The mock token is expired in this preview.",
        secureRoomNote: "Mock token expiry signal; no real token was generated or validated.",
        liveDnaLearningSignal: "token_expired",
      };
    case "wrong_domain":
      return {
        authorizedPreview: false,
        reason: "domain_mismatch_mock",
        riskLevel: "high",
        userMessage: "The mock request domain is outside the preview allowlist.",
        secureRoomNote: "Mock domain mismatch signal; no real domain enforcement happened.",
        liveDnaLearningSignal: "domain_mismatch",
      };
    case "wrong_referrer":
      return {
        authorizedPreview: false,
        reason: "referrer_mismatch_mock",
        riskLevel: "high",
        userMessage: "The mock referrer is outside the preview allowlist.",
        secureRoomNote: "Mock referrer mismatch signal; no real referrer enforcement happened.",
        liveDnaLearningSignal: "referrer_mismatch",
      };
    case "missing_token":
      return {
        authorizedPreview: false,
        reason: "missing_token_mock",
        riskLevel: "medium",
        userMessage: "A token would be required by this mock policy preview.",
        secureRoomNote: "Mock missing-token signal; no real token gate is connected.",
        liveDnaLearningSignal: "missing_token",
      };
    case "future_drm_required":
      return {
        authorizedPreview: false,
        reason: "drm_required_future",
        riskLevel: "high",
        userMessage: "This scenario would require a future external DRM provider.",
        secureRoomNote: "Future DRM requirement signal; no DRM provider is connected.",
        liveDnaLearningSignal: "future_drm_needed",
      };
    case "viewer_allowed":
    default:
      return {
        authorizedPreview: true,
        reason: "viewer_allowed_mock",
        riskLevel: "low",
        userMessage: "Viewer would be allowed by the mock access policy preview.",
        secureRoomNote: "Mock allowed access event; no real access enforcement happened.",
        liveDnaLearningSignal: "viewer_allowed",
      };
  }
}
