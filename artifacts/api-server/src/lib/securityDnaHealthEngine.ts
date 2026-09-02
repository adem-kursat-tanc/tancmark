import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const SECURITY_DNA_HEALTH_ENGINE_VERSION = "security-dna-health-engine-v0.1" as const;

export interface SecurityDnaHealthSummary extends HierarchicalDnaHealthSummary {
  securityEngineVersion: typeof SECURITY_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestSecurityAreas: string[];
  missingSecurityAreas: string[];
  highSecurityRisks: string[];
  auditLogDebts: string[];
  nextSecurityWork: string;
}

const SECURITY_LEARNS_FROM_SIGNALS = [
  "login attempts",
  "failed logins",
  "permission/role signals",
  "abuse candidate",
  "rate-limit",
  "audit log",
  "API key security",
  "suspicious traffic",
  "admin operations",
  "security debt",
] as const;

const SECURITY_ENGINE_CONFIG = {
  dnaName: "Security DNA",
  modules: ["security", "auth", "api", "admin", "user_account", "license_product_gate"] as const,
  eventTypes: [
    "auth_signal",
    "security_signal",
    "api_signal",
    "admin_signal",
    "user_signal",
    "license_gate_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "security",
    "auth",
    "login",
    "failed login",
    "permission",
    "role",
    "abuse",
    "rate-limit",
    "audit",
    "api key",
    "traffic",
    "admin",
    "header",
    "fail-closed",
  ] as const,
  readinessNote:
    "Security DNA summarizes security health only; it cannot block users, rotate keys or change policy automatically.",
  defaultActions: [
    {
      riskLevel: "high" as const,
      title: "Keep security hardening human-reviewed",
      reason:
        "Security policy, auth, rate-limit and audit changes can affect product access and must not be auto-applied by DNA.",
      nextStep:
        "Require APPROVE_CHIEF_BRAIN_SAFE_ACTION before any high-risk security implementation task.",
      requiresHumanApproval: true,
    },
  ],
};

export function buildSecurityDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): SecurityDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(SECURITY_ENGINE_CONFIG, input);

  return {
    ...base,
    securityEngineVersion: SECURITY_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: SECURITY_LEARNS_FROM_SIGNALS,
    strongestSecurityAreas: [
      "fail-closed API key and auth gate direction",
      "audit identity spoofing closure",
      "live mutation routes guarded by admin token",
    ],
    missingSecurityAreas: [
      "shared production rate-limit store",
      "persistent audit store for autoscale production",
      "full suspicious traffic reporting surface",
    ],
    highSecurityRisks: [
      "new unauthenticated mutation route",
      "fail-open auth behavior",
      "unverified user identity in audit trail",
      "secret/token exposure in logs or reports",
    ],
    auditLogDebts: [
      "production-grade durable audit storage",
      "cross-instance rate-limit/audit consistency",
      "admin operation audit summary without sensitive values",
    ],
    nextSecurityWork:
      "Create a read-only Security DNA matrix for auth, audit, rate-limit, API key and admin operation readiness.",
  };
}
