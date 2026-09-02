import type { DecodeResult, DecodeOptions } from "../video/decodeVideo";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { decodeVideo } from "../video/decodeVideo";
import {
  decodeVideoEccRecoveryFromDna,
  extractVideoEccRecoveryPlanFromDna,
  type VideoEccRecoveryDecodeTelemetry,
} from "../video/videoEccRecovery";
import {
  decodeAudioV01FromDna,
  type AudioV01DecodeTelemetry,
} from "../video/audioModule";
import { extractFrames, videoInfo } from "../video/ffmpegHelper";
import { decodeT6, getT6FrameMap } from "../video/t6LowBand";
import type { T6Telemetry } from "../video/t6Types";
import {
  readVisualEccRecoveryLayer,
  recoverVisualEccIdFromPartialMain,
  visualEccParityBytesFromCloakId,
  type VisualEccPartialRecoveryResult,
} from "@workspace/aegis-core";

export const LIVE_EXACT_TRACE_RECOVERY_DECISION_ROLE =
  "live_exact_trace_recovery_support_only_no_vault_no_confirmed" as const;

export type LiveExactTraceSource =
  | "classic_video_trace"
  | "t6_low_band_exact_trace"
  | "video_ecc_recovery_exact_trace"
  | "partial_main_ecc_exact_trace"
  | "audio_v01_exact_trace"
  | "none";

export interface LivePartialEccRecoveryTelemetry {
  attempted: boolean;
  recovered: boolean;
  recoveredMatchesExpected: boolean;
  reason: VisualEccPartialRecoveryResult["reason"] | "no_plan" | "no_candidate";
  knownMainBytes: number;
  bestParityBitMatches: number;
  bestCorrected: number;
  bestCandidates: number;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface LiveAudioV01ExactTraceTelemetry {
  attempted: boolean;
  idMatched: boolean;
  verdict: AudioV01DecodeTelemetry["verdict"] | "decode_error";
  matchingBitsMax: number;
  matchedTraceCount: number;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

type LivePartialEccRecoveryReason =
  | VisualEccPartialRecoveryResult["reason"]
  | "no_plan"
  | "no_candidate";

interface LivePartialEccObservation {
  parityBytes: Uint8Array;
  byteConfidence: number[];
  parityByteBitMatches: number[];
  bitMatches: number;
}

interface LivePartialMainCandidate {
  bytes: Uint8Array;
  erasures: number[];
}

export interface LiveExactTraceRecoveryInput {
  videoPath: string;
  idInput: string;
  workDir: string;
  dna?: unknown;
  expectedPayload4Hex?: string;
  enableT6LowBandTelemetry?: boolean;
  dnaHintProvider?: DecodeOptions["dnaHintProvider"];
  channelBHintProvider?: DecodeOptions["channelBHintProvider"];
}

export interface LiveExactTraceRecoveryResult {
  exactTraceFound: boolean;
  exactTraceSource: LiveExactTraceSource;
  baseVerdict: DecodeResult["verdict"];
  finalConfirmedBy: DecodeResult["finalConfirmedBy"];
  t6Verdict: string | null;
  t6MatchingBits: number | null;
  liveT6Telemetry: T6Telemetry | null;
  videoEccVerdict: VideoEccRecoveryDecodeTelemetry["verdict"] | null;
  videoEccRecoveredMatchesExpected: boolean | null;
  partialEccRecovery: LivePartialEccRecoveryTelemetry | null;
  audioV01ExactTrace: LiveAudioV01ExactTraceTelemetry | null;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  changesMainDecisionSystem: false;
  changesVaultFinalCore: false;
  decisionRole: typeof LIVE_EXACT_TRACE_RECOVERY_DECISION_ROLE;
  decode: DecodeResult;
  videoEccRecoveryTrace: VideoEccRecoveryDecodeTelemetry | null;
}

export async function readLiveExactTraceWithRecovery(
  input: LiveExactTraceRecoveryInput,
): Promise<LiveExactTraceRecoveryResult> {
  const previousT6Flag = process.env.V06_T6_LOWBAND;
  if (input.enableT6LowBandTelemetry === true) {
    process.env.V06_T6_LOWBAND = "1";
  }
  try {
    const decode = await decodeVideo({
      videoPath: input.videoPath,
      idInput: input.idInput,
      workDir: input.workDir,
      dnaHintProvider: input.dnaHintProvider,
      channelBHintProvider: input.channelBHintProvider,
    });
    const requestedPayload4Hex = decode.expectedPayload4Hex.toLowerCase();
    const suppliedExpectedPayload4Hex =
      input.expectedPayload4Hex?.toLowerCase();
    const registeredExpectedMatchesRequest =
      suppliedExpectedPayload4Hex === undefined ||
      suppliedExpectedPayload4Hex === requestedPayload4Hex;
    const expectedPayload4Hex = registeredExpectedMatchesRequest
      ? (suppliedExpectedPayload4Hex ?? requestedPayload4Hex)
      : requestedPayload4Hex;
    const videoEccRecoveryTrace =
      input.dna && registeredExpectedMatchesRequest && expectedPayload4Hex
        ? await decodeVideoEccRecoveryFromDna({
            videoPath: input.videoPath,
            workDir: input.workDir,
            dna: input.dna,
            expectedPayload4Hex,
          })
        : null;
    const partialEccRecovery =
      input.dna && registeredExpectedMatchesRequest && expectedPayload4Hex
        ? await readLivePartialMainEccRecovery({
            videoPath: input.videoPath,
            workDir: input.workDir,
            dna: input.dna,
            expectedPayload4Hex,
            decode,
          })
        : null;
    const audioV01ExactTrace =
      input.dna && registeredExpectedMatchesRequest && expectedPayload4Hex
        ? await readLiveAudioV01ExactTrace({
            videoPath: input.videoPath,
            workDir: input.workDir,
            dna: input.dna,
            expectedPayload4Hex,
          })
        : null;
    const liveT6Telemetry = await readLiveT6ExactTelemetry({
      enabled: input.enableT6LowBandTelemetry === true,
      shouldAttempt:
        decode.verdict !== "VAULT" && decode.t6?.attempted !== true,
      videoPath: input.videoPath,
      workDir: input.workDir,
      expectedPayload4Hex,
    });

    const classicExact =
      decode.verdict === "VAULT" && decode.finalConfirmedBy !== "none";
    const t6Exact =
      (decode.t6?.verdict === "T6_VAULT" &&
        decode.t6.parityOk === true &&
        decode.t6.hashOk === true) ||
      (liveT6Telemetry?.verdict === "T6_VAULT" &&
        liveT6Telemetry.parityOk === true &&
        liveT6Telemetry.hashOk === true);
    const videoEccExact =
      videoEccRecoveryTrace?.candidateSupport === true &&
      videoEccRecoveryTrace.recoveredMatchesExpected === true;
    const partialEccExact =
      partialEccRecovery?.recovered === true &&
      partialEccRecovery.recoveredMatchesExpected === true;
    const audioV01Exact = audioV01ExactTrace?.idMatched === true;

    const exactTraceSource: LiveExactTraceSource = classicExact
      ? "classic_video_trace"
      : t6Exact
        ? "t6_low_band_exact_trace"
        : videoEccExact
          ? "video_ecc_recovery_exact_trace"
          : partialEccExact
            ? "partial_main_ecc_exact_trace"
            : audioV01Exact
              ? "audio_v01_exact_trace"
          : "none";

    return {
      exactTraceFound: exactTraceSource !== "none",
      exactTraceSource,
      baseVerdict: decode.verdict,
      finalConfirmedBy: decode.finalConfirmedBy,
      t6Verdict: liveT6Telemetry?.verdict ?? decode.t6?.verdict ?? null,
      t6MatchingBits:
        liveT6Telemetry?.matchingBits ?? decode.t6?.matchingBits ?? null,
      liveT6Telemetry,
      videoEccVerdict: videoEccRecoveryTrace?.verdict ?? null,
      videoEccRecoveredMatchesExpected:
        videoEccRecoveryTrace?.recoveredMatchesExpected ?? null,
      partialEccRecovery,
      audioV01ExactTrace,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
      changesMainDecisionSystem: false,
      changesVaultFinalCore: false,
      decisionRole: LIVE_EXACT_TRACE_RECOVERY_DECISION_ROLE,
      decode,
      videoEccRecoveryTrace,
    };
  } finally {
    if (previousT6Flag === undefined) {
      delete process.env.V06_T6_LOWBAND;
    } else {
      process.env.V06_T6_LOWBAND = previousT6Flag;
    }
  }
}

async function readLiveAudioV01ExactTrace(input: {
  videoPath: string;
  workDir: string;
  dna: unknown;
  expectedPayload4Hex: string;
}): Promise<LiveAudioV01ExactTraceTelemetry> {
  const workDir = `${input.workDir}_audio_v01_exact`;
  fs.mkdirSync(workDir, { recursive: true });
  try {
    const trace = await decodeAudioV01FromDna({
      mediaPath: input.videoPath,
      workDir,
      dna: input.dna,
      expectedPayload4Hex: input.expectedPayload4Hex,
    });
    return {
      attempted: trace.attempted,
      idMatched: trace.idMatched === true && trace.verdict === "AUDIO_ID_MATCH",
      verdict: trace.verdict,
      matchingBitsMax: trace.matchingBitsMax,
      matchedTraceCount: trace.matchedTraceIds.length,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    };
  } catch {
    return {
      attempted: true,
      idMatched: false,
      verdict: "decode_error",
      matchingBitsMax: 0,
      matchedTraceCount: 0,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup */
    }
  }
}

async function readLivePartialMainEccRecovery(input: {
  videoPath: string;
  workDir: string;
  dna: unknown;
  expectedPayload4Hex: string;
  decode: DecodeResult;
}): Promise<LivePartialEccRecoveryTelemetry> {
  const plan = extractVideoEccRecoveryPlanFromDna(input.dna);
  if (!plan?.active || !/^[0-9a-f]{8}$/i.test(input.expectedPayload4Hex)) {
    return emptyPartial("no_plan");
  }
  const expected = Buffer.from(input.expectedPayload4Hex, "hex");
  const main = buildMainByteCandidate(input.decode, expected);
  const info = await videoInfo(input.videoPath);
  const readDir = `${input.workDir}_partial_ecc`;
  const observations: LivePartialEccObservation[] = [];
  try {
    for (const offset of plan.frameWindowOffsets) {
      const shifted = plan.frameIdxs.map((idx) =>
        clampInt(idx + offset, 0, Math.max(0, info.frameCount - 1)),
      );
      const frameDir = path.join(readDir, `o_${offset}`);
      const extracted = await extractFrames(
        input.videoPath,
        shifted.map((idx) => idx / info.fps + 0.5 / info.fps),
        frameDir,
      );
      for (const frame of extracted) {
        observations.push(await readEccObservation(frame.pngPath, plan.cloakId));
        if (info.width !== plan.width || info.height !== plan.height) {
          observations.push(
            await readEccObservation(frame.pngPath, plan.cloakId, {
              width: plan.width,
              height: plan.height,
            }),
          );
        }
      }
    }
    const recovered = tryPartialEccRecovery({
      mainIdBytes: main.bytes,
      mainErasures: main.erasures,
      observations,
      expectedCloakId: plan.cloakId,
    });
    return {
      attempted: true,
      recovered: recovered.result.recovered,
      recoveredMatchesExpected: recovered.result.recoveredMatchesExpected,
      reason: recovered.result.reason,
      knownMainBytes: 4 - main.erasures.length,
      bestParityBitMatches: recovered.bestParityBitMatches,
      bestCorrected: recovered.result.corrected,
      bestCandidates: recovered.result.candidates,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    };
  } catch {
    return emptyPartial("no_candidate");
  } finally {
    try {
      fs.rmSync(readDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup */
    }
  }
}

function emptyPartial(
  reason: LivePartialEccRecoveryReason,
): LivePartialEccRecoveryTelemetry {
  return {
    attempted: reason !== "no_plan",
    recovered: false,
    recoveredMatchesExpected: false,
    reason,
    knownMainBytes: 0,
    bestParityBitMatches: 0,
    bestCorrected: 0,
    bestCandidates: 0,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

function buildMainByteCandidate(
  decode: DecodeResult,
  expected: Buffer,
): LivePartialMainCandidate {
  const bytes = new Uint8Array([0, 0, 0, 0]);
  const erasures: number[] = [];
  for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
    let expectedHits = 0;
    let corroboratedHits = 0;
    for (const frame of decode.frames) {
      if (!/^[0-9a-f]{8}$/i.test(frame.decoded4Hex)) continue;
      const observed = Number.parseInt(
        frame.decoded4Hex.slice(byteIndex * 2, byteIndex * 2 + 2),
        16,
      );
      if (Number.isNaN(observed) || observed !== expected[byteIndex]) {
        continue;
      }
      expectedHits++;
      if (frame.strongAnchors >= 2 || frame.byteMatches >= 2) {
        corroboratedHits++;
      }
    }
    if (corroboratedHits > 0 || expectedHits >= 2) {
      bytes[byteIndex] = expected[byteIndex]!;
    } else {
      erasures.push(byteIndex);
    }
  }
  return { bytes, erasures };
}

async function readEccObservation(
  pngPath: string,
  cloakId: string,
  normalizeTo?: { width: number; height: number },
): Promise<LivePartialEccObservation> {
  const img = sharp(pngPath).ensureAlpha();
  const normalized = normalizeTo
    ? img.resize(normalizeTo.width, normalizeTo.height, {
        fit: "fill",
        kernel: "lanczos3",
      })
    : img;
  const { data, info } = await normalized
    .raw()
    .toBuffer({ resolveWithObject: true });
  const read = readVisualEccRecoveryLayer(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    4,
  );
  const expectedParity = visualEccParityBytesFromCloakId(cloakId);
  const expectedBits = expectedParity ? bytesToBits([...expectedParity]) : [];
  const bitMatches =
    expectedBits.length === read.parityBits.length
      ? countEqual(read.parityBits, expectedBits)
      : 0;
  return {
    parityBytes: Uint8Array.from(read.parityBytes),
    byteConfidence: [...read.byteConfidence],
    parityByteBitMatches:
      expectedBits.length === read.parityBits.length
        ? countByteBitMatches(read.parityBits, expectedBits)
        : [0, 0, 0, 0],
    bitMatches,
  };
}

function tryPartialEccRecovery(input: {
  mainIdBytes: Uint8Array;
  mainErasures: number[];
  observations: readonly LivePartialEccObservation[];
  expectedCloakId: string;
}): {
  result: VisualEccPartialRecoveryResult;
  bestParityBitMatches: number;
} {
  const empty = emptyPartialRecoveryResult("no_consistent_codeword");
  let best: {
    result: VisualEccPartialRecoveryResult;
    bitMatches: number;
  } = { result: empty, bitMatches: 0 };
  const knownMainBytes = 4 - input.mainErasures.length;
  const confidenceFloors = [18, 14, 10, 6, 3, 0];

  for (const observation of input.observations) {
    best = choosePartialRecovery(best, {
      result: empty,
      bitMatches: observation.bitMatches,
    });
    for (const confidenceFloor of confidenceFloors) {
      const parityErasures = parityErasuresForObservation(
        observation,
        confidenceFloor,
      );
      const knownParityBytes = 4 - parityErasures.length;
      if (!isSafePartialRecoveryShape(knownMainBytes, knownParityBytes)) {
        continue;
      }
      const erasurePositions = [
        ...input.mainErasures,
        ...parityErasures.map((index) => index + 4),
      ];
      if (erasurePositions.length > 4) continue;
      const result = recoverVisualEccIdFromPartialMain({
        mainIdBytes: input.mainIdBytes,
        parityBytes: observation.parityBytes,
        erasurePositions,
        expectedCloakId: input.expectedCloakId,
      });
      best = choosePartialRecovery(best, {
        result,
        bitMatches: observation.bitMatches,
      });
      if (result.recovered && result.recoveredMatchesExpected) {
        return { result, bestParityBitMatches: observation.bitMatches };
      }
    }
  }

  for (const confidenceFloor of confidenceFloors) {
    const aggregate = aggregateParityObservations(
      input.observations,
      confidenceFloor,
    );
    if (!aggregate) continue;
    if (!isSafePartialRecoveryShape(knownMainBytes, aggregate.knownParityBytes)) {
      continue;
    }
    const erasurePositions = [
      ...input.mainErasures,
      ...aggregate.erasures.map((index) => index + 4),
    ];
    if (erasurePositions.length > 4) continue;
    const result = recoverVisualEccIdFromPartialMain({
      mainIdBytes: input.mainIdBytes,
      parityBytes: aggregate.parityBytes,
      erasurePositions,
      expectedCloakId: input.expectedCloakId,
    });
    best = choosePartialRecovery(best, {
      result,
      bitMatches: aggregate.bitMatches,
    });
    if (result.recovered && result.recoveredMatchesExpected) {
      return { result, bestParityBitMatches: aggregate.bitMatches };
    }
  }

  return {
    result: best.result,
    bestParityBitMatches: best.bitMatches,
  };
}

function isSafePartialRecoveryShape(
  knownMainBytes: number,
  knownParityBytes: number,
): boolean {
  return (
    knownMainBytes + knownParityBytes >= 4 &&
    (knownMainBytes > 0 || knownParityBytes === 4) &&
    knownParityBytes > 0
  );
}

function parityErasuresForObservation(
  observation: LivePartialEccObservation,
  confidenceFloor: number,
): number[] {
  const erasures: number[] = [];
  for (let i = 0; i < 4; i++) {
    const exactByte = (observation.parityByteBitMatches[i] ?? 0) === 8;
    const nearByte = (observation.parityByteBitMatches[i] ?? 0) >= 6;
    const lowConfidence = (observation.byteConfidence[i] ?? 0) < confidenceFloor;
    if (!exactByte && (nearByte || lowConfidence)) erasures.push(i);
  }
  return erasures;
}

function aggregateParityObservations(
  observations: readonly LivePartialEccObservation[],
  confidenceFloor: number,
): {
  parityBytes: Uint8Array;
  erasures: number[];
  knownParityBytes: number;
  bitMatches: number;
} | null {
  if (observations.length === 0) return null;
  const parityBytes = new Uint8Array([0, 0, 0, 0]);
  const erasures: number[] = [];
  let bitMatches = 0;
  for (let i = 0; i < 4; i++) {
    const counts = new Map<number, number>();
    for (const observation of observations) {
      if ((observation.byteConfidence[i] ?? 0) < confidenceFloor) continue;
      const byte = observation.parityBytes[i] ?? 0;
      counts.set(byte, (counts.get(byte) ?? 0) + 1);
    }
    const picked = pickUniqueMajority(counts);
    if (picked === null) {
      erasures.push(i);
    } else {
      parityBytes[i] = picked;
    }
  }
  for (const observation of observations) {
    bitMatches = Math.max(bitMatches, observation.bitMatches);
  }
  return {
    parityBytes,
    erasures,
    knownParityBytes: 4 - erasures.length,
    bitMatches,
  };
}

function pickUniqueMajority(counts: ReadonlyMap<number, number>): number | null {
  let bestByte: number | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [byte, count] of counts.entries()) {
    if (count > bestCount) {
      bestByte = byte;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  if (bestByte === null || bestCount === 0 || tied) return null;
  return bestByte;
}

function choosePartialRecovery(
  current: {
    result: VisualEccPartialRecoveryResult;
    bitMatches: number;
  },
  next: {
    result: VisualEccPartialRecoveryResult;
    bitMatches: number;
  },
): {
  result: VisualEccPartialRecoveryResult;
  bitMatches: number;
} {
  if (
    next.result.recoveredMatchesExpected !==
    current.result.recoveredMatchesExpected
  ) {
    return next.result.recoveredMatchesExpected ? next : current;
  }
  if (next.result.recovered !== current.result.recovered) {
    return next.result.recovered ? next : current;
  }
  if (next.bitMatches !== current.bitMatches) {
    return next.bitMatches > current.bitMatches ? next : current;
  }
  return next.result.corrected < current.result.corrected ? next : current;
}

function emptyPartialRecoveryResult(
  reason: VisualEccPartialRecoveryResult["reason"],
): VisualEccPartialRecoveryResult {
  return {
    recovered: false,
    recoveredIdHex: null,
    recoveredMatchesExpected: false,
    reason,
    candidates: 0,
    corrected: 0,
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
  };
}

function bytesToBits(bytes: readonly number[]): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) bits.push((byte >>> bit) & 1);
  }
  return bits;
}

function countEqual(a: readonly number[], b: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) count++;
  }
  return count;
}

function countByteBitMatches(
  observedBits: readonly number[],
  expectedBits: readonly number[],
): number[] {
  const out: number[] = [];
  for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
    out.push(
      countEqual(
        observedBits.slice(byteIndex * 8, byteIndex * 8 + 8),
        expectedBits.slice(byteIndex * 8, byteIndex * 8 + 8),
      ),
    );
  }
  return out;
}

function clampInt(v: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, v));
}

async function readLiveT6ExactTelemetry(input: {
  enabled: boolean;
  shouldAttempt: boolean;
  videoPath: string;
  workDir: string;
  expectedPayload4Hex: string;
}): Promise<T6Telemetry | null> {
  if (!input.enabled || !input.shouldAttempt) return null;
  if (!/^[0-9a-f]{8}$/i.test(input.expectedPayload4Hex)) return null;
  const info = await videoInfo(input.videoPath);
  const t6Map = getT6FrameMap(info.frameCount);
  if (t6Map.length === 0) return null;
  const t6WorkDir = `${input.workDir}_live_t6_exact`;
  try {
    const extracted = await extractFrames(
      input.videoPath,
      t6Map.map((m) => m.idx / info.fps),
      t6WorkDir,
    );
    return decodeT6({
      framePaths: extracted.map((frame, index) => ({
        tsSec: frame.tsSec,
        pngPath: frame.pngPath,
        slot: t6Map[index]?.slot ?? 0,
      })),
      videoDurationSec: info.durationSec,
      expectedPayload4: Buffer.from(input.expectedPayload4Hex, "hex"),
    });
  } finally {
    try {
      fs.rmSync(t6WorkDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup */
    }
  }
}
