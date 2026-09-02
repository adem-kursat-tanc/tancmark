import { createHash } from "node:crypto";

export const LIVE_NATIVE_THUMBNAIL_GATE_VERSION =
  "live-native-thumbnail-gate-v0.1" as const;

export const LIVE_NATIVE_THUMBNAIL_GATE_DECISION_ROLE =
  "live_native_thumbnail_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeThumbnailMode = "embedded_poster" | "video_frame";

export type LiveNativeThumbnailSource =
  | "embedded_poster_metadata"
  | "native_frame_decode_pending"
  | "none";

export type LiveNativeThumbnailPosterBoxSource = "covr" | "thmb";
export type LiveNativeThumbnailImageFormat = "jpeg" | "png" | "webp" | "unknown";

export interface LiveNativeThumbnailPosterInput {
  present?: boolean;
  mimeType?: string;
  byteLength?: number;
  sha256?: string;
}

export interface LiveNativeThumbnailGateInput {
  recordingId?: string;
  sourceRef?: string;
  requestedMode?: LiveNativeThumbnailMode;
  embeddedPoster?: LiveNativeThumbnailPosterInput;
}

export interface LiveNativeThumbnailGatePolicy {
  version: typeof LIVE_NATIVE_THUMBNAIL_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_THUMBNAIL_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "safe_native_thumbnail_gate_without_video_decode";
  supportsEmbeddedPosterMetadata: true;
  supportsCovrPoster: true;
  supportsThmbPoster: true;
  supportsFrameDecode: false;
  frameDecodeStatus: "thumbnail_frame_decode_pending";
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

export type LiveNativeThumbnailGateResult = {
  ok: boolean;
  reason: string;
  version: typeof LIVE_NATIVE_THUMBNAIL_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_THUMBNAIL_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  requestedMode: LiveNativeThumbnailMode;
  thumbnailSource: LiveNativeThumbnailSource;
  recordingId: string | null;
  sourceRef: string | null;
  posterMimeType: string | null;
  posterByteLength: number | null;
  posterSha256: string | null;
  embeddedPosterReady: boolean;
  frameDecodePending: boolean;
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
};

const SHA256_RE = /^[a-f0-9]{64}$/i;
const MAX_POSTER_BYTES = 10 * 1024 * 1024;
const SAFE_POSTER_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BOX_HEADER_SIZE = 8;
const EXTENDED_BOX_HEADER_SIZE = 16;
const COVR_FLAG_JPEG = 0x0d;
const COVR_FLAG_PNG = 0x0e;
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

interface LiveNativeThumbnailMp4Box {
  offset: number;
  size: number;
  headerSize: 8 | 16;
  type: string;
  payloadOffset: number;
  payloadSize: number;
}

interface LiveNativeThumbnailMp4Structure {
  format: "mp4" | "mov" | "unknown";
  moov: LiveNativeThumbnailMp4Box;
  topBoxes: LiveNativeThumbnailMp4Box[];
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

export type LiveNativeThumbnailExtractResult = {
  ok: boolean;
  reason: string;
  data: Buffer | null;
  gate: LiveNativeThumbnailGateResult;
  posterBoxSource: LiveNativeThumbnailPosterBoxSource | null;
  imageFormat: Exclude<LiveNativeThumbnailImageFormat, "unknown"> | null;
  mimeType: string | null;
  byteLength: number | null;
  sha256: string | null;
  frameDecodePending: boolean;
} & ReturnType<typeof safetyEnvelope>;

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function safeRecordingId(value: unknown): string | null {
  const text = safeText(value, 100);
  if (!text) return null;
  const normalized = text.replace(/[^a-zA-Z0-9_-]/g, "_");
  return normalized.length > 0 ? normalized : null;
}

function safeSourceRef(value: unknown): string | null {
  const text = safeText(value, 240);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("rtmp://") ||
    lower.startsWith("rtmps://") ||
    lower.startsWith("s3://") ||
    lower.startsWith("gs://")
  ) {
    return null;
  }
  if (text.includes("..")) return null;
  if (!/^[a-zA-Z0-9_./:@-]+$/.test(text)) return null;
  return text;
}

function safeMode(value: unknown): LiveNativeThumbnailMode {
  return value === "video_frame" ? "video_frame" : "embedded_poster";
}

function safeMime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase();
}

function isSafeByteLength(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_POSTER_BYTES
  );
}

function isValidSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_RE.test(value);
}

function baseResult(
  input: LiveNativeThumbnailGateInput | undefined,
  requestedMode: LiveNativeThumbnailMode,
  reason: string,
  ok: boolean,
  thumbnailSource: LiveNativeThumbnailSource,
): LiveNativeThumbnailGateResult {
  const poster = input?.embeddedPoster;
  const mimeType = safeMime(poster?.mimeType);
  const byteLength = isSafeByteLength(poster?.byteLength) ? poster.byteLength : null;
  const posterSha256 = isValidSha256(poster?.sha256) ? poster.sha256.toLowerCase() : null;

  return {
    ok,
    reason,
    version: LIVE_NATIVE_THUMBNAIL_GATE_VERSION,
    decisionRole: LIVE_NATIVE_THUMBNAIL_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    requestedMode,
    thumbnailSource,
    recordingId: safeRecordingId(input?.recordingId),
    sourceRef: safeSourceRef(input?.sourceRef),
    posterMimeType: mimeType,
    posterByteLength: byteLength,
    posterSha256,
    embeddedPosterReady: ok && thumbnailSource === "embedded_poster_metadata",
    frameDecodePending: thumbnailSource === "native_frame_decode_pending",
    ...safetyEnvelope(),
  };
}

export function hashLiveNativeThumbnailPosterBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function detectLiveNativeThumbnailImageFormat(
  bytes: Uint8Array | null | undefined,
): LiveNativeThumbnailImageFormat {
  if (!bytes || bytes.byteLength < 4) return "unknown";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

function mimeForImageFormat(format: LiveNativeThumbnailImageFormat): string | null {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return null;
}

function readNestedBox(buf: Buffer, offset: number, end: number): LiveNativeThumbnailMp4Box | null {
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

function listNestedBoxes(buf: Buffer, start: number, end: number): LiveNativeThumbnailMp4Box[] | null {
  const boxes: LiveNativeThumbnailMp4Box[] = [];
  let cursor = start;
  while (cursor < end) {
    const box = readNestedBox(buf, cursor, end);
    if (!box) return null;
    boxes.push(box);
    cursor += box.size;
    if (cursor <= box.offset) return null;
  }
  return cursor === end ? boxes : null;
}

function childBoxes(buf: Buffer, parent: LiveNativeThumbnailMp4Box): LiveNativeThumbnailMp4Box[] {
  return listNestedBoxes(buf, parent.payloadOffset, parent.offset + parent.size) ?? [];
}

function firstChild(
  buf: Buffer,
  parent: LiveNativeThumbnailMp4Box,
  type: string,
): LiveNativeThumbnailMp4Box | null {
  return childBoxes(buf, parent).find((box) => box.type === type) ?? null;
}

function metaChildren(buf: Buffer, meta: LiveNativeThumbnailMp4Box): LiveNativeThumbnailMp4Box[] {
  const metaEnd = meta.offset + meta.size;
  const fullBoxStart = meta.payloadOffset + 4;
  if (fullBoxStart <= metaEnd) {
    const fullBoxChildren = listNestedBoxes(buf, fullBoxStart, metaEnd);
    if (fullBoxChildren && fullBoxChildren.length > 0) return fullBoxChildren;
  }
  return childBoxes(buf, meta);
}

function thumbnailFormatFromFtyp(buf: Buffer, ftyp: LiveNativeThumbnailMp4Box): "mp4" | "mov" | "unknown" {
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

function parseThumbnailMp4Structure(
  buf: Buffer,
): { ok: true; structure: LiveNativeThumbnailMp4Structure } | { ok: false; reason: string } {
  if (buf.byteLength < BOX_HEADER_SIZE) return { ok: false, reason: "buffer_too_small" };
  const topBoxes = listNestedBoxes(buf, 0, buf.byteLength);
  if (!topBoxes || topBoxes.length === 0) return { ok: false, reason: "corrupt_box_size" };
  const ftyp = topBoxes.find((box) => box.type === "ftyp");
  if (!ftyp) return { ok: false, reason: "no_ftyp" };
  const moov = topBoxes.find((box) => box.type === "moov");
  if (!moov) return { ok: false, reason: "no_moov" };
  return {
    ok: true,
    structure: {
      format: thumbnailFormatFromFtyp(buf, ftyp),
      moov,
      topBoxes,
    },
  };
}

function readCovrPoster(
  buf: Buffer,
  moov: LiveNativeThumbnailMp4Box,
): { data: Buffer; source: "covr" } | null {
  const udta = firstChild(buf, moov, "udta");
  if (!udta) return null;
  const meta = firstChild(buf, udta, "meta");
  if (!meta) return null;
  const ilst = metaChildren(buf, meta).find((box) => box.type === "ilst");
  if (!ilst) return null;
  const covr = firstChild(buf, ilst, "covr");
  if (!covr) return null;
  const data = firstChild(buf, covr, "data");
  if (!data || data.payloadSize < 8) return null;

  const flags = buf.readUInt32BE(data.payloadOffset) & 0x00ff_ffff;
  const imageStart = data.payloadOffset + 8;
  const imageEnd = data.offset + data.size;
  if (imageEnd <= imageStart) return null;
  const imageBytes = buf.subarray(imageStart, imageEnd);
  const imageFormat = detectLiveNativeThumbnailImageFormat(imageBytes);
  if (flags === COVR_FLAG_JPEG && imageFormat !== "jpeg") return null;
  if (flags === COVR_FLAG_PNG && imageFormat !== "png") return null;
  if (imageFormat === "unknown") return null;

  return { data: Buffer.from(imageBytes), source: "covr" };
}

function readThmbPoster(
  buf: Buffer,
  moov: LiveNativeThumbnailMp4Box,
): { data: Buffer; source: "thmb" } | null {
  const udta = firstChild(buf, moov, "udta");
  if (!udta) return null;
  const thmb = firstChild(buf, udta, "thmb");
  if (!thmb || thmb.payloadSize < 4) return null;

  const rawPayload = buf.subarray(thmb.payloadOffset, thmb.offset + thmb.size);
  if (detectLiveNativeThumbnailImageFormat(rawPayload) !== "unknown") {
    return { data: Buffer.from(rawPayload), source: "thmb" };
  }

  if (rawPayload.byteLength > 4) {
    const skippedPrefix = rawPayload.subarray(4);
    if (detectLiveNativeThumbnailImageFormat(skippedPrefix) !== "unknown") {
      return { data: Buffer.from(skippedPrefix), source: "thmb" };
    }
  }

  return null;
}

function extractionResult(
  reason: string,
  gate: LiveNativeThumbnailGateResult,
  ok: boolean,
  data: Buffer | null,
  posterBoxSource: LiveNativeThumbnailPosterBoxSource | null,
  imageFormat: Exclude<LiveNativeThumbnailImageFormat, "unknown"> | null,
): LiveNativeThumbnailExtractResult {
  return {
    ok,
    reason,
    data,
    gate,
    posterBoxSource,
    imageFormat,
    mimeType: gate.posterMimeType,
    byteLength: gate.posterByteLength,
    sha256: gate.posterSha256,
    frameDecodePending: gate.frameDecodePending,
    ...safetyEnvelope(),
  };
}

function pendingExtraction(reason: string): LiveNativeThumbnailExtractResult {
  const gate = buildLiveNativeThumbnailGate({ requestedMode: "video_frame" });
  return extractionResult(reason, gate, false, null, null, null);
}

export function extractLiveNativeThumbnailFromBuffer(
  source: Uint8Array | null | undefined,
): LiveNativeThumbnailExtractResult {
  if (!source || source.byteLength === 0) {
    return pendingExtraction("source_buffer_missing");
  }

  const buf = Buffer.from(source);
  const parsed = parseThumbnailMp4Structure(buf);
  if (!parsed.ok) return pendingExtraction(`parse_failed:${parsed.reason}`);
  if (parsed.structure.format === "unknown") {
    return pendingExtraction("unsupported_mp4_mov_brand");
  }

  const candidate = readCovrPoster(buf, parsed.structure.moov) ?? readThmbPoster(buf, parsed.structure.moov);
  if (!candidate) return pendingExtraction("thumbnail_frame_decode_pending");

  const imageFormat = detectLiveNativeThumbnailImageFormat(candidate.data);
  const mimeType = mimeForImageFormat(imageFormat);
  if (!mimeType || imageFormat === "unknown") {
    const gate = buildLiveNativeThumbnailGate({
      requestedMode: "embedded_poster",
      embeddedPoster: {
        present: true,
        mimeType: "application/octet-stream",
        byteLength: candidate.data.byteLength,
        sha256: "0".repeat(64),
      },
    });
    return extractionResult(gate.reason, gate, false, null, candidate.source, null);
  }

  const sha256 = isSafeByteLength(candidate.data.byteLength)
    ? hashLiveNativeThumbnailPosterBytes(candidate.data)
    : "0".repeat(64);
  const gate = buildLiveNativeThumbnailGate({
    requestedMode: "embedded_poster",
    embeddedPoster: {
      present: true,
      mimeType,
      byteLength: candidate.data.byteLength,
      sha256,
    },
  });

  if (!gate.ok) {
    return extractionResult(gate.reason, gate, false, null, candidate.source, imageFormat);
  }

  return extractionResult(
    "embedded_poster_thumbnail_extracted",
    gate,
    true,
    candidate.data,
    candidate.source,
    imageFormat,
  );
}

export function buildLiveNativeThumbnailGate(
  input: LiveNativeThumbnailGateInput = {},
): LiveNativeThumbnailGateResult {
  const requestedMode = safeMode(input.requestedMode);
  if (input.sourceRef !== undefined && !safeSourceRef(input.sourceRef)) {
    return baseResult(input, requestedMode, "source_ref_not_product_safe", false, "none");
  }

  if (requestedMode === "video_frame") {
    return baseResult(
      input,
      requestedMode,
      "thumbnail_frame_decode_pending",
      false,
      "native_frame_decode_pending",
    );
  }

  const poster = input.embeddedPoster;
  if (!poster?.present) {
    return baseResult(input, requestedMode, "embedded_poster_missing", false, "none");
  }

  const mimeType = safeMime(poster.mimeType);
  if (!mimeType || !SAFE_POSTER_MIME_TYPES.has(mimeType)) {
    return baseResult(input, requestedMode, "unsupported_poster_mime", false, "none");
  }

  if (!isSafeByteLength(poster.byteLength)) {
    return baseResult(input, requestedMode, "poster_byte_length_invalid", false, "none");
  }

  if (!isValidSha256(poster.sha256)) {
    return baseResult(input, requestedMode, "poster_hash_invalid", false, "none");
  }

  return baseResult(
    input,
    requestedMode,
    "embedded_poster_thumbnail_ready",
    true,
    "embedded_poster_metadata",
  );
}

export function getLiveNativeThumbnailGatePolicy(): LiveNativeThumbnailGatePolicy {
  return {
    version: LIVE_NATIVE_THUMBNAIL_GATE_VERSION,
    decisionRole: LIVE_NATIVE_THUMBNAIL_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "safe_native_thumbnail_gate_without_video_decode",
    supportsEmbeddedPosterMetadata: true,
    supportsCovrPoster: true,
    supportsThmbPoster: true,
    supportsFrameDecode: false,
    frameDecodeStatus: "thumbnail_frame_decode_pending",
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
