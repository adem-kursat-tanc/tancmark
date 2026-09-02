import {
  assertValidDocId,
  InvalidClientIdError,
  InvalidDocIdError,
  normalizeClientId,
} from "@workspace/aegis-core";
import type {
  CandidateInput,
  ChannelBreakdownInput,
  DiffSummaryInput,
  ReportInput,
  SpatialVarianceInput,
  StylometryInput,
} from "../../lib/reportGenerator";

export type ReportInputError = Readonly<{
  status: 400;
  body: Readonly<{ error: string }>;
}>;

export function buildReportInputError(error: string): ReportInputError {
  return { status: 400, body: { error } };
}

type GenerateReportInput = Readonly<{
  suspectText: string;
  protectedText: string;
  normalizedSuspectedId: number | string | null;
  confidenceScore: number;
  matchedTokens: number;
  totalTokens: number;
  normCandidates: CandidateInput[];
  userIdStr: string | undefined;
  normChannelBreakdown: ChannelBreakdownInput | undefined;
  normStylometry: StylometryInput | undefined;
  normDiff: DiffSummaryInput | undefined;
  normSpatial: SpatialVarianceInput | undefined;
  normExpertNotes: string | undefined;
  normAbsoluteBreach: true | undefined;
  normMultiSuspect: true | undefined;
  normSuspectedClients:
    | Array<{ clientId: string; confidenceScore: number }>
    | undefined;
  normCascadeIntegrity: NonNullable<ReportInput["cascadeIntegrity"]> | undefined;
  normTieredVerdict: NonNullable<ReportInput["tieredVerdict"]> | undefined;
  normDecoyMatch: NonNullable<ReportInput["decoyMatch"]> | undefined;
  normPrimarySuspect: NonNullable<ReportInput["primarySuspect"]> | undefined;
}>;

type GenerateCloakReportInput = Readonly<{
  text: string;
  docId: string;
  clientIdStr: string;
  expertNotes: unknown;
  userId: unknown;
}>;

type NormalizeResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: ReportInputError }>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function intNonNegativeFrom(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function finiteNumberFrom(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeChannel(raw: unknown, allowPresent = false) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const matched = r["matched"];
  const total = r["total"];
  const score = r["score"];
  if (
    typeof matched !== "number" ||
    !Number.isInteger(matched) ||
    matched < 0 ||
    typeof total !== "number" ||
    !Number.isInteger(total) ||
    total < 0 ||
    matched > total ||
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 1
  ) {
    return null;
  }
  const out: { matched: number; total: number; score: number; present?: boolean } = {
    matched,
    total,
    score,
  };
  if (allowPresent) out.present = r["present"] === true;
  return out;
}

export function normalizeGenerateReportInput(
  value: unknown,
  userIdHeader: string | undefined,
): NormalizeResult<GenerateReportInput> {
  const body = asRecord(value);
  const {
    suspectText,
    protectedText,
    suspectedClientId,
    confidenceScore,
    matchedTokens,
    totalTokens,
    candidates,
    channelBreakdown,
    stylometry,
    diffSummary,
    spatialVariance,
    expertNotes,
    userId,
    absoluteBreach,
    multiSuspect,
    suspectedClients,
    cascadeIntegrity: cascadeIntegrityRaw,
    tieredVerdict: tieredVerdictRaw,
    decoyMatch: decoyMatchRaw,
    primarySuspect: primarySuspectRaw,
  } = body;

  if (typeof suspectText !== "string" || suspectText.length === 0) {
    return { ok: false, error: buildReportInputError("suspectText (non-empty string) required") };
  }
  if (typeof protectedText !== "string" || protectedText.length === 0) {
    return { ok: false, error: buildReportInputError("protectedText (non-empty string) required") };
  }
  if (
    typeof confidenceScore !== "number" ||
    !Number.isFinite(confidenceScore) ||
    confidenceScore < 0 ||
    confidenceScore > 1
  ) {
    return { ok: false, error: buildReportInputError("confidenceScore must be a finite number in [0,1]") };
  }
  if (
    typeof matchedTokens !== "number" ||
    !Number.isInteger(matchedTokens) ||
    matchedTokens < 0 ||
    typeof totalTokens !== "number" ||
    !Number.isInteger(totalTokens) ||
    totalTokens < 0
  ) {
    return { ok: false, error: buildReportInputError("matchedTokens and totalTokens must be non-negative integers") };
  }
  if (matchedTokens > totalTokens) {
    return { ok: false, error: buildReportInputError("matchedTokens cannot exceed totalTokens") };
  }

  const normCandidates: CandidateInput[] = [];
  if (candidates !== undefined && candidates !== null) {
    if (!Array.isArray(candidates)) {
      return { ok: false, error: buildReportInputError("candidates must be an array if provided") };
    }
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i] as Partial<CandidateInput> | null;
      if (
        !c ||
        typeof c !== "object" ||
        typeof c.clientId !== "string" ||
        typeof c.matchedTokens !== "number" ||
        !Number.isInteger(c.matchedTokens) ||
        c.matchedTokens < 0 ||
        typeof c.totalTokens !== "number" ||
        !Number.isInteger(c.totalTokens) ||
        c.totalTokens < 0 ||
        c.matchedTokens > c.totalTokens ||
        typeof c.confidenceScore !== "number" ||
        !Number.isFinite(c.confidenceScore) ||
        c.confidenceScore < 0 ||
        c.confidenceScore > 1
      ) {
        return { ok: false, error: buildReportInputError(`candidates[${i}] is malformed`) };
      }
      normCandidates.push({
        clientId: c.clientId,
        matchedTokens: c.matchedTokens,
        totalTokens: c.totalTokens,
        confidenceScore: c.confidenceScore,
      });
    }
  }

  const userIdStr =
    typeof userId === "string" && userId
      ? userId
      : userIdHeader
        ? String(userIdHeader)
        : undefined;

  const normalizedSuspectedId: number | string | null =
    typeof suspectedClientId === "number" || typeof suspectedClientId === "string"
      ? suspectedClientId
      : null;

  let normChannelBreakdown: ChannelBreakdownInput | undefined;
  if (channelBreakdown && typeof channelBreakdown === "object") {
    const cb = channelBreakdown as Record<string, unknown>;
    const syn = normalizeChannel(cb["synonym"]);
    const homo = normalizeChannel(cb["homoglyph"]);
    const zw = normalizeChannel(cb["zeroWidth"], true);
    if (syn && homo && zw) {
      normChannelBreakdown = {
        synonym: syn,
        homoglyph: homo,
        zeroWidth: { ...zw, present: zw.present === true },
      };
    } else {
      return { ok: false, error: buildReportInputError("channelBreakdown is malformed") };
    }
  }

  let normStylometry: StylometryInput | undefined;
  if (stylometry && typeof stylometry === "object") {
    const s = stylometry as Record<string, unknown>;
    const wordCount = intNonNegativeFrom(s, "wordCount");
    const uniqueWordCount = intNonNegativeFrom(s, "uniqueWordCount");
    const sentenceCount = intNonNegativeFrom(s, "sentenceCount");
    const avgSentenceLength = finiteNumberFrom(s, "avgSentenceLength");
    const lexicalDiversity = finiteNumberFrom(s, "lexicalDiversity");
    const stopWordCount = intNonNegativeFrom(s, "stopWordCount");
    const stopWordRatio = finiteNumberFrom(s, "stopWordRatio");
    const avgWordLength = finiteNumberFrom(s, "avgWordLength");
    const dist: Array<{ word: string; count: number }> = [];
    const distRaw = s["stopWordDistribution"];
    if (Array.isArray(distRaw)) {
      for (const e of distRaw.slice(0, 30)) {
        if (
          e &&
          typeof (e as { word?: unknown }).word === "string" &&
          typeof (e as { count?: unknown }).count === "number" &&
          Number.isInteger((e as { count: number }).count) &&
          (e as { count: number }).count >= 0
        ) {
          dist.push({
            word: String((e as { word: string }).word).slice(0, 40),
            count: (e as { count: number }).count,
          });
        }
      }
    }
    if (
      wordCount !== null &&
      uniqueWordCount !== null &&
      sentenceCount !== null &&
      avgSentenceLength !== null &&
      lexicalDiversity !== null &&
      stopWordCount !== null &&
      stopWordRatio !== null &&
      avgWordLength !== null
    ) {
      normStylometry = {
        wordCount,
        uniqueWordCount,
        sentenceCount,
        avgSentenceLength,
        lexicalDiversity,
        stopWordCount,
        stopWordRatio,
        avgWordLength,
        stopWordDistribution: dist,
      };
    } else {
      return { ok: false, error: buildReportInputError("stylometry is malformed") };
    }
  }

  let normDiff: DiffSummaryInput | undefined;
  if (diffSummary && typeof diffSummary === "object") {
    const d = diffSummary as Record<string, unknown>;
    const added = intNonNegativeFrom(d, "added");
    const removed = intNonNegativeFrom(d, "removed");
    const unchanged = intNonNegativeFrom(d, "unchanged");
    const sim = finiteNumberFrom(d, "similarity");
    if (added === null || removed === null || unchanged === null || sim === null || sim < 0 || sim > 1) {
      return { ok: false, error: buildReportInputError("diffSummary is malformed") };
    }
    normDiff = { added, removed, unchanged, similarity: sim };
  }

  let normSpatial: SpatialVarianceInput | undefined;
  if (spatialVariance && typeof spatialVariance === "object") {
    const sv = spatialVariance as Record<string, unknown>;
    const totalChars = intNonNegativeFrom(sv, "totalChars");
    const wrap = intNonNegativeFrom(sv, "wrap");
    const carriers = intNonNegativeFrom(sv, "carriers");
    const microXVariance = finiteNumberFrom(sv, "microXVariance");
    const microYVariance = finiteNumberFrom(sv, "microYVariance");
    if (
      totalChars === null ||
      wrap === null ||
      carriers === null ||
      microXVariance === null ||
      microYVariance === null
    ) {
      return { ok: false, error: buildReportInputError("spatialVariance is malformed") };
    }
    normSpatial = {
      totalChars,
      wrap,
      carriers,
      microXVariance,
      microYVariance,
    };
  }

  let normExpertNotes: string | undefined;
  if (expertNotes !== undefined && expertNotes !== null) {
    if (typeof expertNotes !== "string") {
      return { ok: false, error: buildReportInputError("expertNotes must be a string") };
    }
    const trimmed = expertNotes.trim();
    if (trimmed.length > 8000) {
      return { ok: false, error: buildReportInputError("expertNotes exceeds 8000 characters") };
    }
    if (trimmed.length > 0) normExpertNotes = trimmed;
  }

  const normAbsoluteBreach = absoluteBreach === true ? true : undefined;
  const normMultiSuspect = multiSuspect === true ? true : undefined;
  let normSuspectedClients:
    | Array<{ clientId: string; confidenceScore: number }>
    | undefined;
  if (Array.isArray(suspectedClients)) {
    const seen = new Set<string>();
    const cleaned: Array<{ clientId: string; confidenceScore: number }> = [];
    for (const s of suspectedClients) {
      if (!s || typeof s !== "object") continue;
      const rawId = (s as { clientId?: unknown }).clientId;
      if (typeof rawId !== "string") continue;
      const id = rawId.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const cs = (s as { confidenceScore?: unknown }).confidenceScore;
      cleaned.push({
        clientId: id,
        confidenceScore:
          typeof cs === "number" && Number.isFinite(cs) ? cs : 0,
      });
    }
    if (cleaned.length > 0) normSuspectedClients = cleaned;
  }

  let normCascadeIntegrity: NonNullable<ReportInput["cascadeIntegrity"]> | undefined;
  if (cascadeIntegrityRaw && typeof cascadeIntegrityRaw === "object") {
    const c = cascadeIntegrityRaw as Record<string, unknown>;
    const score = c.integrityScore;
    const broken = c.brokenAtIndex;
    const totalStored = c.totalStored;
    const totalCandidate = c.totalCandidate;
    const insertedCount = c.insertedCount;
    const deletedIndices = Array.isArray(c.deletedIndices)
      ? c.deletedIndices.filter((x): x is number => Number.isInteger(x) && (x as number) >= 0)
      : [];
    const modifiedIndices = Array.isArray(c.modifiedIndices)
      ? c.modifiedIndices.filter((x): x is number => Number.isInteger(x) && (x as number) >= 0)
      : [];
    if (
      typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1 &&
      (broken === null || (Number.isInteger(broken) && (broken as number) >= 0)) &&
      Number.isInteger(totalStored) && (totalStored as number) >= 0 &&
      Number.isInteger(totalCandidate) && (totalCandidate as number) >= 0 &&
      Number.isInteger(insertedCount) && (insertedCount as number) >= 0
    ) {
      normCascadeIntegrity = {
        integrityScore: score,
        brokenAtIndex: broken === null ? null : (broken as number),
        deletedIndices,
        modifiedIndices,
        reorderedDetected: c.reorderedDetected === true,
        insertedCount: insertedCount as number,
        totalStored: totalStored as number,
        totalCandidate: totalCandidate as number,
      };
    }
  }

  let normTieredVerdict: NonNullable<ReportInput["tieredVerdict"]> | undefined;
  if (tieredVerdictRaw && typeof tieredVerdictRaw === "object") {
    const t = tieredVerdictRaw as Record<string, unknown>;
    const verdict = t.verdict;
    const reasons = t.reasons;
    const channelProfile = t.channelProfile;
    const strongCount = t.strongCandidateCount;
    const margin = t.margin;
    const attributed = t.attributedClientIds;
    const validVerdict =
      verdict === "STRONG" || verdict === "AMBIGUOUS" || verdict === "INSUFFICIENT";
    const validProfile =
      Array.isArray(channelProfile) &&
      channelProfile.every(
        (p) =>
          p &&
          typeof p === "object" &&
          typeof (p as { name?: unknown }).name === "string" &&
          ["T0", "T1", "T2", "AUX"].includes(
            (p as { tier?: unknown }).tier as string,
          ) &&
          typeof (p as { score?: unknown }).score === "number" &&
          Number.isFinite((p as { score: number }).score) &&
          typeof (p as { decay?: unknown }).decay === "number" &&
          typeof (p as { vital?: unknown }).vital === "boolean" &&
          typeof (p as { present?: unknown }).present === "boolean",
      );
    if (
      validVerdict &&
      Array.isArray(reasons) &&
      reasons.every((r) => typeof r === "string") &&
      validProfile &&
      Number.isInteger(strongCount) &&
      (strongCount as number) >= 0 &&
      (margin === null || (typeof margin === "number" && Number.isFinite(margin))) &&
      Array.isArray(attributed) &&
      attributed.every((a) => typeof a === "string")
    ) {
      normTieredVerdict = {
        verdict: verdict as "STRONG" | "AMBIGUOUS" | "INSUFFICIENT",
        attributedClientIds: attributed as string[],
        reasons: reasons as string[],
        marginGuardDemoted: t.marginGuardDemoted === true,
        multiSuspectDemoted: t.multiSuspectDemoted === true,
        margin: margin === null ? null : (margin as number),
        strongCandidateCount: strongCount as number,
        channelProfile: (channelProfile as Array<Record<string, unknown>>).map(
          (p) => {
            const out: NonNullable<ReportInput["tieredVerdict"]>["channelProfile"][number] = {
              name: p.name as string,
              tier: p.tier as "T0" | "T1" | "T2" | "AUX",
              score: p.score as number,
              decay: p.decay as number,
              vital: p.vital as boolean,
              present: p.present as boolean,
            };
            if (typeof p.note === "string") out.note = p.note;
            return out;
          },
        ),
      };
    }
  }

  let normDecoyMatch: NonNullable<ReportInput["decoyMatch"]> | undefined;
  if (decoyMatchRaw && typeof decoyMatchRaw === "object") {
    const d = decoyMatchRaw as Record<string, unknown>;
    const tokensFound = typeof d["tokensFound"] === "number" ? (d["tokensFound"] as number) : 0;
    const tagCp = typeof d["tagCodepointCount"] === "number" ? (d["tagCodepointCount"] as number) : 0;
    const multi = d["multiEmission"] === true;
    const unknownCount = typeof d["unknownTokenCount"] === "number" ? (d["unknownTokenCount"] as number) : 0;
    const normPrimary = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return null;
      const e = raw as Record<string, unknown>;
      if (
        typeof e["clientId"] !== "string" ||
        typeof e["docId"] !== "string" ||
        typeof e["viewerId"] !== "string" ||
        typeof e["emittedAt"] !== "string"
      ) return null;
      return {
        clientId: e["clientId"] as string,
        docId: e["docId"] as string,
        viewerId: e["viewerId"] as string,
        emittedAt: e["emittedAt"] as string,
      };
    };
    const normOther = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return null;
      const e = raw as Record<string, unknown>;
      if (
        typeof e["clientId"] !== "string" ||
        typeof e["viewerId"] !== "string" ||
        typeof e["emittedAt"] !== "string"
      ) return null;
      return {
        clientId: e["clientId"] as string,
        viewerId: e["viewerId"] as string,
        emittedAt: e["emittedAt"] as string,
      };
    };
    const others = Array.isArray(d["otherEmissions"])
      ? (d["otherEmissions"] as unknown[])
          .map(normOther)
          .filter((e): e is NonNullable<ReturnType<typeof normOther>> => e !== null)
      : [];
    normDecoyMatch = {
      tokensFound,
      tagCodepointCount: tagCp,
      multiEmission: multi,
      primaryEmission: normPrimary(d["primaryEmission"]),
      otherEmissions: others,
      unknownTokenCount: unknownCount,
    };
  }

  let normPrimarySuspect: NonNullable<ReportInput["primarySuspect"]> | undefined;
  if (primarySuspectRaw && typeof primarySuspectRaw === "object") {
    const p = primarySuspectRaw as Record<string, unknown>;
    const sourceRaw = p["source"];
    const validSources = ["honeytoken", "multi-channel", "decoy", "none"] as const;
    const source = (validSources as readonly string[]).includes(sourceRaw as string)
      ? (sourceRaw as (typeof validSources)[number])
      : null;
    const cidRaw = p["clientId"];
    const clientId = typeof cidRaw === "string" ? cidRaw : null;
    const mc = p["matchConfidence"];
    const matchConfidence: "preliminary" | "vault-confirmed" =
      mc === "vault-confirmed" ? "vault-confirmed" : "preliminary";
    if (source !== null) {
      normPrimarySuspect = {
        source,
        clientId,
        ...(typeof p["decoyViewerId"] === "string"
          ? { decoyViewerId: p["decoyViewerId"] as string }
          : {}),
        matchConfidence,
      };
    }
  }

  return {
    ok: true,
    value: {
      suspectText,
      protectedText,
      normalizedSuspectedId,
      confidenceScore,
      matchedTokens,
      totalTokens,
      normCandidates,
      userIdStr,
      normChannelBreakdown,
      normStylometry,
      normDiff,
      normSpatial,
      normExpertNotes,
      normAbsoluteBreach,
      normMultiSuspect,
      normSuspectedClients,
      normCascadeIntegrity,
      normTieredVerdict,
      normDecoyMatch,
      normPrimarySuspect,
    },
  };
}

export function normalizeGenerateCloakReportInput(
  value: unknown,
): NormalizeResult<GenerateCloakReportInput> {
  const body = asRecord(value);
  const { text, docId, clientId, expertNotes, userId } = body;
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, error: buildReportInputError("text (non-empty string) required") };
  }
  let clientIdStr: string;
  try {
    clientIdStr = normalizeClientId(clientId);
  } catch (err) {
    if (err instanceof InvalidClientIdError) {
      return { ok: false, error: buildReportInputError(`clientId invalid: ${err.message}`) };
    }
    throw err;
  }
  try {
    assertValidDocId(docId);
  } catch (err) {
    if (err instanceof InvalidDocIdError) {
      return { ok: false, error: buildReportInputError(err.message) };
    }
    throw err;
  }
  return {
    ok: true,
    value: {
      text,
      docId,
      clientIdStr,
      expertNotes,
      userId,
    },
  };
}
