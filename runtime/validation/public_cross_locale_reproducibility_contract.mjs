// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePublicSourceClassDigests } from "./public_documentation_freshness_gate.mjs";
import { DETERMINISTIC_ORDER_ALGORITHM, sortUtf8Bytewise } from "./deterministic-utf8-order.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const locales = ["tr_TR.UTF-8", "en_US.UTF-8", "C.UTF-8"];
const generatedFiles = [
  "SHA256SUMS",
  "reports/PUBLIC_SOURCE_MANIFEST.json",
  "SBOM.spdx.json",
  "reports/PUBLIC_LICENSE_SCAN.json",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(command, args, locale, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, LANG: locale, LC_ALL: locale },
  });
  assert.equal(result.status, 0, `${label}:${locale}:${result.stderr || result.stdout}`);
  return result.stdout;
}

function runSbom(locale) {
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli && fs.existsSync(pnpmCli)) {
    run(process.execPath, [pnpmCli, "run", "sbom"], locale, "SBOM_GENERATION_FAILED");
    return;
  }
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "sbom"], locale, "SBOM_GENERATION_FAILED");
}

function walkReleaseFiles(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkReleaseFiles(absolute, output);
    else if (entry.isFile() && /\.(?:mjs|js|ts)$/i.test(entry.name)) output.push(absolute);
  }
}

function localeSensitiveReleaseFiles() {
  const localeSensitivePattern = new RegExp([
    ["locale", "Compare"].join(""),
    ["Intl", "\\.", "Collator"].join(""),
  ].join("|"));
  const files = [];
  walkReleaseFiles(path.join(root, "runtime", "validation"), files);
  walkReleaseFiles(path.join(root, "scripts"), files);
  const publicBuild = path.join(root, "runtime", "public-build.mjs");
  if (fs.existsSync(publicBuild)) files.push(publicBuild);
  return sortUtf8Bytewise(files.map((absolute) => path.relative(root, absolute).replaceAll("\\", "/")))
    .filter((relative) => localeSensitivePattern.test(fs.readFileSync(path.join(root, relative), "utf8")));
}

function probe() {
  const digests = calculatePublicSourceClassDigests(root);
  return {
    orderingAlgorithm: digests.orderingAlgorithm,
    productEngineDigest: digests.productEngineDigest,
    productEngineFileCount: digests.productEngineFileCount,
    productEngineFileSetExact: digests.productEngineFileSetExact,
    validationToolingDigest: digests.validationToolingDigest,
    documentationAndEvidenceDigest: digests.documentationAndEvidenceDigest,
    publicSourceDigest: digests.publicSourceDigest,
    historicalBaseCommitStatus: digests.historicalBaseCommitStatus,
  };
}

if (process.argv.includes("--probe")) {
  process.stdout.write(`${JSON.stringify(probe())}\n`);
} else {
  const forbiddenReleaseOrdering = localeSensitiveReleaseFiles();
  assert.deepEqual(forbiddenReleaseOrdering, [], `LOCALE_SENSITIVE_RELEASE_ORDERING:${forbiddenReleaseOrdering.join(",")}`);

  const runs = [];
  for (const locale of locales) {
    runSbom(locale);
    run(process.execPath, [path.join(root, "runtime/validation/generate-public-manifest.mjs")], locale,
      "SOURCE_MANIFEST_GENERATION_FAILED");
    const probeOutput = run(process.execPath,
      [path.join(root, "runtime/validation/public_cross_locale_reproducibility_contract.mjs"), "--probe"],
      locale, "DIGEST_PROBE_FAILED").trim();
    const fileHashes = Object.fromEntries(generatedFiles.map((relative) => {
      const bytes = fs.readFileSync(path.join(root, relative));
      return [relative, { sha256: sha256(bytes), bytes: bytes.length }];
    }));
    runs.push({ locale, probe: JSON.parse(probeOutput), files: fileHashes });
  }

  const authority = JSON.stringify({ probe: runs[0].probe, files: runs[0].files });
  for (const runResult of runs.slice(1)) {
    assert.equal(JSON.stringify({ probe: runResult.probe, files: runResult.files }), authority,
      `CROSS_LOCALE_RELEASE_BYTES_MISMATCH:${runResult.locale}`);
  }

  process.stdout.write(`${JSON.stringify({
    contract: "PUBLIC_CROSS_LOCALE_REPRODUCIBILITY_CONTRACT",
    status: "PASSED",
    orderingAlgorithm: DETERMINISTIC_ORDER_ALGORITHM,
    locales,
    localeSensitiveReleaseOrderingFileCount: 0,
    productFileContentsChanged: false,
    byteIdentical: {
      sourceManifest: true,
      sha256Sums: true,
      sbom: true,
      licenseReport: true,
      productDigest: true,
      validationDigest: true,
      documentationDigest: true,
      publicSourceDigest: true,
    },
    runs,
  }, null, 2)}\n`);
}
