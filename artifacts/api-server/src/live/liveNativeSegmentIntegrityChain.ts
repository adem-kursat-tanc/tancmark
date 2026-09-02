import { createHash } from "node:crypto";

export const LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION =
  "live-native-segment-integrity-chain-v0.1" as const;

export const LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_DECISION_ROLE =
  "live_native_segment_integrity_chain_support_only_no_vault_no_confirmed" as const;

export interface LiveNativeSegmentIntegrityInput {
  recordingId: string;
  expectedStartSequence?: number;
  segments: LiveNativeSegmentIntegritySegmentInput[];
}

export interface LiveNativeSegmentIntegritySegmentInput {
  sequence: number;
  uri: string;
  durationSeconds: number;
  bytesWritten: number;
  inputSha256: string;
  writtenSha256: string;
  payloadUnchanged?: boolean;
}

export interface LiveNativeSegmentIntegrityEntry {
  index: number;
  sequence: number;
  uri: string;
  durationSeconds: number;
  bytesWritten: number;
  inputSha256: string;
  writtenSha256: string;
  payloadUnchanged: boolean;
  previousEntryHash: string;
  entryHash: string;
}

export interface LiveNativeSegmentIntegrityChain {
  version: typeof LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION;
  decisionRole: typeof LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_DECISION_ROLE;
  recordingId: string;
  segmentCount: number;
  startSequence: number;
  endSequence: number;
  entries: LiveNativeSegmentIntegrityEntry[];
  chainRoot: string;
  allPayloadsUnchanged: boolean;
  contiguousSequences: boolean;
  duplicateSequenceDetected: false;
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

export type LiveNativeSegmentIntegrityResult =
  | {
      ok: true;
      reason: "native_segment_integrity_chain_ready";
      chain: LiveNativeSegmentIntegrityChain;
    }
  | {
      ok: false;
      reason: string;
      chain: null;
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
    };

export interface LiveNativeSegmentIntegrityPolicy {
  version: typeof LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION;
  decisionRole: typeof LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "hash_chain_written_native_hls_vod_segments";
  verifiesWrittenSegmentHashes: true;
  requiresContiguousSequence: true;
  detectsDuplicateSequence: true;
  modifiesMediaPayload: false;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const MAX_SEGMENTS = 10_000;
const ZERO_HASH = "0".repeat(64);
const SHA256_RE = /^[a-f0-9]{64}$/i;

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

function reject(reason: string): LiveNativeSegmentIntegrityResult {
  return { ok: false, reason, chain: null, ...safetyEnvelope() };
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return safe.length > 0 ? safe : null;
}

function safeUri(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(trimmed)) return null;
  if (trimmed.includes("..")) return null;
  return trimmed;
}

function isValidHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function isSafeSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 999_999_999;
}

function isSafePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isSafeBytes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function canonicalEntryPayload(input: Omit<LiveNativeSegmentIntegrityEntry, "entryHash">): string {
  return JSON.stringify({
    version: LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION,
    index: input.index,
    sequence: input.sequence,
    uri: input.uri,
    durationSeconds: Number(input.durationSeconds.toFixed(6)),
    bytesWritten: input.bytesWritten,
    inputSha256: input.inputSha256.toLowerCase(),
    writtenSha256: input.writtenSha256.toLowerCase(),
    payloadUnchanged: input.payloadUnchanged,
    previousEntryHash: input.previousEntryHash,
  });
}

export function buildLiveNativeSegmentIntegrityChain(
  input: LiveNativeSegmentIntegrityInput,
): LiveNativeSegmentIntegrityResult {
  const recordingId = safeId(input.recordingId);
  if (!recordingId) return reject("recording_id_invalid");
  if (!Array.isArray(input.segments) || input.segments.length === 0) return reject("segments_missing");
  if (input.segments.length > MAX_SEGMENTS) return reject("too_many_segments");

  const expectedStartSequence =
    input.expectedStartSequence === undefined
      ? undefined
      : isSafeSequence(input.expectedStartSequence)
        ? input.expectedStartSequence
        : null;
  if (expectedStartSequence === null) return reject("expected_start_sequence_invalid");

  const seen = new Set<number>();
  const normalized = [];

  for (let index = 0; index < input.segments.length; index++) {
    const segment = input.segments[index];
    if (!segment || !isSafeSequence(segment.sequence)) return reject(`segment_${index}_sequence_invalid`);
    if (seen.has(segment.sequence)) return reject(`segment_${index}_duplicate_sequence`);
    seen.add(segment.sequence);

    const uri = safeUri(segment.uri);
    if (!uri) return reject(`segment_${index}_uri_invalid`);
    if (!isSafePositiveNumber(segment.durationSeconds)) return reject(`segment_${index}_duration_invalid`);
    if (!isSafeBytes(segment.bytesWritten)) return reject(`segment_${index}_bytes_invalid`);
    if (!isValidHash(segment.inputSha256)) return reject(`segment_${index}_input_hash_invalid`);
    if (!isValidHash(segment.writtenSha256)) return reject(`segment_${index}_written_hash_invalid`);
    if (segment.payloadUnchanged === false || segment.inputSha256.toLowerCase() !== segment.writtenSha256.toLowerCase()) {
      return reject(`segment_${index}_payload_hash_mismatch`);
    }

    normalized.push({
      sequence: segment.sequence,
      uri,
      durationSeconds: segment.durationSeconds,
      bytesWritten: segment.bytesWritten,
      inputSha256: segment.inputSha256.toLowerCase(),
      writtenSha256: segment.writtenSha256.toLowerCase(),
      payloadUnchanged: true,
    });
  }

  normalized.sort((left, right) => left.sequence - right.sequence);
  const startSequence = expectedStartSequence ?? normalized[0].sequence;
  for (let index = 0; index < normalized.length; index++) {
    const expectedSequence = startSequence + index;
    if (normalized[index].sequence !== expectedSequence) {
      return reject(`segment_${index}_sequence_gap`);
    }
  }

  let previousEntryHash = ZERO_HASH;
  const entries: LiveNativeSegmentIntegrityEntry[] = normalized.map((segment, index) => {
    const entryWithoutHash = {
      index,
      sequence: segment.sequence,
      uri: segment.uri,
      durationSeconds: segment.durationSeconds,
      bytesWritten: segment.bytesWritten,
      inputSha256: segment.inputSha256,
      writtenSha256: segment.writtenSha256,
      payloadUnchanged: true,
      previousEntryHash,
    };
    const entryHash = sha256Text(canonicalEntryPayload(entryWithoutHash));
    previousEntryHash = entryHash;
    return { ...entryWithoutHash, entryHash };
  });

  const chain: LiveNativeSegmentIntegrityChain = {
    version: LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION,
    decisionRole: LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_DECISION_ROLE,
    recordingId,
    segmentCount: entries.length,
    startSequence,
    endSequence: entries[entries.length - 1].sequence,
    entries,
    chainRoot: entries[entries.length - 1].entryHash,
    allPayloadsUnchanged: true,
    contiguousSequences: true,
    duplicateSequenceDetected: false,
    ...safetyEnvelope(),
  };

  return { ok: true, reason: "native_segment_integrity_chain_ready", chain };
}

export function verifyLiveNativeSegmentIntegrityChain(
  chain: LiveNativeSegmentIntegrityChain,
): boolean {
  if (!chain || chain.version !== LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION) return false;
  if (chain.entries.length !== chain.segmentCount || chain.segmentCount === 0) return false;
  if (chain.canOpenVault !== false || chain.confirmed !== false || chain.final !== false) return false;

  let previousEntryHash = ZERO_HASH;
  for (let index = 0; index < chain.entries.length; index++) {
    const entry = chain.entries[index];
    if (entry.index !== index) return false;
    if (entry.previousEntryHash !== previousEntryHash) return false;
    if (entry.inputSha256.toLowerCase() !== entry.writtenSha256.toLowerCase()) return false;
    if (entry.payloadUnchanged !== true) return false;
    const expectedHash = sha256Text(
      canonicalEntryPayload({
        index: entry.index,
        sequence: entry.sequence,
        uri: entry.uri,
        durationSeconds: entry.durationSeconds,
        bytesWritten: entry.bytesWritten,
        inputSha256: entry.inputSha256,
        writtenSha256: entry.writtenSha256,
        payloadUnchanged: entry.payloadUnchanged,
        previousEntryHash: entry.previousEntryHash,
      }),
    );
    if (entry.entryHash !== expectedHash) return false;
    previousEntryHash = entry.entryHash;
  }

  return chain.chainRoot === previousEntryHash;
}

export function getLiveNativeSegmentIntegrityPolicy(): LiveNativeSegmentIntegrityPolicy {
  return {
    version: LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_VERSION,
    decisionRole: LIVE_NATIVE_SEGMENT_INTEGRITY_CHAIN_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "hash_chain_written_native_hls_vod_segments",
    verifiesWrittenSegmentHashes: true,
    requiresContiguousSequence: true,
    detectsDuplicateSequence: true,
    modifiesMediaPayload: false,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
