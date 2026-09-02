import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, timestampProofsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { digestPayload } from "@workspace/aegis-core";
import { requireAdminToken } from "../middlewares/adminAuth";
import { recordEventFireAndForget } from "../lib/auditStore";
import { upgradeOneRow } from "../lib/timestampUpgrade";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

const VALID_KINDS = new Set(["cloak", "protect", "vault", "evidence_package"]);

/**
 * GET /aegis/timestamp/:kind/:referenceId
 *
 * Returns the stored OTS proof bundle (digest + per-calendar
 * receipts) for a given cloak/protect/vault/evidence_package reference.
 * Admin-gated.
 */
router.get(
  "/:kind/:referenceId",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const kind = String(req.params["kind"] ?? "");
    const referenceId = String(req.params["referenceId"] ?? "");
    if (!VALID_KINDS.has(kind)) {
      res.status(400).json({
        error: "kind must be 'cloak', 'protect', 'vault' or 'evidence_package'",
      });
      return;
    }
    const rows = await db
      .select()
      .from(timestampProofsTable)
      .where(
        and(
          eq(timestampProofsTable.kind, kind),
          eq(timestampProofsTable.referenceId, referenceId),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "no timestamp proof for this reference" });
      return;
    }
    res.json(rows[0]);
  }),
);

/**
 * GET /aegis/timestamp
 *
 * List recent timestamp proofs (paginated). For dashboard overview.
 */
router.get(
  "/",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(String(req.query["limit"] ?? "50"), 10) || 50),
    );
    const rows = await db
      .select()
      .from(timestampProofsTable)
      .orderBy(desc(timestampProofsTable.submittedAt))
      .limit(limit);
    res.json({
      total: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        referenceId: r.referenceId,
        payloadSha256: r.payloadSha256,
        submittedAt: r.submittedAt,
        btcAnchored: r.btcAnchored,
        btcBlock: r.btcBlock,
        lastCheckedAt: r.lastCheckedAt,
        calendars: r.proofs.map((p) => ({ calendar: p.calendar, status: p.status })),
      })),
    });
  }),
);

/**
 * POST /aegis/timestamp/:kind/:referenceId/upgrade
 *
 * Re-fetches each calendar's `/timestamp/{digest}` to see if the
 * pending receipt has been merged into a Bitcoin-anchored Merkle
 * root yet. Updates the row in place and returns the new bundle.
 */
router.post(
  "/:kind/:referenceId/upgrade",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const kind = String(req.params["kind"] ?? "");
    const referenceId = String(req.params["referenceId"] ?? "");
    if (!VALID_KINDS.has(kind)) {
      res.status(400).json({
        error: "kind must be 'cloak', 'protect', 'vault' or 'evidence_package'",
      });
      return;
    }
    const rows = await db
      .select()
      .from(timestampProofsTable)
      .where(
        and(
          eq(timestampProofsTable.kind, kind),
          eq(timestampProofsTable.referenceId, referenceId),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "no timestamp proof for this reference" });
      return;
    }
    const row = rows[0]!;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    // Shared helper — same idempotency guard for `Timestamp_Anchored` audit
    // as the background sweeper. Manual operator path stays open for
    // emergencies but cannot create duplicate anchor events.
    const result = await upgradeOneRow(row, { source: "manual", ip, route });

    recordEventFireAndForget({
      ip,
      route,
      kind: "Timestamp_Verify",
      details: {
        kind,
        referenceId,
        digest: row.payloadSha256,
        anchored: result.anchored,
        transition: result.transition,
        statuses: result.proofs.map((u) => ({ calendar: u.calendar, status: u.status })),
      },
    });

    res.json({
      id: row.id,
      kind: row.kind,
      referenceId: row.referenceId,
      payloadSha256: row.payloadSha256,
      submittedAt: row.submittedAt,
      btcAnchored: result.anchored,
      proofs: result.proofs,
    });
  }),
);

/**
 * POST /aegis/timestamp/verify
 * body: { payload: string, digest?: string }
 *
 * Anyone with the original protected text can re-derive the digest
 * and check whether we have a recorded proof for it. Helpful for
 * legal/forensic third parties demonstrating priority.
 */
router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { payload, digest } = req.body ?? {};
    let digestHex: string;
    if (typeof digest === "string" && /^[0-9a-f]{64}$/i.test(digest)) {
      digestHex = digest.toLowerCase();
    } else if (typeof payload === "string" && payload.length > 0) {
      digestHex = digestPayload(payload);
    } else {
      res.status(400).json({ error: "provide payload (string) or digest (hex sha256)" });
      return;
    }
    const rows = await db
      .select()
      .from(timestampProofsTable)
      .where(eq(timestampProofsTable.payloadSha256, digestHex))
      .limit(5);
    res.json({
      digest: digestHex,
      found: rows.length > 0,
      matches: rows.map((r) => ({
        kind: r.kind,
        referenceId: r.referenceId,
        submittedAt: r.submittedAt,
        btcAnchored: r.btcAnchored,
        btcBlock: r.btcBlock,
        calendars: r.proofs.map((p) => ({ calendar: p.calendar, status: p.status })),
      })),
    });
  }),
);

export default router;
