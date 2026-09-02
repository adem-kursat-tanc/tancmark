import {
  db,
  learningRecordsTable,
  type LearningRecordEccStatus,
  type LearningRecordMediaType,
  type LearningRecordModuleObservation,
  type LearningRecordRow,
  type LearningRecordSafetyFlags,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  normalizeLearningTestRecord,
  type LearningDnaMemory,
  type LearningModuleObservation,
  type LearningTestRecord,
} from "./learningDnaMemory";

export interface PersistentLearningRecordInput {
  recordKey: string;
  clientId?: string | null;
  docId?: string | null;
  mediaType: LearningRecordMediaType;
  scenario: string;
  sourceRef?: string | null;
  dnaRecordId?: string | null;
  testHistoryId?: string | null;
  fileKind: string;
  expectedOutcome?: string | null;
  expectedId?: string | null;
  observedId?: string | null;
  idMatched: boolean;
  wrongIdDetected: boolean;
  unsealedPositive: boolean;
  falseVault: false;
  idlessVault: false;
  eccStatus: LearningRecordEccStatus;
  candidateSupportOnly: boolean;
  confirmed: false;
  canOpenVault: false;
  vaultCapable: false;
  finalDecision: typeof LEARNING_ADVISORY_FINAL_DECISION;
  autoApply: false;
  moduleObservations: LearningRecordModuleObservation[];
  lessonTags: string[];
  recommendationTags: string[];
  safetyFlags: LearningRecordSafetyFlags;
  learningRecord: LearningTestRecord;
  note?: string | null;
}

export interface ListLearningRecordsOptions {
  limit?: number;
  mediaType?: LearningRecordMediaType;
}

function containsConfirmedModule(modules: readonly { confirmed: boolean }[]): boolean {
  return modules.some((module) => module.confirmed === true);
}

function toStoredModuleObservations(
  modules: readonly LearningModuleObservation[],
): LearningRecordModuleObservation[] {
  return modules.map((module) => ({
    module: module.module,
    active: module.active,
    sealed: module.sealed,
    idRead: module.idRead,
    candidateSupport: module.candidateSupport,
    confirmed: false,
    rescued: module.rescued,
    failed: module.failed,
    note: module.note,
  }));
}

export function validatePersistentLearningRecordInput(input: PersistentLearningRecordInput): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  if (input.finalDecision !== LEARNING_ADVISORY_FINAL_DECISION) violations.push("finalDecision_not_learning_advisory_only");
  if (input.confirmed !== false) violations.push("confirmed_not_false");
  if (input.canOpenVault !== false) violations.push("canOpenVault_not_false");
  if (input.vaultCapable !== false) violations.push("vaultCapable_not_false");
  if (input.autoApply !== false) violations.push("autoApply_not_false");
  if (input.falseVault !== false) violations.push("falseVault_not_false");
  if (input.idlessVault !== false) violations.push("idlessVault_not_false");
  if (input.learningRecord.falseVault !== false) violations.push("learningRecord_falseVault_not_false");
  if (input.learningRecord.idlessVault !== false) violations.push("learningRecord_idlessVault_not_false");
  if (input.learningRecord.finalDecision !== LEARNING_ADVISORY_FINAL_DECISION) {
    violations.push("learningRecord_finalDecision_not_learning_advisory_only");
  }
  if (containsConfirmedModule(input.learningRecord.modules)) violations.push("learningRecord_module_confirmed_not_false");
  if (containsConfirmedModule(input.moduleObservations)) violations.push("moduleObservations_confirmed_not_false");
  if (input.safetyFlags.advisoryOnly !== true) violations.push("safetyFlags_advisoryOnly_not_true");
  if (input.safetyFlags.falseVault !== false) violations.push("safetyFlags_falseVault_not_false");
  if (input.safetyFlags.idlessVault !== false) violations.push("safetyFlags_idlessVault_not_false");
  if (input.safetyFlags.confirmed !== false) violations.push("safetyFlags_confirmed_not_false");
  if (input.safetyFlags.canOpenVault !== false) violations.push("safetyFlags_canOpenVault_not_false");
  if (input.safetyFlags.vaultCapable !== false) violations.push("safetyFlags_vaultCapable_not_false");
  if (input.safetyFlags.autoApply !== false) violations.push("safetyFlags_autoApply_not_false");
  if (input.safetyFlags.finalDecisionChanged !== false) violations.push("safetyFlags_finalDecisionChanged_not_false");
  if (input.safetyFlags.thresholdsChanged !== false) violations.push("safetyFlags_thresholdsChanged_not_false");
  if (input.safetyFlags.idRuleChanged !== false) violations.push("safetyFlags_idRuleChanged_not_false");
  if (input.safetyFlags.missingIdBitsCompleted !== false) violations.push("safetyFlags_missingIdBitsCompleted_not_false");

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function createPersistentLearningRecordInput(input: {
  learningRecord: LearningTestRecord;
  mediaType: LearningRecordMediaType;
  clientId?: string | null;
  docId?: string | null;
  sourceRef?: string | null;
  dnaRecordId?: string | null;
  testHistoryId?: string | null;
  expectedId?: string | null;
  observedId?: string | null;
  wrongIdDetected?: boolean;
  unsealedPositive?: boolean;
  eccStatus?: LearningRecordEccStatus;
  lessonTags?: string[];
  recommendationTags?: string[];
  note?: string | null;
}): PersistentLearningRecordInput {
  const candidateSupportOnly = input.learningRecord.modules.some((module) => module.candidateSupport);
  const safetyFlags: LearningRecordSafetyFlags = {
    advisoryOnly: true,
    wrongIdRejected: input.wrongIdDetected === true,
    unsealedRejected: input.unsealedPositive === true,
    falseVault: false,
    idlessVault: false,
    confirmed: false,
    canOpenVault: false,
    vaultCapable: false,
    autoApply: false,
    finalDecisionChanged: false,
    thresholdsChanged: false,
    idRuleChanged: false,
    missingIdBitsCompleted: false,
  };

  return {
    recordKey: input.learningRecord.recordId,
    clientId: input.clientId ?? null,
    docId: input.docId ?? null,
    mediaType: input.mediaType,
    scenario: input.learningRecord.scenario,
    sourceRef: input.sourceRef ?? null,
    dnaRecordId: input.dnaRecordId ?? null,
    testHistoryId: input.testHistoryId ?? null,
    fileKind: input.learningRecord.fileKind,
    expectedOutcome: input.learningRecord.expectedOutcome,
    expectedId: input.expectedId ?? null,
    observedId: input.observedId ?? null,
    idMatched: input.learningRecord.idMatched,
    wrongIdDetected: input.wrongIdDetected === true,
    unsealedPositive: input.unsealedPositive === true,
    falseVault: false,
    idlessVault: false,
    eccStatus: input.eccStatus ?? "not_tested",
    candidateSupportOnly,
    confirmed: false,
    canOpenVault: false,
    vaultCapable: false,
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    autoApply: false,
    moduleObservations: toStoredModuleObservations(input.learningRecord.modules),
    lessonTags: input.lessonTags ?? [],
    recommendationTags: input.recommendationTags ?? [],
    safetyFlags,
    learningRecord: input.learningRecord,
    note: input.note ?? input.learningRecord.note,
  };
}

export async function persistLearningRecord(input: PersistentLearningRecordInput): Promise<LearningRecordRow> {
  const validation = validatePersistentLearningRecordInput(input);
  if (!validation.ok) {
    throw new Error(`unsafe learning record rejected: ${validation.violations.join(", ")}`);
  }

  const [row] = await db
    .insert(learningRecordsTable)
    .values({
      recordKey: input.recordKey,
      clientId: input.clientId,
      docId: input.docId,
      mediaType: input.mediaType,
      scenario: input.scenario,
      sourceRef: input.sourceRef,
      dnaRecordId: input.dnaRecordId,
      testHistoryId: input.testHistoryId,
      fileKind: input.fileKind,
      expectedOutcome: input.expectedOutcome,
      expectedId: input.expectedId,
      observedId: input.observedId,
      idMatched: input.idMatched,
      wrongIdDetected: input.wrongIdDetected,
      unsealedPositive: input.unsealedPositive,
      falseVault: input.falseVault,
      idlessVault: input.idlessVault,
      eccStatus: input.eccStatus,
      candidateSupportOnly: input.candidateSupportOnly,
      confirmed: input.confirmed,
      canOpenVault: input.canOpenVault,
      vaultCapable: input.vaultCapable,
      finalDecision: input.finalDecision,
      autoApply: input.autoApply,
      moduleObservations: input.moduleObservations,
      lessonTags: input.lessonTags,
      recommendationTags: input.recommendationTags,
      safetyFlags: input.safetyFlags,
      learningRecord: input.learningRecord as unknown as Record<string, unknown>,
      note: input.note,
    })
    .onConflictDoUpdate({
      target: learningRecordsTable.recordKey,
      set: {
        clientId: input.clientId,
        docId: input.docId,
        mediaType: input.mediaType,
        scenario: input.scenario,
        sourceRef: input.sourceRef,
        dnaRecordId: input.dnaRecordId,
        testHistoryId: input.testHistoryId,
        fileKind: input.fileKind,
        expectedOutcome: input.expectedOutcome,
        expectedId: input.expectedId,
        observedId: input.observedId,
        idMatched: input.idMatched,
        wrongIdDetected: input.wrongIdDetected,
        unsealedPositive: input.unsealedPositive,
        falseVault: input.falseVault,
        idlessVault: input.idlessVault,
        eccStatus: input.eccStatus,
        candidateSupportOnly: input.candidateSupportOnly,
        confirmed: input.confirmed,
        canOpenVault: input.canOpenVault,
        vaultCapable: input.vaultCapable,
        finalDecision: input.finalDecision,
        autoApply: input.autoApply,
        moduleObservations: input.moduleObservations,
        lessonTags: input.lessonTags,
        recommendationTags: input.recommendationTags,
        safetyFlags: input.safetyFlags,
        learningRecord: input.learningRecord as unknown as Record<string, unknown>,
        note: input.note,
      },
    })
    .returning();

  if (!row) throw new Error("learning record insert returned no row");
  return row;
}

export async function listLearningRecords(options: ListLearningRecordsOptions = {}): Promise<LearningRecordRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  if (options.mediaType) {
    return db
      .select()
      .from(learningRecordsTable)
      .where(eq(learningRecordsTable.mediaType, options.mediaType))
      .orderBy(desc(learningRecordsTable.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(learningRecordsTable)
    .orderBy(desc(learningRecordsTable.createdAt))
    .limit(limit);
}

export function learningRecordRowToTestRecord(row: LearningRecordRow, index = 0): LearningTestRecord {
  const normalized = normalizeLearningTestRecord(row.learningRecord, index);
  if (normalized) return normalized;

  return {
    recordId: row.recordKey,
    scenario: row.scenario,
    fileKind: row.fileKind,
    expectedOutcome: row.expectedOutcome,
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: row.idMatched,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules: row.moduleObservations.map((module) => ({
      module: module.module as LearningModuleObservation["module"],
      active: module.active,
      sealed: module.sealed,
      idRead: module.idRead,
      candidateSupport: module.candidateSupport,
      confirmed: false,
      rescued: module.rescued,
      failed: module.failed,
      note: module.note,
    })),
    note: row.note,
  };
}

export function buildLearningMemoryFromRows(rows: readonly LearningRecordRow[]): LearningDnaMemory {
  return buildLearningDnaMemory(rows.map((row, index) => learningRecordRowToTestRecord(row, index)));
}
