import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = process.env["TANCMARK_PRODUCT_REPO_ROOT"]
  ? path.resolve(process.env["TANCMARK_PRODUCT_REPO_ROOT"])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const normalBuild = process.argv.includes("--normal");
const bundleName = normalBuild ? "dist" : "dist-product";
const bundle = path.join(repoRoot, `artifacts/api-server/${bundleName}/index.mjs`);
assert(fs.existsSync(bundle), `${bundleName} bundle must exist before server smoke`);

const reservePort = async () => {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
};

const port = await reservePort();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-public-product-smoke-"));
const admin = "public-product-smoke-admin-token";
const tenant = "public-product-smoke-tenant";
const account = "public-product-smoke-account";
const logs = [];
const c2paRoot = path.join(temp, "c2pa-tenant");
fs.mkdirSync(c2paRoot);
fs.writeFileSync(
  path.join(c2paRoot, "source.png"),
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X9lC8QAAAABJRU5ErkJggg==", "base64"),
  { flag: "wx" },
);
const powershellExecutable = process.platform === "win32" ? "pwsh.exe" : "pwsh";
const certificate = spawnSync(powershellExecutable, [
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
  path.join(repoRoot, "runtime", "c2pa", "generate-test-certificate.ps1"),
  "-OutputDirectory", c2paRoot,
], {
  encoding: "utf8",
  windowsHide: true,
  env: { ...process.env, NODE_ENV: "test", TANCMARK_C2PA_ALLOW_TEST_SIGNING: "1" },
});
assert.equal(certificate.status, 0, certificate.stderr);
const child = spawn(process.execPath, [bundle], {
  cwd: path.dirname(bundle),
  windowsHide: true,
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "production",
    AEGIS_PRODUCT_RUNTIME: "1",
    AEGIS_SECRET: "public-product-smoke-aegis-secret-at-least-32-bytes",
    ADMIN_TOKEN: admin,
    DATABASE_URL: "postgresql://127.0.0.1:1/tancmark_public_product_smoke",
    OTS_SWEEPER_ENABLED: "false",
    TANCMARK_LIVE_STORAGE_ROOT: path.join(temp, "store"),
    TANCMARK_LIVE_LOCAL_TENANT_ID: tenant,
    TANCMARK_LIVE_LOCAL_ACCOUNT_ID: account,
    TANCMARK_C2PA_TENANT_ROOTS_JSON: JSON.stringify({ [tenant]: c2paRoot }),
    TANCMARK_C2PA_SIGNING_ENABLED: "1",
    TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON: JSON.stringify({
      [tenant]: Buffer.alloc(32, 0x5a).toString("base64url"),
    }),
    TANCMARK_C2PA_SIGNING_PROFILES_JSON: JSON.stringify({
      [tenant]: {
        certificatePath: path.join(c2paRoot, "cert.pem"),
        privateKeyPath: path.join(c2paRoot, "key.pem"),
        algorithm: "es256",
      },
    }),
    C2PA_REMOTE_MANIFEST_FETCH: "false",
    TANCMARK_LIVE_PLAYBACK_KEYRING: JSON.stringify({
      activeKid: "public-product-smoke-kid",
      keys: { "public-product-smoke-kid": `base64url:${Buffer.alloc(32, 0x5a).toString("base64url")}` },
    }),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [child.stdout, child.stderr]) {
  stream?.on("data", (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 40) logs.shift();
  });
}

const base = `http://127.0.0.1:${port}`;
const waitForHealth = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`product_server_exited:${child.exitCode}\n${logs.join("")}`);
    try {
      const response = await fetch(`${base}/api/healthz`);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`product_server_health_timeout\n${logs.join("")}`);
};

try {
  await waitForHealth();
  const health = await fetch(`${base}/api/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const videoLab = await fetch(`${base}/api/aegis/video-lab`);
  const audioLab = await fetch(`${base}/api/aegis/audio-lab`);
  assert.equal(videoLab.status, 410);
  assert.equal(audioLab.status, 410);

  const directCanonicalReader = await fetch(`${base}/api/aegis/video-productization/decode`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedId: "ab".repeat(32) }),
  });
  assert.equal(directCanonicalReader.status, 410);
  const directReaderBody = await directCanonicalReader.json();
  assert.equal(directReaderBody.error, "canonical_video_reader_internal_live_only");
  assert.equal(directReaderBody.ownership, false);
  assert.equal(directReaderBody.vault, false);
  assert.equal(directReaderBody.final, false);

  const auth = { "x-admin-token": admin, "x-tancmark-live-tenant-id": tenant };
  const live = await fetch(`${base}/api/tancmark/live/local/v1/status`, { headers: auth });
  assert.equal(live.status, 200);
  const liveBody = await live.json();
  assert.equal(liveBody.available, true);
  assert.equal(liveBody.runtimeReady, true);

  const wrongTenant = await fetch(`${base}/api/tancmark/live/local/v1/status`, {
    headers: { ...auth, "x-tancmark-live-tenant-id": "wrong-tenant" },
  });
  assert.equal(wrongTenant.status, 404);

  const c2paBase = `${base}/api/tancmark/c2pa/v1`;
  const c2paHeaders = { ...auth, "content-type": "application/json" };
  const missingIntent = await fetch(`${c2paBase}/sign-embed`, {
    method: "POST",
    headers: c2paHeaders,
    body: JSON.stringify({ assetName: "source.png", outputName: "invalid.png" }),
  });
  assert.equal(missingIntent.status, 400);
  assert.equal((await missingIntent.json()).error, "c2pa_intent_required");

  const missingDigitalSourceType = await fetch(`${c2paBase}/sign-embed`, {
    method: "POST",
    headers: c2paHeaders,
    body: JSON.stringify({ assetName: "source.png", outputName: "invalid.png", intent: "CREATE" }),
  });
  assert.equal(missingDigitalSourceType.status, 400);
  assert.equal((await missingDigitalSourceType.json()).error, "c2pa_create_digital_source_type_required");

  const sign = await fetch(`${c2paBase}/sign-embed`, {
    method: "POST",
    headers: c2paHeaders,
    body: JSON.stringify({
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
  assert.equal((await sign.json()).c2pa.safety.c2paCanOpenVault, false);
  const verify = await fetch(`${c2paBase}/verify`, {
    method: "POST",
    headers: c2paHeaders,
    body: JSON.stringify({ assetName: "signed.png" }),
  });
  assert.equal(verify.status, 200);

  const nonLoopbackAddress = Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .find((entry) => entry.family === "IPv4" && !entry.internal)?.address;
  if (nonLoopbackAddress) {
    const remote = await fetch(`http://${nonLoopbackAddress}:${port}/api/tancmark/c2pa/v1/inspect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
        "x-api-key": "invalid-test-only-key-that-must-not-be-evaluated",
        "x-admin-token": "test-only-token-that-must-not-be-evaluated",
        "x-tancmark-live-tenant-id": tenant,
      },
      body: JSON.stringify({ assetName: "source.png" }),
    });
    assert.equal(remote.status, 403);
    assert.equal((await remote.json()).error, "c2pa_transport_boundary_rejected");
  }

  console.log(JSON.stringify({
    contract: normalBuild ? "public_normal_build_route_smoke" : "public_product_build_route_smoke",
    status: "passed",
    health: 200,
    videoLab: 410,
    audioLab: 410,
    directCanonicalReaderRoute: 410,
    directCanonicalReaderOwnership: false,
    liveLocalV1: 200,
    wrongTenant: 404,
    bundle: `${bundleName}/index.mjs`,
    canonicalExactReaderAvailable: true,
    c2paBuiltBundle: {
      signEmbedReadVerify: "PASSED",
      missingIntent: 400,
      missingDigitalSourceType: 400,
      remotePlaintext: nonLoopbackAddress ? 403 : "NOT_MEASURED_NO_NON_LOOPBACK_INTERFACE",
      remoteCredentialsEvaluated: nonLoopbackAddress ? false : "NOT_MEASURED_NO_NON_LOOPBACK_INTERFACE",
      c2paCanOpenVault: false,
    },
  }, null, 2));
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
  fs.rmSync(temp, { recursive: true, force: true });
}
