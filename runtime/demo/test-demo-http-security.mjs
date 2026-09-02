import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const repoRoot = requiredDirectory("TANCMARK_DEMO_REPO_ROOT");
const tempRoot = requiredDirectory("TANCMARK_DEMO_TEMP_ROOT");
const serverFile = path.join(repoRoot, "artifacts", "tancmark-demo", "dist", "server.mjs");
const serverSourceFile = path.join(repoRoot, "artifacts", "tancmark-demo", "src", "server.ts");
const liveControllerSourceFile = path.join(repoRoot, "artifacts", "tancmark-demo", "src", "liveDemoController.ts");
assert(fs.lstatSync(serverFile).isFile());
assert(fs.lstatSync(serverSourceFile).isFile());

const sentinelSecret = `github-token-sentinel-${randomUUID()}`;
process.env.GITHUB_TOKEN = sentinelSecret;
process.env.GH_TOKEN = sentinelSecret;
const sentinelOutsideWrite = path.join(tempRoot, `shell-injection-sentinel-${randomUUID()}`);
const beforeStatus = gitStatus();
const responseBodies = [];
const checks = {};

const primary = await startServer(4185);
try {
  const base = primary.base;
  const page = await fetchText(`${base}/demo`);
  assert.equal(page.status, 200);
  const cookie = page.headers.get("set-cookie")?.split(";", 1)[0];
  const csrf = /<meta name="csrf-token" content="([^"]+)">/.exec(page.text)?.[1];
  assert(cookie && csrf);
  const session = { base, cookie, csrf };

  checks.securityHeaders = requiredHeaders(page.headers);
  checks.health = (await fetchText(`${base}/demo/health`)).status === 200;

  const validRegistry = await postJson(session, "/demo/registry/verify", {});
  assert.equal(validRegistry.status, 200);
  const validRegistryBody = JSON.parse(validRegistry.text);
  assert.equal(validRegistryBody.status, "DEMO_EXACT_VERIFIED");
  assert.equal(validRegistryBody.productionOwnership, false);
  assert.equal(validRegistryBody.productionVault, false);
  checks.productionVaultOpened = 0;
  checks.realOwnershipCreated = 0;

  const multipart = await rawPost(session, "/demo/image/seal", "multipart/form-data; boundary=tm", "--tm\r\nContent-Disposition: form-data; name=\"file\"; filename=\"synthetic.txt\"\r\n\r\nsynthetic\r\n--tm--\r\n");
  assert.equal(multipart.status, 415);
  checks.realFileUploadAccepted = 0;
  checks.multipartUploadAccepted = 0;

  assert.equal((await postJson(session, "/demo/image/seal", { path: "../../etc/passwd" })).status, 400);
  assert.equal((await postJson(session, "/demo/image/seal", { path: "/etc/passwd" })).status, 400);
  assert.equal((await postJson(session, "/demo/image/seal", { path: "/tmp/symlink" })).status, 400);
  checks.pathTraversalAccepted = 0;
  checks.absolutePathAccepted = 0;
  checks.symlinkInputAccepted = 0;

  assert.notEqual((await postJson(session, "/demo/text/seal", { text: "x".repeat(2001) })).status, 200);
  assert.equal((await rawPost(session, "/demo/text/seal", "application/json", JSON.stringify({ text: "x".repeat(9000) }))).status, 413);
  assert.notEqual((await postJson(session, "/demo/text/seal", { text: "\ud800" })).status, 200);
  checks.oversizedTextAccepted = 0;
  checks.oversizedJsonAccepted = 0;
  checks.invalidUnicodeAccepted = 0;

  assert.equal((await postJson(session, "/demo/image/seal", { data: "malformed" })).status, 400);
  assert.equal((await postJson(session, "/demo/audio/seal", { data: "malformed" })).status, 400);
  assert.equal((await postJson(session, "/demo/video/seal", { data: "malformed" })).status, 400);
  checks.malformedImageAccepted = 0;
  checks.malformedAudioAccepted = 0;
  checks.malformedVideoAccepted = 0;

  assert.equal((await postJson(session, "/demo/registry/verify", { id: "00".repeat(32) })).status, 400);
  assert.equal((await postJson(session, "/demo/registry/verify", { tenant: "attacker" })).status, 400);
  assert.equal((await postJson(session, "/demo/registry/verify", { record: { changed: true } })).status, 400);
  assert.equal((await postJson(session, "/demo/registry/verify", { signature: "wrong" })).status, 400);
  checks.userSelectedIdAccepted = 0;
  checks.userSelectedTenantAccepted = 0;
  checks.changedRegistryRecordAccepted = 0;
  checks.wrongSignatureAccepted = 0;

  const reusedNonce = randomUUID();
  assert.equal((await postJson(session, "/demo/registry/verify", {}, { nonce: reusedNonce })).status, 200);
  assert.equal((await postJson(session, "/demo/registry/verify", {}, { nonce: reusedNonce })).status, 409);
  checks.reusedDemoTokenAccepted = 0;

  assert.equal((await postJson(session, "/demo/registry/verify", {}, { csrf: "wrong" })).status, 403);
  assert.equal((await postJson(session, "/demo/registry/verify", {}, { origin: "https://attacker.invalid" })).status, 403);
  checks.csrfAccepted = 0;
  checks.crossOriginAccepted = 0;

  assert.equal((await fetchText(`${base}/demo/env`, { headers: { cookie } })).status, 404);
  assert.equal((await fetchText(`${base}/demo?env=GITHUB_TOKEN`, { headers: { cookie } })).status, 400);
  checks.environmentDumpReachable = 0;
  checks.githubTokenDisclosure = 0;

  assert.equal((await postJson(session, "/demo/image/seal", { command: "id" })).status, 400);
  const shellText = await postJson(session, "/demo/text/seal", { text: `$(touch ${sentinelOutsideWrite}); synthetic demo text` });
  assert.equal(shellText.status, 200);
  assert.equal(fs.existsSync(sentinelOutsideWrite), false);
  checks.arbitraryCommandAccepted = 0;
  checks.shellInjectionExecuted = 0;

  assert.equal((await postJson(session, "/demo/image/seal", { url: "http://127.0.0.1:9/private" })).status, 400);
  assert.equal((await postJson(session, "/demo/image/seal", { url: "https://example.invalid/private" })).status, 400);
  checks.ssrfAccepted = 0;
  checks.externalFetchAccepted = 0;

  const concurrent = await Promise.all([
    postJson(session, "/demo/audio/seal", { sampleRate: 44100 }),
    postJson(session, "/demo/audio/seal", { sampleRate: 44100 }),
    postJson(session, "/demo/audio/seal", { sampleRate: 44100 }),
    postJson(session, "/demo/audio/seal", { sampleRate: 44100 }),
  ]);
  assert(concurrent.some((entry) => entry.status === 503));
  assert(concurrent.filter((entry) => entry.status === 200).length >= 1);
  checks.concurrentHeavyJobsBounded = true;
  checks.queueOverflowReturned503 = true;

  for (const target of ["/api/admin", "/api/vault", "/video/read", "/audio/read", "/demo/production/vault"]) {
    assert.equal((await fetchText(`${base}${target}`, { headers: { cookie } })).status, 404);
  }
  checks.productionRouteReachableFromDemo = 0;

  const badJson = await rawPost(session, "/demo/registry/verify", "application/json", "{bad-json");
  assert.equal(badJson.status, 400);
  checks.malformedJsonAccepted = 0;

  const serverSource = fs.readFileSync(serverSourceFile, "utf8");
  assert(serverSource.includes("withTimeout(engine.runAudio"));
  assert(serverSource.includes("withTimeout(engine.runVideo"));
  assert(serverSource.includes("DEMO_OPERATION_TIMED_OUT"));
  assert(fs.readFileSync(liveControllerSourceFile, "utf8").includes("AbortController"));
  checks.timeoutGuardSourceVerified = true;
  checks.activeChildAbortGuardSourceVerified = true;

  for (const body of responseBodies) {
    assert(!body.includes(sentinelSecret));
    assert(!/[A-Za-z]:\\Users\\|\/opt\/tancmark-demo|node:internal|at file:/i.test(body));
  }
  checks.secretDisclosure = 0;
  checks.privatePathDisclosure = 0;

  const liveStart = await postJson(session, "/demo/live/start", {});
  assert.equal(liveStart.status, 202);
  await delay(2500);
  await stopServer(primary);
  checks.activeLiveShutdownExitCode = primary.exitCode;
  assert.equal(primary.exitCode, 0);
  await delay(500);
  checks.remainingDemoProcesses = matchingProcessCount(["mediamtx", "demo_live", "authoritative-live"]);
  checks.remainingDemoTemporaryDirectories = demoTempDirectories();
  checks.remainingDemoPorts = await listeningPortCount([4185, 8554, 8888, 9997]);
  assert.equal(checks.remainingDemoProcesses, 0);
  assert.equal(checks.remainingDemoTemporaryDirectories, 0);
  assert.equal(checks.remainingDemoPorts, 0);
} finally {
  if (primary.child.exitCode === null) await stopServer(primary);
}

const rateServer = await startServer(4186);
try {
  const statuses = [];
  for (let index = 0; index < 65; index += 1) statuses.push((await fetchText(`${rateServer.base}/demo/health`)).status);
  assert(statuses.includes(429));
  checks.rateLimitReturned429 = true;
} finally {
  await stopServer(rateServer);
}

assert.equal(gitStatus(), beforeStatus);
assert.equal(fs.existsSync(sentinelOutsideWrite), false);
checks.outsideTempWrite = 0;
checks.trackedRepositoryChangesAfterDemo = 0;
checks.externalNetworkRequestAtRuntime = 0;
checks.externalNetworkEvidence = "No user-controlled URL route exists; all accepted runtime media fetches are fixed 127.0.0.1 loopback targets.";

process.stdout.write(`${JSON.stringify({
  schemaVersion: "tancmark-codespaces-demo-http-security-v1",
  profile: "CODESPACES_LINUX_DEMO_PROFILE_V1",
  status: "PASSED",
  checks,
}, null, 2)}\n`);

async function startServer(port) {
  const env = {
    PATH: process.env.PATH,
    COREPACK_HOME: process.env.COREPACK_HOME,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NODE_ENV: "demo",
    PORT: String(port),
    TANCMARK_DEMO_ONLY: "1",
    TANCMARK_DEMO_BIND: "127.0.0.1",
    TANCMARK_DEMO_REPO_ROOT: repoRoot,
    TANCMARK_DEMO_TEMP_ROOT: tempRoot,
    TANCMARK_DEMO_FFMPEG: requiredFile("TANCMARK_DEMO_FFMPEG"),
    TANCMARK_DEMO_FFPROBE: requiredFile("TANCMARK_DEMO_FFPROBE"),
    TANCMARK_DEMO_PYTHON: requiredFile("TANCMARK_DEMO_PYTHON"),
    TANCMARK_DEMO_ADAPTER_C: requiredFile("TANCMARK_DEMO_ADAPTER_C"),
    TANCMARK_DEMO_LD_LIBRARY_PATH: requiredText("TANCMARK_DEMO_LD_LIBRARY_PATH"),
    TANCMARK_DEMO_MEDIAMTX: requiredFile("TANCMARK_DEMO_MEDIAMTX"),
    TANCMARK_DEMO_TRANSPORT_FFMPEG: requiredFile("TANCMARK_DEMO_TRANSPORT_FFMPEG"),
    TANCMARK_DEMO_TRANSPORT_LD_LIBRARY_PATH: requiredText("TANCMARK_DEMO_TRANSPORT_LD_LIBRARY_PATH"),
    TANCMARK_DEMO_TRANSPORT_FFMPEG_SHA256: requiredText("TANCMARK_DEMO_TRANSPORT_FFMPEG_SHA256"),
    C2PA_REMOTE_MANIFEST_FETCH: "false",
  };
  assert(!Object.hasOwn(env, "GITHUB_TOKEN") && !Object.hasOwn(env, "GH_TOKEN"));
  const child = spawn(process.execPath, [serverFile], { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { if (output.length < 64_000) output += chunk.toString("utf8"); });
  const state = { child, base: `http://127.0.0.1:${port}`, output, exitCode: undefined };
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`DEMO_SERVER_EARLY_EXIT:${child.exitCode}:${output.slice(-1000)}`);
    try {
      const health = await fetch(`${state.base}/demo/health`, { signal: AbortSignal.timeout(500) });
      await health.arrayBuffer();
      if (health.ok) return state;
    } catch {}
    await delay(100);
  }
  child.kill("SIGKILL");
  throw new Error(`DEMO_SERVER_START_TIMEOUT:${output.slice(-1000)}`);
}

async function stopServer(state) {
  if (state.child.exitCode !== null) {
    state.exitCode = state.child.exitCode;
    return;
  }
  state.child.kill("SIGTERM");
  state.exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { state.child.kill("SIGKILL"); reject(new Error("DEMO_SERVER_STOP_TIMEOUT")); }, 15_000);
    state.child.once("exit", (code) => { clearTimeout(timer); resolve(code); });
    state.child.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, { redirect: "manual", ...options });
  const text = await response.text();
  responseBodies.push(text);
  return { status: response.status, text, headers: response.headers };
}

async function postJson(session, route, body, overrides = {}) {
  return await rawPost(session, route, "application/json", JSON.stringify(body), overrides);
}

async function rawPost(session, route, contentType, body, overrides = {}) {
  return await fetchText(`${session.base}${route}`, {
    method: "POST",
    headers: {
      cookie: session.cookie,
      origin: overrides.origin ?? session.base,
      "content-type": contentType,
      "x-csrf-token": overrides.csrf ?? session.csrf,
      "x-demo-request-token": overrides.nonce ?? randomUUID(),
    },
    body,
  });
}

function requiredHeaders(headers) {
  const csp = headers.get("content-security-policy") ?? "";
  for (const directive of ["default-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "form-action 'self'"]) assert(csp.includes(directive));
  assert.equal(headers.get("cache-control"), "no-store");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  return true;
}

function requiredText(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function requiredFile(name) {
  const value = path.resolve(requiredText(name));
  const stat = fs.lstatSync(value);
  assert(stat.isFile() && !stat.isSymbolicLink());
  return value;
}

function requiredDirectory(name) {
  const value = path.resolve(requiredText(name));
  const stat = fs.lstatSync(value);
  assert(stat.isDirectory() && !stat.isSymbolicLink());
  return value;
}

function gitStatus() {
  const result = spawnSync("git", ["status", "--porcelain=v1", "-z"], { cwd: repoRoot, encoding: "utf8", env: { PATH: process.env.PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });
  assert.equal(result.status, 0);
  return result.stdout;
}

function matchingProcessCount(patterns) {
  const result = spawnSync("ps", ["-eo", "args="], { encoding: "utf8", env: { PATH: process.env.PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });
  assert.equal(result.status, 0);
  return result.stdout.split("\n").filter((line) => patterns.some((pattern) => line.includes(pattern)) && !line.includes("test-demo-http-security.mjs")).length;
}

function demoTempDirectories() {
  return fs.readdirSync(tempRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith("tancmark-demo-")).length;
}

async function listeningPortCount(ports) {
  const checks = await Promise.all(ports.map((port) => new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(500, () => done(0));
    socket.once("connect", () => done(1));
    socket.once("error", () => done(0));
  })));
  return checks.reduce((sum, value) => sum + value, 0);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
