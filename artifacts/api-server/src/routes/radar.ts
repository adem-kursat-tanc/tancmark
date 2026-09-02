import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, honeytokensTable, radarHitsTable, cloakedDocumentsTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { requireAdminToken } from "../middlewares/adminAuth";
import { recordEventFireAndForget } from "../lib/auditStore";
import {
  buildSearchPlan,
  valueAppearsIn,
  verifyResults,
  googleCseAdapter,
  githubCodeAdapter,
  type RadarAdapter,
  type RadarHoneytoken,
} from "@workspace/aegis-core";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

function adapters(): RadarAdapter[] {
  return [googleCseAdapter(process.env), githubCodeAdapter(process.env)];
}

function liveRadarEnabled(): boolean {
  return ["1", "true", "yes", "on"].includes(
    (process.env["AEGIS_CANARY_RADAR_ENABLED"] ?? "false").toLowerCase(),
  );
}

/**
 * Resolve the carrier doc (docId / cloakId) that a honeytoken row was
 * embedded into. Joins on `cloaked_documents.protection_hash`. Pass the
 * `clientId` to defend against the rare case where two clients happen
 * to share the same protectionHash (impossible in practice but cheap
 * to assert).
 */
async function backfillCarrier(
  protectionHash: string | null | undefined,
  clientId: string | null,
): Promise<{ docId: string | null; cloakId: string | null }> {
  if (!protectionHash || !clientId) return { docId: null, cloakId: null };
  const rows = await db
    .select({ docId: cloakedDocumentsTable.docId, cloakId: cloakedDocumentsTable.cloakId })
    .from(cloakedDocumentsTable)
    .where(
      and(
        eq(cloakedDocumentsTable.protectionHash, protectionHash),
        eq(cloakedDocumentsTable.clientId, clientId),
      ),
    )
    .limit(1);
  return { docId: rows[0]?.docId ?? null, cloakId: rows[0]?.cloakId ?? null };
}

/**
 * Decide attribution for a verified hit. The false-accusation guard:
 * if the fakeValue is unique to a single client we can safely attribute;
 * otherwise we surface the candidate list and never single out one
 * client (mirrors the analyze-text rule).
 */
function attribute(tokens: ReadonlyArray<RadarHoneytoken>, isUnique: boolean) {
  if (isUnique) {
    const t = tokens[0]!;
    return {
      clientId: t.clientId,
      candidateClientIds: null as string[] | null,
      protectionHash: t.protectionHash ?? null,
      confidence: "high" as const,
    };
  }
  const distinct = Array.from(new Set(tokens.map((t) => t.clientId))).sort();
  return {
    clientId: null as string | null,
    candidateClientIds: distinct,
    protectionHash: null as string | null,
    confidence: "medium" as const,
  };
}

/**
 * GET /aegis/radar/status — adapter availability + recent hit counts.
 */
router.get(
  "/status",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const externalSearchEnabled = liveRadarEnabled();
    const ad = adapters().map((a) => ({
      name: a.name,
      configured: a.isConfigured(),
      enabled: externalSearchEnabled && a.isConfigured(),
    }));
    const counts = await db
      .select({
        status: radarHitsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(radarHitsTable)
      .groupBy(radarHitsTable.status);
    res.json({ adapters: ad, externalSearchEnabled, counts });
  }),
);

/**
 * GET /aegis/radar/hits — list hits, newest first.
 * Query: ?clientId=&status=&limit=
 */
router.get(
  "/hits",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 50) || 50, 1), 500);
    const conds = [];
    const cId = req.query["clientId"];
    if (typeof cId === "string" && cId.length > 0) conds.push(eq(radarHitsTable.clientId, cId));
    const st = req.query["status"];
    if (typeof st === "string" && st.length > 0) conds.push(eq(radarHitsTable.status, st));
    const where = conds.length > 0 ? and(...conds) : undefined;
    const rows = await (where
      ? db.select().from(radarHitsTable).where(where).orderBy(desc(radarHitsTable.createdAt)).limit(limit)
      : db.select().from(radarHitsTable).orderBy(desc(radarHitsTable.createdAt)).limit(limit));
    res.json({ hits: rows });
  }),
);

/**
 * POST /aegis/radar/hits/:id/status — operator review.
 */
router.post(
  "/hits/:id/status",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "id must be a positive integer" });
      return;
    }
    const status = (req.body ?? {}).status;
    if (!["new", "reviewed", "confirmed", "false_positive"].includes(status)) {
      res.status(400).json({ error: "status invalid" });
      return;
    }
    const updated = await db
      .update(radarHitsTable)
      .set({ status })
      .where(eq(radarHitsTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "hit not found" });
      return;
    }
    res.json({ hit: updated[0] });
  }),
);

interface PersistOptions {
  source: string;
  url: string;
  title: string | null;
  snippet: string | null;
  matchedValue: string;
  matchedKind: string;
  tokens: RadarHoneytoken[];
  isUnique: boolean;
  req: Request;
}

/**
 * Insert one radar hit (idempotent on (source, url, matched_value)),
 * backfill carrier metadata, emit a per-row `Radar_Hit` audit event.
 * Returns the inserted row or `null` if the unique index suppressed it.
 */
async function persistHit(opts: PersistOptions) {
  const attribution = attribute(opts.tokens, opts.isUnique);
  const { docId, cloakId } = await backfillCarrier(attribution.protectionHash, attribution.clientId);
  const inserted = await db
    .insert(radarHitsTable)
    .values({
      clientId: attribution.clientId,
      candidateClientIds: attribution.candidateClientIds,
      docId,
      cloakId,
      source: opts.source,
      url: opts.url,
      title: opts.title,
      snippet: opts.snippet,
      matchedValue: opts.matchedValue,
      matchedKind: opts.matchedKind,
      confidence: attribution.confidence,
      status: "new",
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return null;
  const ip = opts.req.ip ?? opts.req.socket.remoteAddress ?? "unknown";
  const route = opts.req.originalUrl.split("?")[0] ?? opts.req.originalUrl;
  recordEventFireAndForget({
    ip,
    route,
    kind: "Radar_Hit",
    details: {
      source: opts.source,
      url: opts.url,
      clientId: attribution.clientId,
      candidateClientIds: attribution.candidateClientIds,
      confidence: attribution.confidence,
      matchedKind: opts.matchedKind,
    },
  });
  return inserted[0]!;
}

function emitScanEvent(
  req: Request,
  details: { source: string; queries: number; searched: number; inserted: number },
) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
  recordEventFireAndForget({ ip, route, kind: "Radar_Scan", details });
}

/**
 * POST /aegis/radar/scan — trigger a live scan.
 */
router.post(
  "/scan",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const { clientId, limit } = req.body ?? {};
    const perValueLimit = Math.min(Math.max(Number(limit ?? 5) || 5, 1), 10);

    const conds = [];
    if (typeof clientId === "string" && clientId.length > 0) {
      conds.push(eq(honeytokensTable.clientId, clientId));
    }
    const where = conds.length > 0 ? and(...conds) : undefined;
    const htRows = await (where
      ? db.select().from(honeytokensTable).where(where).orderBy(desc(honeytokensTable.createdAt)).limit(200)
      : db.select().from(honeytokensTable).orderBy(desc(honeytokensTable.createdAt)).limit(200));

    const honeytokens: RadarHoneytoken[] = htRows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      protectionHash: r.protectionHash,
      kind: r.kind,
      fakeValue: r.fakeValue,
    }));
    const { queries } = buildSearchPlan(honeytokens);

    if (!liveRadarEnabled()) {
      emitScanEvent(req, {
        source: "disabled",
        queries: queries.length,
        searched: 0,
        inserted: 0,
      });
      res.status(200).json({
        queries: queries.length,
        searched: 0,
        hits: 0,
        adapters: [],
        externalSearchEnabled: false,
        message:
          "Canary Radar live search is disabled by default. Set AEGIS_CANARY_RADAR_ENABLED=true to send only canary/honeytoken trace text to configured third-party search adapters. File contents are not sent.",
      });
      return;
    }

    const live = adapters().filter((a) => a.isConfigured());
    if (live.length === 0) {
      emitScanEvent(req, {
        source: "none",
        queries: queries.length,
        searched: 0,
        inserted: 0,
      });
      res.status(200).json({
        queries: queries.length,
        searched: 0,
        hits: 0,
        adapters: adapters().map((a) => a.name),
        message:
          "No live source adapters configured. Set GOOGLE_CSE_KEY+GOOGLE_CSE_CX or GITHUB_TOKEN, or use POST /radar/manual to ingest a known URL.",
      });
      return;
    }

    let totalSearched = 0;
    let totalInserted = 0;

    for (const q of queries) {
      for (const adapter of live) {
        totalSearched += 1;
        let raw: Awaited<ReturnType<RadarAdapter["search"]>> = [];
        try {
          raw = await adapter.search(q.value, perValueLimit);
        } catch (e) {
          req.log?.warn({ err: e, source: adapter.name }, "radar: adapter error");
          continue;
        }
        const verified = verifyResults(raw, q.value);
        for (const v of verified) {
          const row = await persistHit({
            source: adapter.name,
            url: v.url,
            title: v.title ?? null,
            snippet: v.snippet ?? null,
            matchedValue: q.value,
            matchedKind: q.kind,
            tokens: q.tokens,
            isUnique: q.isUnique,
            req,
          });
          if (row) totalInserted += 1;
        }
      }
    }

    emitScanEvent(req, {
      source: live.map((a) => a.name).join(","),
      queries: queries.length,
      searched: totalSearched,
      inserted: totalInserted,
    });

    res.json({
      queries: queries.length,
      searched: totalSearched,
      hits: totalInserted,
      adapters: live.map((a) => a.name),
    });
  }),
);

/**
 * POST /aegis/radar/manual — operator paste a URL + page content.
 */
router.post(
  "/manual",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const { url, content, title } = req.body ?? {};
    if (typeof url !== "string" || url.length === 0) {
      res.status(400).json({ error: "url (non-empty string) required" });
      return;
    }
    if (typeof content !== "string" || content.length === 0) {
      res.status(400).json({ error: "content (non-empty string) required" });
      return;
    }
    const htRows = await db
      .select()
      .from(honeytokensTable)
      .orderBy(desc(honeytokensTable.createdAt))
      .limit(1000);
    const honeytokens: RadarHoneytoken[] = htRows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      protectionHash: r.protectionHash,
      kind: r.kind,
      fakeValue: r.fakeValue,
    }));
    const { queries } = buildSearchPlan(honeytokens);
    const matches = queries.filter((q) => valueAppearsIn(q.value, content));

    let inserted = 0;
    for (const m of matches) {
      const row = await persistHit({
        source: "manual",
        url,
        title: typeof title === "string" ? title : null,
        snippet: content.slice(0, 200),
        matchedValue: m.value,
        matchedKind: m.kind,
        tokens: m.tokens,
        isUnique: m.isUnique,
        req,
      });
      if (row) inserted += 1;
    }

    emitScanEvent(req, {
      source: "manual",
      queries: queries.length,
      searched: queries.length,
      inserted,
    });

    res.json({ url, scanned: queries.length, hits: inserted });
  }),
);

export default router;
