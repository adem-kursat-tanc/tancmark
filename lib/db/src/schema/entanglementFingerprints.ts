import {
  pgTable,
  bigserial,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

/**
 * Structural Entanglement: paraphrase-resilient n-gram fingerprints.
 * For every cloaked document we register a deterministic SHA-256 hash
 * for each sliding 5-token window of normalised text. Even if 30-50%
 * of the words are paraphrased, the remaining windows will still
 * hash-match, letting us recover attribution.
 *
 * Attribution rule (false-accusation guard, mirrors honeytokens):
 *   - A `gram_hash` matched in ≥2 distinct clients is treated as
 *     ambiguous and dropped from the per-client tally.
 *   - A cloak only "claims" the leak when its decisive (non-ambiguous)
 *     match count clears the recovery threshold.
 */
export const entanglementFingerprintsTable = pgTable(
  "entanglement_fingerprints",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    clientId: text("client_id").notNull(),
    cloakId: text("cloak_id").notNull(),
    docId: text("doc_id").notNull(),
    /** N-gram window size (currently 5 tokens; recorded for forward-compat). */
    windowSize: integer("window_size").notNull(),
    /** Sequential window index inside the source doc. */
    windowIndex: integer("window_index").notNull(),
    /** Hex SHA-256 of the normalised n-gram, first 16 bytes (128 bits). */
    gramHash: text("gram_hash").notNull(),
  },
  (t) => [
    index("ent_fp_hash_idx").on(t.gramHash),
    index("ent_fp_cloak_idx").on(t.cloakId),
    index("ent_fp_client_idx").on(t.clientId),
  ],
);

export type EntanglementFingerprintRow = typeof entanglementFingerprintsTable.$inferSelect;
