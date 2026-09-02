import type { IRouter, NextFunction, Request, Response } from "express";
import { listLearningRecords } from "../../lib/learningRecordStore";
import { resolveLearningAutomationState } from "../../lib/learningDnaMemory";
import { requireAdminToken } from "../../middlewares/adminAuth";
import {
  buildLearningModeResponse,
  buildLearningRecordsResponse,
  buildLearningRecordsSummaryResponse,
  limitFromQuery,
  mediaTypeFromQuery,
} from "./readOnlyHelpers";

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

export function registerLearningModeRoute(router: IRouter): void {
  router.get(
    "/mode",
    requireAdminToken,
    asyncHandler(async (_req, res) => {
      res.json(buildLearningModeResponse(resolveLearningAutomationState()));
    }),
  );
}

export function registerLearningRecordReadOnlyRoutes(router: IRouter): void {
  router.get(
    "/records",
    requireAdminToken,
    asyncHandler(async (req, res) => {
      const records = await listLearningRecords({
        limit: limitFromQuery(req.query["limit"]),
        mediaType: mediaTypeFromQuery(req.query["mediaType"]),
      });

      res.json(buildLearningRecordsResponse(records));
    }),
  );

  router.get(
    "/records/summary",
    requireAdminToken,
    asyncHandler(async (req, res) => {
      const records = await listLearningRecords({
        limit: limitFromQuery(req.query["limit"]),
        mediaType: mediaTypeFromQuery(req.query["mediaType"]),
      });

      res.json(buildLearningRecordsSummaryResponse(records));
    }),
  );
}
