// SPDX-License-Identifier: AGPL-3.0-only
// Synthetic negative controls are not release evidence.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { RELEASE_TRANSITION_PATH, validateReleaseVersionTransition, loadReleaseVersionTransition, releaseSha, releaseBlob } from "./release-version-transition.mjs";
import { loadDependencyMaintenance } from "./dependency-security-maintenance.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const current = fs.readFileSync(path.join(root, "package.json"));
const receipt = JSON.parse(fs.readFileSync(path.join(root, RELEASE_TRANSITION_PATH)));
const result = validateReleaseVersionTransition(current, receipt);
assert.equal(releaseSha(result.before), receipt.file.beforeSha256);
assert.equal(releaseSha(fs.readFileSync(path.join(root, "reports/DEPENDENCY_SECURITY_MAINTENANCE_20261109.json"))), "3a4bbecb4b3b2204f5684806a8edf03494c9df22400f9f5f420db5e9f663c700", "release_original_maintenance_receipt_changed");
assert.equal(loadDependencyMaintenance(root).filesByPath.get("package.json").afterSha256, releaseSha(current));
const sbom = JSON.parse(fs.readFileSync(path.join(root, "SBOM.spdx.json")));
assert.equal(sbom.packages.find(p => p.SPDXID === "SPDXRef-Package-TancMark").versionInfo, receipt.toVersion);
assert.equal(sbom.name, `TancMark-${receipt.toVersion}`);
assert(sbom.documentNamespace.startsWith(`https://spdx.org/spdxdocs/tancmark-${receipt.toVersion}-`));
let rejected = 0;
function reject(mutate, bytes = current) { const r = structuredClone(receipt); mutate(r); assert.throws(() => validateReleaseVersionTransition(bytes, r)); rejected++; }
for (const field of ["schemaVersion", "scope", "baseCommit", "baseTree", "fromVersion", "toVersion"]) reject(r => { r[field] = "invalid"; });
reject(r => { r.published = true; });
reject(r => { delete r.file; });
for (const field of ["path", "beforeSha256", "beforeGitBlob", "afterSha256", "afterGitBlob"]) reject(r => { r.file[field] = "invalid"; });
for (const change of [
  t => t.replace('"version": "0.1.0-rc.2"', '"version": "0.1.0-rc.1"'),
  t => t.replace('"version": "0.1.0-rc.2"', '"version": "0.1.0-rc.3"'),
  t => t.replace('"unzipper": "0.12.5"', '"unzipper": "0.12.4"'),
  t => t.replace('node runtime/c2pa/install-verified-native.mjs', 'node runtime/other.mjs'),
  t => `${t}\n`,
  t => t.replace('"version": "0.1.0-rc.2",', '"version": "0.1.0-rc.2",\n  "version": "0.1.0-rc.2",'),
  t => t.replace('"name": "tancmark"', '"name": "renamed"'),
]) { const altered = Buffer.from(change(current.toString("utf8"))); assert.notDeepEqual(altered, current); reject(r => { r.file.afterSha256 = releaseSha(altered); r.file.afterGitBlob = releaseBlob(altered); }, altered); }
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-version-contract-"));
try { assert.throws(() => loadReleaseVersionTransition(temp, current)); rejected++; }
finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log(JSON.stringify({ contract: "RELEASE_VERSION_TRANSITION", status: "PASSED", rejected, originalMaintenanceReceiptUnchanged: true, sbomVersionConsistent: true }));
