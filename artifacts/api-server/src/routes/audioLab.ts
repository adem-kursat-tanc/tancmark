import { Router, type IRouter, type Request } from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { db, aegisDnaRecordsTable } from "@workspace/db";
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
import { assertLegacyFfmpegLabAllowed } from "../middlewares/productRuntimeGuards";
import { resolveMediaRuntimePath } from "../video/mediaRuntimePathResolver";
import { normalizeId, payload4 } from "../video/aegisCore";
import {
  decodeAudioV01FromDna,
  encodeStandaloneAudioV01,
  type AudioV01DecodeTelemetry,
} from "../video/audioModule";
import {
  audioPreSealOwnershipCheck,
  buildAudioPreSealEncodeGate,
} from "../video/audioPreSealOwnershipCheck";
import { buildAudioSupportAdvisory } from "../video/audioSupportAdvisory";
import { evaluateAudioVaultFeatureGateDecision } from "../video/audioVaultFeatureGate";
import { evaluateAudioVaultPreviewDecision } from "../video/audioVaultPreviewDecision";
export {
  evaluateAudioVaultPreviewDecision,
  type AudioVaultPreviewDecision,
  type AudioVaultPreviewDecisionInput,
  type AudioVaultPreviewRejectionReason,
} from "../video/audioVaultPreviewDecision";

const router: IRouter = Router();

const encodeUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.audioEncode);
const analyzeUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.audioAnalyze);
const vaultPreviewUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.audioVaultPreview);

const WORK_BASE = path.join(os.tmpdir(), "aegis-audio-lab");
fs.mkdirSync(WORK_BASE, { recursive: true });

const AUDIO_READ_ALIGNMENT_OFFSETS_SEC = [
  0,
  0.05,
  0.1,
  0.15,
  0.2,
  0.25,
  0.3,
  0.4,
  0.5,
] as const;

const AUDIO_PRESEAL_SCAN_LIMIT = 20;
const AUDIO_VAULT_FEATURE_GATE_ENV = "AEGIS_AUDIO_VAULT_FEATURE_GATE";

type AudioOwnershipRegistryInput =
  | {
      ok: true;
      clientId: string;
      docId: string | null;
      source: "api-key" | "body";
    }
  | { ok: false; error: string };

function readAudioOwnershipRegistryInput(
  req: Request,
): AudioOwnershipRegistryInput {
  const body = req.body as { clientId?: unknown; docId?: unknown } | undefined;
  const rawClientId = req.apiClient ? req.apiClient.id : body?.clientId;
  if (rawClientId === undefined || rawClientId === null) {
    return {
      ok: false,
      error: "clientId required for audio ownership registry",
    };
  }

  let clientId: string;
  try {
    clientId = normalizeClientId(rawClientId);
  } catch (err) {
    if (err instanceof InvalidClientIdError) {
      return { ok: false, error: `clientId invalid: ${err.message}` };
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
        return { ok: false, error: err.message };
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

function inputAudioPath(workDir: string, originalName?: string): string {
  const ext = originalName ? path.extname(originalName).slice(0, 12) : "";
  return path.join(workDir, `input${ext || ".audio"}`);
}

function truthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "on", "yes", "enabled"].includes(
    value.trim().toLowerCase(),
  );
}

function audioVaultFeatureGateEnabled(req: Request): boolean {
  const body =
    req.body as
      | {
          audioVaultFeatureGate?: unknown;
          audioVaultInternalRollout?: unknown;
        }
      | undefined;
  const serverGate = truthyFlag(process.env[AUDIO_VAULT_FEATURE_GATE_ENV]);
  const requestOptIn =
    truthyFlag(body?.audioVaultFeatureGate) ||
    truthyFlag(body?.audioVaultInternalRollout);
  return serverGate && requestOptIn;
}

type OptionalAudioVaultClaim =
  | {
      ok: true;
      clientId: string | null;
      docId: string | null;
    }
  | { ok: false; error: string };

function readOptionalAudioVaultClaim(req: Request): OptionalAudioVaultClaim {
  const body = req.body as { clientId?: unknown; docId?: unknown } | undefined;
  const rawClientId = req.apiClient ? req.apiClient.id : body?.clientId;
  let clientId: string | null = null;
  if (rawClientId !== undefined && rawClientId !== null) {
    try {
      clientId = normalizeClientId(rawClientId);
    } catch (err) {
      if (err instanceof InvalidClientIdError) {
        return { ok: false, error: `clientId invalid: ${err.message}` };
      }
      throw err;
    }
  }

  const rawDocId = body?.docId;
  let docId: string | null = null;
  if (rawDocId !== undefined && rawDocId !== null && rawDocId !== "") {
    try {
      assertValidDocId(rawDocId);
      docId = rawDocId;
    } catch (err) {
      if (err instanceof InvalidDocIdError) {
        return { ok: false, error: err.message };
      }
      throw err;
    }
  }

  return { ok: true, clientId, docId };
}

function sanitizeAudioDecode(
  trace: AudioV01DecodeTelemetry,
  alignmentOffsetSec = 0,
) {
  const advisory = buildAudioSupportAdvisory(trace.matchingBitsMax);
  return {
    enabled: trace.enabled,
    attempted: trace.attempted,
    module: trace.module,
    layerId: trace.layerId,
    idRead: trace.idMatched,
    exactMatchBits: advisory.exactMatchBits,
    matchingBits: advisory.matchingBits,
    matchingBitsMax: trace.matchingBitsMax,
    matchPercent: advisory.matchPercent,
    audioSupportLevel: advisory.audioSupportLevel,
    candidateSupportOnly: advisory.candidateSupportOnly,
    matchedTraceIds: trace.matchedTraceIds,
    traceCount: trace.traceCount,
    verdict: trace.idMatched
      ? "AUDIO_ID_MATCH_CANDIDATE_ONLY"
      : trace.verdict === "AUDIO_CANDIDATE"
        ? "AUDIO_CANDIDATE_ONLY"
        : "AUDIO_NOT_FOUND",
    candidateSupportOnlyNoVault: true,
    alignmentOffsetSec,
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
    c2paCanBlock: false,
    wallMs: trace.wallMs,
    note: trace.idMatched
      ? "Standalone audio recovered the expected ID as candidate/support only."
      : trace.note,
  };
}

function summarizeAudioAlignmentAttempt(input: {
  offsetSec: number;
  trace: AudioV01DecodeTelemetry;
}) {
  const advisory = buildAudioSupportAdvisory(input.trace.matchingBitsMax);
  return {
    offsetSec: input.offsetSec,
    idRead: input.trace.idMatched && input.trace.matchingBitsMax === 32,
    exactMatchBits: advisory.exactMatchBits,
    matchingBits: advisory.matchingBits,
    matchingBitsMax: input.trace.matchingBitsMax,
    matchPercent: advisory.matchPercent,
    audioSupportLevel: advisory.audioSupportLevel,
    candidateSupportOnly: advisory.candidateSupportOnly,
    verdict: input.trace.idMatched
      ? "AUDIO_ID_MATCH_CANDIDATE_ONLY"
      : input.trace.verdict === "AUDIO_CANDIDATE"
        ? "AUDIO_CANDIDATE_ONLY"
        : "AUDIO_NOT_FOUND",
  };
}

async function makeAudioReadAlignmentPath(input: {
  sourcePath: string;
  workDir: string;
  offsetSec: number;
}): Promise<string> {
  if (input.offsetSec === 0) return input.sourcePath;
  const offsetMs = Math.round(input.offsetSec * 1000);
  const alignedPath = path.join(
    input.workDir,
    `audio_read_align_${offsetMs}.wav`,
  );
  await runFfmpeg([
    "-i",
    input.sourcePath,
    "-filter_complex",
    `adelay=${offsetMs}:all=1`,
    "-c:a",
    "pcm_s16le",
    alignedPath,
  ], 120_000);
  return alignedPath;
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<string> {
  assertLegacyFfmpegLabAllowed("audio_lab_ffmpeg_helper");
  return new Promise((resolve, reject) => {
    const p = spawn(resolveMediaRuntimePath("ffmpeg"), ["-y", "-hide_banner", "-loglevel", "error", ...args], { windowsHide: true });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`ffmpeg exit ${code}: ${err}`));
    });
    p.on("error", (errObj) => {
      clearTimeout(timer);
      reject(errObj);
    });
  });
}

router.post(
  "/encode",
  requireAdminToken,
  encodeUpload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "missing audio" });
      return;
    }
    const ownership = readAudioOwnershipRegistryInput(req);
    if (!ownership.ok) {
      res.status(400).json({ error: ownership.error });
      return;
    }

    const idInput = (req.body as { id?: string })?.id ?? randomUUID();
    const reqId = randomUUID();
    const workDir = path.join(WORK_BASE, `enc_${reqId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inPath = inputAudioPath(workDir, req.file.originalname);
    const outPath = path.join(workDir, "stamped.wav");

    try {
      fs.writeFileSync(inPath, req.file.buffer);
      const audioRegistryRows = await db
        .select({
          dnaId: aegisDnaRecordsTable.dnaId,
          idHex: aegisDnaRecordsTable.idHex,
          payload4Hex: aegisDnaRecordsTable.payload4Hex,
          clientId: aegisDnaRecordsTable.clientId,
          createdAt: aegisDnaRecordsTable.createdAt,
          dna: aegisDnaRecordsTable.dna,
        })
        .from(aegisDnaRecordsTable)
        .where(eq(aegisDnaRecordsTable.primaryMediaType, "audio"))
        .orderBy(desc(aegisDnaRecordsTable.createdAt))
        .limit(AUDIO_PRESEAL_SCAN_LIMIT);
      const preSealOwnership = await audioPreSealOwnershipCheck({
        audioPath: inPath,
        workDir,
        currentClientId: ownership.clientId,
        registryRecords: audioRegistryRows,
        scanLimit: AUDIO_PRESEAL_SCAN_LIMIT,
      });
      const preSealGate = buildAudioPreSealEncodeGate(preSealOwnership);
      if (!preSealGate.allowEncode) {
        res.status(preSealGate.statusCode).json(preSealGate.responseBody);
        return;
      }

      const encodeResult = await encodeStandaloneAudioV01({
        sourceAudioPath: inPath,
        outputPath: outPath,
        workDir,
        idInput,
        ownerClientId: ownership.clientId,
        ownerDocId: ownership.docId,
      });
      const dna = encodeResult.dna;
      await db
        .insert(aegisDnaRecordsTable)
        .values({
          dnaId: dna.dnaId,
          primaryMediaType: dna.primaryMediaType,
          activeMediaTypes: dna.activeMediaTypes,
          pipelineVersion: dna.pipelineVersion,
          contentDigestHex: dna.contentDigest.hex,
          contentSizeBytes: dna.contentDigest.sizeBytes ?? null,
          geometricChecksum:
            dna.structuralFingerprint.geometricChecksum ?? null,
          idHex: encodeResult.idHex,
          payload4Hex: encodeResult.payload4Hex,
          clientId: ownership.clientId,
          dna,
        })
        .onConflictDoNothing({ target: aegisDnaRecordsTable.dnaId });

      const outBytes = fs.readFileSync(outPath);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tancmark-audio-stamped.wav"',
      );
      res.setHeader("X-Aegis-Audio-Id", encodeResult.idHex);
      res.setHeader("X-Aegis-Audio-Payload4", encodeResult.payload4Hex);
      res.setHeader(
        "X-Aegis-Audio-Decision-Role",
        "candidate_support_only_no_vault",
      );
      res.setHeader("X-Aegis-Audio-Confirmed", "false");
      res.setHeader("X-Aegis-Audio-Can-Open-Vault", "false");
      res.setHeader("X-Aegis-Audio-Vault-Eligible", "false");
      res.setHeader("X-Aegis-C2PA-Can-Block", "false");
      res.status(200).send(outBytes);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : String(err),
      });
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
  "/analyze",
  requireAdminToken,
  analyzeUpload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "missing audio" });
      return;
    }
    const idInput = (req.body as { id?: string })?.id;
    if (!idInput) {
      res.status(400).json({ error: "id required for audio analyze" });
      return;
    }

    const idBuffer = normalizeId(idInput);
    const idHex = idBuffer.toString("hex");
    const dnaId = `audio:${idHex}`;
    const rows = await db
      .select()
      .from(aegisDnaRecordsTable)
      .where(eq(aegisDnaRecordsTable.dnaId, dnaId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({
        error: "audio DNA record not found",
        candidateSupportOnlyNoVault: true,
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
      });
      return;
    }

    const reqId = randomUUID();
    const workDir = path.join(WORK_BASE, `ana_${reqId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inPath = inputAudioPath(workDir, req.file.originalname);

    try {
      fs.writeFileSync(inPath, req.file.buffer);
      const expectedPayload4Hex =
        row.payload4Hex ?? payload4(idBuffer).toString("hex");
      const attempts: Array<{ offsetSec: number; trace: AudioV01DecodeTelemetry }> = [];
      for (const offsetSec of AUDIO_READ_ALIGNMENT_OFFSETS_SEC) {
        const alignedPath = await makeAudioReadAlignmentPath({
          sourcePath: inPath,
          workDir,
          offsetSec,
        });
        const trace = await decodeAudioV01FromDna({
          mediaPath: alignedPath,
          workDir,
          dna: row.dna,
          expectedPayload4Hex,
        });
        attempts.push({ offsetSec, trace });
        if (trace.idMatched && trace.matchingBitsMax === 32) break;
      }
      const selected =
        attempts.find(
          (attempt) =>
            attempt.trace.idMatched && attempt.trace.matchingBitsMax === 32,
        ) ??
        attempts.reduce((best, attempt) =>
          attempt.trace.matchingBitsMax > best.trace.matchingBitsMax
            ? attempt
            : best,
        );
      let aegisDnaReport:
        | Awaited<ReturnType<typeof import("../dna/dnaReport.js").buildDnaReport>>
        | undefined;
      try {
        const { buildDnaReport } = await import("../dna/dnaReport.js");
        aegisDnaReport = await buildDnaReport(dnaId);
      } catch {
        aegisDnaReport = undefined;
      }
      const registryDocId =
        row.dna && typeof row.dna === "object"
          ? ((row.dna as { meta?: { docId?: unknown } }).meta?.docId ?? null)
          : null;
      const featureGateEnabled = audioVaultFeatureGateEnabled(req);
      const claim = featureGateEnabled
        ? readOptionalAudioVaultClaim(req)
        : { ok: true as const, clientId: null, docId: null };
      if (!claim.ok) {
        res.status(400).json({ error: claim.error });
        return;
      }
      const audioVaultRollout = evaluateAudioVaultFeatureGateDecision({
        featureGateEnabled,
        idMatched: selected.trace.idMatched,
        matchingBitsMax: selected.trace.matchingBitsMax,
        expectedDnaId: dnaId,
        registryDnaId: row.dnaId,
        registryClientId: row.clientId,
        registryDocId:
          typeof registryDocId === "string" ? registryDocId : null,
        claimClientId: claim.clientId,
        claimDocId: claim.docId,
        negativeSafetyPassed: true,
      });
      res.json({
        dnaId,
        idHex,
        primaryMediaType: row.primaryMediaType,
        clientId: row.clientId,
        docId:
          typeof registryDocId === "string" ? registryDocId : null,
        audio: sanitizeAudioDecode(selected.trace, selected.offsetSec),
        aegisDnaReport,
        audioVaultRollout,
        audioConfirmed: audioVaultRollout.audioConfirmed,
        audioVaultEligible: audioVaultRollout.audioVaultEligible,
        audioReadAlignment: {
          enabled: true,
          decisionRole: audioVaultRollout.audioVaultEligible
            ? "feature_gated_audio_vault_exact_id_registry_ownership_only"
            : "candidate_support_only_no_vault",
          offsetsSec: AUDIO_READ_ALIGNMENT_OFFSETS_SEC,
          selectedOffsetSec: selected.offsetSec,
          exactMatch:
            selected.trace.idMatched && selected.trace.matchingBitsMax === 32,
          attempts: attempts.map(summarizeAudioAlignmentAttempt),
          partialResultsAreNotAccepted: true,
        },
        candidateSupportOnlyNoVault:
          audioVaultRollout.candidateSupportOnlyNoVault,
        confirmed: audioVaultRollout.confirmed,
        canOpenVault: audioVaultRollout.canOpenVault,
        vaultEligible: audioVaultRollout.vaultEligible,
        final: audioVaultRollout.final,
        c2paCanBlock: false,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : String(err),
      });
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
  "/vault-preview",
  requireAdminToken,
  vaultPreviewUpload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "missing audio" });
      return;
    }
    const idInput = (req.body as { id?: string })?.id;
    if (!idInput) {
      res.status(400).json({ error: "id required for audio vault preview" });
      return;
    }
    const ownership = readAudioOwnershipRegistryInput(req);
    if (!ownership.ok) {
      res.status(400).json({ error: ownership.error });
      return;
    }

    const idBuffer = normalizeId(idInput);
    const idHex = idBuffer.toString("hex");
    const dnaId = `audio:${idHex}`;
    const rows = await db
      .select()
      .from(aegisDnaRecordsTable)
      .where(eq(aegisDnaRecordsTable.dnaId, dnaId))
      .limit(1);
    const row = rows[0];

    if (!row) {
      const decision = evaluateAudioVaultPreviewDecision({
        idMatched: false,
        matchingBitsMax: 0,
        expectedDnaId: dnaId,
        registryDnaId: null,
        registryClientId: null,
        registryDocId: null,
        claimClientId: ownership.clientId,
        claimDocId: ownership.docId,
      });
      res.status(404).json({
        dnaId,
        idHex,
        internalPreviewOnly: true,
        productRouteChanged: false,
        existingAnalyzeRouteStillSupportOnly: true,
        audioConfirmed: decision.audioConfirmed,
        audioVaultEligible: decision.audioVaultEligible,
        decisionBasis: decision.decisionBasis,
        rejectionReason: decision.rejectionReason,
        exactMatchBits: decision.exactMatchBits,
        matchingBits: decision.matchingBits,
        matchPercent: decision.matchPercent,
        audioSupportLevel: decision.audioSupportLevel,
        idMatched: decision.idMatched,
        registryMatched: decision.registryMatched,
        ownershipMatched: decision.ownershipMatched,
        negativeSafetyPassed: decision.negativeSafetyPassed,
        candidateSupportOnly: decision.candidateSupportOnly,
        candidateSupportOnlyNoVault: decision.candidateSupportOnlyNoVault,
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
        c2paCanBlock: false,
      });
      return;
    }

    const reqId = randomUUID();
    const workDir = path.join(WORK_BASE, `vault_prev_${reqId}`);
    fs.mkdirSync(workDir, { recursive: true });
    const inPath = inputAudioPath(workDir, req.file.originalname);

    try {
      fs.writeFileSync(inPath, req.file.buffer);
      const expectedPayload4Hex =
        row.payload4Hex ?? payload4(idBuffer).toString("hex");
      const attempts: Array<{ offsetSec: number; trace: AudioV01DecodeTelemetry }> = [];
      for (const offsetSec of AUDIO_READ_ALIGNMENT_OFFSETS_SEC) {
        const alignedPath = await makeAudioReadAlignmentPath({
          sourcePath: inPath,
          workDir,
          offsetSec,
        });
        const trace = await decodeAudioV01FromDna({
          mediaPath: alignedPath,
          workDir,
          dna: row.dna,
          expectedPayload4Hex,
        });
        attempts.push({ offsetSec, trace });
        if (trace.idMatched && trace.matchingBitsMax === 32) break;
      }
      const selected =
        attempts.find(
          (attempt) =>
            attempt.trace.idMatched && attempt.trace.matchingBitsMax === 32,
        ) ??
        attempts.reduce((best, attempt) =>
          attempt.trace.matchingBitsMax > best.trace.matchingBitsMax
            ? attempt
            : best,
        );
      const registryDocId =
        row.dna && typeof row.dna === "object"
          ? ((row.dna as { meta?: { docId?: unknown } }).meta?.docId ?? null)
          : null;
      const decision = evaluateAudioVaultPreviewDecision({
        idMatched: selected.trace.idMatched,
        matchingBitsMax: selected.trace.matchingBitsMax,
        expectedDnaId: dnaId,
        registryDnaId: row.dnaId,
        registryClientId: row.clientId,
        registryDocId:
          typeof registryDocId === "string" ? registryDocId : null,
        claimClientId: ownership.clientId,
        claimDocId: ownership.docId,
      });

      res.json({
        dnaId,
        idHex,
        primaryMediaType: row.primaryMediaType,
        registryClientId: row.clientId,
        registryDocId:
          typeof registryDocId === "string" ? registryDocId : null,
        claimClientId: ownership.clientId,
        claimDocId: ownership.docId,
        internalPreviewOnly: true,
        productRouteChanged: false,
        existingAnalyzeRouteStillSupportOnly: true,
        audioConfirmed: decision.audioConfirmed,
        audioVaultEligible: decision.audioVaultEligible,
        decisionBasis: decision.decisionBasis,
        rejectionReason: decision.rejectionReason,
        exactMatchBits: decision.exactMatchBits,
        matchingBits: decision.matchingBits,
        matchPercent: decision.matchPercent,
        audioSupportLevel: decision.audioSupportLevel,
        idMatched: decision.idMatched,
        registryMatched: decision.registryMatched,
        ownershipMatched: decision.ownershipMatched,
        negativeSafetyPassed: decision.negativeSafetyPassed,
        candidateSupportOnly: decision.candidateSupportOnly,
        candidateSupportOnlyNoVault: decision.candidateSupportOnlyNoVault,
        audioReadAlignment: {
          enabled: true,
          decisionRole: "internal_preview_only_not_product_vault",
          offsetsSec: AUDIO_READ_ALIGNMENT_OFFSETS_SEC,
          selectedOffsetSec: selected.offsetSec,
          exactMatch:
            selected.trace.idMatched && selected.trace.matchingBitsMax === 32,
          attempts: attempts.map(summarizeAudioAlignmentAttempt),
          partialResultsAreNotAccepted: true,
        },
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
        c2paCanBlock: false,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  },
);

export default router;
