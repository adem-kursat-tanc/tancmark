import type { IRouter, NextFunction, Request, Response } from "express";
import { requireAdminToken } from "../../middlewares/adminAuth";

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

export function registerAegisDnaReadOnlyRoute(router: IRouter): void {
  router.get(
    "/dna/:dnaId",
    requireAdminToken,
    asyncHandler(async (req, res) => {
      const dnaId = req.params.dnaId;
      if (typeof dnaId !== "string" || dnaId.length === 0 || dnaId.length > 256) {
        res.status(400).json({ error: "invalid dnaId" });
        return;
      }
      const { buildDnaReport } = await import("../../dna/dnaReport.js");
      const report = await buildDnaReport(dnaId);
      if (!report.present) {
        res.status(404).json({ ...report, dnaId });
        return;
      }
      res.status(200).json(report);
    }),
  );
}
