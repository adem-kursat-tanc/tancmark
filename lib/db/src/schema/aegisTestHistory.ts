import {
  pgTable,
  bigserial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aegisTestHistoryTable = pgTable(
  "aegis_test_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    testKey: text("test_key").notNull(),
    testTime: timestamp("test_time", { withTimezone: true }).notNull(),
    fileName: text("file_name").notNull(),
    verdict: text("verdict").notNull(),
    idMatched: boolean("id_matched").notNull().default(false),
    dnaRecordPresent: boolean("dna_record_present").notNull().default(false),
    dbRecordPresent: boolean("db_record_present").notNull().default(false),
    stampedFrameCount: integer("stamped_frame_count").notNull().default(0),
    strongFrames: integer("strong_frames").notNull().default(0),
    vaultFrames: integer("vault_frames").notNull().default(0),
    pathLabel: text("path_label").notNull().default("v0.5A / T6 kapali"),
    durationMs: integer("duration_ms").notNull().default(0),
    note: text("note"),
    idHex: text("id_hex"),
    dnaId: text("dna_id"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    uniqueIndex("aegis_test_history_test_key_uniq").on(t.testKey),
    index("aegis_test_history_time_idx").on(t.testTime),
    index("aegis_test_history_verdict_idx").on(t.verdict),
  ],
);

export const aegisTestHistorySelectSchema =
  createSelectSchema(aegisTestHistoryTable);
export type AegisTestHistoryRow = z.infer<
  typeof aegisTestHistorySelectSchema
>;
