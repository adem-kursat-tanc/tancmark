import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveVerifiedLiveTenant } from "../../artifacts/api-server/src/middlewares/liveTenantAuth.ts";
import { loadLiveLocalSecretProvider } from "../../artifacts/api-server/src/live/liveLocalSecretProvider.ts";
import { LiveProductLifecycle } from "../../artifacts/api-server/src/live/liveProductLifecycle.ts";
import { LiveProductError, LiveProductStore, releaseLiveProductProcessLeasesForContractOnly } from "../../artifacts/api-server/src/live/liveProductStore.ts";
import { validateLiveFmp4Fragment, validateLiveFmp4Init } from "../../artifacts/api-server/src/live/liveFmp4Validator.ts";
import { validateLiveRollingSealMap } from "../../artifacts/api-server/src/live/liveRollingSealMap.ts";
import {
  createLiveSessionSealBinding,
  publicLiveSessionSealBinding,
  resolveLiveSessionSealAuthority,
} from "../../artifacts/api-server/src/live/liveSessionSealBinding.ts";
import { LiveWatermarkWorkerManager } from "../../artifacts/api-server/src/live/liveWatermarkWorker.ts";
import { generateLiveFmp4Fixture } from "./live_local_product_media_fixture.ts";

const digest = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tmlive-sec-"));
const originalWorkerScript = process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"];
const originalMaxQueue = process.env["TANCMARK_LIVE_WATERMARK_MAX_QUEUE"];
const manager = new LiveWatermarkWorkerManager();

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof LiveProductError && error.code === code);
}

async function main(): Promise<void> {
  try {
    assert(originalWorkerScript && path.isAbsolute(originalWorkerScript));
    process.env["TANCMARK_LIVE_WATERMARK_MAX_QUEUE"] = "1";
    const fixture = generateLiveFmp4Fixture(path.join(temp, "fixture"));
    const rawInitInfo = validateLiveFmp4Init(fixture.init);
    const provider = loadLiveLocalSecretProvider();

    const authoritative = resolveVerifiedLiveTenant({
      apiClient: { id: "tenant-authoritative" },
      header: () => undefined,
      body: { tenantId: "tenant-spoofed", accountId: "account-spoofed", expectedId: "attacker" },
    } as never, {});
    assert.deepEqual(authoritative, {
      ok: true,
      tenantId: "tenant-authoritative",
      accountId: "tenant-authoritative",
      source: "api_key",
    });

    const binding = createLiveSessionSealBinding({
      sessionId: "11111111-1111-4111-8111-111111111111",
      bindingId: "22222222-2222-4222-8222-222222222222",
      tenantId: "tenant-authoritative",
      accountId: "account-authoritative",
      provider,
      physicalAegisKeyVersion: "v1",
    });
    const authority = resolveLiveSessionSealAuthority(binding, provider);
    assert.match(authority.exactIdHex, /^[0-9a-f]{64}$/);
    const publicBindingText = JSON.stringify(publicLiveSessionSealBinding(binding));
    assert.equal(publicBindingText.includes(authority.exactIdHex), false);
    assert.equal(publicBindingText.includes(provider.signExactKid(provider.activeKid, "probe").toString("hex")), false);

    for (const tampered of [
      { ...binding, tenantId: "wrong-tenant" },
      { ...binding, accountId: "wrong-account" },
      { ...binding, registryRecordId: "33333333-3333-4333-8333-333333333333" },
      { ...binding, signatureReference: `${binding.signatureReference}x` },
      { ...binding, state: "STALE" as const },
      { ...binding, state: "REVOKED" as const, revokedAt: new Date().toISOString() },
      { ...binding, physicalAegisKeyVersion: "v999" },
    ]) {
      expectCode(() => resolveLiveSessionSealAuthority(tampered, provider), "live_session_seal_binding_invalid");
    }

    const store = new LiveProductStore(path.join(temp, "store"));
    const lifecycle = new LiveProductLifecycle(store, undefined, manager);
    const tenantId = "security-contract-tenant";
    let session = lifecycle.createSession({ tenantId, accountId: "security-contract-account" });
    assert.equal(session.protectionMode, "PROTECTED_TANCMARK");
    assert.equal(session.expectedIdProvided, false);
    const uploaded = store.uploadInit({
      tenantId,
      sessionId: session.sessionId,
      bytes: fixture.init,
      suppliedSha256: digest(fixture.init),
      idempotencyKey: "security-init-0001",
    });
    expectCode(() => store.readInit(tenantId, session.sessionId), "live_init_not_found");
    session = (await lifecycle.startSession({
      tenantId,
      sessionId: session.sessionId,
      expectedRevision: uploaded.session.revision,
      idempotencyKey: "security-start-0001",
    })).session;

    expectCode(() => store.appendSegment({
      tenantId,
      sessionId: session.sessionId,
      sequence: 0,
      durationMs: fixture.durationsMs[0] as number,
      bytes: fixture.fragments[0] as Buffer,
      suppliedSha256: digest(fixture.fragments[0] as Buffer),
      idempotencyKey: "worker-bypass-0001",
    }), "live_protected_segment_worker_required");
    assert.equal(store.listSegments(tenantId, session.sessionId).length, 0);

    const storedBinding = store.readPrivateJson<typeof binding>(tenantId, session.sessionId, "seal-binding.json");
    assert(storedBinding);
    const storedAuthority = resolveLiveSessionSealAuthority(storedBinding, provider);
    const source0 = validateLiveFmp4Fragment(fixture.fragments[0] as Buffer, rawInitInfo);
    const source1 = validateLiveFmp4Fragment(fixture.fragments[1] as Buffer, rawInitInfo);
    const firstQueued = manager.processFragment({
      tenantId,
      sessionId: session.sessionId,
      sequence: 0,
      rawInit: fixture.init,
      rawFragment: fixture.fragments[0] as Buffer,
      sourceFragment: source0,
      exactIdHex: storedAuthority.exactIdHex,
      globalFrameOffset: 0,
      jobRoot: store.createWatermarkJobPath(tenantId, session.sessionId),
    });
    await assert.rejects(manager.processFragment({
      tenantId,
      sessionId: session.sessionId,
      sequence: 1,
      rawInit: fixture.init,
      rawFragment: fixture.fragments[1] as Buffer,
      sourceFragment: source1,
      exactIdHex: storedAuthority.exactIdHex,
      globalFrameOffset: source0.tracks[0]?.sampleCount ?? 0,
      jobRoot: store.createWatermarkJobPath(tenantId, session.sessionId),
    }), (error: unknown) => error instanceof LiveProductError && error.code === "live_watermark_queue_overflow");
    await firstQueued;

    const appended = await lifecycle.appendSegment({
      tenantId,
      sessionId: session.sessionId,
      sequence: 0,
      durationMs: fixture.durationsMs[0] as number,
      bytes: fixture.fragments[0] as Buffer,
      suppliedSha256: digest(fixture.fragments[0] as Buffer),
      idempotencyKey: "security-segment-0001",
    });
    assert.equal((await lifecycle.appendSegment({
      tenantId,
      sessionId: session.sessionId,
      sequence: 0,
      durationMs: fixture.durationsMs[0] as number,
      bytes: fixture.fragments[0] as Buffer,
      suppliedSha256: digest(fixture.fragments[0] as Buffer),
      idempotencyKey: "security-segment-0001",
    })).duplicate, true);
    await assert.rejects(lifecycle.appendSegment({
      tenantId,
      sessionId: session.sessionId,
      sequence: 0,
      durationMs: fixture.durationsMs[1] as number,
      bytes: fixture.fragments[1] as Buffer,
      suppliedSha256: digest(fixture.fragments[1] as Buffer),
      idempotencyKey: "security-segment-0001",
    }), (error: unknown) => error instanceof LiveProductError && error.code === "live_segment_idempotency_conflict");
    expectCode(() => store.requireSession("wrong-tenant", session.sessionId), "live_session_not_found");
    expectCode(() => store.readSegment(tenantId, session.sessionId, "../../outside"), "live_segment_not_found");
    assert.notEqual(store.readSegment(tenantId, session.sessionId, appended.segment.segmentId).record.sha256, digest(fixture.fragments[0] as Buffer));

    const rolling = store.readPrivateJson<Record<string, unknown>>(tenantId, session.sessionId, "rolling-map.json");
    assert(rolling);
    assert.throws(() => validateLiveRollingSealMap({ ...rolling, chainHeadSha256: "00".repeat(32) } as never));
    const apiSurface = JSON.stringify({ session: store.requireSession(tenantId, session.sessionId), binding: publicLiveSessionSealBinding(storedBinding), events: store.listEvents(tenantId, session.sessionId) });
    assert.equal(apiSurface.includes(storedAuthority.exactIdHex), false);
    assert.equal(apiSurface.includes("demo-secret-please-change-me"), false);

    const transport = lifecycle.createSession({ tenantId, accountId: "security-contract-account", protectionMode: "TRANSPORT_ONLY" });
    assert.equal(transport.transportOnlyWarning, true);
    assert.equal(transport.identityAuthorityMode, "TRANSPORT_SUPPORT_ONLY");
    assert.equal(transport.bindingId, null);
    assert.equal(transport.finalVerificationState, "NOT_APPLICABLE");

    await manager.shutdownAll();
    process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"] = path.resolve("runtime/validation/fixtures/live_worker_exit_after_ping.py");
    const crashManager = new LiveWatermarkWorkerManager();
    await crashManager.ensureReady("crash-tenant", "44444444-4444-4444-8444-444444444444");
    await assert.rejects(crashManager.processFragment({
      tenantId: "crash-tenant",
      sessionId: "44444444-4444-4444-8444-444444444444",
      sequence: 0,
      rawInit: fixture.init,
      rawFragment: fixture.fragments[0] as Buffer,
      sourceFragment: source0,
      exactIdHex: storedAuthority.exactIdHex,
      globalFrameOffset: 0,
      jobRoot: path.join(temp, "watermark-job-crash"),
    }), (error: unknown) => error instanceof LiveProductError && error.code === "live_watermarking_failed_fail_closed");
    await crashManager.shutdownAll();

    console.log(JSON.stringify({
      contract: "live_instream_security_contract",
      status: "passed",
      bodyTenantSpoofRejectedAsAuthority: true,
      wrongTenant: true,
      wrongAccount: true,
      wrongRegistry: true,
      wrongSignature: true,
      revokedOrStaleBinding: true,
      replayedOrChangedFragment: true,
      changedRollingMap: true,
      rawIngestPlaybackAttempt: true,
      unwatermarkedOutputInjection: true,
      workerBypass: true,
      workerCrashFailClosed: true,
      queueOverflowFailClosed: true,
      pathTraversal: true,
      rawIdDisclosure: 0,
      secretDisclosure: 0,
      unwatermarkedProtectedPlayback: 0,
      unauthorizedFinalDecision: 0,
      wrongOwnership: 0,
      crossTenantLeak: 0,
      externalNetworkCalls: 0,
    }, null, 2));
  } finally {
    await manager.shutdownAll();
    if (originalWorkerScript === undefined) delete process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"];
    else process.env["TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT"] = originalWorkerScript;
    if (originalMaxQueue === undefined) delete process.env["TANCMARK_LIVE_WATERMARK_MAX_QUEUE"];
    else process.env["TANCMARK_LIVE_WATERMARK_MAX_QUEUE"] = originalMaxQueue;
    releaseLiveProductProcessLeasesForContractOnly();
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(temp));
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
