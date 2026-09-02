import { createHash } from "node:crypto";
import { db, auditLogsTable, AUDIT_KINDS, type AuditKind, type AuditLog } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { noopSharedStoreAdapter, type SharedStoreAdapter } from "../platform/sharedStore";
import { logger } from "./logger";

export { AUDIT_KINDS, type AuditKind, type AuditLog };

export interface RecordEventInput {
  ip: string;
  route: string;
  kind: AuditKind;
  clientId?: number;
  userId?: string;
  details?: Record<string, unknown>;
}

const ANOMALY_WINDOW_MS = 60_000;
const ANOMALY_REQ_THRESHOLD = 90;
const SHARED_AUDIT_ANOMALY_ENABLED_ENV = "TANCMARK_SHARED_AUDIT_ANOMALY_ENABLED";

const recentRequestsByIp = new Map<string, number[]>();
const anomalyFiredAt = new Map<string, number>();

function sharedAuditAnomalyEnabled(): boolean {
  return process.env[SHARED_AUDIT_ANOMALY_ENABLED_ENV] === "true";
}

function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function auditAnomalyKey(ip: string): string {
  return `audit-anomaly:${stableHash(ip)}`;
}

export function getSharedAuditAnomalyPilotGate() {
  const enabled = sharedAuditAnomalyEnabled();
  return {
    decisionRole: "shared_audit_anomaly_pilot_gate_no_vault_no_confirmed",
    envFlag: SHARED_AUDIT_ANOMALY_ENABLED_ENV,
    defaultEnabled: false,
    enabled,
    adapterPath: "platform.sharedStore",
    adapterRequiredAtBoot: false,
    newExternalServiceRequired: false,
    fallbackWhenDisabled: "legacy_in_memory_audit_anomaly_counters",
    notConfiguredBehavior: "fallback_to_legacy_in_memory",
    appWebSelfServiceDefaultUnchanged: !enabled,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

function trackRequestForAnomalyInMemory(ip: string, ts: number): boolean {
  const since = ts - ANOMALY_WINDOW_MS;
  const arr = recentRequestsByIp.get(ip) ?? [];
  let i = 0;
  while (i < arr.length && arr[i]! < since) i++;
  const trimmed = i > 0 ? arr.slice(i) : arr;
  trimmed.push(ts);
  recentRequestsByIp.set(ip, trimmed);

  if (trimmed.length >= ANOMALY_REQ_THRESHOLD) {
    const lastFired = anomalyFiredAt.get(ip) ?? 0;
    if (ts - lastFired >= ANOMALY_WINDOW_MS) {
      anomalyFiredAt.set(ip, ts);
      return true;
    }
  }
  return false;
}

async function trackRequestForAnomaly(
  ip: string,
  ts: number,
  adapter: SharedStoreAdapter = noopSharedStoreAdapter,
): Promise<boolean> {
  if (!sharedAuditAnomalyEnabled()) return trackRequestForAnomalyInMemory(ip, ts);

  try {
    const result = await adapter.incrementAuditAnomalyCounter({
      key: auditAnomalyKey(ip),
      windowSeconds: Math.ceil(ANOMALY_WINDOW_MS / 1000),
      threshold: ANOMALY_REQ_THRESHOLD,
      timestampEpochMs: ts,
    });

    if (result.status === "not_configured") {
      return trackRequestForAnomalyInMemory(ip, ts);
    }

    return result.ok && result.data?.anomalyDetected === true;
  } catch {
    return trackRequestForAnomalyInMemory(ip, ts);
  }
}

export async function recordEvent(input: RecordEventInput): Promise<AuditLog> {
  // Capture arrival time BEFORE async I/O so anomaly tracking is order-stable
  // even when concurrent inserts resolve out of order.
  const arrivalTs = Date.now();
  const fireAnomaly =
    input.kind === "request" ? await trackRequestForAnomaly(input.ip, arrivalTs) : false;

  const [row] = await db
    .insert(auditLogsTable)
    .values({
      ip: input.ip,
      route: input.route,
      kind: input.kind,
      clientId: input.clientId,
      userId: input.userId,
      details: input.details,
    })
    .returning();

  if (!row) throw new Error("audit insert returned no row");

  if (input.kind !== "request") {
    logger.warn({ audit: row }, `[audit] ${input.kind}`);
  }

  if (fireAnomaly) {
    const [anomaly] = await db
      .insert(auditLogsTable)
      .values({
        ip: input.ip,
        route: input.route,
        kind: "anomaly",
        details: {
          reason: "request_burst",
          windowMs: ANOMALY_WINDOW_MS,
          threshold: ANOMALY_REQ_THRESHOLD,
        },
      })
      .returning();
    if (anomaly) {
      logger.warn({ audit: anomaly }, "[audit] anomaly detected");
    }
  }

  return row;
}

/*
 * Default path:
 * - TANCMARK_SHARED_AUDIT_ANOMALY_ENABLED is absent/false.
 * - audit anomaly counters use the existing in-memory Maps.
 *
 * Pilot path:
 * - TANCMARK_SHARED_AUDIT_ANOMALY_ENABLED=true calls the platform sharedStore
 *   adapter for audit anomaly counters.
 * - Noop/not_configured falls back to legacy in-memory counters.
 *
 * Beacon and dedupe are not changed in this phase.
 * VAULT, confirmed, final, threshold, ownership, pre-seal and core seal/read
 * logic are not touched by this audit anomaly pilot.
 *
 * Phase 3 sentinel strings:
 * - TANCMARK_SHARED_AUDIT_ANOMALY_ENABLED=false
 * - legacy_in_memory_audit_anomaly_counters
 */

export function recordEventFireAndForget(input: RecordEventInput): void {
  recordEvent(input).catch(() => {
    logger.error(redactedAuditPersistenceFailure(input), "[audit] failed to persist event");
  });
}

/** Never serialize database errors, SQL parameters, stack paths, IPs or event details. */
export function redactedAuditPersistenceFailure(input: RecordEventInput): Readonly<{
  failure: "audit_persistence_failed";
  kind: AuditKind;
  route: string;
  clientAttributed: boolean;
}> {
  return Object.freeze({
    failure: "audit_persistence_failed",
    kind: input.kind,
    route: input.route.split("?")[0] ?? "unknown",
    clientAttributed: input.clientId !== undefined,
  });
}

export interface ListOpts {
  limit?: number;
  kind?: AuditKind;
  userId?: string;
  ip?: string;
  clientId?: number;
  sinceMs?: number;
}

export async function listEvents(opts: ListOpts = {}): Promise<AuditLog[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const conditions = [];
  if (opts.kind) conditions.push(eq(auditLogsTable.kind, opts.kind));
  if (opts.userId) conditions.push(eq(auditLogsTable.userId, opts.userId));
  if (opts.ip) conditions.push(eq(auditLogsTable.ip, opts.ip));
  if (opts.clientId !== undefined) conditions.push(eq(auditLogsTable.clientId, opts.clientId));
  if (opts.sinceMs) {
    const cutoff = new Date(Date.now() - opts.sinceMs);
    conditions.push(gte(auditLogsTable.ts, cutoff));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(where)
    .orderBy(desc(auditLogsTable.ts))
    .limit(limit);
  return rows;
}

/**
 * Distinct client identifiers seen in `Linguistic_DNA` audit records, drawn
 * from `details.requestedClientId` (always present) so it captures both
 * api-key-attributed and explicit-body callers. Bounded to avoid pathological
 * fan-out during forensic analysis.
 *
 * AEGIS v4.0.3 — Cross-Tenant Guard: when `scopedToApiClientId` is provided,
 * only audit rows attributed to that API tenant (audit_logs.client_id) are
 * considered. Without scope, candidates fan out across all tenants — kept
 * for admin-token paths only and the route MUST log a warning.
 */
export async function listLinguisticDnaClientIds(
  limit = 200,
  scopedToApiClientId?: number,
): Promise<string[]> {
  const cap = Math.min(Math.max(limit, 1), 1000);
  // AEGIS v4.0.3 — Source UNION. Pre-v4.0.3 the function only mined
  // `Linguistic_DNA` audit (written by /analyze-text). That missed clients
  // who had only been *cloaked* but never analyzed yet — so a brand-new
  // tenant calling /analyze-text would always get an empty candidate list.
  // We now also mine `Cloak_Text` audit (written by /cloak-text), which
  // exposes `details.clientIdStr` for the same purpose.
  //
  // When `scopedToApiClientId` is provided, only audit rows attributed to
  // that API tenant (`audit_logs.client_id`) are considered. Without scope,
  // candidates fan out across all tenants — kept for admin-token paths only
  // and the route MUST log a warning.
  const scopeClause = typeof scopedToApiClientId === "number"
    ? sql`AND client_id = ${scopedToApiClientId}`
    : sql``;
  const rows = await db.execute<{ customer_id: string; last_seen: Date }>(sql`
    SELECT customer_id, MAX(ts) AS last_seen
    FROM (
      SELECT details->>'requestedClientId' AS customer_id, ts
        FROM audit_logs
        WHERE kind = 'Linguistic_DNA' ${scopeClause}
      UNION ALL
      SELECT details->>'clientIdStr' AS customer_id, ts
        FROM audit_logs
        WHERE kind = 'Cloak_Text' ${scopeClause}
    ) src
    WHERE customer_id IS NOT NULL AND customer_id <> '' AND customer_id <> 'undefined'
    GROUP BY customer_id
    ORDER BY MAX(ts) DESC
    LIMIT ${cap}
  `);
  return rows.rows
    .map((r) => r.customer_id)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

export async function stats(): Promise<{ total: number; byKind: Record<string, number> }> {
  const rows = await db
    .select({
      kind: auditLogsTable.kind,
      count: sql<string>`count(*)`,
    })
    .from(auditLogsTable)
    .groupBy(auditLogsTable.kind);

  const byKind: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.count);
    byKind[r.kind] = n;
    total += n;
  }
  return { total, byKind };
}
