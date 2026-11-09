// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RELEASE_TRANSITION_PATH = "reports/RELEASE_VERSION_TRANSITION_RC2.json";
export const releaseSha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const releaseBlob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export function validateReleaseVersionTransition(current, receipt) {
  assert.equal(receipt.schemaVersion, "tancmark-release-version-transition-v1", "release_transition_schema");
  assert.equal(receipt.scope, "ROOT_VERSION_METADATA_ONLY", "release_transition_scope");
  assert.equal(receipt.baseCommit, "471274f1ead335cb8dce900cf03b722507e4b6ce", "release_transition_base_commit");
  assert.equal(receipt.baseTree, "fa7776ce92e62c34344419b368e4eae5bf0e9efd", "release_transition_base_tree");
  assert.equal(receipt.fromVersion, "0.1.0-rc.1", "release_transition_from_version");
  assert.equal(receipt.toVersion, "0.1.0-rc.2", "release_transition_to_version");
  assert.equal(receipt.published, false, "release_transition_publication_claim");
  const file = receipt.file;
  assert.equal(file?.path, "package.json", "release_transition_path");
  assert.equal(file.beforeSha256, "d5f7818b4e9dba43e9a773df9ee75bb323ca50944131fa47a650dcbf604f0102", "release_transition_before_sha");
  assert.equal(file.beforeGitBlob, "9e6f31940e949452c5d24210eeee098f70452dfa", "release_transition_before_blob");
  assert.equal(releaseSha(current), file.afterSha256, "release_transition_after_sha");
  assert.equal(releaseBlob(current), file.afterGitBlob, "release_transition_after_blob");
  const text = current.toString("utf8");
  assert.equal(JSON.parse(text).version, receipt.toVersion, "release_transition_current_version");
  const needle = '"version": "0.1.0-rc.2"';
  assert.equal(text.split(needle).length, 2, "release_transition_exactly_one_version");
  const before = Buffer.from(text.replace(needle, '"version": "0.1.0-rc.1"'));
  assert.equal(releaseSha(before), file.beforeSha256, "release_transition_unexpected_delta");
  assert.equal(releaseBlob(before), file.beforeGitBlob, "release_transition_unexpected_blob_delta");
  return { before, file };
}
export function loadReleaseVersionTransition(root, current) {
  return validateReleaseVersionTransition(current, JSON.parse(fs.readFileSync(path.join(root, RELEASE_TRANSITION_PATH), "utf8")));
}
