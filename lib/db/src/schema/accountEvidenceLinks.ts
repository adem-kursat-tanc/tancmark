import { pgTable, bigserial, text, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { endUserAccountsTable } from "./endUserAccounts";

/**
 * The only authoritative association between a verified end-user and an
 * evidence row. `sourceTable` + `sourceRecordId` make later deletion planning
 * auditable without inferring ownership from clientId, tenant, or e-mail.
 *
 * This foundation intentionally does not delete anything. A later deletion
 * transaction must enumerate all supported evidence, validate the complete
 * link set, and fail closed when a row cannot be linked.
 */
export const ACCOUNT_EVIDENCE_KINDS = [
  "api_key", "audit_log",
  "aegis_dna_record",
  "aegis_test_history", "aegis_improvement_suggestion",
  "cloaked_document",
  "cloak_layer",
  "vault_anchor",
  "timestamp_proof",
  "honeytoken",
  "beacon", "beacon_ping",
  "radar_hit",
  "decoy_emission",
  "entanglement_fingerprint", "forensic_note", "learning_record",
  "discovery_job", "discovery_media_asset", "discovery_provider_pricing", "discovery_api_call", "discovery_processing_metric", "discovery_result", "discovery_secure_room_handoff",
  "discovery_search_dna_profile",
  "discovery_search_dna_record",
  "discovery_query_plan", "discovery_query_outcome", "discovery_cost_quote", "discovery_candidate_verification_plan", "discovery_cost_calibration_record", "discovery_pricing_learning_profile", "discovery_candidate_verification_run", "discovery_candidate_verification_result", "discovery_candidate_verification_policy_log",
] as const;
export type AccountEvidenceKind = (typeof ACCOUNT_EVIDENCE_KINDS)[number];

export const accountEvidenceLinksTable = pgTable(
  "account_evidence_links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountId: text("account_id")
      .notNull()
      // Deliberately restrictive: deleting an account must not erase the
      // inventory links before the future deletion transaction proves source
      // evidence coverage and removes it deliberately.
      .references(() => endUserAccountsTable.id),
    evidenceKind: text("evidence_kind").$type<AccountEvidenceKind>().notNull(),
    sourceTable: text("source_table").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_evidence_link_source_uniq").on(t.sourceTable, t.sourceRecordId),
    uniqueIndex("account_evidence_link_account_source_uniq").on(
      t.accountId,
      t.sourceTable,
      t.sourceRecordId,
    ),
    index("account_evidence_link_account_idx").on(t.accountId),
    index("account_evidence_link_kind_idx").on(t.evidenceKind),
    check(
      "account_evidence_link_kind_chk",
      sql`${t.evidenceKind} IN ('api_key', 'audit_log', 'aegis_dna_record', 'aegis_test_history', 'aegis_improvement_suggestion', 'cloaked_document', 'cloak_layer', 'vault_anchor', 'timestamp_proof', 'honeytoken', 'beacon', 'beacon_ping', 'radar_hit', 'decoy_emission', 'entanglement_fingerprint', 'forensic_note', 'learning_record', 'discovery_job', 'discovery_media_asset', 'discovery_provider_pricing', 'discovery_api_call', 'discovery_processing_metric', 'discovery_result', 'discovery_secure_room_handoff', 'discovery_search_dna_profile', 'discovery_search_dna_record', 'discovery_query_plan', 'discovery_query_outcome', 'discovery_cost_quote', 'discovery_candidate_verification_plan', 'discovery_cost_calibration_record', 'discovery_pricing_learning_profile', 'discovery_candidate_verification_run', 'discovery_candidate_verification_result', 'discovery_candidate_verification_policy_log')`,
    ),
  ],
);

export type AccountEvidenceLink = typeof accountEvidenceLinksTable.$inferSelect;
