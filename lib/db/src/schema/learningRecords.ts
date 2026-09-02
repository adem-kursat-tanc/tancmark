import {
  pgTable,
  bigserial,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const learningRecordMediaTypes = [
  "image",
  "video",
  "audio",
  "text",
  "multimodal",
] as const;
export type LearningRecordMediaType = (typeof learningRecordMediaTypes)[number];

export const learningRecordEccStatuses = [
  "found_32_32",
  "partial_support",
  "not_found",
  "not_tested",
] as const;
export type LearningRecordEccStatus = (typeof learningRecordEccStatuses)[number];

export interface LearningRecordModuleObservation {
  module: string;
  active: boolean;
  sealed: boolean;
  idRead: boolean;
  candidateSupport: boolean;
  confirmed: false;
  rescued: boolean;
  failed: boolean;
  note: string | null;
}

export interface LearningRecordSafetyFlags {
  advisoryOnly: true;
  wrongIdRejected: boolean;
  unsealedRejected: boolean;
  falseVault: false;
  idlessVault: false;
  confirmed: false;
  canOpenVault: false;
  vaultCapable: false;
  autoApply: false;
  finalDecisionChanged: false;
  thresholdsChanged: false;
  idRuleChanged: false;
  missingIdBitsCompleted: false;
}

export const learningRecordsTable = pgTable(
  "learning_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    recordKey: text("record_key").notNull(),
    clientId: text("client_id"),
    docId: text("doc_id"),
    mediaType: text("media_type").$type<LearningRecordMediaType>().notNull(),
    scenario: text("scenario").notNull(),
    sourceRef: text("source_ref"),
    dnaRecordId: text("dna_record_id"),
    testHistoryId: text("test_history_id"),
    fileKind: text("file_kind").notNull().default("unknown"),
    expectedOutcome: text("expected_outcome"),
    expectedId: text("expected_id"),
    observedId: text("observed_id"),
    idMatched: boolean("id_matched").notNull().default(false),
    wrongIdDetected: boolean("wrong_id_detected").notNull().default(false),
    unsealedPositive: boolean("unsealed_positive").notNull().default(false),
    falseVault: boolean("false_vault").notNull().default(false),
    idlessVault: boolean("idless_vault").notNull().default(false),
    eccStatus: text("ecc_status").$type<LearningRecordEccStatus>().notNull().default("not_tested"),
    candidateSupportOnly: boolean("candidate_support_only").notNull().default(true),
    confirmed: boolean("confirmed").notNull().default(false),
    canOpenVault: boolean("can_open_vault").notNull().default(false),
    vaultCapable: boolean("vault_capable").notNull().default(false),
    finalDecision: text("final_decision").notNull().default("LEARNING_ADVISORY_ONLY"),
    autoApply: boolean("auto_apply").notNull().default(false),
    moduleObservations: jsonb("module_observations")
      .$type<LearningRecordModuleObservation[]>()
      .notNull()
      .default([]),
    lessonTags: jsonb("lesson_tags").$type<string[]>().notNull().default([]),
    recommendationTags: jsonb("recommendation_tags").$type<string[]>().notNull().default([]),
    safetyFlags: jsonb("safety_flags").$type<LearningRecordSafetyFlags>().notNull(),
    learningRecord: jsonb("learning_record").$type<Record<string, unknown>>().notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("learning_records_key_uniq").on(t.recordKey),
    index("learning_records_created_idx").on(t.createdAt),
    index("learning_records_media_idx").on(t.mediaType),
    index("learning_records_scenario_idx").on(t.scenario),
    index("learning_records_client_idx").on(t.clientId),
    index("learning_records_dna_record_idx").on(t.dnaRecordId),
    index("learning_records_test_history_idx").on(t.testHistoryId),
  ],
);

export const learningRecordSelectSchema = createSelectSchema(learningRecordsTable);
export type LearningRecordRow = z.infer<typeof learningRecordSelectSchema>;
