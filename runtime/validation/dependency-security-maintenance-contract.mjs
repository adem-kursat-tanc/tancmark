// SPDX-License-Identifier: AGPL-3.0-only
// Offline negative controls use temporary synthetic evidence, never release receipts.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDependencyMaintenance, HISTORICAL_INVENTORY, gitBlob } from "./dependency-security-maintenance.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-maintenance-contract-"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const write = (relative, value) => { const target = path.join(temp, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); };
const copy = (relative) => write(relative, fs.readFileSync(path.join(root, relative)));
let rejected = 0;
try {
  for (const relative of ["reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json", "reports/PUBLIC_V13_SECURITY_REMEDIATION_CLOSURE_20260902.json", "reports/DEPENDENCY_SECURITY_MAINTENANCE_20260923.json", "reports/PUBLIC_EXPORT_SURFACE_CONTRACT.json"]) copy(relative);
  write("reports/PUBLIC_LICENSE_SCAN.json", JSON.stringify(HISTORICAL_INVENTORY));
  const baselinePath = "reports/security-maintenance-20261109/BASE_FILE_HASHES.json";
  copy(baselinePath);
  const baseline = JSON.parse(fs.readFileSync(path.join(root, baselinePath)));
  const files = baseline.map((record) => {
    copy(record.path);
    const bytes = fs.readFileSync(path.join(temp, record.path));
    return { path: record.path, beforeSha256: record.sha256, afterSha256: hash(bytes), beforeGitBlob: record.gitBlob, afterGitBlob: gitBlob(bytes) };
  });
  const outputPath = "reports/security-maintenance-20261109/fixture.txt";
  const output = "Synthetic offline fixture, not release test evidence.\n";
  write(outputPath, output);
  const evidence = ["pnpm run typecheck", "pnpm run build", "pnpm run build:product", "pnpm run test:canonical-reader-scope", "pnpm run test:seal-security", "pnpm run test:c2pa-rsa-policy", "pnpm --filter @workspace/api-spec codegen"].map((command) => ({ command, exitCode: 0, outputPath, outputSha256: hash(output) }));
  const auditPath = "reports/security-maintenance-20261109/fixture-audit.json";
  const auditBytes = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } });
  write(auditPath, auditBytes);
  const receipt = { schemaVersion: "tancmark-dependency-security-maintenance-v2", scope: "DEPENDENCY_AND_GENERATOR_SECURITY_MAINTENANCE", baseCommit: "aeb2ec8367a569c53672b20390168391157da9c7", inventory: { ...HISTORICAL_INVENTORY }, files, evidence, audit: { path: auditPath, sha256: hash(auditBytes) } };
  const alignedPath = "artifacts/tancmark-demo/package.json";
  const alignedAuditPath = "reports/security-maintenance-20261109/fixture-aligned-audit.json";
  write(alignedAuditPath, auditBytes);
  copy(alignedPath);
  const alignedBytes = fs.readFileSync(path.join(temp, alignedPath));
  receipt.manifestAlignment = {
    schemaVersion: "tancmark-sharp-manifest-alignment-v1",
    baseCommit: "2a61a7d9f36979e606b226f71415056d24cc7466",
    file: { path: alignedPath, beforeSha256: "e91b62a31d6cd0c4b26d118af632113394b16141d8ceaf9ab208a26037ae87f4", beforeGitBlob: "c8927d42234ffad42ad2b10a85c81279f39ae179", afterSha256: hash(alignedBytes), afterGitBlob: gitBlob(alignedBytes) },
    evidence: [
      { command: "pnpm install --frozen-lockfile", exitCode: 0, outputPath, outputSha256: hash(output) },
      { command: "pnpm audit --json", exitCode: 0, outputPath: alignedAuditPath, outputSha256: hash(auditBytes) },
      { command: "node runtime/validation/public_sharp_manifest_alignment_smoke.mjs", exitCode: 0, outputPath, outputSha256: hash(output) },
    ],
  };
  validateDependencyMaintenance(temp, receipt);
  const reject = (mutate, pattern) => { const changed = structuredClone(receipt); mutate(changed); assert.throws(() => validateDependencyMaintenance(temp, changed), pattern); rejected++; };
  reject((r) => { r.baseCommit = "0".repeat(40); });
  reject((r) => { r.files[0].path = "artifacts/api-server/src/security.ts"; }, /outside_scope/);
  reject((r) => { r.files[0].path = "../package.json"; }, /path_invalid/);
  reject((r) => { r.files[0].afterSha256 = "0".repeat(64); }, /current_hash_mismatch/);
  reject((r) => { r.files[0].afterGitBlob = "0".repeat(40); }, /current_blob_mismatch/);
  reject((r) => { r.files[0].beforeSha256 = "0".repeat(64); }, /base_hash_mismatch/);
  reject((r) => { r.files[0].beforeGitBlob = "0".repeat(40); }, /base_blob_mismatch/);
  reject((r) => { r.files.pop(); }, /base_file_set_mismatch/);
  reject((r) => { r.files.push(r.files[0]); }, /duplicate_path/);
  reject((r) => { r.inventory.nativeRustDependencyPackageCount++; });
  reject((r) => { r.inventory.unresolvedLicenseCount++; });
  reject((r) => { r.evidence.pop(); }, /required_test_missing/);
  reject((r) => { r.evidence[0].exitCode = 1; }, /test_failed/);
  reject((r) => { r.evidence[0].outputSha256 = "0".repeat(64); }, /evidence_hash_mismatch/);
  reject((r) => { r.evidence[0].outputPath = "../fixture.txt"; }, /path_invalid/);
  reject((r) => { delete r.manifestAlignment; }, /manifest_alignment_missing/);
  reject((r) => { r.manifestAlignment.baseCommit = "0".repeat(40); });
  reject((r) => { r.manifestAlignment.file.path = "package.json"; }, /alignment_path_invalid/);
  reject((r) => { r.manifestAlignment.file.beforeSha256 = "0".repeat(64); }, /alignment_base_hash_mismatch/);
  reject((r) => { r.manifestAlignment.file.beforeGitBlob = "0".repeat(40); }, /alignment_base_blob_mismatch/);
  reject((r) => { r.manifestAlignment.file.afterSha256 = "0".repeat(64); }, /alignment_current_hash_mismatch/);
  reject((r) => { r.manifestAlignment.file.afterGitBlob = "0".repeat(40); }, /alignment_current_blob_mismatch/);
  reject((r) => { r.manifestAlignment.evidence.pop(); }, /alignment_required_test_missing/);
  reject((r) => { r.manifestAlignment.evidence[0].exitCode = 1; }, /alignment_test_failed/);
  reject((r) => { r.manifestAlignment.evidence[0].outputSha256 = "0".repeat(64); }, /evidence_hash_mismatch/);
  reject((r) => { r.manifestAlignment.evidence[0].outputPath = "../fixture.txt"; }, /path_invalid/);
  reject((r) => { r.manifestAlignment.evidence.push(r.manifestAlignment.evidence[0]); }, /alignment_duplicate_command/);
  const alignedVulnerable = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 0, critical: 0 } } });
  write(alignedAuditPath, alignedVulnerable);
  reject((r) => { r.manifestAlignment.evidence.find((entry) => entry.command === "pnpm audit --json").outputSha256 = hash(alignedVulnerable); }, /alignment_audit_nonzero:low/);
  write(alignedAuditPath, auditBytes);
  const rejectAlignedContent = (change, pattern) => {
    const altered = Buffer.from(change(alignedBytes.toString("utf8")));
    write(alignedPath, altered);
    reject((r) => { r.manifestAlignment.file.afterSha256 = hash(altered); r.manifestAlignment.file.afterGitBlob = gitBlob(altered); }, pattern);
    write(alignedPath, alignedBytes);
  };
  rejectAlignedContent((text) => text.replace('"sharp": "0.35.5"', '"sharp": "0.35.4"'), /alignment_sharp_version_mismatch/);
  rejectAlignedContent((text) => text.replace('"hls.js": "1.7.1"', '"hls.js": "1.7.2"'), /alignment_unexpected_file_delta/);
  rejectAlignedContent((text) => `${text}\n`, /alignment_unexpected_file_delta/);
  for (const [relative, change, pattern] of [
    ["pnpm-workspace.yaml", (text) => text.replace("  sharp: 0.35.5", "  sharp: 0.35.4"), /alignment_override_mismatch/],
    ["pnpm-lock.yaml", (text) => text.replaceAll("version: 0.35.5(@types/node@25.3.5)", "version: 0.35.4(@types/node@25.3.5)"), /alignment_lock_mismatch/],
  ]) {
    const original = fs.readFileSync(path.join(temp, relative));
    const altered = Buffer.from(change(original.toString("utf8")));
    assert.notDeepEqual(altered, original);
    write(relative, altered);
    reject((r) => { const record = r.files.find((file) => file.path === relative); record.afterSha256 = hash(altered); record.afterGitBlob = gitBlob(altered); }, pattern);
    write(relative, original);
  }
  const vulnerable = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 0, critical: 0 } } });
  write(auditPath, vulnerable);
  reject((r) => { r.audit.sha256 = hash(vulnerable); }, /audit_nonzero:low/);
  write(auditPath, auditBytes);
  write("reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json", "{}");
  reject(() => {}, /historical_report_changed/);
  process.stdout.write(`${JSON.stringify({ gate: "DEPENDENCY_SECURITY_MAINTENANCE_CONTRACT", status: "PASSED", rejected })}\n`);
} finally {
  // Only the exact mkdtemp directory created above is removed.
  fs.rmSync(temp, { recursive: true, force: true });
}
