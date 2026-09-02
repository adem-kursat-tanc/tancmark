import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { desc, eq } from "drizzle-orm";
import {
  db,
  aegisDnaRecordsTable,
  aegisImprovementSuggestionsTable,
  aegisTestHistoryTable,
} from "@workspace/db";
import {
  assertValidDocId,
  InvalidClientIdError,
  InvalidDocIdError,
  normalizeClientId,
} from "@workspace/aegis-core";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  createSecureMemoryUpload,
  MULTIPART_UPLOAD_PROFILES,
} from "../middlewares/multipartUploadSecurity";
import { encodeVideo } from "../video/encodeVideo";
import { decodeVideo } from "../video/decodeVideo";
import { extractFrames, mediaStreamInfo, videoInfo } from "../video/ffmpegHelper";
import {
  buildDnaPilotTracePlan,
  decodeDnaPilotTraceFromFramePaths,
  emptyDnaPilotTraceTelemetry,
} from "../video/dnaPlacementPilot";
import { decodeVideoVisualModuleFromDna } from "../video/visualModuleSeal";
import { decodeAudioV01FromDna } from "../video/audioModule";
import { decodeVideoEccRecoveryFromDna } from "../video/videoEccRecovery";
import {
  dnaFrameHintEnabled,
  readDnaChannelBHint,
  readDnaFrameHint,
} from "../dna/dnaFrameHint";
import type { DnaPreAnalysisReport } from "../dna/preAnalysis";
import { compareDnaPreAnalysisWithVideoResult } from "../dna/preAnalysis";
import { buildCommonMediaDecisionPhase1 } from "../orchestrator/commonMediaDecision";
import {
  recordSecureRoomModuleSummaryFireAndForget,
  summarizeCommonMediaDecision,
} from "../lib/secureRoomSummary";
import {
  preSealOwnershipCheck,
  type PreSealOwnershipCheckResult,
} from "../lib/preSealOwnershipCheck";
import { registerVideoLabDnaReadOnlyRoute } from "./videoLab/dnaReadOnly";
import { registerVideoLabReadOnlyAdminRoutes } from "./videoLab/readOnlyAdmin";

/** Route-level DNA hint provider. Bayrak kapalıyken `undefined` döner; encode/
 *  decode'a hiç geçirilmez ⇒ behavior byte-identical. Bayrak açıkken DB'den
 *  hint okur; hit olmazsa (miss/empty/out_of_range/db_error) `undefined`
 *  döner ⇒ encoder/decoder eski yolla devam eder. */
function makeDnaHintProvider(): undefined | ((info: {
  totalFrames: number;
  idHex: string;
}) => Promise<readonly number[] | undefined>) {
  if (!dnaFrameHintEnabled()) return undefined;
  return async (info) => {
    const r = await readDnaFrameHint({
      idHex: info.idHex,
      totalFrames: info.totalFrames,
    });
    return r.reason === "hit" ? r.hintIdxs : undefined;
  };
}

function makeDnaChannelBHintProvider(): undefined | ((info: {
  totalFrames: number;
  idHex: string;
}) => Promise<readonly number[] | undefined>) {
  if (!dnaFrameHintEnabled()) return undefined;
  return async (info) => {
    const r = await readDnaChannelBHint({
      idHex: info.idHex,
      totalFrames: info.totalFrames,
    });
    return r.reason === "hit" ? r.hintIdxs : undefined;
  };
}

const router: IRouter = Router();

const miniTestUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.videoMiniTest);
const encodeUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.videoEncode);
const decodeUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.videoDecode);

const WORK_BASE = path.join(os.tmpdir(), "aegis-video-lab");
fs.mkdirSync(WORK_BASE, { recursive: true });

// Sprint 1 video repair: keep the same v0.5A stamp/ID logic, but place the
// same ID on more independent video frames for mini-test durability.
const MINI_TEST_DEFAULT_STAMP_COUNT = 48;

type LastVideoTestSummary = {
  fileName?: string;
  scenario?: string;
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
  channelAIdMatched?: boolean;
  channelBIdMatched?: boolean;
  bothChannelsMatched?: boolean;
  singleChannelMatched?: boolean;
  finalConfirmedBy?: string;
  channelBMatchingBits?: number;
  channelBFrameCount?: number;
  dnaPreAnalysis?: unknown;
  dnaPreAnalysisComparison?: unknown;
  dnaPlacementPilot?: unknown;
  dnaPilotTrace?: unknown;
  visualModuleTrace?: unknown;
  audioModuleTrace?: unknown;
  videoEccRecoveryTrace?: unknown;
  executionMode?: unknown;
  commonMediaDecision?: unknown;
  decisionBoard?: unknown;
  videoImageSupport?: unknown;
  dnaFrameHint?: unknown;
  mediaStreams?: unknown;
};

type AegisExecutionMode = "product" | "test" | "learning";

type AegisVideoFinalDecision =
  | "VAULT"
  | "VISUAL_VAULT"
  | "AUDIO_VAULT"
  | "DNA_VAULT"
  | "MULTI_CHANNEL_VAULT"
  | "NOT_FOUND";

function buildVideoFinalDecision(input: {
  mainVerdict?: string;
  channelAIdMatched?: boolean;
  channelBIdMatched?: boolean;
  dnaPilotTrace?: unknown;
  visualModuleTrace?: unknown;
  audioModuleTrace?: unknown;
  dnaActivePlacementPilot?: boolean;
}) {
  const pilot =
    input.dnaPilotTrace && typeof input.dnaPilotTrace === "object"
      ? (input.dnaPilotTrace as Record<string, unknown>)
      : {};
  const visual =
    input.visualModuleTrace && typeof input.visualModuleTrace === "object"
      ? (input.visualModuleTrace as Record<string, unknown>)
      : {};
  const audio =
    input.audioModuleTrace && typeof input.audioModuleTrace === "object"
      ? (input.audioModuleTrace as Record<string, unknown>)
      : {};
  const matchingBits =
    typeof pilot["matchingBits"] === "number"
      ? Number(pilot["matchingBits"])
      : 0;
  const visualMatchingBits =
    typeof visual["matchingBitsMax"] === "number"
      ? Number(visual["matchingBitsMax"])
      : 0;
  const expectedPayloadHex =
    typeof pilot["expectedPayloadHex"] === "string"
      ? String(pilot["expectedPayloadHex"])
      : "";
  const candidatePayloadHex =
    typeof pilot["candidatePayloadHex"] === "string"
      ? String(pilot["candidatePayloadHex"])
      : "";
  const dnaActive =
    input.dnaActivePlacementPilot === true &&
    pilot["activeTraceApplied"] === true;
  const dnaIdMatched =
    dnaActive &&
    pilot["idMatched"] === true &&
    pilot["verdict"] === "PILOT_ID_MATCH" &&
    matchingBits === 32 &&
    expectedPayloadHex.length > 0 &&
    candidatePayloadHex === expectedPayloadHex;
  const channelAIdMatched = input.channelAIdMatched === true;
  const channelBIdMatched = input.channelBIdMatched === true;
  const classicVault =
    input.mainVerdict === "VAULT" &&
    (channelAIdMatched || channelBIdMatched);
  const visualIdMatched =
    visual["idMatched"] === true &&
    visual["verdict"] === "VISUAL_ID_MATCH" &&
    visualMatchingBits === 32;
  const audioMatchingBits =
    typeof audio["matchingBitsMax"] === "number"
      ? Number(audio["matchingBitsMax"])
      : 0;
  const audioIdMatched =
    audio["idMatched"] === true &&
    audio["verdict"] === "AUDIO_ID_MATCH" &&
    audioMatchingBits === 32;
  const confirmedChannels = [
    ...(classicVault ? ["video"] : []),
    ...(visualIdMatched ? ["visual"] : []),
    ...(audioIdMatched ? ["audio"] : []),
    ...(dnaIdMatched ? ["dna"] : []),
  ];
  const decision: AegisVideoFinalDecision =
    confirmedChannels.length >= 2
      ? "MULTI_CHANNEL_VAULT"
      : visualIdMatched
        ? "VISUAL_VAULT"
        : audioIdMatched
          ? "AUDIO_VAULT"
          : dnaIdMatched
            ? "DNA_VAULT"
            : classicVault
              ? "VAULT"
              : "NOT_FOUND";

  return {
    decision,
    mainVerdict: input.mainVerdict ?? "NOT_FOUND",
    idMatched: decision !== "NOT_FOUND",
    classicVault,
    visualVault: visualIdMatched,
    audioVault: audioIdMatched,
    dnaVault: dnaIdMatched,
    multiChannelVault: decision === "MULTI_CHANNEL_VAULT",
    channelAIdMatched,
    channelBIdMatched,
    dnaIdMatched,
    visualIdMatched,
    audioIdMatched,
    confirmedChannels,
    confirmedBy:
      decision === "MULTI_CHANNEL_VAULT"
        ? confirmedChannels.join("_and_")
        : decision === "VISUAL_VAULT"
          ? "visual_module"
        : decision === "AUDIO_VAULT"
          ? "audio_module"
        : decision === "DNA_VAULT"
          ? "dna_active_pilot_trace"
          : classicVault
            ? channelAIdMatched && channelBIdMatched
              ? "classic_a_b"
              : channelAIdMatched
                ? "classic_a"
                : "classic_b"
            : "none",
    dnaConditions: {
      activeFlagRequired: true,
      activeFlagOn: input.dnaActivePlacementPilot === true,
      activeTraceApplied: pilot["activeTraceApplied"] === true,
      pilotVerdict: pilot["verdict"] ?? null,
      matchingBits,
      bitRequirement: 32,
      idMatched: pilot["idMatched"] === true,
      expectedPayloadHex,
      candidatePayloadHex,
      payloadMatches: candidatePayloadHex === expectedPayloadHex,
    },
    visualConditions: {
      visualVerdict: visual["verdict"] ?? null,
      matchingBits: visualMatchingBits,
      bitRequirement: 32,
      idMatched: visual["idMatched"] === true,
      matchedTraceIds: Array.isArray(visual["matchedTraceIds"])
        ? visual["matchedTraceIds"]
        : [],
      canOpenVisualVault: visual["canOpenVisualVault"] === true,
    },
    audioConditions: {
      audioVerdict: audio["verdict"] ?? null,
      matchingBits: audioMatchingBits,
      bitRequirement: 32,
      idMatched: audio["idMatched"] === true,
      matchedTraceIds: Array.isArray(audio["matchedTraceIds"])
        ? audio["matchedTraceIds"]
        : [],
      canOpenAudioVault: audio["canOpenAudioVault"] === true,
    },
    safety: {
      noVaultWithoutId: true,
      weakSignalIsNotSuccess: true,
      thresholdsChanged: false,
      channelABChanged: false,
      channelCAdded: false,
      dnaSignalOnlyIsNotEnough: true,
      visualSignalOnlyIsNotEnough: true,
      audioSignalOnlyIsNotEnough: true,
    },
    note:
      decision === "VISUAL_VAULT"
        ? "Gorsel modul kendi ID izinden 32/32 eslesme verdi; video A/B VAULT ile karistirilmaz."
        : decision === "AUDIO_VAULT"
        ? "Ses modulu kendi ID izinden 32/32 eslesme verdi; video/gorsel parcalariyla birlestirilmez."
        : decision === "DNA_VAULT"
        ? "DNA aktif pilot izi 32/32 ID eslesmesi verdi; klasik A/B VAULT ile karistirilmaz."
        : decision === "MULTI_CHANNEL_VAULT"
          ? `Birden fazla resmi kanal ayni ID'yi dogruladi: ${confirmedChannels.join(", ")}.`
          : decision === "VAULT"
            ? "Klasik Kanal A/B ID eslesmesi verdi."
            : "Hicbir resmi kanal ID eslesmesi vermedi.",
  };
}

function dnaActivePlacementWasEnabled(dnaPreAnalysis: unknown): boolean {
  if (!dnaPreAnalysis || typeof dnaPreAnalysis !== "object") return false;
  const placementPilot = (dnaPreAnalysis as { placementPilot?: unknown })
    .placementPilot;
  if (!placementPilot || typeof placementPilot !== "object") return false;
  const pilot = placementPilot as {
    mode?: unknown;
    activePilotTrace?: { applied?: unknown };
  };
  return (
    pilot.mode === "active_trace_candidate_only" &&
    pilot.activePilotTrace?.applied === true
  );
}

function buildExecutionModeTelemetry(activeMode: AegisExecutionMode) {
  return {
    activeMode,
    modes: {
      product: {
        purpose: "fast_user_result",
        behavior:
          "Runs cheap layers first, exits later ladder stages once ID-confirmed vault frames are enough, and avoids learning-only pilot work unless explicitly flagged.",
        heavyTelemetry: false,
      },
      test: {
        purpose: "measure_scenarios",
        behavior:
          "Records which channel/layer worked, stores DNA/test history, and may decode pilot traces for measurement.",
        heavyTelemetry: true,
      },
      learning: {
        purpose: "learn_from_tests",
        behavior:
          "Compares DNA predictions with stored test results and creates suggestions without changing code or VAULT decisions.",
        heavyTelemetry: true,
      },
    },
    cheapToStrongChain: {
      video: [
        "DNA-HINT when available",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "Channel B",
        "T6 only when flag is on and main result is NOT_FOUND",
      ],
      earlyExit:
        "A1-A4 later ladder stages are skipped after enough VAULT frames; Channel B remains an independent confirmation path.",
    },
    safety: {
      dnaCanOpenVault: false,
      dnaCanOpenDnaVault: true,
      pilotTraceCanOpenVault: false,
      idMatchRequiredForVault: true,
      autoCodeChange: false,
    },
  };
}

function readLatestVideoTestSummary(): LastVideoTestSummary {
  const summaryPath = process.env.AEGIS_LAST_VIDEO_TEST_JSON;
  if (!summaryPath) {
    throw new Error("AEGIS_LAST_VIDEO_TEST_JSON is not set");
  }

  return JSON.parse(fs.readFileSync(summaryPath, "utf8")) as LastVideoTestSummary;
}

function normalizeLatestVideoTestSummary(summary: LastVideoTestSummary): Required<
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
> & { idHex: string | null; dnaId: string | null } {
  const verdict = summary.verdict ?? "NOT_FOUND";
  const idHex =
    typeof summary.idHex === "string" && summary.idHex.length > 0
      ? summary.idHex
      : null;
  const dnaId =
    typeof summary.dnaId === "string" && summary.dnaId.length > 0
      ? summary.dnaId
      : idHex
        ? `video:${idHex}`
        : null;

  return {
    fileName: summary.fileName ?? "unknown",
    testTime: summary.testTime ?? new Date().toISOString(),
    verdict,
    mainVerdict: summary.mainVerdict ?? verdict,
    finalDecision: summary.finalDecision,
    idMatched:
      typeof summary.idMatched === "boolean"
        ? summary.idMatched
        : verdict === "VAULT",
    dnaRecordPresent: Boolean(summary.dnaRecordPresent),
    dbRecordPresent: Boolean(summary.dbRecordPresent),
    stampedFrameCount: Number(summary.stampedFrameCount ?? 0),
    strongFrames: Number(summary.strongFrames ?? 0),
    vaultFrames: Number(summary.vaultFrames ?? 0),
    pathLabel: summary.pathLabel ?? "v0.5A / T6 kapali",
    durationMs: Number(summary.durationMs ?? 0),
    note: summary.note ?? null,
    idHex,
    dnaId,
  };
}

async function ensureLatestVideoTestInHistory(summary: LastVideoTestSummary) {
  const normalized = normalizeLatestVideoTestSummary(summary);
  const testTime = new Date(normalized.testTime);
  const testKey = [
    normalized.fileName,
    normalized.testTime,
    normalized.idHex ?? "no-id",
    normalized.verdict,
  ].join("|");

  await db
    .insert(aegisTestHistoryTable)
    .values({
      testKey,
      testTime,
      fileName: normalized.fileName,
      verdict: normalized.verdict,
      idMatched: normalized.idMatched,
      dnaRecordPresent: normalized.dnaRecordPresent,
      dbRecordPresent: normalized.dbRecordPresent,
      stampedFrameCount: normalized.stampedFrameCount,
      strongFrames: normalized.strongFrames,
      vaultFrames: normalized.vaultFrames,
      pathLabel: normalized.pathLabel,
      durationMs: normalized.durationMs,
      note: normalized.note,
      idHex: normalized.idHex,
      dnaId: normalized.dnaId,
      raw: { ...summary, ...normalized },
    })
    .onConflictDoNothing({ target: aegisTestHistoryTable.testKey });
}

function writeLatestVideoTestSummary(summary: LastVideoTestSummary) {
  const summaryPath = process.env.AEGIS_LAST_VIDEO_TEST_JSON;
  if (!summaryPath) {
    throw new Error("AEGIS_LAST_VIDEO_TEST_JSON is not set");
  }

  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
}

function recordSecureRoomCommonMediaSummary(input: {
  req: Request;
  fileId: string;
  copyId: string;
  sessionId: string;
  commonMediaDecision: unknown;
  note?: string;
}): void {
  recordSecureRoomModuleSummaryFireAndForget({
    ip: input.req.ip ?? input.req.socket?.remoteAddress ?? "unknown",
    route: input.req.originalUrl.split("?")[0] ?? input.req.originalUrl,
    fileId: input.fileId,
    copyId: input.copyId,
    sessionId: input.sessionId,
    ...summarizeCommonMediaDecision(input.commonMediaDecision),
    ...(input.note ? { note: input.note } : {}),
  });
}

function extractDnaPreAnalysisFromRecord(dna: unknown): unknown | undefined {
  if (!dna || typeof dna !== "object") return undefined;
  const meta = (dna as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return undefined;
  return (meta as { preSealAnalysis?: unknown }).preSealAnalysis;
}

function requestFlagEnabled(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

type VideoOwnershipRegistryInput =
  | {
      ok: true;
      clientId: string;
      docId: string | null;
      source: "api-key" | "body";
    }
  | { ok: false; error: string; statusCode: 400 | 403 };

function readVideoOwnershipRegistryInput(
  req: Request,
): VideoOwnershipRegistryInput {
  const body = req.body as { clientId?: unknown; docId?: unknown } | undefined;
  if (req.apiClient && body?.clientId !== undefined && body.clientId !== null) {
    try {
      if (normalizeClientId(body.clientId) !== normalizeClientId(req.apiClient.id)) {
        return {
          ok: false,
          error: "video clientId must match authenticated API tenant",
          statusCode: 403,
        };
      }
    } catch (err) {
      if (err instanceof InvalidClientIdError) {
        return { ok: false, error: `clientId invalid: ${err.message}`, statusCode: 400 };
      }
      throw err;
    }
  }
  const rawClientId = req.apiClient ? req.apiClient.id : body?.clientId;
  if (rawClientId === undefined || rawClientId === null) {
    return {
      ok: false,
      error: "clientId required for video ownership registry",
      statusCode: 400,
    };
  }

  let clientId: string;
  try {
    clientId = normalizeClientId(rawClientId);
  } catch (err) {
    if (err instanceof InvalidClientIdError) {
      return { ok: false, error: `clientId invalid: ${err.message}`, statusCode: 400 };
    }
    throw err;
  }

  const rawDocId = body?.docId;
  let docId: string | null = null;
  if (rawDocId !== undefined && rawDocId !== null && rawDocId !== "") {
    try {
      assertValidDocId(rawDocId);
      docId = rawDocId;
    } catch (err) {
      if (err instanceof InvalidDocIdError) {
        return { ok: false, error: err.message, statusCode: 400 };
      }
      throw err;
    }
  }

  return {
    ok: true,
    clientId,
    docId,
    source: req.apiClient ? "api-key" : "body",
  };
}

function formatPreSealDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("tr-TR");
}

function buildVideoPreSealOwnershipMessage(
  check: PreSealOwnershipCheckResult,
): string {
  if (check.action === "block") {
    const date = formatPreSealDate(check.registeredAt);
    const owner =
      check.registeredClientLabel ??
      `Kullanici: ${check.registeredClientId ? `${check.registeredClientId[0]}...` : "****"}`;
    if (date) {
      return (
        "Bu icerik baska bir TancMark kaydina ait gorunuyor. " +
        `${date} tarihinde ${owner} tarafindan muhurlenmis. ` +
        "Bu nedenle tekrar muhurlenemez."
      );
    }
    return (
      "Bu icerik baska bir TancMark kaydina ait gorunuyor. " +
      `${owner} adina kayitli bir TancMark icerigi olarak gorunuyor. ` +
      "Bu nedenle tekrar muhurlenemez."
    );
  }

  return (
    "Bu icerikte kayitla dogrulanamayan bir TancMark ID gorunuyor. " +
    "Suclayici karar uretilmedi; manuel inceleme gerekir."
  );
}

function sendVideoPreSealOwnershipStop(
  res: Response,
  check: PreSealOwnershipCheckResult,
): void {
  const isBlock = check.action === "block";
  res.status(409).json({
    error: isBlock
      ? "video_preseal_ownership_blocked"
      : "video_preseal_ownership_manual_review",
    message: buildVideoPreSealOwnershipMessage(check),
    preSealOwnership: {
      action: check.action,
      reason: check.reason,
      exactIdFound: check.exactIdFound,
      decodedId: check.decodedId,
      registeredClientId: check.registeredClientId,
      registeredClientLabel: check.registeredClientLabel,
      registeredAt: check.registeredAt,
      blockingSignals: isBlock ? ["exact_hidden_aegis_id"] : [],
      ignoredSignalsForBlocking: [
        "ecc",
        "dna",
        "partial_candidate",
        "visual_support",
        "audio_support",
        "c2pa",
        "visible_logo",
        "similarity",
      ],
      c2paCanBlock: false,
      decisionRole: "pre_seal_exact_hidden_aegis_id_only",
    },
  });
}

function isOfficialVaultDecision(verdict: string | null | undefined): boolean {
  return (
    verdict === "VAULT" ||
    verdict === "VISUAL_VAULT" ||
    verdict === "AUDIO_VAULT" ||
    verdict === "DNA_VAULT" ||
    verdict === "MULTI_CHANNEL_VAULT"
  );
}

function rawFinalDecisionLabel(raw: Record<string, unknown>): string | null {
  const finalDecision = raw["finalDecision"];
  if (!finalDecision || typeof finalDecision !== "object") return null;
  const decision = (finalDecision as Record<string, unknown>)["decision"];
  return typeof decision === "string" ? decision : null;
}

async function runDnaPilotTraceDecode(input: {
  videoPath: string;
  workDir: string;
  dnaPreAnalysis: unknown;
  expectedPayload4Hex: string;
}) {
  if (!input.dnaPreAnalysis || typeof input.dnaPreAnalysis !== "object") {
    return emptyDnaPilotTraceTelemetry(input.expectedPayload4Hex);
  }
  const report = input.dnaPreAnalysis as DnaPreAnalysisReport;
  const plan = buildDnaPilotTracePlan(report);
  if (!plan.activeTraceApplied || plan.frameIdxs.length === 0) {
    return {
      ...emptyDnaPilotTraceTelemetry(input.expectedPayload4Hex),
      ...plan,
    };
  }
  const info = await videoInfo(input.videoPath);
  const readFrames = plan.frameIdxs.map((idx) => Math.max(0, idx - 1));
  const pilotWorkDir = path.join(input.workDir, "dna-pilot-trace");
  fs.mkdirSync(pilotWorkDir, { recursive: true });
  const extracted = await extractFrames(
    input.videoPath,
    readFrames.map((idx) => idx / info.fps + 0.5 / info.fps),
    pilotWorkDir,
  );
  try {
    return await decodeDnaPilotTraceFromFramePaths({
      framePaths: extracted.map((frame, i) => ({
        frameIdx: plan.frameIdxs[i] ?? 0,
        pngPath: frame.pngPath,
      })),
      expectedPayload4: Buffer.from(input.expectedPayload4Hex, "hex"),
      plan,
    });
  } finally {
    try {
      fs.rmSync(pilotWorkDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

type SuggestionDraft = {
  topic: string;
  severity: "dusuk" | "orta" | "yuksek";
  suggestion: string;
  reason: string;
};

function buildActionPlan(suggestion: {
  topic: string;
  severity: string;
  suggestion: string;
  reason: string;
}) {
  const risk =
    suggestion.severity === "yuksek"
      ? "yuksek"
      : suggestion.severity === "orta"
        ? "orta"
        : "dusuk";
  const smallStep =
    suggestion.topic === "ID okuma"
      ? "Once tek kucuk video uzerinde ID okuma telemetrisini incele."
      : suggestion.topic === "DNA"
        ? "DNA kaydi ve fallback arama durumunu tek test kaydi uzerinden dogrula."
        : suggestion.topic === "performans"
          ? "Yalniz sure ve maliyet olcumunu kucuk testte kontrol et."
          : "Calisan v0.5A yolunu koruyarak bir sonraki kucuk testi planla.";

  return {
    suggestion: suggestion.suggestion,
    whyImportant: suggestion.reason,
    module: suggestion.topic,
    risk,
    smallStep,
    verification:
      "Buyuk test calistirmadan once tek mini testte API, dashboard ve karar sonucunun degismedigini kontrol et.",
    safety:
      "Bu plan otomatik kod degisikligi yapmaz. Uygulama icin insan onayi gerekir.",
  };
}

function buildSuggestionForTest(test: {
  testKey: string;
  fileName: string;
  verdict: string;
  idMatched: boolean;
  dnaRecordPresent: boolean;
  dbRecordPresent: boolean;
  strongFrames: number;
  vaultFrames: number;
  pathLabel: string;
  raw?: unknown;
}): SuggestionDraft {
  const raw =
    test.raw && typeof test.raw === "object"
      ? (test.raw as Record<string, unknown>)
      : {};
  const scenario =
    typeof raw["scenario"] === "string" ? raw["scenario"] : "mini-test";
  const finalDecisionLabel = rawFinalDecisionLabel(raw) ?? test.verdict;
  const channelAIdMatched = raw["channelAIdMatched"] === true;
  const channelBIdMatched = raw["channelBIdMatched"] === true;
  const finalConfirmedBy =
    typeof raw["finalConfirmedBy"] === "string"
      ? raw["finalConfirmedBy"]
      : "unknown";
  const dnaComparison =
    raw["dnaPreAnalysisComparison"] &&
    typeof raw["dnaPreAnalysisComparison"] === "object"
      ? (raw["dnaPreAnalysisComparison"] as Record<string, unknown>)
      : undefined;
  const dnaLesson =
    typeof dnaComparison?.["lesson"] === "string"
      ? String(dnaComparison["lesson"])
      : undefined;
  const dnaNextStep =
    typeof dnaComparison?.["suggestedNextStep"] === "string"
      ? String(dnaComparison["suggestedNextStep"])
      : undefined;
  const dnaMatchesPrediction = dnaComparison?.["matchesPrediction"] === true;
  const dnaWeakChannel =
    typeof dnaComparison?.["weakChannel"] === "string"
      ? String(dnaComparison["weakChannel"])
      : undefined;
  const placementPilot =
    dnaComparison?.["placementPilot"] &&
    typeof dnaComparison["placementPilot"] === "object"
      ? (dnaComparison["placementPilot"] as Record<string, unknown>)
      : undefined;
  const placementPilotEnabled = placementPilot?.["enabled"] === true;
  const dnaPilotTrace =
    raw["dnaPilotTrace"] && typeof raw["dnaPilotTrace"] === "object"
      ? (raw["dnaPilotTrace"] as Record<string, unknown>)
      : undefined;
  const pilotBits =
    typeof dnaPilotTrace?.["matchingBits"] === "number"
      ? Number(dnaPilotTrace["matchingBits"])
      : undefined;

  if (!test.idMatched && !isOfficialVaultDecision(finalDecisionLabel)) {
    return {
      topic: dnaComparison ? "DNA/video" : "ID okuma",
      severity: "yuksek",
      suggestion: dnaComparison
        ? "DNA golge tahmini ile ID kaybi birlikte incelenmeli"
        : "ID okuma dayanikliligi guclendirilmeli",
      reason:
        `Sorun: ID eslesmedi. Senaryo: ${scenario}. Muhtemel sebep: sinyal var ama payload/ID katmani zayif. ` +
        `Kanal A: ${channelAIdMatched ? "okudu" : "zayif"}. Kanal B: ${channelBIdMatched ? "okudu" : "zayif"}. ` +
        (dnaComparison
          ? `DNA golge mod: ${dnaMatchesPrediction ? "tahmin tuttu" : "tahmin zayif kaldi"}. ` +
            `Ders: ${dnaLesson ?? "kayit yok"}. Zayif kanal: ${dnaWeakChannel ?? "bilinmiyor"}. ` +
            (placementPilotEnabled
              ? "DNA kucuk yetki pilotu aday yerlesim uretmis ama gercek muhru degistirmemis. "
              : "") +
            (pilotBits !== undefined
              ? `DNA aktif pilot izi ${pilotBits}/32 bit okudu ve ana karara karismadi. `
              : "") +
            `Onerilen yol: ${dnaNextStep ?? "tek kucuk testte yeniden karsilastir"}.`
          : "Onerilen yol: esik gevsetmeden ikinci kanal tasima gucu/kare secimi kucuk testle incelenmeli. Sonraki kucuk test: ayni senaryoda tek video."),
    };
  }

  if (finalDecisionLabel === "DNA_VAULT") {
    return {
      topic: "DNA/video",
      severity: "orta",
      suggestion: "DNA_VAULT yolu kontrollu sekilde izlenmeli",
      reason:
        `Senaryo: ${scenario}. Klasik Kanal A/B kesin sonuc vermedi ama DNA aktif pilot izi 32/32 ID eslesmesiyle resmi DNA_VAULT uretmis gorunuyor. ` +
        `Pilot bit: ${pilotBits ?? "bilinmiyor"}/32. Bir sonraki adim: daha genis ama kontrollu crop20 olcumu; esik gevsetme yok.`,
    };
  }

  if (finalDecisionLabel === "VISUAL_VAULT") {
    return {
      topic: "gorsel/video",
      severity: "orta",
      suggestion: "VISUAL_VAULT yolu kontrollu sekilde izlenmeli",
      reason:
        `Senaryo: ${scenario}. Video Kanal A/B kesin sonuc vermedi ama gorsel modul kendi ID izinden 32/32 eslesme uretmis gorunuyor. ` +
        "Bu resmi karar yine ID eslesmesine dayaniyor; sonraki adim yalniz kucuk kontrollu tekrardir.",
    };
  }

  if (finalDecisionLabel === "AUDIO_VAULT") {
    return {
      topic: "ses/video",
      severity: "orta",
      suggestion: "AUDIO_VAULT yolu kontrollu sekilde izlenmeli",
      reason:
        `Senaryo: ${scenario}. Video/gorsel kesin sonuc vermedi ama ses modulu kendi ID izinden 32/32 eslesme uretmis gorunuyor. ` +
        "Bu resmi karar parca birlestirme degil, tek ses izinin tam ID eslesmesidir; sonraki adim yalniz kucuk kontrollu tekrardir.",
    };
  }

  if (finalDecisionLabel === "MULTI_CHANNEL_VAULT") {
    return {
      topic: "video/gorsel/DNA",
      severity: "dusuk",
      suggestion: "Cok kanalli VAULT yolu korunmali",
      reason:
        `Senaryo: ${scenario}. Birden fazla resmi kanal ayni ID eslesmesi verdi. ` +
        "Calisan yol korunmali; yeni varsayilan davranis icin ayrica kontrollu onay gerekir.",
    };
  }

  if (!isOfficialVaultDecision(finalDecisionLabel)) {
    return {
      topic: "video",
      severity: "yuksek",
      suggestion: "VAULT basarisizligi ayrica incelenmeli",
      reason: "Test VAULT uretmedi. Mevcut yol kesin basari vermedi.",
    };
  }

  if (!test.dnaRecordPresent || !test.dbRecordPresent) {
    return {
      topic: "DNA",
      severity: test.strongFrames > 0 ? "orta" : "dusuk",
      suggestion: "DNA kaydi ve fallback arama akisi izlenmeli",
      reason:
        "DNA kaydi eksik gorunuyor. Arama calisiyorsa yedek kural korunmali.",
    };
  }

  if (test.strongFrames >= 10 && !isOfficialVaultDecision(finalDecisionLabel)) {
    return {
      topic: "video",
      severity: "yuksek",
      suggestion: "Sinyal var ama ID tasiyan katman zayif",
      reason:
        "strongFrames yuksek olmasina ragmen VAULT yok. Byte/ID katmani incelenmeli.",
    };
  }

  if (test.vaultFrames < 2) {
    return {
      topic: "video",
      severity: "orta",
      suggestion: "Muhur tekrar sayisi veya kare secimi incelenmeli",
      reason:
        `Senaryo: ${scenario}. VAULT geldi ama vaultFrames dusuk. ` +
        `Kanal durumu: ${finalConfirmedBy}. Bir sonraki kucuk testte hangi kanal kurtardi ayrica izlenmeli.`,
    };
  }

  return {
    topic: "video",
    severity: "dusuk",
    suggestion: "Mevcut yol korunmali, daha zor testlere kontrollu gecilebilir",
    reason:
      `Son test ${finalDecisionLabel} verdi, ID eslesti ve DNA kaydi olustu. Senaryo: ${scenario}. ` +
      `Kanal durumu: ${finalConfirmedBy}. Calisan yol korunmali.`,
  };
}

async function ensureSuggestionForTest(test: typeof aegisTestHistoryTable.$inferSelect) {
  const draft = buildSuggestionForTest({
    testKey: test.testKey,
    fileName: test.fileName,
    verdict: test.verdict,
    idMatched: test.idMatched,
    dnaRecordPresent: test.dnaRecordPresent,
    dbRecordPresent: test.dbRecordPresent,
    strongFrames: test.strongFrames,
    vaultFrames: test.vaultFrames,
    pathLabel: test.pathLabel,
    raw: test.raw,
  });
  const suggestionKey = `${test.testKey}|${draft.topic}|${draft.suggestion}`;

  await db
    .insert(aegisImprovementSuggestionsTable)
    .values({
      suggestionKey,
      relatedTestKey: test.testKey,
      relatedTestId: String(test.id),
      topic: draft.topic,
      severity: draft.severity,
      suggestion: draft.suggestion,
      reason: draft.reason,
      status: "bekliyor",
      raw: {
        testId: test.id,
        fileName: test.fileName,
        verdict: test.verdict,
        idMatched: test.idMatched,
        dnaRecordPresent: test.dnaRecordPresent,
        dbRecordPresent: test.dbRecordPresent,
        strongFrames: test.strongFrames,
        vaultFrames: test.vaultFrames,
        pathLabel: test.pathLabel,
        dnaPreAnalysisComparison:
          test.raw && typeof test.raw === "object"
            ? (test.raw as Record<string, unknown>)["dnaPreAnalysisComparison"]
            : undefined,
      },
    })
    .onConflictDoNothing({
      target: aegisImprovementSuggestionsTable.suggestionKey,
    });
}

registerVideoLabReadOnlyAdminRoutes(router, {
  readLatestVideoTestSummary,
  normalizeLatestVideoTestSummary,
  ensureLatestVideoTestInHistory,
  ensureSuggestionForTest,
  buildActionPlan,
  isOfficialVaultDecision,
  rawFinalDecisionLabel,
  buildExecutionModeTelemetry,
});

router.post("/improvement-suggestions/:id/status", requireAdminToken, async (req, res) => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number.parseInt(rawId ?? "", 10);
  const status = (req.body as { status?: string })?.status;
  const allowed = new Set(["bekliyor", "onaylandi", "reddedildi", "tamamlandi"]);

  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "invalid suggestion id" });
    return;
  }
  if (!status || !allowed.has(status)) {
    res.status(400).json({ error: "invalid status" });
    return;
  }

  try {
    const updated = await db
      .update(aegisImprovementSuggestionsTable)
      .set({ status })
      .where(eq(aegisImprovementSuggestionsTable.id, id))
      .returning();

    const row = updated[0];
    if (!row) {
      res.status(404).json({ error: "suggestion not found" });
      return;
    }

    res.json({
      suggestion: row,
      actionPlan: row.status === "onaylandi" ? buildActionPlan(row) : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

router.post(
  "/mini-test",
  requireAdminToken,
  miniTestUpload.single("video"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "missing video" });
      return;
    }

    const ownership = readVideoOwnershipRegistryInput(req);
    if (!ownership.ok) {
      res.status(ownership.statusCode).json({ error: ownership.error });
      return;
    }

    const startedAt = Date.now();
    const idInput = (req.body as { id?: string })?.id ?? randomUUID();
    const dnaPlacementPilot = requestFlagEnabled(
      (req.body as { dnaPlacementPilot?: string })?.dnaPlacementPilot,
    );
    const dnaActivePlacementPilot = requestFlagEnabled(
      (req.body as { dnaActivePlacementPilot?: string })
        ?.dnaActivePlacementPilot,
    );
    const stampCount = Math.max(
      2,
      Math.min(
        56,
        Number.parseInt(
          (req.body as { stampCount?: string })?.stampCount ??
            String(MINI_TEST_DEFAULT_STAMP_COUNT),
          10,
        ) || MINI_TEST_DEFAULT_STAMP_COUNT,
      ),
    );
    const reqId = randomUUID();
    const workDir = path.join(WORK_BASE, `mini_${reqId}`);
    const inPath = path.join(workDir, "input.mp4");
    const outPath = path.join(workDir, "stamped.mkv");
    const decodeWorkDir = path.join(workDir, "decode");
    fs.mkdirSync(decodeWorkDir, { recursive: true });
    const supportWorkDir = path.join(workDir, "support");
    fs.mkdirSync(supportWorkDir, { recursive: true });

    try {
      fs.writeFileSync(inPath, req.file.buffer);
      const preSealOwnership = await preSealOwnershipCheck({
        mediaType: "video",
        input: inPath,
        currentClientId: ownership.clientId,
        scanLimit: 8,
      });
      if (preSealOwnership.action !== "allow") {
        sendVideoPreSealOwnershipStop(res, preSealOwnership);
        return;
      }
      let mediaStreams: Awaited<ReturnType<typeof mediaStreamInfo>> | undefined;
      try {
        mediaStreams = await mediaStreamInfo(inPath);
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "media stream probe skip",
        );
      }
      const encodeResult = await encodeVideo({
        videoPath: inPath,
        idInput,
        outputPath: outPath,
        stampCount,
        dnaHintProvider: makeDnaHintProvider(),
        dnaPlacementPilot,
        dnaActivePlacementPilot,
      });

      const dna = encodeResult.sealMap as {
        dnaId?: string;
        primaryMediaType?: string;
        activeMediaTypes?: string[];
        pipelineVersion?: string;
        contentDigest?: { hex?: string; sizeBytes?: number };
        structuralFingerprint?: { geometricChecksum?: string };
      };
      const dnaId = dna.dnaId ?? `video:${encodeResult.idHex}`;

      await db
        .insert(aegisDnaRecordsTable)
        .values({
          dnaId,
          primaryMediaType: dna.primaryMediaType ?? "video",
          activeMediaTypes: dna.activeMediaTypes ?? ["video"],
          pipelineVersion: dna.pipelineVersion ?? "unknown",
          contentDigestHex: dna.contentDigest?.hex || null,
          contentSizeBytes: dna.contentDigest?.sizeBytes ?? null,
          geometricChecksum:
            dna.structuralFingerprint?.geometricChecksum || null,
          idHex: encodeResult.idHex,
          payload4Hex: encodeResult.payload4Hex,
          clientId: ownership.clientId,
          dna: encodeResult.sealMap as unknown,
        })
        .onConflictDoNothing({ target: aegisDnaRecordsTable.dnaId });

      const decodeResult = await decodeVideo({
        videoPath: outPath,
        idInput,
        workDir: decodeWorkDir,
        dnaHintProvider: makeDnaHintProvider(),
        channelBHintProvider: makeDnaChannelBHintProvider(),
      });
      let videoImageSupport:
        | import("../dna/commonDnaBoard.js").VideoImageSupportResult
        | null
        | undefined;
      let decisionBoard:
        | Array<import("../dna/commonDnaBoard.js").ModuleBoardEntry>
        | undefined;
      try {
        const {
          commonDnaBoardEnabled,
          runVideoImageSupport,
          buildModuleStatus,
        } = await import("../dna/commonDnaBoard.js");
        if (commonDnaBoardEnabled()) {
          videoImageSupport = await runVideoImageSupport({
            videoPath: outPath,
            hintIdxs: encodeResult.stampedFrameIdxs,
            fps: encodeResult.fps,
            workDir: supportWorkDir,
            maxFrames: 8,
          });
          const expectedIdHex = encodeResult.idHex;
          const decodedIdHex =
            decodeResult.verdict === "VAULT" &&
            typeof decodeResult.idHex === "string"
              ? decodeResult.idHex
              : null;
          decisionBoard = [
            buildModuleStatus({
              module: "video",
              phase: "search",
              ran: true,
              searched: true,
              decodedIdHex,
              expectedIdHex,
              candidateScore:
                decodeResult.aggregatedVault === true
                  ? 1
                  : Math.min(1, decodeResult.strongFrames / 30),
              dnaId,
              dnaUsed: true,
              dnaFallback: false,
            }),
          ];
          if (videoImageSupport && videoImageSupport.framesChecked > 0) {
            decisionBoard.push(
              buildModuleStatus({
                module: "image",
                phase: "support",
                ran: true,
                decodedIdHex: null,
                expectedIdHex: null,
                candidateScore: videoImageSupport.supportScore * 0.5,
                dnaId,
                note:
                  "mini_test_visual_support_from_video_frames_no_decisive",
                dnaUsed: true,
                dnaFallback: false,
              }),
            );
          }
        }
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "mini-test common visual support skip",
        );
      }

      const dnaRows = await db
        .select({ dnaId: aegisDnaRecordsTable.dnaId })
        .from(aegisDnaRecordsTable)
        .where(eq(aegisDnaRecordsTable.dnaId, dnaId))
        .limit(1);
      const durationMs = Date.now() - startedAt;
      const dnaPreAnalysisComparison = compareDnaPreAnalysisWithVideoResult(
        encodeResult.dnaPreAnalysis,
        {
          scenario: "baseline",
          verdict: decodeResult.verdict,
          channelAIdMatched: decodeResult.channelAIdMatched,
          channelBIdMatched: decodeResult.channelBIdMatched,
          strongFrames: decodeResult.strongFrames,
          vaultFrames: decodeResult.vaultFrames,
        },
      );
      const dnaPilotTrace = await runDnaPilotTraceDecode({
        videoPath: outPath,
        workDir,
        dnaPreAnalysis: encodeResult.dnaPreAnalysis,
        expectedPayload4Hex: decodeResult.expectedPayload4Hex,
      });
      const visualModuleTrace = await decodeVideoVisualModuleFromDna({
        videoPath: outPath,
        workDir,
        dna: encodeResult.sealMap as unknown,
        expectedPayload4Hex: decodeResult.expectedPayload4Hex,
      });
      const audioModuleTrace = await decodeAudioV01FromDna({
        mediaPath: outPath,
        workDir,
        dna: encodeResult.sealMap as unknown,
        expectedPayload4Hex: decodeResult.expectedPayload4Hex,
      });
      const videoEccRecoveryTrace = await decodeVideoEccRecoveryFromDna({
        videoPath: outPath,
        workDir,
        dna: encodeResult.sealMap as unknown,
        expectedPayload4Hex: decodeResult.expectedPayload4Hex,
      });
      const finalDecision = buildVideoFinalDecision({
        mainVerdict: decodeResult.verdict,
        channelAIdMatched: decodeResult.channelAIdMatched,
        channelBIdMatched: decodeResult.channelBIdMatched,
        dnaPilotTrace,
        visualModuleTrace,
        audioModuleTrace,
        dnaActivePlacementPilot,
      });
      const { detectActiveModules } = await import("../orchestrator/index.js");
      const activeModules = detectActiveModules({
        mimeType: req.file.mimetype ?? null,
        fileExt: path.extname(req.file.originalname ?? "").toLowerCase(),
        hasAudioTrack: mediaStreams?.hasAudio === true,
      });
      const commonMediaDecision = buildCommonMediaDecisionPhase1({
        phase: "search",
        scenario: "baseline",
        activeModules: activeModules.modules,
        dnaPreAnalysis: encodeResult.dnaPreAnalysis,
        decisionBoard,
        videoImageSupport,
        visualModuleTrace,
        visualModuleSeal: encodeResult.visualModuleSeal,
        audioModuleTrace,
        audioModuleSeal: encodeResult.audioModuleSeal,
        finalDecision,
        mainVerdict: decodeResult.verdict,
        channelAIdMatched: decodeResult.channelAIdMatched,
        channelBIdMatched: decodeResult.channelBIdMatched,
        stampedFrameCount: encodeResult.stampedFrameIdxs.length,
        channelBFrameCount: encodeResult.channelB.frameCount,
        dnaPilotFrameCount:
          typeof dnaPilotTrace.frameCount === "number"
            ? dnaPilotTrace.frameCount
            : 0,
        strongFrames: decodeResult.strongFrames,
        vaultFrames: decodeResult.vaultFrames,
        hasAudioTrack: mediaStreams?.hasAudio === true,
        textDetected: mediaStreams?.hasSubtitle === true,
      });
      const summary: LastVideoTestSummary = {
        fileName: req.file.originalname ?? "video.mp4",
        scenario: "baseline",
        testTime: new Date().toISOString(),
        verdict: finalDecision.decision,
        mainVerdict: decodeResult.verdict,
        finalDecision,
        idMatched: finalDecision.idMatched,
        dnaRecordPresent: dnaRows.length > 0,
        dbRecordPresent: dnaRows.length > 0,
        stampedFrameCount: encodeResult.stampedFrameIdxs.length,
        strongFrames: decodeResult.strongFrames,
        vaultFrames: decodeResult.vaultFrames,
        pathLabel: "v0.5A + Channel B / T6 kapali",
        durationMs,
        note: `Mini test finalDecision=${finalDecision.decision}. ${finalDecision.note}`,
        idHex: encodeResult.idHex,
        dnaId,
        channelAIdMatched: decodeResult.channelAIdMatched,
        channelBIdMatched: decodeResult.channelBIdMatched,
        bothChannelsMatched: decodeResult.bothChannelsMatched,
        singleChannelMatched: decodeResult.singleChannelMatched,
        finalConfirmedBy: decodeResult.finalConfirmedBy,
        channelBMatchingBits: decodeResult.channelB.matchingBits,
        channelBFrameCount: decodeResult.channelB.frameCount,
        dnaPreAnalysis: encodeResult.dnaPreAnalysis,
        dnaPreAnalysisComparison,
        dnaPlacementPilot: encodeResult.dnaPreAnalysis.placementPilot,
        dnaPilotTrace,
        visualModuleTrace,
        audioModuleTrace,
        videoEccRecoveryTrace,
        executionMode: buildExecutionModeTelemetry("test"),
        commonMediaDecision,
        decisionBoard,
        videoImageSupport,
        mediaStreams,
      };

      writeLatestVideoTestSummary(summary);
      await ensureLatestVideoTestInHistory(summary);
      const latestRows = await db
        .select()
        .from(aegisTestHistoryTable)
        .orderBy(desc(aegisTestHistoryTable.testTime))
        .limit(1);
      if (latestRows[0]) {
        await ensureSuggestionForTest(latestRows[0]);
      }
      recordSecureRoomCommonMediaSummary({
        req,
        fileId: summary.fileName ?? "video.mp4",
        copyId: summary.scenario ?? "baseline",
        sessionId: summary.testTime ?? new Date().toISOString(),
        commonMediaDecision,
        note: `Auto module_summary after mini video test: ${finalDecision.decision}`,
      });

      res.json({
        ...summary,
        apiOk: true,
        dbDnaRows: dnaRows.length,
        totalFramesAttempted: decodeResult.totalFramesAttempted,
        aggregatedVault: decodeResult.aggregatedVault,
        channelB: decodeResult.channelB,
        finalConfirmedBy: decodeResult.finalConfirmedBy,
        mainVerdict: decodeResult.verdict,
        finalDecision,
        dnaPreAnalysis: encodeResult.dnaPreAnalysis,
        dnaPreAnalysisComparison,
        dnaPlacementPilot: encodeResult.dnaPreAnalysis.placementPilot,
        dnaPilotTrace,
        visualModuleTrace,
        audioModuleTrace,
        videoEccRecoveryTrace,
        executionMode: buildExecutionModeTelemetry("test"),
        commonMediaDecision,
        decisionBoard,
        videoImageSupport,
        mediaStreams,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const summary: LastVideoTestSummary = {
        fileName: req.file.originalname ?? "video.mp4",
        testTime: new Date().toISOString(),
        verdict: "NOT_FOUND",
        idMatched: false,
        dnaRecordPresent: false,
        dbRecordPresent: false,
        stampedFrameCount: 0,
        strongFrames: 0,
        vaultFrames: 0,
        pathLabel: "v0.5A + Channel B / T6 kapali",
        durationMs: Date.now() - startedAt,
        note: `Mini test hatasi: ${msg}`,
      };
      try {
        writeLatestVideoTestSummary(summary);
        await ensureLatestVideoTestInHistory(summary);
      } catch {
        // Keep the original error response if local persistence also fails.
      }
      req.log.error({ err: msg }, "video-lab mini-test failed");
      res.status(500).json({ error: msg, summary });
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  },
);

router.post(
  "/encode",
  requireAdminToken,
  encodeUpload.single("video"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "missing video" });
      return;
    }
    const ownership = readVideoOwnershipRegistryInput(req);
    if (!ownership.ok) {
      res.status(ownership.statusCode).json({ error: ownership.error });
      return;
    }
    const idInput = (req.body as { id?: string })?.id ?? randomUUID();
    const dnaPlacementPilot = requestFlagEnabled(
      (req.body as { dnaPlacementPilot?: string })?.dnaPlacementPilot,
    );
    const dnaActivePlacementPilot = requestFlagEnabled(
      (req.body as { dnaActivePlacementPilot?: string })
        ?.dnaActivePlacementPilot,
    );
    const stampCount = parseInt(
      (req.body as { stampCount?: string })?.stampCount ?? "8",
      10,
    );
    const reqId = randomUUID();
    const workDir = path.join(WORK_BASE, `enc_${reqId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inPath = path.join(workDir, "input.mp4");
    const outPath = path.join(workDir, "stamped.mkv");
    try {
      fs.writeFileSync(inPath, req.file.buffer);
      const preSealOwnership = await preSealOwnershipCheck({
        mediaType: "video",
        input: inPath,
        currentClientId: ownership.clientId,
        scanLimit: 8,
      });
      if (preSealOwnership.action !== "allow") {
        sendVideoPreSealOwnershipStop(res, preSealOwnership);
        return;
      }

      let mediaStreams: Awaited<ReturnType<typeof mediaStreamInfo>> | undefined;
      try {
        mediaStreams = await mediaStreamInfo(inPath);
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "media stream probe skip",
        );
      }
      const result = await encodeVideo({
        videoPath: inPath,
        idInput,
        outputPath: outPath,
        stampCount,
        dnaHintProvider: makeDnaHintProvider(),
        dnaPlacementPilot,
        dnaActivePlacementPilot,
      });
      const outBuf = fs.readFileSync(outPath);
      res.setHeader("Content-Type", "video/x-matroska");
      res.setHeader("X-Aegis-Video-Id", result.idHex);
      res.setHeader("X-Aegis-Video-Payload4", result.payload4Hex);
      res.setHeader(
        "X-Aegis-Video-Stamped-Frames",
        result.stampedFrameIdxs.join(","),
      );
      res.setHeader(
        "X-Aegis-Video-Stamped-Timestamps",
        result.stampedTimestamps.map((t) => t.toFixed(3)).join(","),
      );
      res.setHeader(
        "X-Aegis-Video-Channel-B-Frames",
        result.channelB.frameIdxs.join(","),
      );
      res.setHeader(
        "X-Aegis-Video-Channel-B-Carrier",
        result.channelB.carrier,
      );
      res.setHeader("X-Aegis-DNA-Shadow-Mode", result.dnaPreAnalysis.mode);
      res.setHeader(
        "X-Aegis-DNA-Placement-Pilot",
        result.dnaPreAnalysis.placementPilot.enabled ? "1" : "0",
      );
      res.setHeader(
        "X-Aegis-DNA-Active-Placement-Pilot",
        result.dnaPilotTrace.activeTraceApplied ? "1" : "0",
      );
      res.setHeader(
        "X-Aegis-DNA-Shadow-Placement-Changed",
        String(result.dnaPreAnalysis.stampPlacementChanged),
      );

      // AEGIS DNA — kalıcı saklama (fire-and-forget).
      // Mevcut encode/header davranışına dokunmaz; hata sessiz loglanır,
      // response zinciri etkilenmez. Eski kayıtlarla uyum: bu tabloya yazım
      // diğer modüller (cloaked_documents/vault_anchors) için zorunlu değil.
      const dna = result.sealMap as {
        dnaId?: string;
        primaryMediaType?: string;
        activeMediaTypes?: string[];
        pipelineVersion?: string;
        contentDigest?: { hex?: string; sizeBytes?: number };
        structuralFingerprint?: { geometricChecksum?: string };
      };
      try {
        await db
          .insert(aegisDnaRecordsTable)
          .values({
            dnaId: dna.dnaId ?? `video:${result.idHex}`,
            primaryMediaType: dna.primaryMediaType ?? "video",
            activeMediaTypes: dna.activeMediaTypes ?? ["video"],
            pipelineVersion: dna.pipelineVersion ?? "unknown",
            contentDigestHex: dna.contentDigest?.hex || null,
            contentSizeBytes: dna.contentDigest?.sizeBytes ?? null,
            geometricChecksum:
              dna.structuralFingerprint?.geometricChecksum || null,
            idHex: result.idHex,
            payload4Hex: result.payload4Hex,
            clientId: ownership.clientId,
            dna: result.sealMap as unknown,
          })
          .onConflictDoNothing({ target: aegisDnaRecordsTable.dnaId });
      } catch (persistErr) {
        const msg =
          persistErr instanceof Error ? persistErr.message : String(persistErr);
        req.log.warn(
          { err: msg, idHex: result.idHex },
          "aegis-dna persist failed (video encode succeeded)",
        );
      }

      // ── AEGIS Orchestrator seal köprüsü — additive HEADERS (body değişmez) ──
      // /encode binary döner; JSON eklenemez. Bunun yerine ortak mimari
      // görünürlüğü additive X-Aegis-Orchestrator-* HEADER'lar ile verilir.
      // Mevcut encode davranışı + body byte-identical; mevcut X-Aegis-Video-*
      // header'ları DEĞİŞMEZ.
      try {
        const {
          detectActiveModules,
          sealOrchestrator,
          buildVideoSealAdvisory,
          projectDnaSealAdvisory,
        } = await import("../orchestrator/index.js");
        const am = detectActiveModules({
          mimeType: req.file.mimetype ?? null,
          fileExt: path.extname(req.file.originalname ?? "").toLowerCase(),
          hasAudioTrack: mediaStreams?.hasAudio === true,
        });
        const sp = sealOrchestrator({
          modules: am.modules
            .filter((module) => module.status === "active")
            .map((module) => module.kind),
        });
        const sealEvidencePlan = sp.plan.flatMap((p) =>
          p.expectedLayerIds.map((layerId) => ({
            module: p.module,
            layerId,
            dnaWritePolicy: p.dnaWritePolicy,
          })),
        );
        // ── AEGIS DNA Faz 2 — Seal Advisory iskelet (L1) ──
        // authority = "advisory_only_no_seal_gate" SABİT. DNA hâlâ karar
        // VERMİYOR. encode/decode davranışı DEĞİŞMEZ; video buffer
        // byte-identical. Sadece response HEADER görünürlüğü.
        const videoExpectedLayerIds =
          sp.plan.find((p) => p.module === "video")?.expectedLayerIds ?? [];
        const videoSealAdvisory = buildVideoSealAdvisory({
          expectedLayerIds: videoExpectedLayerIds,
        });
        const videoSealAdvisoryProjection =
          projectDnaSealAdvisory(videoSealAdvisory);
        const reservedModules = [
          {
            kind: "secure_room",
            status: "record_only",
            reason: "module_summary_evidence_and_timestamp_record_only",
          },
          {
            kind: "zehir",
            legacyKind: "poison",
            status: "candidate_support",
            reason: "zehir_record_only_candidate_support",
          },
        ];
        const dnaUsageStatus = {
          kind: "record_only_seal_plan_visible",
          description:
            "DNA written by encodeVideo's existing persist path (aegis_dna_records). Orchestrator surfaces seal plan; no placement decision change.",
          dnaWriteAttempted: true,
          dnaPlacementOwnedBy: "module",
        };
        const commonMediaDecision = buildCommonMediaDecisionPhase1({
          phase: "seal",
          scenario: "encode",
          activeModules: am.modules,
          dnaPreAnalysis: result.dnaPreAnalysis,
          visualModuleSeal: result.visualModuleSeal,
          audioModuleSeal: result.audioModuleSeal,
          stampedFrameCount: Array.isArray(result.stampedFrameIdxs)
            ? result.stampedFrameIdxs.length
            : 0,
          channelBFrameCount: result.channelB.frameCount,
          dnaPilotFrameCount: result.dnaPilotTrace.frameCount,
          hasAudioTrack: mediaStreams?.hasAudio === true,
          textDetected: mediaStreams?.hasSubtitle === true,
        });
        res.setHeader(
          "X-Aegis-Orchestrator-Active-Modules",
          JSON.stringify(am.modules),
        );
        res.setHeader(
          "X-Aegis-Orchestrator-Seal-Plan",
          JSON.stringify(sp.plan),
        );
        res.setHeader(
          "X-Aegis-Orchestrator-Seal-Evidence-Plan",
          JSON.stringify(sealEvidencePlan),
        );
        res.setHeader(
          "X-Aegis-Orchestrator-Reserved-Modules",
          JSON.stringify(reservedModules),
        );
        res.setHeader(
          "X-Aegis-Orchestrator-Dna-Usage",
          JSON.stringify(dnaUsageStatus),
        );
        // Faz 2 additive: tek yeni header, mevcut 5 header DEĞİŞMEDİ.
        res.setHeader(
          "X-Aegis-Orchestrator-Seal-Advisory",
          JSON.stringify(videoSealAdvisoryProjection),
        );
        res.setHeader(
          "X-Aegis-Orchestrator-Common-Media-Decision",
          JSON.stringify(commonMediaDecision),
        );
        recordSecureRoomCommonMediaSummary({
          req,
          fileId: req.file.originalname ?? "video.mp4",
          copyId: "encode",
          sessionId: randomUUID(),
          commonMediaDecision,
          note: "Auto module_summary after video encode seal.",
        });
        // ── AEGIS Ortak DNA Karar Masası — seal-side board entry (header) ──
        // Bayrak kapalıyken header eklenmez. Mühür DNA'ya zaten
        // `encodeVideo`'nun mevcut persist yolu üzerinden yazılıyor
        // (`aegis_dna_records`); burada sadece ortak masaya görünürlük.
        try {
          const { commonDnaBoardEnabled, buildModuleStatus } = await import(
            "../dna/commonDnaBoard.js"
          );
          if (commonDnaBoardEnabled()) {
            // Evrensel kural: kaç bağımsız mühür basıldı?
            //   - Her stamped frame ayrı tripleShield mührüdür (frame-disjoint;
            //     anchor pozisyonları frame içinde aynı şablonu kullansa da
            //     frame'ler temporal olarak bağımsız).
            //   - stampCount ≥ 2 ⇒ sealIndependent=true.
            //   - Frame-level alanlar disjoint olduğu için sealOverlaps=false.
            // Gerçek basılan mühür sayısı encode sonucundan (kısa/limitli
            // videolarda istekteki stampCount'tan az olabilir).
            const stampedSeals = Array.isArray(result.stampedFrameIdxs)
              ? result.stampedFrameIdxs.length
              : Math.max(0, stampCount | 0);
            const sealBoard = [
              buildModuleStatus({
                module: "video",
                phase: "seal",
                ran: true,
                sealed: true,
                decodedIdHex: null,
                expectedIdHex: null,
                dnaId: `video:${result.idHex}`,
                note: `seal_persisted_via_encodeVideo_aegis_dna_records (${stampedSeals} stamped frames)`,
                sealCount: stampedSeals,
                sealOverlaps: false,
                dnaUsed: false, // encode taze DNA yazıyor; mevcut DNA okumadı.
              }),
            ];
            res.setHeader(
              "X-Aegis-Orchestrator-Decision-Board",
              JSON.stringify(sealBoard),
            );
          }
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "common-dna board (encode) skip",
          );
        }
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "orchestrator seal headers skip",
        );
      }
      res.status(200).send(outBuf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      req.log.error({ err: msg }, "video-lab encode failed");
      res.status(500).json({ error: msg });
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  },
);

router.post(
  "/decode",
  requireAdminToken,
  decodeUpload.single("video"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "missing video" });
      return;
    }
    const idInput = (req.body as { id?: string })?.id;
    if (!idInput) {
      res.status(400).json({ error: "missing id (expected hex32 or string)" });
      return;
    }
    const scenario =
      typeof (req.body as { scenario?: string })?.scenario === "string"
        ? (req.body as { scenario?: string }).scenario!
        : "decode";
    const reqId = randomUUID();
    const workDir = path.join(WORK_BASE, `dec_${reqId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inPath = path.join(workDir, "input.mp4");
    // Alt workDir — decodeVideo kendi finally'sinde RM_SYNC eder.
    // Parent workDir burada korunur ki `inPath` (input.mp4) ortak DNA
    // visual support pass'inde hâlâ açılabilsin. Outer finally parent
    // workDir'i tamamen temizler (alt klasör dahil).
    const decodeWorkDir = path.join(workDir, "decode");
    fs.mkdirSync(decodeWorkDir, { recursive: true });
    const supportWorkDir = path.join(workDir, "support");
    fs.mkdirSync(supportWorkDir, { recursive: true });
    let mediaStreams: Awaited<ReturnType<typeof mediaStreamInfo>> | undefined;
    try {
      fs.writeFileSync(inPath, req.file.buffer);
      try {
        mediaStreams = await mediaStreamInfo(inPath);
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "media stream probe skip",
        );
      }
      const result = await decodeVideo({
        videoPath: inPath,
        idInput,
        workDir: decodeWorkDir,
        dnaHintProvider: makeDnaHintProvider(),
        channelBHintProvider: makeDnaChannelBHintProvider(),
      });
      // ── AEGIS DNA arama-tarafı raporu + guided search (v0.6.7/v0.6.8) ──
      // result.idHex varsa kalıcı DNA snapshot'ı raporlanır (harita/
      // öncelik bilgisi). v0.6.8: ek olarak observed video katmanları
      // ile DNA-guided eşleşme advisory `aegisDnaGuidedSearch`.
      // Karar/eşik/A5/Layer B/T6/verdict mantığı DOKUNULMADI.
      let aegisDnaReport:
        | Awaited<
            ReturnType<typeof import("../dna/dnaReport.js").buildDnaReport>
          >
        | undefined;
      let aegisDnaGuidedSearch:
        | ReturnType<
            typeof import("../dna/dnaGuidedSearch.js").buildDnaGuidedSearch
          >
        | undefined;
      let dnaPreAnalysis: unknown | undefined;
      let dnaPreAnalysisComparison: unknown | undefined;
      let dnaPilotTrace: unknown | undefined;
      let visualModuleTrace: unknown | undefined;
      let audioModuleTrace: unknown | undefined;
      let videoEccRecoveryTrace: unknown | undefined;
      let dnaRecordSnapshot: unknown | undefined;
      try {
        const { buildDnaReport } = await import("../dna/dnaReport.js");
        const { buildDnaGuidedSearch } = await import(
          "../dna/dnaGuidedSearch.js"
        );
        const r = result as {
          verdict?: string;
          idHex?: string;
          vaultFrames?: number;
          strongFrames?: number;
          aggregatedVault?: boolean;
          t6?: { verdict?: string };
        };
        const idHex = r.idHex;
        if (typeof idHex === "string" && idHex.length > 0) {
          aegisDnaReport = await buildDnaReport(`video:${idHex}`);
          if (
            aegisDnaReport.overlapWarnings &&
            aegisDnaReport.overlapWarnings.length > 0
          ) {
            req.log.warn(
              { idHex, overlapWarnings: aegisDnaReport.overlapWarnings },
              "aegis-dna video-lab/decode overlap warnings",
            );
          }
          // v0.6.8 — gözlenen video katmanları (advisory, karar değişmez).
          const observed: string[] = [];
          if ((r.vaultFrames ?? 0) > 0 || r.aggregatedVault === true) {
            observed.push("video.tripleShield");
          }
          if ((r.strongFrames ?? 0) > 0) observed.push("video.anchors.r1");
          if (r.t6?.verdict === "T6_VAULT" || r.t6?.verdict === "T6_CANDIDATE") {
            observed.push("video.t6.lowBand");
          }
          aegisDnaGuidedSearch = buildDnaGuidedSearch(aegisDnaReport, observed);
          const dnaRows = await db
            .select({ dna: aegisDnaRecordsTable.dna })
            .from(aegisDnaRecordsTable)
            .where(eq(aegisDnaRecordsTable.dnaId, `video:${idHex}`))
            .limit(1);
          dnaRecordSnapshot = dnaRows[0]?.dna;
          dnaPreAnalysis = extractDnaPreAnalysisFromRecord(dnaRows[0]?.dna);
          dnaPreAnalysisComparison = compareDnaPreAnalysisWithVideoResult(
            dnaPreAnalysis,
            {
              scenario,
              verdict: r.verdict,
              channelAIdMatched:
                (result as { channelAIdMatched?: boolean }).channelAIdMatched,
              channelBIdMatched:
                (result as { channelBIdMatched?: boolean }).channelBIdMatched,
              strongFrames: r.strongFrames,
              vaultFrames: r.vaultFrames,
            },
          );
        }
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "aegis-dna report skip",
        );
      }
      // ── v0.7.1 — Two-tier decision projection (ADDITIVE) ──
      // Ana karar (`aggregatedVault`, vaultFrames eşikleri, A5, T6 verdict
      // ladder) DOKUNULMADI. Yalnız RAPOR:
      //   - confirmed: aggregatedVault AND result.idHex ID-match
      //   - candidate: aksi halde frame sinyallerinden + T6 aday skoru
      // T6_CANDIDATE kesin başarı SAYILMAZ — yalnız candidate katkısı.
      if (dnaPreAnalysis) {
        try {
          dnaPilotTrace = await runDnaPilotTraceDecode({
            videoPath: inPath,
            workDir,
            dnaPreAnalysis,
            expectedPayload4Hex:
              (result as { expectedPayload4Hex?: string })
                .expectedPayload4Hex ?? "",
          });
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "dna active placement pilot decode skip",
          );
        }
      }
      if (dnaRecordSnapshot) {
        try {
          visualModuleTrace = await decodeVideoVisualModuleFromDna({
            videoPath: inPath,
            workDir,
            dna: dnaRecordSnapshot,
            expectedPayload4Hex:
              (result as { expectedPayload4Hex?: string })
                .expectedPayload4Hex ?? "",
          });
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "visual module trace decode skip",
          );
        }
        try {
          audioModuleTrace = await decodeAudioV01FromDna({
            mediaPath: inPath,
            workDir,
            dna: dnaRecordSnapshot,
            expectedPayload4Hex:
              (result as { expectedPayload4Hex?: string })
                .expectedPayload4Hex ?? "",
          });
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "audio v0.1 trace decode skip",
          );
        }
        try {
          videoEccRecoveryTrace = await decodeVideoEccRecoveryFromDna({
            videoPath: inPath,
            workDir,
            dna: dnaRecordSnapshot,
            expectedPayload4Hex:
              (result as { expectedPayload4Hex?: string })
                .expectedPayload4Hex ?? "",
          });
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "video ecc recovery trace decode skip",
          );
        }
      }
      let twoTierDecision:
        | ReturnType<
            typeof import("../dna/twoTierProjection.js").projectTwoTierDecision
          >
        | undefined;
      try {
        const { projectTwoTierDecision } = await import(
          "../dna/twoTierProjection.js"
        );
        const r = result as {
          verdict?: string;
          idHex?: string;
          aggregatedVault?: boolean;
          vaultFrames?: number;
          strongFrames?: number;
          t6?: { verdict?: string };
        };
        // expectedIdHex: caller'ın iddia ettiği ID. decodeVideo
        // bunu `normalizeId` ile hex32 ya da sha256-hex'e çeviriyor;
        // `result.idHex` aynı kurala göre üretiliyor. Projection için
        // AYNI normalize'i uygulamak gerekir, aksi halde non-hex caller
        // input'ları (örn "doc-42") false-negative confirmed verir.
        const { normalizeId } = await import("../video/aegisCore.js");
        const expectedIdHex =
          typeof idInput === "string" && idInput.length > 0
            ? normalizeId(idInput).toString("hex")
            : null;
        // decodedIdHex: yalnız aggregatedVault true ve idHex mevcut ise
        // confirmed adayı. Aksi halde null → confirmed.matched=false.
        const decodedIdHex =
          r.verdict === "VAULT" && typeof r.idHex === "string"
            ? r.idHex
            : null;
        const vf = r.vaultFrames ?? 0;
        const sf = r.strongFrames ?? 0;
        const t6Verdict = r.t6?.verdict;
        const candidateContributors = decodedIdHex !== null
          ? {}
          : {
              // strongFrames anchor sinyalini, vaultFrames byte payload'unu
              // ölçer. Her ikisi ADAY destek; ana karar bunlardan üretilmez.
              layerSignals: Math.min(1, sf / 30),
              sealMapMatch: Math.min(1, vf / 5),
              // T6_CANDIDATE/T6_VAULT yalnız aday katkı; kesin karara
              // YÜKSELTİLMEZ (kullanıcı kuralı).
              recoveryHints:
                t6Verdict === "T6_VAULT"
                  ? 0.6
                  : t6Verdict === "T6_CANDIDATE"
                  ? 0.3
                  : 0,
              dnaSimilarity:
                aegisDnaGuidedSearch?.hint === "found_match" ? 0.4 : 0,
            };
        twoTierDecision = projectTwoTierDecision({
          decodedIdHex,
          expectedIdHex,
          candidateContributors,
        });
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "twoTier projection skip",
        );
      }
      // ── AEGIS Orchestrator köprüsü — additive, KARAR DEĞİŞTİRMEZ ──
      // Mevcut alanlar (`...result`, `aegisDnaReport`, `aegisDnaGuidedSearch`,
      // `twoTierDecision`) AYNEN korunur. Aşağıdaki 4 yeni alan ADDITIVE:
      //   - activeModules: hangi modüller aktif (video şu durumda).
      //   - orchestratorEvidenceChain: ortak delil zinciri özeti.
      //   - orchestratorDecision: ortak iki-seviyeli karar projeksiyonu.
      //   - dnaUsageStatus: DNA'nın bu kararda ne için kullanıldığı.
      // Final VAULT hâlâ `result.aggregatedVault` ile veriliyor; orchestrator
      // YENİ vault kapısı AÇMAZ.
      let activeModules:
        | ReturnType<typeof import("../orchestrator/index.js").detectActiveModules>
        | undefined;
      let orchestratorEvidenceChain:
        | ReturnType<typeof import("../orchestrator/index.js").searchOrchestrator>
        | undefined;
      let orchestratorDecision:
        | ReturnType<
            typeof import("../orchestrator/index.js").commonDecisionTail
          >["orchestratorDecision"]
        | undefined;
      let dnaUsageStatus:
        | ReturnType<
            typeof import("../orchestrator/index.js").commonDecisionTail
          >["dnaUsageStatus"]
        | undefined;
      // ── AEGIS Ortak DNA Karar Masası (AEGIS_COMMON_DNA, default OFF) ──
      // Bayrak kapalıyken bu iki alan undefined kalır; response shape ek
      // alanlarla genişler ama mevcut alanlar byte-identical. Eski yol
      // değişmez.
      let decisionBoard:
        | Array<
            import("../dna/commonDnaBoard.js").ModuleBoardEntry
          >
        | undefined;
      let videoImageSupport:
        | import("../dna/commonDnaBoard.js").VideoImageSupportResult
        | null
        | undefined;
      // Evrensel kural rule 6: görsel destek tek tek DNA'ya bağımlı değil.
      // "dna_hint" → DNA'nın işaret ettiği kareler; "search_strong_frames" →
      // DNA yokken main search'ın bulduğu en güçlü karelerden fallback.
      let visualSupportSource:
        | "dna_hint"
        | "search_strong_frames"
        | undefined;
      // Açık DNA frame hint raporu — kullanıcı talebi: "DNA kare listesi
      // boşsa sessiz geçme, sebebini açık yaz." Bu blok hem dolu hem boş
      // durumlarda decisionBoard / response'a görünür kalır.
      let dnaFrameHintSummary:
        | {
            attempted: boolean;
            hintFrameCount: number;
            reason:
              | "ok"
              | "dna_record_missing"
              | "dna_frame_list_empty"
              | "common_dna_disabled"
              | "no_idHex"
              | "lookup_error";
            note: string;
          }
        | undefined;
      try {
        const {
          detectActiveModules,
          searchOrchestrator,
          commonDecisionTail,
        } = await import("../orchestrator/index.js");
        const r = result as {
          verdict?: string;
          idHex?: string;
          aggregatedVault?: boolean;
          vaultFrames?: number;
          strongFrames?: number;
          t6?: { verdict?: string };
        };
        // Modül tespiti — bu route video, ses modülü reserved.
        activeModules = detectActiveModules({
          mimeType: req.file.mimetype ?? null,
          fileExt: path.extname(req.file.originalname ?? "").toLowerCase(),
          hasAudioTrack: mediaStreams?.hasAudio === true,
        });
        // expectedIdHex: caller'ın iddia ettiği ID (decodeVideo ile aynı
        // normalize). Yeniden hesaplama — twoTier zaten yaptıysa
        // tutarlılık aynı kaynaktan.
        const { normalizeId } = await import("../video/aegisCore.js");
        const expectedIdHex =
          typeof idInput === "string" && idInput.length > 0
            ? normalizeId(idInput).toString("hex")
            : null;
        const decodedIdHex =
          r.verdict === "VAULT" && typeof r.idHex === "string"
            ? r.idHex
            : null;
        // Ortak delil zinciri.
        orchestratorEvidenceChain = searchOrchestrator({
          video: {
            aggregatedVault: r.aggregatedVault === true,
            vaultFrames: r.vaultFrames ?? 0,
            strongFrames: r.strongFrames ?? 0,
            decodedIdHex,
            expectedIdHex,
            t6Verdict: r.t6?.verdict ?? null,
            dnaOverlapWarnings: aegisDnaReport?.overlapWarnings ?? [],
          },
        });
        // DNA usage status — bu sprintte DNA `record_and_common_decision_tail`
        // (kayıt + ortak karar kuyruğunda OKUNUYOR ama YENİ kapı açmıyor).
        const dnaUsage = {
          kind: aegisDnaReport
            ? ("record_and_common_decision_tail" as const)
            : ("record_only" as const),
          description: aegisDnaReport
            ? "DNA record loaded and read by orchestrator commonDecisionTail. No new vault gate created; existing module gates remain authoritative."
            : "DNA record-only this turn; no DNA snapshot loaded for decision tail.",
          dnaRead: aegisDnaReport !== undefined,
          dnaReportFound:
            aegisDnaReport !== undefined &&
            (aegisDnaReport as { status?: string }).status !== "not_found",
          dnaOverlapWarnings: aegisDnaReport?.overlapWarnings?.length ?? 0,
        };
        // ── AEGIS Ortak DNA Karar Masası — Video → Görsel ilk ortak iş ──
        // AEGIS_COMMON_DNA bayrağı AÇIK ve DNA snapshot bulunduysa:
        //   - DNA'nın işaret ettiği AZ SAYIDA kareye sharp ile görsel-side
        //     destek istatistiği koşulur (en fazla 8 kare).
        //   - Sonuç EvidenceItem olarak ortak masaya CANDIDATE-ONLY eklenir
        //     (found=false, idMatch=false, candidateScore≤0.5).
        //   - Hata olursa null → eski yol; karar zinciri etkilenmez.
        // KIRMIZI ÇİZGİ: Yeni VAULT kapısı YOK. decisive yalnız ID match.
        let combinedEvidence = orchestratorEvidenceChain.evidence;
        try {
          const {
            commonDnaBoardEnabled,
            runVideoImageSupport,
            videoImageSupportToEvidence,
          } = await import("../dna/commonDnaBoard.js");
          if (!commonDnaBoardEnabled()) {
            dnaFrameHintSummary = {
              attempted: false,
              hintFrameCount: 0,
              reason: "common_dna_disabled",
              note: "AEGIS_LEGACY_MODE veya AEGIS_COMMON_DNA=0 — ortak DNA pas geçti, eski güvenli yol çalıştı.",
            };
          } else if (!(typeof r.idHex === "string" && r.idHex.length > 0)) {
            dnaFrameHintSummary = {
              attempted: false,
              hintFrameCount: 0,
              reason: "no_idHex",
              note: "Decode result.idHex boş; DNA satırı tek anahtarla bulunamaz.",
            };
          } else {
            const { extractStampedFrameIdxs } = await import(
              "../dna/dnaFrameHint.js"
            );
            let dnaRows: Array<{ dna: unknown }> = [];
            try {
              dnaRows = await db
                .select({ dna: aegisDnaRecordsTable.dna })
                .from(aegisDnaRecordsTable)
                .where(eq(aegisDnaRecordsTable.dnaId, `video:${r.idHex}`))
                .limit(1);
            } catch (dbErr) {
              dnaFrameHintSummary = {
                attempted: true,
                hintFrameCount: 0,
                reason: "lookup_error",
                note:
                  "DNA satırı okunamadı: " +
                  (dbErr instanceof Error ? dbErr.message : String(dbErr)),
              };
            }
            if (dnaFrameHintSummary === undefined) {
              if (dnaRows.length === 0) {
                dnaFrameHintSummary = {
                  attempted: true,
                  hintFrameCount: 0,
                  reason: "dna_record_missing",
                  note: `aegis_dna_records'ta video:${r.idHex} satırı yok — encode ya hiç DNA yazmadı ya da bu ID için kayıt eskidi/silindi.`,
                };
              } else {
                const hintIdxs = extractStampedFrameIdxs(dnaRows[0]!.dna);
                if (hintIdxs.length === 0) {
                  dnaFrameHintSummary = {
                    attempted: true,
                    hintFrameCount: 0,
                    reason: "dna_frame_list_empty",
                    note: "DNA satırı var ama maps.encodeMap.mainTripleShield.stampedFrameIdxs + layers[].units[].unitKey ikisi de boş — encode bu kaydı tahminle yazmış, gerçek mühürlü kare listesi yok.",
                  };
                } else {
                  const { videoInfo } = await import(
                    "../video/ffmpegHelper.js"
                  );
                  const info = await videoInfo(inPath);
                  videoImageSupport = await runVideoImageSupport({
                    videoPath: inPath,
                    hintIdxs,
                    fps: info.fps,
                    workDir: supportWorkDir,
                    maxFrames: 8,
                  });
                  visualSupportSource = "dna_hint";
                  dnaFrameHintSummary = {
                    attempted: true,
                    hintFrameCount: hintIdxs.length,
                    reason: "ok",
                    note: `DNA'dan ${hintIdxs.length} mühürlü kare okundu; ilk ${Math.min(hintIdxs.length, 8)} kare görsel destek kontrolüne gitti (candidate-only).`,
                  };
                  if (
                    videoImageSupport &&
                    videoImageSupport.framesChecked > 0
                  ) {
                    combinedEvidence = [
                      ...orchestratorEvidenceChain.evidence,
                      videoImageSupportToEvidence(videoImageSupport),
                    ];
                  }
                }
              }
            }
          }
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "common-dna board visual support skip",
          );
          if (dnaFrameHintSummary === undefined) {
            dnaFrameHintSummary = {
              attempted: true,
              hintFrameCount: 0,
              reason: "lookup_error",
              note:
                "Visual support pass'i hata yuttu: " +
                (e instanceof Error ? e.message : String(e)),
            };
          }
        }

        // ── Evrensel kural rule 6: DNA yokken görsel destek atlanmasın ──
        // DNA listesi missing/empty ve henüz destek koşulmadıysa, main
        // search'ın bulduğu en güçlü karelerden düşük maliyetli fallback
        // destek koşulur. Kesin sonuç ÜRETMEZ (candidate-only, ≤0.5).
        if (
          videoImageSupport === undefined &&
          dnaFrameHintSummary &&
          (dnaFrameHintSummary.reason === "dna_record_missing" ||
            dnaFrameHintSummary.reason === "dna_frame_list_empty" ||
            dnaFrameHintSummary.reason === "lookup_error") &&
          Array.isArray(result.frames) &&
          result.frames.length > 0
        ) {
          try {
            const candidates = [...result.frames]
              .filter((f) => (f.strongAnchors ?? 0) >= 1)
              .sort(
                (a, b) =>
                  (b.strongAnchors + b.byteMatches) -
                  (a.strongAnchors + a.byteMatches),
              )
              .slice(0, 8)
              .map((f) => f.frameIdx)
              .filter((idx) => Number.isFinite(idx) && idx >= 0);
            const uniqIdxs = Array.from(new Set(candidates));
            if (uniqIdxs.length > 0) {
              const { runVideoImageSupport } = await import(
                "../dna/commonDnaBoard.js"
              );
              const { videoInfo } = await import("../video/ffmpegHelper.js");
              const info = await videoInfo(inPath);
              videoImageSupport = await runVideoImageSupport({
                videoPath: inPath,
                hintIdxs: uniqIdxs,
                fps: info.fps,
                workDir: supportWorkDir,
                maxFrames: 8,
              });
              if (videoImageSupport && videoImageSupport.framesChecked > 0) {
                visualSupportSource = "search_strong_frames";
                const { videoImageSupportToEvidence } = await import(
                  "../dna/commonDnaBoard.js"
                );
                combinedEvidence = [
                  ...orchestratorEvidenceChain.evidence,
                  videoImageSupportToEvidence(videoImageSupport),
                ];
              }
            }
          } catch (e) {
            req.log.warn(
              { err: e instanceof Error ? e.message : String(e) },
              "visual support fallback (search_strong_frames) skip",
            );
          }
        }

        // Ortak karar kuyruğu (RAPOR ONLY).
        const tail = commonDecisionTail({
          activeModules: activeModules.modules,
          evidence: combinedEvidence,
          expectedIdHex,
          decodedIdHex,
          dnaUsage,
        });
        orchestratorDecision = tail.orchestratorDecision;
        dnaUsageStatus = tail.dnaUsageStatus;

        // ── Ortak masaya per-modül status yazımı ──
        // Bayrak kapalıyken decisionBoard undefined kalır.
        try {
          const { commonDnaBoardEnabled, buildModuleStatus } = await import(
            "../dna/commonDnaBoard.js"
          );
          if (commonDnaBoardEnabled()) {
            const videoDnaId =
              typeof r.idHex === "string" && r.idHex.length > 0
                ? `video:${r.idHex}`
                : undefined;
            const board: Array<
              import("../dna/commonDnaBoard.js").ModuleBoardEntry
            > = [
              buildModuleStatus({
                module: "video",
                phase: "search",
                ran: true,
                searched: true,
                decodedIdHex,
                expectedIdHex,
                candidateScore:
                  r.aggregatedVault === true
                    ? 1
                    : Math.min(1, (r.strongFrames ?? 0) / 30),
                dnaId: videoDnaId,
                note: dnaFrameHintSummary
                  ? `dnaFrameHint:${dnaFrameHintSummary.reason}:${dnaFrameHintSummary.hintFrameCount}`
                  : undefined,
                // Evrensel kural: DNA varsa kullan, yoksa main search yine
                // çalışır (decodeVideo koşulsuz). dnaUsed = DNA-HINT pre-pass
                // gerçekten çalıştı mı (reason==="ok"); dnaFallback = DNA
                // yokken arama yine yapıldı mı (her durumda evet, çünkü
                // A1-A4 LADDER koşulsuz koşar).
                dnaUsed: dnaFrameHintSummary?.reason === "ok",
                dnaFallback: dnaFrameHintSummary?.reason !== "ok",
              }),
            ];
            if (videoImageSupport && videoImageSupport.framesChecked > 0) {
              const supportNote =
                visualSupportSource === "search_strong_frames"
                  ? "visual_support_fallback_from_search_strong_frames_no_decisive"
                  : "visual_support_from_video_dna_hint_frames_no_decisive";
              board.push(
                buildModuleStatus({
                  module: "image",
                  phase: "support",
                  ran: true,
                  decodedIdHex: null,
                  expectedIdHex: null,
                  candidateScore: videoImageSupport.supportScore * 0.5,
                  dnaId: videoDnaId,
                  note: supportNote,
                  dnaUsed: visualSupportSource === "dna_hint",
                  dnaFallback: visualSupportSource === "search_strong_frames",
                }),
              );
            }
            decisionBoard = board;
          }
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "common-dna board status skip",
          );
        }
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "orchestrator skip",
        );
      }
      const finalDecision = buildVideoFinalDecision({
        mainVerdict: result.verdict,
        channelAIdMatched: result.channelAIdMatched,
        channelBIdMatched: result.channelBIdMatched,
        dnaPilotTrace,
        visualModuleTrace,
        audioModuleTrace,
        dnaActivePlacementPilot: dnaActivePlacementWasEnabled(dnaPreAnalysis),
      });
      const commonMediaDecision = buildCommonMediaDecisionPhase1({
        phase: "search",
        scenario,
        activeModules: activeModules?.modules ?? [],
        dnaPreAnalysis,
        decisionBoard,
        videoImageSupport,
        visualModuleTrace,
        audioModuleTrace,
        finalDecision,
        mainVerdict: result.verdict,
        channelAIdMatched: result.channelAIdMatched,
        channelBIdMatched: result.channelBIdMatched,
        stampedFrameCount:
          dnaPreAnalysis && typeof dnaPreAnalysis === "object"
            ? Number(
                ((dnaPreAnalysis as { actualPlacement?: { channelAFrameCount?: number } })
                  .actualPlacement?.channelAFrameCount) ?? 0,
              )
            : 0,
        channelBFrameCount:
          dnaPreAnalysis && typeof dnaPreAnalysis === "object"
            ? Number(
                ((dnaPreAnalysis as { actualPlacement?: { channelBFrameCount?: number } })
                  .actualPlacement?.channelBFrameCount) ?? 0,
              )
            : 0,
        dnaPilotFrameCount:
          dnaPilotTrace && typeof dnaPilotTrace === "object"
            ? Number((dnaPilotTrace as { frameCount?: number }).frameCount ?? 0)
            : 0,
        strongFrames: result.strongFrames,
        vaultFrames: result.vaultFrames,
        hasAudioTrack: mediaStreams?.hasAudio === true,
        textDetected: mediaStreams?.hasSubtitle === true,
      });
      const shouldRecordTest =
        (req.body as { recordTest?: string })?.recordTest === "1";
      if (shouldRecordTest) {
        const placement =
          dnaPreAnalysis && typeof dnaPreAnalysis === "object"
            ? (dnaPreAnalysis as {
                actualPlacement?: { channelAFrameCount?: number };
              }).actualPlacement
            : undefined;
        const r = result as {
          verdict?: string;
          idHex?: string;
          strongFrames?: number;
          vaultFrames?: number;
          channelAIdMatched?: boolean;
          channelBIdMatched?: boolean;
          bothChannelsMatched?: boolean;
          singleChannelMatched?: boolean;
          finalConfirmedBy?: string;
          channelB?: { matchingBits?: number; frameCount?: number };
        };
        const dnaId =
          typeof r.idHex === "string" && r.idHex.length > 0
            ? `video:${r.idHex}`
            : null;
        const summary: LastVideoTestSummary = {
          fileName: `${req.file.originalname ?? "video.mp4"} / ${scenario}`,
          scenario,
          testTime: new Date().toISOString(),
          verdict: finalDecision.decision,
          mainVerdict: r.verdict ?? "NOT_FOUND",
          finalDecision,
          idMatched: finalDecision.idMatched,
          dnaRecordPresent: dnaPreAnalysis !== undefined,
          dbRecordPresent: dnaPreAnalysis !== undefined,
          stampedFrameCount: Number(placement?.channelAFrameCount ?? 0),
          strongFrames: Number(r.strongFrames ?? 0),
          vaultFrames: Number(r.vaultFrames ?? 0),
          pathLabel: `v0.5A + Channel B / ${scenario}`,
          durationMs: 0,
          note: `Decode finalDecision=${finalDecision.decision}. ${finalDecision.note}`,
          idHex: r.idHex ?? null,
          dnaId,
          channelAIdMatched: r.channelAIdMatched,
          channelBIdMatched: r.channelBIdMatched,
          bothChannelsMatched: r.bothChannelsMatched,
          singleChannelMatched: r.singleChannelMatched,
          finalConfirmedBy: r.finalConfirmedBy,
          channelBMatchingBits: r.channelB?.matchingBits,
          channelBFrameCount: r.channelB?.frameCount,
          dnaPreAnalysis,
          dnaPreAnalysisComparison,
          dnaPlacementPilot:
            dnaPreAnalysis && typeof dnaPreAnalysis === "object"
              ? (dnaPreAnalysis as { placementPilot?: unknown })
                  .placementPilot
              : undefined,
          dnaPilotTrace,
          visualModuleTrace,
          audioModuleTrace,
          videoEccRecoveryTrace,
          executionMode: buildExecutionModeTelemetry("test"),
          commonMediaDecision,
          decisionBoard,
          videoImageSupport,
          dnaFrameHint: dnaFrameHintSummary,
          mediaStreams,
        };
        try {
          writeLatestVideoTestSummary(summary);
          await ensureLatestVideoTestInHistory(summary);
          const latestRows = await db
            .select()
            .from(aegisTestHistoryTable)
            .orderBy(desc(aegisTestHistoryTable.testTime))
            .limit(1);
          if (latestRows[0]) {
            await ensureSuggestionForTest(latestRows[0]);
          }
          recordSecureRoomCommonMediaSummary({
            req,
            fileId: summary.fileName ?? "video.mp4",
            copyId: scenario,
            sessionId: summary.testTime ?? new Date().toISOString(),
            commonMediaDecision,
            note: `Auto module_summary after video decode: ${finalDecision.decision}`,
          });
        } catch (e) {
          req.log.warn(
            { err: e instanceof Error ? e.message : String(e) },
            "decode test-history persist skip",
          );
        }
      }
      res.status(200).json({
        ...result,
        aegisDnaReport,
        aegisDnaGuidedSearch,
        twoTierDecision,
        activeModules,
        orchestratorEvidenceChain,
        orchestratorDecision,
        dnaUsageStatus,
        decisionBoard,
        videoImageSupport,
        dnaFrameHint: dnaFrameHintSummary,
        dnaPreAnalysis,
        dnaPreAnalysisComparison,
        dnaPlacementPilot:
          dnaPreAnalysis && typeof dnaPreAnalysis === "object"
            ? (dnaPreAnalysis as { placementPilot?: unknown }).placementPilot
            : undefined,
        dnaPilotTrace,
        visualModuleTrace,
        audioModuleTrace,
        videoEccRecoveryTrace,
        mainVerdict: result.verdict,
        finalDecision,
        commonMediaDecision,
        executionMode: buildExecutionModeTelemetry("test"),
        mediaStreams,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      req.log.error({ err: msg }, "video-lab decode failed");
      res.status(500).json({ error: msg });
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  },
);

/**
 * AEGIS DNA lookup — kalıcı kayıt geri okuma (admin-only, read-only).
 *
 * Karar mantığına / mühür arama zincirine dokunmaz. Sadece persistans
 * doğrulama içindir: encode sonrası DNA snapshot'ı geri okunabilsin.
 *
 * Path: GET /video-lab/dna/:dnaId  (dnaId = "video:<idHex>" formatı)
 */
registerVideoLabDnaReadOnlyRoute(router);

export default router;
