import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { generateLiveFmp4FixtureFromRealLocalMedia } from "./live_local_product_media_fixture.ts";
import { releaseLiveProductProcessLeasesForContractOnly } from "../../artifacts/api-server/src/live/liveProductStore";
import { resetLiveLocalRuntimeForContractOnly } from "../../artifacts/api-server/src/live/liveLocalRuntime";

const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-live-http-"));
const tenant = "http-tenant"; const admin = "admin-token-for-live-http-contract";
process.env["TANCMARK_LIVE_STORAGE_ROOT"] = path.join(temp, "store");
process.env["TANCMARK_LIVE_LOCAL_TENANT_ID"] = tenant;
process.env["TANCMARK_LIVE_PLAYBACK_KEYRING"] = JSON.stringify({ activeKid: "http-kid", keys: { "http-kid": `base64url:${Buffer.alloc(32, 0x51).toString("base64url")}` } });
process.env["ADMIN_TOKEN"] = admin;
process.env["AEGIS_SECRET"] = "test-only-live-http-contract-aegis-secret";
process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "postgresql://127.0.0.1:1/tancmark_live_contract_not_connected";

function schedulePostExitTempCleanup(resolved: string): void {
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && path.basename(resolved).startsWith("tancmark-live-http-"));
  const helper = `const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const target=path.resolve(process.argv[1]),parent=Number(process.argv[2]),temp=path.resolve(os.tmpdir()),rel=path.relative(temp,target);if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||!path.basename(target).startsWith('tancmark-live-http-'))process.exit(2);let attempts=0;const run=()=>{try{process.kill(parent,0);setTimeout(run,50);return}catch{}attempts+=1;try{fs.rmSync(target,{recursive:true,force:true});process.exit(0)}catch{if(attempts>=200)process.exit(3);setTimeout(run,50)}};run();`;
  const child = spawn(process.execPath, ["-e", helper, resolved, String(process.pid)], { detached: true, stdio: "ignore", windowsHide: true });
  assert(child.pid && child.pid > 0);
  child.unref();
}

const privateManifestPath = process.env["TANCMARK_LIVE_REAL_MEDIA_MANIFEST"];
if (!privateManifestPath || !path.isAbsolute(privateManifestPath) || !fs.lstatSync(privateManifestPath).isFile() || fs.lstatSync(privateManifestPath).isSymbolicLink()) throw new Error("TANCMARK_LIVE_REAL_MEDIA_MANIFEST_required");
const privateManifest = JSON.parse(fs.readFileSync(privateManifestPath, "utf8")) as { schemaVersion: string; cases: Record<string, { path: string; sha256: string }> };
const realSource = privateManifest.cases["REAL_H264_AAC_48000_STEREO_01"];
if (privateManifest.schemaVersion !== "tancmark-live-private-real-media-manifest-v1" || !realSource || !path.isAbsolute(realSource.path) || !/^[0-9A-F]{64}$/.test(realSource.sha256)) throw new Error("live_real_local_private_manifest_invalid");
const fixture = generateLiveFmp4FixtureFromRealLocalMedia(path.join(temp, "fixture"), realSource.path, realSource.sha256);
async function main(): Promise<void> {
const { default: express } = await import("../../artifacts/api-server/node_modules/express/index.js");
const { default: liveLocalProductRouter } = await import("../../artifacts/api-server/src/routes/liveLocalProduct.ts");
const app = express(); app.disable("x-powered-by"); app.use(express.json({ limit: "12mb" })); app.use("/api/tancmark/live/local/v1", liveLocalProductRouter);
const server = app.listen(0, "0.0.0.0");
await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
const address = server.address(); if (!address || typeof address === "string") throw new Error("live_http_loopback_bind_failed");
const base = `http://127.0.0.1:${address.port}/api/tancmark/live/local/v1`;
const nonLoopbackAddress = Object.values(os.networkInterfaces()).flat().find((item) => item?.family === "IPv4" && !item.internal)?.address;
if (!nonLoopbackAddress) throw new Error("live_http_non_loopback_interface_required");
const auth = { "x-admin-token": admin, "x-tancmark-live-tenant-id": tenant };
const json = async (response: Response): Promise<Record<string, any>> => response.json() as Promise<Record<string, any>>;
const postJson = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(url, { method: "POST", headers: { ...auth, "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

try {
  const consoleResponse = await fetch(`${base}/management-console`); assert.equal(consoleResponse.status, 200); const consoleHtml = await consoleResponse.text(); assert(consoleHtml.includes("TancMark Live Local v1") && consoleHtml.includes("x-admin-token") && !consoleHtml.includes(admin) && !consoleHtml.includes(tenant));
  // The transport boundary runs before auth; never send even test credentials
  // to a non-loopback address. A spoofed forwarding header alone must not help.
  const remotePlaintext = await fetch(`http://${nonLoopbackAddress}:${address.port}/api/tancmark/live/local/v1/status`, { headers: { "x-forwarded-for": "127.0.0.1" } }); assert.equal(remotePlaintext.status, 403); assert.equal((await json(remotePlaintext)).error, "live_local_transport_boundary_rejected");
  const spoofIgnored = await fetch(`${base}/status`, { headers: { ...auth, "x-forwarded-for": "203.0.113.9", forwarded: "for=203.0.113.9;proto=https" } }); assert.equal(spoofIgnored.status, 200);
  const statusResponse = await fetch(`${base}/status`, { headers: auth }); assert.equal(statusResponse.status, 200); const localStatus = await json(statusResponse); assert.equal(localStatus.available, true); assert.equal(localStatus.runtimeReady, true); assert.equal(localStatus.status, "LOCAL_SINGLE_NODE_CORE_AVAILABLE"); assert.equal(localStatus.capabilityAvailability.llHlsCmaf, true); assert.equal(localStatus.dependencyReadiness.liveTransportPlayerRuntimeFfmpegDependency, false); assert.equal("localValidation" in localStatus, false);
  const missing = await fetch(`${base}/sessions`, { headers: { "x-admin-token": admin } }); assert.equal(missing.status, 401);
  const wrong = await fetch(`${base}/sessions`, { headers: { "x-admin-token": admin, "x-tancmark-live-tenant-id": "wrong-tenant" } }); assert.equal(wrong.status, 404);
  const bodySpoof = await postJson(`${base}/sessions`, { tenantId: "body-spoof", clientId: "body-spoof", ownerUserId: "body-spoof", expectedId: "ab".repeat(32) }); assert.equal(bodySpoof.status, 400); assert.equal((await json(bodySpoof)).error, "live_request_body_shape_invalid");
  const createdResponse = await postJson(`${base}/sessions`, { protectionMode: "PROTECTED_TANCMARK" }); assert.equal(createdResponse.status, 201);
  let session = (await json(createdResponse)).session; const sessionId = session.sessionId as string; assert.equal(session.expectedIdProvided, false); assert.equal(session.protectionMode, "PROTECTED_TANCMARK"); assert.equal(session.identityAuthorityMode, "SERVER_OWNED_SIGNED_EXACT");
  const wrongTenantRead = await fetch(`${base}/sessions/${sessionId}`, { headers: { ...auth, "x-tancmark-live-tenant-id": "wrong-tenant" } }); assert.equal(wrongTenantRead.status, 404);
  const plaintext = Buffer.from("plaintext-not-fmp4");
  const badInit = await fetch(`${base}/sessions/${sessionId}/init`, { method: "POST", headers: { ...auth, "content-type": "application/octet-stream", "x-content-sha256": sha(plaintext), "x-idempotency-key": "bad-init-key-0001" }, body: plaintext }); assert.equal(badInit.status, 400);
  const initResponse = await fetch(`${base}/sessions/${sessionId}/init`, { method: "POST", headers: { ...auth, "content-type": "application/octet-stream", "x-content-sha256": sha(fixture.init), "x-idempotency-key": "http-init-key-0001" }, body: fixture.init }); assert.equal(initResponse.status, 201); const initBody = await json(initResponse); session = initBody.session; assert.equal(initBody.init.privateIngestOnly, true); assert.equal(initBody.init.relativeUrl, null);
  const startResponse = await postJson(`${base}/sessions/${sessionId}/start`, { expectedRevision: session.revision }, { "x-idempotency-key": "http-start-key-0001" }); assert.equal(startResponse.status, 200); session = (await json(startResponse)).session;
  const segment = fixture.fragments[0] as Buffer;
  const segmentResponse = await fetch(`${base}/sessions/${sessionId}/segments`, { method: "POST", headers: { ...auth, "content-type": "application/octet-stream", "x-content-sha256": sha(segment), "x-idempotency-key": "http-segment-key-0001", "x-segment-sequence": "0", "x-segment-duration-ms": String(fixture.durationsMs[0]) }, body: segment }); assert.equal(segmentResponse.status, 201); const segmentBody = await json(segmentResponse); session = segmentBody.session;
  const tokenResponse = await postJson(`${base}/sessions/${sessionId}/access-token`, { viewerSubject: "http-viewer", ttlSeconds: 120 }); assert.equal(tokenResponse.status, 201); const exchangeToken = (await json(tokenResponse)).exchangeToken as string;
  const exchange = await fetch(`${base}/access/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: exchangeToken }) }); assert.equal(exchange.status, 201); const exchangeBody = await json(exchange); assert.equal("grantToken" in exchangeBody, false); assert.equal(JSON.stringify(exchangeBody).includes(exchangeToken), false); const setCookie = exchange.headers.get("set-cookie") ?? ""; const cookie = setCookie.split(";")[0]; assert(cookie.includes("tmlg_") && !cookie.includes(exchangeToken)); assert(/HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie) && !/;\s*Secure/i.test(setCookie));
  const replay = await fetch(`${base}/access/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: exchangeToken }) }); assert.equal(replay.status, 409);
  const player = await fetch(`${base}/player/${sessionId}`, { headers: { cookie } }); assert.equal(player.status, 200); const playerHtml = await player.text(); assert(playerHtml.includes("MediaSource.isTypeSupported") && playerHtml.includes("support-only") && playerHtml.includes("shouldAlign(v.currentTime,ranges,Date.now(),userSeekUntil)") && playerHtml.includes("userSeekUntil=Date.now()+3000") && playerHtml.includes("READY aligned to buffered media") && playerHtml.includes("__tancmarkLivePlayerTelemetry") && playerHtml.includes("endOfStream.success=true") && playerHtml.includes("FAILED playback"));
  const liveManifest = await fetch(`${base}/playback/${sessionId}/manifest.m3u8`, { headers: { cookie } }); assert.equal(liveManifest.status, 200); const liveManifestText = await liveManifest.text(); assert(liveManifestText.includes("#EXT-X-MAP") && liveManifestText.includes("#EXT-X-PART-INF:PART-TARGET=") && liveManifestText.includes("#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES") && liveManifestText.includes("#EXT-X-PART:DURATION=") && !liveManifestText.includes("#EXT-X-INDEPENDENT-SEGMENTS"));
  const etag = liveManifest.headers.get("etag") as string; const notModified = await fetch(`${base}/playback/${sessionId}/manifest.m3u8`, { headers: { cookie, "if-none-match": etag } }); assert.equal(notModified.status, 304);
  const badLlhls = await fetch(`${base}/playback/${sessionId}/manifest.m3u8?_HLS_msn=999999&_HLS_part=0`, { headers: { cookie } }); assert.equal(badLlhls.status, 400);
  const blockStarted = Date.now(); const blockingReload = fetch(`${base}/playback/${sessionId}/manifest.m3u8?_HLS_msn=1&_HLS_part=0`, { headers: { cookie } }).then((response) => ({ response, completedAt: Date.now() })); await new Promise((resolve) => setTimeout(resolve, 150));
  const secondFragment = fixture.fragments[1] as Buffer; const secondResponse = await fetch(`${base}/sessions/${sessionId}/segments`, { method: "POST", headers: { ...auth, "content-type": "application/octet-stream", "x-content-sha256": sha(secondFragment), "x-idempotency-key": "http-segment-key-0002", "x-segment-sequence": "1", "x-segment-duration-ms": String(fixture.durationsMs[1]) }, body: secondFragment }); assert.equal(secondResponse.status, 201); session = (await json(secondResponse)).session;
  const unblocked = await blockingReload; assert.equal(unblocked.response.status, 200); assert(unblocked.completedAt - blockStarted >= 100 && unblocked.completedAt - blockStarted < 3000); assert((await unblocked.response.text()).includes("#EXT-X-PART"));
  const clientAuthorityRejected = await postJson(`${base}/sessions/${sessionId}/verify-exact-id`, { expectedIdHex: "ab".repeat(32), accountId: "account", registryRecordId: "record" }); assert.equal(clientAuthorityRejected.status, 400);
  const preStopVerify = await postJson(`${base}/sessions/${sessionId}/verify-exact-id`, {}); assert.equal(preStopVerify.status, 409);
  const stop = await postJson(`${base}/sessions/${sessionId}/stop`, { expectedRevision: session.revision }, { "x-idempotency-key": "http-stop-key-0001" }); assert.equal(stop.status, 200); const stopped = await json(stop); session = stopped.session; assert.equal(session.status, "STOPPED"); assert.equal(session.finalVerificationState, "EXACT_VERIFIED"); assert.equal(stopped.finalVerification.verdict, "VIDEO_LAYER_VAULT"); assert.equal(stopped.evidence.ownership, true); assert.equal(stopped.evidence.vault, true); assert.equal(stopped.evidence.final, true);
  const automaticVerify = await postJson(`${base}/sessions/${sessionId}/verify-exact-id`, {}); assert.equal(automaticVerify.status, 200); const automaticResult = await json(automaticVerify); assert.equal(automaticResult.verdict, "VIDEO_LAYER_VAULT"); assert.equal(automaticResult.exactIdDisclosed, false); assert.equal("exactIdHex" in automaticResult, false);
  const oldGrantDenied = await fetch(`${base}/playback/${sessionId}/manifest.m3u8`, { headers: { cookie } }); assert.equal(oldGrantDenied.status, 401);
  const vodTokenResponse = await postJson(`${base}/sessions/${sessionId}/access-token`, { viewerSubject: "vod-viewer", ttlSeconds: 120 }); assert.equal(vodTokenResponse.status, 201); const vodExchange = await fetch(`${base}/access/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: (await json(vodTokenResponse)).exchangeToken }) }); const vodCookie = (vodExchange.headers.get("set-cookie") ?? "").split(";")[0]; assert.equal(vodExchange.status, 201);
  const segmentOnlyTokenResponse = await postJson(`${base}/sessions/${sessionId}/access-token`, { viewerSubject: "least-privilege-viewer", ttlSeconds: 120, resourceScopes: ["segment"] }); assert.equal(segmentOnlyTokenResponse.status, 201); const segmentOnlyExchange = await fetch(`${base}/access/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: (await json(segmentOnlyTokenResponse)).exchangeToken }) }); const segmentOnlyCookie = (segmentOnlyExchange.headers.get("set-cookie") ?? "").split(";")[0]; assert.equal(segmentOnlyExchange.status, 201); const recordingWithSegmentScope = await fetch(`${base}/playback/${sessionId}/recording.mp4`, { headers: { cookie: segmentOnlyCookie } }); assert.equal(recordingWithSegmentScope.status, 401);
  const recordingResponse = await fetch(`${base}/playback/${sessionId}/recording.mp4`, { headers: { cookie: vodCookie } }); assert.equal(recordingResponse.status, 200); const recording = Buffer.from(await recordingResponse.arrayBuffer()); assert(recording.length > fixture.init.length);
  const recordingPath = path.join(temp, "recording.mp4"); fs.writeFileSync(recordingPath, recording);
  const ffprobe = process.env["TANCMARK_LIVE_TEST_FFPROBE"]; if (!ffprobe || !path.isAbsolute(ffprobe)) throw new Error("live_test_explicit_ffprobe_required");
  const probe = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=format_name,duration", "-of", "json", recordingPath], { encoding: "utf8", windowsHide: true, timeout: 30_000 }); assert.equal(probe.status, 0, probe.stderr); const probeJson = JSON.parse(probe.stdout); assert(String(probeJson.format?.format_name).includes("mp4"));
  const planResponse = await postJson(`${base}/sessions/${sessionId}/cleanup/plan`, { expectedRevision: session.revision }, { "x-idempotency-key": "http-clean-plan-0001" }); assert.equal(planResponse.status, 201); const plan = (await json(planResponse)).plan; assert(plan.fileCount >= 4 && !JSON.stringify(plan).includes(process.env["TANCMARK_LIVE_STORAGE_ROOT"]));
  const cleanup = await postJson(`${base}/sessions/${sessionId}/cleanup/execute`, { expectedRevision: session.revision }, { "x-idempotency-key": "http-clean-exec-0001", "if-match": `"${plan.confirmationDigest}"` }); assert.equal(cleanup.status, 200); assert.equal((await json(cleanup)).session.status, "PURGED");
  console.log(JSON.stringify({ contract: "live_local_product_http_contract", status: "passed", loopbackHost: "127.0.0.1", trueHttpE2e: true, actualSocketTransportBoundary: { loopbackPlaintextAccepted: true, nonLoopbackPlaintextRejected: true, forwardedHeadersIgnored: true }, managementConsole: "FUNCTIONAL_NO_PERSISTED_SECRETS", releaseAvailabilityClaim: true, nonSyntheticCorpus: true, sourceAlias: "REAL_H264_AAC_48000_STEREO_01", sourcePathDisclosed: false, sourceHashDisclosed: false, sourceByteLengthDisclosed: false, realFmp4Upload: true, llHlsPartsUnder500ms: fixture.durationsMs.every((value) => value <= 500), authTenantSpoofNegatives: true, cookieOnlyExchange: true, recordingLeastPrivilegeScope: true, replayAndRevoke: true, runningAndStoppedVod: true, etag304: true, ffprobeRecording: true, playerNonZeroBufferStartAlignment: "UNIT_AND_IN_APP_BROWSER_AV_PASSED", userSeekGuardUnitMeasured: true, browserExecution: "MEASURED_SEPARATELY_IN_APP_BROWSER_AV_STOPPED_VOD_PASS", externalNetworkCalls: 0 }, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  resetLiveLocalRuntimeForContractOnly();
  releaseLiveProductProcessLeasesForContractOnly();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const resolved = path.resolve(temp); assert(path.relative(path.resolve(os.tmpdir()), resolved) && !path.relative(path.resolve(os.tmpdir()), resolved).startsWith(".."));
  try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 50, retryDelay: 100 }); }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "EPERM" && code !== "EBUSY" && code !== "ENOTEMPTY") throw error;
    schedulePostExitTempCleanup(resolved);
    console.log(JSON.stringify({ contractCleanup: "POST_EXIT_SCOPE_VALIDATED_HELPER_SCHEDULED", reason: "WINDOWS_NODE_SQLITE_HANDLE_LIFETIME" }));
  }
}
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
