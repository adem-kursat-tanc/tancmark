import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  LEARNING_DNA_PHASE_1_VERSION,
  createLearningDnaEvent,
  learningDnaDecisionSafety,
  validateLearningDnaEvent,
  type LearningDnaDecisionSafety,
  type LearningDnaEvent,
  type LearningDnaEventInput,
  type LearningDnaEventResult,
  type LearningDnaEventType,
  type LearningDnaGateStatus,
  type LearningDnaModule,
  type LearningDnaReadinessState,
  type LearningDnaRiskLevel,
  type LearningDnaSupportLevel,
} from "./learningDnaEventSchema";

export interface LearningDnaRegistryEntry {
  registryVersion: typeof LEARNING_DNA_PHASE_1_VERSION;
  registryId: string;
  eventId: string;
  module: LearningDnaModule;
  eventType: LearningDnaEventType;
  success: boolean;
  failed: boolean;
  blocked: boolean;
  method: string;
  supportLevel: LearningDnaSupportLevel;
  riskLevel: LearningDnaRiskLevel;
  readinessState: LearningDnaReadinessState;
  gateStatus: LearningDnaGateStatus;
  recoveryHint: string | null;
  nextRecommendation: string | null;
  relatedDebtId: string | null;
  relatedCheckpoint: string | null;
  event: LearningDnaEvent;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  requiresHumanApprovalForHighRisk: true;
  productBehaviorChanged: false;
  safety: LearningDnaDecisionSafety;
}

export interface LearningDnaRegistrySummary {
  registryVersion: typeof LEARNING_DNA_PHASE_1_VERSION;
  generatedAt: string;
  entryCount: number;
  modules: LearningDnaModule[];
  eventTypes: LearningDnaEventType[];
  successCount: number;
  failureCount: number;
  blockedCount: number;
  highRiskCount: number;
  readinessCounts: Record<LearningDnaReadinessState, number>;
  supportOnly: true;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
}

export interface LearningDnaRegistry {
  status: "learning_dna_registry_support_only_v0.1";
  generatedAt: string;
  entries: LearningDnaRegistryEntry[];
  summary: LearningDnaRegistrySummary;
  safety: LearningDnaDecisionSafety;
  note: string;
}

function resultFlags(result: LearningDnaEventResult): {
  success: boolean;
  failed: boolean;
  blocked: boolean;
} {
  return {
    success: result === "success",
    failed: result === "failure",
    blocked: result === "blocked",
  };
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function emptyReadinessCounts(): Record<LearningDnaReadinessState, number> {
  return {
    "product-ready": 0,
    "support-only": 0,
    "lab-only": 0,
    deferred: 0,
  };
}

export function createLearningDnaRegistryEntry(input: LearningDnaEventInput): LearningDnaRegistryEntry {
  const event = createLearningDnaEvent(input);
  const validation = validateLearningDnaEvent(event);
  if (!validation.ok) {
    throw new Error(`unsafe learning DNA event rejected: ${validation.violations.join(", ")}`);
  }

  const flags = resultFlags(event.result);
  const safety = learningDnaDecisionSafety();
  return {
    registryVersion: LEARNING_DNA_PHASE_1_VERSION,
    registryId: `registry-${event.eventId}`,
    eventId: event.eventId,
    module: event.module,
    eventType: event.eventType,
    success: flags.success,
    failed: flags.failed,
    blocked: flags.blocked,
    method: event.method,
    supportLevel: event.supportLevel,
    riskLevel: event.riskLevel,
    readinessState: event.readinessState,
    gateStatus: event.gateStatus,
    recoveryHint: event.recoveryHint,
    nextRecommendation: event.nextSuggestedAction,
    relatedDebtId: event.relatedDebtId,
    relatedCheckpoint: event.relatedCheckpoint,
    event,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    requiresHumanApprovalForHighRisk: true,
    productBehaviorChanged: false,
    safety,
  };
}

export function buildLearningDnaRegistry(inputs: readonly LearningDnaEventInput[]): LearningDnaRegistry {
  const entries = inputs.map((input) => createLearningDnaRegistryEntry(input));
  const readinessCounts = emptyReadinessCounts();
  for (const entry of entries) {
    readinessCounts[entry.readinessState] += 1;
  }

  const summary: LearningDnaRegistrySummary = {
    registryVersion: LEARNING_DNA_PHASE_1_VERSION,
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    modules: unique(entries.map((entry) => entry.module)),
    eventTypes: unique(entries.map((entry) => entry.eventType)),
    successCount: entries.filter((entry) => entry.success).length,
    failureCount: entries.filter((entry) => entry.failed).length,
    blockedCount: entries.filter((entry) => entry.blocked).length,
    highRiskCount: entries.filter((entry) => entry.riskLevel === "high").length,
    readinessCounts,
    supportOnly: true,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    productBehaviorChanged: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
  };

  return {
    status: "learning_dna_registry_support_only_v0.1",
    generatedAt: summary.generatedAt,
    entries,
    summary,
    safety: learningDnaDecisionSafety(),
    note:
      "Learning DNA registry records support/advisory/recommendation events only. It cannot open VAULT, confirm/finalize, change thresholds, change ownership/pre-seal, or auto-apply product behavior.",
  };
}

export function assertLearningDnaRegistrySafe(registry: LearningDnaRegistry): void {
  if (registry.summary.canOpenVault !== false) throw new Error("registry canOpenVault must be false");
  if (registry.summary.canConfirmFinal !== false) throw new Error("registry canConfirmFinal must be false");
  if (registry.summary.canChangeThreshold !== false) {
    throw new Error("registry canChangeThreshold must be false");
  }
  if (registry.summary.canChangeOwnership !== false) {
    throw new Error("registry canChangeOwnership must be false");
  }
  if (registry.summary.productBehaviorChanged !== false) {
    throw new Error("registry productBehaviorChanged must be false");
  }
  if (registry.summary.storesSensitiveContent !== false) {
    throw new Error("registry storesSensitiveContent must be false");
  }
  if (registry.summary.storesSecrets !== false) throw new Error("registry storesSecrets must be false");
  if (registry.summary.storesPaymentCardData !== false) {
    throw new Error("registry storesPaymentCardData must be false");
  }
  if (registry.summary.storesRawCustomerDocument !== false) {
    throw new Error("registry storesRawCustomerDocument must be false");
  }
  for (const entry of registry.entries) {
    if (entry.canOpenVault !== false) throw new Error(`entry ${entry.eventId} canOpenVault must be false`);
    if (entry.canConfirmFinal !== false) throw new Error(`entry ${entry.eventId} canConfirmFinal must be false`);
    if (entry.canChangeThreshold !== false) {
      throw new Error(`entry ${entry.eventId} canChangeThreshold must be false`);
    }
    if (entry.canChangeOwnership !== false) {
      throw new Error(`entry ${entry.eventId} canChangeOwnership must be false`);
    }
    if (entry.productBehaviorChanged !== false) {
      throw new Error(`entry ${entry.eventId} productBehaviorChanged must be false`);
    }
    if (entry.storesSensitiveContent !== false) {
      throw new Error(`entry ${entry.eventId} storesSensitiveContent must be false`);
    }
    if (entry.storesSecrets !== false) throw new Error(`entry ${entry.eventId} storesSecrets must be false`);
    if (entry.storesPaymentCardData !== false) {
      throw new Error(`entry ${entry.eventId} storesPaymentCardData must be false`);
    }
    if (entry.storesRawCustomerDocument !== false) {
      throw new Error(`entry ${entry.eventId} storesRawCustomerDocument must be false`);
    }
  }
}
