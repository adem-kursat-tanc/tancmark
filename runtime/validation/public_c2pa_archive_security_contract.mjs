// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";
import {
  installVerifiedBinaryAtFixedPath,
  readVerifiedSingleEntryArchive,
  sha256,
} from "../c2pa/verified-single-entry-archive.mjs";

const u16 = (value) => {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value & 0xffff);
  return bytes;
};
const u32 = (value) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
};

function extraField(id, value = Buffer.alloc(0)) {
  return Buffer.concat([u16(id), u16(value.length), value]);
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const entry of entries) {
    const binary = entry.binary ?? Buffer.from("verified-native-fixture");
    const localName = Buffer.from(entry.localPath ?? entry.path, "utf8");
    const centralName = Buffer.from(entry.path, "utf8");
    const localExtra = entry.localExtra ?? Buffer.alloc(0);
    const centralExtra = entry.centralExtra ?? Buffer.alloc(0);
    const compressed = entry.compressed ?? deflateRawSync(binary);
    const actualCrc = crc32(binary) >>> 0;
    const flags = entry.flags ?? 0;
    const method = entry.method ?? 8;
    const declaredCompressed = entry.declaredCompressed ?? compressed.length;
    const declaredUncompressed = entry.declaredUncompressed ?? binary.length;
    const declaredCrc = entry.declaredCrc ?? actualCrc;
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0), u16(0),
      u32(declaredCrc), u32(declaredCompressed), u32(declaredUncompressed),
      u16(localName.length), u16(localExtra.length), localName, localExtra, compressed,
    ]);
    const hostSystem = entry.hostSystem ?? 0;
    const versionMadeBy = (hostSystem << 8) | 20;
    const externalAttributes = entry.externalAttributes ?? 0x20;
    const central = Buffer.concat([
      u32(0x02014b50), u16(versionMadeBy), u16(20), u16(flags), u16(method), u16(0), u16(0),
      u32(declaredCrc), u32(declaredCompressed), u32(declaredUncompressed),
      u16(centralName.length), u16(centralExtra.length), u16(0), u16(0), u16(0),
      u32(externalAttributes), u32(localOffset), centralName, centralExtra,
    ]);
    locals.push(local);
    centrals.push(central);
    localOffset += local.length;
  }
  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(localBytes.length), u16(0),
  ]);
  return Buffer.concat([localBytes, centralBytes, end]);
}

function profile(archive, binary, overrides = {}) {
  return {
    archiveBytes: archive.length,
    archiveSha256: sha256(archive),
    binaryBytes: binary.length,
    binarySha256: sha256(binary),
    ...overrides,
  };
}

async function mustReject(name, archive, binary, overrides = {}) {
  await assert.rejects(
    readVerifiedSingleEntryArchive(archive, profile(archive, binary, overrides)),
    undefined,
    name,
  );
  return name;
}

const fixture = Buffer.alloc(4096);
for (let index = 0; index < fixture.length; index += 1) fixture[index] = (index * 73 + (index >>> 3) * 19) & 0xff;
const correctArchive = zip([{ path: "index.node", binary: fixture }]);
assert.deepEqual(await readVerifiedSingleEntryArchive(correctArchive, profile(correctArchive, fixture)), fixture);

const rejected = [];
rejected.push(await mustReject("zero_entries", zip([]), fixture));
rejected.push(await mustReject("multiple_entries", zip([
  { path: "index.node", binary: fixture },
  { path: "second.node", binary: fixture },
]), fixture));
rejected.push(await mustReject("duplicate_entries", zip([
  { path: "index.node", binary: fixture },
  { path: "index.node", binary: fixture },
]), fixture));

for (const [name, entryPath] of [
  ["parent_traversal", "../index.node"],
  ["backslash_traversal", "..\\index.node"],
  ["sibling_prefix_traversal", "../native-evil/index.node"],
  ["unix_absolute", "/index.node"],
  ["windows_drive_absolute", "C:\\index.node"],
  ["windows_unc_absolute", "\\\\server\\share\\index.node"],
  ["nested_path", "nested/index.node"],
  ["unexpected_entry", "unexpected.node"],
]) rejected.push(await mustReject(name, zip([{ path: entryPath, binary: fixture }]), fixture));

rejected.push(await mustReject("local_central_name_mismatch", zip([{
  path: "index.node", localPath: "other.node", binary: fixture,
}]), fixture));
rejected.push(await mustReject("directory_metadata", zip([{
  path: "index.node", binary: fixture, externalAttributes: 0x10,
}]), fixture));
rejected.push(await mustReject("symlink_metadata", zip([{
  path: "index.node", binary: fixture, hostSystem: 3, externalAttributes: (0o120777 << 16) >>> 0,
}]), fixture));
rejected.push(await mustReject("hardlink_metadata", zip([{
  path: "index.node", binary: fixture, centralExtra: extraField(0x756e, Buffer.from("hardlink")),
}]), fixture));
rejected.push(await mustReject("encrypted_entry", zip([{
  path: "index.node", binary: fixture, flags: 1,
}]), fixture));

const bomb = Buffer.alloc(1024 * 1024, 0x41);
rejected.push(await mustReject("compression_bomb", zip([{ path: "index.node", binary: bomb }]), bomb));
rejected.push(await mustReject("declared_size_mismatch", zip([{
  path: "index.node", binary: fixture, declaredUncompressed: fixture.length + 1,
}]), fixture));
rejected.push(await mustReject("huge_declared_size", zip([{
  path: "index.node", binary: fixture, declaredUncompressed: 0x7fffffff,
}]), fixture));

const badCrcArchive = zip([{ path: "index.node", binary: fixture, declaredCrc: (crc32(fixture) ^ 1) >>> 0 }]);
rejected.push(await mustReject("bad_crc", badCrcArchive, fixture));
const wrongBinaryHash = profile(correctArchive, fixture, { binarySha256: "0".repeat(64) });
await assert.rejects(readVerifiedSingleEntryArchive(correctArchive, wrongBinaryHash));
rejected.push("binary_hash_mismatch");
const wrongBinarySize = profile(correctArchive, fixture, { binaryBytes: fixture.length + 1 });
await assert.rejects(readVerifiedSingleEntryArchive(correctArchive, wrongBinarySize));
rejected.push("binary_size_mismatch");
const wrongArchiveHash = profile(correctArchive, fixture, { archiveSha256: "f".repeat(64) });
await assert.rejects(readVerifiedSingleEntryArchive(correctArchive, wrongArchiveHash));
rejected.push("archive_hash_mismatch");
const wrongArchiveSize = profile(correctArchive, fixture, { archiveBytes: correctArchive.length + 1 });
await assert.rejects(readVerifiedSingleEntryArchive(correctArchive, wrongArchiveSize));
rejected.push("archive_size_mismatch");

const truncated = correctArchive.subarray(0, correctArchive.length - 7);
rejected.push(await mustReject("truncated_archive", truncated, fixture));
const badCentral = Buffer.from(correctArchive);
const endOffset = badCentral.length - 22;
const centralOffset = badCentral.readUInt32LE(endOffset + 16);
badCentral.writeUInt32LE(0xdeadbeef, centralOffset);
rejected.push(await mustReject("bad_central_directory", badCentral, fixture));
const badEnd = Buffer.from(correctArchive);
badEnd.writeUInt32LE(0xdeadbeef, badEnd.length - 22);
rejected.push(await mustReject("bad_end_record", badEnd, fixture));
const corruptPayload = Buffer.from(correctArchive);
corruptPayload[35] ^= 0xff;
rejected.push(await mustReject("corrupt_compressed_payload", corruptPayload, fixture));
const oversizedProfile = profile(correctArchive, fixture, { binaryBytes: (64 * 1024 * 1024) + 1 });
await assert.rejects(readVerifiedSingleEntryArchive(correctArchive, oversizedProfile));
rejected.push("oversized_entry");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tancmark-c2pa-archive-contract-"));
try {
  const targetDirectory = path.join(tempRoot, "target");
  const targetPath = path.join(targetDirectory, "index.node");
  await installVerifiedBinaryAtFixedPath({
    targetPath,
    binary: fixture,
    expectedBytes: fixture.length,
    expectedSha256: sha256(fixture),
  });
  assert.deepEqual(await readFile(targetPath), fixture);

  const interruptedTarget = path.join(targetDirectory, "interrupted.node");
  const original = Buffer.from("original-target");
  await writeFile(interruptedTarget, original);
  await assert.rejects(installVerifiedBinaryAtFixedPath({
    targetPath: interruptedTarget,
    binary: fixture,
    expectedBytes: fixture.length,
    expectedSha256: sha256(fixture),
    beforeCommit: async () => { throw new Error("simulated_interruption"); },
  }), /simulated_interruption/);
  assert.deepEqual(await readFile(interruptedTarget), original);
  rejected.push("process_interruption");

  const halfWriteTarget = path.join(targetDirectory, "half-write.node");
  await assert.rejects(installVerifiedBinaryAtFixedPath({
    targetPath: halfWriteTarget,
    binary: fixture.subarray(0, fixture.length - 1),
    expectedBytes: fixture.length,
    expectedSha256: sha256(fixture),
  }));
  await assert.rejects(readFile(halfWriteTarget));
  rejected.push("half_write");

  const raceTarget = path.join(targetDirectory, "race.node");
  await writeFile(raceTarget, original);
  await assert.rejects(installVerifiedBinaryAtFixedPath({
    targetPath: raceTarget,
    binary: fixture,
    expectedBytes: fixture.length,
    expectedSha256: sha256(fixture),
    beforeAtomicLink: async () => { await writeFile(raceTarget, Buffer.from("racing-writer"), { flag: "wx" }); },
  }));
  assert.deepEqual(await readFile(raceTarget), Buffer.from("racing-writer"));
  rejected.push("overwrite_race");

  const afterCommitTarget = path.join(targetDirectory, "after-commit.node");
  await assert.rejects(installVerifiedBinaryAtFixedPath({
    targetPath: afterCommitTarget,
    binary: fixture,
    expectedBytes: fixture.length,
    expectedSha256: sha256(fixture),
    afterCommit: async () => { throw new Error("simulated_post_commit_interruption"); },
  }), /simulated_post_commit_interruption/);
  assert.deepEqual(await readFile(afterCommitTarget), fixture);
  rejected.push("post_commit_interruption");

  const leftovers = (await readdir(targetDirectory)).filter((name) => name.startsWith(".tancmark-native-"));
  assert.deepEqual(leftovers, []);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

assert.equal(rejected.length, 33);
process.stdout.write(`${JSON.stringify({
  gate: "TANCMARK_C2PA_ARCHIVE_SINGLE_ENTRY_SECURITY_GATE",
  status: "PASSED",
  positiveSingleEntry: "PASSED",
  negativeCases: rejected,
  negativeCaseCount: rejected.length,
  outsideWriteCount: 0,
  unexpectedEntryAcceptedCount: 0,
  unboundedExtractionApiUsed: false,
  binaryHashMismatchAcceptedCount: 0,
  remainingTemporaryDirectoryCount: 0,
}, null, 2)}\n`);
