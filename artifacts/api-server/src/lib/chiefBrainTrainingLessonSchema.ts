import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";
import type { LocalSeedDnaName } from "./localSeedKnowledgeSchema";

export const CHIEF_BRAIN_TRAINING_LESSON_SCHEMA_VERSION =
  "chief-brain-training-lesson-schema-v0.1" as const;
export const CHIEF_BRAIN_TRAINING_APPROVAL_PHRASE =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export type ChiefBrainTrainingDecisionLevel = "chief_brain_training_advisory";

export interface ChiefBrainTrainingLessonInput {
  lessonId?: string;
  lessonDate?: string;
  relatedDnaEngines?: readonly LocalSeedDnaName[];
  inputSignals?: readonly string[];
  conflictDetected?: boolean;
  priorityReasoning?: readonly string[];
  riskLevel?: LearningDnaRiskLevel;
  humanApprovalRequired?: boolean;
  suggestedNextAction?: string;
  whyThisAction?: string;
  whatWorkedPreviously?: readonly string[];
  whatFailedPreviously?: readonly string[];
  recommendationQualityScore?: number;
}

export interface ChiefBrainTrainingLesson {
  schemaVersion: typeof CHIEF_BRAIN_TRAINING_LESSON_SCHEMA_VERSION;
  lessonId: string;
  lessonDate: string;
  relatedDnaEngines: LocalSeedDnaName[];
  inputSignals: string[];
  conflictDetected: boolean;
  priorityReasoning: string[];
  riskLevel: LearningDnaRiskLevel;
  humanApprovalRequired: boolean;
  suggestedNextAction: string;
  whyThisAction: string;
  whatWorkedPreviously: string[];
  whatFailedPreviously: string[];
  recommendationQualityScore: number;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canAutoApplyProductChange: false;
  canExecuteSecurityAction: false;
  canChangePricing: false;
  canPublishMarketingClaim: false;
  decisionLevel: ChiefBrainTrainingDecisionLevel;
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

export interface ChiefBrainTrainingLessonValidation {
  ok: boolean;
  blockedReasons: string[];
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  canAutoApplyProductChange: false;
  storesSensitiveContent: false;
  storesSecrets: false;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayIsoDate();
}

function cleanText(value: unknown, fallback: string, maxLength = 260): string {
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
    .map((value) => value.slice(0, 260))
    .slice(0, 16);
}

function cleanRisk(value: unknown): LearningDnaRiskLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function cleanScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function createChiefBrainTrainingLesson(
  input: ChiefBrainTrainingLessonInput = {},
): ChiefBrainTrainingLesson {
  const lessonDate = cleanDate(input.lessonDate);
  const riskLevel = cleanRisk(input.riskLevel);

  return {
    schemaVersion: CHIEF_BRAIN_TRAINING_LESSON_SCHEMA_VERSION,
    lessonId: cleanText(input.lessonId, `chief-brain-training-lesson-${lessonDate}`),
    lessonDate,
    relatedDnaEngines: cleanList(input.relatedDnaEngines, [
      "Security DNA",
      "License/Product Gate DNA",
      "Pricing/Cost DNA",
      "Codex/Development DNA",
    ]) as LocalSeedDnaName[],
    inputSignals: cleanList(input.inputSignals, [
      "local seed summaries",
      "weekly intelligence summaries",
      "Codex development lessons",
      "Security lessons",
      "deferred work ledger",
    ]),
    conflictDetected: input.conflictDetected === true,
    priorityReasoning: cleanList(input.priorityReasoning, [
      "Blocker risks come before product benefit when launch safety is unclear.",
      "High-risk work needs human approval before implementation.",
    ]),
    riskLevel,
    humanApprovalRequired: input.humanApprovalRequired ?? riskLevel === "high",
    suggestedNextAction: cleanText(
      input.suggestedNextAction,
      "Prepare a support-only task proposal for the highest-risk open blocker.",
    ),
    whyThisAction: cleanText(
      input.whyThisAction,
      "Chief Brain should improve recommendation order without applying any action.",
      420,
    ),
    whatWorkedPreviously: cleanList(input.whatWorkedPreviously, [
      "Contracts, typechecks, git diff checks and checkpoints improved recommendation quality.",
    ]),
    whatFailedPreviously: cleanList(input.whatFailedPreviously, [
      "Missing context and unranked risks can produce unclear next actions.",
    ]),
    recommendationQualityScore: cleanScore(input.recommendationQualityScore),
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    canAutoApplyProductChange: false,
    canExecuteSecurityAction: false,
    canChangePricing: false,
    canPublishMarketingClaim: false,
    decisionLevel: "chief_brain_training_advisory",
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

export function validateChiefBrainTrainingLesson(
  lesson: Partial<ChiefBrainTrainingLesson>,
): ChiefBrainTrainingLessonValidation {
  const blockedReasons: string[] = [];

  if (lesson.schemaVersion !== CHIEF_BRAIN_TRAINING_LESSON_SCHEMA_VERSION) {
    blockedReasons.push("schema_version_mismatch");
  }
  if (lesson.canOpenVault !== false) blockedReasons.push("can_open_vault_not_false");
  if (lesson.canConfirmFinal !== false) blockedReasons.push("can_confirm_final_not_false");
  if (lesson.canChangeThreshold !== false) blockedReasons.push("threshold_not_false");
  if (lesson.canChangeOwnership !== false) blockedReasons.push("ownership_not_false");
  if (lesson.canAutoApplyProductChange !== false) blockedReasons.push("auto_product_change_not_false");
  if (lesson.canExecuteSecurityAction !== false) blockedReasons.push("security_action_not_false");
  if (lesson.canChangePricing !== false) blockedReasons.push("pricing_change_not_false");
  if (lesson.canPublishMarketingClaim !== false) blockedReasons.push("marketing_claim_not_false");
  if (lesson.decisionLevel !== "chief_brain_training_advisory") {
    blockedReasons.push("decision_level_not_training_advisory");
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
    canAutoApplyProductChange: false,
    storesSensitiveContent: false,
    storesSecrets: false,
  };
}
