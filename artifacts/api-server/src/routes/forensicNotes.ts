import { Router, type IRouter } from "express";
import { db, forensicNotesTable, insertForensicNoteSchema } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAdminToken } from "../middlewares/adminAuth";

const router: IRouter = Router();

router.use(requireAdminToken);

router.get("/", (req, res, next) => {
  (async () => {
    const limitRaw = Number(req.query["limit"] ?? 50);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 50;
    const rows = await db
      .select()
      .from(forensicNotesTable)
      .orderBy(desc(forensicNotesTable.createdAt))
      .limit(limit);
    res.json({ notes: rows });
  })().catch(next);
});

router.post("/", (req, res, next) => {
  (async () => {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    // Normalize suspectedClientId: accept string | number | null | undefined.
    // Numbers (legacy clients) are stringified once at the boundary; non-finite
    // numbers, objects/arrays, or empty strings are rejected with 400 (never 500,
    // never NaN). Trim string input and enforce 1..64 chars.
    let normalizedSuspectedId: string | undefined;
    const sci = raw["suspectedClientId"];
    if (sci !== undefined && sci !== null) {
      if (typeof sci === "number") {
        if (!Number.isFinite(sci)) {
          res.status(400).json({ error: "invalid suspectedClientId" });
          return;
        }
        normalizedSuspectedId = String(sci);
      } else if (typeof sci === "string") {
        const trimmed = sci.trim();
        if (trimmed.length === 0) {
          res.status(400).json({ error: "suspectedClientId cannot be empty" });
          return;
        }
        normalizedSuspectedId = trimmed;
      } else {
        res.status(400).json({ error: "invalid suspectedClientId type" });
        return;
      }
    }
    const candidate = {
      ...raw,
      ...(normalizedSuspectedId !== undefined
        ? { suspectedClientId: normalizedSuspectedId }
        : { suspectedClientId: undefined }),
    };
    const parsed = insertForensicNoteSchema.safeParse(candidate);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid note payload" });
      return;
    }
    const [row] = await db
      .insert(forensicNotesTable)
      .values(parsed.data)
      .returning();
    if (!row) {
      res.status(500).json({ error: "insert returned no row" });
      return;
    }
    res.json(row);
  })().catch(next);
});

export default router;
