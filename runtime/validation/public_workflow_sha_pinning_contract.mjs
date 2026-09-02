// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sortUtf8Bytewise } from "./deterministic-utf8-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowRoot = path.join(root, ".github", "workflows");
const lockPath = path.join(root, ".github", "actions-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

const expected = new Map([
  ["actions/checkout", { version: "v6.0.2", commitSha: "de0fac2e4500dabe0009e67214ff5f5447ce83dd" }],
  ["actions/setup-node", { version: "v6.5.0", commitSha: "249970729cb0ef3589644e2896645e5dc5ba9c38" }],
  ["actions/dependency-review-action", { version: "v5.0.0", commitSha: "a1d282b36b6f3519aa1f3fc636f609c47dddb294" }],
  ["github/codeql-action", { version: "v4.36.0", commitSha: "7211b7c8077ea37d8641b6271f6a365a22a5fbfa" }],
]);

assert.equal(lock.schemaVersion, "tancmark-github-actions-lock-v1", "actions_lock_schema_invalid");
assert(Array.isArray(lock.actions), "actions_lock_records_missing");
assert.equal(lock.actions.length, expected.size, "actions_lock_record_count_mismatch");

const records = new Map();
for (const record of lock.actions) {
  assert.equal(typeof record.repository, "string", "actions_lock_repository_missing");
  assert(!records.has(record.repository), `actions_lock_duplicate_repository:${record.repository}`);
  const authority = expected.get(record.repository);
  assert(authority, `actions_lock_unknown_repository:${record.repository}`);
  assert.equal(record.version, authority.version, `actions_lock_version_mismatch:${record.repository}`);
  assert.equal(record.commitSha, authority.commitSha, `actions_lock_commit_mismatch:${record.repository}`);
  assert.equal(record.officialRepository, `https://github.com/${record.repository}`, `actions_lock_official_repository_mismatch:${record.repository}`);
  assert.equal(record.verificationMethod, "git-ls-remote-official-tag-and-dereference", `actions_lock_verification_method_invalid:${record.repository}`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(record.verifiedAt), `actions_lock_verified_at_invalid:${record.repository}`);
  assert(/^[0-9a-f]{40}$/.test(record.tagRefSha), `actions_lock_tag_ref_invalid:${record.repository}`);
  assert(/^[0-9a-f]{40}$/.test(record.tagResolvedCommit), `actions_lock_tag_commit_invalid:${record.repository}`);
  assert.equal(record.commitSha, record.tagResolvedCommit, `actions_lock_official_tag_mismatch:${record.repository}`);
  assert.equal(record.actionPinFromOfficialReleaseTag, true, `actions_lock_official_release_unproven:${record.repository}`);
  records.set(record.repository, record);
}

const files = sortUtf8Bytewise(readdirSync(workflowRoot).filter((name) => /\.ya?ml$/i.test(name)));
assert.equal(files.length, 3, "workflow_count_mismatch");

let externalUses = 0;
const usedRepositories = new Set();
const familyPins = new Map();
for (const name of files) {
  const text = readFileSync(path.join(workflowRoot, name), "utf8");
  assert(!/pull_request_target\s*:/.test(text), `${name}:pull_request_target_forbidden`);
  for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s*#\s*(\S+))?\s*$/gm)) {
    const value = match[1];
    if (value.startsWith("./")) continue;
    externalUses += 1;
    assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$/.test(value), `${name}:action_not_pinned:${value}`);
    const [actionPath, sha] = value.split("@");
    const pathParts = actionPath.split("/");
    const repository = pathParts.slice(0, 2).join("/");
    const record = records.get(repository);
    assert(record, `${name}:action_not_in_lock:${repository}`);
    assert(match[2], `${name}:action_version_comment_missing:${value}`);
    assert.equal(match[2], record.version, `${name}:action_version_comment_mismatch:${value}`);
    assert.equal(sha, record.commitSha, `${name}:action_lock_sha_mismatch:${value}`);
    assert.equal(record.commitSha, record.tagResolvedCommit, `${name}:official_tag_commit_mismatch:${repository}`);
    assert.equal(record.actionPinFromOfficialReleaseTag, true, `${name}:impostor_commit_guard_failed:${repository}`);
    usedRepositories.add(repository);
    const pins = familyPins.get(repository) ?? new Set();
    pins.add(`${match[2]}@${sha}`);
    familyPins.set(repository, pins);
  }
}

assert.equal(externalUses, 8, "external_action_use_count_mismatch");
assert.equal(usedRepositories.size, records.size, "actions_lock_unused_or_missing_family");
for (const [repository, pins] of familyPins) {
  assert.equal(pins.size, 1, `action_family_release_inconsistent:${repository}`);
}

process.stdout.write(`${JSON.stringify({
  gate: "GITHUB_ACTIONS_OFFICIAL_RELEASE_SHA_PINNING",
  status: "PASSED",
  workflows: files.length,
  uses: externalUses,
  externalUses,
  actionFamilies: records.size,
  unpinnedAction: 0,
  versionCommentMismatch: 0,
  officialTagMismatch: 0,
  forkOnlyOrImpostorCommit: 0,
  movingTagOrBranch: 0,
  pullRequestTarget: 0,
  actionPinFromOfficialReleaseTag: true
}, null, 2)}\n`);
