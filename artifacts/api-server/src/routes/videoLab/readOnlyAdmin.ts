import type { IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  aegisDnaRecordsTable,
  aegisImprovementSuggestionsTable,
  aegisTestHistoryTable,
} from "@workspace/db";
import { requireAdminToken } from "../../middlewares/adminAuth";
import {
  buildImprovementSuggestionsResponse,
  buildLearningSummaryResponse,
  clampReadOnlyLimit,
} from "./readOnlyAdminHelpers";

type LastVideoTestSummary = {
  fileName?: string;
  testTime?: string;
  verdict?: string;
  mainVerdict?: string;
  finalDecision?: unknown;
  idMatched?: boolean;
  dnaRecordPresent?: boolean;
  dbRecordPresent?: boolean;
  stampedFrameCount?: number;
  strongFrames?: number;
  vaultFrames?: number;
  pathLabel?: string;
  durationMs?: number;
  note?: string | null;
  idHex?: string | null;
  dnaId?: string | null;
  [key: string]: unknown;
};

type NormalizedLatestVideoTestSummary = Required<
  Pick<
    LastVideoTestSummary,
    | "fileName"
    | "testTime"
    | "verdict"
    | "mainVerdict"
    | "finalDecision"
    | "idMatched"
    | "dnaRecordPresent"
    | "dbRecordPresent"
    | "stampedFrameCount"
    | "strongFrames"
    | "vaultFrames"
    | "pathLabel"
    | "durationMs"
    | "note"
  >
> & { idHex: string | null; dnaId: string | null };

type VideoLabSuggestion = {
  topic: string;
  severity: string;
  suggestion: string;
  reason: string;
};

type VideoLabReadOnlyAdminDeps = {
  readLatestVideoTestSummary: () => LastVideoTestSummary;
  normalizeLatestVideoTestSummary: (
    summary: LastVideoTestSummary,
  ) => NormalizedLatestVideoTestSummary;
  ensureLatestVideoTestInHistory: (
    summary: LastVideoTestSummary,
  ) => Promise<void>;
  ensureSuggestionForTest: (
    test: typeof aegisTestHistoryTable.$inferSelect,
  ) => Promise<void>;
  buildActionPlan: (suggestion: VideoLabSuggestion) => unknown;
  isOfficialVaultDecision: (verdict: string | null | undefined) => boolean;
  rawFinalDecisionLabel: (raw: Record<string, unknown>) => string | null;
  buildExecutionModeTelemetry: (activeMode: "learning") => unknown;
};

export function registerVideoLabReadOnlyAdminRoutes(
  router: IRouter,
  deps: VideoLabReadOnlyAdminDeps,
): void {
  router.get("/latest-test", requireAdminToken, async (_req, res) => {
    try {
      const summary = deps.readLatestVideoTestSummary();
      const normalized = deps.normalizeLatestVideoTestSummary(summary);
      const dnaId = normalized.dnaId;
      let dbDnaRows = 0;

      if (dnaId) {
        const rows = await db
          .select({ dnaId: aegisDnaRecordsTable.dnaId })
          .from(aegisDnaRecordsTable)
          .where(eq(aegisDnaRecordsTable.dnaId, dnaId))
          .limit(1);
        dbDnaRows = rows.length;
      }

      const enriched = {
        ...summary,
        ...normalized,
        dbDnaRows,
        dbRecordPresent: dbDnaRows > 0,
        dnaRecordPresent: dbDnaRows > 0,
      };
      await deps.ensureLatestVideoTestInHistory(enriched);

      res.json({
        ...enriched,
        apiOk: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/test-history", requireAdminToken, async (req, res) => {
    const limit = clampReadOnlyLimit(req.query.limit, 10, 10);

    try {
      try {
        await deps.ensureLatestVideoTestInHistory(
          deps.readLatestVideoTestSummary(),
        );
      } catch {
        // History can still be listed when the local latest-test file is absent.
      }

      const tests = await db
        .select()
        .from(aegisTestHistoryTable)
        .orderBy(desc(aegisTestHistoryTable.testTime))
        .limit(limit);

      res.json({ tests });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/learning-summary", requireAdminToken, async (_req, res) => {
    try {
      try {
        await deps.ensureLatestVideoTestInHistory(
          deps.readLatestVideoTestSummary(),
        );
      } catch {
        // Learning can still summarize existing DB rows when the local file is absent.
      }

      const tests = await db
        .select()
        .from(aegisTestHistoryTable)
        .orderBy(desc(aegisTestHistoryTable.testTime))
        .limit(10);

      await Promise.all(tests.map((t) => deps.ensureSuggestionForTest(t)));

      const suggestions = await db
        .select()
        .from(aegisImprovementSuggestionsTable)
        .orderBy(desc(aegisImprovementSuggestionsTable.createdAt))
        .limit(50);
      res.json(
        buildLearningSummaryResponse({
          tests,
          suggestions,
          isOfficialVaultDecision: deps.isOfficialVaultDecision,
          rawFinalDecisionLabel: deps.rawFinalDecisionLabel,
          buildExecutionModeTelemetry: deps.buildExecutionModeTelemetry,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/improvement-suggestions", requireAdminToken, async (req, res) => {
    const limit = clampReadOnlyLimit(req.query.limit, 20, 50);

    try {
      try {
        await deps.ensureLatestVideoTestInHistory(
          deps.readLatestVideoTestSummary(),
        );
      } catch {
        // Existing DB rows are enough to list suggestions.
      }

      const tests = await db
        .select()
        .from(aegisTestHistoryTable)
        .orderBy(desc(aegisTestHistoryTable.testTime))
        .limit(10);
      await Promise.all(tests.map((t) => deps.ensureSuggestionForTest(t)));

      const suggestions = await db
        .select()
        .from(aegisImprovementSuggestionsTable)
        .orderBy(desc(aegisImprovementSuggestionsTable.createdAt))
        .limit(limit);

      res.json(
        buildImprovementSuggestionsResponse({
          suggestions,
          buildActionPlan: deps.buildActionPlan,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });
}
