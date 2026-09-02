import {
  pgTable,
  bigserial,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * AEGIS v4.1 Step 2 — Decoy emission ledger.
 *
 * Each row records ONE individualized delivery of a (clientId, docId)
 * carrier to a specific viewerId. The cryptographic `emission_token`
 * (HMAC-SHA256 of tenant secret + clientId + docId + viewerId + ts + nonce,
 * base64-encoded) is embedded into the deliveryText as Unicode Tag
 * marker blocks (U+E0000-U+E007F) and is the canonical lookup key during
 * analyze-text decoy verification. Any token observed in suspect text MUST
 * resolve to a row here — sahte tag char chains decode etse bile DB'de
 * yoksa eşleşme olmaz (cross-tenant frame koruması).
 *
 * Forward-only: emit-text yalnızca `cloaked_documents.pipeline_version='v4'`
 * için çalışır; legacy v3 satırları için 400 döner. Bu kayıt katmanı eski
 * cloak'lara retrofit edilmez.
 *
 * Atomicity: emit-text endpoint deliveryText'i DÖNDÜRMEDEN ÖNCE bu satırı
 * yazar. Insert başarısız olursa endpoint 5xx döner — kayıt olmadan metin
 * sokağa salınmaz. (Step 1'in cloak_layers fire-and-forget pattern'i burada
 * KABUL EDİLMEZ — kanıtsız emission affedilemez.)
 */
export const decoyEmissionsTable = pgTable(
  "decoy_emissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Owning tenant (FK to `clients.id`). REQUIRED for tenant-isolated
     * lookups. Sub-customer `client_id` strings can collide across
     * tenants; this column is the authoritative isolation boundary.
     * Nullable only for admin-token (system) emissions where no tenant
     * is bound — admin emissions are visible to all tenants.
     */
    tenantId: integer("tenant_id"),
    /** Public customer identifier (matches `cloaked_documents.client_id`). */
    clientId: text("client_id").notNull(),
    /** Document identifier (matches `cloaked_documents.doc_id`). */
    docId: text("doc_id").notNull(),
    /** Caller-supplied opaque viewer identifier (max 256 chars). */
    viewerId: text("viewer_id").notNull(),
    /**
     * Base64-encoded HMAC-SHA256 (44 chars) — global unique. Embedded
     * into deliveryText as Unicode Tag markers; analyze-text decodes these
     * back and joins on this column. CHECK enforces length=44.
     */
    emissionToken: text("emission_token").notNull(),
    /** Number of marker blocks distributed in deliveryText. CHECK >= 1. */
    markerCount: integer("marker_count").notNull(),
    /**
     * Char offsets (in deliveryText) where each marker block was inserted.
     * Used for audit/debug only — verify does NOT consult positions; tokens
     * are reconstructed from any block found in the suspect text.
     */
    markerPositions: jsonb("marker_positions").$type<number[]>().notNull(),
    /** Optional viewer metadata (session id, ipHash, etc.). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    // Cryptographic uniqueness — token is the analyze-text join key.
    uniqueIndex("decoy_emissions_token_uniq").on(t.emissionToken),
    // Tenant + doc + viewer fan-out (same viewer can take multiple
    // emissions over time; non-unique).
    index("decoy_emissions_client_doc_viewer_idx").on(
      t.clientId,
      t.docId,
      t.viewerId,
    ),
    // Tenant-scoped time-series queries.
    index("decoy_emissions_client_created_idx").on(t.clientId, t.createdAt),
    // Tenant-isolated scan path (analyze-text decoy lookup).
    index("decoy_emissions_tenant_token_idx").on(t.tenantId, t.emissionToken),
    // Token format guard — base64 of 32 bytes is exactly 44 chars (one '=' pad).
    check(
      "decoy_emissions_token_len_check",
      sql`length(${t.emissionToken}) = 44`,
    ),
    check(
      "decoy_emissions_marker_count_check",
      sql`${t.markerCount} >= 1`,
    ),
  ],
);

export const selectDecoyEmissionSchema = createSelectSchema(decoyEmissionsTable);
export type DecoyEmissionRow = z.infer<typeof selectDecoyEmissionSchema>;
