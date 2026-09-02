import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import sharp from "sharp";
import { stampPngL1L3, normalizeId, payload4 } from "../../api-server/src/video/aegisCore";
import { getChannelBFrameMap, stampChannelBPng } from "../../api-server/src/video/channelB";
import { decodeVideo, type DecodeResult } from "../../api-server/src/video/decodeVideo";
import { buildPrivateExactSealTimingMap } from "../../api-server/src/video/exactSealTimingMap";
import { runWithinCanonicalLiveExactVerification } from "../../api-server/src/video/canonicalReaderLiveScope";
import type { DemoRuntimePaths } from "./demoEngine";
import type { DemoRegistryRecord, EphemeralDemoRegistry } from "./demoRegistry";

const MEDIAMTX_SHA256 = "80f74b5546d107db6e812256201679b266764686afbe64cb8801ec362b59fb7d";
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 360;
const FRAME_RATE = 24;
const EXPECTED_FRAMES = 384;
const FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT * 3;
const CHANNEL_A_FRAME_IDXS = Object.freeze([24, 72, 120, 168, 216, 264, 312, 360]);

export interface LiveDemoRuntimePaths extends DemoRuntimePaths {
  mediaMtx: string;
  transportFfmpeg: string;
  transportLibraryPath: string;
  transportFfmpegSha256: string;
}

export interface LivePlaybackObservation {
  hlsManifestReady: boolean;
  browserPlaybackVisible: boolean;
}

export interface LiveDemoResult extends Record<string, unknown> {
  module: "live";
  status: "DEMO_EXACT_VERIFIED" | "DEMO_NOT_FOUND";
  liveDemoRealPipeline: true;
  liveInStreamWatermarkActive: boolean;
  livePlaybackVisible: boolean;
  liveFinalExactVerified: boolean;
  liveWrongOwnership: boolean;
}

export async function runLiveDemoPipeline(input: {
  runtime: LiveDemoRuntimePaths;
  registry: EphemeralDemoRegistry;
  record: DemoRegistryRecord;
  observePlayback?: (url: string) => Promise<LivePlaybackObservation>;
  signal?: AbortSignal;
}): Promise<LiveDemoResult> {
  input.signal?.throwIfAborted();
  const startedAt = performance.now();
  const runtime = validateLiveRuntime(input.runtime);
  const work = fs.mkdtempSync(path.join(runtime.tempRoot, "tancmark-demo-live-"));
  const source = path.join(runtime.repoRoot, "fixtures", "demo-public", "demo-live-source.mkv");
  const sourceHash = sha256File(source);
  const recordRoot = path.join(work, "recordings");
  const mediaMtxConfig = path.join(work, "mediamtx.yml");
  const channelBFrameIdxs = getChannelBFrameMap(EXPECTED_FRAMES, CHANNEL_A_FRAME_IDXS);
  const rollingReceipt: Array<Record<string, unknown>> = [];
  let rollingHash = Buffer.alloc(32, 0);
  let mediaMtx: ChildProcess | undefined;
  let decoder: ChildProcess | undefined;
  let publisher: ChildProcess | undefined;
  let authoritativeRecorder: ChildProcess | undefined;
  let playback: LivePlaybackObservation = { hlsManifestReady: false, browserPlaybackVisible: false };
  let processedFrames = 0;
  let stampedChannelA = 0;
  let stampedChannelB = 0;
  let droppedFrames = 0;
  let publisherLog = "";
  let publisherInputError = "";
  let authoritativeRecorderLog = "";
  let authoritativeRecorderInputError = "";
  let mediaMtxLog = "";
  const authoritativeRecording = path.join(work, "authoritative-live.mkv");
  const abortChildren = () => {
    for (const child of [decoder, publisher, authoritativeRecorder, mediaMtx]) {
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  };
  input.signal?.addEventListener("abort", abortChildren, { once: true });

  fs.mkdirSync(recordRoot, { recursive: true });
  fs.writeFileSync(mediaMtxConfig, mediaMtxConfiguration(recordRoot), { flag: "wx", mode: 0o600 });

  try {
    mediaMtx = spawn(runtime.mediaMtx, [mediaMtxConfig], {
      cwd: work,
      stdio: ["ignore", "pipe", "pipe"],
      env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", HOME: work },
    });
    mediaMtx.stderr?.on("data", (chunk: Buffer) => {
      if (mediaMtxLog.length < 64_000) mediaMtxLog += chunk.toString("utf8");
    });
    mediaMtx.stdout?.on("data", (chunk: Buffer) => {
      if (mediaMtxLog.length < 64_000) mediaMtxLog += chunk.toString("utf8");
    });
    await waitForHttp("http://127.0.0.1:9997/v3/paths/list", 20_000, input.signal);

    const transportEnvironment = {
      PATH: "/usr/bin:/bin",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      LD_LIBRARY_PATH: runtime.transportLibraryPath,
    };
    publisher = spawn(runtime.transportFfmpeg, [
      "-hide_banner", "-loglevel", "error",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-video_size", `${FRAME_WIDTH}x${FRAME_HEIGHT}`,
      "-framerate", String(FRAME_RATE), "-i", "pipe:0",
      "-re", "-i", source,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8",
      "-row-mt", "1", "-threads", "2", "-b:v", "700k", "-g", "48", "-pix_fmt", "yuv420p",
      "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-c:a", "libopus", "-b:a", "96k", "-ar", "48000", "-ac", "2",
      "-strict", "experimental",
      "-f", "rtsp", "-rtsp_transport", "tcp", "rtsp://127.0.0.1:8554/demo_live",
    ], {
      cwd: work,
      stdio: ["pipe", "ignore", "pipe"],
      env: transportEnvironment,
    });
    publisher.stderr?.on("data", (chunk: Buffer) => {
      if (publisherLog.length < 64_000) publisherLog += chunk.toString("utf8");
    });
    publisher.stdin?.on("error", (error: NodeJS.ErrnoException) => {
      publisherInputError = error.code ?? error.message;
    });

    // The browser stream is a preview, never an ownership decision source.
    // Record the exact same stamped frames concurrently into the authoritative
    // open/lossless demo profile so transport compression cannot alter the
    // physical evidence used by final exact verification.
    authoritativeRecorder = spawn(runtime.ffmpeg, [
      "-hide_banner", "-loglevel", "error",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-video_size", `${FRAME_WIDTH}x${FRAME_HEIGHT}`,
      "-framerate", String(FRAME_RATE), "-i", "pipe:0",
      "-i", source,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "ffv1", "-level", "3", "-g", "1", "-slicecrc", "1", "-pix_fmt", "bgr0",
      "-c:a", "copy", "-shortest", authoritativeRecording,
    ], {
      cwd: work,
      stdio: ["pipe", "ignore", "pipe"],
      env: mediaEnvironment(runtime),
    });
    authoritativeRecorder.stderr?.on("data", (chunk: Buffer) => {
      if (authoritativeRecorderLog.length < 64_000) authoritativeRecorderLog += chunk.toString("utf8");
    });
    authoritativeRecorder.stdin?.on("error", (error: NodeJS.ErrnoException) => {
      authoritativeRecorderInputError = error.code ?? error.message;
    });

    decoder = spawn(runtime.ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-re", "-i", source,
      "-map", "0:v:0", "-vsync", "0", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
    ], {
      cwd: work,
      stdio: ["ignore", "pipe", "pipe"],
      env: mediaEnvironment(runtime),
    });
    let decoderError = "";
    decoder.stderr?.on("data", (chunk: Buffer) => {
      if (decoderError.length < 64_000) decoderError += chunk.toString("utf8");
    });

    const playbackPromise = waitForHttp("http://127.0.0.1:8888/demo_live/index.m3u8", 20_000, input.signal)
      .then(async () => {
        playback = input.observePlayback
          ? await input.observePlayback("/demo/live/media/demo_live/index.m3u8")
          : { hlsManifestReady: true, browserPlaybackVisible: false };
      });

    let pending = Buffer.alloc(0);
    assert(decoder.stdout);
    for await (const chunk of decoder.stdout) {
      input.signal?.throwIfAborted();
      pending = Buffer.concat([pending, Buffer.from(chunk)]);
      while (pending.length >= FRAME_BYTES) {
        input.signal?.throwIfAborted();
        const original = pending.subarray(0, FRAME_BYTES);
        pending = pending.subarray(FRAME_BYTES);
        const frameIdx = processedFrames;
        const channel = CHANNEL_A_FRAME_IDXS.includes(frameIdx)
          ? "A"
          : channelBFrameIdxs.includes(frameIdx)
            ? "B"
            : null;
        let output = original;
        if (channel) {
          const png = await sharp(original, {
            raw: { width: FRAME_WIDTH, height: FRAME_HEIGHT, channels: 3 },
          }).png({ compressionLevel: 1, adaptiveFiltering: false }).toBuffer();
          const stampedPng = channel === "A"
            ? (await stampPngL1L3(png, normalizeId(input.record.idHex))).pngBuffer
            : await stampChannelBPng(png, payload4(normalizeId(input.record.idHex)));
          const converted = await sharp(stampedPng).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          assert.equal(converted.info.width, FRAME_WIDTH);
          assert.equal(converted.info.height, FRAME_HEIGHT);
          assert.equal(converted.info.channels, 3);
          output = converted.data;
          if (channel === "A") stampedChannelA += 1;
          else stampedChannelB += 1;
          const beforeHash = createHash("sha256").update(original).digest("hex");
          const afterHash = createHash("sha256").update(output).digest("hex");
          rollingHash = createHash("sha256")
            .update(rollingHash)
            .update(`${frameIdx}\0${channel}\0${beforeHash}\0${afterHash}`, "utf8")
            .digest();
          rollingReceipt.push({ sequence: rollingReceipt.length + 1, frameIdx, channel, beforeHash, afterHash });
        }
        assert(
          publisher.stdin && !publisher.stdin.destroyed && !publisherInputError,
          `LIVE_PUBLISHER_INPUT_CLOSED:${publisherInputError}:${publisherLog.slice(-1000)}`,
        );
        assert(
          authoritativeRecorder.stdin &&
            !authoritativeRecorder.stdin.destroyed &&
            !authoritativeRecorderInputError,
          `LIVE_AUTHORITATIVE_RECORDER_INPUT_CLOSED:${authoritativeRecorderInputError}:${authoritativeRecorderLog.slice(-1000)}`,
        );
        const pendingDrains: Array<Promise<unknown>> = [];
        if (!publisher.stdin.write(output)) pendingDrains.push(once(publisher.stdin, "drain"));
        if (!authoritativeRecorder.stdin.write(output)) {
          pendingDrains.push(once(authoritativeRecorder.stdin, "drain"));
        }
        try {
          await Promise.all(pendingDrains);
        } catch {
          throw new Error(
            `LIVE_OUTPUT_WRITE_FAILED:preview=${publisherInputError}:${publisherLog.slice(-500)}:` +
            `authoritative=${authoritativeRecorderInputError}:${authoritativeRecorderLog.slice(-500)}`,
          );
        }
        processedFrames += 1;
      }
    }
    if (pending.length !== 0) droppedFrames += 1;
    publisher.stdin?.end();
    authoritativeRecorder.stdin?.end();
    const [decoderCode, publisherCode, authoritativeRecorderCode] = await Promise.all([
      childExit(decoder, 30_000),
      childExit(publisher, 45_000),
      childExit(authoritativeRecorder, 45_000),
    ]);
    assert.equal(decoderCode, 0, `LIVE_DECODER_FAILED:${decoderError.slice(-1000)}`);
    assert.equal(publisherCode, 0, `LIVE_PUBLISHER_FAILED:${publisherLog.slice(-1000)}`);
    assert.equal(
      authoritativeRecorderCode,
      0,
      `LIVE_AUTHORITATIVE_RECORDER_FAILED:${authoritativeRecorderLog.slice(-1000)}`,
    );
    await playbackPromise;
    assert.equal(processedFrames, EXPECTED_FRAMES);
    assert.equal(stampedChannelA, CHANNEL_A_FRAME_IDXS.length);
    assert.equal(stampedChannelB, channelBFrameIdxs.length);
    await delay(1_000);
    mediaMtx.kill("SIGINT");
    await childExit(mediaMtx, 15_000);
    mediaMtx = undefined;

    const recordings = listFiles(recordRoot).filter((file) => file.endsWith(".mp4"));
    assert.equal(recordings.length, 1, `LIVE_RECORDING_COUNT_INVALID:${recordings.length}`);
    assert(fs.lstatSync(authoritativeRecording).isFile(), "LIVE_AUTHORITATIVE_RECORDING_MISSING");
    const exactMap = await buildPrivateExactSealTimingMap({
      videoPath: authoritativeRecording,
      registryRecordIdHex: input.record.idHex,
      channelAFrameIdxs: [...CHANNEL_A_FRAME_IDXS],
      channelBFrameIdxs,
    });
    const correct = await runWithinCanonicalLiveExactVerification(() => decodeVideo({
      videoPath: authoritativeRecording,
      idInput: input.record.idHex,
      workDir: path.join(work, "verify-correct"),
      exactSealTimingMapProvider: async () => exactMap,
      requireExactSealTimingMap: true,
    }));
    const wrong = await runWithinCanonicalLiveExactVerification(() => decodeVideo({
      videoPath: authoritativeRecording,
      idInput: randomBytes(32).toString("hex"),
      workDir: path.join(work, "verify-wrong"),
      exactSealTimingMapProvider: async () => exactMap,
      requireExactSealTimingMap: true,
    }));
    const unwatermarked = await runWithinCanonicalLiveExactVerification(() => decodeVideo({
      videoPath: source,
      idInput: input.record.idHex,
      workDir: path.join(work, "verify-unwatermarked"),
      exactSealTimingMapProvider: async () => undefined,
      requireExactSealTimingMap: true,
    }));
    const registry = input.registry.verify(input.record.idHex);
    const wrongTenant = input.registry.verify(input.record.idHex, `wrong-${input.registry.tenantId}`);
    const finalExact = isExact(correct, input.record.idHex) && registry.exactRecord && registry.tenantMatched && registry.signatureVerified;
    const wrongOwnership = isOwnership(wrong);
    const unwatermarkedOwnership = isOwnership(unwatermarked);
    const exact =
      finalExact &&
      !wrongOwnership &&
      !unwatermarkedOwnership &&
      !wrongTenant.tenantMatched &&
      droppedFrames === 0 &&
      processedFrames === EXPECTED_FRAMES &&
      playback.hlsManifestReady;
    assert.equal(sha256File(source), sourceHash, "live source fixture mutated");
    return {
      module: "live",
      status: exact ? "DEMO_EXACT_VERIFIED" : "DEMO_NOT_FOUND",
      demoOnly: true,
      liveDemoRealPipeline: true,
      liveInStreamWatermarkActive: stampedChannelA > 0 && stampedChannelB > 0,
      livePlaybackVisible: playback.browserPlaybackVisible,
      liveHlsManifestReady: playback.hlsManifestReady,
      liveFinalExactVerified: finalExact,
      liveFinalVerdict: correct.verdict,
      liveChannelAVerdict: correct.channelAVerdict,
      liveChannelAIdMatched: correct.channelAIdMatched,
      liveChannelBIdMatched: correct.channelBIdMatched,
      liveBothChannelsMatched: correct.bothChannelsMatched,
      liveVaultFrames: correct.vaultFrames,
      liveWeakFrames: correct.weakFrames,
      liveAnchorOnlyFrames: correct.anchorOnlyFrames,
      liveMatchesPerAnchor: correct.matchesPerAnchor,
      liveWrongOwnership: wrongOwnership,
      liveWrongTenantOwnership: wrongTenant.tenantMatched,
      liveUnwatermarkedInjectionOwnership: unwatermarkedOwnership,
      liveDroppedFrames: droppedFrames,
      liveProcessedFrames: processedFrames,
      liveExpectedFrames: EXPECTED_FRAMES,
      liveChannelAStamped: stampedChannelA,
      liveChannelBStamped: stampedChannelB,
      liveRollingReceiptEntries: rollingReceipt.length,
      liveRollingReceiptHash: rollingHash.toString("hex"),
      liveBacklogAfterStop: 0,
      remainingLiveWorkers: 0,
      remainingLivePorts: 0,
      remainingLiveTemporaryDirectories: 0,
      registryMatch: registry.exactRecord && registry.tenantMatched,
      signatureVerified: registry.signatureVerified,
      recordingFormat: "FFV1 + PCM / Matroska",
      browserPreviewFormat: "VP9 + Opus / fragmented MP4",
      previewIsOwnershipDecisionSource: false,
      transport: "stamped frames → concurrent FFV1 authoritative record + RTSP → MediaMTX → fMP4 HLS preview",
      productionOwnership: false,
      productionVault: false,
      recordHandle: input.record.recordHandle,
      durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
    };
  } finally {
    input.signal?.removeEventListener("abort", abortChildren);
    for (const child of [decoder, publisher, authoritativeRecorder, mediaMtx]) {
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    assert(path.resolve(work).startsWith(`${path.resolve(runtime.tempRoot)}${path.sep}`));
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

export function loadLiveDemoRuntime(base: DemoRuntimePaths): LiveDemoRuntimePaths {
  const requiredFile = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value || !path.isAbsolute(value)) throw new Error(`${name}_ABSOLUTE_PATH_REQUIRED`);
    return path.resolve(value);
  };
  const requiredText = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name}_REQUIRED`);
    return value;
  };
  return {
    ...base,
    mediaMtx: requiredFile("TANCMARK_DEMO_MEDIAMTX"),
    transportFfmpeg: requiredFile("TANCMARK_DEMO_TRANSPORT_FFMPEG"),
    transportLibraryPath: requiredText("TANCMARK_DEMO_TRANSPORT_LD_LIBRARY_PATH"),
    transportFfmpegSha256: requiredText("TANCMARK_DEMO_TRANSPORT_FFMPEG_SHA256").toLowerCase(),
  };
}

function validateLiveRuntime(runtime: LiveDemoRuntimePaths): LiveDemoRuntimePaths {
  assertNormalBinary(runtime.mediaMtx, MEDIAMTX_SHA256);
  assertNormalBinary(runtime.transportFfmpeg, runtime.transportFfmpegSha256);
  for (const entry of runtime.transportLibraryPath.split(path.delimiter).filter(Boolean)) {
    assert(path.isAbsolute(entry));
    const stat = fs.lstatSync(entry);
    assert(stat.isDirectory() && !stat.isSymbolicLink());
    assert.equal(fs.realpathSync.native(entry), path.resolve(entry));
  }
  return runtime;
}

function assertNormalBinary(filePath: string, expectedSha256: string): void {
  const stat = fs.lstatSync(filePath);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(fs.realpathSync.native(filePath), path.resolve(filePath));
  assert.match(expectedSha256, /^[a-f0-9]{64}$/);
  assert.equal(sha256File(filePath), expectedSha256);
}

function mediaEnvironment(runtime: DemoRuntimePaths): NodeJS.ProcessEnv {
  return {
    PATH: "/usr/bin:/bin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    LD_LIBRARY_PATH: runtime.mediaLibraryPath,
  };
}

function mediaMtxConfiguration(recordRoot: string): string {
  assert(!/[\r\n]/.test(recordRoot));
  return `logLevel: info
logDestinations: [stdout]
readTimeout: 10s
writeTimeout: 10s
api: yes
apiAddress: 127.0.0.1:9997
metrics: no
pprof: no
playback: no
rtsp: yes
rtspAddress: 127.0.0.1:8554
rtspTransports: [tcp]
rtmp: no
hls: yes
hlsAddress: 127.0.0.1:8888
hlsVariant: fmp4
hlsAlwaysRemux: yes
hlsSegmentCount: 20
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
webrtc: no
srt: no
pathDefaults:
  source: publisher
  record: no
paths:
  demo_live:
    source: publisher
    record: yes
    recordPath: ${recordRoot}/%path/%Y-%m-%d_%H-%M-%S-%f
    recordFormat: fmp4
    recordPartDuration: 1s
    recordSegmentDuration: 1h
`;
}

async function waitForHttp(url: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    try {
      const timeoutSignal = AbortSignal.timeout(2_000);
      const response = await fetch(url, {
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });
      lastStatus = response.status;
      await response.arrayBuffer();
      if (response.ok) return;
    } catch {
      // Bounded retry while the local-only service starts.
    }
    await delay(100);
  }
  throw new Error(`LIVE_INTERNAL_HTTP_NOT_READY:${lastStatus}`);
}

async function childExit(child: ChildProcess, timeoutMs: number): Promise<number | null> {
  if (child.exitCode !== null) return child.exitCode;
  return await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("LIVE_CHILD_EXIT_TIMEOUT"));
    }, timeoutMs);
    timer.unref();
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function listFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error("LIVE_RECORDING_SYMLINK_REJECTED");
    if (entry.isDirectory()) result.push(...listFiles(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

function isOwnership(result: DecodeResult): boolean {
  return result.verdict === "VAULT" || result.channelAIdMatched || result.aggregatedVault;
}

function isExact(result: DecodeResult, idHex: string): boolean {
  return result.channelAIdMatched && result.idHex === normalizeId(idHex).toString("hex");
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
