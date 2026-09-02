import type { LiveFmp4FragmentTrackInfo } from "./liveFmp4Validator";

interface Box { type: string; start: number; dataStart: number; end: number }
interface TrackDurationLayout { trackId: number; defaultDurationOffset: number | null; sampleDurationOffsets: Array<number | null>; sampleDurations: number[] }

function boxes(bytes: Buffer, start = 0, end = bytes.length): Box[] {
  const result: Box[] = [];
  for (let offset = start; offset < end;) {
    if (offset + 8 > end) throw new Error("live_protected_fragment_box_truncated");
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error("live_protected_fragment_box_truncated");
      const large = bytes.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("live_protected_fragment_box_too_large");
      size = Number(large);
      header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) throw new Error("live_protected_fragment_box_bounds_invalid");
    result.push({ type, start: offset, dataStart: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}

function exactlyOne(items: readonly Box[], type: string): Box {
  const matches = items.filter((item) => item.type === type);
  if (matches.length !== 1) throw new Error(`live_protected_fragment_${type}_invalid`);
  return matches[0] as Box;
}

function fullBox(bytes: Buffer, box: Box): { version: number; flags: number; payload: number } {
  if (box.dataStart + 4 > box.end) throw new Error(`live_protected_fragment_${box.type}_invalid`);
  return { version: bytes[box.dataStart] as number, flags: bytes.readUIntBE(box.dataStart + 1, 3), payload: box.dataStart + 4 };
}

function durationLayouts(bytes: Buffer): Map<number, TrackDurationLayout> {
  const moof = exactlyOne(boxes(bytes), "moof");
  const result = new Map<number, TrackDurationLayout>();
  for (const traf of boxes(bytes, moof.dataStart, moof.end).filter((item) => item.type === "traf")) {
    const children = boxes(bytes, traf.dataStart, traf.end);
    const tfhd = exactlyOne(children, "tfhd");
    const header = fullBox(bytes, tfhd);
    let offset = header.payload;
    if (offset + 4 > tfhd.end) throw new Error("live_protected_fragment_tfhd_invalid");
    const trackId = bytes.readUInt32BE(offset); offset += 4;
    if ((header.flags & 0x000001) !== 0) offset += 8;
    if ((header.flags & 0x000002) !== 0) offset += 4;
    const defaultDurationOffset = (header.flags & 0x000008) !== 0 ? offset : null;
    let defaultDuration: number | null = null;
    if (defaultDurationOffset !== null) { if (offset + 4 > tfhd.end) throw new Error("live_protected_fragment_tfhd_invalid"); defaultDuration = bytes.readUInt32BE(offset); offset += 4; }
    if ((header.flags & 0x000010) !== 0) offset += 4;
    if ((header.flags & 0x000020) !== 0) offset += 4;
    if (offset !== tfhd.end || result.has(trackId)) throw new Error("live_protected_fragment_tfhd_invalid");
    const sampleDurationOffsets: Array<number | null> = [];
    const sampleDurations: number[] = [];
    for (const trun of children.filter((item) => item.type === "trun")) {
      const trunHeader = fullBox(bytes, trun);
      let cursor = trunHeader.payload;
      if (cursor + 4 > trun.end) throw new Error("live_protected_fragment_trun_invalid");
      const sampleCount = bytes.readUInt32BE(cursor); cursor += 4;
      if ((trunHeader.flags & 0x000001) !== 0) cursor += 4;
      if ((trunHeader.flags & 0x000004) !== 0) cursor += 4;
      for (let index = 0; index < sampleCount; index += 1) {
        let durationOffset: number | null = null;
        let duration = defaultDuration;
        if ((trunHeader.flags & 0x000100) !== 0) { durationOffset = cursor; if (cursor + 4 > trun.end) throw new Error("live_protected_fragment_trun_invalid"); duration = bytes.readUInt32BE(cursor); cursor += 4; }
        if ((trunHeader.flags & 0x000200) !== 0) cursor += 4;
        if ((trunHeader.flags & 0x000400) !== 0) cursor += 4;
        if ((trunHeader.flags & 0x000800) !== 0) cursor += 4;
        if (!duration || cursor > trun.end) throw new Error("live_protected_fragment_duration_not_explicit");
        sampleDurationOffsets.push(durationOffset);
        sampleDurations.push(duration);
      }
      if (cursor !== trun.end) throw new Error("live_protected_fragment_trun_invalid");
    }
    if (sampleDurations.length < 1) throw new Error("live_protected_fragment_trun_invalid");
    result.set(trackId, { trackId, defaultDurationOffset, sampleDurationOffsets, sampleDurations });
  }
  return result;
}

function restoreSampleDurations(output: Buffer, source: Buffer): void {
  const sourceLayouts = durationLayouts(source);
  const outputLayouts = durationLayouts(output);
  if (sourceLayouts.size !== outputLayouts.size) throw new Error("live_protected_fragment_duration_track_set_invalid");
  for (const [trackId, sourceLayout] of sourceLayouts) {
    const target = outputLayouts.get(trackId);
    if (!target || target.sampleDurations.length !== sourceLayout.sampleDurations.length) throw new Error("live_protected_fragment_duration_sample_set_invalid");
    const allSame = sourceLayout.sampleDurations.every((value) => value === sourceLayout.sampleDurations[0]);
    if (target.sampleDurationOffsets.every((value) => value === null)) {
      if (!allSame || target.defaultDurationOffset === null) throw new Error("live_protected_fragment_duration_layout_incompatible");
      output.writeUInt32BE(sourceLayout.sampleDurations[0] as number, target.defaultDurationOffset);
      continue;
    }
    for (let index = 0; index < target.sampleDurationOffsets.length; index += 1) {
      const durationOffset = target.sampleDurationOffsets[index];
      if (durationOffset === null) throw new Error("live_protected_fragment_duration_layout_incompatible");
      output.writeUInt32BE(sourceLayout.sampleDurations[index] as number, durationOffset);
    }
  }
}

/**
 * Adapter C preserves decoded frame PTS inside each worker input. The MP4
 * fragment muxer still starts every independent temporary file with mfhd=1.
 * Restore only the authoritative source sequence/tfdt fields. No payload,
 * sample, codec, duration, offset or watermark byte is changed.
 */
export function restoreProtectedFragmentTimeline(input: {
  fragment: Buffer;
  mfhdSequence: number;
  sourceTracks: readonly LiveFmp4FragmentTrackInfo[];
  sourceFragment?: Buffer;
}): Buffer {
  if (!Number.isSafeInteger(input.mfhdSequence) || input.mfhdSequence < 1) {
    throw new Error("live_protected_fragment_sequence_invalid");
  }
  const output = Buffer.from(input.fragment);
  const top = boxes(output);
  const moof = exactlyOne(top, "moof");
  const moofChildren = boxes(output, moof.dataStart, moof.end);
  const mfhd = exactlyOne(moofChildren, "mfhd");
  if (mfhd.dataStart + 8 !== mfhd.end || output[mfhd.dataStart] !== 0) {
    throw new Error("live_protected_fragment_mfhd_invalid");
  }
  output.writeUInt32BE(input.mfhdSequence, mfhd.dataStart + 4);
  const sourceByTrack = new Map(input.sourceTracks.map((track) => [track.trackId, track]));
  const seen = new Set<number>();
  for (const traf of moofChildren.filter((item) => item.type === "traf")) {
    const children = boxes(output, traf.dataStart, traf.end);
    const tfhd = exactlyOne(children, "tfhd");
    if (tfhd.dataStart + 8 > tfhd.end) throw new Error("live_protected_fragment_tfhd_invalid");
    const trackId = output.readUInt32BE(tfhd.dataStart + 4);
    const source = sourceByTrack.get(trackId);
    if (!source || seen.has(trackId)) throw new Error("live_protected_fragment_track_binding_invalid");
    seen.add(trackId);
    const tfdt = exactlyOne(children, "tfdt");
    const version = output[tfdt.dataStart];
    const payload = tfdt.dataStart + 4;
    if (version === 0) {
      if (payload + 4 !== tfdt.end || source.baseDecodeTime > 0xffff_ffffn) {
        throw new Error("live_protected_fragment_tfdt_v0_overflow");
      }
      output.writeUInt32BE(Number(source.baseDecodeTime), payload);
    } else if (version === 1) {
      if (payload + 8 !== tfdt.end) throw new Error("live_protected_fragment_tfdt_invalid");
      output.writeBigUInt64BE(source.baseDecodeTime, payload);
    } else throw new Error("live_protected_fragment_tfdt_version_invalid");
  }
  if (seen.size !== sourceByTrack.size) throw new Error("live_protected_fragment_track_set_invalid");
  if (input.sourceFragment) restoreSampleDurations(output, input.sourceFragment);
  return output;
}
