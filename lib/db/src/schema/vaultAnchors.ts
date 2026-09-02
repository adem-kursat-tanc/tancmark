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
 * AEGIS v4.1 Step 3 — Vault layer anchor table.
 *
 * One row per (tenant_id, doc_id, version) cloak anchor. Stores the
 * post-quantum (ML-DSA-65) signature over a canonical JSON payload that
 * binds the cloaked document's identity (cloak_id, client_id, doc_id,
 * keyVersion, protectionHash, cascadeRoot, pipelineVersion, issuedAt).
 *
 * Step 3 Bölüm 1 yalnızca **anchor (write) tarafını** kurar; verify
 * endpoint'i Bölüm 2'de gelir. OTS proof slot ileride (`ots_proof` jsonb,
 * şu an null) doldurulur — şema önden hazırlanmıştır ki Vault zinciri
 * tek tablo üzerinden yürür ve Step 4'te ML-KEM hibrit anahtar zarfı
 * için `kem_envelope` slot'u eklenecek.
 *
 * Atomicity: cloak-text endpoint cloaked_documents + cloak_layers (mid)
 * + vault_anchors yazımlarını TEK Drizzle transaction içinde yapar.
 * Vault yazımı başarısız olursa cloak'ın tamamı rollback olur ve istek
 * 5xx döner — imzasız mid manifest tek başına yayılmaz.
 */
export const VAULT_ALGORITHMS = ["ml-dsa-65"] as const;
export type VaultAlgorithm = (typeof VAULT_ALGORITHMS)[number];

export const VAULT_KEY_DERIVATIONS = ["hkdf-v1"] as const;
export type VaultKeyDerivationEnum = (typeof VAULT_KEY_DERIVATIONS)[number];

export const vaultAnchorsTable = pgTable(
  "vault_anchors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Owning tenant. New canonical writes always persist a verified,
     * non-null tenant id. Historical null-tenant rows are retained only as
     * LEGACY_NULL_TENANT_QUARANTINED_READ_ONLY evidence and are never a
     * canonical write/conflict target. Sub-customer `client_id` strings can
     * collide across tenants, so this remains the authoritative isolation
     * column.
     */
    tenantId: integer("tenant_id"),
    /** Sub-customer slug (matches `cloaked_documents.client_id`). */
    clientId: text("client_id").notNull(),
    /** Document identifier. */
    docId: text("doc_id").notNull(),
    /** Opaque cloak handle (joins to `cloaked_documents.cloak_id`). */
    cloakId: text("cloak_id").notNull(),
    /** AEGIS_SECRET version that derived this anchor's keypair. */
    keyVersion: text("key_version").notNull().default("v1"),
    /**
     * Forward-compatible version slot. v1 = ML-DSA-65 only. Step 4 may
     * issue v2 = ML-DSA-65 + ML-KEM-768 hybrid envelope. Composite
     * uniqueness `(tenant_id, doc_id, version)` allows multiple anchors
     * per doc as the algorithm matrix evolves.
     */
    version: integer("version").notNull().default(1),
    /** PQC signature algorithm identifier. */
    algorithm: text("algorithm").$type<VaultAlgorithm>().notNull(),
    /** Key derivation strategy used to produce the keypair seed. */
    keyDerivation: text("key_derivation")
      .$type<VaultKeyDerivationEnum>()
      .notNull()
      .default("hkdf-v1"),
    /** ML-DSA-65 public key (base64). */
    publicKey: text("public_key").notNull(),
    /** ML-DSA-65 signature over `payload_canonical` (base64). */
    signature: text("signature").notNull(),
    /** Canonical JSON string that was signed (key-sorted, UTF-8). */
    payloadCanonical: text("payload_canonical").notNull(),
    /** SHA-256 hex of `payload_canonical` (UTF-8 bytes). */
    payloadDigestSha256: text("payload_digest_sha256").notNull(),
    /** ISO timestamp at which the anchor was signed. */
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    /**
     * OpenTimestamps proof slot — null at anchor time; populated by
     * a future sweeper that submits `payload_digest_sha256` to OTS
     * calendars. Shape mirrors `timestamp_proofs` jsonb payload.
     */
    otsProof: jsonb("ots_proof"),
    /** Free-form anchor metadata (e.g. seed info, hybrid envelope refs). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    // Tenant-scoped canonical uniqueness. The null-tenant index is retained
    // only so historical quarantined rows keep their legacy uniqueness; no
    // product route may target it for insert or update.
    uniqueIndex("vault_anchors_tenant_doc_version_uniq")
      .on(t.tenantId, t.docId, t.version)
      .where(sql`${t.tenantId} IS NOT NULL`),
    uniqueIndex("vault_anchors_admin_doc_version_uniq")
      .on(t.docId, t.version)
      .where(sql`${t.tenantId} IS NULL`),
    index("vault_anchors_cloak_id_idx").on(t.cloakId),
    index("vault_anchors_client_doc_idx").on(t.clientId, t.docId),
    index("vault_anchors_digest_idx").on(t.payloadDigestSha256),
    check(
      "vault_anchors_alg_chk",
      sql`${t.algorithm} IN ('ml-dsa-65')`,
    ),
    check(
      "vault_anchors_keyderiv_chk",
      sql`${t.keyDerivation} IN ('hkdf-v1')`,
    ),
    check("vault_anchors_version_chk", sql`${t.version} >= 1`),
  ],
);

export const selectVaultAnchorSchema = createSelectSchema(vaultAnchorsTable);
export type VaultAnchorRow = z.infer<typeof selectVaultAnchorSchema>;
