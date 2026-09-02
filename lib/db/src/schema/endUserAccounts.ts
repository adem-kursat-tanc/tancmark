import { pgTable, text, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Verified end-user identity, deliberately separate from `clients`.
 *
 * `clients` remains the API tenant boundary. This table is the minimum
 * lifecycle boundary needed to close/reopen a human account without guessing
 * from a tenant slug or an e-mail address. The provider subject is stored only
 * as a keyed, provider-scoped HMAC; raw identity credentials do not belong
 * in the TancMark evidence database.
 */
export const END_USER_ACCOUNT_STATUSES = ["active", "closed"] as const;
export type EndUserAccountStatus = (typeof END_USER_ACCOUNT_STATUSES)[number];

export const endUserAccountsTable = pgTable(
  "end_user_accounts",
  {
    /** Opaque application-generated identifier; never derive it from e-mail. */
    id: text("id").primaryKey(),
    /** Identity-provider namespace, for example a configured OIDC issuer. */
    identityProvider: text("identity_provider").notNull(),
    /** HMAC-SHA-256 of the provider's immutable verified subject. */
    identitySubjectHmac: text("identity_subject_hmac").notNull(),
    /** Version of the server-side identity HMAC key; raw subject is never stored. */
    identitySubjectHmacKeyVersion: text("identity_subject_hmac_key_version").notNull(),
    status: text("status").$type<EndUserAccountStatus>().notNull().default("active"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("end_user_accounts_verified_identity_uniq").on(
      t.identityProvider,
      t.identitySubjectHmac,
    ),
    index("end_user_accounts_status_idx").on(t.status),
    check("end_user_accounts_status_chk", sql`${t.status} IN ('active', 'closed')`),
  ],
);

export type EndUserAccount = typeof endUserAccountsTable.$inferSelect;
