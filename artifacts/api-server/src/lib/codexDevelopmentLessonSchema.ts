import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";

export const CODEX_DEVELOPMENT_LESSON_SCHEMA_VERSION =
  "codex-development-lesson-schema-v0.1" as const;
export const CODEX_DEVELOPMENT_LESSON_APPROVAL_PHRASE =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export type CodexDevelopmentCommandQuality = "strong" | "mixed" | "weak";
export type CodexDevelopmentLessonDecisionLevel = "codex_development_lesson";

export interface CodexDevelopmentLessonInput {
  lessonId?: string;
  lessonDate?: string;
  relatedCheckpoint?: string;
  relatedModule?: string;
  commandQuality?: CodexDevelopmentCommandQuality;
  whatWorked?: readonly string[];
  whatFailed?: readonly string[];
  repeatedRisk?: readonly string[];
  riskyFiles?: readonly string[];
  testsThatCaughtIssues?: readonly string[];
  missingContext?: readonly string[];
  betterPromptPattern?: readonly string[];
  rollbackNeeded?: boolean;
  nextSafeDevelopmentAdvice?: readonly string[];
}

export interface CodexDevelopmentLesson {
  schemaVersion: typeof CODEX_DEVELOPMENT_LESSON_SCHEMA_VERSION;
  lessonId: string;
  lessonDate: string;
  relatedCheckpoint: string;
  relatedModule: string;
  commandQuality: CodexDevelopmentCommandQuality;
  whatWorked: string[];
  whatFailed: string[];
  repeatedRisk: string[];
  riskyFiles: string[];
  testsThatCaughtIssues: string[];
  missingContext: string[];
  betterPromptPattern: string[];
  rollbackNeeded: boolean;
  nextSafeDevelopmentAdvice: string[];
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  decisionLevel: CodexDevelopmentLessonDecisionLevel;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
}

export interface CodexDevelopmentLessonValidation {
  ok: boolean;
  blockedReasons: string[];
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value: unknown, fallback: string, maxLength = 180): string {
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
    .map((value) => value.slice(0, 220))
    .slice(0, 12);
}

function cleanCommandQuality(value: unknown): CodexDevelopmentCommandQuality {
  return value === "strong" || value === "mixed" || value === "weak" ? value : "mixed";
}

function cleanLessonDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayIsoDate();
}

export function createCodexDevelopmentLesson(
  input: CodexDevelopmentLessonInput = {},
): CodexDevelopmentLesson {
  return {
    schemaVersion: CODEX_DEVELOPMENT_LESSON_SCHEMA_VERSION,
    lessonId: cleanText(input.lessonId, `codex-lesson-${cleanLessonDate(input.lessonDate)}`),
    lessonDate: cleanLessonDate(input.lessonDate),
    relatedCheckpoint: cleanText(input.relatedCheckpoint, "uncommitted-or-unknown-checkpoint"),
    relatedModule: cleanText(input.relatedModule, "Codex/Development DNA"),
    commandQuality: cleanCommandQuality(input.commandQuality),
    whatWorked: cleanList(input.whatWorked, [
      "Clear red lines, contracts, typecheck and git diff checks kept development safe.",
    ]),
    whatFailed: cleanList(input.whatFailed, [
      "Missing context can produce incomplete commands or unclear success criteria.",
    ]),
    repeatedRisk: cleanList(input.repeatedRisk, [
      "Core, VAULT, threshold, ownership, secrets and push boundaries must be repeated in every risky task.",
    ]),
    riskyFiles: cleanList(input.riskyFiles, [
      "Core seal/read, VAULT/final, ownership/pre-seal, payment, auth and customer-content paths.",
    ]),
    testsThatCaughtIssues: cleanList(input.testsThatCaughtIssues, [
      "Contracts, API typecheck, root typecheck and git diff --check.",
    ]),
    missingContext: cleanList(input.missingContext, [
      "Repo path, exact task phase, expected output files and required contracts.",
    ]),
    betterPromptPattern: cleanList(input.betterPromptPattern, [
      "State goal, red lines, files to read, files to create, contracts to run, final report fields and checkpoint rule.",
    ]),
    rollbackNeeded: input.rollbackNeeded === true,
    nextSafeDevelopmentAdvice: cleanList(input.nextSafeDevelopmentAdvice, [
      "Keep Codex lesson records support-only and require human approval for high-risk changes.",
    ]),
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    decisionLevel: "codex_development_lesson",
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    requiresHumanApprovalForHighRisk: true,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
  };
}

export function validateCodexDevelopmentLesson(
  lesson: Partial<CodexDevelopmentLesson>,
): CodexDevelopmentLessonValidation {
  const blockedReasons: string[] = [];

  if (lesson.schemaVersion !== CODEX_DEVELOPMENT_LESSON_SCHEMA_VERSION) {
    blockedReasons.push("schema_version_mismatch");
  }
  if (lesson.canOpenVault !== false) blockedReasons.push("can_open_vault_not_false");
  if (lesson.canConfirmFinal !== false) blockedReasons.push("can_confirm_final_not_false");
  if (lesson.canChangeThreshold !== false) blockedReasons.push("can_change_threshold_not_false");
  if (lesson.canChangeOwnership !== false) blockedReasons.push("can_change_ownership_not_false");
  if (lesson.decisionLevel !== "codex_development_lesson") {
    blockedReasons.push("decision_level_not_lesson");
  }
  if (lesson.storesSensitiveContent !== false) blockedReasons.push("stores_sensitive_content");
  if (lesson.storesSecrets !== false) blockedReasons.push("stores_secrets");
  if (lesson.runtimeExternalApiDependency !== false) blockedReasons.push("runtime_external_api");
  if (lesson.runtimeInternetDependency !== false) blockedReasons.push("runtime_internet");
  if (lesson.productBehaviorChanged !== false) blockedReasons.push("product_behavior_changed");
  if (lesson.requiresHumanApprovalForHighRisk !== true) {
    blockedReasons.push("human_approval_missing");
  }
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
  };
}
