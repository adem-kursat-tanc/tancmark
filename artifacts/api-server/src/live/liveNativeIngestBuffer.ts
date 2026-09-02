import { createHash } from "node:crypto";

export const LIVE_NATIVE_INGEST_BUFFER_VERSION =
  "live-native-ingest-buffer-v0.1" as const;

export const LIVE_NATIVE_INGEST_BUFFER_DECISION_ROLE =
  "live_native_ingest_buffer_support_only_no_vault_no_confirmed" as const;

export interface LiveNativeIngestChunkInput {
  payload: Uint8Array;
  durationSeconds: number;
  receivedAtMs?: number;
}

export interface LiveNativeIngestBufferInput {
  sessionId: string;
  targetSegmentDurationSeconds?: number;
  startSequence?: number;
  chunks: LiveNativeIngestChunkInput[];
}

export interface LiveNativeBufferedSegment {
  sequence: number;
  durationSeconds: number;
  payload: Uint8Array;
  chunkCount: number;
  firstReceivedAtMs: number | null;
  lastReceivedAtMs: number | null;
  inputSha256Chain: string[];
  payloadSha256: string;
  ffmpegUsed: false;
  dirtyFfmpegUsed: false;
  reencoded: false;
  transcoded: false;
}

export interface LiveNativeIngestBufferResult {
  version: typeof LIVE_NATIVE_INGEST_BUFFER_VERSION;
  decisionRole: typeof LIVE_NATIVE_INGEST_BUFFER_DECISION_ROLE;
  ok: boolean;
  reason: string;
  sessionId: string | null;
  targetSegmentDurationSeconds: number;
  startSequence: number;
  inputChunkCount: number;
  bufferedSegmentCount: number;
  bufferedSegments: LiveNativeBufferedSegment[];
  allInputBytesPreservedInOrder: boolean;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  encodesVideo: false;
  transcodesVideo: false;
  reencodesAudio: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
}

export interface LiveNativeIngestBufferPolicy {
  version: typeof LIVE_NATIVE_INGEST_BUFFER_VERSION;
  decisionRole: typeof LIVE_NATIVE_INGEST_BUFFER_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "buffer_ready_live_payload_chunks_for_native_segment_writer";
  acceptsReadyPayloadChunksOnly: true;
  networkPullEnabled: false;
  networkPushEnabled: false;
  encodesVideo: false;
  transcodesVideo: false;
  reencodesAudio: false;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  preservesInputByteOrder: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const MAX_CHUNKS = 50_000;
const MAX_CHUNK_BYTES = 128 * 1024 * 1024;
const DEFAULT_SEGMENT_DURATION_SECONDS = 6;
const MAX_SEGMENT_DURATION_SECONDS = 60;

function safetyEnvelope() {
  return {
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
  } as const;
}

function reject(reason: string, targetSegmentDurationSeconds = DEFAULT_SEGMENT_DURATION_SECONDS): LiveNativeIngestBufferResult {
  return {
    version: LIVE_NATIVE_INGEST_BUFFER_VERSION,
    decisionRole: LIVE_NATIVE_INGEST_BUFFER_DECISION_ROLE,
    ok: false,
    reason,
    sessionId: null,
    targetSegmentDurationSeconds,
    startSequence: 0,
    inputChunkCount: 0,
    bufferedSegmentCount: 0,
    bufferedSegments: [],
    allInputBytesPreservedInOrder: false,
    ...safetyEnvelope(),
  };
}

function safeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return safe.length > 0 ? safe : null;
}

function safeDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, MAX_SEGMENT_DURATION_SECONDS);
}

function safeTargetDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_SEGMENT_DURATION_SECONDS;
  }
  return Math.min(Math.ceil(value), MAX_SEGMENT_DURATION_SECONDS);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function concatPayloads(chunks: readonly Uint8Array[]): Uint8Array {
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export function buildLiveNativeIngestBuffer(
  input: LiveNativeIngestBufferInput,
): LiveNativeIngestBufferResult {
  const sessionId = safeId(input.sessionId);
  const targetSegmentDurationSeconds = safeTargetDuration(input.targetSegmentDurationSeconds);
  const startSequence =
    typeof input.startSequence === "number" && Number.isFinite(input.startSequence) && input.startSequence >= 0
      ? Math.floor(input.startSequence)
      : 0;

  if (!sessionId) return reject("session_id_invalid", targetSegmentDurationSeconds);
  if (!Array.isArray(input.chunks) || input.chunks.length === 0) {
    return reject("chunks_missing", targetSegmentDurationSeconds);
  }
  if (input.chunks.length > MAX_CHUNKS) return reject("too_many_chunks", targetSegmentDurationSeconds);

  const bufferedSegments: LiveNativeBufferedSegment[] = [];
  let currentPayloads: Uint8Array[] = [];
  let currentHashes: string[] = [];
  let currentDuration = 0;
  let firstReceivedAtMs: number | null = null;
  let lastReceivedAtMs: number | null = null;
  let sequence = startSequence;
  const originalHashes: string[] = [];

  const flush = () => {
    if (currentPayloads.length === 0) return;
    const payload = concatPayloads(currentPayloads);
    bufferedSegments.push({
      sequence,
      durationSeconds: currentDuration,
      payload,
      chunkCount: currentPayloads.length,
      firstReceivedAtMs,
      lastReceivedAtMs,
      inputSha256Chain: currentHashes,
      payloadSha256: sha256(payload),
      ffmpegUsed: false,
      dirtyFfmpegUsed: false,
      reencoded: false,
      transcoded: false,
    });
    sequence += 1;
    currentPayloads = [];
    currentHashes = [];
    currentDuration = 0;
    firstReceivedAtMs = null;
    lastReceivedAtMs = null;
  };

  for (let i = 0; i < input.chunks.length; i++) {
    const chunk = input.chunks[i];
    if (!chunk || !(chunk.payload instanceof Uint8Array)) {
      return reject(`chunk_${i}_payload_invalid`, targetSegmentDurationSeconds);
    }
    if (chunk.payload.byteLength === 0) return reject(`chunk_${i}_payload_empty`, targetSegmentDurationSeconds);
    if (chunk.payload.byteLength > MAX_CHUNK_BYTES) {
      return reject(`chunk_${i}_payload_too_large`, targetSegmentDurationSeconds);
    }
    const durationSeconds = safeDuration(chunk.durationSeconds);
    if (durationSeconds === null) return reject(`chunk_${i}_duration_invalid`, targetSegmentDurationSeconds);

    const chunkHash = sha256(chunk.payload);
    originalHashes.push(chunkHash);
    currentPayloads.push(chunk.payload);
    currentHashes.push(chunkHash);
    currentDuration += durationSeconds;

    if (typeof chunk.receivedAtMs === "number" && Number.isFinite(chunk.receivedAtMs)) {
      firstReceivedAtMs = firstReceivedAtMs ?? chunk.receivedAtMs;
      lastReceivedAtMs = chunk.receivedAtMs;
    }

    if (currentDuration >= targetSegmentDurationSeconds) flush();
  }

  flush();

  const rebuiltHashes = bufferedSegments.flatMap((segment) => segment.inputSha256Chain);
  const allInputBytesPreservedInOrder =
    originalHashes.length === rebuiltHashes.length &&
    originalHashes.every((hash, index) => hash === rebuiltHashes[index]);

  return {
    version: LIVE_NATIVE_INGEST_BUFFER_VERSION,
    decisionRole: LIVE_NATIVE_INGEST_BUFFER_DECISION_ROLE,
    ok: allInputBytesPreservedInOrder,
    reason: allInputBytesPreservedInOrder ? "native_ingest_buffer_ready" : "input_order_hash_mismatch",
    sessionId,
    targetSegmentDurationSeconds,
    startSequence,
    inputChunkCount: input.chunks.length,
    bufferedSegmentCount: bufferedSegments.length,
    bufferedSegments,
    allInputBytesPreservedInOrder,
    ...safetyEnvelope(),
  };
}

export function getLiveNativeIngestBufferPolicy(): LiveNativeIngestBufferPolicy {
  return {
    version: LIVE_NATIVE_INGEST_BUFFER_VERSION,
    decisionRole: LIVE_NATIVE_INGEST_BUFFER_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "buffer_ready_live_payload_chunks_for_native_segment_writer",
    acceptsReadyPayloadChunksOnly: true,
    networkPullEnabled: false,
    networkPushEnabled: false,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    preservesInputByteOrder: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
