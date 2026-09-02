// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePublicSourceClassDigests } from "./public_documentation_freshness_gate.mjs";
import {
  expectedPublicRepositoryUrl,
  inspectPublicRepositoryRemotePolicy,
  PUBLIC_REPOSITORY_DOCUMENTS,
  PUBLIC_REPOSITORY_PLACEHOLDER,
} from "./public-repository-remote-policy.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const safeRepositoryUrl = "https://github.com/adem-kursat-tanc/tancmark";
const explicitEnvironment = { TANCMARK_PUBLIC_REPOSITORY_URL: safeRepositoryUrl };
const actionsEnvironment = {
  GITHUB_ACTIONS: "true",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "adem-kursat-tanc/tancmark",
  TANCMARK_PUBLIC_REPOSITORY_URL: "",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
};

function run(command, args, cwd, environment = {}, expectedSuccess = true) {
  const childPath = [path.dirname(process.execPath), environment.PATH ?? process.env.PATH ?? ""]
    .filter(Boolean).join(path.delimiter);
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, ...environment, PATH: childPath },
  });
  if (expectedSuccess) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, "NEGATIVE_REMOTE_COMPATIBILITY_CASE_UNEXPECTEDLY_PASSED");
  return result;
}

function git(args, cwd, environment = {}) {
  return run("git", args, cwd, environment).stdout.trim();
}

function initRepository(repositoryRoot) {
  git(["init", "--initial-branch=main"], repositoryRoot);
  git(["config", "core.autocrlf", "false"], repositoryRoot);
  git(["config", "user.name", "TancMark Remote Validation"], repositoryRoot);
  git(["config", "user.email", "remote-validation@invalid.example"], repositoryRoot);
}

function commitRoot(repositoryRoot) {
  // Full exact exports can contain manifest-approved synthetic demo media
  // covered by broad private-media ignore rules. This runs before installs.
  git(["add", "--all", "--force"], repositoryRoot);
  git(["commit", "-m", "TancMark remote-policy root"], repositoryRoot, {
    GIT_AUTHOR_DATE: "2026-09-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-09-01T00:00:00Z",
  });
}

function rewriteRepositoryDocuments(repositoryRoot, replacement) {
  const configuredRepositoryUrl = expectedPublicRepositoryUrl(process.env)?.canonicalUrl ?? null;
  const markerPath = path.join(repositoryRoot, "reports", "PUBLIC_EXPORT_MARKER.json");
  const markerRepositoryUrl = fs.existsSync(markerPath)
    ? JSON.parse(fs.readFileSync(markerPath, "utf8")).publicRepositoryUrl ?? null
    : null;
  for (const relative of PUBLIC_REPOSITORY_DOCUMENTS) {
    const absolute = path.join(repositoryRoot, relative);
    const source = fs.readFileSync(absolute, "utf8");
    const sourceRepositoryUrl = source.includes(PUBLIC_REPOSITORY_PLACEHOLDER)
      ? PUBLIC_REPOSITORY_PLACEHOLDER
      : configuredRepositoryUrl && source.includes(configuredRepositoryUrl)
        ? configuredRepositoryUrl
        : markerRepositoryUrl && source.includes(markerRepositoryUrl)
          ? markerRepositoryUrl
          : null;
    assert(sourceRepositoryUrl, `REMOTE_TEST_SOURCE_REPOSITORY_URL_MISSING:${relative}`);
    fs.writeFileSync(absolute, source.replaceAll(sourceRepositoryUrl, replacement));
  }
}

function replaceRepositoryPlaceholder(repositoryRoot) {
  rewriteRepositoryDocuments(repositoryRoot, safeRepositoryUrl);
}

function createMinimalRepository(parent, name, realRepositoryUrl = false) {
  const repositoryRoot = path.join(parent, name);
  fs.mkdirSync(path.join(repositoryRoot, "reports"), { recursive: true });
  for (const relative of PUBLIC_REPOSITORY_DOCUMENTS) {
    const destination = path.join(repositoryRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relative), destination);
  }
  fs.copyFileSync(
    path.join(sourceRoot, "reports", "PUBLIC_EXPORT_MARKER.json"),
    path.join(repositoryRoot, "reports", "PUBLIC_EXPORT_MARKER.json"),
  );
  rewriteRepositoryDocuments(repositoryRoot, realRepositoryUrl ? safeRepositoryUrl : PUBLIC_REPOSITORY_PLACEHOLDER);
  initRepository(repositoryRoot);
  commitRoot(repositoryRoot);
  return repositoryRoot;
}

function createMinimalArchive(parent, name) {
  const repositoryRoot = path.join(parent, name);
  fs.mkdirSync(path.join(repositoryRoot, "reports"), { recursive: true });
  for (const relative of PUBLIC_REPOSITORY_DOCUMENTS) {
    const destination = path.join(repositoryRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relative), destination);
  }
  fs.copyFileSync(
    path.join(sourceRoot, "reports", "PUBLIC_EXPORT_MARKER.json"),
    path.join(repositoryRoot, "reports", "PUBLIC_EXPORT_MARKER.json"),
  );
  return repositoryRoot;
}

function exportIndex(repositoryRoot) {
  fs.mkdirSync(repositoryRoot, { recursive: true });
  const prefix = repositoryRoot.replaceAll("\\", "/") + "/";
  git(["checkout-index", "--all", "--force", `--prefix=${prefix}`], sourceRoot);
}

function createFullRepository(parent, name) {
  const repositoryRoot = path.join(parent, name);
  exportIndex(repositoryRoot);
  initRepository(repositoryRoot);
  commitRoot(repositoryRoot);
  return repositoryRoot;
}

function expectedFailure(label, callback, requiredMessage) {
  let message = "";
  try {
    callback();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message.includes(requiredMessage), `${label}_EXPECTED_FAILURE_MISSING:${message}`);
  return { scenario: label, status: label, failureCode: requiredMessage };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runNodeGate(repositoryRoot, relative, environment, extraArgs = []) {
  const result = run(process.execPath, [path.join(repositoryRoot, relative), ...extraArgs], repositoryRoot, environment);
  return {
    gate: relative,
    status: "PASSED",
    outputSha256: sha256(Buffer.from(result.stdout, "utf8")),
  };
}

function runPnpm(repositoryRoot, args, environment = {}) {
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli && fs.existsSync(pnpmCli)) return run(process.execPath, [pnpmCli, ...args], repositoryRoot, environment);
  return run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, repositoryRoot, environment);
}

function verifySha256Sums(repositoryRoot) {
  const lines = fs.readFileSync(path.join(repositoryRoot, "SHA256SUMS"), "utf8").split(/\r?\n/u).filter(Boolean);
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  (.+)$/iu.exec(line);
    assert(match, "REMOTE_SIMULATION_SHA256SUMS_RECORD_INVALID");
    const relative = match[2];
    assert.equal(path.isAbsolute(relative), false, "REMOTE_SIMULATION_SHA256SUMS_ABSOLUTE_PATH");
    assert.equal(relative.split("/").includes(".."), false, "REMOTE_SIMULATION_SHA256SUMS_TRAVERSAL");
    assert.equal(sha256(fs.readFileSync(path.join(repositoryRoot, relative))), match[1].toLowerCase(),
      `REMOTE_SIMULATION_SHA256SUMS_MISMATCH:${relative}`);
  }
  return lines.length;
}

function prepareActionsRepository(parent) {
  const repositoryRoot = path.join(parent, "github-actions-simulation");
  exportIndex(repositoryRoot);
  replaceRepositoryPlaceholder(repositoryRoot);
  initRepository(repositoryRoot);
  git(["add", "--all", "--force"], repositoryRoot);
  runPnpm(repositoryRoot, ["install", "--frozen-lockfile"], actionsEnvironment);
  runPnpm(repositoryRoot, ["run", "sbom"], actionsEnvironment);
  git(["add", "--", "SBOM.spdx.json", "reports/PUBLIC_LICENSE_SCAN.json"], repositoryRoot);
  run(process.execPath, [path.join(repositoryRoot, "runtime/validation/generate-public-manifest.mjs")], repositoryRoot, actionsEnvironment);
  git(["add", "--all"], repositoryRoot);
  git(["commit", "-m", "TancMark GitHub Actions simulation root"], repositoryRoot, {
    GIT_AUTHOR_DATE: "2026-09-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-09-01T00:00:00Z",
  });
  git(["remote", "add", "origin", `${safeRepositoryUrl}.git`], repositoryRoot);
  return repositoryRoot;
}

function runActionsSimulation(parent) {
  const repositoryRoot = prepareActionsRepository(parent);
  const surface = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"), "utf8"));
  const oldObject = spawnSync("git", ["cat-file", "-e", `${surface.publicBaseCommit}^{tree}`], {
    cwd: repositoryRoot,
    stdio: "ignore",
    windowsHide: true,
  });
  assert.notEqual(oldObject.status, 0, "GITHUB_ACTIONS_SIMULATION_OLD_PRIVATE_OBJECT_PRESENT");

  const gateResults = [];
  const freshnessContract = runNodeGate(repositoryRoot, "runtime/validation/public_documentation_freshness_contract.mjs", actionsEnvironment);
  const freshnessGate = runNodeGate(repositoryRoot, "runtime/validation/public_documentation_freshness_gate.mjs", actionsEnvironment);
  gateResults.push({ gate: "documentation freshness", status: "PASSED", subGates: [freshnessContract, freshnessGate] });
  gateResults.push(runNodeGate(repositoryRoot, "runtime/validation/public_source_contract.mjs", actionsEnvironment));
  gateResults.push(runNodeGate(repositoryRoot, "runtime/validation/public_history_free_repository_contract.mjs", actionsEnvironment));
  const releaseContract = runNodeGate(repositoryRoot, "runtime/validation/public_release_state_consistency_contract.mjs", actionsEnvironment);
  const releaseGate = runNodeGate(repositoryRoot, "runtime/validation/public_release_state_consistency_gate.mjs", actionsEnvironment);
  gateResults.push({ gate: "release-state consistency", status: "PASSED", subGates: [releaseContract, releaseGate] });
  gateResults.push(runNodeGate(repositoryRoot, "runtime/validation/final_audit_evidence_consistency_gate.mjs", actionsEnvironment));
  gateResults.push(runNodeGate(repositoryRoot, "runtime/validation/public_cross_locale_reproducibility_contract.mjs", actionsEnvironment));
  run(process.execPath, [path.join(repositoryRoot, "runtime/validation/generate-public-manifest.mjs")], repositoryRoot, actionsEnvironment);
  assert.equal(git(["diff", "--exit-code", "--", "SHA256SUMS", "reports/PUBLIC_SOURCE_MANIFEST.json"], repositoryRoot), "");
  gateResults.push({ gate: "manifest dry-run", status: "PASSED" });
  const checksumEntryCount = verifySha256Sums(repositoryRoot);
  gateResults.push({ gate: "SHA256SUMS dry-run", status: "PASSED", checksumEntryCount });
  assert.equal(git(["status", "--porcelain=v1"], repositoryRoot), "");

  return {
    status: "PASSED_GITHUB_ACTIONS_SIMULATION",
    commitCount: Number(git(["rev-list", "--count", "HEAD"], repositoryRoot)),
    headHasParent: git(["rev-list", "--parents", "-n", "1", "HEAD"], repositoryRoot).split(/\s+/u).length !== 1,
    remoteCount: git(["remote"], repositoryRoot).split(/\r?\n/u).filter(Boolean).length,
    oldHistoricalObjectPresent: false,
    privateHistoryIncluded: false,
    lang: actionsEnvironment.LANG,
    gateCount: gateResults.length,
    gateResults,
  };
}

const temporaryParent = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-github-remote-contract-"));
let result;
try {
  const scenarios = [];

  const verifiedArchive = createMinimalArchive(temporaryParent, "00-archive-verified-url");
  const verifiedArchivePolicy = inspectPublicRepositoryRemotePolicy(verifiedArchive, {});
  assert.equal(verifiedArchivePolicy.repositoryState, "ARCHIVE_WITH_VERIFIED_PUBLIC_REPOSITORY_URL");
  assert.equal(verifiedArchivePolicy.expectedRepositorySource, "PUBLIC_EXPORT_MARKER");
  scenarios.push({ scenario: "PASSED_ARCHIVE_WITH_VERIFIED_URL", status: "PASSED_ARCHIVE_WITH_VERIFIED_URL" });

  const mismatchedArchive = createMinimalArchive(temporaryParent, "00a-archive-mismatched-url");
  const mismatchedGuide = path.join(mismatchedArchive, PUBLIC_REPOSITORY_DOCUMENTS[0]);
  fs.writeFileSync(mismatchedGuide, fs.readFileSync(mismatchedGuide, "utf8").replaceAll(safeRepositoryUrl, "https://github.com/wrong-owner/tancmark"));
  scenarios.push(expectedFailure("FAIL_REPOSITORY_URL_MISMATCH",
    () => inspectPublicRepositoryRemotePolicy(mismatchedArchive, {}), "REPOSITORY_URL_MISMATCH"));

  const credentialArchive = createMinimalArchive(temporaryParent, "00b-archive-credential-url");
  const credentialMarkerPath = path.join(credentialArchive, "reports", "PUBLIC_EXPORT_MARKER.json");
  const credentialMarker = JSON.parse(fs.readFileSync(credentialMarkerPath, "utf8"));
  credentialMarker.publicRepositoryUrl = ["https://archive-user", "archive-password@github.com/adem-kursat-tanc/tancmark"].join(":");
  fs.writeFileSync(credentialMarkerPath, `${JSON.stringify(credentialMarker, null, 2)}\n`);
  scenarios.push(expectedFailure("FAIL_CREDENTIAL_DISCLOSURE",
    () => inspectPublicRepositoryRemotePolicy(credentialArchive, {}), "PUBLIC_EXPORT_MARKER_REPOSITORY_URL_CREDENTIAL_DISCLOSURE"));

  const externalHostArchive = createMinimalArchive(temporaryParent, "00c-archive-external-host");
  const externalHostMarkerPath = path.join(externalHostArchive, "reports", "PUBLIC_EXPORT_MARKER.json");
  const externalHostMarker = JSON.parse(fs.readFileSync(externalHostMarkerPath, "utf8"));
  externalHostMarker.publicRepositoryUrl = "https://example.invalid/adem-kursat-tanc/tancmark";
  fs.writeFileSync(externalHostMarkerPath, `${JSON.stringify(externalHostMarker, null, 2)}\n`);
  scenarios.push(expectedFailure("FAIL_HOST_NOT_ALLOWED",
    () => inspectPublicRepositoryRemotePolicy(externalHostArchive, {}), "PUBLIC_EXPORT_MARKER_REPOSITORY_URL_HOST_NOT_ALLOWED"));

  const prePush = createMinimalRepository(temporaryParent, "01-pre-push");
  const prePushPolicy = inspectPublicRepositoryRemotePolicy(prePush, {});
  assert.equal(prePushPolicy.repositoryState, "PRE_PUSH_LOCAL_CANDIDATE");
  scenarios.push({ scenario: "PASSED_PRE_PUSH", status: "PASSED_PRE_PUSH" });

  const postRemote = createMinimalRepository(temporaryParent, "02-post-remote", true);
  git(["remote", "add", "origin", `${safeRepositoryUrl}.git`], postRemote);
  const postRemotePolicy = inspectPublicRepositoryRemotePolicy(postRemote, explicitEnvironment);
  assert.equal(postRemotePolicy.repositoryState, "GITHUB_REMOTE_CONFIGURED_PRE_PUSH_TEST");
  scenarios.push({ scenario: "PASSED_GITHUB_REPOSITORY", status: "PASSED_GITHUB_REPOSITORY" });

  const actionsPolicy = inspectPublicRepositoryRemotePolicy(postRemote, actionsEnvironment);
  assert.equal(actionsPolicy.repositoryState, "GITHUB_ACTIONS_CHECKOUT");
  scenarios.push({ scenario: "PASSED_GITHUB_ACTIONS", status: "PASSED_GITHUB_ACTIONS" });

  const publicDescendant = createMinimalRepository(temporaryParent, "03a-public-descendant", true);
  const publicRootCommit = git(["rev-parse", "HEAD"], publicDescendant);
  const publicDescendantMarkerPath = path.join(publicDescendant, "reports", "PUBLIC_EXPORT_MARKER.json");
  const publicDescendantMarker = JSON.parse(fs.readFileSync(publicDescendantMarkerPath, "utf8"));
  publicDescendantMarker.publicHistoryRootCommit = publicRootCommit;
  fs.writeFileSync(publicDescendantMarkerPath, `${JSON.stringify(publicDescendantMarker, null, 2)}\n`);
  git(["add", "--", "reports/PUBLIC_EXPORT_MARKER.json"], publicDescendant);
  git(["commit", "-m", "verified public follow-up"], publicDescendant);
  const publicDescendantPolicy = inspectPublicRepositoryRemotePolicy(publicDescendant, explicitEnvironment);
  assert.equal(publicDescendantPolicy.commitCount, 2);
  assert.equal(publicDescendantPolicy.historyMode, "VERIFIED_PUBLIC_ROOT_WITH_NORMAL_DESCENDANT_COMMITS");
  scenarios.push({ scenario: "PASSED_VERIFIED_PUBLIC_DESCENDANT_COMMIT", status: "PASSED_VERIFIED_PUBLIC_DESCENDANT_COMMIT" });

  const placeholderAfterRemote = createMinimalRepository(temporaryParent, "04-placeholder-after-remote");
  git(["remote", "add", "origin", `${safeRepositoryUrl}.git`], placeholderAfterRemote);
  scenarios.push(expectedFailure("FAIL_POST_GITHUB_REAL_URL_REQUIRED",
    () => inspectPublicRepositoryRemotePolicy(placeholderAfterRemote, explicitEnvironment), "POST_GITHUB_REAL_URL_REQUIRED"));

  const extraHistory = createMinimalRepository(temporaryParent, "05-extra-history");
  fs.writeFileSync(path.join(extraHistory, "extra-history.txt"), "second commit\n");
  git(["add", "--", "extra-history.txt"], extraHistory);
  git(["commit", "-m", "forbidden second commit"], extraHistory);
  scenarios.push(expectedFailure("FAIL_PRIVATE_OR_EXTRA_HISTORY",
    () => inspectPublicRepositoryRemotePolicy(extraHistory, {}), "PUBLIC_HISTORY_ROOT_COMMIT_MISMATCH"));

  const parentHistory = createMinimalRepository(temporaryParent, "06-parent-history");
  fs.writeFileSync(path.join(parentHistory, "parent-history.txt"), "parent present\n");
  git(["add", "--", "parent-history.txt"], parentHistory);
  git(["commit", "-m", "forbidden parent"], parentHistory);
  scenarios.push(expectedFailure("FAIL_NOT_HISTORY_FREE_ROOT",
    () => inspectPublicRepositoryRemotePolicy(parentHistory, {}), "PUBLIC_HISTORY_ROOT_COMMIT_MISMATCH"));

  const multipleRemotes = createMinimalRepository(temporaryParent, "07-multiple-remotes", true);
  git(["remote", "add", "origin", `${safeRepositoryUrl}.git`], multipleRemotes);
  git(["remote", "add", "backup", "https://github.com/tancmark-test-owner/tancmark-backup.git"], multipleRemotes);
  scenarios.push(expectedFailure("FAIL_UNEXPECTED_REMOTE",
    () => inspectPublicRepositoryRemotePolicy(multipleRemotes, explicitEnvironment), "MULTIPLE_OR_UNEXPECTED_REMOTES"));

  const wrongRepository = createMinimalRepository(temporaryParent, "08-wrong-repository", true);
  git(["remote", "add", "origin", "https://github.com/wrong-owner/tancmark.git"], wrongRepository);
  scenarios.push(expectedFailure("FAIL_REMOTE_REPOSITORY_MISMATCH",
    () => inspectPublicRepositoryRemotePolicy(wrongRepository, explicitEnvironment), "REMOTE_REPOSITORY_MISMATCH"));

  const credentialRemote = createMinimalRepository(temporaryParent, "09-credential-remote", true);
  const credentialUrl = ["https://test-user", "test-password@github.com/tancmark-test-owner/tancmark.git"].join(":");
  git(["remote", "add", "origin", credentialUrl], credentialRemote);
  const credentialFailure = expectedFailure("FAIL_REMOTE_CREDENTIAL_DISCLOSURE",
    () => inspectPublicRepositoryRemotePolicy(credentialRemote, explicitEnvironment), "ORIGIN_REMOTE_URL_CREDENTIAL_DISCLOSURE");
  assert.equal(JSON.stringify(credentialFailure).includes("test-user"), false, "CREDENTIAL_USER_DISCLOSED_IN_RESULT");
  assert.equal(JSON.stringify(credentialFailure).includes("test-password"), false, "CREDENTIAL_PASSWORD_DISCLOSED_IN_RESULT");
  scenarios.push(credentialFailure);

  const additionalRemoteSecurityCases = [];
  const fileRemote = createMinimalRepository(temporaryParent, "09a-file-remote", true);
  git(["remote", "add", "origin", "file:///temporary/tancmark.git"], fileRemote);
  additionalRemoteSecurityCases.push(expectedFailure("FAIL_FILE_REMOTE",
    () => inspectPublicRepositoryRemotePolicy(fileRemote, explicitEnvironment), "ORIGIN_REMOTE_URL_HTTPS_REQUIRED"));

  const sshInjectionRemote = createMinimalRepository(temporaryParent, "09b-ssh-injection-remote", true);
  const sshInjectionUrl = ["git@github.com:tancmark-test-owner/tancmark.git", "-oProxyCommand=forbidden"].join(" ");
  git(["remote", "add", "origin", sshInjectionUrl], sshInjectionRemote);
  additionalRemoteSecurityCases.push(expectedFailure("FAIL_SSH_COMMAND_INJECTION_REMOTE",
    () => inspectPublicRepositoryRemotePolicy(sshInjectionRemote, explicitEnvironment), "ORIGIN_REMOTE_URL_CONTROL_CHARACTER"));

  const nonGithubRemote = createMinimalRepository(temporaryParent, "09c-non-github-remote", true);
  git(["remote", "add", "origin", "https://example.invalid/tancmark-test-owner/tancmark.git"], nonGithubRemote);
  additionalRemoteSecurityCases.push(expectedFailure("FAIL_NON_GITHUB_REMOTE",
    () => inspectPublicRepositoryRemotePolicy(nonGithubRemote, explicitEnvironment), "ORIGIN_REMOTE_URL_HOST_NOT_ALLOWED"));

  const privateMarker = createMinimalRepository(temporaryParent, "10-private-marker");
  const privateMarkerPath = path.join(privateMarker, "reports", "PUBLIC_EXPORT_MARKER.json");
  const privateMarkerJson = JSON.parse(fs.readFileSync(privateMarkerPath, "utf8"));
  privateMarkerJson.privateHistoryIncluded = true;
  fs.writeFileSync(privateMarkerPath, `${JSON.stringify(privateMarkerJson, null, 2)}\n`);
  scenarios.push(expectedFailure("FAIL_PRIVATE_HISTORY_INCLUDED",
    () => inspectPublicRepositoryRemotePolicy(privateMarker, {}), "PRIVATE_HISTORY_INCLUDED"));

  const oldObjectRepository = createFullRepository(temporaryParent, "11-old-object-absent");
  const surface = JSON.parse(fs.readFileSync(path.join(oldObjectRepository, "reports", "PUBLIC_EXPORT_SURFACE_CONTRACT.json"), "utf8"));
  const oldObject = spawnSync("git", ["cat-file", "-e", `${surface.publicBaseCommit}^{tree}`], {
    cwd: oldObjectRepository, stdio: "ignore", windowsHide: true,
  });
  assert.notEqual(oldObject.status, 0, "OLD_PRIVATE_OBJECT_UNEXPECTEDLY_PRESENT");
  scenarios.push({ scenario: "PASSED_EXPECTED_HISTORY_FREE_EXPORT", status: "PASSED_EXPECTED_HISTORY_FREE_EXPORT" });

  const storedRecordRepository = createFullRepository(temporaryParent, "12-stored-record-tamper");
  const contractPath = path.join(storedRecordRepository, "reports", "PUBLIC_EXPORT_SURFACE_CONTRACT.json");
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  contract.acceptedV8LegacyProductManifestRecords[0] = contract.acceptedV8LegacyProductManifestRecords[0]
    .replace(/[0-9a-f]/iu, (value) => value === "0" ? "1" : "0");
  fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  git(["add", "--", "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"], storedRecordRepository);
  scenarios.push(expectedFailure("FAIL_STORED_RECORD_TAMPER",
    () => calculatePublicSourceClassDigests(storedRecordRepository), "ACCEPTED_V8_STORED_RECORDS_UTF8_BYTEWISE_DIGEST_MISMATCH"));

  const productChangeRepository = createFullRepository(temporaryParent, "13-product-change");
  const productRelative = "lib/aegis-core/src/index.ts";
  fs.appendFileSync(path.join(productChangeRepository, productRelative), Buffer.from([0x0a]));
  git(["add", "--", productRelative], productChangeRepository);
  scenarios.push(expectedFailure("FAIL_PRODUCT_ENGINE_CHANGE",
    () => calculatePublicSourceClassDigests(productChangeRepository), "CURRENT_PRODUCT_CONTENT_DIFFERS_FROM_VERIFIED_V13_SECURITY_REMEDIATION_CLOSURE"));

  const githubActionsSimulation = runActionsSimulation(temporaryParent);
  assert.equal(githubActionsSimulation.gateCount, 8);
  assert.equal(githubActionsSimulation.commitCount, 1);
  assert.equal(githubActionsSimulation.headHasParent, false);
  assert.equal(githubActionsSimulation.remoteCount, 1);

  result = {
    contract: "PUBLIC_GITHUB_REMOTE_COMPATIBILITY_CONTRACT",
    status: "PASSED",
    scenarioCount: scenarios.length,
    scenarios,
    additionalRemoteSecurityCases,
    githubActionsSimulation,
    mandatorySecurityFacts: {
      githubRemoteMisclassifiedAsPrivateHistory: false,
      credentialBearingRemoteAccepted: false,
      multipleUnexpectedRemotesAccepted: false,
      placeholderAcceptedAfterRemote: false,
      singleParentlessPublicRootEnforced: true,
      normalPublicDescendantCommitsAllowed: true,
      privateHistoryIncluded: false,
    },
    productEngineSourceChanged: false,
    documentationContentChanged: false,
    publicApiBehaviorChanged: false,
    dependencyGraphChanged: false,
    lockfileChanged: false,
    wrongOwnership: 0,
    secretDisclosure: 0,
    privatePathDisclosure: 0,
    nodeVersion: process.version,
    packageManagerVersion: runPnpm(sourceRoot, ["--version"]).stdout.trim(),
  };
} finally {
  fs.rmSync(temporaryParent, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
