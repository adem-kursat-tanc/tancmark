import type { IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, aegisDnaRecordsTable } from "@workspace/db";
import { requireAdminToken } from "../../middlewares/adminAuth";

export function registerVideoLabDnaReadOnlyRoute(router: IRouter): void {
  router.get(
    "/dna/:dnaId",
    requireAdminToken,
    async (req, res) => {
      const dnaId = req.params.dnaId;
      if (typeof dnaId !== "string" || dnaId.length === 0 || dnaId.length > 256) {
        res.status(400).json({ error: "invalid dnaId" });
        return;
      }
      try {
        const rows = await db
          .select()
          .from(aegisDnaRecordsTable)
          .where(eq(aegisDnaRecordsTable.dnaId, dnaId))
          .limit(1);
        if (rows.length === 0) {
          res.status(404).json({ error: "not found", dnaId });
          return;
        }
        res.status(200).json(rows[0]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        req.log.error({ err: msg, dnaId }, "aegis-dna lookup failed");
        res.status(500).json({ error: msg });
      }
    },
  );
}
