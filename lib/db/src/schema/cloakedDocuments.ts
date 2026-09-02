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

/**
 * Persistent registry of cloaked carrier documents. Each row records the
 * client + docId + active key version + canary fact + which layer set was
 * applied at "cloak" time, so a later /scan-cloak or /scan-cloak-all can
 * re-derive the canary signature and confirm a leak.
 *
 * Honeytoken rows for the same carrier doc still live in `honeytokens`
 * (joined via `protection_hash`). We only persist canary metadata here —
 * the canary text itself is recoverable from `(docId, secret)`.
 */
export const cloakedDocumentsTable = pgTable(
  "cloaked_documents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Public customer identifier (`^[a-zA-Z0-9._-]{1,64}$`). */
    clientId: text("client_id").notNull(),
    /** Caller-supplied document identifier (same regex as clientId). */
    docId: text("doc_id").notNull(),
    /** Server-issued opaque cloak handle (HMAC of `clientId|docId|keyVersion`). */
    cloakId: text("cloak_id").notNull(),
    /** AEGIS_SECRET version that produced this row's canary + traces. */
    keyVersion: text("key_version").notNull().default("v1"),
    /** "low" | "medium" | "high" — controls layer set. */
    strength: text("strength").notNull(),
    /** Detected sensitive topic ("none", "saglik", "secim", "hukuk", …). */
    sensitiveTopic: text("sensitive_topic").notNull().default("none"),
    /** Canary "term" (single Turkish-looking pseudo-word) for paraphrase scan. */
    canaryTerm: text("canary_term").notNull(),
    /** Full canary signature (HMAC of docId+secret). */
    canarySignature: text("canary_signature").notNull(),
    /** Hash of the protected carrier text — joins to `honeytokens.protection_hash`. */
    protectionHash: text("protection_hash"),
    /** Layer flags actually applied (canary, clientTrace, linguisticDna, honeytoken, trainingNoise, screenWatermark). */
    layers: jsonb("layers").$type<Record<string, boolean>>().notNull(),
    /**
     * AEGIS v4.0 Faz 2 — Cascade Hash chain.
     *
     * Şekil (Patch v4.0.1+): `{ keyDerivation: "global"|"hkdf-v1",
     * nodes: [{ index, hash, normalized }] }`. Eski satırlar (Faz 2 ilk drop)
     * plain `[{...}]` array tutar — verifier `normalizeStoredCascadeChain`
     * ile her iki şekli kabul eder; legacy zincirler `keyDerivation="global"`
     * kabul edilir. Null = legacy / cascade öncesi cloak (skip).
     */
    cascadeChain: jsonb("cascade_chain").$type<
      | { keyDerivation: "global" | "hkdf-v1"; nodes: Array<{ index: number; hash: string; normalized: string }> }
      | Array<{ index: number; hash: string; normalized: string }>
    >(),
    /**
     * AEGIS v4.0 Faz 4 — Cloak pipeline sürüm etiketi.
     * "v3" = Faz 1-3 (semantic öncesi). "v4" = Faz 4 semantic-positional dahil.
     * Yeni cloak'lar daima "v4" yazar; eski satırlar default "v3" altında kalır.
     */
    pipelineVersion: text("pipeline_version").notNull().default("v3"),
    /**
     * AEGIS v4.0 Faz 4 — Semantic Positional Watermarking planı.
     * `SemanticPositionalPlan` (lib/aegis-core/src/semantic/types.ts).
     * Null = embed atlandı (sensitive_topic) veya pipeline_version="v3".
     */
    semanticPositionalPlan: jsonb("semantic_positional_plan").$type<unknown>(),
  },
  (t) => [
    index("cloaked_docs_created_idx").on(t.createdAt),
    index("cloaked_docs_client_idx").on(t.clientId),
    index("cloaked_docs_doc_idx").on(t.docId),
    uniqueIndex("cloaked_docs_cloak_id_uniq").on(t.cloakId),
    // AEGIS v4.0.3 — Composite uniqueness: at most one live cloak per
    // (clientId, docId). Re-cloak overwrites in place via upsert (route
    // uses onConflictDoUpdate on this target).
    uniqueIndex("cloaked_docs_client_doc_uniq").on(t.clientId, t.docId),
    index("cloaked_docs_canary_term_idx").on(t.canaryTerm),
    index("cloaked_docs_protection_hash_idx").on(t.protectionHash),
  ],
);

export const selectCloakedDocumentSchema = createSelectSchema(cloakedDocumentsTable);
export type CloakedDocumentRow = z.infer<typeof selectCloakedDocumentSchema>;

export const CLOAK_STRENGTHS = ["low", "medium", "high"] as const;
export type CloakStrength = (typeof CLOAK_STRENGTHS)[number];

export const SENSITIVE_TOPICS = [
  "none",
  "saglik",
  "afet",
  "secim",
  "hukuk",
  "yatirim",
  "savas",
  "acil",
] as const;
export type SensitiveTopic = (typeof SENSITIVE_TOPICS)[number];
