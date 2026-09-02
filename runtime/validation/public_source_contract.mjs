import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sortUtf8Bytewise } from "./deterministic-utf8-order.mjs";
import { inspectPublicRepositoryRemotePolicy } from "./public-repository-remote-policy.mjs";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const argumentsList = process.argv.slice(2);
let cliRoot = null;
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  if (argument !== "--public-root") assert.fail(`unsupported_argument:${argument}`);
  const value = argumentsList[index + 1];
  assert(value, "PUBLIC_EXPORT_ROOT_REQUIRED");
  assert.equal(path.isAbsolute(value), true, "public_export_root_must_be_absolute");
  cliRoot = path.normalize(value);
  index += 1;
}
const environmentRoot = process.env.TANCMARK_PUBLIC_EXPORT_ROOT;
if (environmentRoot) assert.equal(path.isAbsolute(environmentRoot), true, "public_export_environment_root_must_be_absolute");
if (cliRoot && environmentRoot) assert.equal(cliRoot, path.normalize(environmentRoot), "public_export_root_sources_disagree");
const explicitlySelectedRoot = cliRoot ?? (environmentRoot ? path.normalize(environmentRoot) : null);
const root = explicitlySelectedRoot ?? scriptRoot;
assert.equal(fs.existsSync(root), true, "public_export_root_missing");
const rootStat = fs.lstatSync(root);
assert.equal(rootStat.isDirectory(), true, "public_export_root_not_directory");
assert.equal(rootStat.isSymbolicLink(), false, "public_export_root_reparse_point_forbidden");

const markerPath = path.join(root, "reports/PUBLIC_EXPORT_MARKER.json");
if (!explicitlySelectedRoot && !fs.existsSync(markerPath)) assert.fail("PUBLIC_EXPORT_ROOT_REQUIRED");
assert.equal(fs.existsSync(markerPath), true, "public_export_marker_missing");
const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
assert.equal(marker.publicExport, true, "public_export_marker_invalid");
assert.equal(marker.publicLicense, "AGPL-3.0-only", "public_export_marker_license_mismatch");
assert.equal(marker.privateHistoryIncluded, false, "private_history_in_public_export");
assert.equal(marker.privateMediaIncluded, false, "private_media_in_public_export");
assert.equal(marker.privateLearningDataIncluded, false, "private_learning_data_in_public_export");
assert.equal(marker.secretsIncluded, false, "secrets_in_public_export");
assert.equal(marker.generatedFromVerifiedExportSurface, true, "unverified_public_export_surface");

for (const required of [
  marker.sourceManifest,
  "SHA256SUMS",
  "LICENSE",
  "package.json",
  "README.md",
  "SBOM.spdx.json",
  "CLA.md",
  "reports/PUBLIC_AND_PRIVATE_REPOSITORY_ROLE_CONTRACT.json",
]) {
  assert.equal(typeof required, "string", "public_export_required_path_invalid");
  assert.equal(fs.existsSync(path.join(root, required)), true, `public_export_required_file_missing:${required}`);
}

const gitDirectory = path.join(root, ".git");
let publicHistoryCommitCount = 0;
let repositoryRemotePolicy = null;
if (fs.existsSync(gitDirectory)) {
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
  assert.equal(path.resolve(repositoryRoot), path.resolve(root), "public_export_nested_in_other_repository");
  publicHistoryCommitCount = Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).trim());
  assert.equal(publicHistoryCommitCount, 1, "public_export_must_have_single_public_commit");
  repositoryRemotePolicy = inspectPublicRepositoryRemotePolicy(root);
}
const forbiddenDirectories = new Set([".local", "node_modules", "dist", "dist-product", "__pycache__"]);
const forbiddenExtensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".wav", ".mp3", ".flac", ".exe", ".dll", ".onnx", ".db", ".sqlite"]);
const publicDemoFixtureHashes = new Map([
  ["fixtures/demo-public/demo-text-en.txt", "1d67d369b2e90a5f08b2284a3d9e9914d2252a619a5049f89c946972d8217904"],
  ["fixtures/demo-public/demo-text-tr.txt", "d784633faf872ce2f41dbd94069fd6b00edcb3cda4194481ad30985adeb353f5"],
  ["fixtures/demo-public/demo-image.png", "060ec84c555e8644e4d73ba69936613687d2b3603b97c992cf62712e45dbe5ec"],
  ["fixtures/demo-public/demo-audio-44100.wav", "84e16360d5a1c0fbddd1fb23b6c64ebcbc1ca7cc8950c0dbf3e9cb2f5f67ac11"],
  ["fixtures/demo-public/demo-audio-48000.wav", "8023d077a1a01ef2bd2d5ac75b3036cd16efb93b6b3b0a405c67979dc679772d"],
  ["fixtures/demo-public/demo-video-source.mkv", "9073a2a0fddc1edc9decb728617a53c8efa1c7d0367e025cd3da228b2d95b754"],
  ["fixtures/demo-public/demo-live-source.mkv", "058913f2e01745a335857bdf85466ade198816d6e5041ed4a435b20ef9949367"],
]);
const forbiddenContent = [
  new RegExp(String.raw`C:\\Users\\[^\\\s]+`, "i"),
  new RegExp(["ADEM", "PROJECT", "ARCHIVE"].join("_"), "i"),
  new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join("")),
  new RegExp(["AK", "IA", "[0-9A-Z]{16}"].join("")),
];
const files = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || forbiddenDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute);
    assert.equal(stat.isSymbolicLink(), false, `public_symlink_forbidden:${path.relative(root, absolute)}`);
    if (entry.isDirectory()) {
      walk(absolute);
    } else if (entry.isFile()) files.push(absolute);
  }
};
walk(root);
const fixtureManifestPath = path.join(root, "fixtures/demo-public/manifest.json");
assert.equal(fs.existsSync(fixtureManifestPath), true, "public_demo_fixture_manifest_missing");
const fixtureManifest = JSON.parse(fs.readFileSync(fixtureManifestPath, "utf8"));
assert.equal(fixtureManifest.schemaVersion, "tancmark-demo-public-fixtures-v1");
assert.equal(fixtureManifest.deterministicSeed, "tancmark-demo-public-synthetic-v1");
assert.equal(fixtureManifest.generator, "runtime/demo/generate-public-fixtures.mjs");
assert.equal(fixtureManifest.files?.length, publicDemoFixtureHashes.size);
for (const fixture of fixtureManifest.files) {
  const relative = `fixtures/demo-public/${fixture.name}`;
  const expected = publicDemoFixtureHashes.get(relative);
  assert(expected, `public_demo_fixture_name_forbidden:${relative}`);
  assert.equal(fixture.sha256, expected, `public_demo_fixture_manifest_hash_mismatch:${relative}`);
  assert.equal(fixture.publicSafe, true, `public_demo_fixture_declaration_missing:${relative}`);
  assert.equal(fixture.deterministicSeed, "tancmark-demo-public-synthetic-v1");
  assert.equal(fixture.license, "AGPL-3.0-only");
}
let publicSyntheticMediaCount = 0;
for (const file of files) {
  const bytes = fs.readFileSync(file);
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (forbiddenExtensions.has(path.extname(file).toLowerCase())) {
    const expected = publicDemoFixtureHashes.get(relative);
    assert(expected, `public_binary_or_media_forbidden:${relative}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `public_demo_fixture_bytes_changed:${relative}`);
    publicSyntheticMediaCount += 1;
  }
  if (bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  for (const pattern of forbiddenContent) assert.equal(pattern.test(text), false, `public_private_content_forbidden:${path.relative(root, file)}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(pkg.license, "AGPL-3.0-only");
const licenseText = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
assert.match(licenseText, /GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3, 19 November 2007/i);
const sbom = JSON.parse(fs.readFileSync(path.join(root, "SBOM.spdx.json"), "utf8"));
const rootPackage = sbom.packages?.find((entry) => entry.SPDXID === "SPDXRef-Package-TancMark") ?? sbom.packages?.[0];
assert.equal(rootPackage?.licenseDeclared, "AGPL-3.0-only");
assert.equal(rootPackage?.licenseConcluded, "AGPL-3.0-only");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const requiredTop = "# TancMark\n\n**Deterministic blind watermarking for text, images, audio, and video.**\n\nRecover hidden IDs from copies without the original.  \nVerify exact matches against signed registry records.\n\n**No AI models in the watermarking core. No GPU required.**";
assert.equal(readme.startsWith(requiredTop), true);
assert.match(readme, /AGPL-3\.0-only/);
assert.equal(/AGPL-3\.0-or-later|dual[- ]license|MIT License/i.test(readme), false, "public_readme_license_contradiction");
const readmeLines = readme.split(/\r?\n/).length;
assert(readmeLines >= 120 && readmeLines <= 180, `public_readme_line_count:${readmeLines}`);
const manifest = sortUtf8Bytewise(files.map((file) => `${createHash("sha256").update(fs.readFileSync(file)).digest("hex")}  ${path.relative(root, file).replaceAll("\\", "/")}`));
process.stdout.write(`${JSON.stringify({ contract: "public_source_contract", status: "passed", rootSelection: explicitlySelectedRoot ? "EXPLICIT_PUBLIC_EXPORT_ROOT" : "MARKER_VERIFIED_CURRENT_PUBLIC_ROOT", publicHistoryCommitCount, repositoryRemotePolicy, publicLicense: "AGPL-3.0-only", sbomRootLicense: "AGPL-3.0-only", fileCount: files.length, symlinkCount: 0, forbiddenDirectoryCount: 0, binaryOrMediaCount: 0, publicSyntheticMediaCount, publicSyntheticFixtureHashCount: publicDemoFixtureHashes.size, privatePathCount: 0, secretPatternCount: 0, pathsDisclosed: false, readmeLines, sourceManifestSha256: createHash("sha256").update(manifest.join("\n")).digest("hex") }, null, 2)}\n`);
