import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";

export const SECURITY_DNA_LESSON_SCHEMA_VERSION =
  "security-dna-lesson-schema-v0.1" as const;
export const SECURITY_DNA_LESSON_APPROVAL_PHRASE =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export type SecurityDnaLessonSignalType =
  | "failed_login"
  | "suspicious_login_pattern"
  | "api_key_risk"
  | "rate_limit_signal"
  | "audit_log_gap"
  | "admin_action_risk"
  | "file_access_risk"
  | "abuse_candidate"
  | "security_contract_result"
  | "sensitive_data_gate"
  | "security_debt";

export type SecurityDnaLessonDecisionLevel = "security_lesson_advisory";

export interface SecurityDnaLessonInput {
  lessonId?: string;
  lessonDate?: string;
  relatedModule?: string;
  securitySignalType?: SecurityDnaLessonSignalType;
  observedRisk?: string;
  whatWorked?: readonly string[];
  whatFailed?: readonly string[];
  repeatedRisk?: readonly string[];
  missingProtection?: readonly string[];
  suggestedSecurityAction?: readonly string[];
  riskLevel?: LearningDnaRiskLevel;
  requiresHumanApproval?: boolean;
}

export interface SecurityDnaLesson {
  schemaVersion: typeof SECURITY_DNA_LESSON_SCHEMA_VERSION;
  lessonId: string;
  lessonDate: string;
  relatedModule: string;
  securitySignalType: SecurityDnaLessonSignalType;
  observedRisk: string;
  whatWorked: string[];
  whatFailed: string[];
  repeatedRisk: string[];
  missingProtection: string[];
  suggestedSecurityAction: string[];
  riskLevel: LearningDnaRiskLevel;
  requiresHumanApproval: boolean;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canBlockUser: false;
  canBanIp: false;
  canChangeAdminRole: false;
  canChangeSubscription: false;
  canChangePaymentState: false;
  canAutoApplySecurityAction: false;
  decisionLevel: SecurityDnaLessonDecisionLevel;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
}

export interface SecurityDnaLessonValidation {
  ok: boolean;
  blockedReasons: string[];
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  canAutoApplySecurityAction: false;
}

const SIGNAL_TYPES: readonly SecurityDnaLessonSignalType[] = [
  "failed_login",
  "suspicious_login_pattern",
  "api_key_risk",
  "rate_limit_signal",
  "audit_log_gap",
  "admin_action_risk",
  "file_access_risk",
  "abuse_candidate",
  "security_contract_result",
  "sensitive_data_gate",
  "security_debt",
];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value: unknown, fallback: string, maxLength = 220): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function cleanList(values: unknown, fallback: readonly string[]): string[] {
  const rawValues = Array.isArray(values) ? values : fallback;
  return rawValues
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.slice(0, 240))
    .slice(0, 12);
}

function cleanDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayIsoDate();
}

function cleanRisk(value: unknown): LearningDnaRiskLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function cleanSignalType(value: unknown): SecurityDnaLessonSignalType {
  return typeof value === "string" && SIGNAL_TYPES.includes(value as SecurityDnaLessonSignalType)
    ? (value as SecurityDnaLessonSignalType)
    : "security_debt";
}

export function createSecurityDnaLesson(input: SecurityDnaLessonInput = {}): SecurityDnaLesson {
  const lessonDate = cleanDate(input.lessonDate);
  const riskLevel = cleanRisk(input.riskLevel);

  return {
    schemaVersion: SECURITY_DNA_LESSON_SCHEMA_VERSION,
    lessonId: cleanText(input.lessonId, `security-dna-lesson-${lessonDate}`),
    lessonDate,
    relatedModule: cleanText(input.relatedModule, "Security DNA"),
    securitySignalType: cleanSignalType(input.securitySignalType),
    observedRisk: cleanText(
      input.observedRisk,
      "Security signal needs review before any product-facing action.",
      320,
    ),
    whatWorked: cleanList(input.whatWorked, [
      "Fail-closed auth, rate-limit, audit and secret-storage gates reduce repeated security risk.",
    ]),
    whatFailed: cleanList(input.whatFailed, [
      "Security signals become risky when they are not tied to audit, rate-limit and human approval boundaries.",
    ]),
    repeatedRisk: cleanList(input.repeatedRisk, [
      "Automatic ban, account action, role change or payment change must not be triggered by DNA.",
    ]),
    missingProtection: cleanList(input.missingProtection, [
      "Durable audit store, shared rate-limit store and verified actor identity should be checked before launch.",
    ]),
    suggestedSecurityAction: cleanList(input.suggestedSecurityAction, [
      "Prepare a support-only security recommendation and require human approval for high-risk work.",
    ]),
    riskLevel,
    requiresHumanApproval: input.requiresHumanApproval ?? riskLevel === "high",
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    canBlockUser: false,
    canBanIp: false,
    canChangeAdminRole: false,
    canChangeSubscription: false,
    canChangePaymentState: false,
    canAutoApplySecurityAction: false,
    decisionLevel: "security_lesson_advisory",
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
  };
}

export function validateSecurityDnaLesson(
  lesson: Partial<SecurityDnaLesson>,
): SecurityDnaLessonValidation {
  const blockedReasons: string[] = [];

  if (lesson.schemaVersion !== SECURITY_DNA_LESSON_SCHEMA_VERSION) {
    blockedReasons.push("schema_version_mismatch");
  }
  if (lesson.canOpenVault !== false) blockedReasons.push("can_open_vault_not_false");
  if (lesson.canConfirmFinal !== false) blockedReasons.push("can_confirm_final_not_false");
  if (lesson.canChangeThreshold !== false) blockedReasons.push("threshold_not_false");
  if (lesson.canChangeOwnership !== false) blockedReasons.push("ownership_not_false");
  if (lesson.canBlockUser !== false) blockedReasons.push("can_block_user_not_false");
  if (lesson.canBanIp !== false) blockedReasons.push("can_ban_ip_not_false");
  if (lesson.canChangeAdminRole !== false) blockedReasons.push("admin_role_change_not_false");
  if (lesson.canChangeSubscription !== false) blockedReasons.push("subscription_change_not_false");
  if (lesson.canChangePaymentState !== false) blockedReasons.push("payment_change_not_false");
  if (lesson.canAutoApplySecurityAction !== false) blockedReasons.push("auto_security_action_not_false");
  if (lesson.decisionLevel !== "security_lesson_advisory") {
    blockedReasons.push("decision_level_not_security_advisory");
  }
  if (lesson.storesSensitiveContent !== false) blockedReasons.push("stores_sensitive_content");
  if (lesson.storesSecrets !== false) blockedReasons.push("stores_secrets");
  if (lesson.runtimeExternalApiDependency !== false) blockedReasons.push("runtime_external_api");
  if (lesson.runtimeInternetDependency !== false) blockedReasons.push("runtime_internet");
  if (lesson.productBehaviorChanged !== false) blockedReasons.push("product_behavior_changed");
  if (lesson.approvalPhrase !== CHIEF_BRAIN_APPROVAL_PHRASE) {
    blockedReasons.push("approval_phrase_mismatch");
  }

  return {
    ok: blockedReasons.length === 0,
    blockedReasons,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    canAutoApplySecurityAction: false,
  };
}
