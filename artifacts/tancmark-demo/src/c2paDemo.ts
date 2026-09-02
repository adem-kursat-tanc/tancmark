import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { C2PA_DIGITAL_SOURCE_TYPES, C2paBuilderAdapter } from "../../api-server/src/c2pa/C2paBuilderAdapter";
import { C2paReaderAdapter } from "../../api-server/src/c2pa/C2paReaderAdapter";
import { redactC2paInspection } from "../../api-server/src/c2pa/C2paRedaction";
import { C2paSignerAdapter } from "../../api-server/src/c2pa/C2paSignerAdapter";
import {
  assertC2paNoNetwork,
  c2paRegistryRecordIdentity,
} from "../../api-server/src/c2pa/C2paProductPolicy";
import type { DemoRuntimePaths } from "./demoEngine";
import type { DemoRegistryRecord, EphemeralDemoRegistry } from "./demoRegistry";

export async function runC2paDemo(input: {
  runtime: DemoRuntimePaths;
  registry: EphemeralDemoRegistry;
  record: DemoRegistryRecord;
}): Promise<Record<string, unknown>> {
  const started = performance.now();
  const work = fs.mkdtempSync(path.join(input.runtime.tempRoot, "tancmark-demo-c2pa-"));
  const source = path.join(input.runtime.repoRoot, "fixtures", "demo-public", "demo-image.png");
  const sourceHash = sha256File(source);
  const sourceCopy = path.join(work, "source.png");
  const signedPath = path.join(work, "signed.png");
  const tamperedPath = path.join(work, "tampered.png");
  fs.copyFileSync(source, sourceCopy, fs.constants.COPYFILE_EXCL);
  try {
    const generator = path.join(input.runtime.repoRoot, "runtime", "c2pa", "generate-test-certificate-linux-demo.mjs");
    const generated = spawnSync(process.execPath, [generator, work], {
      encoding: "utf8",
      windowsHide: true,
      env: {
        PATH: "/usr/bin:/bin",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        NODE_ENV: "test",
        TANCMARK_DEMO_ONLY: "1",
        TANCMARK_C2PA_ALLOW_TEST_SIGNING: "1",
      },
    });
    assert.equal(generated.status, 0, "DEMO_C2PA_CERTIFICATE_GENERATION_FAILED");
    assert.doesNotMatch(`${generated.stdout}${generated.stderr}`, /PRIVATE KEY|Users[\\/]/i);

    const environment: NodeJS.ProcessEnv = {
      C2PA_REMOTE_MANIFEST_FETCH: "false",
      TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON: JSON.stringify({
        [input.registry.tenantId]: randomBytes(32).toString("base64url"),
      }),
    };
    assertC2paNoNetwork(environment);
    const initial = await C2paReaderAdapter.readManifest(sourceCopy);
    assert.equal(initial.status, "NO_C2PA");

    const previousNodeEnvironment = process.env["NODE_ENV"];
    const previousProductRuntime = process.env["AEGIS_PRODUCT_RUNTIME"];
    const previousTestSigning = process.env["TANCMARK_C2PA_ALLOW_TEST_SIGNING"];
    let signer: C2paSignerAdapter;
    try {
      process.env["NODE_ENV"] = "production";
      process.env["TANCMARK_C2PA_ALLOW_TEST_SIGNING"] = "1";
      delete process.env["AEGIS_PRODUCT_RUNTIME"];
      signer = await C2paSignerAdapter.fromConfiguredPaths({
        certificatePath: path.join(work, "cert.pem"),
        privateKeyPath: path.join(work, "key.pem"),
        algorithm: "es256",
      });
    } finally {
      restoreEnvironment("NODE_ENV", previousNodeEnvironment);
      restoreEnvironment("AEGIS_PRODUCT_RUNTIME", previousProductRuntime);
      restoreEnvironment("TANCMARK_C2PA_ALLOW_TEST_SIGNING", previousTestSigning);
    }
    const certificatePem = fs.readFileSync(path.join(work, "cert.pem"), "utf8");
    const signed = await C2paBuilderAdapter.signAndEmbedManifest({
      inputPath: sourceCopy,
      outputPath: signedPath,
      intent: "CREATE",
      digitalSourceType: C2PA_DIGITAL_SOURCE_TYPES.COMPOSITE,
      recordIdentity: c2paRegistryRecordIdentity(input.registry.tenantId, input.record.recordHandle, environment),
      recordVersion: "1",
      algorithmVersion: "tancmark-codespaces-linux-demo-v1",
      createdAt: new Date().toISOString(),
      signer,
      trustMode: "CUSTOM_TRUST_ANCHOR",
      customTrustAnchorPem: certificatePem,
    });
    const reread = await C2paReaderAdapter.readManifest(signedPath, {
      trustMode: "CUSTOM_TRUST_ANCHOR",
      customTrustAnchorPem: certificatePem,
    });
    const tampered = fs.readFileSync(signedPath);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    fs.writeFileSync(tamperedPath, tampered, { flag: "wx" });
    const tamperedResult = await C2paReaderAdapter.readManifest(tamperedPath, {
      trustMode: "CUSTOM_TRUST_ANCHOR",
      customTrustAnchorPem: certificatePem,
    });
    const registry = input.registry.verify(input.record.idHex);
    const exact =
      signed.ok &&
      signed.outputValidation.signatureCryptographicallyValid &&
      signed.outputValidation.assetIntegrityValid &&
      reread.signatureCryptographicallyValid &&
      reread.assetIntegrityValid &&
      !tamperedResult.c2paValid &&
      registry.exactRecord &&
      registry.tenantMatched &&
      registry.signatureVerified;
    assert.equal(sha256File(source), sourceHash, "C2PA demo fixture mutated");
    return {
      module: "c2pa",
      status: exact ? "DEMO_EXACT_VERIFIED" : "DEMO_NOT_FOUND",
      demoOnly: true,
      initialInspection: redactC2paInspection(initial).status,
      signEmbed: signed.ok,
      rereadSignatureValid: reread.signatureCryptographicallyValid,
      rereadAssetIntegrityValid: reread.assetIntegrityValid,
      tamperDetected: !tamperedResult.c2paValid,
      c2paCanOpenVault: false,
      registryMatch: registry.exactRecord && registry.tenantMatched,
      signatureVerified: registry.signatureVerified,
      remoteManifestFetch: false,
      productionRsaPssEnabled: false,
      productionOwnership: false,
      productionVault: false,
      recordHandle: input.record.recordHandle,
      durationMs: Math.round((performance.now() - started) * 1000) / 1000,
    };
  } finally {
    assert(path.resolve(work).startsWith(`${path.resolve(input.runtime.tempRoot)}${path.sep}`));
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
