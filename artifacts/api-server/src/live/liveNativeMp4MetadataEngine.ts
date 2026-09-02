import { createHash } from "node:crypto";

export const LIVE_NATIVE_MP4_METADATA_ENGINE_VERSION =
  "live-native-mp4-metadata-engine-v0.1" as const;

export const LIVE_NATIVE_MP4_METADATA_ENGINE_DECISION_ROLE =
  "live_native_mp4_metadata_engine_support_only_no_vault_no_confirmed" as const;

export interface LiveNativeMp4Box {
  offset: number;
  size: number;
  headerSize: 8 | 16;
  type: string;
  payloadOffset: number;
  payloadSize: number;
}

export interface LiveNativeMp4Structure {
  fileSizeBytes: number;
  format: "mp4" | "mov" | "unknown";
  layout: "normal" | "faststart" | "unsupported";
  topBoxes: LiveNativeMp4Box[];
  moov: LiveNativeMp4Box;
  mdatBoxes: LiveNativeMp4Box[];
  moovChildren: LiveNativeMp4Box[];
  udta?: LiveNativeMp4Box;
  tmc?: LiveNativeMp4Box;
}

export type LiveNativeMp4ParseResult =
  | { ok: true; structure: LiveNativeMp4Structure }
  | { ok: false; reason: string };

export type LiveNativeMp4MetadataWriteResult =
  | {
      ok: true;
      reason: "metadata_appended_without_media_payload_change";
      outputBuffer: Buffer;
  sourceSha256: string;
  outputSha256: string;
  mdatSha256Before: string;
  mdatSha256After: string;
  layout: "normal" | "faststart";
  metadataByteDelta: number;
  mediaPayloadUnchanged: true;
      sourceModified: false;
      oldFfmpegUsed: false;
      dirtyFfmpegUsed: false;
      gplFfmpegUsed: false;
      nonfreeFfmpegUsed: false;
      reencoded: false;
      transcoded: false;
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
  | {
      ok: false;
      reason: string;
      sourceModified: false;
      oldFfmpegUsed: false;
      dirtyFfmpegUsed: false;
      gplFfmpegUsed: false;
      nonfreeFfmpegUsed: false;
      reencoded: false;
      transcoded: false;
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

export interface LiveNativeMp4MetadataPolicy {
  version: typeof LIVE_NATIVE_MP4_METADATA_ENGINE_VERSION;
  decisionRole: typeof LIVE_NATIVE_MP4_METADATA_ENGINE_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  purpose: "append_tancmark_metadata_to_safe_mp4_mov_copy";
  pureNodeImplementation: true;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  supportsNormalMoovAfterMdat: true;
  supportsFaststartMoovBeforeMdatWithOffsetRewrite: true;
  rewritesStcoOffsets: true;
  rewritesCo64Offsets: true;
  rejectsFaststartWithoutChunkOffsetTable: true;
  rejectsExistingTmcForNow: true;
  mediaPayloadHashVerified: true;
  sourceModified: false;
  reencoded: false;
  transcoded: false;
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
const MAX_SAFE_SIZE = Number.MAX_SAFE_INTEGER;
const UINT32_MAX = 0xffff_ffff;
const TMC_TYPE = Buffer.from([0xa9, 0x74, 0x6d, 0x63]);
const TMC_TYPE_STRING = "\xa9tmc";
const UDTA_TYPE = Buffer.from("udta", "latin1");
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

function safetyEnvelope() {
  return {
    sourceModified: false,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    reencoded: false,
    transcoded: false,
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

function reject(reason: string): LiveNativeMp4MetadataWriteResult {
  return { ok: false, reason, ...safetyEnvelope() };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readBox(buf: Buffer, offset: number, end: number): LiveNativeMp4Box | null {
  if (offset < 0 || offset + BOX_HEADER_SIZE > end || end > buf.length) return null;
  const rawSize = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);
  if (!/^[\x20-\x7e\xa9]{4}$/.test(type)) return null;

  if (rawSize === 1) {
    if (offset + EXTENDED_BOX_HEADER_SIZE > end) return null;
    const sizeBig = buf.readBigUInt64BE(offset + 8);
    if (sizeBig > BigInt(MAX_SAFE_SIZE)) return null;
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

function listBoxesStrict(buf: Buffer, start: number, end: number): LiveNativeMp4Box[] | null {
  const boxes: LiveNativeMp4Box[] = [];
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

function formatFromFtyp(buf: Buffer, ftyp: LiveNativeMp4Box): "mp4" | "mov" | "unknown" {
  if (ftyp.payloadSize < 8) return "unknown";
  const major = buf.toString("latin1", ftyp.payloadOffset, ftyp.payloadOffset + 4);
  if (SUPPORTED_BRANDS.has(major)) return SUPPORTED_BRANDS.get(major)!;

  const compatibleStart = ftyp.payloadOffset + 8;
  const compatibleEnd = ftyp.offset + ftyp.size;
  for (let offset = compatibleStart; offset + 4 <= compatibleEnd; offset += 4) {
    const brand = buf.toString("latin1", offset, offset + 4);
    if (SUPPORTED_BRANDS.has(brand)) return SUPPORTED_BRANDS.get(brand)!;
  }

  return "unknown";
}

function determineLayout(
  moov: LiveNativeMp4Box,
  mdatBoxes: readonly LiveNativeMp4Box[],
): "normal" | "faststart" | "unsupported" {
  const moovEnd = moov.offset + moov.size;
  const allMdatBeforeMoov = mdatBoxes.every((mdat) => mdat.offset + mdat.size <= moov.offset);
  if (allMdatBeforeMoov && moovEnd === Math.max(moovEnd, ...mdatBoxes.map((mdat) => mdat.offset + mdat.size))) {
    return "normal";
  }

  const allMdatAfterMoov = mdatBoxes.every((mdat) => mdat.offset >= moovEnd);
  if (allMdatAfterMoov) return "faststart";

  return "unsupported";
}

export function parseLiveNativeMp4Structure(source: Uint8Array): LiveNativeMp4ParseResult {
  const buf = Buffer.from(source);
  if (buf.byteLength < BOX_HEADER_SIZE) return { ok: false, reason: "buffer_too_small" };

  const topBoxes = listBoxesStrict(buf, 0, buf.byteLength);
  if (!topBoxes || topBoxes.length === 0) return { ok: false, reason: "corrupt_top_level_boxes" };

  const ftyp = topBoxes.find((box) => box.type === "ftyp");
  const moov = topBoxes.find((box) => box.type === "moov");
  const mdatBoxes = topBoxes.filter((box) => box.type === "mdat");

  if (!ftyp) return { ok: false, reason: "ftyp_missing" };
  if (!moov) return { ok: false, reason: "moov_missing" };
  if (mdatBoxes.length === 0) return { ok: false, reason: "mdat_missing" };

  const moovChildren = listBoxesStrict(buf, moov.payloadOffset, moov.offset + moov.size);
  if (!moovChildren) return { ok: false, reason: "corrupt_moov_children" };

  const udta = moovChildren.find((box) => box.type === "udta");
  let tmc: LiveNativeMp4Box | undefined;
  if (udta) {
    const udtaChildren = listBoxesStrict(buf, udta.payloadOffset, udta.offset + udta.size);
    if (!udtaChildren) return { ok: false, reason: "corrupt_udta_children" };
    tmc = udtaChildren.find((box) => box.type === TMC_TYPE_STRING);
  }

  return {
    ok: true,
    structure: {
      fileSizeBytes: buf.byteLength,
      format: formatFromFtyp(buf, ftyp),
      layout: determineLayout(moov, mdatBoxes),
      topBoxes,
      moov,
      mdatBoxes,
      moovChildren,
      udta,
      tmc,
    },
  };
}

function computeMdatSha256(buf: Buffer, structure: LiveNativeMp4Structure): string {
  const hash = createHash("sha256");
  for (const mdat of structure.mdatBoxes) {
    hash.update(buf.subarray(mdat.payloadOffset, mdat.offset + mdat.size));
  }
  return hash.digest("hex");
}

function findChunkOffsetBoxes(
  buf: Buffer,
  parent: LiveNativeMp4Box,
): { stco: LiveNativeMp4Box[]; co64: LiveNativeMp4Box[]; corrupt: boolean } {
  const stco: LiveNativeMp4Box[] = [];
  const co64: LiveNativeMp4Box[] = [];

  const walk = (box: LiveNativeMp4Box): boolean => {
    const children = listBoxesStrict(buf, box.payloadOffset, box.offset + box.size);
    if (!children) return false;
    for (const child of children) {
      if (child.type === "stco") stco.push(child);
      if (child.type === "co64") co64.push(child);
      if (["trak", "mdia", "minf", "stbl"].includes(child.type)) {
        if (!walk(child)) return false;
      }
    }
    return true;
  };

  return { stco, co64, corrupt: !walk(parent) };
}

function rewriteStcoOffsets(
  outputBuffer: Buffer,
  boxes: readonly LiveNativeMp4Box[],
  delta: number,
): string | null {
  for (const box of boxes) {
    const entryCountOffset = box.payloadOffset + 4;
    if (entryCountOffset + 4 > box.offset + box.size) return "stco_corrupt_entry_count";
    const entryCount = outputBuffer.readUInt32BE(entryCountOffset);
    const entriesStart = box.payloadOffset + 8;
    if (entriesStart + entryCount * 4 > box.offset + box.size) return "stco_corrupt_entries";

    for (let index = 0; index < entryCount; index++) {
      const offset = entriesStart + index * 4;
      const current = outputBuffer.readUInt32BE(offset);
      const updated = current + delta;
      if (updated > UINT32_MAX) return "stco_offset_overflow";
      outputBuffer.writeUInt32BE(updated, offset);
    }
  }
  return null;
}

function rewriteCo64Offsets(
  outputBuffer: Buffer,
  boxes: readonly LiveNativeMp4Box[],
  delta: number,
): string | null {
  for (const box of boxes) {
    const entryCountOffset = box.payloadOffset + 4;
    if (entryCountOffset + 4 > box.offset + box.size) return "co64_corrupt_entry_count";
    const entryCount = outputBuffer.readUInt32BE(entryCountOffset);
    const entriesStart = box.payloadOffset + 8;
    if (entriesStart + entryCount * 8 > box.offset + box.size) return "co64_corrupt_entries";

    for (let index = 0; index < entryCount; index++) {
      const offset = entriesStart + index * 8;
      const current = outputBuffer.readBigUInt64BE(offset);
      const updated = current + BigInt(delta);
      if (updated > 0xffff_ffff_ffff_ffffn) return "co64_offset_overflow";
      outputBuffer.writeBigUInt64BE(updated, offset);
    }
  }
  return null;
}

function validateSafeAppendLayout(structure: LiveNativeMp4Structure): string | null {
  if (structure.format === "unknown") return "unsupported_mp4_mov_brand";
  if (structure.tmc) return "tmc_atom_exists";

  const moovEnd = structure.moov.offset + structure.moov.size;
  if (structure.layout === "unsupported") return "unsupported_mp4_mov_layout";
  if (structure.layout === "normal" && moovEnd !== structure.fileSizeBytes) {
    return "normal_moov_must_be_last_for_safe_append";
  }

  if (structure.udta && structure.udta.offset + structure.udta.size !== moovEnd) {
    return "udta_must_be_last_moov_child_for_safe_append";
  }

  if (structure.moov.headerSize !== BOX_HEADER_SIZE) return "extended_moov_size_not_product_ready";
  if (structure.udta && structure.udta.headerSize !== BOX_HEADER_SIZE) {
    return "extended_udta_size_not_product_ready";
  }

  return null;
}

function buildBox(type: Buffer, payload: Buffer): Buffer {
  const size = BOX_HEADER_SIZE + payload.byteLength;
  const out = Buffer.allocUnsafe(size);
  out.writeUInt32BE(size, 0);
  type.copy(out, 4);
  payload.copy(out, BOX_HEADER_SIZE);
  return out;
}

function appendTmcToSafeMoov(
  src: Buffer,
  structure: LiveNativeMp4Structure,
  metadata: Record<string, unknown>,
): { outputBuffer: Buffer; delta: number } {
  const payload = Buffer.from(JSON.stringify(metadata), "utf8");
  const tmc = buildBox(TMC_TYPE, payload);

  if (structure.udta) {
    const insertAt = structure.udta.offset + structure.udta.size;
    const out = Buffer.concat([src.subarray(0, insertAt), tmc, src.subarray(insertAt)]);
    out.writeUInt32BE(structure.moov.size + tmc.byteLength, structure.moov.offset);
    out.writeUInt32BE(structure.udta.size + tmc.byteLength, structure.udta.offset);
    return { outputBuffer: out, delta: tmc.byteLength };
  }

  const udta = buildBox(UDTA_TYPE, tmc);
  const insertAt = structure.moov.offset + structure.moov.size;
  const out = Buffer.concat([src.subarray(0, insertAt), udta, src.subarray(insertAt)]);
  out.writeUInt32BE(structure.moov.size + udta.byteLength, structure.moov.offset);
  return { outputBuffer: out, delta: udta.byteLength };
}

export function appendLiveNativeMp4TancMarkMetadata(input: {
  source: Uint8Array;
  metadata: Record<string, unknown>;
}): LiveNativeMp4MetadataWriteResult {
  const src = Buffer.from(input.source);
  const sourceSha256 = sha256(src);
  const parsed = parseLiveNativeMp4Structure(src);
  if (!parsed.ok) return reject(parsed.reason);

  const unsafeReason = validateSafeAppendLayout(parsed.structure);
  if (unsafeReason) return reject(unsafeReason);
  if (parsed.structure.layout === "unsupported") return reject("unsupported_mp4_mov_layout");

  const chunkOffsetBoxes = findChunkOffsetBoxes(src, parsed.structure.moov);
  if (chunkOffsetBoxes.corrupt) return reject("chunk_offset_table_scan_failed");
  if (
    parsed.structure.layout === "faststart" &&
    chunkOffsetBoxes.stco.length === 0 &&
    chunkOffsetBoxes.co64.length === 0
  ) {
    return reject("faststart_no_chunk_offset_table");
  }

  const mdatSha256Before = computeMdatSha256(src, parsed.structure);
  const appended = appendTmcToSafeMoov(src, parsed.structure, {
    ...input.metadata,
    tancmarkNativeMp4MetadataEngine: LIVE_NATIVE_MP4_METADATA_ENGINE_VERSION,
    decisionRole: LIVE_NATIVE_MP4_METADATA_ENGINE_DECISION_ROLE,
    canOpenVault: false,
    confirmed: false,
    final: false,
  });
  const outputBuffer = appended.outputBuffer;

  if (parsed.structure.layout === "faststart" && appended.delta > 0) {
    const stcoError = rewriteStcoOffsets(outputBuffer, chunkOffsetBoxes.stco, appended.delta);
    if (stcoError) return reject(stcoError);
    const co64Error = rewriteCo64Offsets(outputBuffer, chunkOffsetBoxes.co64, appended.delta);
    if (co64Error) return reject(co64Error);
  }

  const outputParsed = parseLiveNativeMp4Structure(outputBuffer);
  if (!outputParsed.ok) return reject("output_parse_failed");

  const mdatSha256After = computeMdatSha256(outputBuffer, outputParsed.structure);
  if (mdatSha256Before !== mdatSha256After) return reject("media_payload_hash_changed");
  if (sha256(src) !== sourceSha256) return reject("source_buffer_changed");

  return {
    ok: true,
    reason: "metadata_appended_without_media_payload_change",
    outputBuffer,
    sourceSha256,
    outputSha256: sha256(outputBuffer),
    mdatSha256Before,
    mdatSha256After,
    layout: parsed.structure.layout,
    metadataByteDelta: appended.delta,
    mediaPayloadUnchanged: true,
    ...safetyEnvelope(),
  };
}

export function readLiveNativeMp4TancMarkMetadata(
  source: Uint8Array,
): Record<string, unknown> | null {
  const buf = Buffer.from(source);
  const parsed = parseLiveNativeMp4Structure(buf);
  if (!parsed.ok || !parsed.structure.tmc) return null;
  try {
    const tmc = parsed.structure.tmc;
    return JSON.parse(buf.toString("utf8", tmc.payloadOffset, tmc.offset + tmc.size)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getLiveNativeMp4MetadataPolicy(): LiveNativeMp4MetadataPolicy {
  return {
    version: LIVE_NATIVE_MP4_METADATA_ENGINE_VERSION,
    decisionRole: LIVE_NATIVE_MP4_METADATA_ENGINE_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    purpose: "append_tancmark_metadata_to_safe_mp4_mov_copy",
    pureNodeImplementation: true,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    supportsNormalMoovAfterMdat: true,
    supportsFaststartMoovBeforeMdatWithOffsetRewrite: true,
    rewritesStcoOffsets: true,
    rewritesCo64Offsets: true,
    rejectsFaststartWithoutChunkOffsetTable: true,
    rejectsExistingTmcForNow: true,
    mediaPayloadHashVerified: true,
    sourceModified: false,
    reencoded: false,
    transcoded: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
