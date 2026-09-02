import {
  pgTable,
  bigserial,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Bitcoin/OpenTimestamps proof of existence for AEGIS outputs such as
 * cloaked/protected payloads, vault anchor payloads, and Secure Room
 * evidence package hashes. We store the SHA-256 digest plus the raw OTS
 * calendar receipts.
 *
 * Lifecycle:
 *   1. submitted    — digest POSTed to ≥1 OTS calendar server, raw
 *                     receipt(s) stored in `proofs` (kind: "pending"),
 *                     `submittedAt` set.
 *   2. anchored     — calendar upgraded the receipt with a Bitcoin
 *                     attestation. We re-fetch via `/timestamp/{hex}`
 *                     and store the upgraded proof under kind: "btc".
 *                     `btcBlock` is filled when known.
 *
 * Why we store opaque receipt bytes rather than parsing them: OTS
 * proofs are merkle paths into Bitcoin and the canonical verifier is
 * `ots verify`. Anyone with the digest + receipt bytes can verify
 * independently — we just persist the legal evidence.
 */
export const timestampProofsTable = pgTable(
  "timestamp_proofs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** "cloak" | "protect" — which pipeline produced the payload. */
    kind: text("kind").notNull(),
    /**
     * Foreign reference id. For "cloak", this is `cloakId`. For
     * "protect", this is `protectionHash` of the protected text.
     */
    referenceId: text("reference_id").notNull(),
    /** Hex SHA-256 of the protected payload that was anchored. */
    payloadSha256: text("payload_sha256").notNull(),
    /** ISO timestamp when we first POSTed the digest to calendars. */
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Per-calendar receipt bundle:
     * `[{ calendar: "https://a.pool…", status: "pending"|"btc"|"error",
     *    proofB64: "…", error?: "…", fetchedAt: "ISO" }]`
     */
    proofs: jsonb("proofs").$type<
      Array<{
        calendar: string;
        status: "pending" | "btc" | "error";
        proofB64?: string;
        error?: string;
        fetchedAt: string;
      }>
    >().notNull(),
    /** True once at least one calendar returned a BTC attestation. */
    btcAnchored: boolean("btc_anchored").notNull().default(false),
    /** Bitcoin block height the proof anchors into (when known). */
    btcBlock: integer("btc_block"),
    /** Last time we polled a calendar for an upgrade. */
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  },
  (t) => [
    index("ts_proofs_kind_ref_idx").on(t.kind, t.referenceId),
    index("ts_proofs_digest_idx").on(t.payloadSha256),
    uniqueIndex("ts_proofs_ref_uniq").on(t.kind, t.referenceId),
    index("ts_proofs_anchored_idx").on(t.btcAnchored),
  ],
);

export type TimestampProofRow = typeof timestampProofsTable.$inferSelect;
