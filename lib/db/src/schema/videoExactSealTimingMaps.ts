import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const VIDEO_EXACT_MAP_REGISTRY_STATUSES = [
  "ACTIVE",
  "REVOKED",
  "SUPERSEDED",
] as const;
export type VideoExactMapRegistryStatus =
  (typeof VIDEO_EXACT_MAP_REGISTRY_STATUSES)[number];

/**
 * Private server-side registry for SIGNED_EXACT_SEAL_TIMING_MAP_V2.
 * The exact frame addresses must never be returned by a public API or placed
 * in media. Tenant/account/record scoping is mandatory on every lookup.
 */
export const videoExactSealTimingMapsTable = pgTable(
  "video_exact_seal_timing_maps",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    tenantId: text("tenant_id").notNull(),
    accountId: text("account_id").notNull(),
    registryRecordId: text("registry_record_id").notNull(),
    registryRevision: integer("registry_revision").notNull().default(1),
    keyId: text("key_id").notNull(),
    expectedEncoderReceiptSha256: text("expected_encoder_receipt_sha256")
      .notNull(),
    mapDigestSha256: text("map_digest_sha256").notNull(),
    status: text("status")
      .$type<VideoExactMapRegistryStatus>()
      .notNull()
      .default("ACTIVE"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    supersededByRecordId: text("superseded_by_record_id"),
    /** Private signed envelope including exact A/B frame addresses. */
    envelope: jsonb("envelope").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    uniqueIndex("video_exact_map_tenant_account_record_revision_uniq").on(
      t.tenantId,
      t.accountId,
      t.registryRecordId,
      t.registryRevision,
    ),
    index("video_exact_map_private_lookup_idx").on(
      t.tenantId,
      t.accountId,
      t.registryRecordId,
    ),
    index("video_exact_map_digest_idx").on(t.mapDigestSha256),
    check(
      "video_exact_map_status_chk",
      sql`${t.status} IN ('ACTIVE', 'REVOKED', 'SUPERSEDED')`,
    ),
    check(
      "video_exact_map_revision_chk",
      sql`${t.registryRevision} >= 1`,
    ),
    check(
      "video_exact_map_receipt_sha_chk",
      sql`${t.expectedEncoderReceiptSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "video_exact_map_digest_sha_chk",
      sql`${t.mapDigestSha256} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const selectVideoExactSealTimingMapSchema = createSelectSchema(
  videoExactSealTimingMapsTable,
);
export type VideoExactSealTimingMapRow = z.infer<
  typeof selectVideoExactSealTimingMapSchema
>;
