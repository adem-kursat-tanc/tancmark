type ReadOnlyTestRow = {
  id: unknown;
  testTime: unknown;
  fileName: string;
  verdict: string;
  idMatched: boolean;
  dnaRecordPresent: boolean;
  dbRecordPresent: boolean;
  strongFrames: number;
  vaultFrames: number;
  pathLabel: string;
  raw: unknown;
};

type ReadOnlySuggestionRow = {
  status: string;
  severity: string;
  createdAt: Date;
  topic: string;
  suggestion: string;
  reason: string;
  [key: string]: unknown;
};

type BuildLearningSummaryResponseInput<
  TTest extends ReadOnlyTestRow,
  TSuggestion extends ReadOnlySuggestionRow,
> = {
  tests: TTest[];
  suggestions: TSuggestion[];
  isOfficialVaultDecision: (verdict: string | null | undefined) => boolean;
  rawFinalDecisionLabel: (raw: Record<string, unknown>) => string | null;
  buildExecutionModeTelemetry: (activeMode: "learning") => unknown;
};

type BuildImprovementSuggestionsResponseInput<
  TSuggestion extends ReadOnlySuggestionRow,
> = {
  suggestions: TSuggestion[];
  buildActionPlan: (suggestion: TSuggestion) => unknown;
};

export function clampReadOnlyLimit(
  value: unknown,
  fallback: number,
  max: number,
): number {
  const limitRaw = Number.parseInt(String(value ?? String(fallback)), 10);
  return Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), max)
    : fallback;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function extractRecordField(row: ReadOnlyTestRow, key: string): unknown {
  return objectRecord(row.raw)?.[key];
}

function collectDnaShadowComparisons(
  tests: ReadOnlyTestRow[],
): Record<string, unknown>[] {
  return tests
    .map((t) => extractRecordField(t, "dnaPreAnalysisComparison"))
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object");
}

function collectDnaPilotTraces(tests: ReadOnlyTestRow[]): Record<string, unknown>[] {
  return tests
    .map((t) => extractRecordField(t, "dnaPilotTrace"))
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object");
}

function buildLatestDnaPilotTrace(dnaPilotTraces: Record<string, unknown>[]) {
  return dnaPilotTraces.length > 0
    ? {
        verdict: dnaPilotTraces[0]["verdict"] ?? null,
        matchingBits: dnaPilotTraces[0]["matchingBits"] ?? null,
        idMatched: dnaPilotTraces[0]["idMatched"] ?? null,
        selectedRegionId: dnaPilotTraces[0]["selectedRegionId"] ?? null,
        bestGeometryVariant: dnaPilotTraces[0]["bestGeometryVariant"] ?? null,
        canOpenVault: dnaPilotTraces[0]["canOpenVault"] ?? false,
      }
    : null;
}

function buildLatestDnaShadowLearning(
  dnaShadowComparisons: Record<string, unknown>[],
) {
  return dnaShadowComparisons.length > 0
    ? {
        scenario: dnaShadowComparisons[0]["scenario"] ?? null,
        prediction: dnaShadowComparisons[0]["prediction"] ?? null,
        matched: dnaShadowComparisons[0]["matchesPrediction"] === true,
        lesson: dnaShadowComparisons[0]["lesson"] ?? null,
        weakChannel: dnaShadowComparisons[0]["weakChannel"] ?? null,
        rescuedBy: dnaShadowComparisons[0]["rescuedBy"] ?? null,
        suggestedNextStep: dnaShadowComparisons[0]["suggestedNextStep"] ?? null,
        placementPilot: dnaShadowComparisons[0]["placementPilot"] ?? null,
      }
    : null;
}

function countWarnings(
  tests: ReadOnlyTestRow[],
  isOfficialVaultDecision: (verdict: string | null | undefined) => boolean,
): string {
  const warnings = tests.flatMap((t) => {
    const result: string[] = [];
    if (!isOfficialVaultDecision(t.verdict)) result.push("VAULT yok");
    if (!t.idMatched) result.push("ID okunmadi");
    if (!t.dnaRecordPresent || !t.dbRecordPresent) result.push("DNA kaydi yok");
    if (t.strongFrames >= 10 && !isOfficialVaultDecision(t.verdict)) {
      result.push("Sinyal var ama ID katmani zayif");
    }
    if (t.vaultFrames < 2) result.push("vaultFrames dusuk");
    return result;
  });
  const warningCounts = warnings.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
  return (
    Object.entries(warningCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    (tests.length > 0 ? "Belirgin uyari yok" : "Test kaydi yok")
  );
}

function chooseRecommendation(
  latest: ReadOnlyTestRow | undefined,
  isOfficialVaultDecision: (verdict: string | null | undefined) => boolean,
): string {
  let recommendation = "Once kucuk test kaydi olusturulmali";
  if (latest) {
    if (!latest.idMatched) {
      recommendation = "ID okuma dayanikliligi guclendirilmeli";
    } else if (latest.verdict === "VISUAL_VAULT") {
      recommendation = "Gorsel modul ID'yi kurtardi; video A/B yolu ayrica izlenmeli";
    } else if (latest.verdict === "AUDIO_VAULT") {
      recommendation = "Ses modulu ID'yi kurtardi; video/gorsel yolu ayrica izlenmeli";
    } else if (latest.verdict === "DNA_VAULT") {
      recommendation = "DNA kanali ID'yi kurtardi; klasik A/B crop altinda zayif kaldi";
    } else if (latest.verdict === "MULTI_CHANNEL_VAULT") {
      recommendation = "Birden fazla resmi kanal birlikte dogruladi; mevcut yol korunmali";
    } else if (!latest.dnaRecordPresent && latest.strongFrames > 0) {
      recommendation = "DNA yedek arama kurali dogru calisiyor";
    } else if (latest.strongFrames >= 10 && !isOfficialVaultDecision(latest.verdict)) {
      recommendation = "Sinyal var ama ID tasiyan katman zayif";
    } else if (latest.vaultFrames < 2) {
      recommendation = "Muhur tekrar sayisi veya kare secimi incelenmeli";
    } else if (isOfficialVaultDecision(latest.verdict)) {
      recommendation = "Mevcut yol korunmali, daha zor testlere kontrollu gecilebilir";
    }
  }
  return recommendation;
}

function findHighestPrioritySuggestion<TSuggestion extends ReadOnlySuggestionRow>(
  suggestions: TSuggestion[],
): TSuggestion | null {
  const severityRank: Record<string, number> = { yuksek: 3, orta: 2, dusuk: 1 };
  const openSuggestions = suggestions.filter(
    (s) => s.status === "bekliyor" || s.status === "onaylandi",
  );
  return (
    openSuggestions
      .slice()
      .sort(
        (a, b) =>
          (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )[0] ?? null
  );
}

export function buildLearningSummaryResponse<
  TTest extends ReadOnlyTestRow,
  TSuggestion extends ReadOnlySuggestionRow,
>(input: BuildLearningSummaryResponseInput<TTest, TSuggestion>) {
  const { tests, suggestions, isOfficialVaultDecision } = input;
  const pendingSuggestions = suggestions.filter((s) => s.status === "bekliyor");
  const approvedSuggestions = suggestions.filter((s) => s.status === "onaylandi");
  const completedSuggestions = suggestions.filter((s) => s.status === "tamamlandi");
  const highestPrioritySuggestion = findHighestPrioritySuggestion(suggestions);

  const totalTests = tests.length;
  const successfulTests = tests.filter((t) =>
    isOfficialVaultDecision(t.verdict),
  ).length;
  const classicVaultCount = tests.filter((t) => t.verdict === "VAULT").length;
  const visualVaultCount = tests.filter((t) => t.verdict === "VISUAL_VAULT").length;
  const audioVaultCount = tests.filter((t) => t.verdict === "AUDIO_VAULT").length;
  const dnaVaultCount = tests.filter((t) => t.verdict === "DNA_VAULT").length;
  const multiChannelVaultCount = tests.filter(
    (t) => t.verdict === "MULTI_CHANNEL_VAULT",
  ).length;
  const failedTests = totalTests - successfulTests;
  const idMatchedCount = tests.filter((t) => t.idMatched).length;
  const dnaRecordCount = tests.filter(
    (t) => t.dnaRecordPresent && t.dbRecordPresent,
  ).length;
  const avgStrongFrames =
    totalTests === 0
      ? 0
      : tests.reduce((sum, t) => sum + t.strongFrames, 0) / totalTests;
  const avgVaultFrames =
    totalTests === 0
      ? 0
      : tests.reduce((sum, t) => sum + t.vaultFrames, 0) / totalTests;
  const latest = tests[0];
  const latestPath = latest?.pathLabel ?? "Bilinmiyor";
  const dnaShadowComparisons = collectDnaShadowComparisons(tests);
  const dnaShadowPredictionMatched = dnaShadowComparisons.filter(
    (c) => c["matchesPrediction"] === true,
  ).length;
  const dnaPlacementPilotComparisons = dnaShadowComparisons.filter((c) => {
    const pilot = c["placementPilot"];
    return (
      pilot !== null &&
      typeof pilot === "object" &&
      (pilot as Record<string, unknown>)["enabled"] === true
    );
  });
  const dnaPilotTraces = collectDnaPilotTraces(tests);
  const activeDnaPilotTraces = dnaPilotTraces.filter(
    (t) => t["activeTraceApplied"] === true,
  );
  const latestDnaPilotTrace = buildLatestDnaPilotTrace(dnaPilotTraces);
  const latestDnaShadowLearning =
    buildLatestDnaShadowLearning(dnaShadowComparisons);
  const mostCommonWarning = countWarnings(tests, isOfficialVaultDecision);
  const recommendation = chooseRecommendation(latest, isOfficialVaultDecision);
  const shortComment =
    totalTests === 0
      ? "Henuz ogrenilecek test kaydi yok."
      : `${totalTests} test icinde ${successfulTests} VAULT sonucu var. Son yol: ${latestPath}. En belirgin uyari: ${mostCommonWarning}.`;

  return {
    totalTests,
    successfulTests,
    failedTests,
    classicVaultCount,
    visualVaultCount,
    audioVaultCount,
    dnaVaultCount,
    multiChannelVaultCount,
    vaultRate: totalTests === 0 ? 0 : successfulTests / totalTests,
    idMatchRate: totalTests === 0 ? 0 : idMatchedCount / totalTests,
    dnaRecordRate: totalTests === 0 ? 0 : dnaRecordCount / totalTests,
    avgStrongFrames,
    avgVaultFrames,
    latestPath,
    mostCommonWarning,
    recommendation,
    latestSuggestion: suggestions[0] ?? null,
    highestPrioritySuggestion,
    pendingSuggestionCount: pendingSuggestions.length,
    approvedSuggestionCount: approvedSuggestions.length,
    completedSuggestionCount: completedSuggestions.length,
    dnaShadowComparisonCount: dnaShadowComparisons.length,
    dnaShadowPredictionMatched,
    dnaPlacementPilotCount: dnaPlacementPilotComparisons.length,
    dnaActivePilotTraceCount: activeDnaPilotTraces.length,
    latestDnaPilotTrace,
    latestDnaShadowLearning,
    executionMode: input.buildExecutionModeTelemetry("learning"),
    shortComment,
    testsConsidered: tests.map((t) => ({
      id: t.id,
      testTime: t.testTime,
      fileName: t.fileName,
      verdict: t.verdict,
      idMatched: t.idMatched,
      finalDecision: objectRecord(t.raw)
        ? input.rawFinalDecisionLabel(t.raw as Record<string, unknown>)
        : null,
      dnaRecordPresent: t.dnaRecordPresent && t.dbRecordPresent,
      strongFrames: t.strongFrames,
      vaultFrames: t.vaultFrames,
      pathLabel: t.pathLabel,
    })),
  };
}

export function buildImprovementSuggestionsResponse<
  TSuggestion extends ReadOnlySuggestionRow,
>(input: BuildImprovementSuggestionsResponseInput<TSuggestion>) {
  return {
    suggestions: input.suggestions.map((s) => ({
      ...s,
      actionPlan: s.status === "onaylandi" ? input.buildActionPlan(s) : null,
    })),
  };
}
