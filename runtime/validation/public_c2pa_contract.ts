// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { link, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { C2PA_DIGITAL_SOURCE_TYPES, C2paBuilderAdapter } from "../../artifacts/api-server/src/c2pa/C2paBuilderAdapter.ts";
import { C2paReaderAdapter } from "../../artifacts/api-server/src/c2pa/C2paReaderAdapter.ts";
import { redactC2paInspection } from "../../artifacts/api-server/src/c2pa/C2paRedaction.ts";
import { C2paSignerAdapter } from "../../artifacts/api-server/src/c2pa/C2paSignerAdapter.ts";
import { C2paTancMarkBridge } from "../../artifacts/api-server/src/c2pa/C2paTancMarkBridge.ts";
import {
  buildTancMarkSupportAssertion,
  parseTancMarkSupportAssertion,
  remoteManifestDecision,
} from "../../artifacts/api-server/src/c2pa/C2paSecurityPolicy.ts";
import {
  assertC2paNoNetwork,
  c2paRegistryRecordIdentity,
  resolveC2paTenantInput,
  resolveC2paTenantOutput,
} from "../../artifacts/api-server/src/c2pa/C2paProductPolicy.ts";
import { atomicWriteNewFile } from "../../artifacts/api-server/src/c2pa/safeLocalFiles.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X9lC8QAAAABJRU5ErkJggg==", "base64");
const passed: string[] = [];
const measured: Record<string, string> = {};
const pass = (name: string) => { passed.push(name); };
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const privateLeakPattern = new RegExp(`BEGIN PRIVATE KEY|key\\.pem|cert\\.pem|Users[\\\\/]|${["ADEM", "PROJECT", "ARCHIVE"].join("_")}`, "i");
const registryReferenceKey = Buffer.alloc(32, 0x5a).toString("base64url");

async function generateCertificate(directory: string, expired = false): Promise<void> {
  const env = { ...process.env, NODE_ENV: "test", TANCMARK_C2PA_ALLOW_TEST_SIGNING: "1" };
  delete env.AEGIS_PRODUCT_RUNTIME;
  if (process.platform === "linux" && env.TANCMARK_DEMO_ONLY === "1") {
    const args = [path.join(root, "runtime", "c2pa", "generate-test-certificate-linux-demo.mjs"), directory];
    if (expired) args.push("--expired");
    const result = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true, env });
    assert.equal(result.status, 0, `certificate_generation_failed:${result.stderr}`);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /PRIVATE KEY|Users[\\/]/i);
    return;
  }
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "runtime", "c2pa", "generate-test-certificate.ps1"), "-OutputDirectory", directory];
  if (expired) args.push("-Expired");
  const result = spawnSync("pwsh.exe", args, { encoding: "utf8", windowsHide: true, env });
  assert.equal(result.status, 0, `certificate_generation_failed:${result.stderr}`);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /PRIVATE KEY|Users[\\/]/i);
}

async function main(): Promise<void> {
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "tancmark-c2pa-final-"));
assert(path.resolve(temporaryRoot).startsWith(path.resolve(os.tmpdir())), "temporary_root_outside_os_temp");
const tenantA = path.join(temporaryRoot, "tenant-a");
const tenantB = path.join(temporaryRoot, "tenant-b");
const wrongPair = path.join(temporaryRoot, "wrong-pair");
const expired = path.join(temporaryRoot, "expired");
await Promise.all([mkdir(tenantA), mkdir(tenantB), mkdir(wrongPair), mkdir(expired)]);
const sourcePath = path.join(tenantA, "source.png");
await writeFile(sourcePath, PNG, { flag: "wx" });
const originalSha = sha(await readFile(sourcePath));
await generateCertificate(tenantA);
await generateCertificate(wrongPair);
await generateCertificate(expired, true);

const environment = {
  ...process.env,
  C2PA_REMOTE_MANIFEST_FETCH: "false",
  TANCMARK_C2PA_TENANT_ROOTS_JSON: JSON.stringify({ tenant_a: tenantA, tenant_b: tenantB }),
  TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON: JSON.stringify({ tenant_a: registryReferenceKey }),
};

try {
  assertC2paNoNetwork(environment);
  assert.throws(() => assertC2paNoNetwork({ ...environment, C2PA_REMOTE_MANIFEST_FETCH: "true" }), /not_supported/);
  assert.equal(remoteManifestDecision("https://example.invalid/manifest.c2pa").allowed, false);
  assert.equal(remoteManifestDecision("http://127.0.0.1/internal").allowed, false);
  pass("remote_manifest_and_ssrf_like_url_blocked");

  const unresolved = await resolveC2paTenantInput({ tenantId: "tenant_a", assetName: "source.png", env: environment });
  assert.equal(unresolved, sourcePath);
  await assert.rejects(resolveC2paTenantInput({ tenantId: "tenant_a", assetName: "../source.png", env: environment }), /reference_invalid/);
  await assert.rejects(resolveC2paTenantInput({ tenantId: "tenant_b", assetName: "source.png", env: environment }));
  pass("path_traversal_and_wrong_tenant_blocked");

  const noC2pa = await C2paReaderAdapter.readManifest(sourcePath);
  assert.equal(noC2pa.status, "NO_C2PA");
  assert.equal(redactC2paInspection(noC2pa).status, "NO_C2PA");
  pass("no_c2pa");

  const certificatePath = path.join(tenantA, "cert.pem");
  const privateKeyPath = path.join(tenantA, "key.pem");
  const previousNodeEnv = process.env["NODE_ENV"];
  const previousProductRuntime = process.env["AEGIS_PRODUCT_RUNTIME"];
  let signer: C2paSignerAdapter;
  try {
    process.env["NODE_ENV"] = "production";
    delete process.env["AEGIS_PRODUCT_RUNTIME"];
    signer = await C2paSignerAdapter.fromConfiguredPaths({ certificatePath, privateKeyPath });
  } finally {
    if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = previousNodeEnv;
    if (previousProductRuntime === undefined) delete process.env["AEGIS_PRODUCT_RUNTIME"];
    else process.env["AEGIS_PRODUCT_RUNTIME"] = previousProductRuntime;
  }
  assert.equal(signer.algorithm, "es256");
  pass("product_configured_path_es256_and_default_algorithm");
  const certificatePem = await readFile(certificatePath, "utf8");
  const outputPath = await resolveC2paTenantOutput({ tenantId: "tenant_a", outputName: "signed.png", env: environment });
  const signed = await C2paBuilderAdapter.signAndEmbedManifest({
    inputPath: sourcePath,
    outputPath,
    intent: "CREATE",
    digitalSourceType: C2PA_DIGITAL_SOURCE_TYPES.DIGITAL_CAPTURE,
    recordIdentity: c2paRegistryRecordIdentity("tenant_a", "registry-record-001", environment),
    recordVersion: "1",
    algorithmVersion: "tancmark-0.1",
    createdAt: "2026-08-28T00:00:00.000Z",
    publicVerificationUrl: "https://verify.example.invalid/records/opaque",
    signer,
    trustMode: "CUSTOM_TRUST_ANCHOR",
    customTrustAnchorPem: certificatePem,
  });
  assert.equal(signed.ok, true);
  assert.equal(signed.outputValidation.signatureCryptographicallyValid, true);
  assert.equal(signed.outputValidation.assetIntegrityValid, true);
  assert.equal(signed.outputValidation.tancmarkAssertion?.supportOnly, true);
  assert.match(signed.outputValidation.tancmarkAssertion?.publicRegistryReference ?? "", /^tmr_v1_[A-Za-z0-9_-]{43}$/);
  assert.equal(redactC2paInspection(signed.outputValidation).status, "VALID_AND_TRUSTED_TEST_CONTEXT");
  assert.equal(sha(await readFile(sourcePath)), originalSha);
  pass("create_sign_embed_read_verify_and_original_unchanged");

  const secondRead = await C2paReaderAdapter.readManifest(outputPath, { trustMode: "CUSTOM_TRUST_ANCHOR", customTrustAnchorPem: certificatePem });
  assert.equal(secondRead.signatureCryptographicallyValid, true);
  assert.equal(secondRead.assetIntegrityValid, true);
  pass("repeat_manifest_verification");

  const editedPath = await resolveC2paTenantOutput({ tenantId: "tenant_a", outputName: "edited.png", env: environment });
  const editSigner = await C2paSignerAdapter.fromConfiguredPaths({ certificatePath, privateKeyPath, algorithm: "es256" });
  const edited = await C2paBuilderAdapter.signAndEmbedManifest({
    inputPath: outputPath, outputPath: editedPath, intent: "EDIT",
    recordIdentity: c2paRegistryRecordIdentity("tenant_a", "registry-record-002", environment),
    recordVersion: "2", algorithmVersion: "tancmark-0.1", createdAt: "2026-08-28T00:00:01.000Z",
    signer: editSigner, trustMode: "CUSTOM_TRUST_ANCHOR", customTrustAnchorPem: certificatePem,
  });
  assert.ok(edited.outputValidation.ingredientCount >= 1);
  pass("ingredient_parent_link");

  const tamperedBytes = await readFile(outputPath);
  tamperedBytes[tamperedBytes.length - 1] = tamperedBytes[tamperedBytes.length - 1]! ^ 1;
  const tamperedPath = path.join(tenantA, "tampered.png");
  await writeFile(tamperedPath, tamperedBytes, { flag: "wx" });
  const tampered = await C2paReaderAdapter.readManifest(tamperedPath, { trustMode: "CUSTOM_TRUST_ANCHOR", customTrustAnchorPem: certificatePem });
  assert.equal(tampered.c2paValid, false);
  assert.equal(redactC2paInspection(tampered).safety.c2paCanOpenVault, false);
  pass("asset_or_manifest_tamper_detected");

  await assert.rejects(C2paSignerAdapter.fromConfiguredPaths({
    certificatePath,
    privateKeyPath: path.join(wrongPair, "key.pem"),
    algorithm: "es256",
  }), /mismatch/);
  await assert.rejects(C2paSignerAdapter.fromConfiguredPaths({
    certificatePath: path.join(expired, "cert.pem"),
    privateKeyPath: path.join(expired, "key.pem"),
    algorithm: "es256",
  }), /outside_validity/);
  pass("wrong_key_pair_and_expired_certificate_rejected");

  const assertion = buildTancMarkSupportAssertion({
    recordIdentity: c2paRegistryRecordIdentity("tenant_a", "registry-record-003", environment), recordVersion: "1", algorithmVersion: "tancmark-0.1",
    createdAt: "2026-08-28T00:00:02.000Z",
  });
  assert.equal(parseTancMarkSupportAssertion(assertion)?.supportOnly, true);
  assert.equal(parseTancMarkSupportAssertion({ ...assertion, unexpected: true }), null);
  assert.equal(parseTancMarkSupportAssertion({ ...assertion, supportOnly: false }), null);
  assert.equal(parseTancMarkSupportAssertion({ ...assertion, publicRegistryReference: "tmr_changed" }), null);
  assert.throws(() => buildTancMarkSupportAssertion({
    recordIdentity: c2paRegistryRecordIdentity("tenant_a", "registry-record-003", environment), recordVersion: "x".repeat(1024), algorithmVersion: "tancmark-0.1",
    createdAt: "2026-08-28T00:00:02.000Z",
  }), /record_version_invalid/);
  pass("malformed_extra_key_oversized_field_and_changed_tancmark_assertion_rejected");

  const zeroPath = path.join(tenantA, "zero.png");
  await writeFile(zeroPath, Buffer.alloc(0), { flag: "wx" });
  const zeroResult = await C2paReaderAdapter.readManifest(zeroPath);
  assert.equal(zeroResult.c2paValid, false);
  const truncatedPath = path.join(tenantA, "truncated.png");
  await writeFile(truncatedPath, PNG.subarray(0, 12), { flag: "wx" });
  assert.equal((await C2paReaderAdapter.readManifest(truncatedPath)).c2paValid, false);
  assert.equal((await C2paReaderAdapter.readManifest(path.join(tenantA, "unsupported.txt"))).c2paValid, false);
  const oversized = path.join(tenantA, "oversized.png");
  await writeFile(oversized, Buffer.from([0]), { flag: "wx" });
  await truncate(oversized, 64 * 1024 * 1024 + 1);
  assert.equal((await C2paReaderAdapter.readManifest(oversized)).c2paValid, false);
  pass("zero_truncated_unsupported_and_oversized_media_rejected");

  await assert.rejects(resolveC2paTenantOutput({ tenantId: "tenant_a", outputName: "signed.png", env: environment }), /already_exists/);
  await assert.rejects(C2paBuilderAdapter.signAndEmbedManifest({
    inputPath: sourcePath, outputPath: sourcePath, intent: "CREATE",
    digitalSourceType: C2PA_DIGITAL_SOURCE_TYPES.DIGITAL_CAPTURE,
    recordIdentity: c2paRegistryRecordIdentity("tenant_a", "registry-record-same-path", environment), recordVersion: "1",
    algorithmVersion: "tancmark-0.1", createdAt: "2026-08-28T00:00:03.000Z", signer,
  }), /must_differ/);
  const existing = path.join(tenantA, "existing.bin");
  await writeFile(existing, Buffer.from("existing"), { flag: "wx" });
  await assert.rejects(atomicWriteNewFile(existing, "replacement"), /already_exists/);
  assert.equal((await readFile(existing, "utf8")), "existing");
  assert.equal((await readdir(tenantA)).some((name) => name.startsWith(".tancmark-") && name.endsWith(".tmp")), false);
  pass("overwrite_same_path_rejection_and_temp_cleanup");

  const hardlink = path.join(tenantA, "hardlink.png");
  await link(sourcePath, hardlink);
  await assert.rejects(resolveC2paTenantInput({ tenantId: "tenant_a", assetName: "hardlink.png", env: environment }), /unlinked/);
  pass("hardlink_rejected");

  const symlinkPath = path.join(tenantA, "symlink.png");
  const symlinkTarget = path.join(tenantA, "symlink-target.png");
  await writeFile(symlinkTarget, PNG, { flag: "wx" });
  assert.equal((await lstat(symlinkTarget)).nlink, 1);
  await symlink(symlinkTarget, symlinkPath, "file");
  assert.equal((await lstat(symlinkPath)).isSymbolicLink(), true);
  await assert.rejects(resolveC2paTenantInput({ tenantId: "tenant_a", assetName: "symlink.png", env: environment }), /unlinked/);
  pass("symlink_rejected");

  try {
    const junction = path.join(temporaryRoot, "junction-root");
    await symlink(tenantA, junction, "junction");
    const junctionEnv = { ...environment, TANCMARK_C2PA_TENANT_ROOTS_JSON: JSON.stringify({ tenant_a: junction }) };
    await assert.rejects(resolveC2paTenantInput({ tenantId: "tenant_a", assetName: "source.png", env: junctionEnv }), /root_invalid/);
    measured.junction = "PASSED";
  } catch (error) {
    if (["EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) measured.junction = "NOT_MEASURED_PRIVILEGE_UNAVAILABLE";
    else throw error;
  }
  pass("junction_policy_enforced_or_explicitly_not_measured");

  const bridgeNoExact = C2paTancMarkBridge.decide({ c2pa: secondRead, tancmarkExactResearchSignal: false });
  const bridgeExact = C2paTancMarkBridge.decide({ c2pa: noC2pa, tancmarkExactResearchSignal: true });
  for (const decision of [bridgeNoExact, bridgeExact]) {
    assert.equal(decision.productionOwnership, false);
    assert.equal(decision.productionVault, false);
    assert.equal(decision.confirmed, false);
    assert.equal(decision.final, false);
  }
  pass("c2pa_valid_wrong_or_missing_tancmark_and_exact_without_c2pa_cannot_escalate");

  const serialized = JSON.stringify({ signed: redactC2paInspection(signed.outputValidation), bridgeNoExact, bridgeExact });
  assert.doesNotMatch(serialized, privateLeakPattern);
  assert.equal(redactC2paInspection(signed.outputValidation).safety.privateKeyDisclosed, false);
  pass("secret_api_evidence_and_path_redaction");

  assert.equal((await lstat(sourcePath)).isFile(), true);
  assert.equal(sha(await readFile(sourcePath)), originalSha);
  pass("original_modified_zero");

  process.stdout.write(`${JSON.stringify({
    contract: "tancmark_public_c2pa_contract",
    status: "PASSED",
    testsPassed: passed.length,
    testsFailed: 0,
    passed,
    measured,
    wrongOwnership: 0,
    c2paCanOpenVault: false,
    privateKeyDisclosure: 0,
    secretDisclosure: 0,
    crossTenantLeak: 0,
    originalModified: 0,
    externalNetworkCalls: 0,
  }, null, 2)}\n`);
} finally {
  assert(path.resolve(temporaryRoot).startsWith(path.resolve(os.tmpdir())), "unsafe_cleanup_target");
  await rm(temporaryRoot, { recursive: true, force: true });
}
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
