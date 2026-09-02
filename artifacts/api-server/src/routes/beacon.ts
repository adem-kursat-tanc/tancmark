import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, cloakBeaconsTable, beaconPingsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { TRANSPARENT_GIF_1X1, hashForStorage, refererToHost } from "@workspace/aegis-core";
import { requireAdminToken } from "../middlewares/adminAuth";
import { recordEventFireAndForget } from "../lib/auditStore";
import { aegis } from "../lib/aegis";
import { logger } from "../lib/logger";
import { noopSharedStoreAdapter, type SharedStoreAdapter } from "../platform/sharedStore";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

const BEACON_ID_RE = /^[A-Za-z0-9_-]{16,32}$/;

/**
 * In-memory replay/dedupe window for public beacon pings.
 *
 * Threat: the GIF endpoint is unauthenticated by design (it's a
 * tracking pixel), so a hostile party could fire millions of
 * requests at the same beaconId — possibly with rotating fake
 * `Referer` values — to either (a) bury legitimate hits in noise or
 * (b) fabricate distribution telemetry. We mitigate by deduping
 * `(beaconId, ipHash)` within a sliding window: the GIF still
 * responds 200 to every caller (so we don't leak that we're
 * rate-limiting), but the database row is suppressed.
 *
 * Per-process is acceptable for this demo — a future hardening
 * step would push this into Redis or a `unique (beacon_id, ip_hash,
 * week_bucket)` partial index. Window is intentionally short (60
 * minutes) to still capture distinct re-visits from the same
 * reader at different times of day.
 */
const PING_DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const PING_DEDUPE_MAX_KEYS = 10_000;
const SHARED_BEACON_DEDUPE_ENABLED_ENV = "TANCMARK_SHARED_BEACON_DEDUPE_ENABLED";
const pingDedupe = new Map<string, number>();

function sharedBeaconDedupeEnabled(): boolean {
  return process.env[SHARED_BEACON_DEDUPE_ENABLED_ENV] === "true";
}

export function getSharedBeaconDedupePilotGate() {
  const enabled = sharedBeaconDedupeEnabled();
  return {
    decisionRole: "shared_beacon_dedupe_pilot_gate_no_vault_no_confirmed",
    envFlag: SHARED_BEACON_DEDUPE_ENABLED_ENV,
    defaultEnabled: false,
    enabled,
    adapterPath: "platform.sharedStore",
    adapterRequiredAtBoot: false,
    newExternalServiceRequired: false,
    fallbackWhenDisabled: "legacy_in_memory_beacon_dedupe",
    notConfiguredBehavior: "fallback_to_legacy_in_memory",
    appWebSelfServiceDefaultUnchanged: !enabled,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

function shouldRecordPingInMemory(beaconId: string, ipHash: string | null): boolean {
  if (!ipHash) return true; // no ip → can't dedupe; record once.
  const key = `${beaconId}:${ipHash}`;
  const now = Date.now();
  const last = pingDedupe.get(key);
  if (last !== undefined && now - last < PING_DEDUPE_WINDOW_MS) return false;
  pingDedupe.set(key, now);
  if (pingDedupe.size > PING_DEDUPE_MAX_KEYS) {
    // simple eviction: drop the oldest ~10% of entries by insertion
    // order (Map preserves insertion order in JS).
    const toDrop = Math.floor(PING_DEDUPE_MAX_KEYS * 0.1);
    let i = 0;
    for (const k of pingDedupe.keys()) {
      pingDedupe.delete(k);
      if (++i >= toDrop) break;
    }
  }
  return true;
}

async function shouldRecordPing(
  beaconId: string,
  ipHash: string | null,
  adapter: SharedStoreAdapter = noopSharedStoreAdapter,
): Promise<boolean> {
  if (!sharedBeaconDedupeEnabled()) return shouldRecordPingInMemory(beaconId, ipHash);

  try {
    const result = await adapter.dedupeBeaconSignal({
      beaconId,
      ipHash,
      windowSeconds: Math.ceil(PING_DEDUPE_WINDOW_MS / 1000),
    });

    if (result.status === "not_configured") {
      return shouldRecordPingInMemory(beaconId, ipHash);
    }

    if (result.ok && result.data?.duplicate === true && result.data.persisted === true) {
      return false;
    }

    return true;
  } catch {
    return shouldRecordPingInMemory(beaconId, ipHash);
  }
}

/**
 * GET /aegis/beacon/:beaconId.gif  (PUBLIC)
 *
 * Serves a 1×1 transparent GIF and records a ping. We deliberately
 * always return the GIF, even for unknown ids, to avoid leaking
 * which beacons exist.
 *
 * Privacy:
 *   - raw IP / UA never persisted; both are HMAC-truncated with a
 *     weekly-rotating salt.
 *   - Referer reduced to host-only.
 */
router.get(
  "/:beaconId.gif",
  asyncHandler(async (req, res) => {
    const beaconId = String(req.params["beaconId"] ?? "");

    // Always respond with the GIF first — even on errors. Then log async.
    res
      .status(200)
      .setHeader("Content-Type", "image/gif")
      .setHeader("Content-Length", String(TRANSPARENT_GIF_1X1.length))
      .setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
      .setHeader("Pragma", "no-cache")
      .setHeader("Expires", "0")
      .end(TRANSPARENT_GIF_1X1);

    if (!BEACON_ID_RE.test(beaconId)) return;

    void (async () => {
      try {
        const beaconRows = await db
          .select()
          .from(cloakBeaconsTable)
          .where(eq(cloakBeaconsTable.beaconId, beaconId))
          .limit(1);
        if (beaconRows.length === 0) return;
        const beacon = beaconRows[0]!;
        if (!beacon.enabled) return;

        const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
        const ua = req.header("user-agent") ?? "";
        const referer = req.header("referer") ?? req.header("referrer") ?? null;
        const origin = req.header("origin") ?? null;
        const refererHost = refererToHost(referer);
        const originHost = refererToHost(origin);

        // Weekly-rotating salted hash for storage (KVKK posture).
        const secret = aegis.getSecretForVersion(aegis.activeKeyVersion()) ?? "fallback";
        const ipHash = ip ? hashForStorage(ip, secret) : null;
        const uaHash = ua ? hashForStorage(ua, secret) : null;

        // Replay/spam suppression — see top of file.
        if (!(await shouldRecordPing(beaconId, ipHash))) return;

        await db.insert(beaconPingsTable).values({
          beaconId,
          refererHost,
          originHost,
          ipHash,
          uaHash,
        });

        const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
        recordEventFireAndForget({
          ip: ipHash ?? "unknown",
          route,
          kind: "Content_Distribution_Detected",
          details: {
            beaconId,
            cloakId: beacon.cloakId,
            clientId: beacon.clientId,
            docId: beacon.docId,
            refererHost,
            originHost,
          },
        });

        if (sharedBeaconDedupeEnabled()) {
          void noopSharedStoreAdapter.recordBeaconSignal({
            signalType: "beacon_ping",
            key: beaconId,
            summary: {
              refererHost,
              originHost,
              hasIpHash: ipHash !== null,
              hasUaHash: uaHash !== null,
            },
          });
        }
      } catch (err) {
        logger.warn({ err, beaconId }, "[beacon] ping persist failed");
      }
    })();
  }),
);

/**
 * GET /aegis/beacon/list
 * Admin: list all beacons with ping counts.
 */
router.get(
  "/list",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: cloakBeaconsTable.id,
        beaconId: cloakBeaconsTable.beaconId,
        clientId: cloakBeaconsTable.clientId,
        cloakId: cloakBeaconsTable.cloakId,
        docId: cloakBeaconsTable.docId,
        enabled: cloakBeaconsTable.enabled,
        createdAt: cloakBeaconsTable.createdAt,
        pingCount: sql<number>`(
          select count(*)::int from ${beaconPingsTable}
          where ${beaconPingsTable.beaconId} = ${cloakBeaconsTable.beaconId}
        )`,
      })
      .from(cloakBeaconsTable)
      .orderBy(desc(cloakBeaconsTable.createdAt))
      .limit(200);
    res.json({ total: rows.length, rows });
  }),
);

/**
 * GET /aegis/beacon/:beaconId/pings
 * Admin: full ping log for a specific beacon (most recent first).
 */
router.get(
  "/:beaconId/pings",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const beaconId = String(req.params["beaconId"] ?? "");
    if (!BEACON_ID_RE.test(beaconId)) {
      res.status(400).json({ error: "invalid beaconId" });
      return;
    }
    const pings = await db
      .select()
      .from(beaconPingsTable)
      .where(eq(beaconPingsTable.beaconId, beaconId))
      .orderBy(desc(beaconPingsTable.ts))
      .limit(500);
    res.json({ beaconId, total: pings.length, pings });
  }),
);

/**
 * POST /aegis/beacon/:beaconId/disable
 * Admin: kill switch (e.g. customer GDPR request, false attribution).
 */
router.post(
  "/:beaconId/disable",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const beaconId = String(req.params["beaconId"] ?? "");
    if (!BEACON_ID_RE.test(beaconId)) {
      res.status(400).json({ error: "invalid beaconId" });
      return;
    }
    const result = await db
      .update(cloakBeaconsTable)
      .set({ enabled: false })
      .where(eq(cloakBeaconsTable.beaconId, beaconId))
      .returning({ id: cloakBeaconsTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "beacon not found" });
      return;
    }
    res.json({ disabled: true, beaconId });
  }),
);

export default router;

/*
 * Default path:
 * - TANCMARK_SHARED_BEACON_DEDUPE_ENABLED is absent/false.
 * - beacon dedupe uses the existing in-memory Map.
 *
 * Pilot path:
 * - TANCMARK_SHARED_BEACON_DEDUPE_ENABLED=true calls the platform sharedStore
 *   adapter for beacon dedupe first.
 * - Noop/not_configured falls back to legacy in-memory dedupe.
 *
 * Rate-limit and audit/anomaly are not changed in this phase.
 * VAULT, confirmed, final, threshold, ownership, pre-seal and core seal/read
 * logic are not touched by this beacon/dedupe pilot.
 *
 * Phase 4 sentinel strings:
 * - TANCMARK_SHARED_BEACON_DEDUPE_ENABLED=false
 * - legacy_in_memory_beacon_dedupe
 */
