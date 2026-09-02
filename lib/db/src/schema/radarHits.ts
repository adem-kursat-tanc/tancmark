import {
  pgTable,
  bigserial,
  text,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Canary Radar hits — every time a public-web scan finds one of our
 * honeytoken `fakeValue`s on a remote URL, we record one row here.
 *
 * Uniqueness on (source, url, matched_value) so re-scanning the same
 * page doesn't keep producing duplicates. The `status` field lets a
 * human operator review hits and mark them confirmed / false-positive.
 */
export const radarHitsTable = pgTable(
  "radar_hits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Customer the leaked honeytoken belongs to. **NULL when the matched
     * `fakeValue` is shared across ≥2 clients** (false-accusation guard) —
     * UI must surface `candidateClientIds` instead and never single out one
     * client for ambiguous evidence.
     */
    clientId: text("client_id"),
    /**
     * When `clientId IS NULL`, this lists the candidate clients that all
     * carry the same fakeValue. Operators can decide manually.
     */
    candidateClientIds: jsonb("candidate_client_ids").$type<string[]>(),
    /** Cloaked carrier doc the honeytoken was injected into (if known). */
    docId: text("doc_id"),
    cloakId: text("cloak_id"),
    /** Adapter that produced the hit: "google_cse" | "manual" | … */
    source: text("source").notNull(),
    /** Public URL where the leaked value was found. */
    url: text("url").notNull(),
    title: text("title"),
    snippet: text("snippet"),
    /** Exact fakeValue (honeytoken row) that matched. */
    matchedValue: text("matched_value").notNull(),
    matchedKind: text("matched_kind").notNull(),
    /**
     * "high" = non-jitter, non-shared honeytoken (decisive).
     * "medium" = pattern hit but the value is also present for ≥2
     *            clients, so attribution is ambiguous (false-accusation
     *            guard). UI should surface but not auto-attribute.
     */
    confidence: text("confidence").notNull(),
    status: text("status").notNull().default("new"),
  },
  (t) => [
    index("radar_hits_created_idx").on(t.createdAt),
    index("radar_hits_client_idx").on(t.clientId),
    index("radar_hits_status_idx").on(t.status),
    uniqueIndex("radar_hits_uniq").on(t.source, t.url, t.matchedValue),
  ],
);

export const selectRadarHitSchema = createSelectSchema(radarHitsTable);
export type RadarHitRow = z.infer<typeof selectRadarHitSchema>;

export const RADAR_HIT_STATUSES = ["new", "reviewed", "confirmed", "false_positive"] as const;
export type RadarHitStatus = (typeof RADAR_HIT_STATUSES)[number];

export const RADAR_HIT_CONFIDENCES = ["high", "medium"] as const;
export type RadarHitConfidence = (typeof RADAR_HIT_CONFIDENCES)[number];
