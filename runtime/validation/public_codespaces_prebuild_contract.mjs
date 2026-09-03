// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const devcontainerPath = path.join(root, ".devcontainer", "devcontainer.json");
const setupPath = path.join(root, ".devcontainer", "setup-demo.sh");
const verifyPath = path.join(root, ".devcontainer", "verify-demo-ready.sh");
const startPath = path.join(root, ".devcontainer", "start-demo.sh");
const readmePath = path.join(root, "README.md");
const englishGuidePath = path.join(root, "docs", "DEMO_GUIDE.md");
const turkishGuidePath = path.join(root, "docs", "DEMO_GUIDE_TR.md");
const statusReportPath = path.join(root, "reports", "GITHUB_CODESPACES_HOSTED_DEMO_STATUS_20260902.json");

for (const required of [devcontainerPath, setupPath, verifyPath, startPath, readmePath, englishGuidePath, turkishGuidePath, statusReportPath]) {
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

const publicationDocuments = [readmePath, englishGuidePath, turkishGuidePath]
  .map((documentPath) => readFileSync(documentPath, "utf8"));
for (const document of publicationDocuments) {
  assert(document.includes("EXPERIMENTAL_LOCAL_DEMO"), "experimental_local_demo_status_missing");
  assert(document.includes("GitHub Codespaces hosted demo currently unavailable"), "codespaces_unavailable_notice_missing");
  const publishedUrls = (document.match(/https:\/\/[^\s)>\]]+/gu) ?? []).map((candidate) => new URL(candidate));
  assert.equal(publishedUrls.some((url) => url.hostname.toLowerCase() === "codespaces.new"), false,
    "codespaces_quickstart_must_not_be_published");
  assert.equal(publishedUrls.some((url) => url.hostname.toLowerCase() === "github.com" && url.pathname === "/codespaces/badge.svg"), false,
    "codespaces_badge_must_not_be_published");
}
const statusReport = JSON.parse(readFileSync(statusReportPath, "utf8"));
assert.equal(statusReport.status, "GITHUB_CODESPACES_HOSTED_DEMO_CURRENTLY_UNAVAILABLE");
assert.equal(statusReport.releaseGateRequired, false);
assert.equal(statusReport.localDemoClassification, "EXPERIMENTAL_LOCAL_DEMO");
assert.equal(statusReport.paidPrebuildEnabled, false);
assert.equal(statusReport.paidMachineEnabled, false);
assert.equal(statusReport.paymentMethodChanged, false);
assert.equal(statusReport.failedCodespaceDeleted, true);

process.stdout.write(`${JSON.stringify({
  gate: "TANCMARK_EXPERIMENTAL_LOCAL_DEMO_NO_HOSTED_CODESPACES",
  status: "PASSED",
  localDemoClassification: "EXPERIMENTAL_LOCAL_DEMO",
  hostedCodespacesDemo: "UNAVAILABLE",
  releaseGateRequired: false,
  paidPrebuildEnabled: false,
  publishedCodespacesBadge: false,
  forwardedPort: 4173,
  portVisibility: "private",
}, null, 2)}\n`);
