import {
  createHash,
  randomUUID,
} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { liveFmp4InitDecoderCompatibilitySha256, validateLiveFmp4Fragment, validateLiveFmp4Init, type LiveFmp4TrackInfo } from "./liveFmp4Validator";
import { acquireLiveProcessLease, liveProcessLeaseHeldByThisProcess, releaseLiveProcessLeasesForContractOnly } from "./liveProcessLease";

export const LIVE_LOCAL_STORAGE_ROOT_ENV = "TANCMARK_LIVE_STORAGE_ROOT" as const;
export const LIVE_LOCAL_MAX_SEGMENT_BYTES = 12 * 1024 * 1024;
const ROOT_MARKER = ".tancmark-live-storage-root-v1";
const PROTECTED_SEGMENT_WRITE_CAPABILITY = Symbol("tancmark-live-protected-segment-write");
export const releaseLiveProductProcessLeasesForContractOnly = releaseLiveProcessLeasesForContractOnly;

export type LiveProductSessionStatus =
  | "CREATED"
  | "READY"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "FAILED"
  | "CLEANUP_PENDING"
  | "PURGED";

export type LiveProtectionMode = "PROTECTED_TANCMARK" | "TRANSPORT_ONLY";
export type LiveWatermarkState =
  | "WATERMARK_PENDING"
  | "WATERMARK_ACTIVE"
  | "LIVE_SAMPLE_EXACT_VERIFIED"
  | "LIVE_SAMPLE_PARTIAL"
  | "LIVE_SAMPLE_NOT_FOUND"
  | "LIVE_VERIFICATION_FAILED"
  | "FINAL_EXACT_VERIFIED"
  | "WATERMARK_DISABLED"
  | "LIVE_WATERMARKING_FAILED_FAIL_CLOSED";

export interface LiveProductStopReceipt {
  receiptId: string;
  idempotencyKeyHash: string;
  requestDigest: string;
  stoppedAt: string;
  sessionRevision: number;
  evidenceId: string;
  manifestId: string;
}

export interface LiveProductSession {
  schemaVersion: "tancmark-live-local-session-v1";
  sessionId: string;
  tenantId: string;
  status: LiveProductSessionStatus;
  revision: number;
  accessRevision: number;
  tokenEpoch: number;
  legalHold: boolean;
  protectionMode: LiveProtectionMode;
  bindingId: string | null;
  accountBindingSha256: string | null;
  watermarkState: LiveWatermarkState;
  watermarkWorkerHealth: "NOT_STARTED" | "READY" | "HEALTHY" | "FAILED" | "STOPPED" | "NOT_APPLICABLE";
  liveVerificationState: "NOT_STARTED" | "PENDING" | "EXACT_VERIFIED" | "PARTIAL" | "NOT_FOUND" | "FAILED" | "NOT_APPLICABLE";
  finalVerificationState: "NOT_STARTED" | "PENDING" | "EXACT_VERIFIED" | "FAILED" | "NOT_APPLICABLE";
  registryBindingState: "PENDING" | "ACTIVE" | "REVOKED" | "FAILED" | "NOT_APPLICABLE";
  signedMapState: "PENDING" | "ROLLING" | "FINALIZED" | "INVALID" | "NOT_APPLICABLE";
  protectedOutputReady: boolean;
  transportOnlyWarning: boolean;
  rawInitSha256: string | null;
  rawInitByteLength: number;
  protectedFrameCount: number;
  channelAFrameCount: number;
  channelBFrameCount: number;
  expectedIdProvided: boolean;
  expectedIdSha256: string | null;
  identityAuthorityMode: "SERVER_OWNED_SIGNED_EXACT" | "TRANSPORT_SUPPORT_ONLY" | "TARGETED_EXPECTED_ID_SUPPORT_ONLY";
  segmentCount: number;
  totalBytes: number;
  totalDurationMs: number;
  nextSegmentSequence: number;
  nextDecodeTime: string | null;
  chainHeadSha256: string;
  initSha256: string | null;
  initByteLength: number;
  manifestId: string | null;
  manifestSha256: string | null;
  evidenceId: string | null;
  recordingSha256: string | null;
  recordingByteLength: number;
  startAttempt: { idempotencyKeyHash: string; requestDigest: string } | null;
  stopAttempt: { idempotencyKeyHash: string; requestDigest: string } | null;
  cleanupAttempt: { idempotencyKeyHash: string; requestDigest: string; planId: string } | null;
  stopReceipt: LiveProductStopReceipt | null;
  createdAt: string;
  readyAt: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
}

export interface LiveProductSegmentRecord {
  segmentId: string;
  sequence: number;
  durationMs: number;
  byteLength: number;
  sha256: string;
  previousChainSha256: string;
  chainSha256: string;
  idempotencyKeyHash: string;
  storageName: string;
  mfhdSequence: number;
  baseDecodeTime: string;
  trackTimelines: Array<{ trackId: number; baseDecodeTime: string; durationTicks: string; durationMs: number; sampleCount: number; sampleBytes: number }>;
  createdAt: string;
}

export interface LiveProductEvent {
  eventId: string;
  sessionId: string;
  type: string;
  at: string;
  details: Record<string, unknown>;
  previousEventSha256: string;
  eventSha256: string;
  supportOnly: true;
  ownership: false;
  vault: false;
  confirmed: false;
  final: false;
}

export interface LiveProductManifestRecord {
  manifestId: string;
  sha256: string;
  relativeUrl: string;
  createdAt: string;
}

export interface LiveProductRecordingRecord { recordingId: string; sha256: string; byteLength: number; relativeUrl: string; createdAt: string }
export interface LiveProductInitRecord { sha256: string; byteLength: number; codecs: string[]; tracks: LiveFmp4TrackInfo[]; idempotencyKeyHash: string; createdAt: string }

export class LiveProductError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: 400 | 401 | 404 | 409 | 413 | 422 | 500 | 503 | 507,
  ) {
    super(code);
    this.name = "LiveProductError";
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(file: string): { sha256: string; byteLength: number } {
  const digest = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const descriptor = fs.openSync(file, "r");
  let byteLength = 0;
  try {
    for (;;) {
      const read = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (read === 0) break;
      digest.update(buffer.subarray(0, read));
      byteLength += read;
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return { sha256: digest.digest("hex"), byteLength };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function pathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new LiveProductError("live_session_not_found", 404);
  }
}

function sanitizeEventDetails(value: Record<string, unknown>): Record<string, unknown> {
  const sensitive = /secret|token|authorization|cookie|password|credential|expected.?id|path/i;
  const walk = (input: unknown, depth: number): unknown => {
    if (depth > 4) return "[truncated]";
    if (input === null || typeof input === "boolean" || typeof input === "number") return input;
    if (typeof input === "string") return input.slice(0, 300);
    if (Array.isArray(input)) return input.slice(0, 20).map((item) => walk(item, depth + 1));
    if (typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .slice(0, 40)
          .map(([key, child]) => [key, sensitive.test(key) ? "[redacted]" : walk(child, depth + 1)]),
      );
    }
    return String(input).slice(0, 120);
  };
  return walk(value, 0) as Record<string, unknown>;
}

export class LiveProductStore {
  readonly storageRoot: string;
  private readonly tenantsRoot: string;
  readonly limits: { maxSessionBytes: number; maxSegments: number; maxDurationMs: number; maxTenantBytes: number; minFreeBytes: number };

  constructor(storageRoot = process.env[LIVE_LOCAL_STORAGE_ROOT_ENV]) {
    if (!storageRoot || !path.isAbsolute(storageRoot)) {
      throw new LiveProductError("live_storage_root_not_configured", 503);
    }
    this.storageRoot = path.resolve(storageRoot);
    this.assertNotBroadRoot();
    this.safeEnsureDirectory(this.storageRoot);
    this.assertSafeRoot();
    this.ensureRootMarkerAndLease();
    this.tenantsRoot = this.resolveManaged("tenants");
    this.safeEnsureDirectory(this.tenantsRoot);
    this.assertManagedPath(this.tenantsRoot);
    const limit = (name: string, fallback: number): number => {
      const value = Number(process.env[name] ?? fallback);
      if (!Number.isSafeInteger(value) || value < 1) throw new LiveProductError("live_storage_limit_invalid", 503);
      return value;
    };
    this.limits = {
      maxSessionBytes: limit("TANCMARK_LIVE_MAX_SESSION_BYTES", 2 * 1024 * 1024 * 1024),
      maxSegments: limit("TANCMARK_LIVE_MAX_SESSION_SEGMENTS", 10_000),
      maxDurationMs: limit("TANCMARK_LIVE_MAX_SESSION_DURATION_MS", 24 * 60 * 60 * 1000),
      maxTenantBytes: limit("TANCMARK_LIVE_MAX_TENANT_BYTES", 20 * 1024 * 1024 * 1024),
      minFreeBytes: limit("TANCMARK_LIVE_MIN_FREE_BYTES", 128 * 1024 * 1024),
    };
  }

  private assertNotBroadRoot(): void {
    const forbidden = [path.parse(this.storageRoot).root, path.resolve(process.cwd()), path.resolve(os.homedir())];
    if (forbidden.some((item) => samePath(item, this.storageRoot)) || path.dirname(this.storageRoot) === this.storageRoot) throw new LiveProductError("live_storage_root_too_broad", 503);
  }

  private safeEnsureDirectory(target: string): void {
    const absolute = path.resolve(target);
    const parsed = path.parse(absolute);
    let current = parsed.root;
    for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      let stat: fs.Stats | null = null;
      try { stat = fs.lstatSync(current); } catch (error) {
        if (!error || typeof error !== "object" || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (stat) {
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new LiveProductError("live_managed_path_reparse_rejected", 409);
        const real = fs.realpathSync.native(current);
        if (!samePath(real, current)) throw new LiveProductError("live_managed_path_reparse_rejected", 409);
      } else {
        fs.mkdirSync(current, { mode: 0o700 });
        const stat = fs.lstatSync(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new LiveProductError("live_managed_path_reparse_rejected", 409);
      }
    }
  }

  private ensureRootMarkerAndLease(): void {
    const marker = path.join(this.storageRoot, ROOT_MARKER);
    if (!fs.existsSync(marker)) fs.writeFileSync(marker, `${JSON.stringify({ schemaVersion: "tancmark-live-storage-root-v1" })}\n`, { flag: "wx", mode: 0o600 });
    try {
      const value = JSON.parse(fs.readFileSync(marker, "utf8")) as { schemaVersion?: unknown };
      if (value.schemaVersion !== "tancmark-live-storage-root-v1") throw new Error();
    } catch { throw new LiveProductError("live_storage_root_marker_invalid", 503); }
    try { acquireLiveProcessLease(this.storageRoot); } catch { throw new LiveProductError("live_storage_process_lease_held", 503); }
  }

  private assertSafeRoot(): void {
    const rootStat = fs.lstatSync(this.storageRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new LiveProductError("live_storage_root_unsafe", 503);
    }
    const real = fs.realpathSync.native(this.storageRoot);
    if (!samePath(real, this.storageRoot)) {
      throw new LiveProductError("live_storage_root_unsafe", 503);
    }
  }

  private resolveManaged(...parts: string[]): string {
    const candidate = path.resolve(this.storageRoot, ...parts);
    if (!pathInside(this.storageRoot, candidate)) {
      throw new LiveProductError("live_managed_path_invalid", 400);
    }
    return candidate;
  }

  private assertManagedPath(candidate: string, allowMissingLeaf = false): void {
    const resolved = path.resolve(candidate);
    if (!pathInside(this.storageRoot, resolved)) throw new LiveProductError("live_managed_path_invalid", 400);
    const relative = path.relative(this.storageRoot, resolved);
    let current = this.storageRoot;
    for (const part of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      if (!fs.existsSync(current)) {
        if (allowMissingLeaf) return;
        throw new LiveProductError("live_managed_path_missing", 404);
      }
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new LiveProductError("live_managed_path_reparse_rejected", 409);
    }
  }

  private tenantHash(tenantId: string): string {
    return sha256(`tenant\0${tenantId}`);
  }

  private tenantDir(tenantId: string): string {
    return this.resolveManaged("tenants", this.tenantHash(tenantId));
  }

  private sessionsDir(tenantId: string): string {
    return path.join(this.tenantDir(tenantId), "sessions");
  }

  private sessionDir(tenantId: string, sessionId: string): string {
    assertUuid(sessionId);
    return path.join(this.sessionsDir(tenantId), sessionId);
  }

  private sessionFile(tenantId: string, sessionId: string, name: string): string {
    if (!/^[a-z][a-z0-9.-]{0,63}$/.test(name)) throw new LiveProductError("live_managed_path_invalid", 400);
    return path.join(this.sessionDir(tenantId, sessionId), name);
  }

  private atomicJson(filePath: string, value: unknown): void {
    const parent = path.dirname(filePath);
    this.safeEnsureDirectory(parent);
    this.assertManagedPath(parent);
    const temporary = path.join(parent, `.tmp-${randomUUID()}.json`);
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    try {
      fs.renameSync(temporary, filePath);
    } finally {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
  }

  private readJson<T>(filePath: string): T {
    this.assertManagedPath(filePath);
    try {
      // codeql[js/path-injection] assertManagedPath confines the path to the server storage root and rejects every existing symlink/reparse component.
      return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
    } catch (error) {
      if (error instanceof LiveProductError) throw error;
      throw new LiveProductError("live_store_record_invalid", 500);
    }
  }

  private validateSessionRecord(session: LiveProductSession): LiveProductSession {
    const statuses = new Set<LiveProductSessionStatus>([
      "CREATED", "READY", "RUNNING", "STOPPING", "STOPPED", "FAILED", "CLEANUP_PENDING", "PURGED",
    ]);
    if (
      session.schemaVersion !== "tancmark-live-local-session-v1" ||
      typeof session.sessionId !== "string" ||
      typeof session.tenantId !== "string" ||
      !statuses.has(session.status) ||
      !Number.isSafeInteger(session.revision) || session.revision < 0 ||
      !Number.isSafeInteger(session.accessRevision) || session.accessRevision < 0 ||
      !Number.isSafeInteger(session.tokenEpoch) || session.tokenEpoch < 0 ||
      !Number.isSafeInteger(session.segmentCount) || session.segmentCount < 0 ||
      !Number.isSafeInteger(session.totalBytes) || session.totalBytes < 0 ||
      !Number.isSafeInteger(session.totalDurationMs) || session.totalDurationMs < 0 ||
      !Number.isSafeInteger(session.nextSegmentSequence) || session.nextSegmentSequence < 0 ||
      !/^[0-9a-f]{64}$/.test(session.chainHeadSha256)
    ) {
      throw new LiveProductError("live_store_record_invalid", 500);
    }
    return session;
  }

  createSession(input: {
    sessionId?: string;
    tenantId: string;
    accountId: string;
    legalHold?: boolean;
    protectionMode: LiveProtectionMode;
    bindingId?: string | null;
    serverOwnedExactIdHex?: string | null;
  }): LiveProductSession {
    const sessionId = input.sessionId ?? randomUUID();
    assertUuid(sessionId);
    const sessionDir = this.sessionDir(input.tenantId, sessionId);
    const mediaDir = path.join(sessionDir, "media");
    this.safeEnsureDirectory(path.join(mediaDir, "segments"));
    this.safeEnsureDirectory(path.join(sessionDir, "evidence"));
    this.safeEnsureDirectory(path.join(sessionDir, "private-ingest", "jobs"));
    this.assertManagedPath(mediaDir);
    const now = new Date().toISOString();
    const expected = typeof input.serverOwnedExactIdHex === "string" && input.serverOwnedExactIdHex.trim().length > 0
      ? input.serverOwnedExactIdHex.trim()
      : null;
    if (input.protectionMode === "PROTECTED_TANCMARK" && (!expected || !/^[0-9a-f]{64}$/.test(expected) || !input.bindingId)) {
      throw new LiveProductError("live_server_owned_identity_required", 503);
    }
    const created: LiveProductSession = {
      schemaVersion: "tancmark-live-local-session-v1",
      sessionId,
      tenantId: input.tenantId,
      status: "CREATED",
      revision: 0,
      accessRevision: 0,
      tokenEpoch: 0,
      legalHold: input.legalHold === true,
      protectionMode: input.protectionMode,
      bindingId: input.protectionMode === "PROTECTED_TANCMARK" ? input.bindingId ?? null : null,
      accountBindingSha256: sha256(`account\0${input.tenantId}\0${input.accountId}`),
      watermarkState: input.protectionMode === "PROTECTED_TANCMARK" ? "WATERMARK_PENDING" : "WATERMARK_DISABLED",
      watermarkWorkerHealth: input.protectionMode === "PROTECTED_TANCMARK" ? "NOT_STARTED" : "NOT_APPLICABLE",
      liveVerificationState: input.protectionMode === "PROTECTED_TANCMARK" ? "NOT_STARTED" : "NOT_APPLICABLE",
      finalVerificationState: input.protectionMode === "PROTECTED_TANCMARK" ? "NOT_STARTED" : "NOT_APPLICABLE",
      registryBindingState: input.protectionMode === "PROTECTED_TANCMARK" ? "PENDING" : "NOT_APPLICABLE",
      signedMapState: input.protectionMode === "PROTECTED_TANCMARK" ? "PENDING" : "NOT_APPLICABLE",
      protectedOutputReady: false,
      transportOnlyWarning: input.protectionMode === "TRANSPORT_ONLY",
      rawInitSha256: null,
      rawInitByteLength: 0,
      protectedFrameCount: 0,
      channelAFrameCount: 0,
      channelBFrameCount: 0,
      expectedIdProvided: false,
      expectedIdSha256: expected ? sha256(`expected-id\0${expected}`) : null,
      identityAuthorityMode: input.protectionMode === "PROTECTED_TANCMARK" ? "SERVER_OWNED_SIGNED_EXACT" : "TRANSPORT_SUPPORT_ONLY",
      segmentCount: 0,
      totalBytes: 0,
      totalDurationMs: 0,
      nextSegmentSequence: 0,
      nextDecodeTime: null,
      chainHeadSha256: sha256(`tancmark-live-chain-v1\0${sessionId}`),
      initSha256: null,
      initByteLength: 0,
      manifestId: null,
      manifestSha256: null,
      evidenceId: null,
      recordingSha256: null,
      recordingByteLength: 0,
      startAttempt: null,
      stopAttempt: null,
      cleanupAttempt: null,
      stopReceipt: null,
      createdAt: now,
      readyAt: null,
      startedAt: null,
      stoppedAt: null,
      updatedAt: now,
    };
    this.atomicJson(this.sessionFile(input.tenantId, sessionId, "session.json"), created);
    this.appendEvent(input.tenantId, sessionId, "session.created", { revision: 0 });
    return this.transitionSession(input.tenantId, sessionId, ["CREATED"], "READY", {
      readyAt: now,
    }, "session.ready", { protectionMode: input.protectionMode });
  }

  getSession(tenantId: string, sessionId: string): LiveProductSession | null {
    assertUuid(sessionId);
    const file = this.sessionFile(tenantId, sessionId, "session.json");
    // codeql[js/path-injection] sessionFile accepts a validated UUID, hashes the tenant, allowlists the leaf name, and resolves under the managed root.
    if (!fs.existsSync(file)) return null;
    const session = this.validateSessionRecord(this.readJson<LiveProductSession>(file));
    if (session.tenantId !== tenantId || session.sessionId !== sessionId) return null;
    return session;
  }

  requireSession(tenantId: string, sessionId: string): LiveProductSession {
    const session = this.getSession(tenantId, sessionId);
    if (!session) throw new LiveProductError("live_session_not_found", 404);
    return session;
  }

  listSessions(tenantId: string): LiveProductSession[] {
    const directory = this.sessionsDir(tenantId);
    if (!fs.existsSync(directory)) return [];
    this.assertManagedPath(directory);
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[0-9a-f-]{36}$/i.test(entry.name))
      .map((entry) => this.getSession(tenantId, entry.name))
      .filter((session): session is LiveProductSession => session !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  transitionSession(
    tenantId: string,
    sessionId: string,
    allowedFrom: readonly LiveProductSessionStatus[],
    nextStatus: LiveProductSessionStatus,
    patch: Partial<LiveProductSession> = {},
    eventType = "session.transition",
    eventDetails: Record<string, unknown> = {},
  ): LiveProductSession {
    const current = this.requireSession(tenantId, sessionId);
    if (!allowedFrom.includes(current.status)) {
      throw new LiveProductError("live_session_state_conflict", 409);
    }
    const updated: LiveProductSession = {
      ...current,
      ...patch,
      schemaVersion: "tancmark-live-local-session-v1",
      sessionId: current.sessionId,
      tenantId: current.tenantId,
      status: nextStatus,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.atomicJson(this.sessionFile(tenantId, sessionId, "session.json"), updated);
    this.appendEvent(tenantId, sessionId, eventType, {
      from: current.status,
      to: nextStatus,
      revision: updated.revision,
      ...eventDetails,
    });
    return updated;
  }

  private tenantBytes(tenantId: string): number {
    return this.listSessions(tenantId).reduce((sum, session) => sum + session.totalBytes + session.initByteLength + session.rawInitByteLength + session.recordingByteLength, 0);
  }

  private assertCapacity(tenantId: string, session: LiveProductSession, extraBytes: number, extraDurationMs = 0): void {
    if (session.totalBytes + session.initByteLength + session.rawInitByteLength + extraBytes > this.limits.maxSessionBytes || session.segmentCount + (extraDurationMs > 0 ? 1 : 0) > this.limits.maxSegments || session.totalDurationMs + extraDurationMs > this.limits.maxDurationMs || this.tenantBytes(tenantId) + extraBytes > this.limits.maxTenantBytes) {
      throw new LiveProductError("live_storage_quota_exceeded", 507);
    }
    const stat = fs.statfsSync(this.storageRoot);
    const free = Number(stat.bavail) * Number(stat.bsize);
    if (!Number.isFinite(free) || free - extraBytes < this.limits.minFreeBytes) throw new LiveProductError("live_storage_free_space_insufficient", 507);
  }

  uploadInit(input: { tenantId: string; sessionId: string; bytes: Buffer; suppliedSha256: string; idempotencyKey: string }): { record: LiveProductInitRecord; duplicate: boolean; session: LiveProductSession } {
    const session = this.requireSession(input.tenantId, input.sessionId);
    if (session.status !== "READY") throw new LiveProductError("live_init_state_conflict", 409);
    if (!/^[0-9a-f]{64}$/i.test(input.suppliedSha256) || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200) throw new LiveProductError("live_init_request_invalid", 400);
    const digest = sha256(input.bytes);
    if (digest !== input.suppliedSha256.toLowerCase()) throw new LiveProductError("live_init_hash_mismatch", 409);
    const keyHash = sha256(`init-key\0${input.idempotencyKey}`);
    const existing = session.protectionMode === "PROTECTED_TANCMARK"
      ? this.readPrivateJson<LiveProductInitRecord>(input.tenantId, input.sessionId, "raw-init.json")
      : this.readAuxiliaryJson<LiveProductInitRecord>(input.tenantId, input.sessionId, "init.json");
    if (existing) {
      if (existing.sha256 !== digest || existing.idempotencyKeyHash !== keyHash) throw new LiveProductError("live_init_idempotency_conflict", 409);
      return { record: existing, duplicate: true, session };
    }
    let info: ReturnType<typeof validateLiveFmp4Init>;
    try { info = validateLiveFmp4Init(input.bytes); } catch { throw new LiveProductError("live_init_fmp4_invalid", 400); }
    this.assertCapacity(input.tenantId, session, input.bytes.length);
    const file = session.protectionMode === "PROTECTED_TANCMARK"
      ? path.join(this.sessionDir(input.tenantId, input.sessionId), "private-ingest", "raw-init.mp4")
      : path.join(this.sessionDir(input.tenantId, input.sessionId), "media", "init.mp4");
    this.assertManagedPath(path.dirname(file));
    fs.writeFileSync(file, input.bytes, { flag: "wx", mode: 0o600 });
    const record: LiveProductInitRecord = { sha256: digest, byteLength: input.bytes.length, codecs: info.codecs, tracks: info.tracks, idempotencyKeyHash: keyHash, createdAt: new Date().toISOString() };
    if (session.protectionMode === "PROTECTED_TANCMARK") this.writePrivateJsonOnce(input.tenantId, input.sessionId, "raw-init.json", record);
    else this.atomicJson(this.sessionFile(input.tenantId, input.sessionId, "init.json"), record);
    const updated = this.transitionSession(input.tenantId, input.sessionId, ["READY"], "READY", session.protectionMode === "PROTECTED_TANCMARK"
      ? { rawInitSha256: digest, rawInitByteLength: input.bytes.length }
      : { initSha256: digest, initByteLength: input.bytes.length }, "init.uploaded", {
        sha256: digest,
        byteLength: input.bytes.length,
        codecs: info.codecs,
        privateIngestOnly: session.protectionMode === "PROTECTED_TANCMARK",
      });
    return { record, duplicate: false, session: updated };
  }

  readRawInit(tenantId: string, sessionId: string): { record: LiveProductInitRecord; bytes: Buffer } {
    const session = this.requireSession(tenantId, sessionId);
    if (session.protectionMode !== "PROTECTED_TANCMARK") return this.readInit(tenantId, sessionId);
    const record = this.readPrivateJson<LiveProductInitRecord>(tenantId, sessionId, "raw-init.json");
    if (!record) throw new LiveProductError("live_init_not_found", 404);
    const file = path.join(this.sessionDir(tenantId, sessionId), "private-ingest", "raw-init.mp4");
    this.assertManagedPath(file);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.byteLength || sha256(bytes) !== record.sha256) throw new LiveProductError("live_init_integrity_failed", 409);
    try { validateLiveFmp4Init(bytes); } catch { throw new LiveProductError("live_init_integrity_failed", 409); }
    return { record, bytes };
  }

  publishProtectedInit(input: { tenantId: string; sessionId: string; bytes: Buffer }): { record: LiveProductInitRecord; duplicate: boolean; session: LiveProductSession } {
    const session = this.requireSession(input.tenantId, input.sessionId);
    if (session.protectionMode !== "PROTECTED_TANCMARK" || session.status !== "RUNNING") throw new LiveProductError("live_protected_init_state_conflict", 409);
    let info: ReturnType<typeof validateLiveFmp4Init>;
    try { info = validateLiveFmp4Init(input.bytes); } catch { throw new LiveProductError("live_protected_init_invalid", 409); }
    const digest = sha256(input.bytes);
    const existing = this.readAuxiliaryJson<LiveProductInitRecord>(input.tenantId, input.sessionId, "init.json");
    if (existing) {
      if (existing.sha256 === digest && existing.byteLength === input.bytes.length && stableStringify(existing.codecs) === stableStringify(info.codecs) && stableStringify(existing.tracks) === stableStringify(info.tracks)) return { record: existing, duplicate: true, session };
      const authoritative = this.readInit(input.tenantId, input.sessionId);
      try {
        if (liveFmp4InitDecoderCompatibilitySha256(authoritative.bytes) === liveFmp4InitDecoderCompatibilitySha256(input.bytes)) {
          return { record: existing, duplicate: true, session };
        }
      } catch { /* incompatible remains fail-closed below */ }
      throw new LiveProductError("live_protected_init_changed", 409);
    }
    this.assertCapacity(input.tenantId, session, input.bytes.length);
    const file = path.join(this.sessionDir(input.tenantId, input.sessionId), "media", "init.mp4");
    this.assertManagedPath(path.dirname(file));
    fs.writeFileSync(file, input.bytes, { flag: "wx", mode: 0o600 });
    const record: LiveProductInitRecord = {
      sha256: digest,
      byteLength: input.bytes.length,
      codecs: info.codecs,
      tracks: info.tracks,
      idempotencyKeyHash: sha256(`protected-init\0${input.sessionId}`),
      createdAt: new Date().toISOString(),
    };
    this.atomicJson(this.sessionFile(input.tenantId, input.sessionId, "init.json"), record);
    const updated = this.transitionSession(input.tenantId, input.sessionId, ["RUNNING"], "RUNNING", {
      initSha256: digest,
      initByteLength: input.bytes.length,
      protectedOutputReady: true,
      watermarkState: "WATERMARK_ACTIVE",
      watermarkWorkerHealth: "HEALTHY",
    }, "protected-init.published", { sha256: digest, byteLength: input.bytes.length });
    return { record, duplicate: false, session: updated };
  }

  readInit(tenantId: string, sessionId: string): { record: LiveProductInitRecord; bytes: Buffer } {
    const record = this.readAuxiliaryJson<LiveProductInitRecord>(tenantId, sessionId, "init.json");
    if (!record) throw new LiveProductError("live_init_not_found", 404);
    const file = path.join(this.sessionDir(tenantId, sessionId), "media", "init.mp4");
    this.assertManagedPath(file);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.byteLength || sha256(bytes) !== record.sha256) throw new LiveProductError("live_init_integrity_failed", 409);
    try {
      const info = validateLiveFmp4Init(bytes);
      if (stableStringify(info.codecs) !== stableStringify(record.codecs) || stableStringify(info.tracks) !== stableStringify(record.tracks)) throw new Error("metadata_mismatch");
    } catch { throw new LiveProductError("live_init_integrity_failed", 409); }
    return { record, bytes };
  }

  appendSegment(input: {
    tenantId: string;
    sessionId: string;
    sequence: number;
    durationMs: number;
    bytes: Buffer;
    suppliedSha256: string;
    idempotencyKey: string;
  }): { segment: LiveProductSegmentRecord; duplicate: boolean; session: LiveProductSession } {
    return this.appendSegmentInternal(input);
  }

  /** Trusted sink used only after the lifecycle has produced worker output. */
  appendProtectedSegment(input: {
    tenantId: string;
    sessionId: string;
    sequence: number;
    durationMs: number;
    bytes: Buffer;
    suppliedSha256: string;
    idempotencyKey: string;
  }): { segment: LiveProductSegmentRecord; duplicate: boolean; session: LiveProductSession } {
    return this.appendSegmentInternal(input, PROTECTED_SEGMENT_WRITE_CAPABILITY);
  }

  private appendSegmentInternal(input: {
    tenantId: string;
    sessionId: string;
    sequence: number;
    durationMs: number;
    bytes: Buffer;
    suppliedSha256: string;
    idempotencyKey: string;
  }, capability?: symbol): { segment: LiveProductSegmentRecord; duplicate: boolean; session: LiveProductSession } {
    this.reconcileSegmentJournal(input.tenantId, input.sessionId);
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) throw new LiveProductError("live_segment_sequence_invalid", 400);
    if (!Number.isSafeInteger(input.durationMs) || input.durationMs < 1 || input.durationMs > 60_000) {
      throw new LiveProductError("live_segment_duration_invalid", 400);
    }
    if (!Buffer.isBuffer(input.bytes) || input.bytes.length === 0) throw new LiveProductError("live_segment_empty", 400);
    if (input.bytes.length > LIVE_LOCAL_MAX_SEGMENT_BYTES) throw new LiveProductError("live_segment_too_large", 413);
    if (!/^[0-9a-f]{64}$/i.test(input.suppliedSha256)) throw new LiveProductError("live_segment_hash_invalid", 400);
    if (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200) throw new LiveProductError("live_idempotency_key_invalid", 400);
    const actualSha256 = sha256(input.bytes);
    if (actualSha256 !== input.suppliedSha256.toLowerCase()) throw new LiveProductError("live_segment_hash_mismatch", 409);
    const keyHash = sha256(`segment-key\0${input.idempotencyKey}`);
    const session = this.requireSession(input.tenantId, input.sessionId);
    if (session.status !== "RUNNING") throw new LiveProductError("live_session_not_running", 409);
    if (session.protectionMode === "PROTECTED_TANCMARK" && capability !== PROTECTED_SEGMENT_WRITE_CAPABILITY) {
      throw new LiveProductError("live_protected_segment_worker_required", 409);
    }
    let fragment: ReturnType<typeof validateLiveFmp4Fragment>;
    try {
      const init = this.readInit(input.tenantId, input.sessionId);
      fragment = validateLiveFmp4Fragment(input.bytes, { codecs: init.record.codecs, byteLength: init.record.byteLength, tracks: init.record.tracks });
    } catch { throw new LiveProductError("live_segment_fmp4_invalid", 400); }
    const durationToleranceMs = Math.max(50, Math.ceil(fragment.durationMs * 0.1));
    if (Math.abs(input.durationMs - fragment.durationMs) > durationToleranceMs) throw new LiveProductError("live_segment_duration_mismatch", 409);
    const existing = this.listSegments(input.tenantId, input.sessionId).find((item) => item.sequence === input.sequence);
    if (existing) {
      if (existing.sha256 !== actualSha256 || existing.idempotencyKeyHash !== keyHash || existing.durationMs !== fragment.durationMs) {
        throw new LiveProductError("live_segment_idempotency_conflict", 409);
      }
      this.readSegment(input.tenantId, input.sessionId, existing.segmentId);
      return { segment: existing, duplicate: true, session };
    }
    if (input.sequence !== session.nextSegmentSequence) throw new LiveProductError("live_segment_sequence_conflict", 409);
    const prior = this.listSegments(input.tenantId, input.sessionId).at(-1);
    if (prior && fragment.mfhdSequence !== prior.mfhdSequence + 1) throw new LiveProductError("live_segment_timeline_conflict", 409);
    if (prior) {
      const priorTracks = new Map(prior.trackTimelines.map((item) => [item.trackId, item]));
      for (const track of fragment.tracks) {
        const priorTrack = priorTracks.get(track.trackId);
        if (!priorTrack || track.baseDecodeTime < BigInt(priorTrack.baseDecodeTime) + BigInt(priorTrack.durationTicks)) throw new LiveProductError("live_segment_timeline_conflict", 409);
      }
    }
    this.assertCapacity(input.tenantId, session, input.bytes.length, fragment.durationMs);

    const segmentId = randomUUID();
    const storageName = `segment-${String(input.sequence).padStart(8, "0")}-${segmentId}.m4s`;
    const segmentDir = path.join(this.sessionDir(input.tenantId, input.sessionId), "media", "segments");
    this.assertManagedPath(segmentDir);
    const target = path.join(segmentDir, storageName);
    const temporary = path.join(segmentDir, `.tmp-${randomUUID()}.segment`);
    const journalPath = this.sessionFile(input.tenantId, input.sessionId, "segment-journal.json");
    this.atomicJson(journalPath, { schemaVersion: "tancmark-live-segment-journal-v1", sequence: input.sequence, storageName, temporaryName: path.basename(temporary), sha256: actualSha256, byteLength: input.bytes.length });
    fs.writeFileSync(temporary, input.bytes, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, target);
    this.assertManagedPath(target);
    const chainSha256 = sha256(`${session.chainHeadSha256}\0${input.sequence}\0${actualSha256}\0${input.bytes.length}`);
    const segment: LiveProductSegmentRecord = {
      segmentId,
      sequence: input.sequence,
      durationMs: fragment.durationMs,
      byteLength: input.bytes.length,
      sha256: actualSha256,
      previousChainSha256: session.chainHeadSha256,
      chainSha256,
      idempotencyKeyHash: keyHash,
      storageName,
      mfhdSequence: fragment.mfhdSequence,
      baseDecodeTime: fragment.baseDecodeTime.toString(),
      trackTimelines: fragment.tracks.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime.toString(), durationTicks: track.durationTicks.toString(), durationMs: track.durationMs, sampleCount: track.sampleCount, sampleBytes: track.sampleBytes })),
      createdAt: new Date().toISOString(),
    };
    const segmentRecordPath = this.sessionFile(input.tenantId, input.sessionId, `segment-${String(input.sequence).padStart(8, "0")}.json`);
    let committed = false;
    try {
      this.atomicJson(segmentRecordPath, segment);
      const updated = this.transitionSession(input.tenantId, input.sessionId, ["RUNNING"], "RUNNING", {
        segmentCount: session.segmentCount + 1,
        totalBytes: session.totalBytes + input.bytes.length,
        totalDurationMs: session.totalDurationMs + fragment.durationMs,
        nextSegmentSequence: session.nextSegmentSequence + 1,
        nextDecodeTime: fragment.baseDecodeTime.toString(),
        chainHeadSha256: chainSha256,
      }, "segment.appended", { sequence: input.sequence, byteLength: input.bytes.length, sha256: actualSha256 });
      committed = true;
      fs.rmSync(journalPath, { force: true });
      try {
        this.refreshRunningManifest(input.tenantId, input.sessionId);
      } catch (error) {
        this.transitionSession(input.tenantId, input.sessionId, ["RUNNING"], "FAILED", {}, "manifest.refresh.failed", {
          reason: error instanceof LiveProductError ? error.code : "internal_error",
        });
        throw error;
      }
      return { segment, duplicate: false, session: updated };
    } catch (error) {
      if (!committed) {
        if (fs.existsSync(target)) fs.rmSync(target, { force: true });
        if (fs.existsSync(segmentRecordPath)) fs.rmSync(segmentRecordPath, { force: true });
        if (fs.existsSync(journalPath)) fs.rmSync(journalPath, { force: true });
      }
      throw error;
    }
  }

  listSegments(tenantId: string, sessionId: string): LiveProductSegmentRecord[] {
    const directory = this.sessionDir(tenantId, sessionId);
    if (!fs.existsSync(directory)) return [];
    this.assertManagedPath(directory);
    return fs.readdirSync(directory)
      .filter((name) => /^segment-\d{8}\.json$/.test(name))
      .map((name) => this.readJson<LiveProductSegmentRecord>(path.join(directory, name)))
      .sort((left, right) => left.sequence - right.sequence);
  }

  appendEvent(tenantId: string, sessionId: string, type: string, details: Record<string, unknown> = {}): LiveProductEvent {
    const prior = this.listEvents(tenantId, sessionId);
    const previousEventSha256 = prior.at(-1)?.eventSha256 ?? sha256(`tancmark-live-events-v1\0${sessionId}`);
    const unsigned = {
      eventId: randomUUID(),
      sessionId,
      type: type.slice(0, 100),
      at: new Date().toISOString(),
      details: sanitizeEventDetails(details),
      previousEventSha256,
      supportOnly: true,
      ownership: false,
      vault: false,
      confirmed: false,
      final: false,
    };
    const event: LiveProductEvent = { ...unsigned, supportOnly: true, ownership: false, vault: false, confirmed: false, final: false, eventSha256: sha256(stableStringify(unsigned)) };
    const file = this.sessionFile(tenantId, sessionId, "events.ndjson");
    const parent = path.dirname(file);
    this.assertManagedPath(parent);
    fs.appendFileSync(file, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
    return event;
  }

  listEvents(tenantId: string, sessionId: string): LiveProductEvent[] {
    this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, "events.ndjson");
    if (!fs.existsSync(file)) return [];
    this.assertManagedPath(file);
    const events = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as LiveProductEvent);
    let previous = sha256(`tancmark-live-events-v1\0${sessionId}`);
    for (const event of events) {
      const { eventSha256, ...unsigned } = event;
      if (event.previousEventSha256 !== previous || eventSha256 !== sha256(stableStringify(unsigned))) throw new LiveProductError("live_event_chain_integrity_failed", 409);
      previous = eventSha256;
    }
    return events;
  }

  private manifestText(segments: readonly LiveProductSegmentRecord[], endList: boolean): string {
    const targetDuration = Math.max(1, Math.ceil(Math.max(...segments.map((segment) => segment.durationMs), 1000) / 1000));
    const partTarget = Math.max(0.1, Math.max(...segments.map((segment) => segment.durationMs), 100) / 1000);
    const partHoldBack = Math.max(0.3, partTarget * 3);
    const lines = [
      "#EXTM3U",
      "#EXT-X-VERSION:9",
      `#EXT-X-TARGETDURATION:${targetDuration}`,
      "#EXT-X-MEDIA-SEQUENCE:0",
      `#EXT-X-PART-INF:PART-TARGET=${partTarget.toFixed(3)}`,
      `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=${partHoldBack.toFixed(3)}`,
      ...(endList ? ["#EXT-X-PLAYLIST-TYPE:VOD"] : []),
      '#EXT-X-MAP:URI="init.mp4"',
    ];
    for (const [index, segment] of segments.entries()) {
      lines.push(`#EXT-X-PART:DURATION=${(segment.durationMs / 1000).toFixed(3)},URI="segments/${segment.segmentId}"`);
      if (endList || index < segments.length - 1) {
        lines.push(`#EXTINF:${(segment.durationMs / 1000).toFixed(3)},`);
        lines.push(`segments/${segment.segmentId}`);
      }
    }
    if (endList) lines.push("#EXT-X-ENDLIST");
    lines.push("");
    return lines.join("\n");
  }

  private refreshRunningManifest(tenantId: string, sessionId: string): void {
    const segments = this.listSegments(tenantId, sessionId);
    if (segments.length === 0) return;
    const mediaDir = path.join(this.sessionDir(tenantId, sessionId), "media");
    this.assertManagedPath(mediaDir);
    fs.writeFileSync(path.join(mediaDir, "manifest.m3u8"), this.manifestText(segments, false), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  finalizeManifest(tenantId: string, sessionId: string): LiveProductManifestRecord {
    const session = this.requireSession(tenantId, sessionId);
    if (session.status !== "STOPPING") throw new LiveProductError("live_manifest_state_conflict", 409);
    const segments = this.listSegments(tenantId, sessionId);
    if (segments.length === 0) throw new LiveProductError("live_manifest_has_no_segments", 409);
    this.readInit(tenantId, sessionId);
    const text = this.manifestText(segments, true);
    const existing = this.readAuxiliaryJson<LiveProductManifestRecord>(tenantId, sessionId, "manifest.json");
    if (existing) {
      const stored = this.readManifest(tenantId, sessionId);
      if (existing.sha256 !== sha256(text) || sha256(stored) !== existing.sha256) throw new LiveProductError("live_manifest_integrity_failed", 409);
      return existing;
    }
    const manifestId = `manifest-${sha256(text).slice(0, 32)}`;
    const mediaDir = path.join(this.sessionDir(tenantId, sessionId), "media");
    this.assertManagedPath(mediaDir);
    const manifestPath = path.join(mediaDir, "manifest.m3u8");
    fs.writeFileSync(manifestPath, text, { encoding: "utf8", mode: 0o600 });
    const record: LiveProductManifestRecord = {
      manifestId,
      sha256: sha256(text),
      relativeUrl: `/api/tancmark/live/local/v1/playback/${sessionId}/manifest.m3u8`,
      createdAt: new Date().toISOString(),
    };
    this.atomicJson(this.sessionFile(tenantId, sessionId, "manifest.json"), record);
    this.transitionSession(tenantId, sessionId, ["STOPPING"], "STOPPING", {
      manifestId,
      manifestSha256: record.sha256,
    }, "manifest.finalized", { manifestId, sha256: record.sha256, segmentCount: segments.length });
    return record;
  }

  readManifest(tenantId: string, sessionId: string): string {
    this.requireSession(tenantId, sessionId);
    const file = path.join(this.sessionDir(tenantId, sessionId), "media", "manifest.m3u8");
    this.assertManagedPath(file);
    return fs.readFileSync(file, "utf8");
  }

  finalizeRecording(tenantId: string, sessionId: string): LiveProductRecordingRecord {
    const session = this.requireSession(tenantId, sessionId);
    if (session.status !== "STOPPING") throw new LiveProductError("live_recording_state_conflict", 409);
    const init = this.readInit(tenantId, sessionId);
    const segments = this.listSegments(tenantId, sessionId);
    if (segments.length === 0) throw new LiveProductError("live_recording_has_no_segments", 409);
    const expectedByteLength = init.record.byteLength + segments.reduce((sum, segment) => sum + segment.byteLength, 0);
    const expectedHasher = createHash("sha256");
    expectedHasher.update(init.bytes);
    for (const segment of segments) expectedHasher.update(this.readSegment(tenantId, sessionId, segment.segmentId).bytes);
    const expectedSha256 = expectedHasher.digest("hex");
    const existing = this.readAuxiliaryJson<LiveProductRecordingRecord>(tenantId, sessionId, "recording.json");
    if (existing) {
      const file = path.join(this.sessionDir(tenantId, sessionId), "media", "recording.mp4");
      this.assertManagedPath(file);
      const actual = sha256File(file);
      if (existing.byteLength !== expectedByteLength || existing.sha256 !== expectedSha256 || actual.byteLength !== existing.byteLength || actual.sha256 !== existing.sha256) throw new LiveProductError("live_recording_integrity_failed", 409);
      return existing;
    }
    const file = path.join(this.sessionDir(tenantId, sessionId), "media", "recording.mp4");
    this.assertManagedPath(path.dirname(file));
    let actual: { sha256: string; byteLength: number } | null = null;
    if (fs.existsSync(file)) {
      this.assertManagedPath(file);
      actual = sha256File(file);
      if (actual.byteLength !== expectedByteLength || actual.sha256 !== expectedSha256) throw new LiveProductError("live_recording_integrity_failed", 409);
    } else {
      const partial = path.join(path.dirname(file), ".recording.mp4.partial");
      if (fs.existsSync(partial)) {
        this.assertManagedPath(partial);
        const prior = sha256File(partial);
        if (prior.byteLength === expectedByteLength && prior.sha256 === expectedSha256) {
          fs.renameSync(partial, file);
          actual = prior;
        } else {
          fs.rmSync(partial, { force: true });
        }
      }
      if (!actual) {
        // The finalized VOD is an additional on-disk copy of init + fragments,
        // so both session/tenant quotas and the free-space reserve include it.
        this.assertCapacity(tenantId, session, expectedByteLength);
        const descriptor = fs.openSync(partial, "wx", 0o600);
        const digest = createHash("sha256");
        let byteLength = 0;
        const append = (bytes: Buffer): void => {
          for (let offset = 0; offset < bytes.length;) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
          digest.update(bytes);
          byteLength += bytes.length;
        };
        try {
          append(init.bytes);
          for (const segment of segments) append(this.readSegment(tenantId, sessionId, segment.segmentId).bytes);
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }
        actual = { sha256: digest.digest("hex"), byteLength };
        if (actual.byteLength !== expectedByteLength || actual.sha256 !== expectedSha256) throw new LiveProductError("live_recording_integrity_failed", 409);
        fs.renameSync(partial, file);
      }
    }
    if (!actual) throw new LiveProductError("live_recording_integrity_failed", 409);
    const record: LiveProductRecordingRecord = { recordingId: `recording-${actual.sha256.slice(0, 32)}`, sha256: actual.sha256, byteLength: actual.byteLength, relativeUrl: `/api/tancmark/live/local/v1/playback/${sessionId}/recording.mp4`, createdAt: new Date().toISOString() };
    this.atomicJson(this.sessionFile(tenantId, sessionId, "recording.json"), record);
    this.transitionSession(tenantId, sessionId, ["STOPPING"], "STOPPING", { recordingSha256: actual.sha256, recordingByteLength: actual.byteLength }, "recording.finalized", { recordingId: record.recordingId, sha256: actual.sha256, byteLength: actual.byteLength });
    return record;
  }

  readRecording(tenantId: string, sessionId: string): { record: LiveProductRecordingRecord; bytes: Buffer } {
    const record = this.readAuxiliaryJson<LiveProductRecordingRecord>(tenantId, sessionId, "recording.json");
    if (!record) throw new LiveProductError("live_recording_not_found", 404);
    const file = path.join(this.sessionDir(tenantId, sessionId), "media", "recording.mp4");
    this.assertManagedPath(file);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.byteLength || sha256(bytes) !== record.sha256) throw new LiveProductError("live_recording_integrity_failed", 409);
    return { record, bytes };
  }

  protectedRecordingPathAndWorkDir(tenantId: string, sessionId: string): { videoPath: string; workDir: string } {
    this.readRecording(tenantId, sessionId);
    const session = this.requireSession(tenantId, sessionId);
    if (session.status !== "STOPPING" && session.status !== "STOPPED") throw new LiveProductError("live_protected_verify_requires_stopped", 409);
    const videoPath = path.join(this.sessionDir(tenantId, sessionId), "media", "recording.mp4");
    const workDir = path.join(this.sessionDir(tenantId, sessionId), "protected-exact-verify-work");
    this.safeEnsureDirectory(workDir);
    this.assertManagedPath(videoPath);
    this.assertManagedPath(workDir);
    return { videoPath, workDir };
  }

  readSegment(tenantId: string, sessionId: string, segmentId: string): { record: LiveProductSegmentRecord; bytes: Buffer } {
    if (!/^[0-9a-f-]{36}$/i.test(segmentId)) throw new LiveProductError("live_segment_not_found", 404);
    const record = this.listSegments(tenantId, sessionId).find((segment) => segment.segmentId === segmentId);
    if (!record) throw new LiveProductError("live_segment_not_found", 404);
    const file = path.join(this.sessionDir(tenantId, sessionId), "media", "segments", record.storageName);
    this.assertManagedPath(file);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.byteLength || sha256(bytes) !== record.sha256) {
      throw new LiveProductError("live_segment_integrity_failed", 409);
    }
    return { record, bytes };
  }

  reconcileSegmentJournal(tenantId: string, sessionId: string): "NONE" | "ROLLED_BACK" | "COMMITTED" {
    const session = this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, "segment-journal.json");
    if (!fs.existsSync(file)) return "NONE";
    type Journal = { schemaVersion: string; sequence: number; storageName: string; temporaryName: string; sha256: string; byteLength: number };
    const journal = this.readJson<Journal>(file);
    if (journal.schemaVersion !== "tancmark-live-segment-journal-v1" || !Number.isSafeInteger(journal.sequence) || !/^segment-\d{8}-[0-9a-f-]{36}\.m4s$/i.test(journal.storageName) || !/^\.tmp-[0-9a-f-]{36}\.segment$/i.test(journal.temporaryName) || !/^[0-9a-f]{64}$/.test(journal.sha256)) throw new LiveProductError("live_segment_journal_invalid", 409);
    const directory = path.join(this.sessionDir(tenantId, sessionId), "media", "segments");
    const target = path.join(directory, journal.storageName); const temporary = path.join(directory, journal.temporaryName);
    this.assertManagedPath(directory);
    const recordFile = this.sessionFile(tenantId, sessionId, `segment-${String(journal.sequence).padStart(8, "0")}.json`);
    if (!fs.existsSync(recordFile)) {
      for (const candidate of [target, temporary]) if (fs.existsSync(candidate)) { this.assertManagedPath(candidate); fs.rmSync(candidate, { force: true }); }
      fs.rmSync(file, { force: true });
      this.appendEvent(tenantId, sessionId, "segment.journal.rolled-back", { sequence: journal.sequence });
      return "ROLLED_BACK";
    }
    const record = this.readJson<LiveProductSegmentRecord>(recordFile);
    if (!fs.existsSync(target) || sha256(fs.readFileSync(target)) !== record.sha256 || record.sha256 !== journal.sha256) throw new LiveProductError("live_segment_journal_integrity_failed", 409);
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    fs.rmSync(file, { force: true });
    if (session.nextSegmentSequence <= record.sequence) {
      const all = this.listSegments(tenantId, sessionId);
      const last = all.at(-1) as LiveProductSegmentRecord;
      this.transitionSession(tenantId, sessionId, [session.status], session.status, { segmentCount: all.length, totalBytes: all.reduce((n, x) => n + x.byteLength, 0), totalDurationMs: all.reduce((n, x) => n + x.durationMs, 0), nextSegmentSequence: last.sequence + 1, nextDecodeTime: last.baseDecodeTime, chainHeadSha256: last.chainSha256 }, "segment.journal.committed", { sequence: journal.sequence });
    } else this.appendEvent(tenantId, sessionId, "segment.journal.committed", { sequence: journal.sequence });
    return "COMMITTED";
  }

  writeEvidence<T extends { evidenceId: string }>(tenantId: string, sessionId: string, evidence: T): T {
    this.requireSession(tenantId, sessionId);
    const file = path.join(this.sessionDir(tenantId, sessionId), "evidence", "evidence.json");
    this.atomicJson(file, evidence);
    return evidence;
  }

  readEvidence<T>(tenantId: string, sessionId: string): T | null {
    this.requireSession(tenantId, sessionId);
    const file = path.join(this.sessionDir(tenantId, sessionId), "evidence", "evidence.json");
    return fs.existsSync(file) ? this.readJson<T>(file) : null;
  }

  private privateJsonName(name: string): string {
    if (!/^(?:raw-init|seal-binding|rolling-map|rolling-final|signed-map|registry-row|final-verification|final-performance|sample-verification|raw-idempotency)\.json$/.test(name)) {
      throw new LiveProductError("live_private_record_name_invalid", 400);
    }
    return name;
  }

  writePrivateJsonOnce<T>(tenantId: string, sessionId: string, name: string, value: T): T {
    this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, this.privateJsonName(name));
    if (fs.existsSync(file)) throw new LiveProductError("live_private_record_already_exists", 409);
    this.atomicJson(file, value);
    return value;
  }

  mutatePrivateJson<T>(tenantId: string, sessionId: string, name: string, fallback: T, mutate: (current: T) => T): T {
    this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, this.privateJsonName(name));
    const current = fs.existsSync(file) ? this.readJson<T>(file) : fallback;
    const updated = mutate(current);
    this.atomicJson(file, updated);
    return updated;
  }

  readPrivateJson<T>(tenantId: string, sessionId: string, name: string): T | null {
    this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, this.privateJsonName(name));
    return fs.existsSync(file) ? this.readJson<T>(file) : null;
  }

  createWatermarkJobPath(tenantId: string, sessionId: string): string {
    this.requireSession(tenantId, sessionId);
    // Keep transient Python paths short on Windows while retaining explicit
    // tenant/session scoping. The authoritative raw ingest remains inside the
    // session tree; this directory contains only per-fragment working copies.
    const jobs = this.resolveManaged("watermark-jobs", sha256(tenantId).slice(0, 16), sessionId);
    this.safeEnsureDirectory(jobs);
    this.assertManagedPath(jobs);
    const stat = fs.lstatSync(jobs);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new LiveProductError("live_watermark_job_path_invalid", 409);
    const candidate = path.join(jobs, `watermark-job-${randomUUID()}`);
    if (process.platform === "win32" && candidate.length > 220) throw new LiveProductError("live_watermark_job_path_too_long", 503);
    return candidate;
  }

  removePrivateIngestMedia(tenantId: string, sessionId: string): void {
    this.requireSession(tenantId, sessionId);
    const privateIngest = path.join(this.sessionDir(tenantId, sessionId), "private-ingest");
    this.assertManagedPath(privateIngest);
    if (!fs.existsSync(privateIngest)) return;
    const stat = fs.lstatSync(privateIngest);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new LiveProductError("live_private_ingest_path_invalid", 409);
    fs.rmSync(privateIngest, { recursive: true, force: true });
  }

  mutateAuxiliaryJson<T>(
    tenantId: string,
    sessionId: string,
    name: "access.json" | "cleanup-plan.json" | "init.json" | "recording.json" | "start-receipt.json" | "cleanup-receipt.json" | "segment-journal.json" | "manifest.json",
    fallback: T,
    mutate: (current: T) => T,
  ): T {
    this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, name);
    const current = fs.existsSync(file) ? this.readJson<T>(file) : fallback;
    const updated = mutate(current);
    this.atomicJson(file, updated);
    return updated;
  }

  readAuxiliaryJson<T>(tenantId: string, sessionId: string, name: "access.json" | "cleanup-plan.json" | "init.json" | "recording.json" | "start-receipt.json" | "cleanup-receipt.json" | "segment-journal.json" | "manifest.json"): T | null {
    this.requireSession(tenantId, sessionId);
    const file = this.sessionFile(tenantId, sessionId, name);
    return fs.existsSync(file) ? this.readJson<T>(file) : null;
  }

  mutateGlobalAccessIndex<T>(fallback: T, mutate: (current: T) => T): T {
    const file = this.resolveManaged("access-index.json");
    const current = fs.existsSync(file) ? this.readJson<T>(file) : fallback;
    const updated = mutate(current);
    this.atomicJson(file, updated);
    return updated;
  }

  readGlobalAccessIndex<T>(): T | null {
    const file = this.resolveManaged("access-index.json");
    return fs.existsSync(file) ? this.readJson<T>(file) : null;
  }

  purgeManagedMedia(tenantId: string, sessionId: string): void {
    this.requireSession(tenantId, sessionId);
    const mediaDir = path.join(this.sessionDir(tenantId, sessionId), "media");
    if (!fs.existsSync(mediaDir)) return;
    this.assertManagedPath(mediaDir);
    const inspect = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        const stat = fs.lstatSync(child);
        if (stat.isSymbolicLink()) throw new LiveProductError("live_cleanup_reparse_rejected", 409);
        if (stat.isDirectory()) inspect(child);
      }
    };
    inspect(mediaDir);
    fs.rmSync(mediaDir, { recursive: true, force: false });
  }

  mediaInventory(tenantId: string, sessionId: string): { fileCount: number; totalBytes: number; artifacts: Array<{ relativePath: string; byteLength: number; sha256: string }> } {
    this.requireSession(tenantId, sessionId);
    const mediaDir = path.join(this.sessionDir(tenantId, sessionId), "media");
    if (!fs.existsSync(mediaDir)) return { fileCount: 0, totalBytes: 0, artifacts: [] };
    this.assertManagedPath(mediaDir);
    const artifacts: Array<{ relativePath: string; byteLength: number; sha256: string }> = [];
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        const stat = fs.lstatSync(child);
        if (stat.isSymbolicLink()) throw new LiveProductError("live_cleanup_reparse_rejected", 409);
        if (stat.isDirectory()) visit(child);
        else if (stat.isFile()) {
          const relativePath = path.relative(mediaDir, child).split(path.sep).join("/");
          if (!relativePath || relativePath.startsWith("../")) throw new LiveProductError("live_managed_path_invalid", 400);
          const bytes = fs.readFileSync(child);
          artifacts.push({ relativePath, byteLength: bytes.length, sha256: sha256(bytes) });
        }
      }
    };
    visit(mediaDir);
    artifacts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return { fileCount: artifacts.length, totalBytes: artifacts.reduce((sum, item) => sum + item.byteLength, 0), artifacts };
  }

  storageStatus(): Record<string, unknown> {
    try {
      this.assertSafeRoot();
      const marker = path.join(this.storageRoot, ROOT_MARKER);
      const stat = fs.statfsSync(this.storageRoot);
      const probe = path.join(this.storageRoot, `.write-probe-${randomUUID()}`);
      fs.writeFileSync(probe, "ok", { flag: "wx", mode: 0o600 });
      fs.rmSync(probe, { force: true });
      return { initialized: fs.existsSync(marker), writable: true, leaseHeldByThisProcess: liveProcessLeaseHeldByThisProcess(this.storageRoot), leaseAuthority: "SQLITE_OS_EXCLUSIVE_LOCK", freeBytes: Number(stat.bavail) * Number(stat.bsize), limits: this.limits, externalNetworkCalls: 0, externalProcesses: 0 };
    } catch {
      return { initialized: false, writable: false, leaseHeldByThisProcess: false, freeBytes: null, limits: this.limits, externalNetworkCalls: 0, externalProcesses: 0 };
    }
  }

  validateSessionHealth(tenantId: string, sessionId: string): Record<string, unknown> {
    const journalRecovery = this.reconcileSegmentJournal(tenantId, sessionId);
    const session = this.requireSession(tenantId, sessionId);
    const segments = this.listSegments(tenantId, sessionId);
    let initInfo: ReturnType<typeof validateLiveFmp4Init> | null = null;
    const initValid = session.status === "CREATED" ? false : (() => { try { const init = this.readInit(tenantId, sessionId); initInfo = validateLiveFmp4Init(init.bytes); return true; } catch { return false; } })();
    let chain = sha256(`tancmark-live-chain-v1\0${sessionId}`);
    let timeline = -1n;
    let segmentHashesValid = true;
    for (const segment of segments) {
      try {
        const read = this.readSegment(tenantId, sessionId, segment.segmentId);
        if (!initInfo) throw new Error("init_invalid");
        const parsed = validateLiveFmp4Fragment(read.bytes, initInfo);
        const expected = sha256(`${chain}\0${segment.sequence}\0${segment.sha256}\0${segment.byteLength}`);
        if (segment.previousChainSha256 !== chain || segment.chainSha256 !== expected || parsed.baseDecodeTime <= timeline || parsed.mfhdSequence !== segment.mfhdSequence || stableStringify(parsed.tracks.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime.toString(), durationTicks: track.durationTicks.toString(), durationMs: track.durationMs, sampleCount: track.sampleCount, sampleBytes: track.sampleBytes }))) !== stableStringify(segment.trackTimelines)) segmentHashesValid = false;
        chain = segment.chainSha256;
        timeline = parsed.baseDecodeTime;
      } catch { segmentHashesValid = false; }
    }
    let eventsValid = true;
    try { this.listEvents(tenantId, sessionId); } catch { eventsValid = false; }
    let manifestValid = session.manifestSha256 === null;
    if (session.manifestSha256) try { manifestValid = sha256(this.readManifest(tenantId, sessionId)) === session.manifestSha256; } catch { manifestValid = false; }
    let recordingValid = session.recordingSha256 === null;
    if (session.recordingSha256) try { recordingValid = this.readRecording(tenantId, sessionId).record.sha256 === session.recordingSha256; } catch { recordingValid = false; }
    const valid = initValid && segmentHashesValid && eventsValid && manifestValid && recordingValid && segments.length === session.segmentCount && chain === session.chainHeadSha256;
    return { valid, journalRecovery, initValid, segmentHashesValid, eventsValid, manifestValid, recordingValid, segmentCountMatches: segments.length === session.segmentCount, chainMatches: chain === session.chainHeadSha256, supportOnly: true, ownership: false, vault: false, confirmed: false, final: false };
  }

  sessionMetrics(tenantId: string, sessionId: string): Record<string, unknown> {
    const session = this.requireSession(tenantId, sessionId);
    return {
      sessionId,
      status: session.status,
      revision: session.revision,
      segmentCount: session.segmentCount,
      totalBytes: session.totalBytes,
      chainHeadSha256: session.chainHeadSha256,
      eventCount: this.listEvents(tenantId, sessionId).length,
      externalNetworkCalls: 0,
      externalProcesses: 0,
      supportOnly: true,
      ownership: false,
      vault: false,
      confirmed: false,
      final: false,
    };
  }

  static sha256(value: string | Buffer): string {
    return sha256(value);
  }

  static stableDigest(value: unknown): string {
    return sha256(stableStringify(value));
  }
}
