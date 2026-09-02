// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X9lC8QAAAABJRU5ErkJggg==", "base64");
const privateLeakPattern = new RegExp(`BEGIN PRIVATE KEY|key\\.pem|cert\\.pem|Users[\\\\/]|${["ADEM", "PROJECT", "ARCHIVE"].join("_")}|tenant_a`, "i");

async function main(): Promise<void> {
  const temp = await mkdtemp(path.join(os.tmpdir(), "tancmark-c2pa-http-"));
  assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())));
  const tenantRoot = path.join(temp, "tenant");
  await mkdir(tenantRoot);
  await writeFile(path.join(tenantRoot, "source.png"), PNG, { flag: "wx" });
  const certEnv = { ...process.env, NODE_ENV: "test", TANCMARK_C2PA_ALLOW_TEST_SIGNING: "1" };
  delete certEnv.AEGIS_PRODUCT_RUNTIME;
  const generated = process.platform === "linux" && certEnv.TANCMARK_DEMO_ONLY === "1"
    ? spawnSync(process.execPath, [
      path.join(root, "runtime", "c2pa", "generate-test-certificate-linux-demo.mjs"), tenantRoot,
    ], { encoding: "utf8", windowsHide: true, env: certEnv })
    : spawnSync("pwsh.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
      path.join(root, "runtime", "c2pa", "generate-test-certificate.ps1"),
      "-OutputDirectory", tenantRoot,
    ], { encoding: "utf8", windowsHide: true, env: certEnv });
  assert.equal(generated.status, 0, generated.stderr);

  const before = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: "production",
    AEGIS_PRODUCT_RUNTIME: "1",
    DATABASE_URL: "postgresql://127.0.0.1:1/tancmark_c2pa_http_contract_not_connected",
    AEGIS_SECRET: "test-only-c2pa-http-contract-aegis-secret",
    ADMIN_TOKEN: "c2pa-http-contract-admin-token",
    TANCMARK_LIVE_LOCAL_TENANT_ID: "tenant_a",
    TANCMARK_LIVE_LOCAL_ACCOUNT_ID: "tenant_a",
    TANCMARK_C2PA_TENANT_ROOTS_JSON: JSON.stringify({ tenant_a: tenantRoot }),
    TANCMARK_C2PA_SIGNING_ENABLED: "1",
    TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON: JSON.stringify({
      tenant_a: Buffer.alloc(32, 0x5a).toString("base64url"),
    }),
    TANCMARK_C2PA_SIGNING_PROFILES_JSON: JSON.stringify({
      tenant_a: {
        certificatePath: path.join(tenantRoot, "cert.pem"),
        privateKeyPath: path.join(tenantRoot, "key.pem"),
        algorithm: "es256",
      },
    }),
    C2PA_REMOTE_MANIFEST_FETCH: "false",
  });

  const { default: app } = await import("../../artifacts/api-server/src/app.ts");
  const { redactedAuditPersistenceFailure } = await import("../../artifacts/api-server/src/lib/auditStore.ts");
  const redactedAuditLog = JSON.stringify(redactedAuditPersistenceFailure({
    ip: "sensitive-ip-not-for-log",
    route: "/api/tancmark/c2pa/v1/sign-embed?secret=must-not-appear",
    kind: "request",
    details: { privateKeyPath: "sensitive-path-not-for-log" },
  }));
  assert.doesNotMatch(redactedAuditLog, /sensitive|privateKey|secret=/i);
  const server = app.listen(0, "0.0.0.0");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/tancmark/c2pa/v1`;
  const headers = {
    "content-type": "application/json",
    "x-admin-token": process.env.ADMIN_TOKEN!,
    "x-tancmark-live-tenant-id": "tenant_a",
  };
  const nonLoopbackAddress = Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .find((entry) => entry.family === "IPv4" && !entry.internal)?.address;

  try {
    const unauth = await fetch(`${base}/inspect`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetName: "source.png" }) });
    assert.equal(unauth.status, 401);
    const wrongTenant = await fetch(`${base}/inspect`, { method: "POST", headers: { ...headers, "x-tancmark-live-tenant-id": "tenant_b" }, body: JSON.stringify({ assetName: "source.png" }) });
    assert.equal(wrongTenant.status, 404);
    const rawKey = await fetch(`${base}/sign-embed`, { method: "POST", headers, body: JSON.stringify({ assetName: "source.png", privateKey: "forbidden" }) });
    assert.equal(rawKey.status, 400);
    const missingIntent = await fetch(`${base}/sign-embed`, { method: "POST", headers, body: JSON.stringify({ assetName: "source.png", outputName: "invalid.png" }) });
    assert.equal(missingIntent.status, 400);
    assert.equal((await missingIntent.json() as { error: string }).error, "c2pa_intent_required");
    const missingDigitalSourceType = await fetch(`${base}/sign-embed`, {
      method: "POST", headers, body: JSON.stringify({ assetName: "source.png", outputName: "invalid.png", intent: "CREATE" }),
    });
    assert.equal(missingDigitalSourceType.status, 400);
    assert.equal((await missingDigitalSourceType.json() as { error: string }).error, "c2pa_create_digital_source_type_required");
    if (nonLoopbackAddress) {
      const remotePlaintext = await fetch(`http://${nonLoopbackAddress}:${address.port}/api/tancmark/c2pa/v1/inspect`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "127.0.0.1",
          "x-api-key": "invalid-test-only-key-that-must-not-be-evaluated",
          "x-admin-token": "test-only-token-that-must-not-be-evaluated",
          "x-tancmark-live-tenant-id": "tenant_a",
        },
        body: JSON.stringify({ assetName: "source.png" }),
      });
      assert.equal(remotePlaintext.status, 403);
      assert.equal((await remotePlaintext.json() as { error: string }).error, "c2pa_transport_boundary_rejected");
    }

    const inspect = await fetch(`${base}/inspect`, { method: "POST", headers, body: JSON.stringify({ assetName: "source.png" }) });
    assert.equal(inspect.status, 200);
    assert.equal((await inspect.json() as { c2pa: { status: string } }).c2pa.status, "NO_C2PA");

    const sign = await fetch(`${base}/sign-embed`, {
      method: "POST", headers, body: JSON.stringify({
        assetName: "source.png",
        outputName: "signed.png",
        intent: "CREATE",
        digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
        registryRecordId: "public-record-001",
        recordVersion: "1",
        algorithmVersion: "tancmark-0.1",
        createdAt: "2026-08-28T00:00:00.000Z",
      }),
    });
    assert.equal(sign.status, 201);
    const signText = await sign.text();
    const signJson = JSON.parse(signText) as { c2pa: { status: string; safety: { c2paCanOpenVault: boolean } } };
    assert.equal(signJson.c2pa.status, "VALID_BUT_UNTRUSTED");
    assert.equal(signJson.c2pa.safety.c2paCanOpenVault, false);
    assert.doesNotMatch(signText, privateLeakPattern);

    const verify = await fetch(`${base}/verify`, { method: "POST", headers, body: JSON.stringify({ assetName: "signed.png" }) });
    assert.equal(verify.status, 200);
    const verifyText = await verify.text();
    assert.doesNotMatch(verifyText, privateLeakPattern);
    const unknownRoute = await fetch(`${base}/private-reader`, { method: "POST", headers, body: "{}" });
    assert.equal(unknownRoute.status, 404);
    assert.equal((await readFile(path.join(tenantRoot, "source.png"))).equals(PNG), true);

    process.stdout.write(`${JSON.stringify({
      contract: "tancmark_public_c2pa_http_contract",
      status: "PASSED",
      inspect: "NO_C2PA",
      signEmbedReadVerify: "PASSED",
      unauthenticated: 401,
      wrongTenant: 404,
      rawPrivateKeyBody: 400,
      missingIntent: 400,
      missingDigitalSourceType: 400,
      remotePlaintext: nonLoopbackAddress ? 403 : "NOT_MEASURED_NO_NON_LOOPBACK_INTERFACE",
      forwardedHeaderIgnored: nonLoopbackAddress ? true : "NOT_MEASURED_NO_NON_LOOPBACK_INTERFACE",
      remoteCredentialsEvaluated: nonLoopbackAddress ? false : "NOT_MEASURED_NO_NON_LOOPBACK_INTERFACE",
      undocumentedReaderRoute: 404,
      c2paCanOpenVault: false,
      privateKeyDisclosure: 0,
      apiResponsePathDisclosure: 0,
      auditFailureLogRedaction: "PASSED_METADATA_ONLY",
      databaseAuditPersistence: "NOT_MEASURED_DATABASE_NOT_CONFIGURED",
      originalModified: 0,
    }, null, 2)}\n`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
    assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())));
    await rm(temp, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
