import { pool, db, timestampProofsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { recordEventFireAndForget } from "./auditStore";
import { upgradeOneRow } from "./timestampUpgrade";

/**
 * AEGIS v4.0.4 — OpenTimestamps Sweeper
 *
 * Periodically polls OTS calendar servers for `pending` receipts that have
 * matured (≥ 6 hours since submission) and re-fetches `/timestamp/{hex}` to
 * detect Bitcoin anchor confirmation. Multi-instance safe via PostgreSQL
 * `pg_try_advisory_lock` (a single fixed bigint key); only one process per
 * cluster runs a tick at a time. The lock is held on a dedicated pooled
 * client, released in `finally`, and additionally auto-released by Postgres
 * if the connection drops (process crash / network partition).
 *
 * Design notes:
 *   - Saf Node + setInterval + advisory_lock — yeni paket eklenmedi (mevcut
 *     altyapı bütünlüğüyle tutarlı: OTS protokolü zaten elde implement edildi).
 *   - Per-row exception isolation: tek kayıt fail olursa diğerleri etkilenmez.
 *   - `last_checked_at` her zaman güncellenir (success veya error) — sonsuz
 *     retry'a düşmemek için.
 *   - `Timestamp_Anchored` audit idempotency: `upgradeOneRow` sadece
 *     `wasAnchored=false → anchored=true` geçişinde audit yazar; sweeper
 *     query'si zaten `btc_anchored = false` filtreliyor.
 */

const DEFAULT_LOCK_KEY = 0xae6157een; // "AEGIS-TEE" mnemonic, 32-bit fits int8
const DEFAULT_INTERVAL_MIN = 15;
const DEFAULT_BATCH_LIMIT = 50;
const MATURITY_HOURS = 6;
const RECHECK_HOURS = 1;

export interface SweeperOptions {
  /** Override advisory lock key (tests use a per-test key for isolation). */
  lockKey?: bigint;
  /** Override max rows per tick. */
  batchLimit?: number;
  /** Inject custom fetch (tests). */
  fetchImpl?: typeof fetch;
  /** Per-calendar HTTP timeout (ms). */
  timeoutMs?: number;
  /** Override "mature" threshold (hours). Tests use small values. */
  maturityHours?: number;
  /** Override "recheck cooldown" (hours). Tests bypass with 0. */
  recheckHours?: number;
  /**
   * Test-only filter: only consider rows whose `reference_id` begins with
   * this prefix. Lets smoke tests isolate themselves from pre-existing
   * pending production rows in the shared dev DB. Should NEVER be set in
   * production code paths.
   */
  referenceIdPrefix?: string;
}

export interface SweepRunSummary {
  lockAcquired: boolean;
  candidatesFound: number;
  upgradedCount: number; // newly anchored
  errorsCount: number;
  durationMs: number;
}

/**
 * Run a single sweep tick. Returns a summary suitable for logs/audit/tests.
 * Always emits a `Timestamp_Sweep_Run` audit, including when the lock could
 * not be acquired (so concurrent instance behaviour is observable).
 */
export async function runSweepOnce(opts: SweeperOptions = {}): Promise<SweepRunSummary> {
  const lockKey = opts.lockKey ?? DEFAULT_LOCK_KEY;
  const batchLimit = opts.batchLimit ?? DEFAULT_BATCH_LIMIT;
  const maturityHours = opts.maturityHours ?? MATURITY_HOURS;
  const recheckHours = opts.recheckHours ?? RECHECK_HOURS;
  const t0 = Date.now();

  const client = await pool.connect();
  let lockAcquired = false;
  let candidatesFound = 0;
  let upgradedCount = 0;
  let errorsCount = 0;
  try {
    const lockRes = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
      [lockKey.toString()],
    );
    lockAcquired = lockRes.rows[0]?.acquired === true;
    if (!lockAcquired) {
      logger.info({ lockKey: lockKey.toString() }, "[ots-sweeper] lock not acquired, skipping tick");
      return finalize(t0, { lockAcquired, candidatesFound, upgradedCount, errorsCount });
    }

    // Fetch matured candidate rows. Use the main `db` (pool) since the lock
    // already serialises us; per-row UPDATEs do not need the locked client.
    const prefixFilter = opts.referenceIdPrefix
      ? sql`AND reference_id LIKE ${opts.referenceIdPrefix + "%"}`
      : sql``;
    const rows = await db.execute<{
      id: number;
      kind: string;
      reference_id: string;
      payload_sha256: string;
      submitted_at: Date;
      proofs: unknown;
      btc_anchored: boolean;
      btc_block: number | null;
      last_checked_at: Date | null;
    }>(sql`
      SELECT id, kind, reference_id, payload_sha256, submitted_at,
             proofs, btc_anchored, btc_block, last_checked_at
      FROM ${timestampProofsTable}
      WHERE btc_anchored = false
        AND submitted_at < NOW() - (${maturityHours}::int * INTERVAL '1 hour')
        AND (last_checked_at IS NULL
             OR last_checked_at < NOW() - (${recheckHours}::int * INTERVAL '1 hour'))
        ${prefixFilter}
      ORDER BY submitted_at ASC
      LIMIT ${batchLimit}
    `);
    candidatesFound = rows.rows.length;

    for (const r of rows.rows) {
      // db.execute returns raw column types — Postgres timestamptz arrives
      // as a string with the node-postgres driver in this codepath, so we
      // explicitly normalise to Date for downstream `toISOString()` calls.
      const submittedAt =
        r.submitted_at instanceof Date ? r.submitted_at : new Date(r.submitted_at);
      const lastCheckedAt =
        r.last_checked_at == null
          ? null
          : r.last_checked_at instanceof Date
            ? r.last_checked_at
            : new Date(r.last_checked_at);
      const result = await upgradeOneRow(
        {
          id: r.id,
          createdAt: submittedAt,
          kind: r.kind,
          referenceId: r.reference_id,
          payloadSha256: r.payload_sha256,
          submittedAt,
          // proofs jsonb column type matches CalendarReceipt[]
          proofs: r.proofs as Parameters<typeof upgradeOneRow>[0]["proofs"],
          btcAnchored: r.btc_anchored,
          btcBlock: r.btc_block,
          lastCheckedAt,
        },
        {
          source: "sweeper",
          ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
          ...(typeof opts.timeoutMs === "number" ? { timeoutMs: opts.timeoutMs } : {}),
        },
      );
      if (result.transition === "newly_anchored") upgradedCount++;
      if (result.transition === "error") {
        errorsCount++;
        logger.warn(
          { rowId: r.id, referenceId: r.reference_id, err: result.error },
          "[ots-sweeper] row upgrade failed",
        );
      }
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "[ots-sweeper] tick failed");
  } finally {
    if (lockAcquired) {
      try {
        await client.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey.toString()]);
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "[ots-sweeper] advisory_unlock failed",
        );
      }
    }
    client.release();
  }
  return finalize(t0, { lockAcquired, candidatesFound, upgradedCount, errorsCount });
}

function finalize(
  t0: number,
  s: Omit<SweepRunSummary, "durationMs">,
): SweepRunSummary {
  const summary: SweepRunSummary = { ...s, durationMs: Date.now() - t0 };
  recordEventFireAndForget({
    ip: "system",
    route: "/aegis/timestamp/sweeper",
    kind: "Timestamp_Sweep_Run",
    details: {
      lockAcquired: summary.lockAcquired,
      candidatesFound: summary.candidatesFound,
      upgradedCount: summary.upgradedCount,
      errorsCount: summary.errorsCount,
      durationMs: summary.durationMs,
    },
  });
  return summary;
}

/**
 * Schedule periodic sweeps. Returns a stop function that clears the
 * interval — safe to call from a SIGTERM/SIGINT handler. The first tick
 * runs after one full interval (NOT immediately on boot) so the server
 * has a clean warm-up window.
 *
 * Disable via `OTS_SWEEPER_ENABLED=false`.
 * Override interval via `OTS_SWEEPER_INTERVAL_MIN` (default 15).
 */
export function startTimestampSweeper(opts: SweeperOptions = {}): () => void {
  const enabled = (process.env["OTS_SWEEPER_ENABLED"] ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    logger.info("[ots-sweeper] disabled by OTS_SWEEPER_ENABLED=false");
    return () => undefined;
  }
  const minutes = parseFloat(
    process.env["OTS_SWEEPER_INTERVAL_MIN"] ?? String(DEFAULT_INTERVAL_MIN),
  );
  const intervalMs = Math.max(60_000, Math.floor(minutes * 60_000));
  logger.info({ intervalMs, minutes }, "[ots-sweeper] starting");
  let running = false;
  const handle = setInterval(() => {
    if (running) {
      logger.info("[ots-sweeper] previous tick still running, skipping");
      return;
    }
    running = true;
    runSweepOnce(opts)
      .catch((err) => {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "[ots-sweeper] runSweepOnce rejected",
        );
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  // Don't keep the event loop alive solely for the sweeper.
  if (typeof handle.unref === "function") handle.unref();
  return () => {
    clearInterval(handle);
    logger.info("[ots-sweeper] stopped");
  };
}
