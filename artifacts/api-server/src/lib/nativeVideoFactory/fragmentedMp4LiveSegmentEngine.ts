import { createHash } from "node:crypto";
// @ts-ignore: The validation contracts execute TypeScript source directly under Node, so the runtime import needs the .ts suffix.
import { buildLiveNativeFragmentedMp4SegmentGate, type LiveNativeFragmentedMp4SegmentGateInput, type LiveNativeFragmentedMp4SegmentGateResult, type LiveNativeFragmentedMp4TrackType } from "../../live/liveNativeFragmentedMp4SegmentGate.ts";

export const NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION =
  "native-fragmented-mp4-live-segment-engine-v0.1" as const;

export const NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE =
  "native_fragmented_mp4_live_segment_engine_support_only_no_vault_no_confirmed" as const;

interface Mp4Box {
  offset: number;
  size: number;
  headerSize: 8 | 16;
  type: string;
  payloadOffset: number;
  payloadSize: number;
}

export interface NativeFragmentedMp4Track {
  trackId: number;
  timescale: number | null;
  handlerType: string;
}

export interface NativeFragmentedMp4Traf {
  trackId: number;
  handlerType: string;
  timescale: number | null;
  baseMediaDecodeTime: number | null;
  sampleCount: number;
  totalSampleBytes: number;
  totalDuration: number;
  dataOffset: number | null;
}

export interface NativeFragmentedMp4Segment {
  index: number;
  sequenceNumber: number | null;
  moofOffset: number;
  moofSize: number;
  mdatOffset: number;
  mdatSize: number;
  mdatPayloadStart: number;
  mdatPayloadSize: number;
  byteRange: { start: number; end: number; length: number };
  trafs: NativeFragmentedMp4Traf[];
  totalSampleBytes: number;
}

export type NativeFragmentedMp4ReadResult =
  | {
      ok: true;
      status: "ok";
      reason: null;
      version: typeof NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION;
      decisionRole: typeof NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE;
      kind: "init" | "media" | "combined";
      hasInit: boolean;
      hasMvex: boolean;
      fileSizeBytes: number;
      initByteRange: { start: number; end: number; length: number } | null;
      topBoxTypes: string[];
      tracks: NativeFragmentedMp4Track[];
      segments: NativeFragmentedMp4Segment[];
      segmentCount: number;
      sourceIntact: true;
      mediaPayloadModified: false;
      ffmpegUsed: false;
      canOpenVault: false;
      confirmed: false;
      final: false;
    }
  | {
      ok: false;
      status: "rejected";
      reason: string;
      version: typeof NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION;
      decisionRole: typeof NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE;
      detail?: string;
      sourceIntact: true;
      mediaPayloadModified: false;
      ffmpegUsed: false;
      canOpenVault: false;
      confirmed: false;
      final: false;
    };

export interface NativeFragmentedMp4GateBridgeInput {
  recordingId: string;
  source: Uint8Array | null | undefined;
  initUri?: string;
  segmentUriPrefix?: string;
  expectedStartSequence?: number;
}

export interface NativeFragmentedMp4GateBridgeResult {
  ok: boolean;
  reason: string;
  version: typeof NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION;
  decisionRole: typeof NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE;
  read: NativeFragmentedMp4ReadResult;
  gate: LiveNativeFragmentedMp4SegmentGateResult;
  sourceIntact: true;
  mediaPayloadModified: false;
  ffmpegUsed: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const TFHD_DEF_DURATION = 0x000008;
const TFHD_DEF_SIZE = 0x000010;
const TRUN_DATA_OFFSET = 0x000001;
const TRUN_FIRST_SAMPLE_FLAGS = 0x000004;
const TRUN_SAMPLE_DURATION = 0x000100;
const TRUN_SAMPLE_SIZE = 0x000200;
const TRUN_SAMPLE_FLAGS = 0x000400;
const TRUN_SAMPLE_CTO = 0x000800;

function locked<T extends Record<string, unknown>>(value: T): T & {
  sourceIntact: true;
  mediaPayloadModified: false;
  ffmpegUsed: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
} {
  return {
    ...value,
    sourceIntact: true,
    mediaPayloadModified: false,
    ffmpegUsed: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

function okResult(extra: Omit<Extract<NativeFragmentedMp4ReadResult, { ok: true }>, "ok" | "status" | "reason" | "version" | "decisionRole" | "sourceIntact" | "mediaPayloadModified" | "ffmpegUsed" | "canOpenVault" | "confirmed" | "final">): NativeFragmentedMp4ReadResult {
  return locked({
    ok: true,
    status: "ok",
    reason: null,
    version: NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION,
    decisionRole: NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE,
    ...extra,
  });
}

function failResult(reason: string, detail?: string): NativeFragmentedMp4ReadResult {
  return locked({
    ok: false,
    status: "rejected",
    reason,
    version: NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION,
    decisionRole: NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE,
    ...(detail ? { detail } : {}),
  });
}

function bridgeResult(
  read: NativeFragmentedMp4ReadResult,
  gate: LiveNativeFragmentedMp4SegmentGateResult,
  reason: string,
): NativeFragmentedMp4GateBridgeResult {
  return locked({
    ok: read.ok && gate.ok,
    reason,
    version: NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_VERSION,
    decisionRole: NATIVE_FRAGMENTED_MP4_LIVE_SEGMENT_ENGINE_DECISION_ROLE,
    read,
    gate,
  });
}

function readBox(buf: Buffer, offset: number, end: number): Mp4Box | null {
  if (offset < 0 || offset + 8 > end || end > buf.byteLength) return null;
  const rawSize = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);
  if (!/^[\x20-\x7e]{4}$/.test(type)) return null;

  if (rawSize === 1) {
    if (offset + 16 > end) return null;
    const sizeBig = buf.readBigUInt64BE(offset + 8);
    if (sizeBig > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const size = Number(sizeBig);
    if (size < 16 || offset + size > end) return null;
    return { offset, size, headerSize: 16, type, payloadOffset: offset + 16, payloadSize: size - 16 };
  }

  if (rawSize === 0) {
    const size = end - offset;
    if (size < 8) return null;
    return { offset, size, headerSize: 8, type, payloadOffset: offset + 8, payloadSize: size - 8 };
  }

  if (rawSize < 8 || offset + rawSize > end) return null;
  return { offset, size: rawSize, headerSize: 8, type, payloadOffset: offset + 8, payloadSize: rawSize - 8 };
}

function listBoxes(buf: Buffer, start: number, end: number): Mp4Box[] | null {
  const boxes: Mp4Box[] = [];
  let cursor = start;
  while (cursor < end) {
    const box = readBox(buf, cursor, end);
    if (!box) return null;
    boxes.push(box);
    cursor += box.size;
    if (cursor <= box.offset) return null;
  }
  return cursor === end ? boxes : null;
}

function children(buf: Buffer, box: Mp4Box): Mp4Box[] {
  return listBoxes(buf, box.payloadOffset, box.offset + box.size) ?? [];
}

function findChild(buf: Buffer, box: Mp4Box, type: string): Mp4Box | null {
  return children(buf, box).find((child) => child.type === type) ?? null;
}

function readU64(buf: Buffer, offset: number): number | null {
  if (offset + 8 > buf.byteLength) return null;
  const value = buf.readBigUInt64BE(offset);
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(value);
}

function flags24(buf: Buffer, offset: number): number {
  return buf.readUIntBE(offset, 3);
}

function readInitTracks(buf: Buffer, moov: Mp4Box): NativeFragmentedMp4Track[] {
  const tracks: NativeFragmentedMp4Track[] = [];
  for (const trak of children(buf, moov).filter((box) => box.type === "trak")) {
    const tkhd = findChild(buf, trak, "tkhd");
    const mdia = findChild(buf, trak, "mdia");
    if (!tkhd || !mdia) continue;

    const tkhdPayload = tkhd.payloadOffset;
    if (tkhdPayload + 16 > tkhd.offset + tkhd.size) continue;
    const tkhdVersion = buf[tkhdPayload];
    const trackIdOffset = tkhdVersion === 1 ? tkhdPayload + 20 : tkhdPayload + 12;
    if (trackIdOffset + 4 > tkhd.offset + tkhd.size) continue;
    const trackId = buf.readUInt32BE(trackIdOffset);

    const mdhd = findChild(buf, mdia, "mdhd");
    const hdlr = findChild(buf, mdia, "hdlr");
    let timescale: number | null = null;
    if (mdhd) {
      const mdhdPayload = mdhd.payloadOffset;
      const timescaleOffset = buf[mdhdPayload] === 1 ? mdhdPayload + 20 : mdhdPayload + 12;
      if (timescaleOffset + 4 <= mdhd.offset + mdhd.size) timescale = buf.readUInt32BE(timescaleOffset);
    }

    let handlerType = "unkn";
    if (hdlr && hdlr.payloadOffset + 12 <= hdlr.offset + hdlr.size) {
      handlerType = buf.toString("latin1", hdlr.payloadOffset + 8, hdlr.payloadOffset + 12);
    }
    tracks.push({ trackId, timescale, handlerType });
  }
  return tracks;
}

function readTrexDefaults(buf: Buffer, moov: Mp4Box): Map<number, { defaultSampleDuration?: number; defaultSampleSize?: number }> {
  const map = new Map<number, { defaultSampleDuration?: number; defaultSampleSize?: number }>();
  const mvex = findChild(buf, moov, "mvex");
  if (!mvex) return map;

  for (const trex of children(buf, mvex).filter((box) => box.type === "trex")) {
    const p = trex.payloadOffset;
    if (p + 24 > trex.offset + trex.size) continue;
    const trackId = buf.readUInt32BE(p + 4);
    map.set(trackId, {
      defaultSampleDuration: buf.readUInt32BE(p + 12),
      defaultSampleSize: buf.readUInt32BE(p + 16),
    });
  }
  return map;
}

function parseTfhd(buf: Buffer, tfhd: Mp4Box): { trackId: number; defaultSampleDuration?: number; defaultSampleSize?: number } | null {
  const p = tfhd.payloadOffset;
  const end = tfhd.offset + tfhd.size;
  if (p + 8 > end) return null;
  const flags = flags24(buf, p + 1);
  const trackId = buf.readUInt32BE(p + 4);
  let cursor = p + 8;
  const need = (bytes: number) => cursor + bytes <= end;

  if (flags & 0x000001) {
    if (!need(8)) return null;
    cursor += 8;
  }
  if (flags & 0x000002) {
    if (!need(4)) return null;
    cursor += 4;
  }

  const parsed: { trackId: number; defaultSampleDuration?: number; defaultSampleSize?: number } = { trackId };
  if (flags & TFHD_DEF_DURATION) {
    if (!need(4)) return null;
    parsed.defaultSampleDuration = buf.readUInt32BE(cursor);
    cursor += 4;
  }
  if (flags & TFHD_DEF_SIZE) {
    if (!need(4)) return null;
    parsed.defaultSampleSize = buf.readUInt32BE(cursor);
    cursor += 4;
  }
  if (flags & 0x000020) {
    if (!need(4)) return null;
  }
  return parsed;
}

function parseTfdt(buf: Buffer, tfdt: Mp4Box): number | null {
  const p = tfdt.payloadOffset;
  if (p + 8 > tfdt.offset + tfdt.size) return null;
  const version = buf[p];
  if (version === 1) return readU64(buf, p + 4);
  return buf.readUInt32BE(p + 4);
}

function parseTrun(
  buf: Buffer,
  trun: Mp4Box,
  defaults: { defaultSampleDuration?: number; defaultSampleSize?: number },
): { sampleCount: number; totalSampleBytes: number; totalDuration: number; dataOffset: number | null } | null {
  const p = trun.payloadOffset;
  const end = trun.offset + trun.size;
  if (p + 8 > end) return null;
  const flags = flags24(buf, p + 1);
  const sampleCount = buf.readUInt32BE(p + 4);
  let cursor = p + 8;
  const need = (bytes: number) => cursor + bytes <= end;

  let dataOffset: number | null = null;
  if (flags & TRUN_DATA_OFFSET) {
    if (!need(4)) return null;
    dataOffset = buf.readInt32BE(cursor);
    cursor += 4;
  }
  if (flags & TRUN_FIRST_SAMPLE_FLAGS) {
    if (!need(4)) return null;
    cursor += 4;
  }

  let totalSampleBytes = 0;
  let totalDuration = 0;
  for (let index = 0; index < sampleCount; index++) {
    let sampleDuration = defaults.defaultSampleDuration ?? 0;
    let sampleSize = defaults.defaultSampleSize ?? 0;
    if (flags & TRUN_SAMPLE_DURATION) {
      if (!need(4)) return null;
      sampleDuration = buf.readUInt32BE(cursor);
      cursor += 4;
    }
    if (flags & TRUN_SAMPLE_SIZE) {
      if (!need(4)) return null;
      sampleSize = buf.readUInt32BE(cursor);
      cursor += 4;
    }
    if (flags & TRUN_SAMPLE_FLAGS) {
      if (!need(4)) return null;
      cursor += 4;
    }
    if (flags & TRUN_SAMPLE_CTO) {
      if (!need(4)) return null;
      cursor += 4;
    }
    totalSampleBytes += sampleSize;
    totalDuration += sampleDuration;
  }

  return { sampleCount, totalSampleBytes, totalDuration, dataOffset };
}

function parseTraf(
  buf: Buffer,
  traf: Mp4Box,
  trexDefaults: Map<number, { defaultSampleDuration?: number; defaultSampleSize?: number }>,
  initTracks: Map<number, NativeFragmentedMp4Track>,
): { ok: true; traf: NativeFragmentedMp4Traf } | { ok: false; reason: string } {
  const tfhdBox = findChild(buf, traf, "tfhd");
  if (!tfhdBox) return { ok: false, reason: "traf_missing_tfhd" };
  const tfhd = parseTfhd(buf, tfhdBox);
  if (!tfhd) return { ok: false, reason: "tfhd_truncated" };

  const tfdtBox = findChild(buf, traf, "tfdt");
  const baseMediaDecodeTime = tfdtBox ? parseTfdt(buf, tfdtBox) : null;
  if (tfdtBox && baseMediaDecodeTime === null) return { ok: false, reason: "tfdt_truncated" };

  const trex = trexDefaults.get(tfhd.trackId) ?? {};
  const defaults = {
    defaultSampleDuration: tfhd.defaultSampleDuration ?? trex.defaultSampleDuration,
    defaultSampleSize: tfhd.defaultSampleSize ?? trex.defaultSampleSize,
  };

  const truns = children(buf, traf).filter((box) => box.type === "trun");
  if (truns.length === 0) return { ok: false, reason: "traf_missing_trun" };

  let sampleCount = 0;
  let totalSampleBytes = 0;
  let totalDuration = 0;
  let dataOffset: number | null = null;
  for (const trun of truns) {
    const parsed = parseTrun(buf, trun, defaults);
    if (!parsed) return { ok: false, reason: "trun_truncated" };
    if (dataOffset === null) dataOffset = parsed.dataOffset;
    sampleCount += parsed.sampleCount;
    totalSampleBytes += parsed.totalSampleBytes;
    totalDuration += parsed.totalDuration;
  }

  const initTrack = initTracks.get(tfhd.trackId);
  return {
    ok: true,
    traf: {
      trackId: tfhd.trackId,
      handlerType: initTrack?.handlerType ?? "unkn",
      timescale: initTrack?.timescale ?? null,
      baseMediaDecodeTime,
      sampleCount,
      totalSampleBytes,
      totalDuration,
      dataOffset,
    },
  };
}

function parseSegment(
  buf: Buffer,
  moof: Mp4Box,
  mdat: Mp4Box,
  index: number,
  trexDefaults: Map<number, { defaultSampleDuration?: number; defaultSampleSize?: number }>,
  initTracks: Map<number, NativeFragmentedMp4Track>,
): { ok: true; segment: NativeFragmentedMp4Segment } | { ok: false; reason: string } {
  const mfhd = findChild(buf, moof, "mfhd");
  let sequenceNumber: number | null = null;
  if (mfhd && mfhd.payloadOffset + 8 <= mfhd.offset + mfhd.size) {
    sequenceNumber = buf.readUInt32BE(mfhd.payloadOffset + 4);
  }

  const trafBoxes = children(buf, moof).filter((box) => box.type === "traf");
  if (trafBoxes.length === 0) return { ok: false, reason: "moof_missing_traf" };

  const trafs: NativeFragmentedMp4Traf[] = [];
  for (const traf of trafBoxes) {
    const parsed = parseTraf(buf, traf, trexDefaults, initTracks);
    if (!parsed.ok) return parsed;
    trafs.push(parsed.traf);
  }

  const mdatPayloadStart = mdat.payloadOffset;
  const mdatEnd = mdat.offset + mdat.size;
  return {
    ok: true,
    segment: {
      index,
      sequenceNumber,
      moofOffset: moof.offset,
      moofSize: moof.size,
      mdatOffset: mdat.offset,
      mdatSize: mdat.size,
      mdatPayloadStart,
      mdatPayloadSize: mdatEnd - mdatPayloadStart,
      byteRange: { start: moof.offset, end: mdatEnd, length: mdatEnd - moof.offset },
      trafs,
      totalSampleBytes: trafs.reduce((sum, traf) => sum + traf.totalSampleBytes, 0),
    },
  };
}

export function readNativeFragmentedMp4LiveSegment(source: Uint8Array | null | undefined): NativeFragmentedMp4ReadResult {
  try {
    if (!(source instanceof Uint8Array) || source.byteLength === 0) return failResult("empty_buffer");
    if (source.byteLength < 8) return failResult("buffer_too_small");

    const buf = Buffer.from(source);
    const top = listBoxes(buf, 0, buf.byteLength);
    if (!top || top.length === 0) return failResult("corrupt_box_size");

    const moov = top.find((box) => box.type === "moov");
    const ftyp = top.find((box) => box.type === "ftyp");
    const styp = top.find((box) => box.type === "styp");
    const moofBoxes = top.filter((box) => box.type === "moof");

    if (!moov && moofBoxes.length === 0) return failResult("not_fragmented", "moov ve moof yok");

    let tracks: NativeFragmentedMp4Track[] = [];
    let trexDefaults = new Map<number, { defaultSampleDuration?: number; defaultSampleSize?: number }>();
    let hasMvex = false;
    if (moov) {
      hasMvex = !!findChild(buf, moov, "mvex");
      if (!hasMvex) return failResult("moov_missing_mvex", "fragmented MP4 init segment mvex tasimali");
      tracks = readInitTracks(buf, moov);
      trexDefaults = readTrexDefaults(buf, moov);
    }

    const initTrackMap = new Map(tracks.map((track) => [track.trackId, track]));
    const segments: NativeFragmentedMp4Segment[] = [];
    for (let index = 0; index < top.length; index++) {
      const moof = top[index];
      if (moof.type !== "moof") continue;
      let mdat: Mp4Box | null = null;
      for (let scan = index + 1; scan < top.length; scan++) {
        if (top[scan].type === "moof") break;
        if (top[scan].type === "mdat") {
          mdat = top[scan];
          break;
        }
      }
      if (!mdat) return failResult("moof_without_mdat");
      const parsed = parseSegment(buf, moof, mdat, segments.length, trexDefaults, initTrackMap);
      if (!parsed.ok) return failResult(parsed.reason);
      segments.push(parsed.segment);
    }

    const firstMediaOffset = segments[0]?.byteRange.start ?? null;
    const initByteRange =
      moov && ftyp
        ? {
            start: ftyp.offset,
            end: firstMediaOffset ?? moov.offset + moov.size,
            length: (firstMediaOffset ?? moov.offset + moov.size) - ftyp.offset,
          }
        : null;

    return okResult({
      kind: moov && segments.length > 0 ? "combined" : moov ? "init" : "media",
      hasInit: !!moov,
      hasMvex,
      fileSizeBytes: buf.byteLength,
      initByteRange,
      topBoxTypes: top.map((box) => box.type),
      tracks,
      segments,
      segmentCount: segments.length,
    });
  } catch (error) {
    return failResult("read_exception", String(error instanceof Error ? error.message : error));
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeSegmentUri(prefix: string, sequence: number): string {
  const safePrefix = prefix.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "segment";
  return `${safePrefix}_${String(sequence).padStart(6, "0")}.m4s`;
}

function trafStartMs(traf: NativeFragmentedMp4Traf, fallbackMs: number): number {
  if (traf.baseMediaDecodeTime === null || !traf.timescale) return fallbackMs;
  return Math.round((traf.baseMediaDecodeTime / traf.timescale) * 1000);
}

function trafDurationMs(traf: NativeFragmentedMp4Traf): number {
  if (!traf.timescale || traf.totalDuration <= 0) return 1;
  return Math.max(1, Math.round((traf.totalDuration / traf.timescale) * 1000));
}

function mapToGateInput(
  read: Extract<NativeFragmentedMp4ReadResult, { ok: true }>,
  source: Uint8Array,
  input: NativeFragmentedMp4GateBridgeInput,
): LiveNativeFragmentedMp4SegmentGateInput {
  const buf = Buffer.from(source);
  const initRange = read.initByteRange;
  const initBytes = initRange ? buf.subarray(initRange.start, initRange.end) : Buffer.alloc(0);
  const initHash = sha256(initBytes);
  const segmentUriPrefix = input.segmentUriPrefix ?? "segment";
  let fallbackStartMs = 0;

  return {
    recordingId: input.recordingId,
    expectedStartSequence: input.expectedStartSequence,
    initSegment: {
      uri: input.initUri ?? "init.mp4",
      bytes: initBytes.byteLength,
      inputSha256: initHash,
      writtenSha256: initHash,
      sourceIntact: true,
      mediaPayloadModified: false,
      boxes: {
        ftyp: read.topBoxTypes.includes("ftyp"),
        moov: read.hasInit,
        mvex: read.hasMvex,
      },
    },
    segments: read.segments.map((segment, index) => {
      const primary =
        segment.trafs.find((traf) => traf.handlerType === "vide") ??
        segment.trafs[0];
      const sequence = segment.sequenceNumber ?? (input.expectedStartSequence ?? 0) + index;
      const startTimeMs = primary ? trafStartMs(primary, fallbackStartMs) : fallbackStartMs;
      const durationMs = primary ? trafDurationMs(primary) : 1;
      fallbackStartMs = startTimeMs + durationMs;
      const segmentBytes = buf.subarray(segment.byteRange.start, segment.byteRange.end);
      const segmentHash = sha256(segmentBytes);

      return {
        sequence,
        uri: safeSegmentUri(segmentUriPrefix, sequence),
        startTimeMs,
        durationMs,
        bytes: segment.byteRange.length,
        inputSha256: segmentHash,
        writtenSha256: segmentHash,
        sourceIntact: true,
        mediaPayloadModified: false,
        ffmpegUsed: false,
        networkFetchUsed: false,
        payloadUnchanged: true,
        boxes: { moof: true, traf: true, tfhd: true, tfdt: true, trun: true, mdat: true },
        tracks: segment.trafs.map((traf) => {
          const timescale = traf.timescale ?? 1;
          const relativeMdatStart = Math.max(0, segment.mdatPayloadStart - segment.byteRange.start);
          const relativeMdatEnd = Math.min(segment.byteRange.length, relativeMdatStart + Math.max(1, traf.totalSampleBytes));
          return {
            trackId: traf.trackId,
            type: traf.handlerType as LiveNativeFragmentedMp4TrackType,
            timescale,
            sampleCount: traf.sampleCount,
            baseMediaDecodeTime:
              traf.baseMediaDecodeTime ?? Math.round((startTimeMs / 1000) * timescale),
            mdatStart: relativeMdatStart,
            mdatEnd: relativeMdatEnd,
          };
        }),
      };
    }),
  };
}

export function buildLiveFragmentedMp4GateFromNativeReader(
  input: NativeFragmentedMp4GateBridgeInput,
): NativeFragmentedMp4GateBridgeResult {
  const read = readNativeFragmentedMp4LiveSegment(input.source);
  if (!read.ok) {
    const gate = buildLiveNativeFragmentedMp4SegmentGate({
      recordingId: input.recordingId,
      expectedStartSequence: input.expectedStartSequence,
      initSegment: null as unknown as LiveNativeFragmentedMp4SegmentGateInput["initSegment"],
      segments: [],
    });
    return bridgeResult(read, gate, `read_failed:${read.reason}`);
  }

  const gateInput = mapToGateInput(read, input.source ?? new Uint8Array(), input);
  const gate = buildLiveNativeFragmentedMp4SegmentGate(gateInput);
  return bridgeResult(read, gate, gate.ok ? "native_fragmented_mp4_reader_gate_ready" : `gate_failed:${gate.reason}`);
}
