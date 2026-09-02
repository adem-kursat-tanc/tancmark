import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, beaconPingsTable, cloakBeaconsTable } from "@workspace/db";
import { sql, gte, eq } from "drizzle-orm";
import { requireAdminToken } from "../middlewares/adminAuth";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

/**
 * GET /aegis/distribution-map
 *
 * Aggregates beacon pings by referer host, joined back to beacon
 * metadata so the dashboard can show "site X has fired beacons for
 * cloaks belonging to clients [A, B]".
 *
 * Query params:
 *   sinceDays: window length (default 30, max 365)
 *   limit:     top-N hosts (default 50, max 500)
 */
router.get(
  "/",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const sinceDays = Math.min(
      365,
      Math.max(1, Number.parseInt(String(req.query["sinceDays"] ?? "30"), 10) || 30),
    );
    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(String(req.query["limit"] ?? "50"), 10) || 50),
    );
    const since = new Date(Date.now() - sinceDays * 86400_000);

    // Per-host aggregate: count, distinct beacons, distinct clients,
    // first/last seen, distinct ip-hashes (rough "unique viewers").
    const hostRows = await db
      .select({
        refererHost: beaconPingsTable.refererHost,
        pingCount: sql<number>`count(*)::int`,
        distinctBeacons: sql<number>`count(distinct ${beaconPingsTable.beaconId})::int`,
        distinctClients: sql<number>`count(distinct ${cloakBeaconsTable.clientId})::int`,
        distinctIps: sql<number>`count(distinct ${beaconPingsTable.ipHash})::int`,
        firstSeen: sql<Date>`min(${beaconPingsTable.ts})`,
        lastSeen: sql<Date>`max(${beaconPingsTable.ts})`,
        clients: sql<string[]>`array_agg(distinct ${cloakBeaconsTable.clientId})`,
      })
      .from(beaconPingsTable)
      .leftJoin(
        cloakBeaconsTable,
        eq(beaconPingsTable.beaconId, cloakBeaconsTable.beaconId),
      )
      .where(gte(beaconPingsTable.ts, since))
      .groupBy(beaconPingsTable.refererHost)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    // Daily timeline (last sinceDays buckets) for the chart.
    const timeline = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${beaconPingsTable.ts}), 'YYYY-MM-DD')`,
        pings: sql<number>`count(*)::int`,
        hosts: sql<number>`count(distinct ${beaconPingsTable.refererHost})::int`,
      })
      .from(beaconPingsTable)
      .where(gte(beaconPingsTable.ts, since))
      .groupBy(sql`date_trunc('day', ${beaconPingsTable.ts})`)
      .orderBy(sql`date_trunc('day', ${beaconPingsTable.ts}) asc`);

    res.json({
      sinceDays,
      generatedAt: new Date(),
      hosts: hostRows.map((h) => ({
        refererHost: h.refererHost ?? "(none)",
        pingCount: h.pingCount,
        distinctBeacons: h.distinctBeacons,
        distinctClients: h.distinctClients,
        distinctIps: h.distinctIps,
        firstSeen: h.firstSeen,
        lastSeen: h.lastSeen,
        clients: (h.clients ?? []).filter((c) => c != null),
      })),
      timeline,
    });
  }),
);

export default router;
