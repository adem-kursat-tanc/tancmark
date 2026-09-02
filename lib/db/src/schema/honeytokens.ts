import {
  pgTable,
  bigserial,
  text,
  timestamp,
  boolean,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Honeytokens served to suspected bots. Each row records ONE fake value
 * that was injected into a piece of text; if the same `fake_value` later
 * shows up in a suspect document we have positive proof of exfiltration.
 *
 * NOTE: We never store the plaintext of the original value — only an
 * HMAC-derived hash — to avoid making the trap a PII liability.
 */
export const honeytokensTable = pgTable(
  "honeytokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Public customer identifier (a-z, A-Z, 0-9, '.', '-', '_'; ≤64).
     * Stored as text to avoid silent NaN coercion when the API receives
     * non-numeric IDs like "cust-1000" or "agency-news-001".
     */
    clientId: text("client_id").notNull(),
    /**
     * Which AEGIS_SECRET version produced this row's HMAC. Lets the
     * server rotate the master secret without invalidating older traps.
     */
    keyVersion: text("key_version").notNull().default("v1"),
    kind: text("kind").notNull(),
    fakeValue: text("fake_value").notNull(),
    originalValueHash: text("original_value_hash").notNull(),
    sourceIp: text("source_ip"),
    userAgent: text("user_agent"),
    botScore: doublePrecision("bot_score"),
    botVerdict: text("bot_verdict"),
    botSignals: text("bot_signals"),
    /**
     * Optional `protectionHash` of the carrier document this trap was
     * embedded into. Used by the Bot-Trap Pulse "Otonom Durum" panel to
     * report per-article trap density.
     */
    protectionHash: text("protection_hash"),
    used: boolean("used").notNull().default(false),
    detectedAt: timestamp("detected_at", { withTimezone: true }),
  },
  (t) => [
    index("honeytokens_created_idx").on(t.createdAt),
    index("honeytokens_fake_value_idx").on(t.fakeValue),
    index("honeytokens_client_idx").on(t.clientId),
    index("honeytokens_used_idx").on(t.used),
    index("honeytokens_protection_hash_idx").on(t.protectionHash),
  ],
);

export const selectHoneytokenSchema = createSelectSchema(honeytokensTable);

export const honeytokenKindSchema = z.enum([
  "email",
  "phone",
  "amount",
  "percent",
  "date",
  "org",
  "jitter",
]);

export type HoneytokenRow = z.infer<typeof selectHoneytokenSchema>;
