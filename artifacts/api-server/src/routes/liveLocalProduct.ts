import { createHash } from "node:crypto";
import express, { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { getLiveExactIdentityProtectedIntegrationStatus } from "../live/liveExactIdentityAuthorityAdapter";
import { getLiveExternalIntegrationDebt } from "../live/liveExternalIntegrationDebt";
import { getUnconfiguredLiveProviderAdapters } from "../live/liveExternalProviderAdapterConfig";
import { buildLiveAdvisoryEvent } from "../live/liveAdvisoryEventFeed";
import type { LiveAutomaticFinalVerificationResult } from "../live/liveAutomaticExactVerification";
import { getLiveLocalSecretProviderStatus, loadLiveLocalSecretProvider } from "../live/liveLocalSecretProvider";
import { getLiveLocalRuntime } from "../live/liveLocalRuntime";
import {
  LIVE_PLAYBACK_TOKEN_MAX_TTL_SECONDS,
  issueLivePlaybackTokenV1,
  verifyLivePlaybackTokenV1,
  type LivePlaybackResourceScope,
} from "../live/livePlaybackTokenV1";
import { LIVE_PLAYER_SHOULD_AUTO_ALIGN_SOURCE, LIVE_PLAYER_USER_SEEK_GUARD_MS } from "../live/livePlayerTimelinePolicy";
import {
  LIVE_LOCAL_MAX_SEGMENT_BYTES,
  LiveProductError,
  LiveProductStore,
  type LiveProductSession,
  type LiveProductStopReceipt,
} from "../live/liveProductStore";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  requireVerifiedLiveTenant,
  verifiedLiveAccountFromResponse,
  verifiedLiveTenantFromResponse,
} from "../middlewares/liveTenantAuth";

const router: IRouter = Router();
const management: IRouter = Router();
const grantCookieName = (sessionId: string): string => `tmlg_${createHash("sha256").update(sessionId).digest("hex").slice(0, 20)}`;

function socketIsEncrypted(req: Request): boolean { return (req.socket as typeof req.socket & { encrypted?: boolean }).encrypted === true; }
function socketIsLoopback(req: Request): boolean {
  const address = req.socket.remoteAddress;
  if (!address) return false;
  const normalized = address.toLowerCase().split("%")[0] as string;
  return normalized === "::1" || normalized === "127.0.0.1" || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(normalized) || normalized.startsWith("::ffff:127.");
}

/** Trust only the connected socket; forwarded headers and req.ip are deliberately ignored. */
export function requireLiveLocalTransportBoundary(req: Request, res: Response, next: NextFunction): void {
  if (socketIsLoopback(req) || socketIsEncrypted(req)) { next(); return; }
  res.status(403).json({ error: "live_local_transport_boundary_rejected" });
}

router.use(requireLiveLocalTransportBoundary);

function runtime(): ReturnType<typeof getLiveLocalRuntime> {
  return getLiveLocalRuntime();
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function bodyRecord(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
    ? req.body as Record<string, unknown>
    : {};
}

function requireExactBodyKeys(body: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = []): void {
  const keys = Object.keys(body);
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !Object.prototype.hasOwnProperty.call(body, key))) throw new LiveProductError("live_request_body_shape_invalid", 400);
}

function parseInteger(value: unknown, code: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new LiveProductError(code, 400);
  return parsed;
}

function requireHeader(req: Request, name: string, code: string): string {
  const value = req.header(name)?.trim();
  if (!value) throw new LiveProductError(code, 400);
  return value;
}

function publicStopReceipt(receipt: LiveProductStopReceipt | null) {
  return receipt ? {
    receiptId: receipt.receiptId,
    stoppedAt: receipt.stoppedAt,
    sessionRevision: receipt.sessionRevision,
    evidenceId: receipt.evidenceId,
    manifestId: receipt.manifestId,
  } : null;
}

function publicFinalVerification(result: LiveAutomaticFinalVerificationResult | null) {
  return result ? {
    schemaVersion: result.schemaVersion,
    sessionId: result.sessionId,
    bindingId: result.bindingId,
    verdict: result.verdict,
    reason: result.reason,
    exactIdVerified: result.exactIdVerified,
    registryVerified: result.registryVerified,
    signatureVerified: result.signatureVerified,
    tenantVerified: result.tenantVerified,
    accountVerified: result.accountVerified,
    uniqueRecord: result.uniqueRecord,
    physicalVideoIdVerified: result.physicalVideoIdVerified,
    ownership: result.ownership,
    vault: result.vault,
    confirmed: result.confirmed,
    final: result.final,
    verifiedAt: result.verifiedAt,
    exactIdDisclosed: false,
    privateMapDisclosed: false,
    registryContentsDisclosed: false,
    decoderDetailsDisclosed: false,
  } : null;
}

function publicSession(session: LiveProductSession) {
  const exactFinal = session.protectionMode === "PROTECTED_TANCMARK" && session.finalVerificationState === "EXACT_VERIFIED";
  return {
    sessionId: session.sessionId,
    status: session.status,
    revision: session.revision,
    accessRevision: session.accessRevision,
    tokenEpoch: session.tokenEpoch,
    legalHold: session.legalHold,
    protectionMode: session.protectionMode,
    watermarkState: session.watermarkState,
    watermarkWorkerHealth: session.watermarkWorkerHealth,
    liveVerificationState: session.liveVerificationState,
    finalVerificationState: session.finalVerificationState,
    registryBindingState: session.registryBindingState,
    signedMapState: session.signedMapState,
    protectedOutputReady: session.protectedOutputReady,
    transportOnlyWarning: session.transportOnlyWarning,
    bindingId: session.bindingId,
    expectedIdProvided: session.expectedIdProvided,
    identityAuthorityMode: session.identityAuthorityMode,
    segmentCount: session.segmentCount,
    totalBytes: session.totalBytes,
    totalDurationMs: session.totalDurationMs,
    initSha256: session.initSha256,
    chainHeadSha256: session.chainHeadSha256,
    manifestId: session.manifestId,
    manifestSha256: session.manifestSha256,
    evidenceId: session.evidenceId,
    recordingSha256: session.recordingSha256,
    stopReceipt: publicStopReceipt(session.stopReceipt),
    createdAt: session.createdAt,
    readyAt: session.readyAt,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    updatedAt: session.updatedAt,
    supportOnly: !exactFinal,
    ownership: exactFinal,
    vault: exactFinal,
    confirmed: exactFinal,
    final: exactFinal,
    exactIdDisclosed: false,
  };
}

function sendError(res: Response, error: unknown): void {
  if (error instanceof LiveProductError) {
    res.status(error.statusCode).json({ error: error.code });
    return;
  }
  const code = error instanceof Error ? error.message : "";
  if (code.startsWith("live_playback_keyring") || code.startsWith("live_playback_active_kid") || code.startsWith("live_playback_key_too_short")) {
    res.status(503).json({ error: "live_playback_security_not_configured" });
    return;
  }
  if (code.startsWith("live_playback_")) {
    res.status(401).json({ error: "live_playback_unauthorized" });
    return;
  }
  res.status(500).json({ error: "live_local_internal_error" });
}

function route(handler: (req: Request, res: Response) => unknown | Promise<unknown>): (req: Request, res: Response) => void {
  return (req, res) => {
    try { Promise.resolve(handler(req, res)).catch((error) => sendError(res, error)); } catch (error) { sendError(res, error); }
  };
}

function grantFromRequest(req: Request, sessionId: string): string {
  const cookieHeader = req.header("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === grantCookieName(sessionId)) return decodeURIComponent(rest.join("="));
  }
  throw new LiveProductError("live_playback_grant_required", 401);
}

function parseScopes(value: unknown): LivePlaybackResourceScope[] {
  const scopes = value === undefined ? ["init", "manifest", "media-json", "player", "recording", "segment"] : value;
  if (!Array.isArray(scopes) || scopes.length === 0) throw new LiveProductError("live_playback_scope_invalid", 400);
  const allowed = new Set<LivePlaybackResourceScope>(["player", "manifest", "segment", "recording", "init", "media-json"]);
  const unique = [...new Set(scopes)];
  if (unique.length !== scopes.length || unique.some((scope) => typeof scope !== "string" || !allowed.has(scope as LivePlaybackResourceScope))) {
    throw new LiveProductError("live_playback_scope_invalid", 400);
  }
  return (unique as LivePlaybackResourceScope[]).sort();
}

function sendWithEtag(req: Request, res: Response, digest: string, contentType: string, body: string | Buffer): void {
  const etag = `"${digest}"`;
  res.setHeader("ETag", etag);
  if (req.header("if-none-match") === etag) { res.status(304).end(); return; }
  res.type(contentType).send(body);
}

function page<T>(items: readonly T[], req: Request): { items: T[]; nextCursor: string | null } {
  const limit = Math.min(100, Math.max(1, parseInteger(req.query["limit"] ?? 25, "live_pagination_limit_invalid")));
  const cursor = req.query["cursor"] === undefined ? 0 : parseInteger(req.query["cursor"], "live_pagination_cursor_invalid");
  return { items: items.slice(cursor, cursor + limit), nextCursor: cursor + limit < items.length ? String(cursor + limit) : null };
}

function requireProtectedPlaybackReady(store: LiveProductStore, tenantId: string, sessionId: string): LiveProductSession {
  const session = store.requireSession(tenantId, sessionId);
  if (session.protectionMode === "PROTECTED_TANCMARK" && (!session.protectedOutputReady || session.status === "FAILED" || session.watermarkState === "LIVE_WATERMARKING_FAILED_FAIL_CLOSED" || session.watermarkState === "LIVE_VERIFICATION_FAILED")) {
    throw new LiveProductError("live_protected_output_not_ready", 409);
  }
  return session;
}

// The shell is public but contains no project data or credentials.  Operators
// supply the admin token and tenant for each in-memory request; the page does
// not persist, echo or log either value.
router.get("/management-console", route((_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><title>TancMark Live Local</title><style>body{font:16px system-ui;max-width:70rem;margin:2rem auto;padding:0 1rem}label{display:block;margin:.7rem 0}input{width:32rem;max-width:100%}button{margin:.3rem}.warn{padding:.8rem;background:#fff4ce}pre{white-space:pre-wrap}</style></head><body><h1>TancMark Live Local v1</h1><p class="warn">Varsayılan: Canlı mühürleme hazırlanıyor. TRANSPORT_ONLY seçilirse “Mühürleme kapalı — yalnız yayın taşıma modu” olarak gösterilir.</p><label>Admin token <input id="a" type="password" autocomplete="off"></label><label>Doğrulanmış tenant <input id="t" autocomplete="off"></label><button id="s">Durum</button><button id="l">Oturumlar</button><button id="c">Korumalı oturum oluştur</button><pre id="o">Kimlik bilgileri yalnız bu sekmenin belleğinde tutulur.</pre><script>(()=>{const q=id=>document.getElementById(id),call=async(path,method='GET',body)=>{const h={'x-admin-token':q('a').value,'x-tancmark-live-tenant-id':q('t').value};if(body){h['content-type']='application/json'}const r=await fetch('./'+path,{method,headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store'});q('o').textContent=r.status+' '+await r.text()};q('s').onclick=()=>call('status');q('l').onclick=()=>call('sessions?limit=25');q('c').onclick=()=>call('sessions','POST',{legalHold:false,protectionMode:'PROTECTED_TANCMARK'})})()</script></body></html>`);
}));

// Public playback endpoints are cryptographically authorized. They never use a
// request body tenant/client/owner value as authority.
router.post("/access/exchange", route((req, res) => {
  const body = bodyRecord(req); requireExactBodyKeys(body, ["token"], ["token"]);
  const token = body["token"];
  if (typeof token !== "string") throw new LiveProductError("live_playback_token_required", 401);
  const provider = loadLiveLocalSecretProvider();
  const claims = verifyLivePlaybackTokenV1(token, provider);
  const { grants } = runtime();
  const grant = grants.consumeExchangeAndCreateGrant(claims);
  const maxAge = Math.max(1, Math.floor((Date.parse(grant.expiresAt) - Date.now()) / 1000));
  res.setHeader("Cache-Control", "no-store");
  res.cookie(grantCookieName(grant.sessionId), grant.grantToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: socketIsEncrypted(req),
    path: "/api/tancmark/live/local/v1/",
    maxAge: maxAge * 1000,
  });
  res.status(201).json({
    grantId: grant.grantId,
    sessionId: grant.sessionId,
    scopes: grant.scopes,
    expiresAt: grant.expiresAt,
  });
}));

router.get("/player/:sessionId", route((req, res) => {
  const sessionId = param(req, "sessionId");
  const { store, grants } = runtime();
  const authorized = grants.authorize(grantFromRequest(req, sessionId), sessionId, "player");
  requireProtectedPlaybackReady(store, authorized.tenantId, sessionId);
  const base = `/api/tancmark/live/local/v1/playback/${sessionId}`;
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src 'self' blob:; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><title>TancMark Live</title></head><body><video id="v" controls autoplay playsinline></video><p>Yerel taşıma kanıtı yalnız support-only'dir; sahiplik, VAULT veya kesin sonuç vermez.</p><pre id="s">LOADING</pre><script>(()=>{
const b=${JSON.stringify(base)},v=document.getElementById('v'),s=document.getElementById('s');
const telemetry=window.__tancmarkLivePlayerTelemetry={inventoryPolls:0,inventoryEnded:null,segmentCount:0,endOfStream:{called:false,success:false,error:null},endedEvent:false,status:'LOADING',failure:null};
const show=x=>{s.textContent=x;telemetry.status=x},shouldAlign=${LIVE_PLAYER_SHOULD_AUTO_ALIGN_SOURCE};
let userSeekUntil=0,autoSeeking=false;
for(const e of ['pointerdown','touchstart','keydown'])v.addEventListener(e,()=>{userSeekUntil=Date.now()+${LIVE_PLAYER_USER_SEEK_GUARD_MS}});
v.addEventListener('seeking',()=>{if(!autoSeeking)userSeekUntil=Date.now()+${LIVE_PLAYER_USER_SEEK_GUARD_MS}});
v.addEventListener('playing',()=>show('PLAYING'));
v.addEventListener('waiting',()=>{if(!v.error)show('READY / BUFFERING')});
v.addEventListener('ended',()=>{telemetry.endedEvent=true;show('ENDED')});
v.addEventListener('error',()=>show('FAILED media error '+(v.error?.code??'unknown')));
const fallback=()=>{v.src=b+'/manifest.m3u8';show('READY native HLS fallback')};
const align=()=>{const ranges=[];for(let i=0;i<v.buffered.length;i++)ranges.push([v.buffered.start(i),v.buffered.end(i)]);if(!shouldAlign(v.currentTime,ranges,Date.now(),userSeekUntil))return false;const target=ranges[0][0],resume=!v.paused;autoSeeking=true;v.currentTime=target;setTimeout(()=>{autoSeeking=false},0);if(resume)v.play().catch(()=>{});show('READY aligned to buffered media');return true};
if(!window.MediaSource){fallback();return}
const m=new MediaSource();v.src=URL.createObjectURL(m);
m.addEventListener('sourceopen',async()=>{try{
  show('LOADING media metadata');
  const j=await (await fetch(b+'/media.json',{credentials:'same-origin'})).json();
  telemetry.inventoryPolls+=1;telemetry.inventoryEnded=j.ended===true;telemetry.segmentCount=Array.isArray(j.segments)?j.segments.length:0;
  if(!MediaSource.isTypeSupported(j.mimeCodec)){fallback();return}
  const sb=m.addSourceBuffer(j.mimeCodec);
  const append=async u=>{const r=await fetch(u,{credentials:'same-origin'});if(!r.ok)throw new Error('media fetch failed');const x=await r.arrayBuffer();await new Promise((ok,no)=>{sb.addEventListener('updateend',ok,{once:true});sb.addEventListener('error',no,{once:true});sb.appendBuffer(x)});if(!align())show('READY buffered media')};
  await append(b+'/init.mp4');let n=0;
  for(;;){
    const r=await fetch(b+'/media.json',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('inventory fetch failed');const x=await r.json();
    telemetry.inventoryPolls+=1;telemetry.inventoryEnded=x.ended===true;telemetry.segmentCount=Array.isArray(x.segments)?x.segments.length:0;
    for(;n<x.segments.length;n++)await append(x.segments[n].url);
    if(x.ended){telemetry.endOfStream.called=true;try{m.endOfStream();telemetry.endOfStream.success=true;show('READY stopped VOD buffered')}catch(error){telemetry.endOfStream.error=error instanceof Error?error.name:'unknown';throw error}break}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
}catch(error){telemetry.failure=error instanceof Error?error.message:'unknown';show('FAILED playback')}})})();</script></body></html>`);
}));

router.get("/playback/:sessionId/manifest.m3u8", route(async (req, res) => {
  const sessionId = param(req, "sessionId");
  const { store, grants } = runtime();
  const grantToken = grantFromRequest(req, sessionId);
  const authorization = grants.authorize(grantToken, sessionId, "manifest");
  requireProtectedPlaybackReady(store, authorization.tenantId, sessionId);
  const msnRaw = req.query["_HLS_msn"]; const partRaw = req.query["_HLS_part"]; const skipRaw = req.query["_HLS_skip"];
  if ((msnRaw !== undefined && (Array.isArray(msnRaw) || !/^\d{1,10}$/.test(String(msnRaw)))) || (partRaw !== undefined && (Array.isArray(partRaw) || !/^\d{1,4}$/.test(String(partRaw)))) || (partRaw !== undefined && msnRaw === undefined) || (skipRaw !== undefined && skipRaw !== "YES" && skipRaw !== "v2")) throw new LiveProductError("live_llhls_query_invalid", 400);
  if (partRaw !== undefined && Number(partRaw) !== 0) throw new LiveProductError("live_llhls_part_out_of_range", 400);
  const observed = store.requireSession(authorization.tenantId, sessionId);
  if (msnRaw !== undefined && Number(msnRaw) > observed.nextSegmentSequence + 1) throw new LiveProductError("live_llhls_msn_out_of_range", 400);
  if (msnRaw !== undefined && observed.status === "RUNNING" && Number(msnRaw) >= observed.nextSegmentSequence) {
    const configuredWait = Number(process.env["TANCMARK_LIVE_BLOCK_RELOAD_MS"] ?? 1500);
    const waitMs = Number.isSafeInteger(configuredWait) ? Math.min(3000, Math.max(100, configuredWait)) : 1500;
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const current = store.requireSession(authorization.tenantId, sessionId);
      if (current.status !== "RUNNING" || current.nextSegmentSequence > Number(msnRaw)) break;
    }
    grants.authorize(grantToken, sessionId, "manifest");
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-TancMark-LL-HLS", "v1");
  const body = store.readManifest(authorization.tenantId, sessionId);
  sendWithEtag(req, res, LiveProductStore.sha256(body), "application/vnd.apple.mpegurl", body);
}));

router.get("/playback/:sessionId/init.mp4", route((req, res) => {
  const sessionId = param(req, "sessionId"); const { store, grants } = runtime();
  const auth = grants.authorize(grantFromRequest(req, sessionId), sessionId, "init");
  requireProtectedPlaybackReady(store, auth.tenantId, sessionId);
  const init = store.readInit(auth.tenantId, sessionId);
  sendWithEtag(req, res, init.record.sha256, "video/mp4", init.bytes);
}));

router.get("/playback/:sessionId/media.json", route((req, res) => {
  const sessionId = param(req, "sessionId"); const { store, grants } = runtime();
  const auth = grants.authorize(grantFromRequest(req, sessionId), sessionId, "media-json");
  const session = requireProtectedPlaybackReady(store, auth.tenantId, sessionId);
  const init = store.readInit(auth.tenantId, sessionId);
  const body = { mimeCodec: `video/mp4; codecs="${init.record.codecs.join(',')}"`, ended: session.status === "STOPPED", segments: store.listSegments(auth.tenantId, sessionId).map((x) => ({ sequence: x.sequence, url: `/api/tancmark/live/local/v1/playback/${sessionId}/segments/${x.segmentId}`, sha256: x.sha256, byteLength: x.byteLength })) };
  res.setHeader("Cache-Control", "no-store"); res.json(body);
}));

router.get("/playback/:sessionId/segments/:segmentId", route((req, res) => {
  const sessionId = param(req, "sessionId");
  const { store, grants } = runtime();
  const authorization = grants.authorize(grantFromRequest(req, sessionId), sessionId, "segment");
  requireProtectedPlaybackReady(store, authorization.tenantId, sessionId);
  const segment = store.readSegment(authorization.tenantId, sessionId, param(req, "segmentId"));
  res.setHeader("Cache-Control", "private, max-age=30");
  res.setHeader("ETag", `"${segment.record.sha256}"`);
  sendWithEtag(req, res, segment.record.sha256, "video/iso.segment", segment.bytes);
}));

router.get("/playback/:sessionId/recording.mp4", route((req, res) => {
  const sessionId = param(req, "sessionId"); const { store, grants } = runtime();
  const auth = grants.authorize(grantFromRequest(req, sessionId), sessionId, "recording");
  requireProtectedPlaybackReady(store, auth.tenantId, sessionId);
  const recording = store.readRecording(auth.tenantId, sessionId);
  sendWithEtag(req, res, recording.record.sha256, "video/mp4", recording.bytes);
}));

management.use(requireAdminToken, requireVerifiedLiveTenant);

management.get("/status", route((_req, res) => {
  const security = getLiveLocalSecretProviderStatus();
  let storage: Record<string, unknown>;
  try { storage = runtime().store.storageStatus(); } catch { storage = { initialized: false, writable: false, leaseHeldByThisProcess: false, freeBytes: null }; }
  const runtimeReady = security.configured === true && storage["initialized"] === true && storage["writable"] === true && storage["leaseHeldByThisProcess"] === true;
  const available = runtimeReady;
  res.json({
    status: available ? "LOCAL_SINGLE_NODE_CORE_AVAILABLE" : "LOCAL_SINGLE_NODE_CORE_NOT_READY",
    available,
    runtimeReady,
    storageConfigured: Boolean(process.env["TANCMARK_LIVE_STORAGE_ROOT"]),
    storage,
    playbackSecurity: security,
    exactIdentityIntegration: getLiveExactIdentityProtectedIntegrationStatus(),
    externalDebt: getLiveExternalIntegrationDebt(),
    externalProviderAdapters: getUnconfiguredLiveProviderAdapters(),
    capabilityAvailability: { llHlsCmaf: true, sameOriginMediaSourcePlayer: true, recordingVod: true, transportBoundary: "LOOPBACK_OR_ACTUAL_TLS_SOCKET" },
    dependencyReadiness: { liveTransportPlayerRuntimeFfmpegDependency: false, protectedExactVerificationUsesExistingProtectedRuntime: true, protectedRuntimeMayRequireFfmpegFfprobePyav: true },
    externalNetworkCallsPerformed: 0,
    externalProcessesStarted: 0,
    supportOnly: true,
    ownership: false,
    vault: false,
    confirmed: false,
    final: false,
  });
}));

management.get("/debt", route((_req, res) => res.json(getLiveExternalIntegrationDebt())));

management.get("/console", route((_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.redirect(303, "./management-console");
}));

management.post("/sessions", route((req, res) => {
  const body = bodyRecord(req);
  requireExactBodyKeys(body, ["legalHold", "protectionMode"]);
  const protectionMode = body["protectionMode"] === undefined ? "PROTECTED_TANCMARK" : body["protectionMode"];
  if (protectionMode !== "PROTECTED_TANCMARK" && protectionMode !== "TRANSPORT_ONLY") throw new LiveProductError("live_protection_mode_invalid", 400);
  const session = runtime().lifecycle.createSession({
    tenantId: verifiedLiveTenantFromResponse(res),
    accountId: verifiedLiveAccountFromResponse(res),
    legalHold: body["legalHold"] === true,
    protectionMode,
  });
  res.status(201).json({ session: publicSession(session) });
}));

management.get("/sessions", route((_req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res);
  const result = page(runtime().store.listSessions(tenantId).map(publicSession), _req);
  res.json({ sessions: result.items, nextCursor: result.nextCursor });
}));

management.get("/sessions/:sessionId", route((req, res) => {
  const session = runtime().store.requireSession(verifiedLiveTenantFromResponse(res), param(req, "sessionId"));
  res.json({ session: publicSession(session) });
}));

management.post("/sessions/:sessionId/init", express.raw({ type: "application/octet-stream", limit: LIVE_LOCAL_MAX_SEGMENT_BYTES }), route((req, res) => {
  if (!Buffer.isBuffer(req.body)) throw new LiveProductError("live_init_octet_stream_required", 400);
  const result = runtime().store.uploadInit({ tenantId: verifiedLiveTenantFromResponse(res), sessionId: param(req, "sessionId"), bytes: req.body, suppliedSha256: requireHeader(req, "x-content-sha256", "live_init_hash_required").toLowerCase(), idempotencyKey: requireHeader(req, "x-idempotency-key", "live_idempotency_key_required") });
  res.status(result.duplicate ? 200 : 201).json({ init: { sha256: result.record.sha256, byteLength: result.record.byteLength, codecs: result.record.codecs, relativeUrl: result.session.protectionMode === "PROTECTED_TANCMARK" ? null : `/api/tancmark/live/local/v1/playback/${result.session.sessionId}/init.mp4`, privateIngestOnly: result.session.protectionMode === "PROTECTED_TANCMARK" }, duplicate: result.duplicate, session: publicSession(result.session) });
}));

management.post("/sessions/:sessionId/start", route(async (req, res) => {
  const body = bodyRecord(req); requireExactBodyKeys(body, ["expectedRevision"], ["expectedRevision"]);
  const result = await runtime().lifecycle.startSession({ tenantId: verifiedLiveTenantFromResponse(res), sessionId: param(req, "sessionId"), expectedRevision: parseInteger(body["expectedRevision"], "live_session_revision_required"), idempotencyKey: requireHeader(req, "x-idempotency-key", "live_idempotency_key_required") });
  res.json({ session: publicSession(result.session), receipt: { receiptId: result.receipt.receiptId, startedAt: result.receipt.startedAt }, replayed: result.replayed });
}));

management.post(
  "/sessions/:sessionId/segments",
  express.raw({ type: "application/octet-stream", limit: LIVE_LOCAL_MAX_SEGMENT_BYTES }),
  route(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw new LiveProductError("live_segment_octet_stream_required", 400);
    const result = await runtime().lifecycle.appendSegment({
      tenantId: verifiedLiveTenantFromResponse(res),
      sessionId: param(req, "sessionId"),
      sequence: parseInteger(requireHeader(req, "x-segment-sequence", "live_segment_sequence_required"), "live_segment_sequence_invalid"),
      durationMs: parseInteger(requireHeader(req, "x-segment-duration-ms", "live_segment_duration_required"), "live_segment_duration_invalid"),
      bytes: req.body,
      suppliedSha256: requireHeader(req, "x-content-sha256", "live_segment_hash_required").toLowerCase(),
      idempotencyKey: requireHeader(req, "x-idempotency-key", "live_idempotency_key_required"),
    });
    res.status(result.duplicate ? 200 : 201).json({
      segment: {
        segmentId: result.segment.segmentId,
        sequence: result.segment.sequence,
        durationMs: result.segment.durationMs,
        byteLength: result.segment.byteLength,
        sha256: result.segment.sha256,
        chainSha256: result.segment.chainSha256,
        relativeUrl: `/api/tancmark/live/local/v1/playback/${result.session.sessionId}/segments/${result.segment.segmentId}`,
      },
      duplicate: result.duplicate,
      session: publicSession(result.session),
    });
  }),
);

management.post("/sessions/:sessionId/stop", route(async (req, res) => {
  const body = bodyRecord(req); requireExactBodyKeys(body, ["expectedRevision"], ["expectedRevision"]);
  const result = await runtime().lifecycle.stopSession({
    tenantId: verifiedLiveTenantFromResponse(res),
    sessionId: param(req, "sessionId"),
    expectedRevision: parseInteger(body["expectedRevision"], "live_session_revision_required"),
    idempotencyKey: requireHeader(req, "x-idempotency-key", "live_idempotency_key_required"),
  });
  res.json({
    session: publicSession(result.session),
    receipt: publicStopReceipt(result.receipt),
    evidence: result.evidence,
    finalVerification: publicFinalVerification(result.finalVerification),
    replayed: result.replayed,
  });
}));

management.get("/sessions/:sessionId/health", route((req, res) => {
  const store = runtime().store; const tenantId = verifiedLiveTenantFromResponse(res); const session = store.requireSession(tenantId, param(req, "sessionId"));
  res.json({ sessionId: session.sessionId, status: session.status, playbackAllowed: (session.status === "RUNNING" || session.status === "STOPPED") && (session.protectionMode === "TRANSPORT_ONLY" || session.protectedOutputReady), cleanupPending: session.status === "CLEANUP_PENDING", integrity: store.validateSessionHealth(tenantId, session.sessionId), watermarkWorkerHealth: runtime().watermarkWorkers.health(tenantId, session.sessionId) });
}));

management.get("/sessions/:sessionId/events", route((req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res);
  const result = page(runtime().store.listEvents(tenantId, param(req, "sessionId")), req);
  res.json({ events: result.items, nextCursor: result.nextCursor });
}));

management.get("/sessions/:sessionId/metrics", route((req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res);
  res.json(runtime().store.sessionMetrics(tenantId, param(req, "sessionId")));
}));

management.get("/sessions/:sessionId/advisory-event", route((req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res); const store = runtime().store; const session = store.requireSession(tenantId, param(req, "sessionId"));
  res.json(buildLiveAdvisoryEvent({ eventType: "live.session.health-support", sessionId: session.sessionId, signals: { status: session.status, segmentCount: session.segmentCount, totalBytes: session.totalBytes } }));
}));

management.get("/sessions/:sessionId/evidence", route((req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res);
  const evidence = runtime().store.readEvidence(tenantId, param(req, "sessionId"));
  if (!evidence) throw new LiveProductError("live_evidence_not_ready", 409);
  res.json({ evidence });
}));

management.post("/sessions/:sessionId/verify-exact-id", route(async (req, res) => {
  const body = bodyRecord(req);
  requireExactBodyKeys(body, []);
  const tenantId = verifiedLiveTenantFromResponse(res);
  const sessionId = param(req, "sessionId");
  const session = runtime().store.requireSession(tenantId, sessionId);
  if (session.finalVerificationState !== "EXACT_VERIFIED") throw new LiveProductError("live_final_verification_not_ready", 409);
  const result = runtime().store.readPrivateJson<LiveAutomaticFinalVerificationResult>(tenantId, sessionId, "final-verification.json");
  if (!result) throw new LiveProductError("live_final_verification_not_ready", 409);
  res.json(publicFinalVerification(result));
}));

management.post("/sessions/:sessionId/access-token", route((req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res);
  const sessionId = param(req, "sessionId");
  const { store } = runtime();
  const session = store.requireSession(tenantId, sessionId);
  if (session.status !== "RUNNING" && session.status !== "STOPPED") throw new LiveProductError("live_playback_session_closed", 409);
  requireProtectedPlaybackReady(store, tenantId, sessionId);
  const body = bodyRecord(req);
  requireExactBodyKeys(body, ["viewerSubject", "ttlSeconds", "resourceScopes"], ["viewerSubject"]);
  const subject = body["viewerSubject"];
  if (typeof subject !== "string" || subject.length < 1 || subject.length > 160) throw new LiveProductError("live_viewer_subject_invalid", 400);
  const ttlSeconds = body["ttlSeconds"] === undefined ? 120 : parseInteger(body["ttlSeconds"], "live_playback_ttl_invalid");
  if (ttlSeconds < 1 || ttlSeconds > LIVE_PLAYBACK_TOKEN_MAX_TTL_SECONDS) {
    throw new LiveProductError("live_playback_ttl_invalid", 400);
  }
  const issued = issueLivePlaybackTokenV1({
    tenantId,
    subject,
    sessionId,
    resourceScopes: parseScopes(body["resourceScopes"]),
    ttlSeconds,
    accessRevision: session.accessRevision,
    tokenEpoch: session.tokenEpoch,
  }, loadLiveLocalSecretProvider());
  store.appendEvent(tenantId, sessionId, "playback.exchange-token.issued", {
    kid: issued.kid,
    scopes: issued.claims.resourceScopes,
    expiresAt: new Date(issued.claims.exp * 1000).toISOString(),
    subjectHash: createHash("sha256").update(subject).digest("hex"),
  });
  res.setHeader("Cache-Control", "no-store");
  res.status(201).json({
    exchangeToken: issued.token,
    kid: issued.kid,
    expiresAt: new Date(issued.claims.exp * 1000).toISOString(),
    exchangeUrl: "/api/tancmark/live/local/v1/access/exchange",
  });
}));

management.post("/sessions/:sessionId/grants/:grantId/revoke", route((req, res) => {
  const tenantId = verifiedLiveTenantFromResponse(res);
  runtime().grants.revokeGrant(tenantId, param(req, "sessionId"), param(req, "grantId"));
  res.json({ revoked: true });
}));

management.post("/sessions/:sessionId/revoke", route((req, res) => {
  const body = bodyRecord(req); requireExactBodyKeys(body, ["expectedRevision"], ["expectedRevision"]);
  const result = runtime().lifecycle.revokeSessionPlayback(
    verifiedLiveTenantFromResponse(res),
    param(req, "sessionId"),
    parseInteger(body["expectedRevision"], "live_session_revision_required"),
  );
  res.json({ session: publicSession(result.session), revokedGrantCount: result.revokedGrantCount });
}));

management.post("/sessions/:sessionId/cleanup/plan", route((req, res) => {
  const body = bodyRecord(req); requireExactBodyKeys(body, ["expectedRevision"], ["expectedRevision"]);
  const result = runtime().lifecycle.planCleanup({ tenantId: verifiedLiveTenantFromResponse(res), sessionId: param(req, "sessionId"), expectedRevision: parseInteger(body["expectedRevision"], "live_session_revision_required"), idempotencyKey: requireHeader(req, "x-idempotency-key", "live_idempotency_key_required") });
  const { plan } = result;
  res.status(result.replayed ? 200 : 201).json({ plan: { planId: plan.planId, sessionId: plan.sessionId, sessionRevision: plan.sessionRevision, confirmationDigest: plan.confirmationDigest, mediaOnly: plan.mediaOnly, metadataEvidenceAuditRetained: plan.metadataEvidenceAuditRetained, fileCount: plan.fileCount, totalBytes: plan.totalBytes, artifacts: plan.artifacts, createdAt: plan.createdAt, expiresAt: plan.expiresAt }, replayed: result.replayed });
}));

management.post("/sessions/:sessionId/cleanup/execute", route((req, res) => {
  const confirmation = requireHeader(req, "if-match", "live_cleanup_confirmation_required").replace(/^"|"$/g, "");
  const body = bodyRecord(req); requireExactBodyKeys(body, ["expectedRevision"], ["expectedRevision"]);
  const result = runtime().lifecycle.executeCleanup({
    tenantId: verifiedLiveTenantFromResponse(res),
    sessionId: param(req, "sessionId"),
    expectedRevision: parseInteger(body["expectedRevision"], "live_session_revision_required"),
    confirmationDigest: confirmation,
    idempotencyKey: requireHeader(req, "x-idempotency-key", "live_idempotency_key_required"),
  });
  const { receipt } = result;
  res.json({ session: publicSession(result.session), receipt: { receiptId: receipt.receiptId, planId: receipt.planId, sessionId: receipt.sessionId, purgedAt: receipt.purgedAt, deletedFileCount: receipt.deletedFileCount, deletedBytes: receipt.deletedBytes }, replayed: result.replayed, deleted: "managed_media_only", metadataEvidenceAuditRetained: true });
}));

router.use(management);

export default router;
