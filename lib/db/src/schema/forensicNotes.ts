import { pgTable, bigserial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Expert commentary attached to a forensic analysis. Editors / lawyers
 * can persist a note alongside a suspected attribution; the note text is
 * forwarded into the generated PDF report when present.
 *
 * suspected_client_id is `text` (not integer) so it accepts the same
 * shape as the rest of the system: "client-A", "agency-client-001",
 * "777", or null. Legacy integer rows were migrated in place via
 * `ALTER COLUMN ... TYPE text USING suspected_client_id::text`.
 */
export const forensicNotesTable = pgTable(
  "forensic_notes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    suspectedClientId: text("suspected_client_id"),
    confidenceScore: text("confidence_score"),
    author: text("author"),
    content: text("content").notNull(),
  },
  (t) => [index("forensic_notes_created_idx").on(t.createdAt)],
);

export const insertForensicNoteSchema = createInsertSchema(forensicNotesTable, {
  content: z.string().min(1).max(8000),
  author: z.string().min(1).max(120).optional(),
  suspectedClientId: z.string().min(1).max(64).optional(),
  confidenceScore: z.string().max(32).optional(),
}).omit({ id: true, createdAt: true });

export const selectForensicNoteSchema = createSelectSchema(forensicNotesTable);

export type ForensicNote = z.infer<typeof selectForensicNoteSchema>;
export type InsertForensicNote = z.infer<typeof insertForensicNoteSchema>;
