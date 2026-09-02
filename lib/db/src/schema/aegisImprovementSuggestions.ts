import {
  pgTable,
  bigserial,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aegisImprovementSuggestionsTable = pgTable(
  "aegis_improvement_suggestions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    suggestionKey: text("suggestion_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    relatedTestKey: text("related_test_key"),
    relatedTestId: text("related_test_id"),
    topic: text("topic").notNull(),
    severity: text("severity").notNull(),
    suggestion: text("suggestion").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("bekliyor"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    uniqueIndex("aegis_improvement_suggestions_key_uniq").on(t.suggestionKey),
    index("aegis_improvement_suggestions_created_idx").on(t.createdAt),
    index("aegis_improvement_suggestions_severity_idx").on(t.severity),
    index("aegis_improvement_suggestions_status_idx").on(t.status),
  ],
);

export const aegisImprovementSuggestionSelectSchema = createSelectSchema(
  aegisImprovementSuggestionsTable,
);
export type AegisImprovementSuggestionRow = z.infer<
  typeof aegisImprovementSuggestionSelectSchema
>;
