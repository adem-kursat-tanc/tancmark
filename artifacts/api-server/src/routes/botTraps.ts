import { Router, type IRouter } from "express";
import { db, honeytokensTable } from "@workspace/db";
import { desc, eq, sql, isNotNull } from "drizzle-orm";
import { requireAdminToken } from "../middlewares/adminAuth";

/**
 * Bot-Trap Pulse — list recently served honeytokens (and which were
 * later "eaten" by a leak scan). Admin-gated.
 */
const router: IRouter = Router();

router.use(requireAdminToken);

router.get("/", (req, res, next) => {
  (async () => {
    const limitRaw = Number(req.query["limit"] ?? 100);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(500, Math.floor(limitRaw))
        : 100;
    const onlyUsed = String(req.query["onlyUsed"] ?? "").toLowerCase() === "true";

    const baseQuery = db.select().from(honeytokensTable);
    const events = await (onlyUsed
      ? baseQuery.where(eq(honeytokensTable.used, true))
      : baseQuery
    )
      .orderBy(desc(honeytokensTable.createdAt))
      .limit(limit);

    const totalRow = await db
      .select({
        total: sql<number>`count(*)::int`,
        used: sql<number>`sum(case when ${honeytokensTable.used} then 1 else 0 end)::int`,
      })
      .from(honeytokensTable);

    const byKindRows = await db
      .select({
        kind: honeytokensTable.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(honeytokensTable)
      .groupBy(honeytokensTable.kind);

    const byVerdictRows = await db
      .select({
        verdict: honeytokensTable.botVerdict,
        count: sql<number>`count(*)::int`,
      })
      .from(honeytokensTable)
      .groupBy(honeytokensTable.botVerdict);

    // Per-client aggregate — drives the "Otonom Durum" panel.
    const byClientRows = await db
      .select({
        clientId: honeytokensTable.clientId,
        kind: honeytokensTable.kind,
        count: sql<number>`count(*)::int`,
        used: sql<number>`sum(case when ${honeytokensTable.used} then 1 else 0 end)::int`,
      })
      .from(honeytokensTable)
      .groupBy(honeytokensTable.clientId, honeytokensTable.kind);

    // Per-document aggregate — top recent carrier docs (by served count).
    const byDocumentRows = await db
      .select({
        protectionHash: honeytokensTable.protectionHash,
        clientId: honeytokensTable.clientId,
        served: sql<number>`count(*)::int`,
        used: sql<number>`sum(case when ${honeytokensTable.used} then 1 else 0 end)::int`,
        lastSeenAt: sql<string>`max(${honeytokensTable.createdAt})`,
      })
      .from(honeytokensTable)
      .where(isNotNull(honeytokensTable.protectionHash))
      .groupBy(honeytokensTable.protectionHash, honeytokensTable.clientId)
      .orderBy(desc(sql`max(${honeytokensTable.createdAt})`))
      .limit(20);

    const byKind: Record<string, number> = {};
    for (const r of byKindRows) byKind[r.kind] = r.count;
    const byVerdict: Record<string, number> = {};
    for (const r of byVerdictRows) byVerdict[r.verdict ?? "unknown"] = r.count;

    // Reshape per-client: collapse rows by clientId and roll up kinds.
    // clientId is now `text` (post v3.2 hardening) so the Map key is a string.
    const clientMap = new Map<
      string,
      { clientId: string; served: number; used: number; kinds: Record<string, number> }
    >();
    for (const r of byClientRows) {
      const cur = clientMap.get(r.clientId) ?? {
        clientId: r.clientId,
        served: 0,
        used: 0,
        kinds: {},
      };
      cur.served += r.count;
      cur.used += r.used;
      cur.kinds[r.kind] = (cur.kinds[r.kind] ?? 0) + r.count;
      clientMap.set(r.clientId, cur);
    }
    const byClient = Array.from(clientMap.values()).sort((a, b) => b.served - a.served);

    const byDocument = byDocumentRows
      .filter((r) => r.protectionHash !== null)
      .map((r) => ({
        protectionHash: r.protectionHash as string,
        clientId: r.clientId,
        served: r.served,
        used: r.used,
        lastSeenAt: new Date(r.lastSeenAt).toISOString(),
      }));

    res.json({
      events,
      stats: {
        total: totalRow[0]?.total ?? 0,
        used: totalRow[0]?.used ?? 0,
        byKind,
        byVerdict,
        byClient,
        byDocument,
      },
    });
  })().catch(next);
});

export default router;
