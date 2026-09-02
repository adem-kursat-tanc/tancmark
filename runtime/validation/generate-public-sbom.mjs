import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareUtf8By, DETERMINISTIC_ORDER_ALGORITHM, sortUtf8Bytewise } from "./deterministic-utf8-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pnpmCli = process.env.npm_execpath;
assert(pnpmCli, "run with pnpm run sbom");

const result = spawnSync(process.execPath, [pnpmCli, "licenses", "list", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  env: process.env,
});
assert.equal(result.status, 0, result.stderr || "pnpm license inventory failed");
const grouped = JSON.parse(result.stdout);
const nativeInventoryPath = path.join(root, "reports", "C2PA_NATIVE_RUST_DEPENDENCIES.json");
const nativeInventoryBytes = fs.readFileSync(nativeInventoryPath);
const nativeInventory = JSON.parse(nativeInventoryBytes.toString("utf8"));
const manualResolutionPath = path.join(root, "reports", "PUBLIC_LICENSE_MANUAL_RESOLUTIONS.json");
const manualResolutions = JSON.parse(fs.readFileSync(manualResolutionPath, "utf8"));
assert.equal(nativeInventory.schemaVersion, "tancmark-c2pa-native-rust-inventory-v1");
assert.equal(manualResolutions.schemaVersion, "tancmark-public-license-manual-resolutions-v1");
assert.equal(nativeInventory.sourceCommit, "1fbf8439c19434ef087925cdf29cdf857e96f42a");
assert.equal(nativeInventory.unresolvedLicenseCount, 0);
assert.equal(nativeInventory.nativeBinary.sha256, "dcfdf252a2bd3e6e048e209b0d8ca1733cb3ced0c2462da242906a31b9c941ce");

const inventory = readInstalledPnpmPackages(root);
for (const [license, entries] of Object.entries(grouped)) {
  for (const entry of entries) {
    for (const version of entry.versions) {
      inventory.push({
        name: entry.name,
        version,
        license: entry.license || license || "NOASSERTION",
        homepage: entry.homepage || null,
      });
    }
  }
}
const declaredLicenseFallbacks = new Map();
for (const entry of inventory) {
  if (!/^(?:UNKNOWN|UNLICENSED|NOASSERTION)$/i.test(entry.license)) {
    declaredLicenseFallbacks.set(`${entry.name}@${entry.version}`, entry.license);
  }
}
for (const entry of inventory) {
  if (/^(?:UNKNOWN|UNLICENSED|NOASSERTION)$/i.test(entry.license)) {
    entry.license = declaredLicenseFallbacks.get(`${entry.name}@${entry.version}`) ?? entry.license;
  }
}
inventory.sort(compareUtf8By((entry) => `${entry.name}@${entry.version}`));

const unique = [];
const seen = new Set();
for (const entry of inventory) {
  const key = `${entry.name}@${entry.version}`;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(entry);
  }
}

for (const resolution of manualResolutions.resolutions) {
  const entry = unique.find((candidate) => candidate.name === resolution.name && candidate.version === resolution.version);
  assert(entry, `manual license resolution package missing: ${resolution.name}@${resolution.version}`);
  assert.equal(entry.license, resolution.observedLicense, `manual license observation changed: ${resolution.name}@${resolution.version}`);
  assert.equal(resolution.packageIntegritySha512, "sha512-9q/rDEGSb/Qsvv2qvzIzdluL5k7AaJOTrw23z9reQthrbF7is4CtlT0DXyO1oei2DCp4uojjzQ7igaSHp1kAEQ==");
  assert.equal(resolution.resolvedLicense, "MIT");
  entry.licenseReported = entry.license;
  entry.license = resolution.resolvedLicense;
  entry.licenseResolution = "DOCUMENTED_SOURCE_EVIDENCE";
  entry.licenseEvidenceUrls = resolution.evidenceUrls;
}

const spdxIdFor = (value) => `SPDXRef-Package-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
const rootId = "SPDXRef-Package-TancMark";
const rustPackages = nativeInventory.packages.map((entry) => ({
  SPDXID: `SPDXRef-RustPackage-${createHash("sha256").update(`${entry.name}@${entry.version}`).digest("hex").slice(0, 20)}`,
  name: entry.name,
  versionInfo: entry.version,
  downloadLocation: entry.source === "official-source-workspace"
    ? "https://github.com/contentauth/c2pa-js"
    : "https://crates.io/",
  filesAnalyzed: false,
  licenseConcluded: "NOASSERTION",
  licenseDeclared: entry.licenseDeclared,
  copyrightText: "NOASSERTION",
  externalRefs: entry.source === "official-source-workspace" ? [] : [{
    referenceCategory: "PACKAGE-MANAGER",
    referenceType: "purl",
    referenceLocator: `pkg:cargo/${encodeURIComponent(entry.name)}@${entry.version}`,
  }],
}));
const packages = [
  {
    SPDXID: rootId,
    name: "tancmark",
    versionInfo: "0.1.0-rc.1",
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "AGPL-3.0-only",
    licenseDeclared: "AGPL-3.0-only",
    copyrightText: "NOASSERTION",
  },
  ...unique.map((entry) => ({
    SPDXID: spdxIdFor(`${entry.name}@${entry.version}`),
    name: entry.name,
    versionInfo: entry.version,
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: entry.license,
    copyrightText: "NOASSERTION",
    ...(entry.homepage ? { homepage: entry.homepage } : {}),
    externalRefs: [{
      referenceCategory: "PACKAGE-MANAGER",
      referenceType: "purl",
      referenceLocator: `pkg:npm/${encodeURIComponent(entry.name).replaceAll("%2F", "/")}@${entry.version}`,
    }],
  })),
  ...rustPackages,
];
const c2paNode = unique.find((entry) => entry.name === "@contentauth/c2pa-node" && entry.version === "0.9.1");
assert(c2paNode, "exact @contentauth/c2pa-node 0.9.1 dependency missing from JavaScript inventory");
const c2paNodeId = spdxIdFor(`${c2paNode.name}@${c2paNode.version}`);
const inventorySha = createHash("sha256").update(JSON.stringify(unique)).digest("hex");
const documentId = "SPDXRef-DOCUMENT";
const sbom = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: documentId,
  name: "TancMark-0.1.0-rc.1",
  documentNamespace: `https://spdx.org/spdxdocs/tancmark-0.1.0-rc.1-${inventorySha}`,
  creationInfo: {
    created: "2026-08-31T00:00:00Z",
    creators: ["Tool: TancMark deterministic pnpm license inventory"],
  },
  packages,
  relationships: [
    { spdxElementId: documentId, relationshipType: "DESCRIBES", relatedSpdxElement: rootId },
    ...unique.map((entry) => ({
      spdxElementId: rootId,
      relationshipType: "DEPENDS_ON",
      relatedSpdxElement: spdxIdFor(`${entry.name}@${entry.version}`),
    })),
    ...rustPackages.map((entry) => ({
      spdxElementId: c2paNodeId,
      relationshipType: "DEPENDS_ON",
      relatedSpdxElement: entry.SPDXID,
    })),
  ],
};

const licenses = [...new Set([
  ...unique.map((entry) => entry.license),
  ...nativeInventory.packages.map((entry) => entry.licenseDeclared),
])];
licenses.splice(0, licenses.length, ...sortUtf8Bytewise(licenses));
const unresolved = unique.filter((entry) => /^(?:UNKNOWN|UNLICENSED|NOASSERTION)$/i.test(entry.license));
const nativeUnresolved = nativeInventory.packages.filter((entry) => !entry.licenseDeclared
  || /^(?:UNKNOWN|UNLICENSED|NOASSERTION)$/i.test(entry.licenseDeclared));
assert.equal(nativeUnresolved.length, 0, "native declared-license inventory unresolved");
const scan = {
  schemaVersion: 1,
  generatedAt: "2026-08-31T00:00:00Z",
  status: unresolved.length === 0 ? "PASSED" : "REVIEW_REQUIRED",
  rootLicense: "AGPL-3.0-only",
  dependencyPackageCount: unique.length + nativeInventory.dependencyPackageCount,
  javascriptDependencyPackageCount: unique.length,
  nativeRustDependencyPackageCount: nativeInventory.dependencyPackageCount,
  declaredLicenses: licenses,
  unresolvedLicenseCount: unresolved.length + nativeUnresolved.length,
  declaredLicensePackageCount: unique.filter((entry) => !entry.licenseResolution).length + nativeInventory.dependencyPackageCount,
  documentedSourceLicenseResolutionCount: unique.filter((entry) => entry.licenseResolution === "DOCUMENTED_SOURCE_EVIDENCE").length,
  unresolved,
  nativeUnresolved,
  bundledDependencyBinaries: true,
  bundledNativeBinary: {
    package: "@contentauth/c2pa-node@0.9.1",
    fileName: nativeInventory.nativeBinary.fileName,
    sha256: nativeInventory.nativeBinary.sha256,
    bytes: nativeInventory.nativeBinary.bytes,
    sourceCommit: nativeInventory.sourceCommit,
    cargoLockSha256: nativeInventory.cargoLock.sha256,
    declaredLicenseInventory: "reports/C2PA_NATIVE_RUST_DEPENDENCIES.json",
  },
  externalNetworkCalls: 0,
  inventorySha256: inventorySha,
  orderingAlgorithm: DETERMINISTIC_ORDER_ALGORITHM,
  nativeInventorySha256: createHash("sha256").update(nativeInventoryBytes).digest("hex"),
  legalApprovalClaimed: false,
  inventoryClaim: "Declared licenses or documented source-license evidence found; no legal approval claim is made.",
};

fs.mkdirSync(path.join(root, "reports"), { recursive: true });
fs.writeFileSync(path.join(root, "SBOM.spdx.json"), `${JSON.stringify(sbom, null, 2)}\n`);
fs.writeFileSync(path.join(root, "reports", "PUBLIC_LICENSE_SCAN.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(scan, null, 2)}\n`);

function readInstalledPnpmPackages(repositoryRoot) {
  const storeRoot = path.join(repositoryRoot, "node_modules", ".pnpm");
  assert.equal(fs.statSync(storeRoot).isDirectory(), true, "pnpm virtual store missing");
  const entries = [];
  for (const virtualEntry of fs.readdirSync(storeRoot, { withFileTypes: true })) {
    if (!virtualEntry.isDirectory() || virtualEntry.name === "node_modules") continue;
    const packageRoot = path.join(storeRoot, virtualEntry.name, "node_modules");
    if (!fs.existsSync(packageRoot)) continue;
    for (const packageEntry of fs.readdirSync(packageRoot, { withFileTypes: true })) {
      if (!packageEntry.isDirectory()) continue;
      if (packageEntry.name.startsWith("@")) {
        const scopeRoot = path.join(packageRoot, packageEntry.name);
        for (const scopedEntry of fs.readdirSync(scopeRoot, { withFileTypes: true })) {
          if (scopedEntry.isDirectory()) addInstalledPackage(path.join(scopeRoot, scopedEntry.name), entries);
        }
      } else {
        addInstalledPackage(path.join(packageRoot, packageEntry.name), entries);
      }
    }
  }
  return entries;
}

function addInstalledPackage(packageRoot, entries) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath) || fs.lstatSync(packageJsonPath).isSymbolicLink()) return;
  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (typeof manifest.name !== "string" || typeof manifest.version !== "string") return;
  const license = typeof manifest.license === "string"
    ? manifest.license
    : Array.isArray(manifest.licenses)
      ? manifest.licenses.map((entry) => typeof entry === "string" ? entry : entry?.type).filter(Boolean).join(" OR ")
      : "NOASSERTION";
  const repository = typeof manifest.repository === "string"
    ? manifest.repository
    : typeof manifest.repository?.url === "string"
      ? manifest.repository.url
      : null;
  entries.push({
    name: manifest.name,
    version: manifest.version,
    license: license || "NOASSERTION",
    homepage: typeof manifest.homepage === "string" ? manifest.homepage : repository,
  });
}
