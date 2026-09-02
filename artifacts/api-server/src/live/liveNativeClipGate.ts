export const LIVE_NATIVE_CLIP_GATE_VERSION = "live-native-clip-gate-v0.1" as const;

export const LIVE_NATIVE_CLIP_GATE_DECISION_ROLE =
  "live_native_clip_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeClipClassification =
  | "full_asset_reference_clip"
  | "native_clip_sample_table_rewrite_pending"
  | "error";

export interface LiveNativeClipRequest {
  startMs?: number | null;
  endMs?: number | null;
}

export interface LiveNativeClipGateResult {
  ok: boolean;
  reason: string;
  version: typeof LIVE_NATIVE_CLIP_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_CLIP_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  classification: LiveNativeClipClassification;
  format: "mp4" | "mov" | "unknown";
  startMs: number | null;
  endMs: number | null;
  durationMs: number | null;
  requestedClipDurationMs: number | null;
  sampleTableRewritePending: boolean;
  safeToExecute: boolean;
  tablesToRewrite: readonly string[];
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchUsed: false;
  sourceModified: false;
  mediaPayloadModified: false;
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
  dnaCanDecideAlone: false;
}

export interface LiveNativeClipGatePolicy {
  version: typeof LIVE_NATIVE_CLIP_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_CLIP_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "native_mp4_mov_clip_safety_gate_without_sample_table_rewrite";
  supportsFullAssetReferenceClip: true;
  supportsTrueTimedClip: false;
  trueTimedClipStatus: "native_clip_sample_table_rewrite_pending";
  requiredRewriteTables: readonly string[];
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchAllowed: false;
  sourceModified: false;
  mediaPayloadModified: false;
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
}

const BOX_HEADER_SIZE = 8;
const EXTENDED_BOX_HEADER_SIZE = 16;
const FULL_ASSET_END_TOLERANCE_MS = 100;
const REQUIRED_REWRITE_TABLES = [
  "stts",
  "ctts",
  "stss",
  "stsc",
  "stsz",
  "stco",
  "co64",
  "mvhd",
  "tkhd",
  "mdhd",
  "elst",
] as const;
const SUPPORTED_BRANDS = new Map<string, "mp4" | "mov">([
  ["isom", "mp4"],
  ["iso2", "mp4"],
  ["mp41", "mp4"],
  ["mp42", "mp4"],
  ["avc1", "mp4"],
  ["M4V ", "mp4"],
  ["M4A ", "mp4"],
  ["qt  ", "mov"],
]);

interface NativeClipMp4Box {
  offset: number;
  size: number;
  headerSize: 8 | 16;
  type: string;
  payloadOffset: number;
  payloadSize: number;
}

interface NativeClipMp4Structure {
  format: "mp4" | "mov" | "unknown";
  moov: NativeClipMp4Box;
}

function safetyEnvelope() {
  return {
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsed: false,
    sourceModified: false,
    mediaPayloadModified: false,
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
    dnaCanDecideAlone: false,
  } as const;
}

function readBox(buf: Buffer, offset: number, end: number): NativeClipMp4Box | null {
  if (offset < 0 || offset + BOX_HEADER_SIZE > end || end > buf.byteLength) return null;
  const rawSize = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);
  if (!/^[\x20-\x7e\xa9]{4}$/.test(type)) return null;

  if (rawSize === 1) {
    if (offset + EXTENDED_BOX_HEADER_SIZE > end) return null;
    const sizeBig = buf.readBigUInt64BE(offset + 8);
    if (sizeBig > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    const size = Number(sizeBig);
    if (size < EXTENDED_BOX_HEADER_SIZE || offset + size > end) return null;
    return {
      offset,
      size,
      headerSize: EXTENDED_BOX_HEADER_SIZE,
      type,
      payloadOffset: offset + EXTENDED_BOX_HEADER_SIZE,
      payloadSize: size - EXTENDED_BOX_HEADER_SIZE,
    };
  }

  if (rawSize === 0) {
    const size = end - offset;
    if (size < BOX_HEADER_SIZE) return null;
    return {
      offset,
      size,
      headerSize: BOX_HEADER_SIZE,
      type,
      payloadOffset: offset + BOX_HEADER_SIZE,
      payloadSize: size - BOX_HEADER_SIZE,
    };
  }

  if (rawSize < BOX_HEADER_SIZE || offset + rawSize > end) return null;
  return {
    offset,
    size: rawSize,
    headerSize: BOX_HEADER_SIZE,
    type,
    payloadOffset: offset + BOX_HEADER_SIZE,
    payloadSize: rawSize - BOX_HEADER_SIZE,
  };
}

function listBoxes(buf: Buffer, start: number, end: number): NativeClipMp4Box[] | null {
  const boxes: NativeClipMp4Box[] = [];
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

function children(buf: Buffer, parent: NativeClipMp4Box): NativeClipMp4Box[] {
  return listBoxes(buf, parent.payloadOffset, parent.offset + parent.size) ?? [];
}

function formatFromFtyp(buf: Buffer, ftyp: NativeClipMp4Box): "mp4" | "mov" | "unknown" {
  if (ftyp.payloadSize < 8) return "unknown";
  const major = buf.toString("latin1", ftyp.payloadOffset, ftyp.payloadOffset + 4);
  const majorFormat = SUPPORTED_BRANDS.get(major);
  if (majorFormat) return majorFormat;

  const compatibleStart = ftyp.payloadOffset + 8;
  const compatibleEnd = ftyp.offset + ftyp.size;
  for (let offset = compatibleStart; offset + 4 <= compatibleEnd; offset += 4) {
    const brand = buf.toString("latin1", offset, offset + 4);
    const format = SUPPORTED_BRANDS.get(brand);
    if (format) return format;
  }

  return "unknown";
}

function parseStructure(
  buf: Buffer,
): { ok: true; structure: NativeClipMp4Structure } | { ok: false; reason: string } {
  if (buf.byteLength < BOX_HEADER_SIZE) return { ok: false, reason: "buffer_too_small" };
  const topBoxes = listBoxes(buf, 0, buf.byteLength);
  if (!topBoxes || topBoxes.length === 0) return { ok: false, reason: "corrupt_box_size" };
  const ftyp = topBoxes.find((box) => box.type === "ftyp");
  if (!ftyp) return { ok: false, reason: "no_ftyp" };
  const moov = topBoxes.find((box) => box.type === "moov");
  if (!moov) return { ok: false, reason: "no_moov" };
  return { ok: true, structure: { format: formatFromFtyp(buf, ftyp), moov } };
}

function movieDurationMs(buf: Buffer, moov: NativeClipMp4Box): number | null {
  const mvhd = children(buf, moov).find((box) => box.type === "mvhd");
  if (!mvhd || mvhd.payloadSize < 20) return null;
  const version = buf[mvhd.payloadOffset];

  if (version === 0) {
    const timescaleOffset = mvhd.payloadOffset + 12;
    const durationOffset = mvhd.payloadOffset + 16;
    if (durationOffset + 4 > mvhd.offset + mvhd.size) return null;
    const timescale = buf.readUInt32BE(timescaleOffset);
    const duration = buf.readUInt32BE(durationOffset);
    if (timescale === 0) return null;
    return Math.round((duration / timescale) * 1000);
  }

  if (version === 1) {
    const timescaleOffset = mvhd.payloadOffset + 20;
    const durationOffset = mvhd.payloadOffset + 24;
    if (durationOffset + 8 > mvhd.offset + mvhd.size) return null;
    const timescale = buf.readUInt32BE(timescaleOffset);
    const durationBig = buf.readBigUInt64BE(durationOffset);
    if (timescale === 0 || durationBig > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Math.round((Number(durationBig) / timescale) * 1000);
  }

  return null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function result(
  reason: string,
  ok: boolean,
  classification: LiveNativeClipClassification,
  format: "mp4" | "mov" | "unknown",
  request: { startMs: number | null; endMs: number | null },
  durationMs: number | null,
): LiveNativeClipGateResult {
  const requestedClipDurationMs =
    request.startMs !== null && request.endMs !== null ? request.endMs - request.startMs : null;
  return {
    ok,
    reason,
    version: LIVE_NATIVE_CLIP_GATE_VERSION,
    decisionRole: LIVE_NATIVE_CLIP_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    classification,
    format,
    startMs: request.startMs,
    endMs: request.endMs,
    durationMs,
    requestedClipDurationMs,
    sampleTableRewritePending: classification === "native_clip_sample_table_rewrite_pending",
    safeToExecute: classification === "full_asset_reference_clip",
    tablesToRewrite: classification === "native_clip_sample_table_rewrite_pending" ? REQUIRED_REWRITE_TABLES : [],
    ...safetyEnvelope(),
  };
}

export function inspectLiveNativeClipFromBuffer(
  source: Uint8Array | null | undefined,
  request: LiveNativeClipRequest = {},
): LiveNativeClipGateResult {
  const startMs = safeNumber(request.startMs ?? 0);
  const requestedEndMs = request.endMs === null || request.endMs === undefined ? null : safeNumber(request.endMs);

  if (startMs === null || startMs < 0) {
    return result("invalid_start_ms", false, "error", "unknown", { startMs, endMs: requestedEndMs }, null);
  }
  if (requestedEndMs !== null && requestedEndMs <= startMs) {
    return result("invalid_clip_range", false, "error", "unknown", { startMs, endMs: requestedEndMs }, null);
  }
  if (!source || source.byteLength === 0) {
    return result("source_buffer_missing", false, "error", "unknown", { startMs, endMs: requestedEndMs }, null);
  }

  const buf = Buffer.from(source);
  const parsed = parseStructure(buf);
  if (!parsed.ok) {
    return result(`parse_failed:${parsed.reason}`, false, "error", "unknown", { startMs, endMs: requestedEndMs }, null);
  }
  if (parsed.structure.format === "unknown") {
    return result(
      "unsupported_mp4_mov_brand",
      false,
      "error",
      "unknown",
      { startMs, endMs: requestedEndMs },
      null,
    );
  }

  const durationMs = movieDurationMs(buf, parsed.structure.moov);
  if (durationMs === null || durationMs <= 0) {
    return result(
      "movie_duration_unreadable",
      false,
      "error",
      parsed.structure.format,
      { startMs, endMs: requestedEndMs },
      null,
    );
  }

  const endMs = requestedEndMs ?? durationMs;
  if (endMs <= startMs) {
    return result("invalid_clip_range", false, "error", parsed.structure.format, { startMs, endMs }, durationMs);
  }

  const fullAssetRequested = startMs === 0 && endMs >= durationMs - FULL_ASSET_END_TOLERANCE_MS;
  if (fullAssetRequested) {
    return result(
      "full_asset_reference_clip_ready",
      true,
      "full_asset_reference_clip",
      parsed.structure.format,
      { startMs: 0, endMs: durationMs },
      durationMs,
    );
  }

  return result(
    "native_clip_sample_table_rewrite_pending",
    false,
    "native_clip_sample_table_rewrite_pending",
    parsed.structure.format,
    { startMs, endMs },
    durationMs,
  );
}

export function getLiveNativeClipGatePolicy(): LiveNativeClipGatePolicy {
  return {
    version: LIVE_NATIVE_CLIP_GATE_VERSION,
    decisionRole: LIVE_NATIVE_CLIP_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "native_mp4_mov_clip_safety_gate_without_sample_table_rewrite",
    supportsFullAssetReferenceClip: true,
    supportsTrueTimedClip: false,
    trueTimedClipStatus: "native_clip_sample_table_rewrite_pending",
    requiredRewriteTables: REQUIRED_REWRITE_TABLES,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchAllowed: false,
    sourceModified: false,
    mediaPayloadModified: false,
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
  };
}
