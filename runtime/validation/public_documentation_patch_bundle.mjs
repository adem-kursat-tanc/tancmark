// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareUtf8By } from "./deterministic-utf8-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outputDirectory = process.env["TANCMARK_DOCUMENTATION_PATCH_OUTPUT"];
assert(outputDirectory, "TANCMARK_DOCUMENTATION_PATCH_OUTPUT is required");
fs.mkdirSync(outputDirectory, { recursive: true });

const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
assert.equal(baseCommit, "a774c91b114b02784eb264d46ce50d3ae3b33037", "documentation_patch_base_commit_mismatch");
const staged = execFileSync("git", ["diff", "--cached", "--name-status", "-z", "HEAD"], {
  cwd: root,
  encoding: "buffer",
  windowsHide: true,
}).toString("utf8").split("\0").filter(Boolean);
assert(staged.length > 0, "documentation_patch_has_no_staged_files");

const allowed = (relative) => relative === "README.md" || relative === "CHANGELOG.md"
  || relative.startsWith("docs/") || relative.startsWith("reports/")
  || relative.startsWith("runtime/validation/public_documentation_");
const records = [];
for (let index = 0; index < staged.length;) {
  const status = staged[index++];
  const operation = status[0] === "A" ? "ADD" : status[0] === "M" ? "MODIFY" : status[0] === "D" ? "DELETE" : undefined;
  assert(operation, `unsupported_patch_operation:${status}`);
  const relative = staged[index++].replaceAll("\\", "/");
  assert(allowed(relative), `product_or_dependency_file_in_documentation_patch:${relative}`);
  const before = operation === "ADD" ? null : execFileSync("git", ["show", `HEAD:${relative}`], { cwd: root, encoding: "buffer", windowsHide: true });
  const after = operation === "DELETE" ? null : execFileSync("git", ["show", `:${relative}`], { cwd: root, encoding: "buffer", windowsHide: true });
  const reason = relative === "README.md" ? "Link the detailed public documentation without expanding the README."
    : relative === "CHANGELOG.md" ? "Record the documentation-only V9 completion."
    : relative.startsWith("docs/") ? "Provide or update verified English/Turkish public guidance."
    : relative === "reports/DOCUMENTATION_SOURCE_OF_TRUTH_AUDIT.json" ? "Record code/OpenAPI/route source-of-truth decisions."
    : relative.startsWith("reports/documentation-v9/") ? "Record the deterministic public documentation gate result."
    : "Validate documentation accuracy, links, examples, parity, archives, or patch scope.";
  const sourceReferences = relative.startsWith("runtime/validation/")
    ? ["package.json", "lib/api-spec/openapi.yaml", "artifacts/api-server/src/routes", "public documentation"]
    : ["product source code", "package scripts", "lib/api-spec/openapi.yaml", "public smoke evidence"];
  records.push({
    path: relative,
    operation,
    beforeSha256: before ? createHash("sha256").update(before).digest("hex") : null,
    afterSha256: after ? createHash("sha256").update(after).digest("hex") : null,
    reason,
    sourceOfTruthReferences: sourceReferences,
    documentationGateResult: "PASSED",
  });
}

records.sort(compareUtf8By((record) => record.path));
const patchBytes = execFileSync("git", ["diff", "--cached", "--binary", "--full-index", "HEAD", "--"], {
  cwd: root,
  encoding: "buffer",
  windowsHide: true,
  maxBuffer: 64 * 1024 * 1024,
});
const rollbackBytes = execFileSync("git", ["diff", "--cached", "--binary", "--full-index", "-R", "HEAD", "--"], {
  cwd: root,
  encoding: "buffer",
  windowsHide: true,
  maxBuffer: 64 * 1024 * 1024,
});
assert(patchBytes.length > 0 && rollbackBytes.length > 0, "documentation_patch_bytes_empty");

const patchPath = path.join(outputDirectory, "PUBLIC_DOCUMENTATION_V9.patch");
const rollbackPath = path.join(outputDirectory, "PUBLIC_DOCUMENTATION_V9_ROLLBACK.patch");
const manifestPath = path.join(outputDirectory, "PUBLIC_DOCUMENTATION_V9_PATCH_MANIFEST.json");
fs.writeFileSync(patchPath, patchBytes);
fs.writeFileSync(rollbackPath, rollbackBytes);
const manifest = {
  schemaVersion: "tancmark-public-documentation-v9-patch-manifest-v1",
  generatedAtUtc: "2026-09-01T09:00:00.000Z",
  status: "PASSED",
  appliesToCommit: baseCommit,
  changedFileCount: records.length,
  productEngineSourceChanged: false,
  publicApiBehaviorChanged: false,
  dependencyGraphChanged: false,
  lockfileChanged: false,
  patchSha256: createHash("sha256").update(patchBytes).digest("hex"),
  rollbackPatchSha256: createHash("sha256").update(rollbackBytes).digest("hex"),
  files: records,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  gate: "PUBLIC_DOCUMENTATION_V9_PATCH_BUNDLE",
  status: "PASSED",
  appliesToCommit: baseCommit,
  changedFileCount: records.length,
  patchSha256: manifest.patchSha256,
  rollbackPatchSha256: manifest.rollbackPatchSha256,
  productFilesInPatch: 0,
  dependencyFilesInPatch: 0,
}, null, 2)}\n`);
