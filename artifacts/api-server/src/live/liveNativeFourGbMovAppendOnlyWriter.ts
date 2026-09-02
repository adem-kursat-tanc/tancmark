import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export const LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_VERSION =
  "live-native-four-gb-mov-append-only-writer-v0.1" as const;

export const LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_DECISION_ROLE =
  "live_native_four_gb_mov_append_only_writer_support_only_no_vault_no_confirmed" as const;

const FOUR_GB_BOUNDARY = 0xffffffff;
const STREAM_CHUNK_BYTES = 8 * 1024 * 1024;
const TANCMARK_UUID = Buffer.from("TANCMARKMOVPROOF", "ascii");

export interface NativeFourGbMovTopLevelBox {
  offset: number;
  size: number;
  headerSize: 8 | 16;
  type: string;
}

export interface NativeFourGbMovProofBox {
  found: boolean;
  offset: number | null;
  size: number | null;
  type: "uuid";
  uuid: "TANCMARKMOVPROOF";
  payload: Record<string, unknown> | null;
}

export interface NativeFourGbMovAppendOnlyWriterResult {
  ok: boolean;
  status: "sealed" | "rejected" | "error";
  reason: string;
  version: typeof LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_VERSION;
  decisionRole: typeof LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_DECISION_ROLE;
  sourcePath: string;
  outputPath: string;
  sourceSizeBytes: number;
  outputSizeBytes: number | null;
  appendedBytes: number | null;
  crossesFourGbBoundary: boolean;
  usesStreamingRead: true;
  usesStreamingWrite: true;
  buffersWholeFile: false;
  maxChunkBytes: number;
  sourceIntact: true;
  outputCopyOnly: boolean;
  prefixBytesPreserved: boolean;
  proofBoxReadback: NativeFourGbMovProofBox;
  topLevelBoxes: NativeFourGbMovTopLevelBox[];
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

function emptyProofBox(): NativeFourGbMovProofBox {
  return {
    found: false,
    offset: null,
    size: null,
    type: "uuid",
    uuid: "TANCMARKMOVPROOF",
    payload: null,
  };
}

function resultBase(
  sourcePath: string,
  outputPath: string,
  sourceSizeBytes: number,
): Omit<
  NativeFourGbMovAppendOnlyWriterResult,
  "ok" | "status" | "reason" | "outputSizeBytes" | "appendedBytes" | "outputCopyOnly" | "prefixBytesPreserved"
> {
  return {
    version: LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_VERSION,
    decisionRole: LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_DECISION_ROLE,
    sourcePath,
    outputPath,
    sourceSizeBytes,
    crossesFourGbBoundary: sourceSizeBytes > FOUR_GB_BOUNDARY,
    usesStreamingRead: true,
    usesStreamingWrite: true,
    buffersWholeFile: false,
    maxChunkBytes: STREAM_CHUNK_BYTES,
    sourceIntact: true,
    proofBoxReadback: emptyProofBox(),
    topLevelBoxes: [],
    ...safetyEnvelope(),
  };
}

function fail(
  sourcePath: string,
  outputPath: string,
  sourceSizeBytes: number,
  reason: string,
): NativeFourGbMovAppendOnlyWriterResult {
  return {
    ...resultBase(sourcePath, outputPath, sourceSizeBytes),
    ok: false,
    status: "rejected",
    reason,
    outputSizeBytes: null,
    appendedBytes: null,
    outputCopyOnly: false,
    prefixBytesPreserved: false,
  };
}

function readAt(filePath: string, offset: number, length: number): Buffer {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function isMovLikeHeader(filePath: string): boolean {
  const header = readAt(filePath, 0, 16);
  return header.length >= 8 && header.subarray(4, 8).toString("ascii") === "ftyp";
}

export function buildTancmarkMovProofBox(payload: Record<string, unknown>): Buffer {
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  const size = 8 + TANCMARK_UUID.length + payloadBytes.length;
  if (size > 0xffffffff) {
    throw new Error("proof_box_too_large");
  }

  const box = Buffer.alloc(size);
  box.writeUInt32BE(size, 0);
  box.write("uuid", 4, 4, "ascii");
  TANCMARK_UUID.copy(box, 8);
  payloadBytes.copy(box, 8 + TANCMARK_UUID.length);
  return box;
}

export function scanMovTopLevelBoxes(filePath: string): NativeFourGbMovTopLevelBox[] {
  const fileSize = fs.statSync(filePath).size;
  const boxes: NativeFourGbMovTopLevelBox[] = [];
  let offset = 0;

  while (offset + 8 <= fileSize && boxes.length < 256) {
    const header = readAt(filePath, offset, 16);
    if (header.length < 8) break;

    const size32 = header.readUInt32BE(0);
    const type = header.subarray(4, 8).toString("ascii");
    let size = size32;
    let headerSize: 8 | 16 = 8;

    if (size32 === 1) {
      if (header.length < 16) break;
      const size64 = header.readBigUInt64BE(8);
      if (size64 > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(size64);
      headerSize = 16;
    } else if (size32 === 0) {
      size = fileSize - offset;
    }

    if (size < headerSize || offset + size > fileSize) break;
    boxes.push({ offset, size, headerSize, type });
    offset += size;
  }

  return boxes;
}

export function readTancmarkMovProofBox(filePath: string): NativeFourGbMovProofBox {
  const boxes = scanMovTopLevelBoxes(filePath);

  for (const box of boxes) {
    if (box.type !== "uuid") continue;
    const uuidOffset = box.offset + box.headerSize;
    const uuid = readAt(filePath, uuidOffset, TANCMARK_UUID.length);
    if (!uuid.equals(TANCMARK_UUID)) continue;

    const payloadOffset = uuidOffset + TANCMARK_UUID.length;
    const payloadLength = box.size - box.headerSize - TANCMARK_UUID.length;
    if (payloadLength < 0 || payloadLength > 1024 * 1024) continue;

    try {
      const payloadRaw = readAt(filePath, payloadOffset, payloadLength).toString("utf8");
      const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
      return {
        found: true,
        offset: box.offset,
        size: box.size,
        type: "uuid",
        uuid: "TANCMARKMOVPROOF",
        payload,
      };
    } catch {
      return {
        found: true,
        offset: box.offset,
        size: box.size,
        type: "uuid",
        uuid: "TANCMARKMOVPROOF",
        payload: null,
      };
    }
  }

  return emptyProofBox();
}

export function sha256FileRange(filePath: string, offset: number, length: number): string {
  const stat = fs.statSync(filePath);
  if (offset < 0 || length < 0 || offset + length > stat.size) {
    throw new Error("range_out_of_bounds");
  }

  const hash = createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(Math.min(STREAM_CHUNK_BYTES, Math.max(1, length)));
    let remaining = length;
    let position = offset;

    while (remaining > 0) {
      const bytesRead = fs.readSync(fd, buffer, 0, Math.min(buffer.length, remaining), position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      remaining -= bytesRead;
      position += bytesRead;
    }

    if (remaining !== 0) {
      throw new Error("range_read_incomplete");
    }
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest("hex").toUpperCase();
}

export function sha256File(filePath: string): string {
  return sha256FileRange(filePath, 0, fs.statSync(filePath).size);
}

export async function sealLargeMovAppendOnly(
  sourcePath: string,
  outputPath: string,
  proofPayload: Record<string, unknown>,
): Promise<NativeFourGbMovAppendOnlyWriterResult> {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedOutput = path.resolve(outputPath);

  if (resolvedSource === resolvedOutput) {
    return fail(resolvedSource, resolvedOutput, 0, "source_and_output_must_differ");
  }
  if (!fs.existsSync(resolvedSource)) {
    return fail(resolvedSource, resolvedOutput, 0, "source_missing");
  }

  const sourceBefore = fs.statSync(resolvedSource);
  const sourceSize = sourceBefore.size;
  if (sourceSize <= FOUR_GB_BOUNDARY) {
    return fail(resolvedSource, resolvedOutput, sourceSize, "source_must_cross_4gb_boundary");
  }
  if (!isMovLikeHeader(resolvedSource)) {
    return fail(resolvedSource, resolvedOutput, sourceSize, "source_not_mov_like_ftyp");
  }

  const proofBox = buildTancmarkMovProofBox({
    ...proofPayload,
    writerVersion: LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_VERSION,
    decisionRole: LIVE_NATIVE_FOUR_GB_MOV_APPEND_ONLY_WRITER_DECISION_ROLE,
    sourceSizeBytes: sourceSize,
    mediaPayloadModified: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  });

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const tempPath = `${resolvedOutput}.tmp-${process.pid}`;
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(resolvedOutput)) fs.unlinkSync(resolvedOutput);

    await pipeline(
      fs.createReadStream(resolvedSource, { highWaterMark: STREAM_CHUNK_BYTES }),
      fs.createWriteStream(tempPath, { flags: "wx", highWaterMark: STREAM_CHUNK_BYTES }),
    );

    fs.appendFileSync(tempPath, proofBox);
    fs.renameSync(tempPath, resolvedOutput);

    const outputStat = fs.statSync(resolvedOutput);
    const sourceAfter = fs.statSync(resolvedSource);
    const proofBoxReadback = readTancmarkMovProofBox(resolvedOutput);
    const topLevelBoxes = scanMovTopLevelBoxes(resolvedOutput);

    const sourceIntact =
      sourceBefore.size === sourceAfter.size &&
      sourceBefore.mtimeMs === sourceAfter.mtimeMs;
    const outputCopyOnly = outputStat.size === sourceSize + proofBox.length;
    const prefixBytesPreserved =
      sha256FileRange(resolvedSource, 0, Math.min(STREAM_CHUNK_BYTES, sourceSize)) ===
      sha256FileRange(resolvedOutput, 0, Math.min(STREAM_CHUNK_BYTES, sourceSize));

    return {
      ...resultBase(resolvedSource, resolvedOutput, sourceSize),
      ok: sourceIntact && outputCopyOnly && prefixBytesPreserved && proofBoxReadback.found,
      status: sourceIntact && outputCopyOnly && prefixBytesPreserved && proofBoxReadback.found ? "sealed" : "error",
      reason: sourceIntact && outputCopyOnly && prefixBytesPreserved && proofBoxReadback.found
        ? "native_4gb_mov_append_only_output_written_and_read_back"
        : "native_4gb_mov_append_only_output_verification_failed",
      outputSizeBytes: outputStat.size,
      appendedBytes: proofBox.length,
      outputCopyOnly,
      prefixBytesPreserved,
      proofBoxReadback,
      topLevelBoxes,
    };
  } catch {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return {
      ...fail(resolvedSource, resolvedOutput, sourceSize, "writer_error"),
      status: "error",
    };
  }
}
