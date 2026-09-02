import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  addLayer,
  createEmptyDNA,
  dnaSha256Hex,
  geometricChecksumFromRegions,
  type AegisDNA,
  type DNARegion,
} from "@workspace/aegis-core";
import { assertLegacyFfmpegLabAllowed } from "../middlewares/productRuntimeGuards";
import {
  approvedMediaRuntimeChildEnvironment,
  resolveMediaRuntimePath,
  type MediaRuntimeTool,
} from "./mediaRuntimePathResolver";
import { normalizeId, payload4 } from "./aegisCore";

export const AUDIO_V01_LAYER_ID = "audio-v01-dual-fsk";
export const AUDIO_TRACE_LOW_ID = "audio.v01.low-fsk";
export const AUDIO_TRACE_MID_ID = "audio.v01.mid-fsk";

export type AudioV01Verdict =
  | "AUDIO_ID_MATCH"
  | "AUDIO_CANDIDATE"
  | "AUDIO_NONE";

export interface AudioV01Info {
  hasAudio: boolean;
  durationSec: number;
  sampleRate: number;
  channels: number;
  codec: string;
}

export interface AudioV01TracePlan {
  traceId: string;
  carrier: "audio-fsk-energy";
  startSec: number;
  bitDurationSec: number;
  durationSec: number;
  bitCount: 32;
  sampleRate: 16000;
  freqZeroHz: number;
  freqOneHz: number;
  amplitude: number;
  carries: "payload4";
}

export interface AudioV01SealPlan {
  enabled: true;
  module: "audio";
  layerId: typeof AUDIO_V01_LAYER_ID;
  version: "audio-v0.1";
  hasAudio: boolean;
  active: boolean;
  audioInfo: AudioV01Info;
  traces: AudioV01TracePlan[];
  traceCount: number;
  independentSealCount: number;
  sealIndependent: boolean;
  sealOverlaps: boolean;
  canOpenAudioVault: true;
  changesVideoChannelAB: false;
  changesVisualModule: false;
  createsChannelC: false;
  note: string;
}

export interface AudioV01TraceDecodeTelemetry extends AudioV01TracePlan {
  attempted: boolean;
  expectedPayloadHex: string;
  candidatePayloadHex: string;
  matchingBits: number;
  unknownBits: number;
  idMatched: boolean;
  verdict: AudioV01Verdict;
  avgMarginDb: number;
}

export interface AudioV01DecodeTelemetry {
  enabled: boolean;
  attempted: boolean;
  module: "audio";
  layerId: typeof AUDIO_V01_LAYER_ID;
  audioInfo: AudioV01Info;
  traces: AudioV01TraceDecodeTelemetry[];
  idMatched: boolean;
  matchingBitsMax: number;
  matchedTraceIds: string[];
  traceCount: number;
  verdict: AudioV01Verdict;
  canOpenAudioVault: boolean;
  officialDecisionRole: "AUDIO_VAULT requires exact ID match";
  note: string;
  wallMs: number;
}

export interface StandaloneAudioV01EncodeResult {
  outputPath: string;
  idHex: string;
  payload4Hex: string;
  dna: AegisDNA;
  plan: AudioV01SealPlan;
}

const AUDIO_SAMPLE_RATE = 16000;
const AUDIO_BITS = 32;
const BIT_DURATION_SEC = 0.052;
const TRACE_DURATION_SEC = AUDIO_BITS * BIT_DURATION_SEC;
const MIN_AUDIO_DURATION_SEC = TRACE_DURATION_SEC * 2 + 1.2;
const AUDIO_AMPLITUDE = 1850;

export async function buildAudioV01SealPlan(
  mediaPath: string,
): Promise<AudioV01SealPlan> {
  const audioInfo = await probeAudioInfo(mediaPath);
  if (!audioInfo.hasAudio) {
    return emptyAudioPlan(audioInfo, "No audio stream detected.");
  }
  if (audioInfo.durationSec < MIN_AUDIO_DURATION_SEC) {
    return emptyAudioPlan(
      audioInfo,
      `Audio too short for two independent v0.1 traces (${audioInfo.durationSec.toFixed(2)}s).`,
    );
  }
  const lowStart = Math.max(0.55, audioInfo.durationSec * 0.18);
  const midStart = Math.min(
    Math.max(lowStart + TRACE_DURATION_SEC + 0.45, audioInfo.durationSec * 0.62),
    audioInfo.durationSec - TRACE_DURATION_SEC - 0.45,
  );
  if (midStart <= lowStart + TRACE_DURATION_SEC + 0.2) {
    return emptyAudioPlan(
      audioInfo,
      "Could not place two non-overlapping audio traces safely.",
    );
  }
  const traces: AudioV01TracePlan[] = [
    {
      traceId: AUDIO_TRACE_LOW_ID,
      carrier: "audio-fsk-energy",
      startSec: lowStart,
      bitDurationSec: BIT_DURATION_SEC,
      durationSec: TRACE_DURATION_SEC,
      bitCount: AUDIO_BITS,
      sampleRate: AUDIO_SAMPLE_RATE,
      freqZeroHz: 730,
      freqOneHz: 1290,
      amplitude: AUDIO_AMPLITUDE,
      carries: "payload4",
    },
    {
      traceId: AUDIO_TRACE_MID_ID,
      carrier: "audio-fsk-energy",
      startSec: midStart,
      bitDurationSec: BIT_DURATION_SEC,
      durationSec: TRACE_DURATION_SEC,
      bitCount: AUDIO_BITS,
      sampleRate: AUDIO_SAMPLE_RATE,
      freqZeroHz: 1810,
      freqOneHz: 2630,
      amplitude: AUDIO_AMPLITUDE,
      carries: "payload4",
    },
  ];
  return {
    enabled: true,
    module: "audio",
    layerId: AUDIO_V01_LAYER_ID,
    version: "audio-v0.1",
    hasAudio: true,
    active: true,
    audioInfo,
    traces,
    traceCount: traces.length,
    independentSealCount: traces.length,
    sealIndependent: traces.length >= 2,
    sealOverlaps: false,
    canOpenAudioVault: true,
    changesVideoChannelAB: false,
    changesVisualModule: false,
    createsChannelC: false,
    note:
      "Audio v0.1 stamped two non-overlapping FSK traces. Each trace carries the full ID independently; no fragment combining.",
  };
}

export async function muxAudioV01IntoVideo(input: {
  sourceMediaPath: string;
  videoOnlyPath: string;
  outputPath: string;
  workDir: string;
  payload4: Buffer;
  plan: AudioV01SealPlan;
}): Promise<void> {
  if (!input.plan.audioInfo.hasAudio) {
    fs.copyFileSync(input.videoOnlyPath, input.outputPath);
    return;
  }
  if (!input.plan.active || input.plan.traces.length < 2) {
    await muxOriginalAudio({
      sourceMediaPath: input.sourceMediaPath,
      videoOnlyPath: input.videoOnlyPath,
      outputPath: input.outputPath,
    });
    return;
  }
  const rawIn = path.join(input.workDir, "audio_v01_input.s16le");
  const rawOut = path.join(input.workDir, "audio_v01_stamped.s16le");
  await runFfmpeg([
    "-i",
    input.sourceMediaPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-f",
    "s16le",
    rawIn,
  ], 120_000);
  const samples = readS16le(rawIn);
  const bits = payloadToBits(input.payload4);
  for (const trace of input.plan.traces) {
    stampTrace(samples, bits, trace);
  }
  writeS16le(rawOut, samples);
  await runFfmpeg([
    "-i",
    input.videoOnlyPath,
    "-f",
    "s16le",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-ac",
    "1",
    "-i",
    rawOut,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    input.outputPath,
  ], 120_000);
}

export async function encodeStandaloneAudioV01(input: {
  sourceAudioPath: string;
  outputPath: string;
  workDir: string;
  idInput: string;
  ownerClientId: string;
  ownerDocId?: string | null;
}): Promise<StandaloneAudioV01EncodeResult> {
  const idBuffer = normalizeId(input.idInput);
  const p4 = payload4(idBuffer);
  const plan = await buildAudioV01SealPlan(input.sourceAudioPath);
  if (!plan.hasAudio) {
    throw new Error("audio_not_sealable: no audio stream detected");
  }
  if (!plan.active || plan.traces.length === 0) {
    throw new Error(`audio_not_sealable: ${plan.note}`);
  }

  const rawIn = path.join(input.workDir, "standalone_audio_v01_input.s16le");
  const rawOut = path.join(input.workDir, "standalone_audio_v01_stamped.s16le");
  await runFfmpeg([
    "-i",
    input.sourceAudioPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-f",
    "s16le",
    rawIn,
  ], 120_000);
  const samples = readS16le(rawIn);
  const bits = payloadToBits(p4);
  for (const trace of plan.traces) {
    stampTrace(samples, bits, trace);
  }
  writeS16le(rawOut, samples);
  await runFfmpeg([
    "-f",
    "s16le",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-ac",
    "1",
    "-i",
    rawOut,
    "-c:a",
    "pcm_s16le",
    input.outputPath,
  ], 120_000);

  const sourceBytes = fs.readFileSync(input.sourceAudioPath);
  const idHex = idBuffer.toString("hex");
  const payload4Hex = p4.toString("hex");
  const regions: DNARegion[] = plan.traces.map((trace) => ({
    regionId: trace.traceId,
    shape: "audioBin",
    timeStart: trace.startSec,
    timeEnd: trace.startSec + trace.durationSec,
    freqBinStart: Math.min(trace.freqZeroHz, trace.freqOneHz),
    freqBinEnd: Math.max(trace.freqZeroHz, trace.freqOneHz),
    carries: "audio v0.1 payload4 trace",
    meta: {
      bitCount: trace.bitCount,
      sampleRate: trace.sampleRate,
      amplitude: trace.amplitude,
      decisionRole: "candidate_support_only_no_vault",
    },
  }));
  const dna = createEmptyDNA({
    dnaId: `audio:${idHex}`,
    primaryMediaType: "audio",
    activeMediaTypes: ["audio"],
    pipelineVersion: "audio-v0.1-standalone",
    geometry: {
      durationSec: plan.audioInfo.durationSec,
      sampleRate: plan.audioInfo.sampleRate,
      channelCount: plan.audioInfo.channels,
    },
    contentDigest: {
      algo: "sha256",
      hex: dnaSha256Hex(sourceBytes),
      sizeBytes: sourceBytes.byteLength,
      source: "bytes",
    },
    structuralFingerprint: {
      audioFingerprint: undefined,
      geometricChecksum: geometricChecksumFromRegions(regions),
      structuralStats: {
        durationSec: plan.audioInfo.durationSec,
        sampleRate: plan.audioInfo.sampleRate,
        channelCount: plan.audioInfo.channels,
      },
    },
    evidence: {
      idHex,
      payload4Hex,
      evidencePackId: null,
    },
    freeZoneHints: ["audio:v0.1-two-non-overlapping-fsk-traces"],
    meta: {
      clientId: input.ownerClientId,
      docId: input.ownerDocId ?? null,
      audioV01Seal: {
        ...plan,
        canOpenAudioVault: false,
        standaloneDecisionRole: "candidate_support_only_no_vault",
      },
      audioOwnershipRegistry: {
        phase: "independent_audio_module_phase_1",
        clientId: input.ownerClientId,
        docId: input.ownerDocId ?? null,
        preSealBlockingEnabled: false,
        c2paBlocksSeal: false,
        decisionRole: "record_only_not_blocking",
      },
      standaloneAudio: {
        candidateSupportOnlyNoVault: true,
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
      },
    },
  });
  addLayer(dna, {
    layerId: AUDIO_V01_LAYER_ID,
    mediaType: "audio",
    version: "audio-v0.1",
    active: true,
    units: plan.traces.map((trace, idx) => ({
      unitKey: trace.traceId,
      unitMeta: {
        index: idx,
        startSec: trace.startSec,
        durationSec: trace.durationSec,
      },
      regions: [regions[idx]!],
    })),
    reservedZones: regions.map((region) => ({
      unitScope: region.regionId,
      region,
      ownerLayer: AUDIO_V01_LAYER_ID,
      reason: "standalone audio v0.1 trace",
    })),
    freeZoneHint: "audio traces are support-only and never open VAULT by themselves",
    meta: {
      decisionRole: "candidate_support_only_no_vault",
      canOpenVault: false,
      confirmed: false,
      vaultEligible: false,
    },
  });

  return {
    outputPath: input.outputPath,
    idHex,
    payload4Hex,
    dna,
    plan,
  };
}

export async function decodeAudioV01FromDna(input: {
  mediaPath: string;
  workDir: string;
  dna: unknown;
  expectedPayload4Hex: string;
}): Promise<AudioV01DecodeTelemetry> {
  const t0 = Date.now();
  const plan = extractAudioV01SealPlanFromDna(input.dna);
  const expectedPayload4 = Buffer.from(input.expectedPayload4Hex || "", "hex");
  if (
    !plan.hasAudio ||
    !plan.active ||
    plan.traces.length === 0 ||
    expectedPayload4.length !== 4
  ) {
    return emptyAudioDecode(plan, Date.now() - t0);
  }
  const rawPath = path.join(input.workDir, `audio_v01_decode_${Date.now()}.s16le`);
  await runFfmpeg([
    "-i",
    input.mediaPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-f",
    "s16le",
    rawPath,
  ], 120_000);
  const samples = readS16le(rawPath);
  const expectedBits = payloadToBits(expectedPayload4);
  const traces = plan.traces.map((trace) =>
    decodeTrace(samples, expectedPayload4.toString("hex"), expectedBits, trace),
  );
  const matchedTraceIds = traces
    .filter((trace) => trace.idMatched)
    .map((trace) => trace.traceId);
  const matchingBitsMax = traces.reduce(
    (max, trace) => Math.max(max, trace.matchingBits),
    0,
  );
  const idMatched = matchedTraceIds.length > 0;
  const verdict: AudioV01Verdict = idMatched
    ? "AUDIO_ID_MATCH"
    : matchingBitsMax >= 24
      ? "AUDIO_CANDIDATE"
      : "AUDIO_NONE";
  return {
    enabled: true,
    attempted: true,
    module: "audio",
    layerId: AUDIO_V01_LAYER_ID,
    audioInfo: plan.audioInfo,
    traces,
    idMatched,
    matchingBitsMax,
    matchedTraceIds,
    traceCount: traces.length,
    verdict,
    canOpenAudioVault: idMatched,
    officialDecisionRole: "AUDIO_VAULT requires exact ID match",
    note: idMatched
      ? "Audio v0.1 recovered the expected ID from an independent audio trace."
      : verdict === "AUDIO_CANDIDATE"
        ? "Audio v0.1 saw candidate signal, but not an exact official ID match."
        : "Audio v0.1 did not recover the expected ID.",
    wallMs: Date.now() - t0,
  };
}

export function extractAudioV01SealPlanFromDna(
  dna: unknown,
): AudioV01SealPlan {
  const rec = asRecord(dna);
  const meta = asRecord(rec["meta"]);
  const fromMeta = meta["audioV01Seal"];
  if (isAudioPlan(fromMeta)) return fromMeta;
  return emptyAudioPlan(
    {
      hasAudio: false,
      durationSec: 0,
      sampleRate: 0,
      channels: 0,
      codec: "unknown",
    },
    "Audio v0.1 DNA plan not found.",
  );
}

async function probeAudioInfo(mediaPath: string): Promise<AudioV01Info> {
  const json = await runFfprobe([
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name,sample_rate,channels,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    mediaPath,
  ]);
  const parsed = JSON.parse(json) as {
    streams?: Array<{
      codec_name?: string;
      sample_rate?: string;
      channels?: number;
      duration?: string;
    }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  if (!stream) {
    return {
      hasAudio: false,
      durationSec: 0,
      sampleRate: 0,
      channels: 0,
      codec: "none",
    };
  }
  return {
    hasAudio: true,
    durationSec:
      Number.parseFloat(stream.duration ?? parsed.format?.duration ?? "0") || 0,
    sampleRate: Number.parseInt(stream.sample_rate ?? "0", 10) || 0,
    channels: stream.channels ?? 0,
    codec: stream.codec_name ?? "unknown",
  };
}

function emptyAudioPlan(
  audioInfo: AudioV01Info,
  note: string,
): AudioV01SealPlan {
  return {
    enabled: true,
    module: "audio",
    layerId: AUDIO_V01_LAYER_ID,
    version: "audio-v0.1",
    hasAudio: audioInfo.hasAudio,
    active: false,
    audioInfo,
    traces: [],
    traceCount: 0,
    independentSealCount: 0,
    sealIndependent: false,
    sealOverlaps: false,
    canOpenAudioVault: true,
    changesVideoChannelAB: false,
    changesVisualModule: false,
    createsChannelC: false,
    note,
  };
}

function emptyAudioDecode(
  plan: AudioV01SealPlan,
  wallMs: number,
): AudioV01DecodeTelemetry {
  return {
    enabled: true,
    attempted: false,
    module: "audio",
    layerId: AUDIO_V01_LAYER_ID,
    audioInfo: plan.audioInfo,
    traces: [],
    idMatched: false,
    matchingBitsMax: 0,
    matchedTraceIds: [],
    traceCount: plan.traces.length,
    verdict: "AUDIO_NONE",
    canOpenAudioVault: false,
    officialDecisionRole: "AUDIO_VAULT requires exact ID match",
    note: plan.note,
    wallMs,
  };
}

async function muxOriginalAudio(input: {
  sourceMediaPath: string;
  videoOnlyPath: string;
  outputPath: string;
}) {
  await runFfmpeg([
    "-i",
    input.videoOnlyPath,
    "-i",
    input.sourceMediaPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    input.outputPath,
  ], 120_000);
}

function stampTrace(
  samples: Int16Array,
  bits: number[],
  trace: AudioV01TracePlan,
) {
  const bitSamples = Math.max(1, Math.round(trace.bitDurationSec * trace.sampleRate));
  const startSample = Math.max(0, Math.round(trace.startSec * trace.sampleRate));
  for (let bit = 0; bit < AUDIO_BITS; bit++) {
    const freq = bits[bit] === 1 ? trace.freqOneHz : trace.freqZeroHz;
    const base = startSample + bit * bitSamples;
    for (let i = 0; i < bitSamples && base + i < samples.length; i++) {
      const phase = (2 * Math.PI * freq * i) / trace.sampleRate;
      const fade = raisedCosine(i, bitSamples);
      const next = (samples[base + i] ?? 0) + Math.sin(phase) * trace.amplitude * fade;
      samples[base + i] = clamp16(Math.round(next));
    }
  }
}

function decodeTrace(
  samples: Int16Array,
  expectedPayloadHex: string,
  expectedBits: number[],
  trace: AudioV01TracePlan,
): AudioV01TraceDecodeTelemetry {
  const bitSamples = Math.max(1, Math.round(trace.bitDurationSec * trace.sampleRate));
  const startSample = Math.max(0, Math.round(trace.startSec * trace.sampleRate));
  const bits: number[] = [];
  let unknownBits = 0;
  let marginSum = 0;
  for (let bit = 0; bit < AUDIO_BITS; bit++) {
    const base = startSample + bit * bitSamples;
    const e0 = goertzelEnergy(samples, base, bitSamples, trace.sampleRate, trace.freqZeroHz);
    const e1 = goertzelEnergy(samples, base, bitSamples, trace.sampleRate, trace.freqOneHz);
    bits.push(e1 > e0 ? 1 : 0);
    const high = Math.max(e0, e1);
    const low = Math.max(1e-9, Math.min(e0, e1));
    const marginDb = 10 * Math.log10(high / low);
    marginSum += marginDb;
    if (marginDb < 0.25) unknownBits++;
  }
  const candidatePayloadHex = bitsToHex(bits);
  let matchingBits = 0;
  for (let i = 0; i < AUDIO_BITS; i++) {
    if (bits[i] === expectedBits[i]) matchingBits++;
  }
  const idMatched =
    matchingBits === AUDIO_BITS &&
    unknownBits === 0 &&
    candidatePayloadHex === expectedPayloadHex;
  const verdict: AudioV01Verdict = idMatched
    ? "AUDIO_ID_MATCH"
    : matchingBits >= 24
      ? "AUDIO_CANDIDATE"
      : "AUDIO_NONE";
  return {
    ...trace,
    attempted: true,
    expectedPayloadHex,
    candidatePayloadHex,
    matchingBits,
    unknownBits,
    idMatched,
    verdict,
    avgMarginDb: marginSum / AUDIO_BITS,
  };
}

function goertzelEnergy(
  samples: Int16Array,
  start: number,
  length: number,
  sampleRate: number,
  freq: number,
): number {
  const w = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < length; i++) {
    const idx = start + i;
    if (idx >= samples.length) break;
    const window = raisedCosine(i, length);
    s0 = ((samples[idx] ?? 0) / 32768) * window + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

function raisedCosine(i: number, n: number): number {
  if (n <= 1) return 1;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
}

function readS16le(rawPath: string): Int16Array {
  const buf = fs.readFileSync(rawPath);
  return new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function writeS16le(rawPath: string, samples: Int16Array) {
  fs.writeFileSync(rawPath, Buffer.from(samples.buffer));
}

function payloadToBits(payload4: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = payload4[i] ?? 0;
    for (let bit = 7; bit >= 0; bit--) bits.push((byte >>> bit) & 1);
  }
  return bits;
}

function bitsToHex(bits: ReadonlyArray<number>): string {
  const buf = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] ?? 0);
    buf[i] = byte;
  }
  return buf.toString("hex");
}

function clamp16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}

function isAudioPlan(value: unknown): value is AudioV01SealPlan {
  const rec = asRecord(value);
  return rec["module"] === "audio" && rec["layerId"] === AUDIO_V01_LAYER_ID;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function runFfprobe(args: string[]): Promise<string> {
  return runCapture("ffprobe", args, 30_000);
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<string> {
  return runCapture("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], timeoutMs);
}

function runCapture(
  bin: MediaRuntimeTool,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  assertLegacyFfmpegLabAllowed(`audio_module_${bin}`);
  return new Promise((resolve, reject) => {
    const p = spawn(resolveMediaRuntimePath(bin), args, {
      windowsHide: true,
      env: approvedMediaRuntimeChildEnvironment(),
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${bin} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error(`${bin} exit ${code}: ${err}`));
    });
    p.on("error", (errObj) => {
      clearTimeout(t);
      reject(errObj);
    });
  });
}
