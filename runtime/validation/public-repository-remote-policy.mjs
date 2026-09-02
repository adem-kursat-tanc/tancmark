// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PUBLIC_REPOSITORY_PLACEHOLDER = "<GITHUB_REPOSITORY_URL>";
export const PUBLIC_REPOSITORY_DOCUMENTS = Object.freeze([
  "docs/USER_GUIDE.md",
  "docs/USER_GUIDE_TR.md",
  "docs/OPERATOR_GUIDE.md",
  "docs/OPERATOR_GUIDE_TR.md",
  "docs/TROUBLESHOOTING.md",
  "docs/TROUBLESHOOTING_TR.md",
  "docs/DOCUMENTATION_INDEX.md",
]);

function git(checkRoot, args) {
  return execFileSync("git", args, {
    cwd: checkRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function gitOptional(checkRoot, args) {
  try {
    return git(checkRoot, args);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) return "";
    throw error;
  }
}

function policyError(code) {
  return new Error(`PUBLIC_REPOSITORY_REMOTE_POLICY:${code}`);
}

function fail(code) {
  throw policyError(code);
}

function safeGithubServerUrl(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) fail("GITHUB_SERVER_URL_MISSING");
  if (/\s|[\u0000-\u001f\u007f]/u.test(rawValue)) fail("GITHUB_SERVER_URL_CONTROL_CHARACTER");
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    fail("GITHUB_SERVER_URL_INVALID");
  }
  if (parsed.protocol !== "https:") fail("GITHUB_SERVER_URL_HTTPS_REQUIRED");
  if (parsed.username || parsed.password) fail("GITHUB_SERVER_URL_CREDENTIAL_DISCLOSURE");
  if (parsed.hostname.toLowerCase() !== "github.com") fail("GITHUB_SERVER_URL_HOST_NOT_ALLOWED");
  if (parsed.port || parsed.search || parsed.hash) fail("GITHUB_SERVER_URL_UNEXPECTED_COMPONENT");
  if (parsed.pathname !== "/" && parsed.pathname !== "") fail("GITHUB_SERVER_URL_PATH_NOT_ALLOWED");
  return "https://github.com";
}

export function canonicalizePublicGithubRepositoryUrl(rawValue, label = "REPOSITORY_URL") {
  if (typeof rawValue !== "string" || rawValue.length === 0) fail(`${label}_MISSING`);
  if (/\s|[\u0000-\u001f\u007f]/u.test(rawValue)) fail(`${label}_CONTROL_CHARACTER`);
  if (/^(?:ssh|git\+ssh):/iu.test(rawValue) || /^[^/\s@]+@[^:]+:/u.test(rawValue)) {
    fail(`${label}_SSH_NOT_ALLOWED_BY_PUBLIC_POLICY`);
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    fail(`${label}_INVALID`);
  }
  if (parsed.username || parsed.password) fail(`${label}_CREDENTIAL_DISCLOSURE`);
  if (parsed.protocol !== "https:") fail(`${label}_HTTPS_REQUIRED`);
  if (parsed.hostname.toLowerCase() !== "github.com") fail(`${label}_HOST_NOT_ALLOWED`);
  if (parsed.port || parsed.search || parsed.hash) fail(`${label}_UNEXPECTED_COMPONENT`);

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) fail(`${label}_PATH_INVALID`);
  const owner = segments[0];
  const repository = segments[1].replace(/\.git$/iu, "");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u.test(owner)) fail(`${label}_OWNER_INVALID`);
  if (!/^[A-Za-z0-9._-]+$/u.test(repository)) fail(`${label}_NAME_INVALID`);
  if (repository.toLowerCase() !== "tancmark") fail(`${label}_TARGET_NAME_MISMATCH`);
  const canonicalUrl = `https://github.com/${owner}/${repository}`;
  return { canonicalUrl, comparisonKey: canonicalUrl.toLowerCase() };
}

export function expectedPublicRepositoryUrl(environment = process.env) {
  const githubServer = environment.GITHUB_SERVER_URL;
  const githubRepository = environment.GITHUB_REPOSITORY;
  if ((githubServer && !githubRepository) || (!githubServer && githubRepository)) {
    fail("GITHUB_ACTIONS_REPOSITORY_ENV_INCOMPLETE");
  }

  let githubExpected = null;
  if (githubServer && githubRepository) {
    const server = safeGithubServerUrl(githubServer);
    if (!/^[^/\s]+\/[^/\s]+$/u.test(githubRepository)) fail("GITHUB_REPOSITORY_INVALID");
    githubExpected = canonicalizePublicGithubRepositoryUrl(`${server}/${githubRepository}`, "GITHUB_REPOSITORY");
  }

  const explicitExpected = environment.TANCMARK_PUBLIC_REPOSITORY_URL
    ? canonicalizePublicGithubRepositoryUrl(environment.TANCMARK_PUBLIC_REPOSITORY_URL, "TANCMARK_PUBLIC_REPOSITORY_URL")
    : null;
  if (githubExpected && explicitExpected && githubExpected.comparisonKey !== explicitExpected.comparisonKey) {
    fail("EXPECTED_REPOSITORY_SOURCES_DISAGREE");
  }
  if (githubExpected) return { ...githubExpected, source: "GITHUB_ACTIONS_ENVIRONMENT" };
  if (explicitExpected) return { ...explicitExpected, source: "EXPLICIT_ENVIRONMENT" };
  return null;
}

function readRepositoryDocuments(checkRoot) {
  return PUBLIC_REPOSITORY_DOCUMENTS.map((relative) => {
    const absolute = path.join(checkRoot, relative);
    assert.equal(fs.existsSync(absolute), true, `PUBLIC_REPOSITORY_DOCUMENT_MISSING:${relative}`);
    return { relative, text: fs.readFileSync(absolute, "utf8") };
  });
}

function assertPlaceholderTransition(documents, expected, remoteCount, environmentExpected) {
  const placeholderDocuments = documents.filter(({ text }) => text.includes(PUBLIC_REPOSITORY_PLACEHOLDER));
  if (remoteCount === 0 && !environmentExpected && placeholderDocuments.length === documents.length) {
    if (placeholderDocuments.length !== documents.length) fail("PRE_PUSH_REPOSITORY_URL_PLACEHOLDER_MISSING");
    return "PRE_PUSH_REPOSITORY_URL_OWNER_STEP";
  }
  if (!expected) fail("REMOTE_EXPECTED_REPOSITORY_URL_MISSING");
  if (placeholderDocuments.length > 0) fail("POST_GITHUB_REAL_URL_REQUIRED");
  const mismatched = documents.filter(({ text }) => !text.includes(expected.canonicalUrl));
  if (mismatched.length > 0) fail("POST_GITHUB_REAL_URL_DOCUMENT_MISMATCH");
  return "POST_REMOTE_REAL_REPOSITORY_URL_VERIFIED";
}

function markerPublicRepositoryUrl(marker) {
  return {
    ...canonicalizePublicGithubRepositoryUrl(marker.publicRepositoryUrl, "PUBLIC_EXPORT_MARKER_REPOSITORY_URL"),
    source: "PUBLIC_EXPORT_MARKER",
  };
}

function assertArchiveRepositoryDocuments(documents, expected) {
  if (documents.some(({ text }) => text.includes(PUBLIC_REPOSITORY_PLACEHOLDER))) {
    fail("REPOSITORY_URL_MISMATCH");
  }
  if (documents.some(({ text }) => !text.includes(expected.canonicalUrl))) {
    fail("REPOSITORY_URL_MISMATCH");
  }
  return "ARCHIVE_PUBLIC_REPOSITORY_URL_VERIFIED";
}

export function inspectPublicRepositoryRemotePolicy(checkRoot, environment = process.env) {
  const markerPath = path.join(checkRoot, "reports", "PUBLIC_EXPORT_MARKER.json");
  assert.equal(fs.existsSync(markerPath), true, "PUBLIC_REPOSITORY_PUBLIC_EXPORT_MARKER_MISSING");
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  if (marker.publicExport !== true) fail("PUBLIC_EXPORT_MARKER_INVALID");
  if (marker.privateHistoryIncluded !== false) fail("PRIVATE_HISTORY_INCLUDED");

  const documents = readRepositoryDocuments(checkRoot);
  const environmentExpected = expectedPublicRepositoryUrl(environment);
  const markerExpected = markerPublicRepositoryUrl(marker);
  if (environmentExpected && environmentExpected.comparisonKey !== markerExpected.comparisonKey) {
    fail("EXPECTED_REPOSITORY_SOURCES_DISAGREE");
  }
  const expected = environmentExpected ?? markerExpected;
  const gitMetadata = fs.existsSync(path.join(checkRoot, ".git"));
  if (!gitMetadata) {
    const placeholderStatus = assertArchiveRepositoryDocuments(documents, markerExpected);
    return {
      repositoryState: "ARCHIVE_WITH_VERIFIED_PUBLIC_REPOSITORY_URL",
      placeholderStatus,
      commitCount: null,
      rootCommitHasParent: null,
      remoteCount: 0,
      remoteName: null,
      remoteUrl: markerExpected.canonicalUrl,
      expectedRepositorySource: markerExpected.source,
      publicExport: true,
      privateHistoryIncluded: false,
    };
  }

  const repositoryRoot = git(checkRoot, ["rev-parse", "--show-toplevel"]);
  assert.equal(path.resolve(repositoryRoot), path.resolve(checkRoot), "PUBLIC_REPOSITORY_NESTED_IN_OTHER_REPOSITORY");
  const commitCount = Number(git(checkRoot, ["rev-list", "--count", "HEAD"]));
  const headParents = git(checkRoot, ["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/u).filter(Boolean);
  const headHasParent = headParents.length !== 1;
  const rootCommits = git(checkRoot, ["rev-list", "--max-parents=0", "HEAD"]).split(/\r?\n/u).filter(Boolean);
  if (rootCommits.length !== 1) fail("SINGLE_PARENTLESS_PUBLIC_ROOT_REQUIRED");
  const rootCommit = rootCommits[0];
  const rootParents = git(checkRoot, ["rev-list", "--parents", "-n", "1", rootCommit]).split(/\s+/u).filter(Boolean);
  const rootCommitHasParent = rootParents.length !== 1;
  const historyFailures = [];
  if (rootCommitHasParent) historyFailures.push("HEAD_PARENT_PRESENT");
  if (commitCount === 1 && headHasParent) historyFailures.push("HEAD_PARENT_PRESENT");
  if (commitCount > 1) {
    if (marker.publicHistoryPolicy !== "VERIFIED_PARENTLESS_PUBLIC_ROOT_WITH_NORMAL_DESCENDANT_COMMITS") {
      historyFailures.push("PUBLIC_HISTORY_POLICY_MISSING");
    }
    if (!/^[0-9a-f]{40}$/u.test(marker.publicHistoryRootCommit ?? "")) {
      historyFailures.push("PUBLIC_HISTORY_ROOT_COMMIT_INVALID");
    } else if (rootCommit !== marker.publicHistoryRootCommit) {
      historyFailures.push("PUBLIC_HISTORY_ROOT_COMMIT_MISMATCH");
    }
  }
  if (historyFailures.length > 0) fail(historyFailures.join("+"));

  const remoteNames = git(checkRoot, ["remote"]).split(/\r?\n/u).filter(Boolean);
  if (remoteNames.length > 1) fail("MULTIPLE_OR_UNEXPECTED_REMOTES");
  if (remoteNames.length === 1 && remoteNames[0] !== "origin") fail("UNEXPECTED_REMOTE_NAME");

  let remote = null;
  if (remoteNames.length === 1) {
    const urls = git(checkRoot, ["config", "--get-all", "remote.origin.url"]).split(/\r?\n/u).filter(Boolean);
    if (urls.length !== 1) fail("ORIGIN_URL_COUNT_INVALID");
    const pushUrls = gitOptional(checkRoot, ["config", "--get-all", "remote.origin.pushurl"]).split(/\r?\n/u).filter(Boolean);
    if (pushUrls.length > 0) fail("ORIGIN_PUSH_URL_FORBIDDEN");
    remote = canonicalizePublicGithubRepositoryUrl(urls[0], "ORIGIN_REMOTE_URL");
    if (!expected) fail("REMOTE_EXPECTED_REPOSITORY_URL_MISSING");
    if (remote.comparisonKey !== expected.comparisonKey) fail("REMOTE_REPOSITORY_MISMATCH");
  }

  const placeholderStatus = assertPlaceholderTransition(documents, expected, remoteNames.length, environmentExpected);
  const githubActions = environment.GITHUB_ACTIONS === "true" && expected?.source === "GITHUB_ACTIONS_ENVIRONMENT";
  return {
    repositoryState: remoteNames.length === 0
      ? "PRE_PUSH_LOCAL_CANDIDATE"
      : githubActions ? "GITHUB_ACTIONS_CHECKOUT" : "GITHUB_REMOTE_CONFIGURED_PRE_PUSH_TEST",
    placeholderStatus,
    commitCount,
    historyMode: commitCount === 1 ? "SINGLE_PARENTLESS_PUBLIC_ROOT" : "VERIFIED_PUBLIC_ROOT_WITH_NORMAL_DESCENDANT_COMMITS",
    rootCommit,
    headHasParent,
    rootCommitHasParent,
    remoteCount: remoteNames.length,
    remoteName: remoteNames[0] ?? null,
    remoteUrl: remote?.canonicalUrl ?? null,
    expectedRepositorySource: expected?.source ?? null,
    publicExport: true,
    privateHistoryIncluded: false,
  };
}
