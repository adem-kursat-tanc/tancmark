import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { aegis } from "../lib/aegis";
import { listEvents, recordEventFireAndForget, stats, AUDIT_KINDS, type AuditKind } from "../lib/auditStore";
import { sensitiveLimiter } from "../middlewares/rateLimit";
import { requireAdminToken } from "../middlewares/adminAuth";

const VALID_KINDS: ReadonlySet<AuditKind> = new Set(AUDIT_KINDS);

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

router.get(
  "/",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query["limit"] ?? 100) || 100, 500);
    const sinceMs = req.query["sinceMs"] ? Number(req.query["sinceMs"]) : undefined;
    const kindRaw = typeof req.query["kind"] === "string" ? req.query["kind"] : undefined;
    const kind = kindRaw && VALID_KINDS.has(kindRaw as AuditKind) ? (kindRaw as AuditKind) : undefined;
    const userId = typeof req.query["userId"] === "string" ? req.query["userId"] : undefined;
    const ip = typeof req.query["ip"] === "string" ? req.query["ip"] : undefined;
    const clientIdRaw = typeof req.query["clientId"] === "string" ? Number(req.query["clientId"]) : undefined;
    const clientId = Number.isInteger(clientIdRaw) ? clientIdRaw : undefined;

    const [s, events] = await Promise.all([
      stats(),
      listEvents({
        limit,
        ...(kind ? { kind } : {}),
        ...(userId ? { userId } : {}),
        ...(ip ? { ip } : {}),
        ...(clientId !== undefined ? { clientId } : {}),
        ...(sinceMs ? { sinceMs } : {}),
      }),
    ]);

    res.json({ stats: s, events });
  }),
);

router.get(
  "/stats",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    res.json(await stats());
  }),
);

router.post(
  "/scan-canary",
  sensitiveLimiter,
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const { text, userId, docId } = req.body ?? {};
    if (typeof text !== "string" || typeof docId !== "string") {
      res.status(400).json({ error: "text and docId required" });
      return;
    }
    const result = aegis.verifyCanary(text, docId);

    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    const userIdStr = userId ? String(userId) : undefined;
    const clientId = req.apiClient?.id;

    recordEventFireAndForget({
      ip,
      route,
      kind: "canary_scan",
      ...(clientId !== undefined ? { clientId } : {}),
      ...(userIdStr ? { userId: userIdStr } : {}),
      details: {
        docId,
        found: result.found,
        matchCount: result.matches.length,
        canaryTermReturned: false,
      },
    });

    if (result.found) {
      recordEventFireAndForget({
        ip,
        route,
        kind: "canary_hit",
        ...(clientId !== undefined ? { clientId } : {}),
        ...(userIdStr ? { userId: userIdStr } : {}),
        details: {
          docId,
          matchCount: result.matches.length,
          canaryTermReturned: false,
        },
      });
    }

    res.json({
      scanned: true,
      matchesFound: result.matches.length,
      status: result.found ? "suspicious" : "no_signal",
      canaryTermReturned: false,
    });
  }),
);

export default router;
