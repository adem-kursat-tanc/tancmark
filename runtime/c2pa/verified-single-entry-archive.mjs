// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, open, readFile, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { crc32 } from "node:zlib";
import unzipper from "unzipper";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const MAX_PINNED_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_PINNED_BINARY_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 64;
const OPEN_TIMEOUT_MS = 10_000;
const FORBIDDEN_UNIX_EXTRA_FIELDS = new Set([0x000d, 0x756e]);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafePositiveInteger(value, maximum, errorCode) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) throw new Error(errorCode);
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength !== bytes.length) continue;
    return offset;
  }
  throw new Error("c2pa_native_archive_end_record_invalid");
}

function parseExtraFieldIds(bytes) {
  const ids = [];
  let offset = 0;
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) throw new Error("c2pa_native_archive_extra_field_invalid");
    const id = bytes.readUInt16LE(offset);
    const size = bytes.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + size > bytes.length) throw new Error("c2pa_native_archive_extra_field_invalid");
    ids.push(id);
    offset += size;
  }
  return ids;
}

function validateCentralDirectory(bytes, expectedEntryPath) {
  const endOffset = findEndOfCentralDirectory(bytes);
  const diskNumber = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const recordsOnDisk = bytes.readUInt16LE(endOffset + 8);
  const totalRecords = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || recordsOnDisk !== 1 || totalRecords !== 1) {
    throw new Error("c2pa_native_archive_record_count_invalid");
  }
  if (centralOffset + centralSize !== endOffset || centralOffset + 46 > endOffset) {
    throw new Error("c2pa_native_archive_central_directory_bounds_invalid");
  }
  if (bytes.readUInt32LE(centralOffset) !== CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error("c2pa_native_archive_central_directory_signature_invalid");
  }
  const fileNameLength = bytes.readUInt16LE(centralOffset + 28);
  const extraLength = bytes.readUInt16LE(centralOffset + 30);
  const commentLength = bytes.readUInt16LE(centralOffset + 32);
  const recordEnd = centralOffset + 46 + fileNameLength + extraLength + commentLength;
  if (recordEnd !== endOffset) throw new Error("c2pa_native_archive_central_directory_shape_invalid");
  const fileName = bytes.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength);
  if (!fileName.equals(Buffer.from(expectedEntryPath, "utf8"))) {
    throw new Error("c2pa_native_archive_entry_path_invalid");
  }
  const extra = bytes.subarray(centralOffset + 46 + fileNameLength, centralOffset + 46 + fileNameLength + extraLength);
  for (const id of parseExtraFieldIds(extra)) {
    if (FORBIDDEN_UNIX_EXTRA_FIELDS.has(id)) throw new Error("c2pa_native_archive_link_metadata_forbidden");
  }
  return { centralOffset };
}

function validateEntryMetadata(bytes, entry, expectedEntryPath, expectedBinaryBytes, centralOffset) {
  if (entry.path !== expectedEntryPath || !Buffer.from(entry.pathBuffer || []).equals(Buffer.from(expectedEntryPath, "utf8"))) {
    throw new Error("c2pa_native_archive_entry_path_invalid");
  }
  if (entry.type !== "File") throw new Error("c2pa_native_archive_entry_type_invalid");
  if (entry.flags !== 0) throw new Error("c2pa_native_archive_entry_flags_invalid");
  if (entry.compressionMethod !== 8) throw new Error("c2pa_native_archive_compression_method_invalid");
  if (entry.uncompressedSize !== expectedBinaryBytes) throw new Error("c2pa_native_archive_declared_size_mismatch");
  assertSafePositiveInteger(entry.compressedSize, bytes.length, "c2pa_native_archive_compressed_size_invalid");
  if (entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO) {
    throw new Error("c2pa_native_archive_compression_ratio_exceeded");
  }

  const hostSystem = entry.versionMadeBy >>> 8;
  const externalAttributes = entry.externalFileAttributes >>> 0;
  if ((externalAttributes & 0x10) !== 0) throw new Error("c2pa_native_archive_directory_metadata_forbidden");
  if (hostSystem === 3) {
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const unixType = unixMode & 0o170000;
    if (unixType !== 0 && unixType !== 0o100000) throw new Error("c2pa_native_archive_link_metadata_forbidden");
  }

  const localOffset = entry.offsetToLocalFileHeader;
  if (!Number.isSafeInteger(localOffset) || localOffset < 0 || localOffset + 30 > bytes.length) {
    throw new Error("c2pa_native_archive_local_header_bounds_invalid");
  }
  if (bytes.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error("c2pa_native_archive_local_header_signature_invalid");
  }
  const localFlags = bytes.readUInt16LE(localOffset + 6);
  const localMethod = bytes.readUInt16LE(localOffset + 8);
  const localCrc = bytes.readUInt32LE(localOffset + 14);
  const localCompressedSize = bytes.readUInt32LE(localOffset + 18);
  const localUncompressedSize = bytes.readUInt32LE(localOffset + 22);
  const localNameLength = bytes.readUInt16LE(localOffset + 26);
  const localExtraLength = bytes.readUInt16LE(localOffset + 28);
  const localNameStart = localOffset + 30;
  const localNameEnd = localNameStart + localNameLength;
  const dataStart = localNameEnd + localExtraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > centralOffset || localNameEnd > bytes.length) throw new Error("c2pa_native_archive_local_data_bounds_invalid");
  if (!bytes.subarray(localNameStart, localNameEnd).equals(Buffer.from(expectedEntryPath, "utf8"))) {
    throw new Error("c2pa_native_archive_local_entry_path_invalid");
  }
  if (localFlags !== entry.flags || localMethod !== entry.compressionMethod || localCrc !== entry.crc32
      || localCompressedSize !== entry.compressedSize || localUncompressedSize !== entry.uncompressedSize) {
    throw new Error("c2pa_native_archive_local_central_metadata_mismatch");
  }
}

async function openBoundedArchive(bytes) {
  let timer;
  try {
    return await Promise.race([
      unzipper.Open.buffer(bytes),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("c2pa_native_archive_open_timeout")), OPEN_TIMEOUT_MS);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readBoundedEntry(entry, expectedBytes) {
  const chunks = [];
  let total = 0;
  const stream = entry.stream();
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > expectedBytes) {
      stream.destroy();
      throw new Error("c2pa_native_archive_stream_limit_exceeded");
    }
    chunks.push(chunk);
  }
  if (total !== expectedBytes) throw new Error("c2pa_native_archive_stream_size_mismatch");
  return Buffer.concat(chunks, total);
}

export async function readVerifiedSingleEntryArchive(bytes, profile, expectedEntryPath = "index.node") {
  if (!Buffer.isBuffer(bytes)) throw new Error("c2pa_native_archive_buffer_required");
  assertSafePositiveInteger(profile.archiveBytes, MAX_PINNED_ARCHIVE_BYTES, "c2pa_native_archive_expected_size_invalid");
  assertSafePositiveInteger(profile.binaryBytes, MAX_PINNED_BINARY_BYTES, "c2pa_native_binary_expected_size_invalid");
  if (bytes.length !== profile.archiveBytes || sha256(bytes) !== profile.archiveSha256) {
    throw new Error("c2pa_native_archive_hash_or_size_mismatch");
  }
  const { centralOffset } = validateCentralDirectory(bytes, expectedEntryPath);
  const archive = await openBoundedArchive(bytes);
  if (archive.files.length !== 1) throw new Error("c2pa_native_archive_record_count_invalid");
  const entry = archive.files[0];
  validateEntryMetadata(bytes, entry, expectedEntryPath, profile.binaryBytes, centralOffset);
  const binary = await readBoundedEntry(entry, profile.binaryBytes);
  if ((crc32(binary) >>> 0) !== (entry.crc32 >>> 0)) throw new Error("c2pa_native_archive_crc_mismatch");
  if (sha256(binary) !== profile.binarySha256) throw new Error("c2pa_native_binary_hash_or_size_mismatch");
  return binary;
}

export async function exactFile(pathname, expectedBytes, expectedSha256) {
  try {
    const info = await stat(pathname);
    if (!info.isFile() || info.size !== expectedBytes) return false;
    return sha256(await readFile(pathname)) === expectedSha256;
  } catch {
    return false;
  }
}

export async function installVerifiedBinaryAtFixedPath({
  targetPath,
  binary,
  expectedBytes,
  expectedSha256,
  beforeCommit,
  beforeAtomicLink,
  afterCommit,
}) {
  if (!path.isAbsolute(targetPath)) throw new Error("c2pa_native_target_path_must_be_absolute");
  if (!Buffer.isBuffer(binary) || binary.length !== expectedBytes || sha256(binary) !== expectedSha256) {
    throw new Error("c2pa_native_binary_hash_or_size_mismatch");
  }
  const parent = path.dirname(targetPath);
  await mkdir(parent, { recursive: true });
  const tempRoot = await mkdtemp(path.join(parent, ".tancmark-native-"));
  const tempPath = path.join(tempRoot, "index.node");
  try {
    const handle = await open(tempPath, "wx", 0o755);
    try {
      await handle.writeFile(binary);
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (!await exactFile(tempPath, expectedBytes, expectedSha256)) {
      throw new Error("c2pa_native_temp_verification_failed");
    }
    await beforeCommit?.();
    try {
      await unlink(targetPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await beforeAtomicLink?.();
    await link(tempPath, targetPath);
    if (!await exactFile(targetPath, expectedBytes, expectedSha256)) {
      try { await unlink(targetPath); } catch {}
      throw new Error("c2pa_native_postwrite_verification_failed");
    }
    await afterCommit?.();
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
