export const LIVE_NATIVE_AUDIO_TRACK_GATE_VERSION =
  "live-native-audio-track-gate-v0.1" as const;

export const LIVE_NATIVE_AUDIO_TRACK_GATE_DECISION_ROLE =
  "live_native_audio_track_gate_support_only_no_vault_no_confirmed" as const;

export type LiveNativeAudioTrackAction = "inventory" | "passthrough" | "decode" | "extract";

export type LiveNativeAudioCodecPolicy =
  | "preferred_clean_path"
  | "container_inventory_only"
  | "codec_policy_pending"
  | "unknown_codec_pending";

export interface LiveNativeAudioTrackSummary {
  index: number;
  handlerType: "soun";
  codecFourCc: string | null;
  codecPolicy: LiveNativeAudioCodecPolicy;
}

export interface LiveNativeAudioTrackGateResult {
  ok: boolean;
  reason: string;
  version: typeof LIVE_NATIVE_AUDIO_TRACK_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_AUDIO_TRACK_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  requestedAction: LiveNativeAudioTrackAction;
  format: "mp4" | "mov" | "unknown";
  audioTrackCount: number;
  videoTrackCount: number;
  otherTrackCount: number;
  audioTracks: readonly LiveNativeAudioTrackSummary[];
  audioDecodePending: boolean;
  audioExtractPending: boolean;
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

export interface LiveNativeAudioTrackGatePolicy {
  version: typeof LIVE_NATIVE_AUDIO_TRACK_GATE_VERSION;
  decisionRole: typeof LIVE_NATIVE_AUDIO_TRACK_GATE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "native_mp4_mov_audio_track_inventory_and_passthrough_gate";
  supportsAudioTrackInventory: true;
  supportsAudioPassthrough: true;
  supportsAudioDecode: false;
  supportsAudioExtract: false;
  decodeExtractStatus: "native_audio_decode_extract_pending";
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

interface NativeAudioMp4Box {
  offset: number;
  size: number;
  headerSize: 8 | 16;
  type: string;
  payloadOffset: number;
  payloadSize: number;
}

interface NativeAudioMp4Structure {
  format: "mp4" | "mov" | "unknown";
  moov: NativeAudioMp4Box;
  topBoxes: NativeAudioMp4Box[];
}

interface NativeAudioTrackScan {
  audioTracks: LiveNativeAudioTrackSummary[];
  videoTrackCount: number;
  otherTrackCount: number;
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

function readBox(buf: Buffer, offset: number, end: number): NativeAudioMp4Box | null {
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

function listBoxes(buf: Buffer, start: number, end: number): NativeAudioMp4Box[] | null {
  const boxes: NativeAudioMp4Box[] = [];
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

function children(buf: Buffer, parent: NativeAudioMp4Box): NativeAudioMp4Box[] {
  return listBoxes(buf, parent.payloadOffset, parent.offset + parent.size) ?? [];
}

function child(buf: Buffer, parent: NativeAudioMp4Box, type: string): NativeAudioMp4Box | null {
  return children(buf, parent).find((box) => box.type === type) ?? null;
}

function formatFromFtyp(buf: Buffer, ftyp: NativeAudioMp4Box): "mp4" | "mov" | "unknown" {
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
): { ok: true; structure: NativeAudioMp4Structure } | { ok: false; reason: string } {
  if (buf.byteLength < BOX_HEADER_SIZE) return { ok: false, reason: "buffer_too_small" };
  const topBoxes = listBoxes(buf, 0, buf.byteLength);
  if (!topBoxes || topBoxes.length === 0) return { ok: false, reason: "corrupt_box_size" };
  const ftyp = topBoxes.find((box) => box.type === "ftyp");
  if (!ftyp) return { ok: false, reason: "no_ftyp" };
  const moov = topBoxes.find((box) => box.type === "moov");
  if (!moov) return { ok: false, reason: "no_moov" };
  return { ok: true, structure: { format: formatFromFtyp(buf, ftyp), moov, topBoxes } };
}

function handlerType(buf: Buffer, trak: NativeAudioMp4Box): string | null {
  const mdia = child(buf, trak, "mdia");
  if (!mdia) return null;
  const hdlr = child(buf, mdia, "hdlr");
  if (!hdlr || hdlr.payloadSize < 12) return null;
  return buf.toString("latin1", hdlr.payloadOffset + 8, hdlr.payloadOffset + 12);
}

function codecFourCc(buf: Buffer, trak: NativeAudioMp4Box): string | null {
  const mdia = child(buf, trak, "mdia");
  if (!mdia) return null;
  const minf = child(buf, mdia, "minf");
  if (!minf) return null;
  const stbl = child(buf, minf, "stbl");
  if (!stbl) return null;
  const stsd = child(buf, stbl, "stsd");
  if (!stsd || stsd.payloadSize < 16) return null;

  const entryCountOffset = stsd.payloadOffset + 4;
  const firstEntryTypeOffset = stsd.payloadOffset + 12;
  if (entryCountOffset + 4 > stsd.offset + stsd.size || firstEntryTypeOffset + 4 > stsd.offset + stsd.size) {
    return null;
  }
  const entryCount = buf.readUInt32BE(entryCountOffset);
  if (entryCount < 1) return null;
  return buf.toString("latin1", firstEntryTypeOffset, firstEntryTypeOffset + 4);
}

function audioCodecPolicy(codec: string | null): LiveNativeAudioCodecPolicy {
  if (!codec) return "unknown_codec_pending";
  const normalized = codec.trim().toLowerCase();
  if (normalized === "opus") return "preferred_clean_path";
  if (normalized === "flac" || normalized === "alac" || normalized === "sowt") {
    return "container_inventory_only";
  }
  if (normalized === "mp4a" || normalized === "ac-3" || normalized === "ec-3") {
    return "codec_policy_pending";
  }
  return "unknown_codec_pending";
}

function scanTracks(buf: Buffer, structure: NativeAudioMp4Structure): NativeAudioTrackScan {
  const audioTracks: LiveNativeAudioTrackSummary[] = [];
  let videoTrackCount = 0;
  let otherTrackCount = 0;
  const traks = children(buf, structure.moov).filter((box) => box.type === "trak");

  for (const trak of traks) {
    const handler = handlerType(buf, trak);
    if (handler === "soun") {
      const codec = codecFourCc(buf, trak);
      audioTracks.push({
        index: audioTracks.length,
        handlerType: "soun",
        codecFourCc: codec,
        codecPolicy: audioCodecPolicy(codec),
      });
    } else if (handler === "vide") {
      videoTrackCount += 1;
    } else {
      otherTrackCount += 1;
    }
  }

  return { audioTracks, videoTrackCount, otherTrackCount };
}

function safeAction(value: unknown): LiveNativeAudioTrackAction {
  if (value === "passthrough" || value === "decode" || value === "extract") return value;
  return "inventory";
}

function result(
  reason: string,
  ok: boolean,
  requestedAction: LiveNativeAudioTrackAction,
  format: "mp4" | "mov" | "unknown",
  scan: NativeAudioTrackScan,
): LiveNativeAudioTrackGateResult {
  return {
    ok,
    reason,
    version: LIVE_NATIVE_AUDIO_TRACK_GATE_VERSION,
    decisionRole: LIVE_NATIVE_AUDIO_TRACK_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    requestedAction,
    format,
    audioTrackCount: scan.audioTracks.length,
    videoTrackCount: scan.videoTrackCount,
    otherTrackCount: scan.otherTrackCount,
    audioTracks: scan.audioTracks,
    audioDecodePending: requestedAction === "decode",
    audioExtractPending: requestedAction === "extract",
    ...safetyEnvelope(),
  };
}

const EMPTY_SCAN: NativeAudioTrackScan = {
  audioTracks: [],
  videoTrackCount: 0,
  otherTrackCount: 0,
};

export function inspectLiveNativeAudioTracksFromBuffer(
  source: Uint8Array | null | undefined,
  requestedAction: LiveNativeAudioTrackAction = "inventory",
): LiveNativeAudioTrackGateResult {
  const action = safeAction(requestedAction);
  if (!source || source.byteLength === 0) {
    return result("source_buffer_missing", false, action, "unknown", EMPTY_SCAN);
  }

  const buf = Buffer.from(source);
  const parsed = parseStructure(buf);
  if (!parsed.ok) return result(`parse_failed:${parsed.reason}`, false, action, "unknown", EMPTY_SCAN);
  if (parsed.structure.format === "unknown") {
    return result("unsupported_mp4_mov_brand", false, action, "unknown", EMPTY_SCAN);
  }

  const scan = scanTracks(buf, parsed.structure);
  if (action === "decode" || action === "extract") {
    return result("native_audio_decode_extract_pending", false, action, parsed.structure.format, scan);
  }
  if (scan.audioTracks.length === 0) {
    return result("native_audio_inventory_ready_no_audio_track", true, action, parsed.structure.format, scan);
  }
  return result(
    action === "passthrough" ? "native_audio_passthrough_ready" : "native_audio_inventory_ready",
    true,
    action,
    parsed.structure.format,
    scan,
  );
}

export function getLiveNativeAudioTrackGatePolicy(): LiveNativeAudioTrackGatePolicy {
  return {
    version: LIVE_NATIVE_AUDIO_TRACK_GATE_VERSION,
    decisionRole: LIVE_NATIVE_AUDIO_TRACK_GATE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "native_mp4_mov_audio_track_inventory_and_passthrough_gate",
    supportsAudioTrackInventory: true,
    supportsAudioPassthrough: true,
    supportsAudioDecode: false,
    supportsAudioExtract: false,
    decodeExtractStatus: "native_audio_decode_extract_pending",
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
