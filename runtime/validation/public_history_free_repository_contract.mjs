// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  expectedPublicRepositoryUrl,
  PUBLIC_REPOSITORY_DOCUMENTS,
  PUBLIC_REPOSITORY_PLACEHOLDER,
} from "./public-repository-remote-policy.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const locales = ["tr_TR.UTF-8", "en_US.UTF-8", "C.UTF-8"];
const generatedFiles = [
  "SHA256SUMS",
  "reports/PUBLIC_SOURCE_MANIFEST.json",
  "SBOM.spdx.json",
  "reports/PUBLIC_LICENSE_SCAN.json",
];
const gates = [
  "runtime/validation/public_documentation_freshness_contract.mjs",
  "runtime/validation/public_documentation_freshness_gate.mjs",
  "runtime/validation/public_documentation_v9_gates.mjs",
  "runtime/validation/public_source_contract.mjs",
  "runtime/validation/public_release_state_consistency_contract.mjs",
  "runtime/validation/public_release_state_consistency_gate.mjs",
  "runtime/validation/final_audit_evidence_consistency_gate.mjs",
  "runtime/validation/public_workflow_sha_pinning_contract.mjs",
];

function run(command, args, cwd, env = {}, expectedSuccess = true) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  if (expectedSuccess) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, "NEGATIVE_HISTORY_FREE_CASE_UNEXPECTEDLY_PASSED");
  return result;
}

function git(args, cwd, env = {}) {
  return run("git", args, cwd, env).stdout.trim();
}

function runSbom(cwd, locale) {
  const env = { LANG: locale, LC_ALL: locale };
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli && fs.existsSync(pnpmCli)) {
    run(process.execPath, [pnpmCli, "run", "sbom"], cwd, env);
  } else {
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "sbom"], cwd, env);
  }
}

function runFrozenInstall(cwd) {
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli && fs.existsSync(pnpmCli)) {
    run(process.execPath, [pnpmCli, "install", "--frozen-lockfile"], cwd);
  } else {
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["install", "--frozen-lockfile"], cwd);
  }
}

function sha256(absolute) {
  return createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
}

const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-history-free-public-"));
const repositoryRoot = path.join(temporaryParent, "public-repository");
fs.mkdirSync(repositoryRoot);

let result;
try {
  const checkoutPrefix = repositoryRoot.replaceAll("\\", "/") + "/";
  git(["checkout-index", "--all", "--force", `--prefix=${checkoutPrefix}`], sourceRoot);
  git(["init", "--initial-branch=main"], repositoryRoot);
  git(["config", "core.autocrlf", "false"], repositoryRoot);
  git(["config", "user.name", "TancMark Release Validation"], repositoryRoot);
  git(["config", "user.email", "release-validation@invalid.example"], repositoryRoot);
  // The exact public tree intentionally contains synthetic demo media that
  // matches the repository's broad private-media ignore patterns. Force-add
  // only this fresh checkout before dependencies or generated outputs exist.
  git(["add", "--all", "--force"], repositoryRoot);
  git(["commit", "-m", "TancMark public history-free validation root"], repositoryRoot, {
    GIT_AUTHOR_DATE: "2026-09-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-09-01T00:00:00Z",
  });

  const sourceUsesPlaceholder = PUBLIC_REPOSITORY_DOCUMENTS.every((relative) =>
    fs.readFileSync(path.join(repositoryRoot, relative), "utf8").includes(PUBLIC_REPOSITORY_PLACEHOLDER));
  const expectedRepository = expectedPublicRepositoryUrl(process.env);
  if (!sourceUsesPlaceholder) {
    assert(expectedRepository, "HISTORY_FREE_REAL_URL_EXPECTED_REPOSITORY_ENV_MISSING");
    git(["remote", "add", "origin", `${expectedRepository.canonicalUrl}.git`], repositoryRoot);
  }

  const rootCommit = git(["rev-parse", "HEAD"], repositoryRoot);
  assert.equal(Number(git(["rev-list", "--count", "HEAD"], repositoryRoot)), 1);
  const remoteCount = git(["remote"], repositoryRoot).split(/\r?\n/u).filter(Boolean).length;
  assert.equal(remoteCount, sourceUsesPlaceholder ? 0 : 1);
  assert.equal(git(["status", "--porcelain=v1"], repositoryRoot), "");
  const contract = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"), "utf8"));
  const oldObjectCheck = spawnSync("git", ["cat-file", "-e", `${contract.publicBaseCommit}^{tree}`], {
    cwd: repositoryRoot, stdio: "ignore", windowsHide: true,
  });
  assert.notEqual(oldObjectCheck.status, 0, "HISTORICAL_BASE_COMMIT_UNEXPECTEDLY_PRESENT");
  runFrozenInstall(repositoryRoot);
  assert.equal(git(["status", "--porcelain=v1"], repositoryRoot), "",
    "HISTORY_FREE_FROZEN_INSTALL_CHANGED_TRACKED_FILES");

  const localeRuns = [];
  for (const locale of locales) {
    const env = { LANG: locale, LC_ALL: locale };
    runSbom(repositoryRoot, locale);
    run(process.execPath, [path.join(repositoryRoot, "runtime/validation/generate-public-manifest.mjs")], repositoryRoot, env);
    const gateResults = [];
    for (const relative of gates) {
      const gateResult = run(process.execPath, [path.join(repositoryRoot, relative)], repositoryRoot, env);
      gateResults.push({ gate: relative, status: "PASSED", outputSha256: createHash("sha256").update(gateResult.stdout).digest("hex") });
    }
    assert.equal(git(["status", "--porcelain=v1"], repositoryRoot), "",
      `HISTORY_FREE_GENERATORS_NOT_REPEATABLE:${locale}`);
    localeRuns.push({
      locale,
      gateResults,
      generatedFiles: Object.fromEntries(generatedFiles.map((relative) => [relative, sha256(path.join(repositoryRoot, relative))])),
    });
  }
  const firstGenerated = JSON.stringify(localeRuns[0].generatedFiles);
  for (const localeRun of localeRuns.slice(1)) {
    assert.equal(JSON.stringify(localeRun.generatedFiles), firstGenerated,
      `HISTORY_FREE_CROSS_LOCALE_GENERATED_BYTES_MISMATCH:${localeRun.locale}`);
  }

  const contractPath = path.join(repositoryRoot, "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json");
  const contractBytes = fs.readFileSync(contractPath);
  const corruptedContract = JSON.parse(contractBytes.toString("utf8"));
  const originalRecord = corruptedContract.acceptedV8LegacyProductManifestRecords[0];
  corruptedContract.acceptedV8LegacyProductManifestRecords[0] = originalRecord.replace(/[0-9a-f]/i, (value) => value === "0" ? "1" : "0");
  fs.writeFileSync(contractPath, `${JSON.stringify(corruptedContract, null, 2)}\n`);
  git(["add", "--", "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"], repositoryRoot);
  run(process.execPath, [path.join(repositoryRoot, "runtime/validation/public_documentation_freshness_contract.mjs")],
    repositoryRoot, { LANG: "C.UTF-8", LC_ALL: "C.UTF-8" }, false);
  fs.writeFileSync(contractPath, contractBytes);
  git(["add", "--", "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"], repositoryRoot);

  const productRelative = "lib/aegis-core/src/index.ts";
  const productPath = path.join(repositoryRoot, productRelative);
  const productBytes = fs.readFileSync(productPath);
  fs.appendFileSync(productPath, Buffer.from([0x0a]));
  git(["add", "--", productRelative], repositoryRoot);
  run(process.execPath, [path.join(repositoryRoot, "runtime/validation/public_documentation_freshness_contract.mjs")],
    repositoryRoot, { LANG: "C.UTF-8", LC_ALL: "C.UTF-8" }, false);
  fs.writeFileSync(productPath, productBytes);
  git(["add", "--", productRelative], repositoryRoot);
  assert.equal(git(["status", "--porcelain=v1"], repositoryRoot), "");

  result = {
    contract: "PUBLIC_HISTORY_FREE_REPOSITORY_CONTRACT",
    status: "PASSED",
    historyFreeStatus: "HISTORICAL_BASE_COMMIT_OBJECT_ABSENT_EXPECTED_HISTORY_FREE_EXPORT",
    rootCommit,
    commitCount: 1,
    remoteCount,
    workingTreeClean: true,
    oldHistoricalObjectPresent: false,
    privateHistoryIncluded: false,
    localeRuns,
    storedRecordMutationRejected: true,
    productByteMutationRejected: true,
    validationOnlyDigestIsolationPassed: true,
    documentationOnlyDigestIsolationPassed: true,
  };
} finally {
  fs.rmSync(temporaryParent, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
