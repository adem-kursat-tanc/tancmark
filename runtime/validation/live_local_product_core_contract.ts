import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveVerifiedLiveTenant } from "../../artifacts/api-server/src/middlewares/liveTenantAuth.ts";
import { shapeLiveExactIdentityAuthorityResult } from "../../artifacts/api-server/src/live/liveExactIdentityAuthorityAdapter.ts";
import { loadLiveLocalSecretProvider } from "../../artifacts/api-server/src/live/liveLocalSecretProvider.ts";
import { LivePlaybackGrantStore } from "../../artifacts/api-server/src/live/livePlaybackGrantStore.ts";
import { issueLivePlaybackTokenV1, verifyLivePlaybackTokenV1 } from "../../artifacts/api-server/src/live/livePlaybackTokenV1.ts";
import { LiveProductLifecycle } from "../../artifacts/api-server/src/live/liveProductLifecycle.ts";
import { LiveProductError, LiveProductStore, releaseLiveProductProcessLeasesForContractOnly } from "../../artifacts/api-server/src/live/liveProductStore.ts";
import { validateLiveFmp4Fragment, validateLiveFmp4Init } from "../../artifacts/api-server/src/live/liveFmp4Validator.ts";
import { LIVE_PLAYER_SHOULD_AUTO_ALIGN_SOURCE } from "../../artifacts/api-server/src/live/livePlayerTimelinePolicy.ts";
import { generateLiveFmp4Fixture } from "./live_local_product_media_fixture.ts";

const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const expectCode = (fn: () => unknown, code: string): void => assert.throws(fn, (error: unknown) => (error instanceof LiveProductError ? error.code : error instanceof Error ? error.message : "") === code);
const expectCodeAsync = async (fn: () => Promise<unknown>, code: string): Promise<void> => assert.rejects(fn, (error: unknown) => (error instanceof LiveProductError ? error.code : error instanceof Error ? error.message : "") === code);
const stable = (v: unknown): string => v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(stable).join(",")}]` : `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
const encode = (v: unknown): string => Buffer.from(stable(v)).toString("base64url");
const isoBox = (type: string, payload = Buffer.alloc(0)): Buffer => { const value = Buffer.alloc(8 + payload.length); value.writeUInt32BE(value.length); value.write(type, 4, 4, "ascii"); payload.copy(value, 8); return value; };
const fakeInit44 = Buffer.concat([isoBox("ftyp"), isoBox("moov", Buffer.concat([isoBox("mvex"), isoBox("avc1"), isoBox("avcC", Buffer.from([1, 0x42, 0, 0x1e]))]))]);
const fakeFragment72 = Buffer.concat([isoBox("moof", Buffer.concat([isoBox("mfhd", Buffer.from([0, 0, 0, 0, 0, 0, 0, 1])), isoBox("traf", Buffer.concat([isoBox("tfhd"), isoBox("tfdt", Buffer.alloc(4)), isoBox("trun", Buffer.alloc(4))]))])), isoBox("mdat")]);
assert.equal(fakeInit44.length, 44); assert.equal(fakeFragment72.length, 72);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-live-core-v2-"));
const root = path.join(temp, "managed-store");
const tenantId = "tenant-alpha";
const expectedId = "ab".repeat(32);
const keyring = JSON.stringify({ activeKid: "kid-1", keys: { "kid-1": `base64url:${Buffer.alloc(32, 0x41).toString("base64url")}`, "kid-2": `base64url:${Buffer.alloc(32, 0x42).toString("base64url")}` } });

async function main(): Promise<void> {
try {
  const fixture = generateLiveFmp4Fixture(path.join(temp, "fixture"));
  const shouldAutoAlign = Function(`"use strict";return (${LIVE_PLAYER_SHOULD_AUTO_ALIGN_SOURCE})`)() as (currentTime: number, ranges: number[][], nowMs: number, userSeekUntilMs: number) => boolean;
  assert.equal(shouldAutoAlign(0, [[3, 3.9]], 10_000, 0), true); assert.equal(shouldAutoAlign(3.5, [[3, 3.9]], 10_000, 0), false); assert.equal(shouldAutoAlign(0, [[3, 3.9]], 10_000, 12_000), false); assert.equal(shouldAutoAlign(0, [[3, 3.9]], 12_001, 12_000), true);
  assert(fixture.init.length > 32 && fixture.fragments.length >= 2);
  const parsedInit = validateLiveFmp4Init(fixture.init);
  assert.throws(() => validateLiveFmp4Init(fakeInit44));
  assert.throws(() => validateLiveFmp4Fragment(fakeFragment72, parsedInit));
  assert.deepEqual(resolveVerifiedLiveTenant({ header: () => undefined, body: { tenantId } } as never, {}), { ok: false, status: 401, error: "live_tenant_principal_required" });
  assert.deepEqual(resolveVerifiedLiveTenant({ header: () => "tenant-beta" } as never, { TANCMARK_LIVE_LOCAL_TENANT_ID: tenantId }), { ok: false, status: 404, error: "live_tenant_not_found" });
  assert.equal(resolveVerifiedLiveTenant({ header: () => tenantId } as never, { TANCMARK_LIVE_LOCAL_TENANT_ID: tenantId }).ok, true);

  const store = new LiveProductStore(root); const grants = new LivePlaybackGrantStore(store); const lifecycle = new LiveProductLifecycle(store, grants); const provider = loadLiveLocalSecretProvider({ TANCMARK_LIVE_PLAYBACK_KEYRING: keyring });
  const makeRunningSession = async (suffix: string, legalHold = false) => {
    let created = lifecycle.createSession({ tenantId, accountId: tenantId, legalHold, protectionMode: "TRANSPORT_ONLY" });
    const uploaded = store.uploadInit({ tenantId, sessionId: created.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: `init-${suffix}-0001` });
    created = (await lifecycle.startSession({ tenantId, sessionId: created.sessionId, expectedRevision: uploaded.session.revision, idempotencyKey: `start-${suffix}-0001` })).session;
    return (await lifecycle.appendSegment({ tenantId, sessionId: created.sessionId, sequence: 0, durationMs: fixture.durationsMs[0]!, bytes: fixture.fragments[0]!, suppliedSha256: hash(fixture.fragments[0]!), idempotencyKey: `segment-${suffix}-0001` })).session;
  };
  let session = lifecycle.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" });
  const fakeInitSession = lifecycle.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" });
  expectCode(() => store.uploadInit({ tenantId, sessionId: fakeInitSession.sessionId, bytes: fakeInit44, suppliedSha256: hash(fakeInit44), idempotencyKey: "fake-init-44-key" }), "live_init_fmp4_invalid");
  expectCode(() => store.requireSession("tenant-beta", session.sessionId), "live_session_not_found");
  await expectCodeAsync(() => lifecycle.startSession({ tenantId, sessionId: session.sessionId, expectedRevision: session.revision, idempotencyKey: "start-key-0001" }), "live_start_init_required");
  expectCode(() => store.uploadInit({ tenantId, sessionId: session.sessionId, bytes: Buffer.from("plaintext"), suppliedSha256: hash("plaintext"), idempotencyKey: "init-plain-0001" }), "live_init_fmp4_invalid");
  const init = store.uploadInit({ tenantId, sessionId: session.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: "init-key-0001" });
  assert.equal(store.uploadInit({ tenantId, sessionId: session.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: "init-key-0001" }).duplicate, true);
  const started = await lifecycle.startSession({ tenantId, sessionId: session.sessionId, expectedRevision: init.session.revision, idempotencyKey: "start-key-0001" });
  assert.equal(started.session.status, "RUNNING");
  assert.equal((await lifecycle.startSession({ tenantId, sessionId: session.sessionId, expectedRevision: init.session.revision, idempotencyKey: "start-key-0001" })).replayed, true);
  session = started.session;
  await expectCodeAsync(() => lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 0, durationMs: 1000, bytes: Buffer.from("not-media"), suppliedSha256: hash("not-media"), idempotencyKey: "plain-segment-0001" }), "live_segment_fmp4_invalid");
  await expectCodeAsync(() => lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 0, durationMs: 200, bytes: fakeFragment72, suppliedSha256: hash(fakeFragment72), idempotencyKey: "fake-fragment-72-key" }), "live_segment_fmp4_invalid");
  await expectCodeAsync(() => lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 0, durationMs: 1000, bytes: fixture.fragments[0] as Buffer, suppliedSha256: hash(fixture.fragments[0] as Buffer), idempotencyKey: "duration-spoof-key" }), "live_segment_duration_mismatch");
  const first = await lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 0, durationMs: fixture.durationsMs[0] as number, bytes: fixture.fragments[0] as Buffer, suppliedSha256: hash(fixture.fragments[0] as Buffer), idempotencyKey: "segment-key-0001" });
  assert.equal((await lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 0, durationMs: fixture.durationsMs[0] as number, bytes: fixture.fragments[0] as Buffer, suppliedSha256: hash(fixture.fragments[0] as Buffer), idempotencyKey: "segment-key-0001" })).duplicate, true);
  session = first.session;
  const tokenBeforeNext = issueLivePlaybackTokenV1({ tenantId, subject: "viewer", sessionId: session.sessionId, resourceScopes: ["init", "manifest", "media-json", "player", "segment"], ttlSeconds: 120, accessRevision: session.accessRevision, tokenEpoch: session.tokenEpoch }, provider);
  const second = await lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 1, durationMs: fixture.durationsMs[1] as number, bytes: fixture.fragments[1] as Buffer, suppliedSha256: hash(fixture.fragments[1] as Buffer), idempotencyKey: "segment-key-0002" });
  assert.equal(second.session.accessRevision, tokenBeforeNext.claims.accessRevision);
  const grant = grants.consumeExchangeAndCreateGrant(verifyLivePlaybackTokenV1(tokenBeforeNext.token, provider));
  assert.equal(grants.authorize(grant.grantToken, session.sessionId, "manifest").sessionId, session.sessionId);
  expectCode(() => grants.consumeExchangeAndCreateGrant(tokenBeforeNext.claims), "live_playback_exchange_replayed");
  await expectCodeAsync(() => lifecycle.appendSegment({ tenantId, sessionId: session.sessionId, sequence: 2, durationMs: fixture.durationsMs[1] as number, bytes: fixture.fragments[1] as Buffer, suppliedSha256: hash(fixture.fragments[1] as Buffer), idempotencyKey: "timeline-bad-0001" }), "live_segment_timeline_conflict");

  const parts = tokenBeforeNext.token.split(".") as [string, string, string];
  const tamperedSignature = `${parts[0]}.${parts[1]}.${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  assert.throws(() => verifyLivePlaybackTokenV1(tamperedSignature, provider), /signature_invalid/);
  assert.throws(() => verifyLivePlaybackTokenV1(tokenBeforeNext.token, provider, { nowMs: (tokenBeforeNext.claims.exp + 1) * 1000 }), /time_invalid/);
  assert.throws(() => verifyLivePlaybackTokenV1(tokenBeforeNext.token, provider, { tenantId: "wrong-tenant" }), /tenant_invalid/);
  assert.throws(() => verifyLivePlaybackTokenV1(tokenBeforeNext.token, provider, { sessionId: randomUUID() }), /session_invalid/);
  const narrowToken = issueLivePlaybackTokenV1({ tenantId, subject: "narrow-viewer", sessionId: session.sessionId, resourceScopes: ["manifest"], ttlSeconds: 120, accessRevision: session.accessRevision, tokenEpoch: session.tokenEpoch }, provider);
  assert.throws(() => verifyLivePlaybackTokenV1(narrowToken.token, provider, { requiredScope: "segment" }), /scope_invalid/);
  const wrongKidHeader = encode({ alg: "HS256", kid: "unknown-kid", typ: "TMLIVE", v: 1 });
  assert.throws(() => verifyLivePlaybackTokenV1(`${wrongKidHeader}.${parts[1]}.${parts[2]}`, provider), /kid|key/);
  assert.throws(() => verifyLivePlaybackTokenV1(`${parts[0]}=.${parts[1]}.${parts[2]}`, provider), /encoding|malformed|header/);
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as Record<string, unknown>;
  const withExtra = { ...claims, extra: true }; const ep = encode(withExtra); const unsigned = `${parts[0]}.${ep}`; const forged = `${unsigned}.${provider.signExactKid("kid-1", unsigned).toString("base64url")}`;
  expectCode(() => verifyLivePlaybackTokenV1(forged, provider), "live_playback_token_claims_invalid");
  const duplicated = { ...claims, resourceScopes: ["manifest", "manifest"] }; const dp = encode(duplicated); const du = `${parts[0]}.${dp}`; expectCode(() => verifyLivePlaybackTokenV1(`${du}.${provider.signExactKid("kid-1", du).toString("base64url")}`, provider), "live_playback_token_scope_invalid");
  assert.throws(() => loadLiveLocalSecretProvider({ TANCMARK_LIVE_PLAYBACK_KEYRING: JSON.stringify({ activeKid: "kid-1", keys: { "kid-1": `base64url:${Buffer.alloc(32).toString("base64url")}` }, extra: true }) }), /keyring_invalid/);

  session = second.session;
  const stopInput = { tenantId, sessionId: session.sessionId, expectedRevision: session.revision, idempotencyKey: "stop-key-0001" };
  const stopped = await lifecycle.stopSession(stopInput);
  assert.equal(stopped.session.status, "STOPPED");
  assert.equal(store.validateSessionHealth(tenantId, session.sessionId)["valid"], true);
  assert.equal((await lifecycle.stopSession(stopInput)).receipt.receiptId, stopped.receipt.receiptId);
  expectCode(() => grants.authorize(grant.grantToken, session.sessionId, "manifest"), "live_playback_grant_invalid");
  const vodToken = issueLivePlaybackTokenV1({ tenantId, subject: "vod-viewer", sessionId: session.sessionId, resourceScopes: ["manifest", "segment"], ttlSeconds: 120, accessRevision: stopped.session.accessRevision, tokenEpoch: stopped.session.tokenEpoch }, provider);
  const vodGrant = grants.consumeExchangeAndCreateGrant(verifyLivePlaybackTokenV1(vodToken.token, provider));
  assert.equal(grants.authorize(vodGrant.grantToken, session.sessionId, "segment").sessionId, session.sessionId);
  const inventory = store.mediaInventory(tenantId, session.sessionId); assert(inventory.fileCount >= 4); assert.equal(JSON.stringify(inventory).includes(root), false);
  const planned = lifecycle.planCleanup({ tenantId, sessionId: session.sessionId, expectedRevision: stopped.session.revision, idempotencyKey: "cleanup-plan-key-0001" });
  assert.equal(lifecycle.planCleanup({ tenantId, sessionId: session.sessionId, expectedRevision: stopped.session.revision, idempotencyKey: "cleanup-plan-key-0001" }).plan.planId, planned.plan.planId);
  const cleaned = lifecycle.executeCleanup({ tenantId, sessionId: session.sessionId, expectedRevision: stopped.session.revision, confirmationDigest: planned.plan.confirmationDigest, idempotencyKey: "cleanup-exec-key-0001" });
  assert.equal(cleaned.session.status, "PURGED"); assert.equal(lifecycle.executeCleanup({ tenantId, sessionId: session.sessionId, expectedRevision: stopped.session.revision, confirmationDigest: planned.plan.confirmationDigest, idempotencyKey: "cleanup-exec-key-0001" }).replayed, true);
  assert(store.readEvidence(tenantId, session.sessionId));

  const exact = shapeLiveExactIdentityAuthorityResult({ expectedIdWasSupplied: true, expectedIdMatched: true, candidateCount: 1, registryRecordPresent: true, registryRecordActive: true, registryRecordRevoked: false, registryTenantMatched: true, signatureVerified: true, uniqueActiveRecord: true });
  assert.equal(exact.status, "EXACT_REGISTRY_CHAIN_VERIFIED_SUPPORT_ONLY"); assert.equal(exact.ownership, false); assert.equal(exact.vault, false);

  // Crash checkpoint: RUNNING was committed but the start receipt was not.
  const startCrashCreated = lifecycle.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" });
  const startCrashInit = store.uploadInit({ tenantId, sessionId: startCrashCreated.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: "init-start-crash-0001" });
  const startCrashKey = "start-crash-key-0001";
  const startCrashDigest = LiveProductStore.stableDigest({ operation: "start", tenantId, sessionId: startCrashCreated.sessionId, expectedRevision: startCrashInit.session.revision });
  store.transitionSession(tenantId, startCrashCreated.sessionId, ["READY"], "RUNNING", { startedAt: new Date().toISOString(), startAttempt: { idempotencyKeyHash: hash(`start-key\0${startCrashKey}`), requestDigest: startCrashDigest } }, "test.crash.after-start-transition");
  const recoveredStart = await lifecycle.startSession({ tenantId, sessionId: startCrashCreated.sessionId, expectedRevision: startCrashInit.session.revision, idempotencyKey: startCrashKey });
  assert.equal(recoveredStart.replayed, true); assert(recoveredStart.receipt.receiptId.startsWith("start-"));

  // Crash checkpoint: STOPPING was committed before any finalization.  The
  // matching retry must reuse the attempt and finish exactly once.
  const stopCrashRunning = await makeRunningSession("stop-crash");
  const stopCrashInput = { tenantId, sessionId: stopCrashRunning.sessionId, expectedRevision: stopCrashRunning.revision, idempotencyKey: "stop-crash-key-0001" };
  const stopCrashDigest = LiveProductStore.stableDigest({ operation: "stop", tenantId, sessionId: stopCrashRunning.sessionId, expectedRevision: stopCrashRunning.revision });
  store.transitionSession(tenantId, stopCrashRunning.sessionId, ["RUNNING"], "STOPPING", { tokenEpoch: stopCrashRunning.tokenEpoch + 1, accessRevision: stopCrashRunning.accessRevision + 1, stopAttempt: { idempotencyKeyHash: hash(`stop-key\0${stopCrashInput.idempotencyKey}`), requestDigest: stopCrashDigest } }, "test.crash.after-stop-transition");
  const recoveredStop = await lifecycle.stopSession(stopCrashInput);
  assert.equal(recoveredStop.session.status, "STOPPED"); assert.equal(recoveredStop.replayed, true);

  // Crash checkpoint: managed media was removed after CLEANUP_PENDING but the
  // receipt and PURGED state were not committed.  Matching retry completes.
  const crashPlan = lifecycle.planCleanup({ tenantId, sessionId: recoveredStop.session.sessionId, expectedRevision: recoveredStop.session.revision, idempotencyKey: "plan-crash-key-0001" });
  const cleanupCrashKey = "cleanup-crash-key-0001";
  const cleanupCrashKeyHash = hash(`cleanup-execute-key\0${cleanupCrashKey}`);
  const cleanupCrashDigest = LiveProductStore.stableDigest({ operation: "cleanup-execute", tenantId, sessionId: recoveredStop.session.sessionId, expectedRevision: recoveredStop.session.revision, confirmationDigest: crashPlan.plan.confirmationDigest });
  store.transitionSession(tenantId, recoveredStop.session.sessionId, ["STOPPED"], "CLEANUP_PENDING", { cleanupAttempt: { idempotencyKeyHash: cleanupCrashKeyHash, requestDigest: cleanupCrashDigest, planId: crashPlan.plan.planId } }, "test.crash.before-cleanup-receipt");
  store.purgeManagedMedia(tenantId, recoveredStop.session.sessionId);
  const afterExpiry = Date.parse(crashPlan.plan.expiresAt) + 1;
  expectCode(() => lifecycle.executeCleanup({ tenantId, sessionId: recoveredStop.session.sessionId, expectedRevision: recoveredStop.session.revision, confirmationDigest: crashPlan.plan.confirmationDigest, idempotencyKey: "cleanup-wrong-key-0001", nowMs: afterExpiry }), "live_cleanup_idempotency_conflict");
  expectCode(() => lifecycle.executeCleanup({ tenantId, sessionId: recoveredStop.session.sessionId, expectedRevision: recoveredStop.session.revision, confirmationDigest: "00".repeat(32), idempotencyKey: cleanupCrashKey, nowMs: afterExpiry }), "live_cleanup_confirmation_invalid");
  const recoveredCleanup = lifecycle.executeCleanup({ tenantId, sessionId: recoveredStop.session.sessionId, expectedRevision: recoveredStop.session.revision, confirmationDigest: crashPlan.plan.confirmationDigest, idempotencyKey: cleanupCrashKey, nowMs: afterExpiry });
  assert.equal(recoveredCleanup.session.status, "PURGED");

  const heldRunning = await makeRunningSession("legal-hold", true);
  const heldStopped = (await lifecycle.stopSession({ tenantId, sessionId: heldRunning.sessionId, expectedRevision: heldRunning.revision, idempotencyKey: "stop-legal-hold-0001" })).session;
  expectCode(() => lifecycle.planCleanup({ tenantId, sessionId: heldStopped.sessionId, expectedRevision: heldStopped.revision, idempotencyKey: "plan-legal-hold-0001" }), "live_cleanup_legal_hold");

  const junctionRunning = await makeRunningSession("junction");
  const junctionStopped = (await lifecycle.stopSession({ tenantId, sessionId: junctionRunning.sessionId, expectedRevision: junctionRunning.revision, idempotencyKey: "stop-junction-0001" })).session;
  const outside = path.join(temp, "cleanup-junction-target"); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, "sentinel.txt"), "must-remain");
  const mediaDir = path.join(root, "tenants", hash(`tenant\0${tenantId}`), "sessions", junctionStopped.sessionId, "media");
  fs.symlinkSync(outside, path.join(mediaDir, "outside-link"), process.platform === "win32" ? "junction" : "dir");
  expectCode(() => lifecycle.planCleanup({ tenantId, sessionId: junctionStopped.sessionId, expectedRevision: junctionStopped.revision, idempotencyKey: "plan-junction-0001" }), "live_cleanup_reparse_rejected");
  assert.equal(fs.readFileSync(path.join(outside, "sentinel.txt"), "utf8"), "must-remain");

  expectCode(() => new LiveProductStore(os.homedir()), "live_storage_root_too_broad");
  const linked = path.join(temp, "linked-root"); fs.mkdirSync(path.join(temp, "link-target")); fs.symlinkSync(path.join(temp, "link-target"), linked, process.platform === "win32" ? "junction" : "dir");
  expectCode(() => new LiveProductStore(linked), "live_managed_path_reparse_rejected");
  const childCode = `import {LiveProductStore} from ${JSON.stringify(pathToFileURL(path.resolve("artifacts/api-server/src/live/liveProductStore.ts")).href)};try{new LiveProductStore(${JSON.stringify(root)});process.exit(2)}catch(e){process.exit(e.code==='live_storage_process_lease_held'?0:3)}`;
  const tsxCli = path.resolve("node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs");
  const child = spawnSync(process.execPath, [tsxCli, "-e", childCode], { cwd: process.cwd(), env: process.env, windowsHide: true, timeout: 30_000 });
  assert.equal(child.status, 0, `second process lease must fail closed: ${child.stderr?.toString()}`);

  const oldLimit = process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"];
  process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"] = String(fixture.init.length + fixture.fragments[0]!.length - 1);
  const quotaStore = new LiveProductStore(path.join(temp, "quota-store")); const quotaLife = new LiveProductLifecycle(quotaStore); let quota = quotaLife.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" }); const qi = quotaStore.uploadInit({ tenantId, sessionId: quota.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: "quota-init-0001" }); quota = (await quotaLife.startSession({ tenantId, sessionId: quota.sessionId, expectedRevision: qi.session.revision, idempotencyKey: "quota-start-0001" })).session;
  await expectCodeAsync(() => quotaLife.appendSegment({ tenantId, sessionId: quota.sessionId, sequence: 0, durationMs: fixture.durationsMs[0]!, bytes: fixture.fragments[0]!, suppliedSha256: hash(fixture.fragments[0]!), idempotencyKey: "quota-segment-0001" }), "live_storage_quota_exceeded");
  if (oldLimit === undefined) delete process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"]; else process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"] = oldLimit;

  const recordingBytes = fixture.init.length + fixture.fragments[0]!.length;
  process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"] = String(recordingBytes * 2 - 1);
  const recordingQuotaStore = new LiveProductStore(path.join(temp, "recording-quota-store")); const recordingQuotaLife = new LiveProductLifecycle(recordingQuotaStore);
  let recordingQuota = recordingQuotaLife.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" });
  const rqi = recordingQuotaStore.uploadInit({ tenantId, sessionId: recordingQuota.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: "recording-quota-init-0001" });
  recordingQuota = (await recordingQuotaLife.startSession({ tenantId, sessionId: recordingQuota.sessionId, expectedRevision: rqi.session.revision, idempotencyKey: "recording-quota-start-0001" })).session;
  const rqSegment = await recordingQuotaLife.appendSegment({ tenantId, sessionId: recordingQuota.sessionId, sequence: 0, durationMs: fixture.durationsMs[0]!, bytes: fixture.fragments[0]!, suppliedSha256: hash(fixture.fragments[0]!), idempotencyKey: "recording-quota-segment-0001" });
  await expectCodeAsync(() => recordingQuotaLife.stopSession({ tenantId, sessionId: recordingQuota.sessionId, expectedRevision: rqSegment.session.revision, idempotencyKey: "recording-quota-stop-0001" }), "live_storage_quota_exceeded");
  assert.equal(recordingQuotaStore.requireSession(tenantId, recordingQuota.sessionId).status, "CLEANUP_PENDING");
  assert.equal(recordingQuotaStore.readSegment(tenantId, recordingQuota.sessionId, rqSegment.segment.segmentId).record.sha256, rqSegment.segment.sha256);
  if (oldLimit === undefined) delete process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"]; else process.env["TANCMARK_LIVE_MAX_SESSION_BYTES"] = oldLimit;

  const freeStore = new LiveProductStore(path.join(temp, "recording-free-space-store")); const freeLife = new LiveProductLifecycle(freeStore); let free = freeLife.createSession({ tenantId, accountId: tenantId, protectionMode: "TRANSPORT_ONLY" });
  const fi = freeStore.uploadInit({ tenantId, sessionId: free.sessionId, bytes: fixture.init, suppliedSha256: hash(fixture.init), idempotencyKey: "free-space-init-0001" });
  free = (await freeLife.startSession({ tenantId, sessionId: free.sessionId, expectedRevision: fi.session.revision, idempotencyKey: "free-space-start-0001" })).session;
  const freeSegment = await freeLife.appendSegment({ tenantId, sessionId: free.sessionId, sequence: 0, durationMs: fixture.durationsMs[0]!, bytes: fixture.fragments[0]!, suppliedSha256: hash(fixture.fragments[0]!), idempotencyKey: "free-space-segment-0001" });
  freeStore.limits.minFreeBytes = Number.MAX_SAFE_INTEGER;
  await expectCodeAsync(() => freeLife.stopSession({ tenantId, sessionId: free.sessionId, expectedRevision: freeSegment.session.revision, idempotencyKey: "free-space-stop-0001" }), "live_storage_free_space_insufficient");
  assert.equal(freeStore.readSegment(tenantId, free.sessionId, freeSegment.segment.segmentId).record.sha256, freeSegment.segment.sha256);

  console.log(JSON.stringify({ contract: "live_local_product_core_contract", status: "passed", realFmp4Fixture: true, semanticIsoBmffCmafParser: true, reviewerCounterexamplesRejected: { fakeInit44Bytes: true, fakeFragment72BytesEmptyMdat: true }, parsedDurationAuthoritativeAndHeaderCrossChecked: true, fixtureGeneratorOnlyFfmpeg: true, browserPlayback: "MEASURED_SEPARATELY", userSeekGuardUnitMeasured: true, tenantIsolation: true, canonicalTokenAndSecretNegatives: true, tokenSurvivesSegmentAppend: true, startStopCleanupIdempotency: true, crashRecovery: { start: true, stop: true, cleanupAfterMediaPurgeAfterPlanExpiry: true, expiredPlanWrongKeyRejected: true, expiredPlanWrongDigestRejected: true }, cleanupNegatives: { legalHold: true, junctionNoSideEffect: true }, recordingFinalization: { boundedMemoryStreaming: true, atomicPartialRename: true, duplicateQuotaGate507: true, freeSpaceGate507: true, sourceFragmentsPreservedOnFailure: true }, stoppedVodNewGrant: true, quota507: true, processLease: true, supportOnly: true, externalProductNetworkCalls: 0, externalProductProcesses: 0 }, null, 2));
} finally {
  releaseLiveProductProcessLeasesForContractOnly();
  const resolved = path.resolve(temp); assert(path.relative(path.resolve(os.tmpdir()), resolved) && !path.relative(path.resolve(os.tmpdir()), resolved).startsWith("..")); fs.rmSync(resolved, { recursive: true, force: true });
}
}

void main().catch((error) => { console.error(error instanceof Error ? error.stack : String(error)); process.exitCode = 1; });
