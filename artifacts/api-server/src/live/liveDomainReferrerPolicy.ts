export const LIVE_DOMAIN_REFERRER_POLICY_DECISION_ROLE =
  "live_domain_referrer_policy_mock_support_only_no_enforcement_no_vault_no_confirmed" as const;

export interface LiveDomainReferrerPolicy {
  allowedDomainPreview: string[];
  blockedDomainPreview: string[];
  allowedReferrerPreview: string[];
  blockedReferrerPreview: string[];
  unknownReferrerPolicy: "mock_review_only";
  localhostLabPolicy: "allowed_for_local_mock_lab_only";
  productionPolicyFuture: "future_real_domain_referrer_enforcement_requires_approval";
  realDomainEnforcementEnabled: false;
  realReferrerEnforcementEnabled: false;
  realAccessEnforced: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DOMAIN_REFERRER_POLICY_DECISION_ROLE;
}

export function getLiveDomainReferrerPolicy(): LiveDomainReferrerPolicy {
  return {
    allowedDomainPreview: ["example.edu", "tancmark.local"],
    blockedDomainPreview: ["unknown.example", "suspicious.example"],
    allowedReferrerPreview: ["https://example.edu/course/*", "https://tancmark.local/live/*"],
    blockedReferrerPreview: ["https://unknown.example/*", "https://suspicious.example/*"],
    unknownReferrerPolicy: "mock_review_only",
    localhostLabPolicy: "allowed_for_local_mock_lab_only",
    productionPolicyFuture: "future_real_domain_referrer_enforcement_requires_approval",
    realDomainEnforcementEnabled: false,
    realReferrerEnforcementEnabled: false,
    realAccessEnforced: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DOMAIN_REFERRER_POLICY_DECISION_ROLE,
  };
}
