import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const USER_SUBSCRIPTION_DNA_HEALTH_ENGINE_VERSION =
  "user-subscription-dna-health-engine-v0.1" as const;

export interface UserSubscriptionDnaHealthSummary extends HierarchicalDnaHealthSummary {
  userSubscriptionEngineVersion: typeof USER_SUBSCRIPTION_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  accountHealthSignals: string[];
  subscriptionHealthSignals: string[];
  paymentInvoiceSafetySignals: string[];
  abuseLimitSignals: string[];
  canChangeSubscriptionOrCharge: false;
  nextUserSubscriptionWork: string;
}

const USER_SUBSCRIPTION_LEARNS_FROM_SIGNALS = [
  "membership",
  "login/logout",
  "failed login",
  "role/permission",
  "subscription status",
  "package limit",
  "usage allowance",
  "payment result",
  "invoice result",
  "abuse signal",
] as const;

const USER_SUBSCRIPTION_ENGINE_CONFIG = {
  dnaName: "User/Subscription DNA",
  modules: ["user_account", "auth", "subscription", "payment", "usage_limit", "finance", "security"] as const,
  eventTypes: [
    "user_signal",
    "auth_signal",
    "subscription_signal",
    "payment_signal",
    "usage_limit_signal",
    "finance_cost_signal",
    "security_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "user",
    "account",
    "login",
    "logout",
    "failed login",
    "role",
    "permission",
    "subscription",
    "package",
    "usage",
    "payment",
    "invoice",
    "billing",
    "abuse",
  ] as const,
  readinessNote:
    "User/Subscription DNA summarizes account, package and payment outcomes only; it cannot charge, refund, change roles or change subscriptions.",
  defaultActions: [
    {
      riskLevel: "high" as const,
      title: "Keep user, subscription and payment actions human-approved",
      reason:
        "Account, role, subscription and payment changes can affect users and money, so DNA can only summarize safe outcomes.",
      nextStep:
        "Require APPROVE_CHIEF_BRAIN_SAFE_ACTION before any high-risk user/subscription implementation task.",
      requiresHumanApproval: true,
    },
  ],
};

export function buildUserSubscriptionDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): UserSubscriptionDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(USER_SUBSCRIPTION_ENGINE_CONFIG, input);

  return {
    ...base,
    userSubscriptionEngineVersion: USER_SUBSCRIPTION_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: USER_SUBSCRIPTION_LEARNS_FROM_SIGNALS,
    accountHealthSignals: [
      "membership status summary",
      "login/logout summary",
      "failed login count summary",
      "role/permission summary",
    ],
    subscriptionHealthSignals: [
      "subscription status summary",
      "package limit summary",
      "usage allowance summary",
    ],
    paymentInvoiceSafetySignals: [
      "payment result summary without card data",
      "invoice result summary without private billing document content",
      "no password/token/secret/card storage",
    ],
    abuseLimitSignals: [
      "abuse signal summary",
      "usage-limit pressure summary",
      "manual review before account restriction",
    ],
    canChangeSubscriptionOrCharge: false,
    nextUserSubscriptionWork:
      "Create a read-only User/Subscription matrix for accounts, roles, package limits, payments and abuse signals.",
  };
}
