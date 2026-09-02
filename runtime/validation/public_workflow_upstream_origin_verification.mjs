// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const lock = JSON.parse(readFileSync(path.join(root, ".github", "actions-lock.json"), "utf8"));

const stopForUnavailableNetwork = (repository) => {
  process.stdout.write(`${JSON.stringify({
    gate: "GITHUB_ACTIONS_UPSTREAM_ORIGIN_VERIFICATION",
    status: "UPSTREAM_ACTION_PIN_VERIFICATION_NOT_RUN_NETWORK_UNAVAILABLE",
    repository,
    verified: 0
  }, null, 2)}\n`);
  process.exitCode = 2;
};

const main = () => {
  let verified = 0;
  for (const record of lock.actions) {
    const expectedOfficialRepository = `https://github.com/${record.repository}`;
    assert.equal(record.officialRepository, expectedOfficialRepository, `official_repository_mismatch:${record.repository}`);
    const repositoryUrl = `${expectedOfficialRepository}.git`;
    const tagRef = `refs/tags/${record.version}`;
    let output;
    try {
      output = execFileSync("git", ["ls-remote", repositoryUrl, tagRef, `${tagRef}^{}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000
      });
    } catch {
      stopForUnavailableNetwork(record.repository);
      return;
    }
    const refs = new Map(output.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const [sha, ref] = line.split(/\s+/);
      return [ref, sha];
    }));
    const tagRefSha = refs.get(tagRef);
    const tagResolvedCommit = refs.get(`${tagRef}^{}`) ?? tagRefSha;
    assert(/^[0-9a-f]{40}$/.test(tagRefSha ?? ""), `official_tag_ref_missing:${record.repository}:${record.version}`);
    assert(/^[0-9a-f]{40}$/.test(tagResolvedCommit ?? ""), `official_tag_commit_missing:${record.repository}:${record.version}`);
    assert.equal(tagRefSha, record.tagRefSha, `official_tag_ref_changed:${record.repository}:${record.version}`);
    assert.equal(tagResolvedCommit, record.tagResolvedCommit, `official_tag_resolution_mismatch:${record.repository}:${record.version}`);
    assert.equal(tagResolvedCommit, record.commitSha, `official_release_pin_mismatch:${record.repository}:${record.version}`);
    assert.equal(record.actionPinFromOfficialReleaseTag, true, `official_release_origin_unproven:${record.repository}`);
    verified += 1;
  }
  process.stdout.write(`${JSON.stringify({
    gate: "GITHUB_ACTIONS_UPSTREAM_ORIGIN_VERIFICATION",
    status: "PASSED",
    verificationMethod: "git-ls-remote-official-tag-and-dereference",
    actionFamilies: lock.actions.length,
    verified,
    officialTagMismatch: 0,
    forkOnlyOrImpostorCommit: 0,
    actionPinFromOfficialReleaseTag: true
  }, null, 2)}\n`);
};

main();
