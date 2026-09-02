import {
  pgTable,
  bigserial,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Forensic Beacon (opt-in). Each cloak that opts in gets a unique
 * beacon URL embedded in its protected text (transparent 1×1 GIF
 * via markdown / HTML). When third-party browsers render the leaked
 * content, the GIF fires and we log a `beacon_pings` row.
 *
 * KVKK / GDPR posture:
 *   - opt-in per cloak (default OFF)
 *   - we NEVER store raw IP / UA — only HMAC-hashed truncated digests
 *   - Referer is reduced to host (no path / query / fragment)
 *   - IP/UA hashes rotate weekly (use a dated salt) so they cannot be
 *     trivially correlated across long windows
 */
export const cloakBeaconsTable = pgTable(
  "cloak_beacons",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Public, opaque beacon identifier (URL-safe, 22 chars). */
    beaconId: text("beacon_id").notNull(),
    clientId: text("client_id").notNull(),
    cloakId: text("cloak_id").notNull(),
    docId: text("doc_id").notNull(),
    /** Operator can disable a beacon without deleting the row. */
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [
    uniqueIndex("cloak_beacons_id_uniq").on(t.beaconId),
    index("cloak_beacons_cloak_idx").on(t.cloakId),
    index("cloak_beacons_client_idx").on(t.clientId),
  ],
);

export const beaconPingsTable = pgTable(
  "beacon_pings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    beaconId: text("beacon_id").notNull(),
    /** Host part of the Referer header only (e.g. "scraped-site.com"). */
    refererHost: text("referer_host"),
    /** HMAC truncated to 16 hex chars; cannot be reversed to raw IP. */
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
    /** Raw Origin header host, when distinct from Referer. */
    originHost: text("origin_host"),
  },
  (t) => [
    index("beacon_pings_beacon_idx").on(t.beaconId),
    index("beacon_pings_referer_idx").on(t.refererHost),
    index("beacon_pings_ts_idx").on(t.ts),
  ],
);

export type CloakBeaconRow = typeof cloakBeaconsTable.$inferSelect;
export type BeaconPingRow = typeof beaconPingsTable.$inferSelect;
