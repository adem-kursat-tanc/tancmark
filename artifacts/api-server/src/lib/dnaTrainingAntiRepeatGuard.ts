import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";

export const DNA_TRAINING_ANTI_REPEAT_GUARD_VERSION =
  "dna-training-anti-repeat-guard-v0.1" as const;

export interface DnaTrainingHistoryLesson {
  lessonId: string;
  dnaName: string;
  lessonDate: string;
  lessonTopic: string;
  taughtConcepts: string[];
  newConceptsCount: number;
  repeatedConceptsCount: number;
  relatedPreviousLessons: string[];
  whatChangedFromPrevious: string;
  learningValueScore: number;
  shouldRepeatLater: boolean;
  nextSuggestedLesson: string;
  summary: string;
}

export interface DnaTrainingAntiRepeatInput {
  dnaName: string;
  lessonTopic: string;
  taughtConcepts: readonly string[];
  history: readonly DnaTrainingHistoryLesson[];
  allowDeepening?: boolean;
}

export interface DnaTrainingAntiRepeatResult {
  guardVersion: typeof DNA_TRAINING_ANTI_REPEAT_GUARD_VERSION;
  dnaName: string;
  lessonTopic: string;
  repeatedConcepts: string[];
  newConcepts: string[];
  relatedPreviousLessons: string[];
  repeatedConceptsCount: number;
  newConceptsCount: number;
  similarityScore: number;
  status: "fresh_lesson" | "deepening_required" | "blocked_repetition";
  codexInstruction: string;
  learningValueScore: number;
  shouldRepeatLater: boolean;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function overlap(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

export function evaluateDnaTrainingAntiRepeat(
  input: DnaTrainingAntiRepeatInput,
): DnaTrainingAntiRepeatResult {
  const proposedConcepts = unique(input.taughtConcepts);
  const relatedHistory = input.history.filter(
    (lesson) => normalize(lesson.dnaName) === normalize(input.dnaName),
  );
  const previousConcepts = unique(relatedHistory.flatMap((lesson) => lesson.taughtConcepts));
  const repeatedConcepts = overlap(proposedConcepts, previousConcepts);
  const repeatedSet = new Set(repeatedConcepts);
  const newConcepts = proposedConcepts.filter((concept) => !repeatedSet.has(concept));
  const similarityScore =
    proposedConcepts.length === 0 ? 0 : round(repeatedConcepts.length / proposedConcepts.length);
  const relatedPreviousLessons = relatedHistory
    .filter((lesson) =>
      overlap(proposedConcepts, unique(lesson.taughtConcepts)).length > 0 ||
      normalize(lesson.lessonTopic) === normalize(input.lessonTopic),
    )
    .map((lesson) => lesson.lessonId)
    .slice(0, 8);

  const status =
    similarityScore >= 0.75 && input.allowDeepening !== true
      ? "blocked_repetition"
      : similarityScore >= 0.45
        ? "deepening_required"
        : "fresh_lesson";

  return {
    guardVersion: DNA_TRAINING_ANTI_REPEAT_GUARD_VERSION,
    dnaName: input.dnaName,
    lessonTopic: input.lessonTopic,
    repeatedConcepts,
    newConcepts,
    relatedPreviousLessons,
    repeatedConceptsCount: repeatedConcepts.length,
    newConceptsCount: newConcepts.length,
    similarityScore,
    status,
    codexInstruction:
      status === "blocked_repetition"
        ? "This topic was already taught. Do not repeat it; choose a new angle or mark it as a deeper follow-up."
        : status === "deepening_required"
          ? "This topic overlaps previous lessons. Teach only the new angle and explain what changed."
          : "This lesson is sufficiently fresh. Teach it as a new support-only training item.",
    learningValueScore: round(Math.max(0.1, 1 - similarityScore + newConcepts.length * 0.05)),
    shouldRepeatLater: status === "deepening_required",
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
  };
}
