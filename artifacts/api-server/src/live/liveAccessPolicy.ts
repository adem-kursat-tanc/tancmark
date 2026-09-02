export type LiveAccessMode =
  | "public_mock"
  | "private_invite_only_mock"
  | "paid_course_mock"
  | "secure_classroom_future"
  | "token_required_mock"
  | "signed_url_required_mock"
  | "drm_required_future";

export const LIVE_ACCESS_POLICY_DECISION_ROLE =
  "live_access_policy_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveAccessPolicyDefinition {
  accessMode: LiveAccessMode;
  description: string;
  realAccessEnabled: false;
  drmEnabled: false;
  tokenMockOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ACCESS_POLICY_DECISION_ROLE;
}

const accessPolicies: LiveAccessPolicyDefinition[] = [
  policy("public_mock", "Public playback policy preview. No real access enforcement is enabled."),
  policy("private_invite_only_mock", "Private invite-only policy preview. No real invite gate is connected."),
  policy("paid_course_mock", "Paid course entitlement policy preview. No real payment or course membership is connected."),
  policy("secure_classroom_future", "Future Secure Classroom access policy. Not a current product gate."),
  policy("token_required_mock", "Token-required playback policy preview. Tokens are mock-only and never exposed."),
  policy("signed_url_required_mock", "Signed URL playback policy preview. Signed URLs are mock-only and redacted."),
  policy("drm_required_future", "Future external DRM access policy. No DRM provider is connected in this phase."),
];

function policy(accessMode: LiveAccessMode, description: string): LiveAccessPolicyDefinition {
  return {
    accessMode,
    description,
    realAccessEnabled: false,
    drmEnabled: false,
    tokenMockOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ACCESS_POLICY_DECISION_ROLE,
  };
}

export function getLiveAccessPolicies(): LiveAccessPolicyDefinition[] {
  return accessPolicies;
}

export function parseLiveAccessMode(value: unknown): LiveAccessMode {
  return accessPolicies.some((policyDefinition) => policyDefinition.accessMode === value)
    ? (value as LiveAccessMode)
    : "public_mock";
}

export function getLiveAccessPolicy(accessMode: unknown): LiveAccessPolicyDefinition {
  return accessPolicies.find((policyDefinition) => policyDefinition.accessMode === parseLiveAccessMode(accessMode)) ?? accessPolicies[0];
}
