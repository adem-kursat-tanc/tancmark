import { createHash } from "node:crypto";

export type LiveFmp4HandlerType = "vide" | "soun";

export interface LiveFmp4TrackInfo { trackId: number; handlerType: LiveFmp4HandlerType; timescale: number; codec: string; defaultSampleDuration: number; defaultSampleSize: number }
export interface LiveFmp4InitInfo { codecs: string[]; byteLength: number; tracks: LiveFmp4TrackInfo[] }
export interface LiveFmp4FragmentTrackInfo { trackId: number; baseDecodeTime: bigint; durationTicks: bigint; durationMs: number; sampleCount: number; sampleBytes: number }
export interface LiveFmp4FragmentInfo { mfhdSequence: number; baseDecodeTime: bigint; durationMs: number; byteLength: number; tracks: LiveFmp4FragmentTrackInfo[] }

interface Box { type: string; start: number; dataStart: number; end: number }
interface FullBox { version: number; flags: number; payloadStart: number }
const MAX_BOXES = 4096;
const MAX_BOX_BYTES = 64 * 1024 * 1024;

function boxes(bytes: Buffer, start = 0, end = bytes.length): Box[] {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > bytes.length) throw new Error("live_fmp4_box_bounds_invalid");
  const out: Box[] = [];
  let offset = start;
  while (offset < end) {
    if (end - offset < 8 || out.length >= MAX_BOXES) throw new Error("live_fmp4_box_invalid");
    let size = BigInt(bytes.readUInt32BE(offset));
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (!/^[\x20-\x7e]{4}$/.test(type)) throw new Error("live_fmp4_box_type_invalid");
    let header = 8;
    if (size === 1n) {
      if (end - offset < 16) throw new Error("live_fmp4_box_invalid");
      size = bytes.readBigUInt64BE(offset + 8); header = 16;
    } else if (size === 0n) size = BigInt(end - offset);
    if (size < BigInt(header) || size > BigInt(end - offset) || size > BigInt(MAX_BOX_BYTES)) throw new Error("live_fmp4_box_bounds_invalid");
    const boxEnd = offset + Number(size);
    out.push({ type, start: offset, dataStart: offset + header, end: boxEnd }); offset = boxEnd;
  }
  if (offset !== end) throw new Error("live_fmp4_box_bounds_invalid");
  return out;
}

function children(bytes: Buffer, parent: Box, payloadOffset = 0): Box[] { return boxes(bytes, parent.dataStart + payloadOffset, parent.end); }
function one(items: readonly Box[], type: string): Box {
  const found = items.filter((item) => item.type === type);
  if (found.length !== 1) throw new Error(`live_fmp4_${type}_cardinality_invalid`);
  return found[0] as Box;
}
function fullBox(bytes: Buffer, box: Box, versions: readonly number[], allowedFlags: number): FullBox {
  if (box.end - box.dataStart < 4) throw new Error(`live_fmp4_${box.type}_invalid`);
  const version = bytes[box.dataStart] as number;
  const flags = bytes.readUIntBE(box.dataStart + 1, 3);
  if (!versions.includes(version) || (flags & ~allowedFlags) !== 0) throw new Error(`live_fmp4_${box.type}_fullbox_invalid`);
  return { version, flags, payloadStart: box.dataStart + 4 };
}
function u32Positive(bytes: Buffer, offset: number, end: number, code: string): number {
  if (offset + 4 > end) throw new Error(code);
  const value = bytes.readUInt32BE(offset);
  if (value === 0) throw new Error(code);
  return value;
}

function validateFtyp(bytes: Buffer, box: Box): void {
  const length = box.end - box.dataStart;
  if (length < 12 || length % 4 !== 0) throw new Error("live_fmp4_ftyp_invalid");
  for (let offset = box.dataStart; offset < box.end; offset += 4) {
    if (offset === box.dataStart + 4) continue;
    if (!/^[\x20-\x7e]{4}$/.test(bytes.toString("ascii", offset, offset + 4))) throw new Error("live_fmp4_ftyp_invalid");
  }
}
function parseTkhdTrackId(bytes: Buffer, box: Box): number {
  const parsed = fullBox(bytes, box, [0, 1], 0x000007);
  return u32Positive(bytes, parsed.payloadStart + (parsed.version === 1 ? 16 : 8), box.end, "live_fmp4_tkhd_track_id_invalid");
}
function parseMdhdTimescale(bytes: Buffer, box: Box): number {
  const parsed = fullBox(bytes, box, [0, 1], 0);
  return u32Positive(bytes, parsed.payloadStart + (parsed.version === 1 ? 16 : 8), box.end, "live_fmp4_mdhd_timescale_invalid");
}
function parseHandler(bytes: Buffer, box: Box): LiveFmp4HandlerType {
  const parsed = fullBox(bytes, box, [0], 0);
  if (parsed.payloadStart + 8 > box.end) throw new Error("live_fmp4_hdlr_invalid");
  const handler = bytes.toString("ascii", parsed.payloadStart + 4, parsed.payloadStart + 8);
  if (handler !== "vide" && handler !== "soun") throw new Error("live_fmp4_handler_unsupported");
  return handler;
}

function validateSampleTables(bytes: Buffer, stblChildren: readonly Box[]): void {
  const stts = one(stblChildren, "stts"); const stsc = one(stblChildren, "stsc"); const stsz = one(stblChildren, "stsz");
  const offsets = stblChildren.filter((box) => box.type === "stco" || box.type === "co64");
  if (offsets.length !== 1) throw new Error("live_fmp4_chunk_offset_cardinality_invalid");
  for (const [box, stride] of [[stts, 8], [stsc, 12], [offsets[0] as Box, offsets[0]?.type === "co64" ? 8 : 4]] as const) {
    const parsed = fullBox(bytes, box, [0], 0);
    if (parsed.payloadStart + 4 > box.end) throw new Error(`live_fmp4_${box.type}_invalid`);
    const count = bytes.readUInt32BE(parsed.payloadStart);
    if (parsed.payloadStart + 4 + count * stride !== box.end) throw new Error(`live_fmp4_${box.type}_bounds_invalid`);
  }
  const parsed = fullBox(bytes, stsz, [0], 0);
  if (parsed.payloadStart + 8 > stsz.end) throw new Error("live_fmp4_stsz_invalid");
  const sampleSize = bytes.readUInt32BE(parsed.payloadStart); const count = bytes.readUInt32BE(parsed.payloadStart + 4);
  if (parsed.payloadStart + 8 + (sampleSize === 0 ? count * 4 : 0) !== stsz.end) throw new Error("live_fmp4_stsz_bounds_invalid");
}

function parseAvcC(bytes: Buffer, box: Box, sampleType: "avc1" | "avc3"): string {
  const data = bytes.subarray(box.dataStart, box.end);
  if (data.length < 11 || data[0] !== 1 || ((data[4] as number) & 0x03) !== 3) throw new Error("live_fmp4_avcc_invalid");
  const spsCount = (data[5] as number) & 0x1f;
  if (spsCount < 1 || spsCount > 31) throw new Error("live_fmp4_avcc_sps_invalid");
  let offset = 6;
  for (let index = 0; index < spsCount; index += 1) {
    if (offset + 2 > data.length) throw new Error("live_fmp4_avcc_sps_invalid");
    const length = data.readUInt16BE(offset); offset += 2;
    if (length < 4 || offset + length > data.length) throw new Error("live_fmp4_avcc_sps_invalid");
    offset += length;
  }
  if (offset >= data.length) throw new Error("live_fmp4_avcc_pps_invalid");
  const ppsCount = data[offset] as number; offset += 1;
  if (ppsCount < 1 || ppsCount > 32) throw new Error("live_fmp4_avcc_pps_invalid");
  for (let index = 0; index < ppsCount; index += 1) {
    if (offset + 2 > data.length) throw new Error("live_fmp4_avcc_pps_invalid");
    const length = data.readUInt16BE(offset); offset += 2;
    if (length < 2 || offset + length > data.length) throw new Error("live_fmp4_avcc_pps_invalid");
    offset += length;
  }
  if (offset > data.length || data.length > 64 * 1024) throw new Error("live_fmp4_avcc_bounds_invalid");
  return `${sampleType}.${data.subarray(1, 4).toString("hex")}`;
}

function descriptorLength(bytes: Buffer, start: number, end: number): { length: number; payloadStart: number } {
  let length = 0; let offset = start;
  for (let index = 0; index < 4; index += 1) {
    if (offset >= end) throw new Error("live_fmp4_esds_descriptor_invalid");
    const value = bytes[offset] as number; offset += 1; length = (length << 7) | (value & 0x7f);
    if ((value & 0x80) === 0) return { length, payloadStart: offset };
  }
  throw new Error("live_fmp4_esds_descriptor_invalid");
}

function parseAacEsds(bytes: Buffer, box: Box): string {
  const parsed = fullBox(bytes, box, [0], 0);
  let objectTypeIndication: number | null = null; let audioObjectType: number | null = null;
  const visit = (start: number, end: number, depth: number): void => {
    if (depth > 5) throw new Error("live_fmp4_esds_descriptor_depth_invalid");
    let offset = start;
    while (offset < end) {
      const tag = bytes[offset] as number; offset += 1;
      const decoded = descriptorLength(bytes, offset, end); const payloadStart = decoded.payloadStart; const payloadEnd = payloadStart + decoded.length;
      if (decoded.length < 1 || payloadEnd > end) throw new Error("live_fmp4_esds_descriptor_invalid");
      if (tag === 0x03) {
        if (payloadStart + 3 > payloadEnd) throw new Error("live_fmp4_esds_es_invalid");
        const flags = bytes[payloadStart + 2] as number; let nested = payloadStart + 3;
        if ((flags & 0x80) !== 0) nested += 2;
        if ((flags & 0x40) !== 0) { if (nested >= payloadEnd) throw new Error("live_fmp4_esds_es_invalid"); nested += 1 + (bytes[nested] as number); }
        if ((flags & 0x20) !== 0) nested += 2;
        if (nested > payloadEnd) throw new Error("live_fmp4_esds_es_invalid");
        visit(nested, payloadEnd, depth + 1);
      } else if (tag === 0x04) {
        if (payloadStart + 13 > payloadEnd) throw new Error("live_fmp4_esds_decoder_config_invalid");
        objectTypeIndication = bytes[payloadStart] as number; visit(payloadStart + 13, payloadEnd, depth + 1);
      } else if (tag === 0x05) {
        const first = bytes[payloadStart] as number; let value = first >> 3;
        if (value === 31) { if (payloadStart + 2 > payloadEnd) throw new Error("live_fmp4_esds_aac_config_invalid"); value = 32 + ((first & 0x07) << 3) + ((bytes[payloadStart + 1] as number) >> 5); }
        audioObjectType = value;
      }
      offset = payloadEnd;
    }
    if (offset !== end) throw new Error("live_fmp4_esds_descriptor_invalid");
  };
  visit(parsed.payloadStart, box.end, 0);
  if (objectTypeIndication !== 0x40 || audioObjectType !== 2) throw new Error("live_fmp4_aac_lc_required");
  return "mp4a.40.2";
}

function parseStsdCodec(bytes: Buffer, stsd: Box, handlerType: LiveFmp4HandlerType): string {
  const parsed = fullBox(bytes, stsd, [0], 0);
  if (parsed.payloadStart + 4 > stsd.end || bytes.readUInt32BE(parsed.payloadStart) !== 1) throw new Error("live_fmp4_stsd_entry_count_invalid");
  const entries = boxes(bytes, parsed.payloadStart + 4, stsd.end);
  if (entries.length !== 1) throw new Error("live_fmp4_stsd_entry_count_invalid");
  const entry = entries[0] as Box;
  if (handlerType === "vide") {
    if (entry.type !== "avc1" && entry.type !== "avc3") throw new Error("live_fmp4_avc_required");
    if (entry.end - entry.dataStart < 78) throw new Error("live_fmp4_visual_sample_entry_invalid");
    return parseAvcC(bytes, one(children(bytes, entry, 78), "avcC"), entry.type);
  }
  if (entry.type !== "mp4a" || entry.end - entry.dataStart < 28) throw new Error("live_fmp4_mp4a_required");
  const version = bytes.readUInt16BE(entry.dataStart + 8);
  const extension = version === 0 ? 0 : version === 1 ? 16 : version === 2 ? 36 : -1;
  if (extension < 0 || entry.end - entry.dataStart < 28 + extension) throw new Error("live_fmp4_audio_sample_entry_invalid");
  return parseAacEsds(bytes, one(children(bytes, entry, 28 + extension), "esds"));
}

function parseTrex(bytes: Buffer, box: Box): { trackId: number; defaultSampleDuration: number; defaultSampleSize: number } {
  const parsed = fullBox(bytes, box, [0], 0);
  if (parsed.payloadStart + 20 !== box.end) throw new Error("live_fmp4_trex_invalid");
  return { trackId: u32Positive(bytes, parsed.payloadStart, box.end, "live_fmp4_trex_track_id_invalid"), defaultSampleDuration: bytes.readUInt32BE(parsed.payloadStart + 8), defaultSampleSize: bytes.readUInt32BE(parsed.payloadStart + 12) };
}

export function validateLiveFmp4Init(bytes: Buffer): LiveFmp4InitInfo {
  if (!Buffer.isBuffer(bytes) || bytes.length < 64 || bytes.length > 12 * 1024 * 1024) throw new Error("live_fmp4_init_invalid");
  const top = boxes(bytes); const ftyp = one(top, "ftyp"); const moov = one(top, "moov");
  if (ftyp.start > moov.start || top.some((box) => box.type === "mdat" || box.type === "moof")) throw new Error("live_fmp4_init_structure_invalid");
  validateFtyp(bytes, ftyp);
  const moovChildren = children(bytes, moov); const mvex = one(moovChildren, "mvex"); const trexByTrack = new Map<number, ReturnType<typeof parseTrex>>();
  for (const trexBox of children(bytes, mvex).filter((box) => box.type === "trex")) {
    const trex = parseTrex(bytes, trexBox); if (trexByTrack.has(trex.trackId)) throw new Error("live_fmp4_trex_track_duplicate"); trexByTrack.set(trex.trackId, trex);
  }
  const tracks: LiveFmp4TrackInfo[] = [];
  for (const trak of moovChildren.filter((box) => box.type === "trak")) {
    const trakChildren = children(bytes, trak); const trackId = parseTkhdTrackId(bytes, one(trakChildren, "tkhd"));
    const mdiaChildren = children(bytes, one(trakChildren, "mdia")); const handlerType = parseHandler(bytes, one(mdiaChildren, "hdlr")); const timescale = parseMdhdTimescale(bytes, one(mdiaChildren, "mdhd"));
    const stblChildren = children(bytes, one(children(bytes, one(mdiaChildren, "minf")), "stbl")); validateSampleTables(bytes, stblChildren);
    const codec = parseStsdCodec(bytes, one(stblChildren, "stsd"), handlerType); const trex = trexByTrack.get(trackId);
    if (!trex || tracks.some((track) => track.trackId === trackId)) throw new Error("live_fmp4_track_trex_binding_invalid");
    tracks.push({ trackId, handlerType, timescale, codec, defaultSampleDuration: trex.defaultSampleDuration, defaultSampleSize: trex.defaultSampleSize });
  }
  if (tracks.length < 1 || !tracks.some((track) => track.handlerType === "vide") || tracks.some((track) => track.handlerType === "vide" && !/^avc[13]\.[0-9a-f]{6}$/.test(track.codec)) || trexByTrack.size !== tracks.length) throw new Error("live_fmp4_tracks_invalid");
  tracks.sort((left, right) => left.trackId - right.trackId);
  return { codecs: tracks.map((track) => track.codec), byteLength: bytes.length, tracks };
}

/**
 * Compatibility authority for reusing an already-published protected init
 * after a worker restart.  Container metadata may change between encoder
 * processes, but decoder configuration may not: AVC SPS/PPS (avcC), AAC
 * AudioSpecificConfig (esds), track identity and timing defaults are bound.
 */
export function liveFmp4InitDecoderCompatibilitySha256(bytes: Buffer): string {
  const info = validateLiveFmp4Init(bytes);
  const moov = one(boxes(bytes), "moov");
  const rows = children(bytes, moov).filter((box) => box.type === "trak").map((trak) => {
    const trakChildren = children(bytes, trak);
    const trackId = parseTkhdTrackId(bytes, one(trakChildren, "tkhd"));
    const mdia = one(trakChildren, "mdia");
    const mdiaChildren = children(bytes, mdia);
    const handlerType = parseHandler(bytes, one(mdiaChildren, "hdlr"));
    const minf = one(mdiaChildren, "minf");
    const stbl = one(children(bytes, minf), "stbl");
    const stsd = one(children(bytes, stbl), "stsd");
    const parsed = fullBox(bytes, stsd, [0], 0);
    if (parsed.payloadStart + 4 > stsd.end || bytes.readUInt32BE(parsed.payloadStart) !== 1) throw new Error("live_fmp4_stsd_entry_count_invalid");
    const entry = one(boxes(bytes, parsed.payloadStart + 4, stsd.end), handlerType === "vide" ? (bytes.toString("ascii", parsed.payloadStart + 8, parsed.payloadStart + 12) as "avc1" | "avc3") : "mp4a");
    let configuration: Box;
    if (handlerType === "vide") {
      if (entry.type !== "avc1" && entry.type !== "avc3") throw new Error("live_fmp4_avc_required");
      configuration = one(children(bytes, entry, 78), "avcC");
    } else {
      const version = bytes.readUInt16BE(entry.dataStart + 8);
      const extension = version === 0 ? 0 : version === 1 ? 16 : version === 2 ? 36 : -1;
      if (extension < 0) throw new Error("live_fmp4_audio_sample_entry_invalid");
      configuration = one(children(bytes, entry, 28 + extension), "esds");
    }
    return {
      trackId,
      handlerType,
      sampleEntry: entry.type,
      decoderConfigurationSha256: createHash("sha256").update(bytes.subarray(configuration.start, configuration.end)).digest("hex"),
    };
  }).sort((left, right) => left.trackId - right.trackId);
  const tracks = [...info.tracks].sort((left, right) => left.trackId - right.trackId);
  return createHash("sha256").update(JSON.stringify({ codecs: info.codecs, tracks, decoderConfigurations: rows })).digest("hex");
}

interface TfhdInfo { trackId: number; baseDataOffset: bigint | null; defaultSampleDuration: number; defaultSampleSize: number }
function parseTfhd(bytes: Buffer, box: Box, track: LiveFmp4TrackInfo): TfhdInfo {
  const parsed = fullBox(bytes, box, [0], 0x03003b);
  if ((parsed.flags & 0x010000) !== 0) throw new Error("live_fmp4_tfhd_duration_empty_rejected");
  let offset = parsed.payloadStart; const trackId = u32Positive(bytes, offset, box.end, "live_fmp4_tfhd_track_id_invalid"); offset += 4;
  let baseDataOffset: bigint | null = null;
  if ((parsed.flags & 0x000001) !== 0) { if (offset + 8 > box.end) throw new Error("live_fmp4_tfhd_invalid"); baseDataOffset = bytes.readBigUInt64BE(offset); offset += 8; }
  if ((parsed.flags & 0x000002) !== 0) { if (offset + 4 > box.end || bytes.readUInt32BE(offset) === 0) throw new Error("live_fmp4_tfhd_description_invalid"); offset += 4; }
  let defaultSampleDuration = track.defaultSampleDuration; let defaultSampleSize = track.defaultSampleSize;
  if ((parsed.flags & 0x000008) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_tfhd_invalid"); defaultSampleDuration = bytes.readUInt32BE(offset); offset += 4; }
  if ((parsed.flags & 0x000010) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_tfhd_invalid"); defaultSampleSize = bytes.readUInt32BE(offset); offset += 4; }
  if ((parsed.flags & 0x000020) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_tfhd_invalid"); offset += 4; }
  if (offset !== box.end || trackId !== track.trackId) throw new Error("live_fmp4_tfhd_track_binding_invalid");
  return { trackId, baseDataOffset, defaultSampleDuration, defaultSampleSize };
}
function parseTfdt(bytes: Buffer, box: Box): bigint {
  const parsed = fullBox(bytes, box, [0, 1], 0); const size = parsed.version === 1 ? 8 : 4;
  if (parsed.payloadStart + size !== box.end) throw new Error("live_fmp4_tfdt_invalid");
  return parsed.version === 1 ? bytes.readBigUInt64BE(parsed.payloadStart) : BigInt(bytes.readUInt32BE(parsed.payloadStart));
}
function parseTrun(bytes: Buffer, box: Box, tfhd: TfhdInfo, moof: Box, mdat: Box): { durationTicks: bigint; sampleCount: number; sampleBytes: number; interval: [number, number] } {
  const parsed = fullBox(bytes, box, [0, 1], 0x000f05); let offset = parsed.payloadStart;
  const sampleCount = u32Positive(bytes, offset, box.end, "live_fmp4_trun_sample_count_invalid"); offset += 4;
  if ((parsed.flags & 0x000001) === 0 || offset + 4 > box.end) throw new Error("live_fmp4_trun_data_offset_required");
  const dataOffset = bytes.readInt32BE(offset); offset += 4;
  if ((parsed.flags & 0x000004) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_trun_invalid"); offset += 4; }
  let durationTicks = 0n; let sampleBytes = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    let duration = tfhd.defaultSampleDuration; let size = tfhd.defaultSampleSize;
    if ((parsed.flags & 0x000100) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_trun_invalid"); duration = bytes.readUInt32BE(offset); offset += 4; }
    if ((parsed.flags & 0x000200) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_trun_invalid"); size = bytes.readUInt32BE(offset); offset += 4; }
    if ((parsed.flags & 0x000400) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_trun_invalid"); offset += 4; }
    if ((parsed.flags & 0x000800) !== 0) { if (offset + 4 > box.end) throw new Error("live_fmp4_trun_invalid"); offset += 4; }
    if (duration === 0 || size === 0 || sampleBytes + size > MAX_BOX_BYTES) throw new Error("live_fmp4_trun_sample_defaults_invalid");
    durationTicks += BigInt(duration); sampleBytes += size;
  }
  if (offset !== box.end) throw new Error("live_fmp4_trun_bounds_invalid");
  const beginBig = (tfhd.baseDataOffset === null ? BigInt(moof.start) : tfhd.baseDataOffset) + BigInt(dataOffset);
  if (beginBig < BigInt(mdat.dataStart) || beginBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("live_fmp4_trun_data_offset_invalid");
  const begin = Number(beginBig); const end = begin + sampleBytes;
  if (end <= begin || end > mdat.end) throw new Error("live_fmp4_trun_mdat_bounds_invalid");
  return { durationTicks, sampleCount, sampleBytes, interval: [begin, end] };
}

export function validateLiveFmp4Fragment(bytes: Buffer, init?: LiveFmp4InitInfo): LiveFmp4FragmentInfo {
  if (!Buffer.isBuffer(bytes) || bytes.length < 64 || bytes.length > 12 * 1024 * 1024 || !init || init.tracks.length < 1) throw new Error("live_fmp4_fragment_invalid");
  const top = boxes(bytes); const moofIndex = top.findIndex((box) => box.type === "moof"); const allowedPrefix = new Set(["styp", "sidx", "prft", "emsg", "free", "skip"]);
  if (moofIndex < 0 || top[moofIndex + 1]?.type !== "mdat" || top.slice(0, moofIndex).some((box) => !allowedPrefix.has(box.type)) || top.slice(moofIndex + 2).some((box) => box.type !== "free" && box.type !== "skip")) throw new Error("live_fmp4_fragment_structure_invalid");
  const moof = top[moofIndex] as Box; const mdat = top[moofIndex + 1] as Box;
  if (mdat.end <= mdat.dataStart) throw new Error("live_fmp4_mdat_empty");
  const moofChildren = children(bytes, moof); const mfhd = one(moofChildren, "mfhd"); const mfhdFull = fullBox(bytes, mfhd, [0], 0);
  if (mfhdFull.payloadStart + 4 !== mfhd.end) throw new Error("live_fmp4_mfhd_invalid");
  const mfhdSequence = u32Positive(bytes, mfhdFull.payloadStart, mfhd.end, "live_fmp4_mfhd_sequence_invalid");
  const trackById = new Map(init.tracks.map((track) => [track.trackId, track])); const parsedTracks: LiveFmp4FragmentTrackInfo[] = []; const intervals: Array<[number, number]> = [];
  for (const traf of moofChildren.filter((box) => box.type === "traf")) {
    const trafChildren = children(bytes, traf); const tfhdBox = one(trafChildren, "tfhd"); const tfhdProbe = fullBox(bytes, tfhdBox, [0], 0x03003b);
    const trackId = u32Positive(bytes, tfhdProbe.payloadStart, tfhdBox.end, "live_fmp4_tfhd_track_id_invalid"); const track = trackById.get(trackId);
    if (!track || parsedTracks.some((item) => item.trackId === trackId)) throw new Error("live_fmp4_fragment_track_binding_invalid");
    const tfhd = parseTfhd(bytes, tfhdBox, track); const baseDecodeTime = parseTfdt(bytes, one(trafChildren, "tfdt")); const truns = trafChildren.filter((box) => box.type === "trun");
    if (truns.length < 1) throw new Error("live_fmp4_trun_required");
    let durationTicks = 0n; let sampleCount = 0; let sampleBytes = 0;
    for (const trun of truns) { const parsed = parseTrun(bytes, trun, tfhd, moof, mdat); durationTicks += parsed.durationTicks; sampleCount += parsed.sampleCount; sampleBytes += parsed.sampleBytes; intervals.push(parsed.interval); }
    const durationMs = Math.max(1, Math.round(Number(durationTicks * 1000n) / track.timescale));
    parsedTracks.push({ trackId, baseDecodeTime, durationTicks, durationMs, sampleCount, sampleBytes });
  }
  if (parsedTracks.length !== init.tracks.length) throw new Error("live_fmp4_fragment_track_set_invalid");
  intervals.sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < intervals.length; index += 1) if ((intervals[index - 1] as [number, number])[1] > (intervals[index] as [number, number])[0]) throw new Error("live_fmp4_fragment_sample_overlap");
  if (intervals.reduce((sum, interval) => sum + interval[1] - interval[0], 0) !== mdat.end - mdat.dataStart) throw new Error("live_fmp4_fragment_mdat_unbound_bytes");
  parsedTracks.sort((left, right) => left.trackId - right.trackId);
  const primary = parsedTracks.find((item) => trackById.get(item.trackId)?.handlerType === "vide") as LiveFmp4FragmentTrackInfo;
  return { mfhdSequence, baseDecodeTime: primary.baseDecodeTime, durationMs: Math.max(...parsedTracks.map((track) => track.durationMs)), byteLength: bytes.length, tracks: parsedTracks };
}
