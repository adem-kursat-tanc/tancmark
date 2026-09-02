import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, entanglementFingerprintsTable } from "@workspace/db";
import { inArray, desc } from "drizzle-orm";
import {
  suspectGramHashes,
  attributeFromMatches,
  DEFAULT_WINDOW_SIZES,
  RECOVERY_THRESHOLD,
  type RegisteredMatch,
} from "@workspace/aegis-core";
import { requireAdminToken } from "../middlewares/adminAuth";
import { recordEventFireAndForget } from "../lib/auditStore";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

/**
 * POST /aegis/entanglement/scan
 * body: { text, windowSize?, recoveryThreshold? }
 *
 * Computes the suspect text's n-gram fingerprints, looks them up
 * in `entanglement_fingerprints`, applies the false-accusation
 * guard (drop hashes shared by ≥2 clients), and returns the verdict.
 */
router.post(
  "/scan",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const { text, windowSize, recoveryThreshold } = req.body ?? {};
    if (typeof text !== "string" || text.length === 0) {
      res.status(400).json({ error: "text (non-empty string) required" });
      return;
    }
    // When the caller pins a single windowSize we honour it (legacy /
    // bench paths). Otherwise we use the multi-resolution default
    // (`DEFAULT_WINDOW_SIZES`) so 30-35% deletion still has enough
    // small-window matches to clear the recovery threshold.
    const ws =
      typeof windowSize === "number" && windowSize >= 2 && windowSize <= 12
        ? Math.floor(windowSize)
        : null;
    const threshold =
      typeof recoveryThreshold === "number" && recoveryThreshold >= 1
        ? Math.floor(recoveryThreshold)
        : RECOVERY_THRESHOLD;

    const hashes = suspectGramHashes(
      text,
      ws !== null ? { windowSize: ws } : { windowSizes: DEFAULT_WINDOW_SIZES },
    );
    if (hashes.length === 0) {
      res.json({
        verdict: "insufficient",
        totalSuspectGrams: 0,
        totalMatchedGrams: 0,
        ambiguousDroppedHashes: 0,
        topSuspect: null,
        candidates: [],
      });
      return;
    }
    // Deduplicate before the IN-list lookup.
    const uniq = Array.from(new Set(hashes));
    // Chunk to avoid huge IN clauses on very long texts.
    const matches: RegisteredMatch[] = [];
    const CHUNK = 500;
    for (let i = 0; i < uniq.length; i += CHUNK) {
      const slice = uniq.slice(i, i + CHUNK);
      const rows = await db
        .select({
          clientId: entanglementFingerprintsTable.clientId,
          cloakId: entanglementFingerprintsTable.cloakId,
          docId: entanglementFingerprintsTable.docId,
          gramHash: entanglementFingerprintsTable.gramHash,
          windowSize: entanglementFingerprintsTable.windowSize,
        })
        .from(entanglementFingerprintsTable)
        .where(inArray(entanglementFingerprintsTable.gramHash, slice));
      matches.push(...rows);
    }

    const verdict = attributeFromMatches(hashes.length, matches, {
      recoveryThreshold: threshold,
    });

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    recordEventFireAndForget({
      ip,
      route,
      kind: "Entanglement_Scan",
      details: {
        windowSize: ws ?? DEFAULT_WINDOW_SIZES,
        recoveryThreshold: threshold,
        suspectGramCount: hashes.length,
        matchedRows: matches.length,
        verdict: verdict.verdict,
        topSuspect: verdict.topSuspect,
        ambiguousDroppedHashes: verdict.ambiguousDroppedHashes,
      },
    });

    res.json(verdict);
  }),
);

/**
 * GET /aegis/entanglement/stats
 *
 * Quick admin overview: how many fingerprints we've registered, by
 * client, ordered by recency.
 */
router.get(
  "/stats",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(entanglementFingerprintsTable)
      .orderBy(desc(entanglementFingerprintsTable.createdAt))
      .limit(500);
    const byCloak = new Map<
      string,
      { clientId: string; cloakId: string; docId: string; count: number; latest: Date }
    >();
    for (const r of rows) {
      const cur = byCloak.get(r.cloakId) ?? {
        clientId: r.clientId,
        cloakId: r.cloakId,
        docId: r.docId,
        count: 0,
        latest: r.createdAt,
      };
      cur.count += 1;
      if (r.createdAt > cur.latest) cur.latest = r.createdAt;
      byCloak.set(r.cloakId, cur);
    }
    res.json({
      totalRows: rows.length,
      cloaks: Array.from(byCloak.values()).sort(
        (a, b) => b.latest.getTime() - a.latest.getTime(),
      ),
    });
  }),
);

export default router;
