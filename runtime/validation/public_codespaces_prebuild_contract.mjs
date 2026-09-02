// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const devcontainerPath = path.join(root, ".devcontainer", "devcontainer.json");
const setupPath = path.join(root, ".devcontainer", "setup-demo.sh");
const verifyPath = path.join(root, ".devcontainer", "verify-demo-ready.sh");
const startPath = path.join(root, ".devcontainer", "start-demo.sh");
const readmePath = path.join(root, "README.md");

for (const required of [devcontainerPath, setupPath, verifyPath, startPath, readmePath]) {
  assert.equal(existsSync(required), true, `codespaces_prebuild_required_file_missing:${path.relative(root, required)}`);
}

const config = JSON.parse(readFileSync(devcontainerPath, "utf8"));
assert.equal(config.updateContentCommand, "bash .devcontainer/setup-demo.sh");
assert.equal(config.postCreateCommand, "bash .devcontainer/verify-demo-ready.sh");
assert.equal(config.postStartCommand, "bash .devcontainer/start-demo.sh");
assert.deepEqual(config.forwardPorts, [4173]);
assert.equal(config.portsAttributes?.["4173"]?.visibility, "private");
assert.equal(config.portsAttributes?.["4173"]?.onAutoForward, "openPreview");

const setup = readFileSync(setupPath, "utf8");
const verify = readFileSync(verifyPath, "utf8");
const start = readFileSync(startPath, "utf8");
for (const required of [
  "pnpm install --frozen-lockfile",
  "generate-public-fixtures.mjs",
  "prebuild-ready.commit",
  "TANCMARK_DEMO_PREBUILD_READY",
]) assert(setup.includes(required), `codespaces_prebuild_setup_contract_missing:${required}`);
for (const required of [
  "prebuild-ready.commit",
  "prebuiltSetupVerified",
  "dist/server.mjs",
  "node --check",
]) assert(verify.includes(required), `codespaces_fast_verify_contract_missing:${required}`);
for (const required of ["env -i", "TANCMARK_DEMO_ONLY=1", "127.0.0.1:4173/demo/health"]) {
  assert(start.includes(required), `codespaces_fast_start_contract_missing:${required}`);
}
for (const forbidden of ["GITHUB_TOKEN", "GH_TOKEN", "printenv", "set -x"]) {
  assert.equal(`${setup}\n${verify}\n${start}`.includes(forbidden), false, `codespaces_secret_boundary_weakened:${forbidden}`);
}

const readme = readFileSync(readmePath, "utf8");
let remoteUrl = "";
try {
  remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
const placeholder = "<GITHUB_CODESPACES_DEMO_URL>";
if (!remoteUrl) {
  assert(readme.includes(placeholder), "codespaces_url_placeholder_required_before_first_push");
} else {
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  assert(match, "codespaces_origin_must_be_github_repository");
  const expected = `https://codespaces.new/${match[1]}/${match[2]}?quickstart=1`;
  assert.equal(readme.includes(placeholder), false, "codespaces_url_placeholder_forbidden_after_remote_exists");
  assert(readme.includes(expected), `codespaces_quickstart_url_missing:${expected}`);
  assert(readme.includes("https://github.com/codespaces/badge.svg"), "codespaces_badge_missing");
}

process.stdout.write(`${JSON.stringify({
  gate: "TANCMARK_CODESPACES_PREBUILD_AND_FAST_START",
  status: "PASSED",
  heavySetupLifecycle: "updateContentCommand",
  userStartLifecycle: ["postCreateCommand", "postStartCommand"],
  forwardedPort: 4173,
  portVisibility: "private",
  repositoryUrlState: remoteUrl ? "REAL_REMOTE_REQUIRED" : "PRE_PUSH_PLACEHOLDER",
}, null, 2)}\n`);
