export const LEARNING_DNA_PHASE_1_VERSION = "learning-dna-phase-1-registry-v0.1" as const;
export const CHIEF_BRAIN_APPROVAL_PHRASE = "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export const LEARNING_DNA_EVENT_TYPES = [
  "seal_attempt",
  "read_attempt",
  "recovery_attempt",
  "format_test_result",
  "live_test_result",
  "discovery_result",
  "pricing_cost_signal",
  "user_signal",
  "auth_signal",
  "subscription_signal",
  "payment_signal",
  "usage_limit_signal",
  "finance_cost_signal",
  "live_signal",
  "discovery_signal",
  "license_gate_signal",
  "evidence_signal",
  "secure_room_signal",
  "security_signal",
  "api_signal",
  "storage_signal",
  "admin_signal",
  "product_signal",
  "marketing_signal",
  "legal_signal",
  "launch_signal",
  "debt_signal",
  "recommendation_signal",
] as const;

export type LearningDnaEventType = (typeof LEARNING_DNA_EVENT_TYPES)[number];

export const LEARNING_DNA_MODULES = [
  "visual",
  "video",
  "audio",
  "text_document",
  "format_layers",
  "watermark",
  "discovery_search",
  "pricing_learning",
  "cost_margin",
  "user_account",
  "auth",
  "subscription",
  "payment",
  "usage_limit",
  "finance",
  "license_product_gate",
  "evidence",
  "secure_room",
  "live_tanclive",
  "chief_brain",
  "weekly_intelligence",
  "debt_ledger",
  "security",
  "api",
  "storage",
  "admin",
  "saas_operation",
  "product",
  "marketing",
  "legal",
  "launch",
] as const;

export type LearningDnaModule = (typeof LEARNING_DNA_MODULES)[number];

export type LearningDnaInputType =
  | "image"
  | "video"
  | "audio"
  | "text"
  | "document"
  | "pdf"
  | "live_stream"
  | "search_result"
  | "pricing"
  | "cost"
  | "license"
  | "evidence"
  | "secure_room"
  | "security"
  | "user"
  | "auth"
  | "subscription"
  | "payment"
  | "usage_limit"
  | "finance"
  | "api"
  | "storage"
  | "admin"
  | "saas_operation"
  | "product"
  | "marketing"
  | "legal"
  | "launch"
  | "format_layer"
  | "debt"
  | "unknown";

export type LearningDnaEventResult = "success" | "failure" | "partial" | "blocked" | "pending";
export type LearningDnaDecisionLevel = "support" | "advisory" | "recommendation";
export type LearningDnaSupportLevel = "support-only" | "advisory-only" | "recommendation-only";
export type LearningDnaRiskLevel = "low" | "medium" | "high";
export type LearningDnaReadinessState = "product-ready" | "support-only" | "lab-only" | "deferred";
export type LearningDnaGateState = "approved" | "blocked" | "pending" | "not_applicable";

export interface LearningDnaDecisionSafety {
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canChangePreSeal: false;
  canChangeCoreWatermark: false;
  canAutoApplyProductChange: false;
  requiresHumanApprovalForHighRisk: true;
  highRiskApprovalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  candidateSupportIsFinal: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
}

export interface LearningDnaGateStatus {
  license: LearningDnaGateState;
  patent: LearningDnaGateState;
  model: LearningDnaGateState;
  asset: LearningDnaGateState;
}

export interface LearningDnaEventInput {
  eventId?: string;
  module: LearningDnaModule;
  eventType: LearningDnaEventType;
  timestamp?: string;
  inputType: LearningDnaInputType;
  result: LearningDnaEventResult;
  confidence?: number;
  supportScore?: number;
  decisionLevel?: LearningDnaDecisionLevel;
  method?: string;
  supportLevel?: LearningDnaSupportLevel;
  riskLevel?: LearningDnaRiskLevel;
  readinessState?: LearningDnaReadinessState;
  gateStatus?: Partial<LearningDnaGateStatus>;
  recoveryHint?: string | null;
  nextSuggestedAction?: string | null;
  relatedDebtId?: string | null;
  relatedCheckpoint?: string | null;
  note?: string | null;
}

export interface LearningDnaEvent {
  schemaVersion: typeof LEARNING_DNA_PHASE_1_VERSION;
  eventId: string;
  module: LearningDnaModule;
  eventType: LearningDnaEventType;
  timestamp: string;
  inputType: LearningDnaInputType;
  result: LearningDnaEventResult;
  confidence: number;
  supportScore: number;
  decisionLevel: LearningDnaDecisionLevel;
  method: string;
  supportLevel: LearningDnaSupportLevel;
  riskLevel: LearningDnaRiskLevel;
  readinessState: LearningDnaReadinessState;
  gateStatus: LearningDnaGateStatus;
  recoveryHint: string | null;
  nextSuggestedAction: string | null;
  relatedDebtId: string | null;
  relatedCheckpoint: string | null;
  note: string | null;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  requiresHumanApprovalForHighRisk: true;
  safety: LearningDnaDecisionSafety;
}

export function learningDnaDecisionSafety(): LearningDnaDecisionSafety {
  return {
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    canChangePreSeal: false,
    canChangeCoreWatermark: false,
    canAutoApplyProductChange: false,
    requiresHumanApprovalForHighRisk: true,
    highRiskApprovalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    candidateSupportIsFinal: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
  };
}

function cleanText(value: unknown, fallback: string, maxLength = 240): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanOptionalText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function clampScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event";
}

function cleanTimestamp(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function completeGateStatus(input: Partial<LearningDnaGateStatus> | undefined): LearningDnaGateStatus {
  return {
    license: input?.license ?? "not_applicable",
    patent: input?.patent ?? "not_applicable",
    model: input?.model ?? "not_applicable",
    asset: input?.asset ?? "not_applicable",
  };
}

function defaultSupportLevel(decisionLevel: LearningDnaDecisionLevel): LearningDnaSupportLevel {
  if (decisionLevel === "support") return "support-only";
  if (decisionLevel === "recommendation") return "recommendation-only";
  return "advisory-only";
}

export function createLearningDnaEvent(input: LearningDnaEventInput): LearningDnaEvent {
  const timestamp = cleanTimestamp(input.timestamp);
  const decisionLevel = input.decisionLevel ?? "support";
  const safety = learningDnaDecisionSafety();
  return {
    schemaVersion: LEARNING_DNA_PHASE_1_VERSION,
    eventId:
      cleanOptionalText(input.eventId, 160) ??
      `dna-${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}-${slug(input.module)}-${slug(input.eventType)}`,
    module: input.module,
    eventType: input.eventType,
    timestamp,
    inputType: input.inputType,
    result: input.result,
    confidence: clampScore(input.confidence, 0),
    supportScore: clampScore(input.supportScore, clampScore(input.confidence, 0)),
    decisionLevel,
    method: cleanText(input.method, "not_recorded", 160),
    supportLevel: input.supportLevel ?? defaultSupportLevel(decisionLevel),
    riskLevel: input.riskLevel ?? "low",
    readinessState: input.readinessState ?? "support-only",
    gateStatus: completeGateStatus(input.gateStatus),
    recoveryHint: cleanOptionalText(input.recoveryHint),
    nextSuggestedAction: cleanOptionalText(input.nextSuggestedAction),
    relatedDebtId: cleanOptionalText(input.relatedDebtId, 160),
    relatedCheckpoint: cleanOptionalText(input.relatedCheckpoint, 160),
    note: cleanOptionalText(input.note),
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    requiresHumanApprovalForHighRisk: true,
    safety,
  };
}

export function validateLearningDnaEvent(event: LearningDnaEvent): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  if (event.canOpenVault !== false) violations.push("canOpenVault_not_false");
  if (event.canConfirmFinal !== false) violations.push("canConfirmFinal_not_false");
  if (event.canChangeThreshold !== false) violations.push("canChangeThreshold_not_false");
  if (event.canChangeOwnership !== false) violations.push("canChangeOwnership_not_false");
  if (event.requiresHumanApprovalForHighRisk !== true) {
    violations.push("requiresHumanApprovalForHighRisk_not_true");
  }
  if (event.storesSensitiveContent !== false) violations.push("storesSensitiveContent_not_false");
  if (event.storesSecrets !== false) violations.push("storesSecrets_not_false");
  if (event.storesPaymentCardData !== false) violations.push("storesPaymentCardData_not_false");
  if (event.storesRawCustomerDocument !== false) {
    violations.push("storesRawCustomerDocument_not_false");
  }
  if (event.safety.canAutoApplyProductChange !== false) {
    violations.push("canAutoApplyProductChange_not_false");
  }
  if (event.safety.storesSensitiveContent !== false) {
    violations.push("safety_storesSensitiveContent_not_false");
  }
  if (event.safety.storesSecrets !== false) violations.push("safety_storesSecrets_not_false");
  if (event.safety.storesPaymentCardData !== false) {
    violations.push("safety_storesPaymentCardData_not_false");
  }
  if (event.safety.storesRawCustomerDocument !== false) {
    violations.push("safety_storesRawCustomerDocument_not_false");
  }
  if (event.safety.highRiskApprovalPhrase !== CHIEF_BRAIN_APPROVAL_PHRASE) {
    violations.push("approval_phrase_mismatch");
  }
  if (event.safety.candidateSupportIsFinal !== false) {
    violations.push("candidateSupportIsFinal_not_false");
  }
  return {
    ok: violations.length === 0,
    violations,
  };
}
