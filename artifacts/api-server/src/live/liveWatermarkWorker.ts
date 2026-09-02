import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { decodePngL1L3, normalizeId, payload4, scoreFrameForStamping, stampPngL1L3 } from "../video/aegisCore";
import { stampChannelBPng } from "../video/channelB";
import { buildA5StrongL1ByteMatchMask, decideFrameEvidence } from "../video/frameEvidenceDecision";
import { validateLiveFmp4Fragment, validateLiveFmp4Init, type LiveFmp4FragmentInfo } from "./liveFmp4Validator";
import { restoreProtectedFragmentTimeline } from "./liveProtectedFragmentTimeline";
import { LiveProductError, LiveProductStore } from "./liveProductStore";

export const LIVE_WATERMARK_PYTHON_ENV = "TANCMARK_LIVE_WATERMARK_PYTHON" as const;
export const LIVE_WATERMARK_WORKER_SCRIPT_ENV = "TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT" as const;
export const LIVE_WATERMARK_ADAPTER_C_SCRIPT_ENV = "TANCMARK_LIVE_ADAPTER_C_SCRIPT" as const;
/** Generic L3 uses four 8x8 blocks at center +/-100. Full in-bounds coverage
 * therefore requires both raster dimensions to be at least 208 pixels. */
export const LIVE_MIN_FULL_CARRIER_DIMENSION = 208 as const;

interface WorkerResponse {
  requestId: string;
  status: string;
  errorCode?: string;
  pid?: number;
  pyav?: string;
  numpy?: string;
  frameCount?: number;
  width?: number;
  height?: number;
  candidateCount?: number;
  frames?: Array<{ frameIdx: number; pts: string; timeBase: string; duration: number | null; selectionScore?: number; pngPath?: string | null }>;
  decodedThroughCount?: number;
  protectedInit?: string;
  protectedFragment?: string;
  wallMs?: number;
  adapterReceipt?: Record<string, unknown>;
  stageMetrics?: {
    adapterEncodeWallMs?: number;
    remuxWallMs?: number;
    splitWallMs?: number;
    codecValidationWallMs?: number;
  };
  processMetrics?: {
    processCpuSeconds?: number;
    workingSetBytes?: number | null;
    peakWorkingSetBytes?: number | null;
  };
}

export interface LiveProtectedFragmentResult {
  protectedInit: Buffer;
  protectedFragment: Buffer;
  frameCount: number;
  channelAFrameIdxs: number[];
  channelBFrameIdxs: number[];
  framePts: Array<{ ordinal: number; pts: string; timeBase: string }>;
  sourceTrackTimelines: Array<{ trackId: number; baseDecodeTime: string; durationTicks: string; sampleCount: number }>;
  outputTrackTimelines: Array<{ trackId: number; baseDecodeTime: string; durationTicks: string; sampleCount: number }>;
  receipt: {
    schemaVersion: "tancmark-live-protected-fragment-receipt-v1";
    sequence: number;
    sourceSha256: string;
    protectedSha256: string;
    protectedInitSha256: string;
    sourceFrameCount: number;
    outputFrameCount: number;
    channelAFrameIdxs: number[];
    channelBFrameIdxs: number[];
    workerPid: number;
    workerGeneration: number;
    queueDepthAtSubmit: number;
    prepareWallMs: number;
    stampingWallMs: number;
    adapterWallMs: number;
    adapterEncodeWallMs: number;
    remuxWallMs: number;
    splitWallMs: number;
    codecValidationWallMs: number;
    workerCpuSeconds: number;
    workerWorkingSetBytes: number | null;
    workerPeakWorkingSetBytes: number | null;
    totalWallMs: number;
    createdAt: string;
  };
}

export interface LiveProtectedSampleVerificationResult {
  schemaVersion: "tancmark-live-protected-sample-verification-v1";
  sequence: number;
  verdict: "EXACT_VERIFIED" | "PARTIAL" | "NOT_FOUND";
  physicalFrameExact: boolean;
  locatorMatched: boolean;
  strongL1ByteMatches: number;
  frameOrdinal: number;
  workerGeneration: number;
  wallMs: number;
  verifiedAt: string;
  rawIdDisclosed: false;
}

interface WorkerConfig {
  python: string;
  workerScript: string;
  adapterCScript: string;
  timeoutMs: number;
  maxQueue: number;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeAbsoluteFile(value: string | undefined, code: string): string {
  if (!value || !path.isAbsolute(value)) throw new LiveProductError(code, 503);
  const resolved = path.resolve(value);
  let stat: fs.Stats;
  try { stat = fs.lstatSync(resolved); } catch { throw new LiveProductError(code, 503); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new LiveProductError(code, 503);
  return resolved;
}

function config(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const timeoutMs = Number(env["TANCMARK_LIVE_WATERMARK_TIMEOUT_MS"] ?? 120_000);
  const maxQueue = Number(env["TANCMARK_LIVE_WATERMARK_MAX_QUEUE"] ?? 2);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 5_000 || timeoutMs > 600_000 || !Number.isSafeInteger(maxQueue) || maxQueue < 1 || maxQueue > 16) {
    throw new LiveProductError("live_watermark_worker_config_invalid", 503);
  }
  return {
    python: safeAbsoluteFile(env[LIVE_WATERMARK_PYTHON_ENV], "live_watermark_python_not_configured"),
    workerScript: safeAbsoluteFile(env[LIVE_WATERMARK_WORKER_SCRIPT_ENV], "live_watermark_worker_script_not_configured"),
    adapterCScript: safeAbsoluteFile(env[LIVE_WATERMARK_ADAPTER_C_SCRIPT_ENV], "live_watermark_adapter_c_not_configured"),
    timeoutMs,
    maxQueue,
  };
}

class PersistentSessionWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private readyPromise: Promise<void> | null = null;
  private chain = Promise.resolve();
  private queued = 0;
  private dead = false;
  private stderrTail = "";
  private lastFailureCode: string | null = null;
  pid = 0;

  constructor(
    readonly sessionKey: string,
    readonly generation: number,
    private readonly workerConfig: WorkerConfig,
  ) {}

  get queueDepth(): number { return this.queued; }
  get alive(): boolean { return !this.dead && this.child !== null && this.child.exitCode === null; }

  async ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      const child = spawn(
        this.workerConfig.python,
        [this.workerConfig.workerScript, "--adapter-c", this.workerConfig.adapterCScript],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
      );
      this.child = child;
      const lines = readline.createInterface({ input: child.stdout });
      const readyTimer = setTimeout(() => reject(new Error("live_watermark_worker_ready_timeout")), this.workerConfig.timeoutMs);
      lines.on("line", (line) => {
        let message: WorkerResponse;
        try { message = JSON.parse(line) as WorkerResponse; } catch { return; }
        if (message.requestId === "worker" && message.status === "READY" && Number.isSafeInteger(message.pid)) {
          clearTimeout(readyTimer);
          this.pid = message.pid as number;
          resolve();
          return;
        }
        const waiter = this.pending.get(message.requestId);
        if (!waiter) return;
        clearTimeout(waiter.timer);
        this.pending.delete(message.requestId);
        if (message.status === "FAILED") {
          this.lastFailureCode = /^[A-Za-z0-9_-]{1,180}$/.test(message.errorCode ?? "") ? message.errorCode as string : "live_watermark_worker_failed";
          waiter.reject(new Error(this.lastFailureCode));
        }
        else waiter.resolve(message);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        this.stderrTail = `${this.stderrTail}${chunk.toString("utf8")}`.slice(-2_000).replace(/[A-Za-z]:[\\/][^\r\n]*/g, "[redacted-path]");
      });
      const failAll = (): void => {
        this.dead = true;
        clearTimeout(readyTimer);
        for (const waiter of this.pending.values()) {
          clearTimeout(waiter.timer);
          waiter.reject(new Error("live_watermark_worker_exited"));
        }
        this.pending.clear();
        reject(new Error("live_watermark_worker_exited"));
      };
      child.once("error", failAll);
      child.once("exit", failAll);
    });
    return this.readyPromise;
  }

  private async request(payload: Record<string, unknown>): Promise<WorkerResponse> {
    await this.ready();
    const child = this.child;
    if (!child || !this.alive) throw new Error("live_watermark_worker_not_alive");
    const requestId = randomUUID();
    return new Promise<WorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("live_watermark_worker_request_timeout"));
        this.child?.kill();
      }, this.workerConfig.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ requestId, ...payload })}\n`, "utf8", (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(new Error("live_watermark_worker_write_failed"));
      });
    });
  }

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.queued >= this.workerConfig.maxQueue) {
      throw new LiveProductError("live_watermark_queue_overflow", 503);
    }
    this.queued += 1;
    const run = this.chain.then(operation, operation);
    this.chain = run.then(() => undefined, () => undefined);
    return run.finally(() => { this.queued -= 1; });
  }

  ping(): Promise<WorkerResponse> { return this.request({ operation: "ping" }); }
  prepare(payload: Record<string, unknown>): Promise<WorkerResponse> { return this.request({ operation: "prepare", ...payload }); }
  prepareExactFrame(payload: Record<string, unknown>): Promise<WorkerResponse> { return this.request({ operation: "prepare_exact_frame", ...payload }); }
  write(payload: Record<string, unknown>): Promise<WorkerResponse> { return this.request({ operation: "write", ...payload }); }

  async stop(): Promise<void> {
    if (!this.child || this.child.exitCode !== null) return;
    await this.chain;
    try { await this.request({ operation: "shutdown" }); } catch { /* fail closed below */ }
    if (this.child.exitCode === null) this.child.kill();
    this.dead = true;
  }

  health(): Record<string, unknown> {
    return {
      alive: this.alive,
      pid: this.pid || null,
      generation: this.generation,
      queueDepth: this.queued,
      stderrRedacted: true,
      stderrHadOutput: this.stderrTail.length > 0,
      lastFailureCode: this.lastFailureCode,
    };
  }
}

export class LiveWatermarkWorkerManager {
  private readonly workers = new Map<string, PersistentSessionWorker>();
  private readonly verificationWorkers = new Map<string, PersistentSessionWorker>();
  private generation = 0;

  private worker(tenantId: string, sessionId: string): PersistentSessionWorker {
    const key = `${LiveProductStore.sha256(tenantId)}:${sessionId}`;
    const current = this.workers.get(key);
    if (current?.alive) return current;
    const created = new PersistentSessionWorker(key, ++this.generation, config());
    this.workers.set(key, created);
    return created;
  }

  private verificationWorker(tenantId: string, sessionId: string): PersistentSessionWorker {
    const key = `${LiveProductStore.sha256(tenantId)}:${sessionId}`;
    const current = this.verificationWorkers.get(key);
    if (current?.alive) return current;
    const created = new PersistentSessionWorker(`verify:${key}`, ++this.generation, config());
    this.verificationWorkers.set(key, created);
    return created;
  }

  async ensureReady(tenantId: string, sessionId: string): Promise<void> {
    const worker = this.worker(tenantId, sessionId);
    try {
      await worker.ready();
      const ping = await worker.ping();
      if (ping.status !== "ALIVE") throw new Error("live_watermark_worker_heartbeat_failed");
    } catch {
      throw new LiveProductError("live_watermark_runtime_not_ready", 503);
    }
  }

  async processFragment(input: {
    tenantId: string;
    sessionId: string;
    sequence: number;
    rawInit: Buffer;
    rawFragment: Buffer;
    sourceFragment: LiveFmp4FragmentInfo;
    exactIdHex: string;
    globalFrameOffset: number;
    jobRoot: string;
  }): Promise<LiveProtectedFragmentResult> {
    const worker = this.worker(input.tenantId, input.sessionId);
    const queueDepthAtSubmit = worker.queueDepth;
    return worker.enqueue(async () => {
      const started = Date.now();
      const jobRoot = path.resolve(input.jobRoot);
      if (!path.basename(jobRoot).startsWith("watermark-job-")) throw new LiveProductError("live_watermark_job_path_invalid", 500);
      fs.mkdirSync(jobRoot, { recursive: false });
      const source = path.join(jobRoot, "source-fragment.mp4");
      const framesDir = path.join(jobRoot, "decoded-frames");
      const replacementsJson = path.join(jobRoot, "replacements.json");
      const intermediate = path.join(jobRoot, "adapter-c.mp4");
      const fragmented = path.join(jobRoot, "adapter-c-fragmented.mp4");
      const protectedInitPath = path.join(jobRoot, "protected-init.mp4");
      const protectedFragmentPath = path.join(jobRoot, "protected-fragment.m4s");
      try {
        fs.writeFileSync(source, Buffer.concat([input.rawInit, input.rawFragment]), { flag: "wx", mode: 0o600 });
        const prepared = await worker.prepare({ operation: "prepare", jobRoot, source, framesDir });
        const frames = prepared.frames ?? [];
        if (prepared.status !== "FRAMES_READY" || frames.length < 1 || prepared.frameCount !== frames.length) {
          throw new Error("live_watermark_worker_prepare_invalid");
        }
        if (!Number.isSafeInteger(prepared.width) || !Number.isSafeInteger(prepared.height) ||
            Number(prepared.width) < LIVE_MIN_FULL_CARRIER_DIMENSION ||
            Number(prepared.height) < LIVE_MIN_FULL_CARRIER_DIMENSION) {
          throw new LiveProductError("live_watermark_carrier_geometry_unsupported", 422);
        }
        const scored = [] as Array<{ frameIdx: number; pngPath: string; score: number }>;
        const stampingStarted = performance.now();
        for (const frame of frames) {
          if (!frame.pngPath) continue;
          const stat = fs.lstatSync(frame.pngPath);
          if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(frame.pngPath) !== framesDir) throw new Error("live_watermark_worker_frame_path_invalid");
          const metrics = await scoreFrameForStamping(fs.readFileSync(frame.pngPath));
          const brightness = metrics.meanY >= 32 && metrics.meanY <= 224 ? 10 : 0;
          const score = Math.min(30, metrics.substrate) * 100 + brightness;
          if (!Number.isFinite(frame.selectionScore) || Math.abs(score - Number(frame.selectionScore)) > 0.02) throw new Error("live_watermark_candidate_score_parity_failed");
          scored.push({ frameIdx: frame.frameIdx, pngPath: frame.pngPath, score });
        }
        if (prepared.candidateCount !== scored.length || scored.length !== Math.min(4, frames.length)) throw new Error("live_watermark_candidate_count_invalid");
        scored.sort((left, right) => right.score - left.score || left.frameIdx - right.frameIdx);
        const channelACount = frames.length >= 4 ? 2 : 1;
        const channelA = scored.slice(0, channelACount);
        if (channelA.length < 1) throw new Error("live_watermark_channel_a_frame_missing");
        const channelAOrdinals = new Set(channelA.map((item) => item.frameIdx));
        const channelB = scored.filter((item) => !channelAOrdinals.has(item.frameIdx)).slice(0, Math.min(2, frames.length - channelA.length));
        const id = normalizeId(input.exactIdHex);
        const replacements: Array<{ frameIdx: number; pngPath: string }> = [];
        for (let index = 0; index < channelA.length; index += 1) {
          const selected = channelA[index]!;
          const aStamped = await stampPngL1L3(fs.readFileSync(selected.pngPath), id);
          const aPath = path.join(jobRoot, `channel-a-${index}-stamped.png`);
          fs.writeFileSync(aPath, aStamped.pngBuffer, { flag: "wx", mode: 0o600 });
          replacements.push({ frameIdx: selected.frameIdx, pngPath: aPath });
        }
        for (let index = 0; index < channelB.length; index += 1) {
          const selected = channelB[index]!;
          const bPath = path.join(jobRoot, `channel-b-${index}-stamped.png`);
          fs.writeFileSync(bPath, await stampChannelBPng(fs.readFileSync(selected.pngPath), payload4(id)), { flag: "wx", mode: 0o600 });
          replacements.push({ frameIdx: selected.frameIdx, pngPath: bPath });
        }
        const stampingWallMs = performance.now() - stampingStarted;
        fs.writeFileSync(replacementsJson, `${JSON.stringify({ schemaVersion: "tancmark-adapter-c-replacement-manifest-v1", replacements }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
        const written = await worker.write({ operation: "write", jobRoot, source, replacementsJson, intermediate, fragmented, protectedInit: protectedInitPath, protectedFragment: protectedFragmentPath, rotation: 0 });
        if (written.status !== "PROTECTED_FRAGMENT_READY") throw new Error("live_watermark_worker_write_invalid");
        const protectedInit = fs.readFileSync(protectedInitPath);
        const workerFragment = fs.readFileSync(protectedFragmentPath);
        const protectedInitInfo = validateLiveFmp4Init(protectedInit);
        const protectedFragment = restoreProtectedFragmentTimeline({ fragment: workerFragment, mfhdSequence: input.sourceFragment.mfhdSequence, sourceTracks: input.sourceFragment.tracks, sourceFragment: input.rawFragment });
        const protectedInfo = validateLiveFmp4Fragment(protectedFragment, protectedInitInfo);
        if (protectedInfo.tracks.length !== input.sourceFragment.tracks.length || protectedInfo.tracks.some((track, index) => track.sampleCount !== input.sourceFragment.tracks[index]?.sampleCount)) {
          throw new Error("live_watermark_output_track_integrity_failed");
        }
        const channelAFrameIdxs = channelA.map((item) => input.globalFrameOffset + item.frameIdx);
        const channelBFrameIdxs = channelB.map((item) => input.globalFrameOffset + item.frameIdx);
        const framePts = frames.map((frame) => ({
          ordinal: input.globalFrameOffset + frame.frameIdx,
          pts: frame.pts,
          timeBase: frame.timeBase,
        }));
        return {
          protectedInit,
          protectedFragment,
          frameCount: frames.length,
          channelAFrameIdxs,
          channelBFrameIdxs,
          framePts,
          sourceTrackTimelines: input.sourceFragment.tracks.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime.toString(), durationTicks: track.durationTicks.toString(), sampleCount: track.sampleCount })),
          outputTrackTimelines: protectedInfo.tracks.map((track) => ({ trackId: track.trackId, baseDecodeTime: track.baseDecodeTime.toString(), durationTicks: track.durationTicks.toString(), sampleCount: track.sampleCount })),
          receipt: {
            schemaVersion: "tancmark-live-protected-fragment-receipt-v1",
            sequence: input.sequence,
            sourceSha256: sha256(input.rawFragment),
            protectedSha256: sha256(protectedFragment),
            protectedInitSha256: sha256(protectedInit),
            sourceFrameCount: frames.length,
            outputFrameCount: protectedInfo.tracks.find((track) => protectedInitInfo.tracks.find((item) => item.trackId === track.trackId)?.handlerType === "vide")?.sampleCount ?? 0,
            channelAFrameIdxs,
            channelBFrameIdxs,
            workerPid: worker.pid,
            workerGeneration: worker.generation,
            queueDepthAtSubmit,
            prepareWallMs: Number(prepared.wallMs ?? 0),
            stampingWallMs: Number(stampingWallMs.toFixed(3)),
            adapterWallMs: Number(written.wallMs ?? 0),
            adapterEncodeWallMs: Number(written.stageMetrics?.adapterEncodeWallMs ?? 0),
            remuxWallMs: Number(written.stageMetrics?.remuxWallMs ?? 0),
            splitWallMs: Number(written.stageMetrics?.splitWallMs ?? 0),
            codecValidationWallMs: Number(written.stageMetrics?.codecValidationWallMs ?? 0),
            workerCpuSeconds: Number(written.processMetrics?.processCpuSeconds ?? 0),
            workerWorkingSetBytes: written.processMetrics?.workingSetBytes ?? null,
            workerPeakWorkingSetBytes: written.processMetrics?.peakWorkingSetBytes ?? null,
            totalWallMs: Date.now() - started,
            createdAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        throw error instanceof LiveProductError ? error : new LiveProductError("live_watermarking_failed_fail_closed", 503);
      } finally {
        if (fs.existsSync(jobRoot)) fs.rmSync(jobRoot, { recursive: true, force: true });
      }
    });
  }

  /**
   * Decode one already-protected output fragment on a separate bounded,
   * long-lived worker. The ingest watermark queue is therefore never blocked
   * by periodic physical verification work.
   */
  async verifyProtectedFragment(input: {
    tenantId: string;
    sessionId: string;
    sequence: number;
    protectedInit: Buffer;
    protectedFragment: Buffer;
    localChannelAFrameIdxs: number[];
    globalChannelAFrameIdxs: number[];
    exactIdHex: string;
    authenticatedAegisKeyVersion: string;
    jobRoot: string;
  }): Promise<LiveProtectedSampleVerificationResult> {
    const worker = this.verificationWorker(input.tenantId, input.sessionId);
    return worker.enqueue(async () => {
      const started = Date.now();
      const jobRoot = path.resolve(input.jobRoot);
      if (!path.basename(jobRoot).startsWith("watermark-job-")) {
        throw new LiveProductError("live_verification_job_path_invalid", 500);
      }
      fs.mkdirSync(jobRoot, { recursive: false });
      const source = path.join(jobRoot, "protected-sample.mp4");
      const framesDir = path.join(jobRoot, "protected-sample-frames");
      try {
        fs.writeFileSync(source, Buffer.concat([input.protectedInit, input.protectedFragment]), { flag: "wx", mode: 0o600 });
        const prepared = await worker.prepareExactFrame({ jobRoot, source, framesDir, frameIdxs: input.localChannelAFrameIdxs });
        const selectedFrames = prepared.frames ?? [];
        if (prepared.status !== "EXACT_FRAMES_READY" || selectedFrames.length !== input.localChannelAFrameIdxs.length ||
            selectedFrames.some((frame, index) => frame.frameIdx !== [...input.localChannelAFrameIdxs].sort((left, right) => left - right)[index] || !frame.pngPath)) {
          throw new Error("live_sample_verification_decode_invalid");
        }
        const observations = [] as Array<{ localFrameIdx: number; locatorMatched: boolean; strongL1ByteMatches: number; frameVault: boolean; frameWeak: boolean }>;
        for (const selected of selectedFrames) {
          if (!selected.pngPath) throw new Error("live_sample_verification_frame_path_invalid");
          const selectedStat = fs.lstatSync(selected.pngPath);
          if (!selectedStat.isFile() || selectedStat.isSymbolicLink() || path.dirname(selected.pngPath) !== framesDir) {
            throw new Error("live_sample_verification_frame_path_invalid");
          }
          const decoded = await decodePngL1L3(
            fs.readFileSync(selected.pngPath),
            normalizeId(input.exactIdHex),
            { authenticatedAegisKeyVersion: input.authenticatedAegisKeyVersion },
          );
          const strongMask = buildA5StrongL1ByteMatchMask({
            l1Decoded4: decoded.l1.decoded4,
            expected4: decoded.l1.expected4,
            l1R1Per: decoded.l1.r1Per,
          });
          const strongL1ByteMatches = strongMask.filter(Boolean).length;
          const evidence = decideFrameEvidence({
            l1PayloadMatch: decoded.l1.payloadMatch,
            strongL1ByteMatchMask: strongMask,
            combinedByteMatches: decoded.combinedByteMatches,
            strongAnchors: strongL1ByteMatches,
          });
          observations.push({ localFrameIdx: selected.frameIdx, locatorMatched: decoded.locatorMatch, strongL1ByteMatches, frameVault: evidence.frameVault, frameWeak: evidence.frameWeak });
        }
        const decisive = observations.find((observation) => observation.frameVault) ?? observations.sort((left, right) => right.strongL1ByteMatches - left.strongL1ByteMatches)[0];
        if (!decisive) throw new Error("live_sample_verification_frame_missing");
        const physicalFrameExact = observations.some((observation) => observation.frameVault);
        const locatorMatched = observations.some((observation) => observation.locatorMatched);
        const verdict = physicalFrameExact
          ? "EXACT_VERIFIED"
          : locatorMatched || observations.some((observation) => observation.frameWeak)
            ? "PARTIAL"
            : "NOT_FOUND";
        const globalOffset = input.globalChannelAFrameIdxs[0]! - input.localChannelAFrameIdxs[0]!;
        return {
          schemaVersion: "tancmark-live-protected-sample-verification-v1",
          sequence: input.sequence,
          verdict,
          physicalFrameExact,
          locatorMatched,
          strongL1ByteMatches: decisive.strongL1ByteMatches,
          frameOrdinal: globalOffset + decisive.localFrameIdx,
          workerGeneration: worker.generation,
          wallMs: Date.now() - started,
          verifiedAt: new Date().toISOString(),
          rawIdDisclosed: false,
        };
      } catch (error) {
        throw error instanceof LiveProductError ? error : new LiveProductError("live_sample_verification_failed", 503);
      } finally {
        if (fs.existsSync(jobRoot)) fs.rmSync(jobRoot, { recursive: true, force: true });
      }
    });
  }

  async stop(tenantId: string, sessionId: string): Promise<void> {
    const key = `${LiveProductStore.sha256(tenantId)}:${sessionId}`;
    const worker = this.workers.get(key);
    const verifier = this.verificationWorkers.get(key);
    await Promise.all([worker?.stop(), verifier?.stop()]);
    this.workers.delete(key);
    this.verificationWorkers.delete(key);
  }

  health(tenantId: string, sessionId: string): Record<string, unknown> {
    const key = `${LiveProductStore.sha256(tenantId)}:${sessionId}`;
    return {
      watermark: this.workers.get(key)?.health() ?? { alive: false, pid: null, generation: null, queueDepth: 0, stderrRedacted: true },
      verification: this.verificationWorkers.get(key)?.health() ?? { alive: false, pid: null, generation: null, queueDepth: 0, stderrRedacted: true },
    };
  }

  async shutdownAll(): Promise<void> {
    await Promise.all([...this.workers.values(), ...this.verificationWorkers.values()].map((worker) => worker.stop()));
    this.workers.clear();
    this.verificationWorkers.clear();
  }
}
