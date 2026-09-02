// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PNPM_VERSION = "10.34.5";
const PNPM_INTEGRITY = "sha512-pO4F8vc2WCVb1qiYWcBlpFwopX2u+uLIk6Fo7itzFow3uR6D5X6mdlStA/AwMXRkMOi84442LgQmBfuKvIAZLg==";
const PNPM_SHASUM = "6a91127a7f2ca72fe53bb9ff54883e0c75b22f17";
const PNPM_TAG_COMMIT = "702ad5f860ffd50d64a3a711d9f8a3da16fc796e";
const UNZIPPER_VERSION = "0.12.5";
const UNZIPPER_INTEGRITY = "sha512-tXYOi9R57Uj/2Z25SOs5RRSzq886MBQj2gY8dPL+xl/kv6s6SvByoKfAtvfVeEuhntWDgjd2o9p2lb4TVPAz0A==";
const UNZIPPER_SHASUM = "7fc6b4862f3832202d1f5cc3adbee2679deaaf6c";
const UNZIPPER_GIT_HEAD = "aaf77f0c7b4d29af500b0aa9c0e2aa2ade0a2618";
const UNZIPPER_FIX_COMMIT = "dd164d828787396d3b657ec08291dac885c11c87";
const UNZIPPER_SOURCE_HASHES = Object.freeze({
  "lib/extract.js": "45894edaa4fb188ed5696501f4618f7187fa3cd4d35ffc79a0987c5132954a02",
  "lib/Open/directory.js": "47c63bcd159d1facc02375aec9916bfee1a3ebfd3ae5338e10f6db2846a16645",
});
const NETWORK_TIMEOUT_MS = 30_000;

function sha(bytes, algorithm, encoding = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

async function get(url, kind = "json") {
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      headers: {
        accept: kind === "json" ? "application/vnd.github+json, application/json" : "*/*",
        "user-agent": "TancMark-Public-Package-Manager-Security-Gate/1.0",
        "x-github-api-version": "2022-11-28",
      },
    });
  } catch (error) {
    const wrapped = new Error("PACKAGE_MANAGER_ADVISORY_CHECK_NOT_RUN_NETWORK_UNAVAILABLE");
    wrapped.cause = error;
    throw wrapped;
  }
  if (!response.ok) throw new Error(`official_source_http_${response.status}:${url}`);
  return kind === "json" ? response.json() : Buffer.from(await response.arrayBuffer());
}

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "ignore"],
    }).toString("utf8").split("\0").filter(Boolean);
  } catch {
    const sumsPath = path.join(root, "SHA256SUMS");
    const manifestPath = path.join(root, "reports", "PUBLIC_SOURCE_MANIFEST.json");
    const sumsBytes = fs.readFileSync(sumsPath);
    const records = sumsBytes.toString("utf8").trimEnd().split(/\r?\n/).map((line) => {
      const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
      assert(match, `invalid_source_checksum_line:${line}`);
      return { expectedSha256: match[1], relative: match[2] };
    });
    assert(records.length > 0, "source_checksum_inventory_empty");
    assert.equal(new Set(records.map(({ relative }) => relative)).size, records.length, "duplicate_source_checksum_path");
    for (const { expectedSha256, relative } of records) {
      assert(!relative.includes("\\"), `source_checksum_backslash_path:${relative}`);
      assert(!path.posix.isAbsolute(relative), `source_checksum_absolute_path:${relative}`);
      assert.equal(path.posix.normalize(relative), relative, `source_checksum_noncanonical_path:${relative}`);
      assert(!relative.startsWith("../"), `source_checksum_parent_path:${relative}`);
      const absolute = path.join(root, ...relative.split("/"));
      const stat = fs.lstatSync(absolute);
      assert(stat.isFile() && !stat.isSymbolicLink(), `source_checksum_not_regular_file:${relative}`);
      assert.equal(sha(fs.readFileSync(absolute), "sha256"), expectedSha256, `source_checksum_mismatch:${relative}`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.fileCount, records.length, "source_manifest_count_mismatch");
    assert.equal(manifest.entries?.length, records.length, "source_manifest_entries_mismatch");
    assert.equal(manifest.sha256SumsSha256, sha(sumsBytes, "sha256"), "source_manifest_checksum_binding_mismatch");
    const expectedByPath = new Map(records.map(({ relative, expectedSha256 }) => [relative, expectedSha256]));
    for (const entry of manifest.entries) {
      assert.equal(entry.sha256, expectedByPath.get(entry.path), `source_manifest_entry_mismatch:${entry.path}`);
    }
    return [...records.map(({ relative }) => relative), "SHA256SUMS", "reports/PUBLIC_SOURCE_MANIFEST.json"];
  }
}

function inspectProjectConfiguration(files) {
  const configPaths = files.filter((relative) =>
    /(^|\/)(?:package\.json|pnpm-workspace\.yaml|pnpmfile\.(?:cjs|js)|\.npmrc|\.pnpmrc|\.yarnrc(?:\.yml)?)$/i.test(relative)
      || relative === "pnpm-lock.yaml");
  const findings = [];
  for (const relative of configPaths) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    if (/(?:https?Proxy|noProxy|proxy|noproxy)\s*:\s*[^\r\n]*\$\{[^}]+\}/i.test(text)) findings.push(`${relative}:secret_proxy_expansion`);
    if (/tokenHelper/i.test(text)) findings.push(`${relative}:token_helper`);
    if (/(?:registry|registries|pnprServer)\s*:\s*(?!https:\/\/registry\.npmjs\.org\/?)[^\r\n]+/i.test(text)) findings.push(`${relative}:alternate_registry`);
    if (/dangerouslyAllowAllBuilds\s*:\s*true|enablePrePostScripts\s*:\s*true/i.test(text)) findings.push(`${relative}:lifecycle_bypass`);
    if (/patchedDependencies[\s\S]{0,200}(?:\.\.\/|\.\.\\|^[A-Za-z]:|^\\\\|^\/)/im.test(text)) findings.push(`${relative}:patch_path_traversal`);
  }

  const workspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  assert.match(workspace, /ignoredBuiltDependencies:\s*\r?\n\s+- '@contentauth\/c2pa-node'/);
  assert.match(workspace, /onlyBuiltDependencies:/);
  assert.doesNotMatch(workspace, /(?:https?Proxy|noProxy|proxy|noproxy|tokenHelper|registries?|pnprServer)\s*:/i);

  const packages = files.filter((relative) => relative.endsWith("package.json"));
  const nonRegistryDependencies = [];
  for (const relative of packages) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
    for (const group of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      for (const [name, specifier] of Object.entries(pkg[group] || {})) {
        if (/^(?:git(?:\+[^:]+)?|github|https?|ssh|file|link):/i.test(String(specifier))) {
          nonRegistryDependencies.push(`${relative}:${group}:${name}:${specifier}`);
        }
      }
    }
  }
  assert.deepEqual(nonRegistryDependencies, []);

  const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  const resolutionCount = (lock.match(/^\s+resolution:/gm) || []).length;
  const integrityCount = (lock.match(/^\s+resolution: \{integrity: sha512-/gm) || []).length;
  assert.equal(resolutionCount, integrityCount, "lockfile_registry_resolution_without_sha512_integrity");
  assert.doesNotMatch(lock, /^\s+resolution: \{(?:tarball|repo|commit):/gm);
  assert.doesNotMatch(lock, /(?:git\+|github:|ssh:|https?:\/\/[^\s]+\.git)/i);
  assert.deepEqual(findings, []);
  return { configFileCount: configPaths.length, resolutionCount, integrityCount, findings, nonRegistryDependencies };
}

function inspectActiveVersionReferences(files) {
  const active = files.filter((relative) =>
    relative === "package.json" || relative === "README.md" || relative === "CONTRIBUTING.md"
      || relative === "pnpm-lock.yaml" || relative.startsWith("docs/") || relative.startsWith(".github/workflows/"));
  const stale = [];
  let currentReferenceCount = 0;
  for (const relative of active) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    for (const match of text.matchAll(/pnpm(?:@|\s+)(10\.\d+\.\d+)/gi)) {
      if (match[1] !== PNPM_VERSION) stale.push(`${relative}:${match[1]}`);
      else currentReferenceCount += 1;
    }
  }
  assert.deepEqual(stale, []);
  assert(currentReferenceCount >= 5, `current_pnpm_reference_count_too_low:${currentReferenceCount}`);
  return { currentReferenceCount, staleReferenceCount: stale.length };
}

async function verifyNpmPackage(name, version, expected) {
  const metadata = await get(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`);
  assert.equal(metadata.version, version);
  assert.equal(metadata.license, "MIT");
  assert.equal(metadata.dist.integrity, expected.integrity);
  assert.equal(metadata.dist.shasum, expected.shasum);
  const tarball = await get(metadata.dist.tarball, "bytes");
  assert.equal(`sha512-${sha(tarball, "sha512", "base64")}`, expected.integrity);
  assert.equal(sha(tarball, "sha1"), expected.shasum);
  assert(Array.isArray(metadata.dist.signatures) && metadata.dist.signatures.length > 0, `${name}_npm_signature_missing`);
  return { metadata, tarballBytes: tarball.length };
}

async function main() {
  const files = trackedFiles();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.packageManager, `pnpm@${PNPM_VERSION}`);
  assert.equal(pkg.dependencies?.unzipper, UNZIPPER_VERSION);
  assert(Number(process.versions.node.split(".")[0]) >= 24, `node_24_required:${process.versions.node}`);
  const versionReferences = inspectActiveVersionReferences(files);
  const configuration = inspectProjectConfiguration(files);

  const pnpmRegistry = await get("https://registry.npmjs.org/pnpm");
  assert.equal(pnpmRegistry["dist-tags"]["latest-10"], PNPM_VERSION);
  const pnpmPackage = await verifyNpmPackage("pnpm", PNPM_VERSION, { integrity: PNPM_INTEGRITY, shasum: PNPM_SHASUM });
  assert.equal(pnpmPackage.metadata.engines.node, ">=18.12");
  const pnpmTag = await get(`https://api.github.com/repos/pnpm/pnpm/git/ref/tags/v${PNPM_VERSION}`);
  assert.equal(pnpmTag.object.sha, PNPM_TAG_COMMIT);
  const pnpmSourcePackage = JSON.parse((await get(`https://raw.githubusercontent.com/pnpm/pnpm/v${PNPM_VERSION}/pnpm/package.json`, "bytes")).toString("utf8"));
  assert.equal(pnpmSourcePackage.name, "pnpm");
  assert.equal(pnpmSourcePackage.version, PNPM_VERSION);
  assert.equal(pnpmSourcePackage.license, "MIT");

  const currentPnpmAdvisories = await get(`https://api.github.com/advisories?ecosystem=npm&affects=pnpm%40${PNPM_VERSION}&per_page=100`);
  const oldPnpmAdvisories = await get("https://api.github.com/advisories?ecosystem=npm&affects=pnpm%4010.23.0&per_page=100");
  assert(oldPnpmAdvisories.length > 0, "old_pnpm_advisory_control_missing");
  const blockingPnpm = currentPnpmAdvisories.filter((entry) => ["critical", "high"].includes(String(entry.severity).toLowerCase()));
  assert.deepEqual(blockingPnpm, []);

  const unzipperPackage = await verifyNpmPackage("unzipper", UNZIPPER_VERSION, { integrity: UNZIPPER_INTEGRITY, shasum: UNZIPPER_SHASUM });
  assert.equal(unzipperPackage.metadata.gitHead, UNZIPPER_GIT_HEAD);
  assert.equal(unzipperPackage.metadata.dist.attestations?.provenance?.predicateType, "https://slsa.dev/provenance/v1");
  const compare = await get(`https://api.github.com/repos/ZJONSSON/node-unzipper/compare/${UNZIPPER_FIX_COMMIT}...${UNZIPPER_GIT_HEAD}`);
  assert(["ahead", "identical"].includes(compare.status), `unzipper_fix_not_ancestor:${compare.status}`);
  for (const [relative, expectedHash] of Object.entries(UNZIPPER_SOURCE_HASHES)) {
    const installed = path.join(root, "node_modules", "unzipper", ...relative.split("/"));
    assert.equal(sha(fs.readFileSync(installed), "sha256"), expectedHash, `unzipper_installed_source_mismatch:${relative}`);
    const official = await get(`https://raw.githubusercontent.com/ZJONSSON/node-unzipper/${UNZIPPER_GIT_HEAD}/${relative}`, "bytes");
    assert.equal(sha(official, "sha256"), expectedHash, `unzipper_official_source_mismatch:${relative}`);
    const source = official.toString("utf8");
    assert.match(source, /path\.relative\(opts\.path, extractPath\)/);
    assert.doesNotMatch(source, /extractPath\.indexOf\(opts\.path\)/);
  }
  const currentUnzipperAdvisories = await get(`https://api.github.com/advisories?ecosystem=npm&affects=unzipper%40${UNZIPPER_VERSION}&per_page=100`);
  const blockingUnzipper = currentUnzipperAdvisories.filter((entry) => ["critical", "high"].includes(String(entry.severity).toLowerCase()));
  assert.deepEqual(blockingUnzipper, []);

  const installer = fs.readFileSync(path.join(root, "runtime/c2pa/install-verified-native.mjs"), "utf8");
  const archiveReader = fs.readFileSync(path.join(root, "runtime/c2pa/verified-single-entry-archive.mjs"), "utf8");
  assert.match(installer, /readVerifiedSingleEntryArchive/);
  assert.doesNotMatch(`${installer}\n${archiveReader}`, /\.Extract\s*\(|Open\.directory|\.extract\s*\(/);
  assert.match(archiveReader, /archive\.files\.length !== 1/);
  assert.match(archiveReader, /expectedEntryPath = "index\.node"/);
  assert.match(archiveReader, /c2pa_native_archive_compression_ratio_exceeded/);
  assert.match(archiveReader, /c2pa_native_archive_crc_mismatch/);

  process.stdout.write(`${JSON.stringify({
    gate: "PUBLIC_PACKAGE_MANAGER_SECURITY_GATE",
    status: "PASSED",
    nodeVersion: process.versions.node,
    pnpm: {
      version: PNPM_VERSION,
      npmIntegrity: PNPM_INTEGRITY,
      npmShasum: PNPM_SHASUM,
      npmSignaturePresent: true,
      tarballBytes: pnpmPackage.tarballBytes,
      officialTagCommit: PNPM_TAG_COMMIT,
      currentAdvisoryCount: currentPnpmAdvisories.length,
      currentCriticalHighCount: blockingPnpm.length,
      oldVersionAdvisoryControlCount: oldPnpmAdvisories.length,
    },
    unzipper: {
      version: UNZIPPER_VERSION,
      npmIntegrity: UNZIPPER_INTEGRITY,
      npmShasum: UNZIPPER_SHASUM,
      npmSignaturePresent: true,
      npmProvenancePresent: true,
      tarballBytes: unzipperPackage.tarballBytes,
      sourceCommit: UNZIPPER_GIT_HEAD,
      fixCommit: UNZIPPER_FIX_COMMIT,
      fixCommitIsAncestor: true,
      currentAdvisoryCount: currentUnzipperAdvisories.length,
      currentCriticalHighCount: blockingUnzipper.length,
    },
    versionReferences,
    configuration,
    reachableToolchainCritical: 0,
    reachableToolchainHigh: 0,
  }, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "PACKAGE_MANAGER_ADVISORY_CHECK_NOT_RUN_NETWORK_UNAVAILABLE") {
    process.stderr.write(`${JSON.stringify({ gate: "PUBLIC_PACKAGE_MANAGER_SECURITY_GATE", status: message })}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
  process.exitCode = 1;
});
