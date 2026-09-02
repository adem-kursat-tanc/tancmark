import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { listEvents } from "../lib/auditStore";
import {
  SECURE_ROOM_EVENT_TYPES,
  cleanModuleArray,
  cleanString,
  parseSecureRoomEventType,
  recordSecureRoomModuleSummary,
} from "../lib/secureRoomSummary";
import {
  ZEHIR_EVENT_TYPES,
  parseZehirEventType,
  recordZehirEvent,
} from "../lib/zehirSummary";
import { requireAdminToken } from "../middlewares/adminAuth";
import { recordSecureRoomEvidencePackage } from "../lib/secureRoomEvidencePackage";
import { buildC2paDraftPayload } from "../lib/c2paDraft";
import { buildZehirDisplayReport } from "../lib/zehirDisplay";
import { buildSecureRoomDisplayReport } from "../lib/secureRoomDisplay";
import { prepareLargeFileAnalysisCopy } from "../lib/largeFileAnalysis";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

function cleanSupportDetails(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const cleanKey = cleanString(key, 80);
    if (!cleanKey) continue;
    if (
      raw === null ||
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean" ||
      Array.isArray(raw) ||
      (typeof raw === "object" && raw !== null)
    ) {
      out[cleanKey] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function cleanSha256(value: unknown): string | undefined {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

router.get(
  "/report",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const requestedLimit = Number(req.query["limit"] ?? 25);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), 100))
      : 25;
    const rows = await listEvents({ kind: "Secure_Room_Event", limit: 500 });
    const report = buildSecureRoomDisplayReport(rows, limit);

    res.json({
      ok: true,
      report,
    });
  }),
);

router.get(
  "/zehir-report",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const requestedLimit = Number(req.query["limit"] ?? 25);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.floor(requestedLimit), 100))
      : 25;
    const rows = await listEvents({ kind: "Secure_Room_Event", limit: 500 });
    const report = buildZehirDisplayReport(rows, limit);

    res.json({
      ok: true,
      report,
    });
  }),
);

router.post(
  "/events",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const eventType = parseSecureRoomEventType(body.eventType);
    const fileId = cleanString(body.fileId);
    const copyId = cleanString(body.copyId);
    const sessionId = cleanString(body.sessionId);
    const roomUserId = cleanString(body.userId);

    if (!eventType) {
      res.status(400).json({
        error: "eventType required",
        allowed: SECURE_ROOM_EVENT_TYPES,
      });
      return;
    }
    if (!fileId || !copyId || !sessionId) {
      res.status(400).json({
        error: "fileId, copyId and sessionId required",
      });
      return;
    }

    const activeModules = cleanModuleArray(body.activeModules);
    const modulesSealed = cleanModuleArray(body.modulesSealed);
    const modulesIdRead = cleanModuleArray(body.modulesIdRead);
    const modulesCandidateSupport = cleanModuleArray(body.modulesCandidateSupport);
    const modulesConfirmed = cleanModuleArray(body.modulesConfirmed);
    const supportDetails = cleanSupportDetails(body.supportDetails);
    const note = cleanString(body.note, 500);
    const { row, secureRoom } = await recordSecureRoomModuleSummary({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      eventType,
      fileId,
      copyId,
      sessionId,
      ...(roomUserId ? { userId: roomUserId } : {}),
      activeModules,
      modulesSealed,
      modulesIdRead,
      modulesCandidateSupport,
      modulesConfirmed,
      ...(supportDetails ? { supportDetails } : {}),
      ...(note ? { note } : {}),
    });

    res.json({
      ok: true,
      auditId: row.id,
      secureRoom,
    });
  }),
);

router.post(
  "/zehir-events",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const eventType = parseZehirEventType(body.eventType);
    const fileId = cleanString(body.fileId);
    const copyId = cleanString(body.copyId);
    const sessionId = cleanString(body.sessionId);
    const screenSessionId = cleanString(body.screenSessionId);
    const roomUserId = cleanString(body.userId);

    if (!eventType) {
      res.status(400).json({
        error: "eventType required",
        allowed: ZEHIR_EVENT_TYPES,
      });
      return;
    }
    if (!fileId || !copyId || !sessionId || !screenSessionId) {
      res.status(400).json({
        error: "fileId, copyId, sessionId and screenSessionId required",
      });
      return;
    }

    const sourceModules = cleanModuleArray(body.sourceModules);
    const signalType = cleanString(body.signalType, 80);
    const note = cleanString(body.note, 500);
    const reason = cleanString(body.reason, 500);
    if (
      (eventType === "manual_light_protection" ||
        eventType === "manual_medium_protection" ||
        eventType === "manual_hard_protection" ||
        eventType === "auto_light_protection_candidate" ||
        eventType === "protection_rollback_requested") &&
      !reason
    ) {
      res.status(400).json({
        error: "reason required for Zehir protection records",
      });
      return;
    }

    const { row, secureRoomRow, zehir, secureRoom } = await recordZehirEvent({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      eventType,
      fileId,
      copyId,
      sessionId,
      screenSessionId,
      ...(roomUserId ? { userId: roomUserId } : {}),
      sourceModules,
      ...(signalType ? { signalType } : {}),
      ...(note ? { note } : {}),
      ...(reason ? { reason } : {}),
    });

    res.json({
      ok: true,
      auditId: row.id,
      secureRoomAuditId: secureRoomRow.id,
      zehir,
      secureRoom,
    });
  }),
);

router.post(
  "/evidence-package",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const fileId = cleanString(body.fileId);
    const copyId = cleanString(body.copyId);
    const sessionId = cleanString(body.sessionId);
    const screenSessionId = cleanString(body.screenSessionId);
    const roomUserId = cleanString(body.userId);
    const checkpointId = cleanString(body.checkpointId, 120);
    const contentHashSha256 = cleanSha256(body.contentHashSha256);
    const copyHashSha256 = cleanSha256(body.copyHashSha256);
    const c2paSourcePath = cleanString(body.sourcePath ?? body.c2paSourcePath, 1200);
    const c2paFileName = cleanString(body.fileName ?? body.c2paFileName, 240);
    const c2paMimeType = cleanString(body.mimeType ?? body.c2paMimeType, 120);
    const note = cleanString(body.note, 500);

    if (!fileId || !copyId || !sessionId) {
      res.status(400).json({
        error: "fileId, copyId and sessionId required",
      });
      return;
    }

    const { row, evidencePackage } = await recordSecureRoomEvidencePackage({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      fileId,
      copyId,
      sessionId,
      ...(screenSessionId ? { screenSessionId } : {}),
      ...(roomUserId ? { userId: roomUserId } : {}),
      ...(checkpointId ? { checkpointId } : {}),
      ...(contentHashSha256 ? { contentHashSha256 } : {}),
      ...(copyHashSha256 ? { copyHashSha256 } : {}),
      ...(c2paSourcePath ? { c2paSourcePath } : {}),
      ...(c2paFileName ? { c2paFileName } : {}),
      ...(c2paMimeType ? { c2paMimeType } : {}),
      ...(note ? { note } : {}),
    });

    res.json({
      ok: true,
      auditId: row.id,
      evidencePackage,
    });
  }),
);

router.post(
  "/large-file-analysis",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const sourcePath = cleanString(body.sourcePath, 1200);
    const fileId = cleanString(body.fileId);
    const copyId = cleanString(body.copyId);
    const sessionId = cleanString(body.sessionId);
    const screenSessionId = cleanString(body.screenSessionId);
    const roomUserId = cleanString(body.userId);
    const requestedAllowedRoot = cleanString(body.allowedRoot, 1200);
    const forceAnalysisCopy = body.forceAnalysisCopy === true;
    const analysisSampleBytes = cleanNumber(body.analysisSampleBytes);
    const note = cleanString(body.note, 500);

    if (!sourcePath || !fileId || !copyId || !sessionId) {
      res.status(400).json({
        error: "sourcePath, fileId, copyId and sessionId required",
      });
      return;
    }
    if (requestedAllowedRoot) {
      res.status(400).json({ error: "allowedRoot_client_override_disabled" });
      return;
    }

    const largeFileStrategy = await prepareLargeFileAnalysisCopy({
      sourcePath,
      fileId,
      copyId,
      sessionId,
      ...(roomUserId ? { userId: roomUserId } : {}),
      ...(screenSessionId ? { screenSessionId } : {}),
      forceAnalysisCopy,
      ...(analysisSampleBytes ? { analysisSampleBytes } : {}),
    });

    const { row, secureRoom } = await recordSecureRoomModuleSummary({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      eventType: "large_file_analysis_copy",
      fileId,
      copyId,
      sessionId,
      ...(roomUserId ? { userId: roomUserId } : {}),
      supportDetails: {
        largeFileStrategy,
        originalHashSha256: largeFileStrategy.original.sha256Before,
        analysisCopyHashSha256: largeFileStrategy.analysisCopy.sha256,
        workingCopyHashSha256: largeFileStrategy.workingCopy.sha256,
        analyzedCopyPath: largeFileStrategy.analysisCopy.path,
        largeFileStrategyUsed: true,
      },
      sourceResult: "LARGE_FILE_ANALYSIS_COPY_RECORDED",
      note:
        note ??
        "Large file analysis copy flow recorded. Original file is preserved; Secure Room remains record-only.",
    });

    res.json({
      ok: true,
      auditId: row.id,
      largeFileStrategy,
      secureRoom,
    });
  }),
);

router.post(
  "/c2pa-draft",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const fileId = cleanString(body.fileId);
    const copyId = cleanString(body.copyId);
    const sessionId = cleanString(body.sessionId);
    const screenSessionId = cleanString(body.screenSessionId);
    const roomUserId = cleanString(body.userId);
    const checkpointId = cleanString(body.checkpointId, 120);
    const evidencePackageId = cleanString(body.evidencePackageId, 120);
    const contentHashSha256 = cleanSha256(body.contentHashSha256);
    const copyHashSha256 = cleanSha256(body.copyHashSha256);
    const c2paSourcePath = cleanString(body.sourcePath ?? body.c2paSourcePath, 1200);
    const c2paFileName = cleanString(body.fileName ?? body.c2paFileName, 240);
    const c2paMimeType = cleanString(body.mimeType ?? body.c2paMimeType, 120);
    const note = cleanString(body.note, 500);
    const openTimestamps =
      body.openTimestamps && typeof body.openTimestamps === "object" && !Array.isArray(body.openTimestamps)
        ? (body.openTimestamps as Record<string, unknown>)
        : undefined;

    if (!fileId || !copyId || !sessionId) {
      res.status(400).json({
        error: "fileId, copyId and sessionId required",
      });
      return;
    }

    const c2paDraft = await buildC2paDraftPayload({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      fileId,
      copyId,
      sessionId,
      ...(screenSessionId ? { screenSessionId } : {}),
      ...(roomUserId ? { userId: roomUserId } : {}),
      ...(checkpointId ? { checkpointId } : {}),
      ...(evidencePackageId ? { evidencePackageId } : {}),
      ...(contentHashSha256 ? { contentHashSha256 } : {}),
      ...(copyHashSha256 ? { copyHashSha256 } : {}),
      ...(c2paSourcePath ? { c2paSourcePath } : {}),
      ...(c2paFileName ? { c2paFileName } : {}),
      ...(c2paMimeType ? { c2paMimeType } : {}),
      ...(openTimestamps ? { openTimestamps } : {}),
      ...(note ? { note } : {}),
    });

    res.json({
      ok: true,
      c2paDraft,
    });
  }),
);

export default router;
