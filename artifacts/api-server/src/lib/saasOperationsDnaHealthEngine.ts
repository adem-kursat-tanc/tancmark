import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const SAAS_OPERATIONS_DNA_HEALTH_ENGINE_VERSION =
  "saas-operations-dna-health-engine-v0.1" as const;

export interface SaasOperationsDnaHealthSummary extends HierarchicalDnaHealthSummary {
  saasOperationsEngineVersion: typeof SAAS_OPERATIONS_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  operationalHealth: string;
  missingInfrastructureWork: string[];
  launchDebts: string[];
  monitoringGaps: string[];
  canDeployRollbackOrDelete: false;
  nextSaasOperationsWork: string;
}

const SAAS_OPERATIONS_LEARNS_FROM_SIGNALS = [
  "dashboard state",
  "admin panel",
  "storage/vault",
  "file upload",
  "job queue",
  "deploy",
  "monitoring",
  "error logs",
  "system health",
  "rollback need",
  "product package/launch debt",
] as const;

const SAAS_OPERATIONS_ENGINE_CONFIG = {
  dnaName: "SaaS/Operations DNA",
  modules: ["saas_operation", "api", "storage", "admin", "security", "product", "launch"] as const,
  eventTypes: [
    "api_signal",
    "storage_signal",
    "admin_signal",
    "security_signal",
    "product_signal",
    "launch_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "saas",
    "operation",
    "dashboard",
    "admin",
    "storage",
    "vault",
    "upload",
    "queue",
    "deploy",
    "monitor",
    "log",
    "system health",
    "rollback",
    "launch",
    "package",
    "rate-limit",
    "audit store",
  ] as const,
  readinessNote:
    "SaaS/Operations DNA summarizes operational readiness only; it cannot deploy, rollback, delete files or change infrastructure.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Build SaaS launch operations matrix",
      reason:
        "Launch readiness depends on durable audit/rate-limit, monitoring, upload, queue, storage and rollback planning.",
      nextStep:
        "Prepare a support-only operations matrix for infrastructure gaps, launch debts and monitoring gaps.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildSaasOperationsDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): SaasOperationsDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(SAAS_OPERATIONS_ENGINE_CONFIG, input);

  return {
    ...base,
    saasOperationsEngineVersion: SAAS_OPERATIONS_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: SAAS_OPERATIONS_LEARNS_FROM_SIGNALS,
    operationalHealth:
      "Core support gates are improving, but final SaaS launch operations remain incomplete until shared stores, monitoring and launch package closure are done.",
    missingInfrastructureWork: [
      "shared production rate-limit store",
      "durable audit/event storage",
      "production monitoring and alerting",
      "job queue and retry visibility",
    ],
    launchDebts: [
      "final product package/NOTICE/SBOM closure",
      "SaaS account/subscription/payment implementation",
      "external live platform and Discovery real API launch proof",
    ],
    monitoringGaps: [
      "error log summary without secrets",
      "health dashboard for queue/storage/API",
      "rollback readiness checklist",
    ],
    canDeployRollbackOrDelete: false,
    nextSaasOperationsWork:
      "Create a read-only SaaS/Operations matrix, then close shared rate-limit/audit and monitoring before launch.",
  };
}
