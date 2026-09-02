import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateLiveFmp4FixtureFromRealLocalMedia } from "./live_local_product_media_fixture.ts";

const repoRoot = process.env["TANCMARK_PRODUCT_REPO_ROOT"]
  ? path.resolve(process.env["TANCMARK_PRODUCT_REPO_ROOT"])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bundle = path.join(repoRoot, "artifacts/api-server/dist-product/index.mjs");
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function assertPublicVerificationRedacted(value: Record<string, any>): void {
  for (const forbidden of [
    "expectedIdHex",
    "idHex",
    "registryRecordId",
    "decodeSummary",
    "mapMode",
    "signedMapDigestSha256",
    "encoderReceiptSha256",
    "rawDecoderResultSerialized",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(value, forbidden), false, `${forbidden} must not be disclosed`);
  }
  assert.equal(value.exactIdDisclosed, false);
  assert.equal(value.privateMapDisclosed, false);
  assert.equal(value.registryContentsDisclosed, false);
  assert.equal(value.decoderDetailsDisclosed, false);
}

function requiredFile(name: string): string {
  const value = process.env[name];
  if (!value || !path.isAbsolute(value) || !fs.existsSync(value) || !fs.statSync(value).isFile()) {
    throw new Error(`${name}_required_file`);
  }
  return value;
}

async function reservePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function main(): Promise<void> {
  requiredFile("TANCMARK_LIVE_WATERMARK_PYTHON");
  requiredFile("TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT");
  requiredFile("TANCMARK_LIVE_ADAPTER_C_SCRIPT");
  const ffmpeg = requiredFile("TANCMARK_LIVE_TEST_FFMPEG");
  const ffprobe = requiredFile("TANCMARK_LIVE_TEST_FFPROBE");
  requiredFile("TANCMARK_LIVE_REAL_MEDIA_MANIFEST");
  assert(fs.existsSync(bundle), "dist-product bundle must exist");

  const privateManifest = JSON.parse(fs.readFileSync(process.env["TANCMARK_LIVE_REAL_MEDIA_MANIFEST"]!, "utf8")) as {
    schemaVersion: string;
    cases: Record<string, { path: string; sha256: string }>;
  };
  const source = privateManifest.cases["REAL_H264_AAC_48000_STEREO_01"];
  assert.equal(privateManifest.schemaVersion, "tancmark-live-private-real-media-manifest-v1");
  assert(source && path.isAbsolute(source.path) && /^[0-9A-F]{64}$/.test(source.sha256));
  const sourceBefore = { sha256: sha256(fs.readFileSync(source.path)).toUpperCase(), bytes: fs.statSync(source.path).size };
  assert.equal(sourceBefore.sha256, source.sha256);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-product-exact-live-"));
  const fixture = generateLiveFmp4FixtureFromRealLocalMedia(path.join(temp, "fixture"), source.path, source.sha256);
  const port = await reservePort();
  const admin = "product-exact-live-admin-token";
  const tenant = "product-exact-live-tenant";
  const logs: string[] = [];
  const child = spawn(process.execPath, [bundle], {
    cwd: path.dirname(bundle),
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      AEGIS_PRODUCT_RUNTIME: "1",
      TANCMARK_FFMPEG_PATH: ffmpeg,
      TANCMARK_FFPROBE_PATH: ffprobe,
      AEGIS_SECRET: "product-exact-live-aegis-secret-at-least-32-bytes",
      ADMIN_TOKEN: admin,
      DATABASE_URL: "postgresql://127.0.0.1:1/tancmark_product_exact_live",
      OTS_SWEEPER_ENABLED: "false",
      TANCMARK_LIVE_STORAGE_ROOT: path.join(temp, "store"),
      TANCMARK_LIVE_LOCAL_TENANT_ID: tenant,
      TANCMARK_LIVE_LOCAL_ACCOUNT_ID: "product-exact-live-account",
      TANCMARK_LIVE_PLAYBACK_KEYRING: JSON.stringify({
        activeKid: "product-exact-live-kid",
        keys: { "product-exact-live-kid": `base64url:${Buffer.alloc(32, 0x63).toString("base64url")}` },
      }),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 60) logs.shift();
  });

  const base = `http://127.0.0.1:${port}/api/tancmark/live/local/v1`;
  const auth = { "x-admin-token": admin, "x-tancmark-live-tenant-id": tenant };
  const json = async (response: Response): Promise<Record<string, any>> => response.json() as Promise<Record<string, any>>;
  const postJson = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(url, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`product_server_exited:${child.exitCode}\n${logs.join("")}`);
      try {
        const health = await fetch(`http://127.0.0.1:${port}/api/healthz`);
        if (health.status === 200) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/healthz`)).status, 200);

    const createdResponse = await postJson(`${base}/sessions`, { protectionMode: "PROTECTED_TANCMARK" });
    assert.equal(createdResponse.status, 201);
    let session = (await json(createdResponse)).session;
    const sessionId = session.sessionId as string;
    assert.equal(session.expectedIdProvided, false);
    assert.equal(session.identityAuthorityMode, "SERVER_OWNED_SIGNED_EXACT");

    const wrongTenant = await fetch(`${base}/sessions/${sessionId}`, {
      headers: { ...auth, "x-tancmark-live-tenant-id": "wrong-tenant" },
    });
    assert.equal(wrongTenant.status, 404);

    const unsealed = Buffer.from("unsealed-not-fmp4");
    const unsealedResponse = await fetch(`${base}/sessions/${sessionId}/init`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/octet-stream", "x-content-sha256": sha256(unsealed), "x-idempotency-key": "product-unsealed-0001" },
      body: unsealed,
    });
    assert.equal(unsealedResponse.status, 400);

    const initResponse = await fetch(`${base}/sessions/${sessionId}/init`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/octet-stream", "x-content-sha256": sha256(fixture.init), "x-idempotency-key": "product-init-0001" },
      body: fixture.init,
    });
    assert.equal(initResponse.status, 201);
    session = (await json(initResponse)).session;

    const startResponse = await postJson(`${base}/sessions/${sessionId}/start`, { expectedRevision: session.revision }, { "x-idempotency-key": "product-start-0001" });
    assert.equal(startResponse.status, 200);
    session = (await json(startResponse)).session;

    for (let sequence = 0; sequence < Math.min(2, fixture.fragments.length); sequence += 1) {
      const fragment = fixture.fragments[sequence] as Buffer;
      const response = await fetch(`${base}/sessions/${sessionId}/segments`, {
        method: "POST",
        headers: {
          ...auth,
          "content-type": "application/octet-stream",
          "x-content-sha256": sha256(fragment),
          "x-idempotency-key": `product-segment-${String(sequence).padStart(4, "0")}`,
          "x-segment-sequence": String(sequence),
          "x-segment-duration-ms": String(fixture.durationsMs[sequence]),
        },
        body: fragment,
      });
      assert.equal(response.status, 201);
      session = (await json(response)).session;
    }

    const wrongId = await postJson(`${base}/sessions/${sessionId}/verify-exact-id`, {
      expectedIdHex: "ab".repeat(32), accountId: "wrong-account", registryRecordId: "wrong-record",
    });
    assert.equal(wrongId.status, 400);
    const noIdBeforeFinal = await postJson(`${base}/sessions/${sessionId}/verify-exact-id`, {});
    assert.equal(noIdBeforeFinal.status, 409);

    const stop = await postJson(`${base}/sessions/${sessionId}/stop`, { expectedRevision: session.revision }, { "x-idempotency-key": "product-stop-0001" });
    assert.equal(stop.status, 200, logs.join(""));
    const stopped = await json(stop);
    assert.equal(stopped.session.finalVerificationState, "EXACT_VERIFIED");
    assert.equal(stopped.finalVerification.verdict, "VIDEO_LAYER_VAULT");
    assert.equal(stopped.finalVerification.registryVerified, true);
    assert.equal(stopped.finalVerification.signatureVerified, true);
    assertPublicVerificationRedacted(stopped.finalVerification);
    assert.equal(stopped.evidence.ownership, true);
    assert.equal(stopped.evidence.vault, true);
    assert.equal(stopped.evidence.final, true);

    const automatic = await postJson(`${base}/sessions/${sessionId}/verify-exact-id`, {});
    assert.equal(automatic.status, 200);
    const automaticResult = await json(automatic);
    assert.equal(automaticResult.verdict, "VIDEO_LAYER_VAULT");
    assert.equal(automaticResult.ownership, true);
    assert.equal(automaticResult.vault, true);
    assert.equal(automaticResult.final, true);
    assertPublicVerificationRedacted(automaticResult);
    const publicAndLogText = `${JSON.stringify(stopped)}\n${JSON.stringify(automaticResult)}\n${logs.join("\n")}`;
    assert.equal(publicAndLogText.includes("ab".repeat(32)), false, "wrong raw expected ID must not be echoed or logged");

    assert.deepEqual({ sha256: sha256(fs.readFileSync(source.path)).toUpperCase(), bytes: fs.statSync(source.path).size }, sourceBefore);
    console.log(JSON.stringify({
      contract: "public_product_build_exact_live_contract",
      status: "passed",
      sourceKind: fixture.sourceKind,
      sourcePathDisclosed: false,
      sourceUnchanged: true,
      fragmentsProcessed: Math.min(2, fixture.fragments.length),
      productBundle: "dist-product/index.mjs",
      automaticFinalVerification: "VIDEO_LAYER_VAULT",
      registry: true,
      signature: true,
      wrongIdAccepted: false,
      noIdAcceptedBeforeFinal: false,
      wrongTenantAccepted: false,
      unsealedAccepted: false,
      wrongOwnershipCount: 0,
      rawExpectedIdDisclosed: false,
      privateMapDisclosed: false,
      registryContentsDisclosed: false,
      decoderDetailsDisclosed: false,
      externalNetworkCalls: 0,
    }, null, 2));
  } finally {
    await stopChild(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
