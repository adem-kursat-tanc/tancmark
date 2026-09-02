import {
  pgTable,
  bigserial,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const AUDIT_KINDS = [
  "request",
  "auth_failed",
  "rate_limit_exceeded",
  "canary_hit",
  "canary_scan",
  "anomaly",
  "Linguistic_DNA",
  "Homoglyph_Layer",
  "ZeroWidth_Layer",
  "forensic_scan",
  "Report_Generated",
  "Bot_Trap_Served",
  "Bot_Trap_Triggered",
  "Cloak_Text",
  "Cloak_Scan",
  "Cloak_Report",
  "Radar_Scan",
  "Radar_Hit",
  "Timestamp_Submit",
  "Timestamp_Verify",
  "Entanglement_Scan",
  "Beacon_Embedded",
  "Content_Distribution_Detected",
  "Breach_Signal",
  "ChannelIntegrityProfile_Computed",
  "Semantic_Mark_Embedded",
  "Semantic_Mark_Verified",
  "Timestamp_Anchored",
  "Timestamp_Sweep_Run",
  "Layer_Mid_Applied",
  "Decoy_Emitted",
  "Decoy_Matched",
  "Decoy_Stripped",
  "Decoy_DocMismatch",
  "Vault_Anchored",
  "Vault_Verified",
  "Vault_Ots_Submitted",
  "Vault_Ots_Anchored",
  "Image_Ocr_Performed",
  "Image_Analyzed",
  "Visual_L1_Embedded",
  "Visual_L1_Detected",
  "Visual_L2_Embedded",
  "Visual_L2_Detected",
  "Visual_L3_Embedded",
  "Visual_L3_Detected",
  "Visual_Vault_Confirmed",
  "Visual_Vault_Embedded",
  "Visual_Sync_Markers_Stamped",
  "Visual_Sync_Markers_Detected",
  "Visual_Vault_Verdict",
  // Faz 5 Step 5.7 (forensic + legal armor)
  "Ownership_Declaration_Recorded",
  "Exif_Metadata_Extracted",
  // Faz 5 Step 5.8-A.2 (RS(8,4) distributed vault armor)
  "Visual_Vault_Stripes_Embedded",
  "Visual_Vault_Stripes_Recovered",
  "Visual_Vault_Stripes_Verified",
  "Secure_Room_Event",
  "Learning_Memory",
] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip").notNull(),
    route: text("route").notNull(),
    kind: text("kind").$type<AuditKind>().notNull(),
    clientId: integer("client_id").references(() => clientsTable.id, {
      onDelete: "set null",
    }),
    userId: text("user_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("audit_logs_ts_idx").on(t.ts),
    index("audit_logs_kind_idx").on(t.kind),
    index("audit_logs_ip_idx").on(t.ip),
    index("audit_logs_client_id_idx").on(t.clientId),
  ],
);

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  ts: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
