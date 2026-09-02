// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argumentsList = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < argumentsList.length; index += 2) {
  const name = argumentsList[index];
  const value = argumentsList[index + 1];
  assert(["--public-root", "--private-root"].includes(name), `unsupported_argument:${name}`);
  assert(value, `${name}_value_required`);
  assert.equal(path.isAbsolute(value), true, `${name}_must_be_absolute`);
  options.set(name, path.normalize(value));
}
const publicRoot = options.get("--public-root");
const privateRoot = options.get("--private-root");
assert(publicRoot, "PUBLIC_EXPORT_ROOT_REQUIRED");
assert(privateRoot, "PRIVATE_MAIN_ROOT_REQUIRED");

const validateRoot = (root, label) => {
  assert.equal(fs.existsSync(root), true, `${label}_root_missing`);
  const stat = fs.lstatSync(root);
  assert.equal(stat.isDirectory(), true, `${label}_root_not_directory`);
  assert.equal(stat.isSymbolicLink(), false, `${label}_root_reparse_point_forbidden`);
};
validateRoot(publicRoot, "public");
validateRoot(privateRoot, "private");

const readJson = (root, relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const contract = readJson(publicRoot, "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json");
const marker = readJson(publicRoot, "reports/PUBLIC_EXPORT_MARKER.json");
const roleContract = readJson(publicRoot, "reports/PUBLIC_AND_PRIVATE_REPOSITORY_ROLE_CONTRACT.json");
assert.equal(marker.publicExport, true);
assert.equal(marker.publicLicense, "AGPL-3.0-only");
assert.equal(roleContract.privateMainPackageMetadataClassification, "PRIVATE_MAIN_PACKAGE_METADATA_NOT_PUBLIC_LICENSE_AUTHORITY");

const publicPackage = readJson(publicRoot, "package.json");
const privatePackage = readJson(privateRoot, "package.json");
let packageFieldMismatch = 0;
for (const [field, expected] of Object.entries(contract.sharedPackageFields)) {
  if (publicPackage[field] !== expected || privatePackage[field] !== expected) packageFieldMismatch += 1;
}
assert.equal(packageFieldMismatch, 0, "shared_package_field_mismatch");
assert.equal(publicPackage.license, contract.publicOnlyPackageFields.license);
assert.equal(publicPackage.name, contract.publicOnlyPackageFields.name);
assert.equal(publicPackage.engines?.node, contract.publicOnlyPackageFields["engines.node"]);

const missingRequiredPublicFiles = [...contract.requiredPublicRootFiles, ...contract.requiredPublicDocumentationFiles]
  .filter((relativePath) => !fs.existsSync(path.join(publicRoot, relativePath)));
assert.deepEqual(missingRequiredPublicFiles, [], `missing_public_export_files:${missingRequiredPublicFiles.join(",")}`);

const excludedDirectoryNames = new Set([".git", "node_modules", "dist", "dist-product", "__pycache__"]);
const publicFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excludedDirectoryNames.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute);
    assert.equal(stat.isSymbolicLink(), false, `public_export_symlink_forbidden:${path.relative(publicRoot, absolute)}`);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile()) publicFiles.push(path.relative(publicRoot, absolute).replaceAll("\\", "/"));
  }
};
walk(publicRoot);

const classifiedTopLevels = new Set(contract.publicTopLevelClassification);
const unclassifiedExportFiles = publicFiles.filter((relativePath) => !classifiedTopLevels.has(relativePath.split("/")[0]));
assert.deepEqual(unclassifiedExportFiles, [], `unclassified_public_export_files:${unclassifiedExportFiles.join(",")}`);
const privatePathPattern = /(^|\/)\.local(\/|$)|(^|\/)__pycache__(\/|$)|\.(mp4|mov|mkv|webm|wav|mp3|flac|db|sqlite)$/i;
const privateFilesInPublicExport = publicFiles.filter((relativePath) => privatePathPattern.test(relativePath));
assert.deepEqual(privateFilesInPublicExport, [], `private_file_in_public_export:${privateFilesInPublicExport.join(",")}`);

const sha256 = (absolutePath) => createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
const normalizedText = (absolutePath) => fs.readFileSync(absolutePath, "utf8").replaceAll("\r\n", "\n");
const sharedFileMismatches = [];
for (const [relativePath, expectedHash] of Object.entries(contract.publicExportFileHashes)) {
  const publicPath = path.join(publicRoot, relativePath);
  const privatePath = path.join(privateRoot, relativePath);
  if (!fs.existsSync(publicPath) || !fs.existsSync(privatePath)) {
    sharedFileMismatches.push({ path: relativePath, reason: "missing" });
    continue;
  }
  const publicHash = sha256(publicPath);
  if (publicHash !== expectedHash || normalizedText(privatePath) !== normalizedText(publicPath)) sharedFileMismatches.push({ path: relativePath, reason: "public_hash_or_normalized_private_content_mismatch" });
}
assert.deepEqual(sharedFileMismatches, [], `shared_public_export_file_mismatch:${JSON.stringify(sharedFileMismatches)}`);

const normalizeTextBytes = (bytes) => Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
const productRoots = contract.productEnginePaths;
const privateVariants = new Set(contract.privateMainVariantPaths);
const generatedProductMetadata = new Set(contract.publicGeneratedProductMetadataPaths);
const publicProductFiles = publicFiles.filter((relativePath) => productRoots.some((root) => relativePath === root || relativePath.startsWith(`${root}/`)));
const productSourceMismatches = [];
for (const relativePath of publicProductFiles) {
  if (privateVariants.has(relativePath) || generatedProductMetadata.has(relativePath)) continue;
  let privateBaseBytes;
  try {
    privateBaseBytes = execFileSync("git", ["show", `${contract.mainProductBaseCommit}:${relativePath}`], { cwd: privateRoot, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  } catch {
    productSourceMismatches.push({ path: relativePath, reason: "missing_from_private_main_base" });
    continue;
  }
  const publicBytes = fs.readFileSync(path.join(publicRoot, relativePath));
  if (!normalizeTextBytes(publicBytes).equals(normalizeTextBytes(privateBaseBytes))) productSourceMismatches.push({ path: relativePath, reason: "normalized_content_mismatch" });
}
assert.deepEqual(productSourceMismatches, [], `public_product_source_mismatch:${JSON.stringify(productSourceMismatches)}`);

const publicProductWorkingChanges = fs.existsSync(path.join(publicRoot, ".git"))
  ? execFileSync("git", ["diff", "--name-only", "HEAD", "--", ...productRoots], { cwd: publicRoot, encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/).filter(Boolean)
  : [];
assert.deepEqual(publicProductWorkingChanges, [], `public_product_engine_source_changed:${publicProductWorkingChanges.join(",")}`);

process.stdout.write(`${JSON.stringify({
  gate: "PUBLIC_EXPORT_SURFACE_CONSISTENCY_GATE",
  status: "PASSED",
  publicBaseCommit: contract.publicBaseCommit,
  mainProductBaseCommit: contract.mainProductBaseCommit,
  missingPublicExportFile: 0,
  unclassifiedExportFile: 0,
  privateFileInPublicExport: 0,
  sharedPackageFieldMismatch: 0,
  sharedPublicFileMismatch: 0,
  publicProductSourceMismatch: 0,
  privateMainVariantPathCount: privateVariants.size,
  publicGeneratedProductMetadataPathCount: generatedProductMetadata.size,
  productEngineSourceChanged: false,
  privateMainIncorrectlyTreatedAsPublicExport: false,
  pathsDisclosed: false,
}, null, 2)}\n`);
