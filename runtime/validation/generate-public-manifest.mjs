import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareUtf8By, DETERMINISTIC_ORDER_ALGORITHM, sortUtf8Bytewise } from "./deterministic-utf8-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const excludedDirectories = new Set([".git", ".local", "node_modules", "dist", "dist-product", "__pycache__"]);
const excludedFiles = new Set(["SHA256SUMS", "reports/PUBLIC_SOURCE_MANIFEST.json"]);
const indexRecords = execFileSync("git", ["ls-files", "--stage", "-z"], {
  cwd: root,
  encoding: "buffer",
  maxBuffer: 16 * 1024 * 1024,
})
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .map((record) => {
    const tab = record.indexOf("\t");
    assert.notEqual(tab, -1, `manifest_index_record_invalid:${record}`);
    const [mode, objectId] = record.slice(0, tab).split(" ");
    assert.match(objectId, /^[0-9a-f]{40,64}$/i, `manifest_object_id_invalid:${record}`);
    return { mode, objectId, relative: record.slice(tab + 1) };
  })
  .filter(({ relative }) => {
    if (excludedFiles.has(relative) || relative.endsWith(".tsbuildinfo")) return false;
    return !relative.split("/").some((segment) => excludedDirectories.has(segment));
  });

indexRecords.sort(compareUtf8By((record) => record.relative));
const batch = execFileSync("git", ["cat-file", "--batch"], {
  cwd: root,
  input: Buffer.from(indexRecords.map(({ objectId }) => `${objectId}\n`).join(""), "utf8"),
  encoding: "buffer",
  maxBuffer: 256 * 1024 * 1024,
});
let batchOffset = 0;
const entries = indexRecords.map(({ mode, objectId, relative }) => {
  assert.notEqual(mode, "120000", `manifest_symlink_forbidden:${relative}`);
  assert.equal(mode === "100644" || mode === "100755", true, `manifest_mode_forbidden:${relative}:${mode}`);
  const headerEnd = batch.indexOf(0x0a, batchOffset);
  assert.notEqual(headerEnd, -1, `manifest_batch_header_missing:${relative}`);
  const header = batch.subarray(batchOffset, headerEnd).toString("utf8");
  const [actualObjectId, objectType, sizeText] = header.split(" ");
  assert.equal(actualObjectId, objectId, `manifest_batch_object_mismatch:${relative}`);
  assert.equal(objectType, "blob", `manifest_batch_type_invalid:${relative}:${objectType}`);
  const size = Number(sizeText);
  assert(Number.isSafeInteger(size) && size >= 0, `manifest_batch_size_invalid:${relative}:${sizeText}`);
  const contentStart = headerEnd + 1;
  const contentEnd = contentStart + size;
  assert(contentEnd < batch.length, `manifest_batch_content_truncated:${relative}`);
  const bytes = batch.subarray(contentStart, contentEnd);
  assert.equal(batch[contentEnd], 0x0a, `manifest_batch_separator_missing:${relative}`);
  batchOffset = contentEnd + 1;
  return {
    mode,
    path: relative,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});
assert.equal(batchOffset, batch.length, "manifest_batch_trailing_bytes");
const sums = entries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n";
const manifestSha256 = createHash("sha256").update(sums).digest("hex");
const manifest = {
  schemaVersion: "tancmark-public-source-manifest-v2",
  generatedAtUtc: "2026-08-28T00:00:00Z",
  status: "PASSED",
  fileCount: entries.length,
  totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  symlinkCount: 0,
  orderingAlgorithm: DETERMINISTIC_ORDER_ALGORITHM,
  excludedGeneratedDirectories: sortUtf8Bytewise(excludedDirectories),
  sha256SumsSha256: manifestSha256,
  entries,
};
fs.writeFileSync(path.join(root, "SHA256SUMS"), sums);
fs.writeFileSync(path.join(root, "reports", "PUBLIC_SOURCE_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ contract: "public_source_manifest", status: "passed", fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, symlinkCount: 0, sha256SumsSha256: manifestSha256 }, null, 2)}\n`);
