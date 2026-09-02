// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareUtf8By,
  DETERMINISTIC_ORDER_ALGORITHM,
  sortUtf8Bytewise,
} from "./deterministic-utf8-order.mjs";
import { inspectPublicRepositoryRemotePolicy } from "./public-repository-remote-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const docs = {
  user: "docs/USER_GUIDE.md",
  userTr: "docs/USER_GUIDE_TR.md",
  operator: "docs/OPERATOR_GUIDE.md",
  operatorTr: "docs/OPERATOR_GUIDE_TR.md",
  apiExamples: "docs/API_EXAMPLES.md",
  apiExamplesTr: "docs/API_EXAMPLES_TR.md",
  troubleshooting: "docs/TROUBLESHOOTING.md",
  troubleshootingTr: "docs/TROUBLESHOOTING_TR.md",
  results: "docs/RESULTS_AND_TERMS.md",
  resultsTr: "docs/RESULTS_AND_TERMS_TR.md",
  index: "docs/DOCUMENTATION_INDEX.md",
  feature: "docs/FEATURE_STATUS.md",
  c2pa: "docs/C2PA_GUIDE.md",
  security: "docs/SECURITY_DEPLOYMENT_GUIDE.md",
  changelog: "CHANGELOG.md",
};
const CURRENT_INVENTORY_SENTENCE = "Current V13 inventory covers 1,188 dependencies: 677 JavaScript packages and 511 native Rust packages. Unresolved license count is zero. This is not a legal-approval claim.";
const LEGACY_TR_V1_PRODUCT_BLOB_MANIFEST_SHA256 = "e256584b9f7f86129a6282580ca60430410ec045128e605681513e5e9fafa66b";
const ACCEPTED_V8_PRODUCT_BLOB_MANIFEST_SHA256 = "a67c71b81c79d0345d641155a9ed523a324ac7a48420c5cc096524f5ccba77b8";
const CURRENT_PRODUCT_BLOB_MANIFEST_SHA256 = "9f155563591a7869a9747bc1844a34f6eea97487f029ab98d76a332e94aa352a";
const DOCUMENTATION_AUDIT = "reports/DOCUMENTATION_SOURCE_OF_TRUTH_AUDIT.json";
const PUBLIC_EXPORT_SURFACE_CONTRACT = "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json";
const PUBLIC_SOURCE_MANIFEST = "reports/PUBLIC_SOURCE_MANIFEST.json";

const normalized = (value) => value.replaceAll("\\", "/").replace(/^\.\//, "");
const generated = (file) => /(^|\/)(generated|dist|dist-product|coverage)(\/|$)/.test(file)
  || /\.(generated|gen)\.(ts|js)$/.test(file)
  || file === "SHA256SUMS" || file === "SBOM.spdx.json" || file.startsWith("reports/");

export function documentationRequirements(changedFiles) {
  const changed = new Set(changedFiles.map(normalized));
  const source = [...changed].filter((file) => !generated(file));
  const required = new Set();
  for (const file of source) {
    if (/openapi\.ya?ml$|\/routes\/|\/cli\/|(^|\/)bin\//.test(file)) required.add(docs.user);
    if (/package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|\.github\/workflows\/|runtime\/preinstall|build\.mjs$/.test(file)) required.add(docs.operator);
    if (/C2pa|c2pa|Status|status|supported|format|FEATURE_STATUS/.test(file)) required.add(docs.feature);
    if (/C2pa|c2pa/.test(file)) required.add(docs.c2pa);
    if (/Security|security|Policy|policy|Auth|auth|\.github\/|\.env\.example$/.test(file)) required.add(docs.security);
  }
  if (required.size > 0) required.add(docs.changelog);
  return { changed, source, required: sortUtf8Bytewise(required) };
}

export function evaluateCurrentReleaseDocumentation(documents) {
  const failures = [];
  for (const [name, text] of Object.entries(documents.docs)) {
    if (!text.includes(CURRENT_INVENTORY_SENTENCE)) failures.push(`CURRENT_V13_INVENTORY_SENTENCE_MISSING:${name}`);
  }
  const finalInventory = documents.finalRelease?.currentInventory ?? {};
  const expected = {
    dependencyPackageCount: 1188,
    javascriptDependencyPackageCount: 677,
    nativeRustDependencyPackageCount: 511,
    declaredLicensePackageCount: 1188,
    documentedSourceLicenseResolutionCount: 0,
    unresolvedLicenseCount: 0,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (finalInventory[field] !== value) failures.push(`FINAL_RELEASE_INVENTORY_MISMATCH:${field}`);
    if (documents.license[field] !== value) failures.push(`LICENSE_INVENTORY_MISMATCH:${field}`);
  }
  if (documents.finalRelease?.currentReleaseAuthority !== true) failures.push("FINAL_RELEASE_NOT_CURRENT_AUTHORITY");
  if (documents.toolchain?.currentReleaseAuthority !== true) failures.push("TOOLCHAIN_NOT_CURRENT_AUTHORITY");
  if (documents.toolchain?.packageManager?.after !== "pnpm@10.34.5") failures.push("TOOLCHAIN_PNPM_VERSION_MISMATCH");
  if (documents.toolchain?.unzipper?.after !== "0.12.5") failures.push("TOOLCHAIN_UNZIPPER_VERSION_MISMATCH");
  return failures;
}

function read(checkRoot, relative) {
  return readFileSync(path.join(checkRoot, relative), "utf8");
}

function requiredText(text, needles, label, failures) {
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${label}_MISSING:${needle}`);
  }
}

function parseIndexRecord(line) {
  const tab = line.indexOf("\t");
  assert.notEqual(tab, -1, `PUBLIC_SOURCE_INDEX_RECORD_INVALID:${line}`);
  const [mode, objectId, stage] = line.slice(0, tab).split(" ");
  return { mode, objectId, stage, file: line.slice(tab + 1), line };
}

function repositoryAvailable(checkRoot) {
  return existsSync(path.join(checkRoot, ".git"));
}

function gitTreeObjectAvailable(checkRoot, revision) {
  try {
    execFileSync("git", ["cat-file", "-e", `${revision}^{tree}`], {
      cwd: checkRoot,
      stdio: "ignore",
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function gitBlobObjectId(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha1").update(Buffer.from(`blob ${body.length}\0`)).update(body).digest("hex");
}

function gitTrackedRecords(checkRoot, revision) {
  if (revision) {
    return execFileSync("git", ["ls-tree", "-r", revision], {
      cwd: checkRoot,
      encoding: "utf8",
      windowsHide: true,
    }).split(/\r?\n/).filter(Boolean).map((treeLine) => {
      const tab = treeLine.indexOf("\t");
      assert.notEqual(tab, -1, `PUBLIC_SOURCE_TREE_RECORD_INVALID:${treeLine}`);
      const [mode, type, objectId] = treeLine.slice(0, tab).split(" ");
      assert.equal(type, "blob", `PUBLIC_SOURCE_TREE_ENTRY_NOT_BLOB:${treeLine}`);
      return parseIndexRecord(`${mode} ${objectId} 0\t${treeLine.slice(tab + 1)}`);
    });
  }
  return execFileSync("git", ["ls-files", "-s"], {
    cwd: checkRoot,
    encoding: "utf8",
    windowsHide: true,
  }).split(/\r?\n/).filter(Boolean).map(parseIndexRecord);
}

function archiveTrackedRecords(checkRoot) {
  const manifest = JSON.parse(readFileSync(path.join(checkRoot, PUBLIC_SOURCE_MANIFEST), "utf8"));
  assert.equal(manifest.status, "PASSED", "PUBLIC_SOURCE_MANIFEST_NOT_PASSED");
  assert(Array.isArray(manifest.entries), "PUBLIC_SOURCE_MANIFEST_ENTRIES_MISSING");
  assert.equal(manifest.fileCount, manifest.entries.length, "PUBLIC_SOURCE_MANIFEST_FILE_COUNT_MISMATCH");
  const records = manifest.entries.map((entry) => {
    assert.equal(typeof entry.path, "string", "PUBLIC_SOURCE_MANIFEST_PATH_INVALID");
    assert.match(entry.sha256, /^[0-9a-f]{64}$/i, `PUBLIC_SOURCE_MANIFEST_SHA256_INVALID:${entry.path}`);
    const bytes = readFileSync(path.join(checkRoot, entry.path));
    assert.equal(bytes.length, entry.bytes, `PUBLIC_SOURCE_MANIFEST_BYTES_MISMATCH:${entry.path}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256,
      `PUBLIC_SOURCE_MANIFEST_SHA256_MISMATCH:${entry.path}`);
    const mode = entry.mode ?? "100644";
    assert.equal(mode === "100644" || mode === "100755", true,
      `PUBLIC_SOURCE_MANIFEST_MODE_INVALID:${entry.path}:${mode}`);
    return parseIndexRecord(`${mode} ${gitBlobObjectId(bytes)} 0\t${entry.path}`);
  });
  assert.equal(new Set(records.map(({ file }) => file)).size, records.length,
    "PUBLIC_SOURCE_MANIFEST_DUPLICATE_PATH");
  return records;
}

function digestRecords(records) {
  const manifest = [...records].sort(compareUtf8By((record) => record.file))
    .map(({ line }) => `${line}\n`).join("");
  return createHash("sha256").update(manifest).digest("hex");
}

function digestPaths(paths) {
  return createHash("sha256").update(sortUtf8Bytewise(paths).map((file) => `${file}\n`).join("")).digest("hex");
}

function legacyDocumentationOrEvidence(file) {
  return file === "README.md" || file === "CHANGELOG.md" || file === "SHA256SUMS"
    || file === "SBOM.spdx.json" || file.startsWith("docs/") || file.startsWith("reports/")
    || file.startsWith("runtime/validation/public_documentation_");
}

function documentationOrEvidence(file) {
  const rootDocumentation = new Set([
    "README.md", "CHANGELOG.md", "LICENSE", "CLA.md", "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md", "SECURITY.md", "SBOM.md", "SBOM.spdx.json",
    "SHA256SUMS", "THIRD_PARTY_NOTICES.md",
  ]);
  return rootDocumentation.has(file) || file.startsWith("docs/") || file.startsWith("reports/");
}

function productFile(contract, file) {
  if (contract.publicGeneratedProductMetadataPaths.includes(file)) return false;
  return contract.productEnginePaths.some((prefix) => file === prefix || file.startsWith(`${prefix}/`));
}

function validationRuntimeImports(checkRoot, productFiles) {
  const imports = [];
  const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
  for (const file of productFiles) {
    const absolute = path.join(checkRoot, file);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1].replaceAll("\\", "/");
      const resolved = specifier.startsWith(".")
        ? path.relative(checkRoot, path.resolve(path.dirname(absolute), specifier)).replaceAll("\\", "/")
        : specifier;
      if (resolved.startsWith("runtime/validation/") || resolved.includes("/runtime/validation/")) {
        imports.push({ productFile: file, specifier, resolved });
      }
    }
  }
  return imports;
}

export function calculatePublicSourceClassDigests(checkRoot = root, objectIdOverrides = new Map()) {
  const contract = JSON.parse(readFileSync(path.join(checkRoot, PUBLIC_EXPORT_SURFACE_CONTRACT), "utf8"));
  const demoPlatformClosure = JSON.parse(readFileSync(
    path.join(checkRoot, "reports/PUBLIC_V12_DEMO_PLATFORM_ADAPTER_CLOSURE_20260902.json"),
    "utf8",
  ));
  const securityRemediation = JSON.parse(readFileSync(
    path.join(checkRoot, "reports/PUBLIC_V13_SECURITY_REMEDIATION_CLOSURE_20260902.json"),
    "utf8",
  ));
  assert.equal(demoPlatformClosure.status, "PASSED", "V12_DEMO_PLATFORM_CLOSURE_NOT_PASSED");
  assert.equal(securityRemediation.status, "CODEQL_AND_DEPENDENCY_GATES_PASSED", "V13_SECURITY_REMEDIATION_NOT_PASSED");
  assert.match(contract.publicBaseCommit, /^[0-9a-f]{40}$/i, "PUBLIC_PRODUCT_BASE_COMMIT_INVALID");
  assert(Array.isArray(contract.productEngineFiles), "PRODUCT_ENGINE_FILE_SET_NOT_PROVEN");
  assert.equal(new Set(contract.productEngineFiles).size, contract.productEngineFiles.length, "PRODUCT_ENGINE_FILE_SET_DUPLICATE");
  assert.equal(digestPaths(contract.productEngineFiles), contract.productEngineFileSetSha256, "PRODUCT_ENGINE_FILE_SET_HASH_MISMATCH");
  assert(Array.isArray(contract.acceptedV8LegacyProductManifestRecords),
    "ACCEPTED_V8_LEGACY_PRODUCT_MANIFEST_RECORDS_MISSING");
  assert.equal(contract.currentProductDigestAlgorithm?.algorithmVersion, DETERMINISTIC_ORDER_ALGORITHM,
    "CURRENT_PRODUCT_DIGEST_ALGORITHM_MISMATCH");
  assert.equal(contract.currentProductDigestAlgorithm?.sha256, CURRENT_PRODUCT_BLOB_MANIFEST_SHA256,
    "CURRENT_PRODUCT_DIGEST_AUTHORITY_MISMATCH");
  assert.equal(contract.legacyProductDigestEvidence?.algorithmVersion, "LOCALE_COLLATION_TR_V1",
    "LEGACY_PRODUCT_DIGEST_ALGORITHM_MISMATCH");
  assert.equal(contract.legacyProductDigestEvidence?.sha256, LEGACY_TR_V1_PRODUCT_BLOB_MANIFEST_SHA256,
    "LEGACY_PRODUCT_DIGEST_EVIDENCE_MISMATCH");
  assert.equal(contract.legacyProductDigestEvidence?.historical, true,
    "LEGACY_PRODUCT_DIGEST_NOT_HISTORICAL");
  assert.equal(contract.legacyProductDigestEvidence?.currentReleaseAuthority, false,
    "LEGACY_PRODUCT_DIGEST_STILL_CURRENT_AUTHORITY");
  assert.equal(contract.legacyProductDigestEvidence?.productFileContentsChanged, false,
    "LEGACY_PRODUCT_DIGEST_PRODUCT_CHANGE_CLAIM_INVALID");

  const storedBaseRecords = contract.acceptedV8LegacyProductManifestRecords.map(parseIndexRecord);
  assert.equal(storedBaseRecords.length, contract.acceptedV8LegacyProductManifestRecordCount,
    "ACCEPTED_V8_LEGACY_PRODUCT_MANIFEST_RECORD_COUNT_MISMATCH");
  assert.equal(digestRecords(storedBaseRecords), ACCEPTED_V8_PRODUCT_BLOB_MANIFEST_SHA256,
    "ACCEPTED_V8_STORED_RECORDS_UTF8_BYTEWISE_DIGEST_MISMATCH");
  let historicalBaseCommitStatus = "ARCHIVE_EXPORT_WITHOUT_GIT_METADATA";
  if (repositoryAvailable(checkRoot)) inspectPublicRepositoryRemotePolicy(checkRoot);
  if (repositoryAvailable(checkRoot) && gitTreeObjectAvailable(checkRoot, contract.publicBaseCommit)) {
    const repositoryBaseRecords = gitTrackedRecords(checkRoot, contract.publicBaseCommit)
      .filter(({ file }) => !legacyDocumentationOrEvidence(file));
    assert.deepEqual(
      repositoryBaseRecords.sort(compareUtf8By((record) => record.file)).map(({ line }) => line),
      storedBaseRecords.sort(compareUtf8By((record) => record.file)).map(({ line }) => line),
      "ACCEPTED_V8_LEGACY_PRODUCT_MANIFEST_RECORDS_NOT_FROM_BASE_TREE");
    historicalBaseCommitStatus = "HISTORICAL_BASE_COMMIT_OBJECT_PRESENT_AND_VERIFIED";
  } else if (repositoryAvailable(checkRoot)) {
    const marker = JSON.parse(readFileSync(path.join(checkRoot, "reports/PUBLIC_EXPORT_MARKER.json"), "utf8"));
    assert.equal(marker.publicExport, true, "HISTORY_FREE_PUBLIC_EXPORT_MARKER_MISSING");
    assert.equal(marker.privateHistoryIncluded, false, "HISTORY_FREE_PUBLIC_EXPORT_PRIVATE_HISTORY_INCLUDED");
    assert.equal(marker.publicBaseCommit, contract.publicBaseCommit, "HISTORY_FREE_PUBLIC_BASE_PROVENANCE_MISMATCH");
    historicalBaseCommitStatus = "HISTORICAL_BASE_COMMIT_OBJECT_ABSENT_EXPECTED_HISTORY_FREE_EXPORT";
  }

  const baseRecords = storedBaseRecords;
  const currentRecords = (repositoryAvailable(checkRoot)
    ? gitTrackedRecords(checkRoot)
    : archiveTrackedRecords(checkRoot)).map((record) => {
    const replacement = objectIdOverrides.get(record.file);
    if (!replacement) return record;
    assert.match(replacement, /^[0-9a-f]{40,64}$/i, `PUBLIC_SOURCE_OVERRIDE_OBJECT_ID_INVALID:${record.file}`);
    return parseIndexRecord(`${record.mode} ${replacement} ${record.stage}\t${record.file}`);
  });
  const baseProductFiles = sortUtf8Bytewise(baseRecords.filter(({ file }) => productFile(contract, file)).map(({ file }) => file));
  assert.deepEqual(baseProductFiles, sortUtf8Bytewise(contract.productEngineFiles), "PRODUCT_ENGINE_FILE_SET_NOT_PROVEN");

  const baseLegacyRecords = baseRecords.filter(({ file }) => !legacyDocumentationOrEvidence(file));
  const baseProductDigest = digestRecords(baseLegacyRecords);
  const currentProductRecords = currentRecords.filter(({ file }) => productFile(contract, file));
  const productEngineDigest = digestRecords([
    ...baseLegacyRecords.filter(({ file }) => !productFile(contract, file)),
    ...currentProductRecords,
  ]);
  const validationRecords = currentRecords.filter(({ file }) => file.startsWith("runtime/validation/"));
  const documentationRecords = currentRecords.filter(({ file }) => documentationOrEvidence(file));
  const currentProductFiles = sortUtf8Bytewise(currentProductRecords.map(({ file }) => file));
  const baseProductRecordLines = baseRecords.filter(({ file }) => productFile(contract, file))
    .sort(compareUtf8By((record) => record.file)).map(({ line }) => line);
  const currentProductRecordLines = currentProductRecords
    .sort(compareUtf8By((record) => record.file)).map(({ line }) => line);
  if (objectIdOverrides.size === 0) {
    const changedBlobByPath = new Map(demoPlatformClosure.changedFiles.map((record) => {
      assert.match(record.path, /^[A-Za-z0-9._/-]+$/u, `V12_DEMO_CHANGED_PATH_INVALID:${record.path}`);
      assert.match(record.beforeGitBlob, /^[0-9a-f]{40}$/u, `V12_DEMO_BEFORE_BLOB_INVALID:${record.path}`);
      assert.match(record.afterGitBlob, /^[0-9a-f]{40}$/u, `V12_DEMO_AFTER_BLOB_INVALID:${record.path}`);
      assert.equal(contract.productEngineFiles.includes(record.path), true,
        `V12_DEMO_CHANGED_FILE_OUTSIDE_PRODUCT_SET:${record.path}`);
      return [record.path, record];
    }));
    for (const record of securityRemediation.currentChangedFiles) {
      assert.match(record.path, /^[A-Za-z0-9._/-]+$/u, `V13_SECURITY_CHANGED_PATH_INVALID:${record.path}`);
      assert.match(record.gitBlob, /^[0-9a-f]{40}$/u, `V13_SECURITY_CHANGED_BLOB_INVALID:${record.path}`);
      if (!contract.productEngineFiles.includes(record.path)) continue;
      changedBlobByPath.set(record.path, {
        path: record.path,
        beforeGitBlob: changedBlobByPath.get(record.path)?.beforeGitBlob,
        afterGitBlob: record.gitBlob,
      });
    }
    const expectedCurrentProductRecordLines = baseRecords.filter(({ file }) => productFile(contract, file))
      .map((record) => {
        const change = changedBlobByPath.get(record.file);
        if (!change) return record;
        if (change.beforeGitBlob) {
          assert.equal(record.objectId, change.beforeGitBlob, `V12_DEMO_BEFORE_BLOB_MISMATCH:${record.file}`);
        }
        return parseIndexRecord(`${record.mode} ${change.afterGitBlob} ${record.stage}\t${record.file}`);
      })
      .sort(compareUtf8By((record) => record.file)).map(({ line }) => line);
    assert.deepEqual(currentProductRecordLines, expectedCurrentProductRecordLines,
      "CURRENT_PRODUCT_CONTENT_DIFFERS_FROM_VERIFIED_V13_SECURITY_REMEDIATION_CLOSURE");
  }
  const runtimeImports = validationRuntimeImports(checkRoot, currentProductFiles);

  return {
    acceptedV8ProductEngineDigestRecalculated: baseProductDigest,
    productEngineDigest,
    validationToolingDigest: digestRecords(validationRecords),
    documentationAndEvidenceDigest: digestRecords(documentationRecords),
    publicSourceDigest: digestRecords(currentRecords),
    productEngineFileCount: currentProductFiles.length,
    productEngineFileSetExact: JSON.stringify(currentProductFiles) === JSON.stringify(sortUtf8Bytewise(contract.productEngineFiles)),
    orderingAlgorithm: DETERMINISTIC_ORDER_ALGORITHM,
    legacyProductDigestEvidence: contract.legacyProductDigestEvidence,
    historicalBaseCommitStatus,
    validationToolingFileCount: validationRecords.length,
    documentationAndEvidenceFileCount: documentationRecords.length,
    runtimeImportedValidationFileCount: runtimeImports.length,
    runtimeImportedValidationFiles: runtimeImports,
    explicitValidationTooling: [
      "runtime/validation/public_source_contract.mjs",
      "runtime/validation/public_export_surface_consistency_gate.mjs",
    ],
  };
}

export function verifyPublicSourceClassNegativeScenarios(checkRoot = root) {
  const baselineDigests = calculatePublicSourceClassDigests(checkRoot);
  assert.equal(baselineDigests.runtimeImportedValidationFileCount, 0);
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "tancmark-public-source-class-digests-"));
  const changedObjectId = (relative) => {
    const temporary = path.join(temporaryRoot, path.basename(relative));
    copyFileSync(path.join(checkRoot, relative), temporary);
    appendFileSync(temporary, Buffer.from([0x0a]));
    return gitBlobObjectId(readFileSync(temporary));
  };

  let validationScenario;
  let productScenario;
  let documentationScenario;
  try {
    const validationFile = "runtime/validation/public_source_contract.mjs";
    validationScenario = calculatePublicSourceClassDigests(checkRoot, new Map([[validationFile, changedObjectId(validationFile)]]));
    const productFile = "lib/aegis-core/src/index.ts";
    productScenario = calculatePublicSourceClassDigests(checkRoot, new Map([[productFile, changedObjectId(productFile)]]));
    const documentationFile = "docs/USER_GUIDE.md";
    documentationScenario = calculatePublicSourceClassDigests(checkRoot, new Map([[documentationFile, changedObjectId(documentationFile)]]));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  return {
    validationChangeMisclassifiedAsProduct: validationScenario.productEngineDigest !== baselineDigests.productEngineDigest,
    validationToolingDigestChanged: validationScenario.validationToolingDigest !== baselineDigests.validationToolingDigest,
    sourceManifestChangedForValidation: validationScenario.publicSourceDigest !== baselineDigests.publicSourceDigest,
    realProductChangeDetected: productScenario.productEngineDigest !== baselineDigests.productEngineDigest,
    documentationChangeMisclassifiedAsProduct: documentationScenario.productEngineDigest !== baselineDigests.productEngineDigest,
    documentationDigestChanged: documentationScenario.documentationAndEvidenceDigest !== baselineDigests.documentationAndEvidenceDigest,
    runtimeImportedValidationFileCount: baselineDigests.runtimeImportedValidationFileCount,
  };
}

function localMarkdownLinkFailures(checkRoot, files) {
  const failures = [];
  for (const file of files) {
    const text = read(checkRoot, file);
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^https?:|^mailto:/.test(target)) continue;
      const resolved = path.resolve(path.dirname(path.join(checkRoot, file)), target);
      if (!existsSync(resolved)) failures.push(`BROKEN_LOCAL_LINK:${file}:${match[1]}`);
    }
  }
  return failures;
}

export function evaluateDetailedPublicDocumentation(checkRoot = root) {
  const failures = [];
  const requiredFiles = [
    docs.user, docs.userTr, docs.operator, docs.operatorTr,
    docs.apiExamples, docs.apiExamplesTr, docs.troubleshooting,
    docs.troubleshootingTr, docs.results, docs.resultsTr, docs.index,
    DOCUMENTATION_AUDIT,
  ];
  for (const file of requiredFiles) {
    if (!existsSync(path.join(checkRoot, file))) failures.push(`REQUIRED_DOCUMENT_MISSING:${file}`);
  }
  if (failures.length) return failures;

  const packageJson = JSON.parse(read(checkRoot, "package.json"));
  const apiPackage = JSON.parse(read(checkRoot, "artifacts/api-server/package.json"));
  const scriptsPackage = JSON.parse(read(checkRoot, "scripts/package.json"));
  const openapi = read(checkRoot, "lib/api-spec/openapi.yaml");
  const routesIndex = read(checkRoot, "artifacts/api-server/src/routes/index.ts");
  const productBuild = read(checkRoot, "artifacts/api-server/build.mjs");
  const apiExamples = read(checkRoot, docs.apiExamples);
  const apiExamplesTr = read(checkRoot, docs.apiExamplesTr);
  const user = read(checkRoot, docs.user);
  const userTr = read(checkRoot, docs.userTr);
  const operator = read(checkRoot, docs.operator);
  const operatorTr = read(checkRoot, docs.operatorTr);
  const results = read(checkRoot, docs.results);
  const resultsTr = read(checkRoot, docs.resultsTr);
  const index = read(checkRoot, docs.index);
  const audit = JSON.parse(read(checkRoot, DOCUMENTATION_AUDIT));

  if (packageJson.packageManager !== "pnpm@10.34.5") failures.push("PINNED_PNPM_MISMATCH");
  if (packageJson.engines?.node !== ">=24.0.0") failures.push("NODE_ENGINE_MISMATCH");
  for (const script of ["build", "build:product", "typecheck", "test", "test:documentation", "test:media-runtime", "test:physical-text-image", "test:physical-audio", "test:clean-live", "test:c2pa"]) {
    if (typeof packageJson.scripts?.[script] !== "string") failures.push(`DOCUMENTED_ROOT_SCRIPT_MISSING:${script}`);
  }
  if (typeof apiPackage.scripts?.["start:product"] !== "string") failures.push("START_PRODUCT_SCRIPT_MISSING");
  if (typeof scriptsPackage.scripts?.["seed-client"] !== "string") failures.push("SEED_CLIENT_SCRIPT_MISSING");
  if (apiPackage.dependencies?.["@contentauth/c2pa-node"] !== "0.9.1") failures.push("C2PA_VERSION_MISMATCH");

  requiredText(user, [
    "SEAL -> RECOVER -> MATCH -> VERIFY", "What blind means", "Original and working copy",
    "Current public status", "Source setup", "Start the server", "### Text", "### Image",
    "### Audio", "### Video", "## Live", "## C2PA", "## Evidence and Secure Room",
    "## Known limits", "AGPL-3.0-only",
  ], "USER_GUIDE", failures);
  requiredText(userTr, [
    "SEAL -> RECOVER -> MATCH -> VERIFY", "Blind yani kör okuma", "Orijinal ve çalışma kopyası",
    "Güncel kamu sürümünün durumu", "Kaynak kurulumu", "Sunucuyu başlatma", "### Metin",
    "### Görsel", "### Ses", "### Video", "## Live", "## C2PA", "## Evidence ve Secure Room",
    "## Bilinen sınırlar", "AGPL-3.0-only",
  ], "USER_GUIDE_TR", failures);
  requiredText(operator, [
    "pnpm install --frozen-lockfile", "pnpm --filter @workspace/db run push",
    "pnpm --filter @workspace/api-server run start:product", "TANCMARK_C2PA_NATIVE_ARCHIVE",
    "TANCMARK_LIVE_STORAGE_ROOT", "C2PA_REMOTE_MANIFEST_FETCH=false", "AEGIS_SECRET", "HTTP `410`",
    CURRENT_INVENTORY_SENTENCE,
  ], "OPERATOR_GUIDE", failures);
  requiredText(operatorTr, [
    "pnpm install --frozen-lockfile", "pnpm --filter @workspace/db run push",
    "pnpm --filter @workspace/api-server run start:product", "TANCMARK_C2PA_NATIVE_ARCHIVE",
    "TANCMARK_LIVE_STORAGE_ROOT", "C2PA_REMOTE_MANIFEST_FETCH=false", "AEGIS_SECRET", "HTTP `410`",
  ], "OPERATOR_GUIDE_TR", failures);
  requiredText(results, ["Blind reading by module", "32-bit locator", "VALID_BUT_UNTRUSTED", "MANUAL_REVIEW"], "RESULTS", failures);
  requiredText(resultsTr, ["Modüllere göre kör okuma", "32-bit locator", "VALID_BUT_UNTRUSTED", "MANUAL_REVIEW"], "RESULTS_TR", failures);

  const requiredOpenApiPaths = [
    "/healthz:", "/aegis/protect-text:", "/aegis/analyze-text:",
    "/tancmark/live/local/v1/sessions:",
    "/tancmark/live/local/v1/sessions/{sessionId}/verify-exact-id:",
    "/tancmark/c2pa/v1/inspect:", "/tancmark/c2pa/v1/verify:",
    "/tancmark/c2pa/v1/sign-embed:", "/aegis/video-lab/encode:",
  ];
  for (const route of requiredOpenApiPaths) {
    if (!openapi.includes(`  ${route}`)) failures.push(`OPENAPI_ROUTE_MISSING:${route}`);
  }
  requiredText(apiExamples, [
    "/api/healthz", "/aegis/protect-text", "/aegis/analyze-text",
    "/tancmark/live/local/v1/sessions", "/verify-exact-id", "/access/exchange",
    "/tancmark/c2pa/v1/inspect", "/tancmark/c2pa/v1/sign-embed", "HTTP `410`",
  ], "API_EXAMPLES", failures);
  requiredText(apiExamplesTr, [
    "/api/healthz", "/aegis/protect-text", "/aegis/analyze-text",
    "/tancmark/live/local/v1/sessions", "/verify-exact-id", "/access/exchange",
    "/tancmark/c2pa/v1/inspect", "/tancmark/c2pa/v1/sign-embed", "HTTP `410`",
  ], "API_EXAMPLES_TR", failures);
  if (!routesIndex.includes('router.use("/aegis/audio-lab"')) failures.push("AUDIO_LAB_SOURCE_ROUTE_MISSING");
  if (!routesIndex.includes('router.use("/aegis/secure-room"')) failures.push("SECURE_ROOM_SOURCE_ROUTE_MISSING");
  if (!routesIndex.includes('router.use("/tancmark/discovery"')) failures.push("DISCOVERY_SOURCE_ROUTE_MISSING");
  if (!productBuild.includes("productDisabledLegacyLab.ts") || !productBuild.includes("productDisabledCanonicalReader.ts")) failures.push("PRODUCT_DISABLED_ROUTE_ALIAS_MISSING");

  if (audit.schemaVersion !== "tancmark-documentation-source-of-truth-audit-v1") failures.push("DOCUMENTATION_AUDIT_SCHEMA_MISMATCH");
  if (!Array.isArray(audit.operations) || audit.operations.length < 20) failures.push("DOCUMENTATION_AUDIT_OPERATION_COVERAGE_LOW");
  for (const key of [
    "PUBLIC_API_DOCUMENTATION_MISMATCH_TEXT_SEAL_SECURITY",
    "PUBLIC_API_DOCUMENTATION_MISMATCH_VIDEO_LAB_PRODUCT_MODE",
    "PUBLIC_API_DOCUMENTATION_MISMATCH_AUDIO_LAB",
    "PUBLIC_API_DOCUMENTATION_MISMATCH_SECURE_ROOM",
    "PUBLIC_API_DOCUMENTATION_MISMATCH_DISCOVERY",
  ]) {
    if (!audit.mismatches?.some((item) => item.id === key)) failures.push(`DOCUMENTATION_AUDIT_MISMATCH_MISSING:${key}`);
  }

  try {
    inspectPublicRepositoryRemotePolicy(checkRoot);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "PUBLIC_REPOSITORY_REMOTE_POLICY_FAILED");
  }

  failures.push(...localMarkdownLinkFailures(checkRoot, [
    docs.user, docs.userTr, docs.operator, docs.operatorTr, docs.apiExamples,
    docs.apiExamplesTr, docs.troubleshooting, docs.troubleshootingTr,
    docs.results, docs.resultsTr, docs.index, "README.md",
  ]));
  if (!index.includes("reports/DOCUMENTATION_SOURCE_OF_TRUTH_AUDIT.json")) failures.push("DOCUMENTATION_INDEX_AUDIT_LINK_MISSING");

  const sourceDigests = calculatePublicSourceClassDigests(checkRoot);
  if (sourceDigests.acceptedV8ProductEngineDigestRecalculated !== ACCEPTED_V8_PRODUCT_BLOB_MANIFEST_SHA256) {
    failures.push(`PRODUCT_ENGINE_FILE_SET_NOT_PROVEN:${sourceDigests.acceptedV8ProductEngineDigestRecalculated}`);
  }
  if (sourceDigests.productEngineDigest !== CURRENT_PRODUCT_BLOB_MANIFEST_SHA256) {
    failures.push(`PRODUCT_SOURCE_BLOB_MANIFEST_CHANGED:${sourceDigests.productEngineDigest}`);
  }
  if (!sourceDigests.productEngineFileSetExact) failures.push("PRODUCT_ENGINE_FILE_SET_CHANGED");
  if (sourceDigests.runtimeImportedValidationFileCount !== 0) {
    failures.push(`VALIDATION_FILE_IMPORTED_BY_PRODUCT_RUNTIME:${JSON.stringify(sourceDigests.runtimeImportedValidationFiles)}`);
  }
  return failures;
}

export function loadCurrentReleaseDocumentation(checkRoot = root) {
  return {
    docs: {
      changelog: readFileSync(path.join(checkRoot, docs.changelog), "utf8"),
      featureStatus: readFileSync(path.join(checkRoot, docs.feature), "utf8"),
      operatorGuide: readFileSync(path.join(checkRoot, docs.operator), "utf8"),
    },
    finalRelease: JSON.parse(readFileSync(path.join(checkRoot, "reports/PUBLIC_FINAL_RELEASE_RESULT_20260831.json"), "utf8")),
    license: JSON.parse(readFileSync(path.join(checkRoot, "reports/PUBLIC_LICENSE_SCAN.json"), "utf8")),
    toolchain: JSON.parse(readFileSync(path.join(checkRoot, "reports/TOOLCHAIN_SUPPLY_CHAIN_CLOSURE_20260831.json"), "utf8")),
  };
}

export function assertDocumentationFreshness(changedFiles) {
  const result = documentationRequirements(changedFiles);
  for (const required of result.required) {
    assert(result.changed.has(required), `PUBLIC_DOCUMENTATION_FRESHNESS_GATE:${required}_must_change`);
    assert(existsSync(path.join(root, required)), `PUBLIC_DOCUMENTATION_FRESHNESS_GATE:${required}_missing`);
    assert(readFileSync(path.join(root, required), "utf8").trim().length > 40, `PUBLIC_DOCUMENTATION_FRESHNESS_GATE:${required}_empty`);
  }
  const currentReleaseFailures = evaluateCurrentReleaseDocumentation(loadCurrentReleaseDocumentation());
  assert.deepEqual(currentReleaseFailures, [], `PUBLIC_DOCUMENTATION_FRESHNESS_GATE:${currentReleaseFailures.join(",")}`);
  const detailedFailures = evaluateDetailedPublicDocumentation();
  assert.deepEqual(detailedFailures, [], `PUBLIC_DETAILED_DOCUMENTATION_GATE:${detailedFailures.join(",")}`);
  result.currentReleaseMetadata = "V13_SECURITY_REMEDIATION_CURRENT";
  result.currentDependencyPackageCount = 1188;
  result.detailedDocumentation = "PASSED";
  const sourceDigests = calculatePublicSourceClassDigests();
  result.productSourceBlobManifestSha256 = sourceDigests.productEngineDigest;
  result.validationToolingDigest = sourceDigests.validationToolingDigest;
  result.documentationAndEvidenceDigest = sourceDigests.documentationAndEvidenceDigest;
  result.publicSourceDigest = sourceDigests.publicSourceDigest;
  result.runtimeImportedValidationFileCount = sourceDigests.runtimeImportedValidationFileCount;
  result.orderingAlgorithm = sourceDigests.orderingAlgorithm;
  result.historicalBaseCommitStatus = sourceDigests.historicalBaseCommitStatus;
  return result;
}

function changedFilesFromGit() {
  if (!repositoryAvailable(root)) {
    const manifest = JSON.parse(readFileSync(path.join(root, PUBLIC_SOURCE_MANIFEST), "utf8"));
    assert(Array.isArray(manifest.entries), "PUBLIC_SOURCE_MANIFEST_ENTRIES_MISSING");
    return manifest.entries.map(({ path: relative }) => relative);
  }
  const baseIndex = process.argv.indexOf("--base");
  const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;
  if (base !== undefined && !/^[0-9a-f]{40}$/i.test(base)) throw new Error("PUBLIC_DOCUMENTATION_FRESHNESS_GATE:invalid_base_sha");
  const args = base
    ? ["diff", "--name-only", `${base}...HEAD`, "--"]
    : ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "HEAD"];
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true })
    .split(/\r?\n/).filter(Boolean);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = assertDocumentationFreshness(changedFilesFromGit());
  process.stdout.write(`${JSON.stringify({ gate: "PUBLIC_DOCUMENTATION_FRESHNESS_GATE", status: "PASSED", sourceFilesEvaluated: result.source.length, requiredDocuments: result.required, currentReleaseMetadata: result.currentReleaseMetadata, currentDependencyPackageCount: result.currentDependencyPackageCount, detailedDocumentation: result.detailedDocumentation, orderingAlgorithm: result.orderingAlgorithm, historicalBaseCommitStatus: result.historicalBaseCommitStatus, productSourceBlobManifestSha256: result.productSourceBlobManifestSha256, validationToolingDigest: result.validationToolingDigest, documentationAndEvidenceDigest: result.documentationAndEvidenceDigest, publicSourceDigest: result.publicSourceDigest, runtimeImportedValidationFileCount: result.runtimeImportedValidationFileCount }, null, 2)}\n`);
}
