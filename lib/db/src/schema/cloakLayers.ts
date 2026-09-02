import {
  pgTable,
  bigserial,
  text,
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
 * AEGIS v4.1 — Three-Tier Defense manifest table.
 *
 * One row per (client_id, doc_id, tier). Each row stores the tier-specific
 * manifest blob in `layer_data`. Step 1 wires the existing protection stack
 * as tier="mid" without changing legacy reads/writes — `cloaked_documents`
 * remains the authoritative store for mid-tier payloads (cascade chain,
 * semantic positional plan, layer flags). Steps 2 and 3 will populate
 * tier="decoy" and tier="vault" rows with their own payloads here.
 *
 * Lifecycle / uniqueness contract:
 *   - Canonical uniqueness is `(client_id, doc_id, tier)` — matches the
 *     v4.0.3 invariant on `cloaked_documents` (one live cloak per
 *     (client_id, doc_id)). Re-cloak with rotated keyVersion still maps to
 *     the same logical document, so the cloak_layers row is upserted in
 *     place even when `cloak_id` changes.
 *   - `cloak_id` is a non-unique secondary index for FK-style lookups
 *     (timestamp_proofs / entanglement_fingerprints already key on it).
 *   - `tier` is constrained to LAYER_TIERS via a DB-level CHECK to keep
 *     downstream verifiers from observing invalid tier values.
 */
export const LAYER_TIERS = ["decoy", "mid", "vault"] as const;
export type LayerTierEnum = (typeof LAYER_TIERS)[number];

export const cloakLayersTable = pgTable(
  "cloak_layers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Opaque cloak handle — joins to `cloaked_documents.cloak_id`. */
    cloakId: text("cloak_id").notNull(),
    /** Public customer identifier. */
    clientId: text("client_id").notNull(),
    /** Caller-supplied document identifier. */
    docId: text("doc_id").notNull(),
    /** "decoy" | "mid" | "vault" — see LAYER_TIERS. */
    tier: text("tier").notNull(),
    /** Tier-specific manifest blob. Contract per tier in `lib/aegis-core/src/layers/`. */
    layerData: jsonb("layer_data").$type<Record<string, unknown>>().notNull(),
    /**
     * Faz 5 Step 5.3 — Geometric / vault metadata blob (nullable, opt-in).
     *
     * Contract (T5 will populate during /cloak-image):
     *   {
     *     stepVersion: "5.3",
     *     vaultRect:   { x, y, w, h },
     *     compactId:   <hex>,                        // V1 payload (32 bytes)
     *     pHash:       <hex>,                        // V3 integrity (8 bytes)
     *     markers: {
     *       outer: [{ corner, x, y, markerId }, …], // 4
     *       inner: [{ corner, x, y, markerId }, …], // 4
     *       cloakId: <string>                        // domain-separator used at stamp time
     *     },
     *     imageDims:   { width, height }
     *   }
     *
     * Nullable + default null preserves all existing rows and existing tier
     * write paths — only the Step 5.3 visual vault path writes here.
     * T6 /analyze-image reads this to know expected vault rect + compactId
     * BEFORE running affineFit recovery.
     */
    vaultMetadata: jsonb("vault_metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    // Canonical uniqueness: one row per (client, doc, tier). Re-cloak upserts
    // even if keyVersion (and therefore cloakId) rotates.
    uniqueIndex("cloak_layers_client_doc_tier_uniq").on(t.clientId, t.docId, t.tier),
    // Secondary lookup: by cloakId for FK-style joins.
    index("cloak_layers_cloak_id_idx").on(t.cloakId, t.tier),
    index("cloak_layers_created_idx").on(t.createdAt),
    // Tier integrity — reject writes outside the known set so verifiers
    // never see an unknown tier.
    check("cloak_layers_tier_check", sql`${t.tier} IN ('decoy', 'mid', 'vault')`),
  ],
);

export const selectCloakLayerSchema = createSelectSchema(cloakLayersTable);
export type CloakLayerRow = z.infer<typeof selectCloakLayerSchema>;
