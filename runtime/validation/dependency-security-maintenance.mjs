// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAINTENANCE_PATH = "reports/DEPENDENCY_SECURITY_MAINTENANCE_20261109.json";
export const HISTORICAL_INVENTORY = Object.freeze({ dependencyPackageCount: 1115, javascriptDependencyPackageCount: 604, nativeRustDependencyPackageCount: 511, declaredLicensePackageCount: 1115, documentedSourceLicenseResolutionCount: 0, unresolvedLicenseCount: 0 });
const historicalReports = {
  "reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json": "22fa9f59d6392b2186bd454f0016fd03d2be45e0f6936b54d302b3a68132f794",
  "reports/PUBLIC_V13_SECURITY_REMEDIATION_CLOSURE_20260902.json": "67af2449e4cf9312e5dcfba8bcc66f66048824dbbc2cb3be75bb06d517078ee8",
  "reports/DEPENDENCY_SECURITY_MAINTENANCE_20260923.json": "338376dd2dfddb3768b9b2ca27ff569c210fa67213af845cf8d52100fa274e2e",
  "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json": "4ae5dc402485b4457c920be15b422462e332044f56c40010a772b57de3f6ef41",
};
const requiredCommands = ["pnpm run typecheck", "pnpm run build", "pnpm run build:product", "pnpm run test:canonical-reader-scope", "pnpm run test:seal-security", "pnpm run test:c2pa-rsa-policy", "pnpm --filter @workspace/api-spec codegen"];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const gitBlob = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export function maintenanceProductPath(relative) {
  return relative === "lib/api-spec/orval.config.ts" || /^lib\/api-(?:zod|client-react)\/src\/generated\/[A-Za-z0-9_./-]+\.ts$/.test(relative);
}
function safePath(relative) {
  assert.equal(typeof relative, "string", "maintenance_path_missing");
  assert(/^[A-Za-z0-9_./-]+$/.test(relative) && !relative.split("/").some((part) => part === ".." || part === "" || part === "."), `maintenance_path_invalid:${relative}`);
}
export function inventorySentence(inventory) {
  return `Current clean-install inventory covers ${inventory.dependencyPackageCount.toLocaleString("en-US")} dependencies: ${inventory.javascriptDependencyPackageCount} JavaScript packages and ${inventory.nativeRustDependencyPackageCount} native Rust packages. Unresolved license count is zero. This is not a legal-approval claim.`;
}
export function validateDependencyMaintenance(root, receipt) {
  assert.equal(receipt.schemaVersion, "tancmark-dependency-security-maintenance-v2");
  assert.equal(receipt.scope, "DEPENDENCY_AND_GENERATOR_SECURITY_MAINTENANCE");
  assert.equal(receipt.baseCommit, "aeb2ec8367a569c53672b20390168391157da9c7");
  const bytes = (relative) => { safePath(relative); return fs.readFileSync(path.join(root, relative)); };
  for (const [relative, hash] of Object.entries(historicalReports)) assert.equal(sha(bytes(relative)), hash, `maintenance_historical_report_changed:${relative}`);
  const inventory = receipt.inventory;
  for (const field of Object.keys(HISTORICAL_INVENTORY)) assert(Number.isSafeInteger(inventory?.[field]) && inventory[field] >= 0, `maintenance_inventory_invalid:${field}`);
  assert(inventory.javascriptDependencyPackageCount > 0);
  assert.equal(inventory.nativeRustDependencyPackageCount, 511);
  assert.equal(inventory.dependencyPackageCount, inventory.javascriptDependencyPackageCount + inventory.nativeRustDependencyPackageCount);
  assert.equal(inventory.declaredLicensePackageCount, inventory.dependencyPackageCount);
  assert.equal(inventory.documentedSourceLicenseResolutionCount, 0);
  assert.equal(inventory.unresolvedLicenseCount, 0);
  const license = JSON.parse(bytes("reports/PUBLIC_LICENSE_SCAN.json"));
  for (const field of Object.keys(HISTORICAL_INVENTORY)) assert.equal(license[field], inventory[field], `maintenance_license_inventory_mismatch:${field}`);
  const baselinePath = "reports/security-maintenance-20261109/BASE_FILE_HASHES.json";
  const baselineBytes = bytes(baselinePath);
  assert.equal(sha(baselineBytes), "da12e5a32721b63656caf111144c72aec0fdabea6ae58e61353eb036254e2c93", "maintenance_base_manifest_changed");
  const baseline = new Map(JSON.parse(baselineBytes).map((record) => [record.path, record]));
  const files = new Map();
  assert(Array.isArray(receipt.files) && receipt.files.length > 0, "maintenance_files_missing");
  for (const record of receipt.files) {
    safePath(record.path);
    assert(!files.has(record.path), `maintenance_duplicate_path:${record.path}`);
    assert(["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "artifacts/api-server/package.json", "artifacts/dashboard-ui/package.json", "lib/api-spec/package.json", "lib/api-zod/package.json", "lib/api-client-react/package.json"].includes(record.path) || maintenanceProductPath(record.path), `maintenance_path_outside_scope:${record.path}`);
    for (const field of ["beforeSha256", "afterSha256"]) assert.match(record[field], /^[0-9a-f]{64}$/);
    for (const field of ["beforeGitBlob", "afterGitBlob"]) assert.match(record[field], /^[0-9a-f]{40}$/);
    assert.notEqual(record.beforeSha256, record.afterSha256, `maintenance_unchanged_file:${record.path}`);
    assert.equal(record.beforeSha256, baseline.get(record.path)?.sha256, `maintenance_base_hash_mismatch:${record.path}`);
    assert.equal(record.beforeGitBlob, baseline.get(record.path)?.gitBlob, `maintenance_base_blob_mismatch:${record.path}`);
    const actual = bytes(record.path);
    assert.equal(sha(actual), record.afterSha256, `maintenance_current_hash_mismatch:${record.path}`);
    assert.equal(gitBlob(actual), record.afterGitBlob, `maintenance_current_blob_mismatch:${record.path}`);
    files.set(record.path, record);
  }
  assert.deepEqual([...files.keys()].sort(), [...baseline.keys()].sort(), "maintenance_base_file_set_mismatch");
  assert(files.has("pnpm-lock.yaml"), "maintenance_lockfile_missing");
  const september = JSON.parse(bytes("reports/DEPENDENCY_SECURITY_MAINTENANCE_20260923.json"));
  for (const old of september.historicalV13FilesNowUpdated) {
    const next = files.get(old.path);
    assert.equal(next?.beforeSha256 ?? sha(bytes(old.path)), old.currentSha256, `maintenance_september_continuity_mismatch:${old.path}`);
  }
  const verifyArtifact = (relative, hash) => {
    safePath(relative);
    assert(relative.startsWith("reports/security-maintenance-20261109/"), `maintenance_evidence_path_invalid:${relative}`);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(sha(bytes(relative)), hash, `maintenance_evidence_hash_mismatch:${relative}`);
  };
  assert(Array.isArray(receipt.evidence), "maintenance_test_evidence_missing");
  const commands = new Set();
  for (const result of receipt.evidence) {
    assert.equal(typeof result.command, "string");
    assert(!commands.has(result.command), `maintenance_duplicate_command:${result.command}`);
    commands.add(result.command);
    assert.equal(result.exitCode, 0, `maintenance_test_failed:${result.command}`);
    verifyArtifact(result.outputPath, result.outputSha256);
  }
  for (const command of requiredCommands) assert(commands.has(command), `maintenance_required_test_missing:${command}`);
  verifyArtifact(receipt.audit?.path, receipt.audit?.sha256);
  const audit = JSON.parse(bytes(receipt.audit.path));
  for (const severity of ["info", "low", "moderate", "high", "critical"]) assert.equal(audit.metadata?.vulnerabilities?.[severity], 0, `maintenance_audit_nonzero:${severity}`);
  return { ...receipt, filesByPath: files };
}
export function loadDependencyMaintenance(root) {
  return validateDependencyMaintenance(root, JSON.parse(fs.readFileSync(path.join(root, MAINTENANCE_PATH), "utf8")));
}
