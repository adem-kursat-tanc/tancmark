// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import unzipper from "unzipper";

const archivePath = process.env["TANCMARK_ARCHIVE_PATH"];
assert(archivePath, "TANCMARK_ARCHIVE_PATH is required");
const expectedArchiveSha256 = process.env["TANCMARK_EXPECTED_ARCHIVE_SHA256"];
const expectedCommit = process.env["TANCMARK_EXPECTED_COMMIT"];
const expectedManifestEntries = process.env["TANCMARK_EXPECTED_MANIFEST_ENTRIES"]
  ? Number(process.env["TANCMARK_EXPECTED_MANIFEST_ENTRIES"])
  : undefined;

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const archiveBytes = fs.readFileSync(archivePath);
const archiveSha256 = sha(archiveBytes);
if (expectedArchiveSha256) assert.equal(archiveSha256, expectedArchiveSha256, "archive_sha256_mismatch");

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const directory = await unzipper.Open.buffer(archiveBytes);
const zipComment = Buffer.isBuffer(directory.comment) ? directory.comment.toString("utf8") : String(directory.comment ?? "");
if (expectedCommit) assert(zipComment.includes(expectedCommit), `zip_comment_commit_mismatch:${zipComment}`);

const fileMap = new Map();
let crcChecked = 0;
let directoryEntries = 0;
let symlinkEntries = 0;
for (const entry of directory.files) {
  const archiveName = entry.path.replaceAll("\\", "/");
  assert(!archiveName.startsWith("/") && !archiveName.includes("../"), `unsafe_archive_path:${archiveName}`);
  if (entry.type === "Directory") {
    directoryEntries += 1;
    continue;
  }
  const unixMode = ((entry.externalFileAttributes ?? 0) >>> 16) & 0xffff;
  if ((unixMode & 0o170000) === 0o120000) symlinkEntries += 1;
  const bytes = await entry.buffer();
  const declaredCrc = entry.crc32;
  if (typeof declaredCrc === "number") {
    assert.equal(crc32(bytes), declaredCrc >>> 0, `zip_crc_mismatch:${archiveName}`);
    crcChecked += 1;
  }
  const relative = archiveName.startsWith("tancmark/") ? archiveName.slice("tancmark/".length) : archiveName;
  assert(relative && !fileMap.has(relative), `duplicate_archive_path:${relative}`);
  fileMap.set(relative, bytes);
}
assert.equal(symlinkEntries, 0, "archive_symlink_forbidden");

const sumsBytes = fileMap.get("SHA256SUMS");
const manifestBytes = fileMap.get("reports/PUBLIC_SOURCE_MANIFEST.json");
assert(sumsBytes, "SHA256SUMS missing from archive");
assert(manifestBytes, "PUBLIC_SOURCE_MANIFEST missing from archive");
const sumsText = sumsBytes.toString("utf8");
const sumLines = sumsText.split(/\r?\n/).filter(Boolean);
let sumsVerified = 0;
for (const line of sumLines) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert(match, `invalid_sha256sums_line:${line}`);
  const bytes = fileMap.get(match[2]);
  assert(bytes, `sha256sums_target_missing:${match[2]}`);
  assert.equal(sha(bytes), match[1], `sha256sums_mismatch:${match[2]}`);
  sumsVerified += 1;
}

const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.equal(manifest.status, "PASSED", "source_manifest_status_not_passed");
assert.equal(manifest.fileCount, manifest.entries.length, "source_manifest_count_mismatch");
assert.equal(manifest.sha256SumsSha256, sha(sumsBytes), "source_manifest_sums_hash_mismatch");
if (expectedManifestEntries !== undefined) assert.equal(manifest.fileCount, expectedManifestEntries, "expected_manifest_entry_count_mismatch");
let manifestVerified = 0;
for (const record of manifest.entries) {
  const bytes = fileMap.get(record.path);
  assert(bytes, `source_manifest_target_missing:${record.path}`);
  assert.equal(bytes.length, record.bytes, `source_manifest_size_mismatch:${record.path}`);
  assert.equal(sha(bytes), record.sha256, `source_manifest_hash_mismatch:${record.path}`);
  manifestVerified += 1;
}
assert.equal(sumsVerified, manifest.fileCount, "sha256sums_manifest_count_mismatch");

let jsonParsed = 0;
for (const [relative, bytes] of fileMap) {
  if (!relative.endsWith(".json")) continue;
  JSON.parse(bytes.toString("utf8"));
  jsonParsed += 1;
}

let yamlParsed = 0;
const pnpmStore = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "node_modules", ".pnpm");
const yamlPackage = fs.existsSync(pnpmStore)
  ? fs.readdirSync(pnpmStore).find((name) => name.startsWith("yaml@"))
  : undefined;
if (yamlPackage) {
  const yamlModule = await import(pathToFileURL(path.join(pnpmStore, yamlPackage, "node_modules", "yaml", "dist", "index.js")));
  for (const [relative, bytes] of fileMap) {
    if (!/\.ya?ml$/i.test(relative)) continue;
    yamlModule.parse(bytes.toString("utf8"));
    yamlParsed += 1;
  }
}

const forbiddenDirectorySegments = new Set([".git", ".local", "node_modules", "dist", "dist-product", "__pycache__"]);
const forbiddenPaths = [...fileMap.keys()].filter((relative) => relative.split("/").some((segment) => forbiddenDirectorySegments.has(segment)));
assert.deepEqual(forbiddenPaths, [], `forbidden_archive_paths:${forbiddenPaths.join(",")}`);

process.stdout.write(`${JSON.stringify({
  gate: "PUBLIC_DOCUMENTATION_ARCHIVE_INTEGRITY_GATE",
  status: "PASSED",
  archiveSha256,
  zipComment,
  fileEntries: fileMap.size,
  directoryEntries,
  crcChecked,
  crcFailures: 0,
  sha256SumsExact: `${sumsVerified}/${sumLines.length}`,
  sourceManifestExact: `${manifestVerified}/${manifest.entries.length}`,
  jsonParsed,
  yamlParsed,
  symlinkEntries,
  forbiddenPaths: forbiddenPaths.length,
}, null, 2)}\n`);
