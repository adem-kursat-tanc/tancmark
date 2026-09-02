import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Aegis } from "@workspace/aegis-core";
import {
  decodeTripleShieldInformed,
  deriveR1FinderSigns,
  expectedTripleShieldAnchors,
  stampTripleShield,
} from "@workspace/aegis-core/layers/visual/tripleShield";
import {
  decodeAudioV01FromDna,
  encodeStandaloneAudioV01,
} from "../../api-server/src/video/audioModule";
import { normalizeId, payload4 } from "../../api-server/src/video/aegisCore";
import { decodeVideo, type DecodeResult } from "../../api-server/src/video/decodeVideo";
import { encodeVideo } from "../../api-server/src/video/encodeVideo";
import { buildPrivateExactSealTimingMap } from "../../api-server/src/video/exactSealTimingMap";
import { runWithinCanonicalLiveExactVerification } from "../../api-server/src/video/canonicalReaderLiveScope";
import { EphemeralDemoRegistry } from "./demoRegistry";

export type DemoVerdict = "DEMO_EXACT_VERIFIED" | "DEMO_PARTIAL" | "DEMO_NOT_FOUND";

export interface DemoRuntimePaths {
  repoRoot: string;
  tempRoot: string;
  ffmpeg: string;
  ffprobe: string;
  python: string;
  adapterC: string;
  mediaLibraryPath: string;
}

export class DemoEngine {
  readonly registry: EphemeralDemoRegistry;
  readonly paths: DemoRuntimePaths;
  readonly #textSecret = randomBytes(32).toString("hex");
  readonly #imageSecret = randomBytes(32);

  constructor(paths = loadRuntimePaths()) {
    this.paths = validateRuntimePaths(paths);
    this.registry = new EphemeralDemoRegistry();
    configureCoreRuntime(this.paths);
  }

  async runText(input?: string): Promise<Record<string, unknown>> {
    const started = performance.now();
    const fixture = path.join(this.paths.repoRoot, "fixtures", "demo-public", "demo-text-en.txt");
    const source = input ?? fs.readFileSync(fixture, "utf8");
    assertValidText(source);
    const record = this.registry.createRecord("text");
    const wrongId = randomBytes(32).toString("hex");
    const aegis = new Aegis({ secret: this.#textSecret });
    const sealed = aegis.fingerprint(source, record.idHex);
    const positive = aegis.identify(sealed, [wrongId, record.idHex]);
    const wrong = aegis.identify(sealed, [wrongId]);
    const noId = aegis.identify(sealed, []);
    const registry = this.registry.verify(record.idHex);
    const exact =
      positive.userId === record.idHex &&
      registry.exactRecord &&
      registry.tenantMatched &&
      registry.signatureVerified;
    return {
      module: "text",
      status: exact ? "DEMO_EXACT_VERIFIED" : "DEMO_NOT_FOUND",
      demoOnly: true,
      format: "UTF-8 text",
      physicalRecovery: positive.userId === record.idHex,
      registryMatch: registry.exactRecord && registry.tenantMatched,
      signatureVerified: registry.signatureVerified,
      wrongIdOwnership: wrong.userId === wrongId,
      noIdOwnership: noId.userId !== null,
      productionOwnership: false,
      productionVault: false,
      recordHandle: record.recordHandle,
      sealedText: sealed,
      warning: "Do not paste confidential, personal, or customer text.",
      durationMs: roundMs(performance.now() - started),
    };
  }

  async runImage(): Promise<Record<string, unknown>> {
    const started = performance.now();
    const sourcePath = path.join(this.paths.repoRoot, "fixtures", "demo-public", "demo-image.png");
    const sourceHashBefore = sha256File(sourcePath);
    const record = this.registry.createRecord("image");
    const wrongId = randomBytes(32).toString("hex");
    const privateIdentity = record.idHex.slice(0, 32);
    const wrongIdentity = wrongId.slice(0, 32);
    const decoded = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = decoded.info;
    assert.equal(width, 512);
    assert.equal(height, 512);
    const clean = new Uint8Array(decoded.data);
    const stamped = clean.slice();
    const expectedPayload = payload4(normalizeId(record.idHex));
    const anchors = expectedTripleShieldAnchors(width, height);
    const references: Float64Array[] = [];
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index]!;
      const reference = new Float64Array(32 * 32);
      for (let y = 0; y < 32; y += 1) {
        for (let x = 0; x < 32; x += 1) {
          reference[y * 32 + x] = clean[((anchor.y + y) * width + anchor.x + x) * 4]!;
        }
      }
      references.push(reference);
      stampTripleShield(
        stamped,
        width,
        height,
        anchor.x,
        anchor.y,
        deriveR1FinderSigns(this.#imageSecret, anchor.id, privateIdentity),
        expectedPayload[index]!,
        64,
      );
    }
    const sealedPng = await sharp(Buffer.from(stamped), {
      raw: { width, height, channels: 4 },
    }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
    const transformedPng = await sharp(sealedPng)
      .png({ compressionLevel: 6, adaptiveFiltering: false })
      .toBuffer();
    const reread = await sharp(transformedPng).ensureAlpha().raw().toBuffer();
    const rgba = new Uint8Array(reread);
    const positive = anchors.map((anchor, index) =>
      decodeTripleShieldInformed(
        rgba,
        width,
        height,
        anchor.x,
        anchor.y,
        references[index]!,
        deriveR1FinderSigns(this.#imageSecret, anchor.id, privateIdentity),
      ),
    );
    const wrong = anchors.map((anchor, index) =>
      decodeTripleShieldInformed(
        rgba,
        width,
        height,
        anchor.x,
        anchor.y,
        references[index]!,
        deriveR1FinderSigns(this.#imageSecret, anchor.id, wrongIdentity),
      ),
    );
    const exactBytes = positive.filter((read, index) => read.dataBits8 === expectedPayload[index]).length;
    const strongFinderCount = positive.filter((read) => read.r1Ncc === 1).length;
    const wrongStrongFinderCount = wrong.filter((read) => read.r1Ncc === 1).length;
    const registry = this.registry.verify(record.idHex);
    // The existing public informed-image contract treats the four payload
    // bytes as the locator and a keyed perfect R1 finder as the strong second
    // proof. Keep the observed count visible; do not rewrite a 3/4 result as
    // 4/4 or weaken any core threshold.
    const exact = exactBytes === 4 && strongFinderCount >= 1 && registry.signatureVerified;
    assert.equal(sha256File(sourcePath), sourceHashBefore, "image fixture mutated");
    return {
      module: "image",
      status: exact ? "DEMO_EXACT_VERIFIED" : exactBytes > 0 ? "DEMO_PARTIAL" : "DEMO_NOT_FOUND",
      demoOnly: true,
      format: "PNG 512x512",
      physicalRecovery: exactBytes === 4,
      payloadBytesExact: `${exactBytes}/4`,
      strongFinderCount,
      strongFinderResult: `${strongFinderCount}/4`,
      readMode: "INFORMED_REFERENCE_PATCH",
      frozenTransformation: "lossless PNG re-encode",
      registryMatch: registry.exactRecord && registry.tenantMatched,
      signatureVerified: registry.signatureVerified,
      wrongIdOwnership: wrongStrongFinderCount > 0,
      noIdOwnership: false,
      productionOwnership: false,
      productionVault: false,
      originalFixtureModified: false,
      recordHandle: record.recordHandle,
      sealedPreviewDataUrl: `data:image/png;base64,${sealedPng.toString("base64")}`,
      durationMs: roundMs(performance.now() - started),
    };
  }

  async runAudio(sampleRate: 44_100 | 48_000): Promise<Record<string, unknown>> {
    const started = performance.now();
    const sourcePath = path.join(
      this.paths.repoRoot,
      "fixtures",
      "demo-public",
      `demo-audio-${sampleRate}.wav`,
    );
    const sourceHashBefore = sha256File(sourcePath);
    const work = this.makeWorkDir(`audio-${sampleRate}`);
    const record = this.registry.createRecord(`audio-${sampleRate}`);
    try {
      const engineOutput = path.join(work, "engine-sealed-mono-16000.wav");
      const authoritativeOutput = path.join(work, `sealed-${sampleRate}-stereo.wav`);
      const encodeDir = path.join(work, "encode");
      const decodeDir = path.join(work, "decode");
      fs.mkdirSync(encodeDir);
      fs.mkdirSync(decodeDir);
      const sealed = await encodeStandaloneAudioV01({
        sourceAudioPath: sourcePath,
        outputPath: engineOutput,
        workDir: encodeDir,
        idInput: record.idHex,
        ownerClientId: record.clientId,
        ownerDocId: record.docId,
      });
      await runTool(this.paths.ffmpeg, [
        "-y", "-hide_banner", "-loglevel", "error", "-i", engineOutput,
        "-af", "apad=whole_dur=10", "-t", "10", "-ar", String(sampleRate),
        "-ac", "2", "-c:a", "pcm_s16le", authoritativeOutput,
      ], this.paths, 120_000);
      const positive = await decodeAudioV01FromDna({
        mediaPath: authoritativeOutput,
        workDir: decodeDir,
        dna: sealed.dna,
        expectedPayload4Hex: sealed.payload4Hex,
      });
      const wrongPayload = sealed.payload4Hex === "ffffffff" ? "00000000" : "ffffffff";
      const wrong = await decodeAudioV01FromDna({
        mediaPath: authoritativeOutput,
        workDir: decodeDir,
        dna: sealed.dna,
        expectedPayload4Hex: wrongPayload,
      });
      const noId = await decodeAudioV01FromDna({
        mediaPath: authoritativeOutput,
        workDir: decodeDir,
        dna: sealed.dna,
        expectedPayload4Hex: "",
      });
      const sourceInfo = await probeAudio(sourcePath, this.paths);
      const outputInfo = await probeAudio(authoritativeOutput, this.paths);
      const sampleCountPreserved =
        sourceInfo.sampleRate === outputInfo.sampleRate &&
        sourceInfo.channels === outputInfo.channels &&
        sourceInfo.durationTs === outputInfo.durationTs;
      const registry = this.registry.verify(record.idHex);
      const exact = positive.idMatched && sampleCountPreserved && registry.signatureVerified;
      assert.equal(sha256File(sourcePath), sourceHashBefore, "audio fixture mutated");
      return {
        module: "audio",
        status: exact ? "DEMO_EXACT_VERIFIED" : positive.verdict === "AUDIO_CANDIDATE" ? "DEMO_PARTIAL" : "DEMO_NOT_FOUND",
        demoOnly: true,
        format: `PCM S16LE WAV ${sampleRate} Hz stereo`,
        audioDemoRealEngine: true,
        audioExactRecovered: positive.idMatched,
        matchedIndependentTraceCount: positive.matchedTraceIds.length,
        registryMatch: registry.exactRecord && registry.tenantMatched,
        signatureVerified: registry.signatureVerified,
        audioWrongIdOwnership: wrong.idMatched,
        audioNoIdOwnership: noId.idMatched,
        audioSampleCountPreserved: sampleCountPreserved,
        source: sourceInfo,
        output: outputInfo,
        audioOriginalFixtureModified: false,
        productionOwnership: false,
        productionVault: false,
        recordHandle: record.recordHandle,
        durationMs: roundMs(performance.now() - started),
      };
    } finally {
      this.removeWorkDir(work);
    }
  }

  async runVideo(options: { includePreviewData?: boolean } = {}): Promise<Record<string, unknown>> {
    const started = performance.now();
    const sourcePath = path.join(this.paths.repoRoot, "fixtures", "demo-public", "demo-video-source.mkv");
    const sourceHashBefore = sha256File(sourcePath);
    const work = this.makeWorkDir("video");
    const record = this.registry.createRecord("video");
    try {
      const outputPath = path.join(work, "sealed-authoritative.mkv");
      const encode = await encodeVideo({
        videoPath: sourcePath,
        idInput: record.idHex,
        outputPath,
        workDir: path.join(work, "encode"),
        stampCount: 8,
      });
      const exactMap = await buildPrivateExactSealTimingMap({
        videoPath: outputPath,
        registryRecordIdHex: encode.idHex,
        channelAFrameIdxs: encode.stampedFrameIdxs,
        channelBFrameIdxs: encode.channelB.frameIdxs,
      });
      const correct = await runWithinCanonicalLiveExactVerification(() =>
        decodeVideo({
          videoPath: outputPath,
          idInput: record.idHex,
          workDir: path.join(work, "read-correct"),
          exactSealTimingMapProvider: async () => exactMap,
          requireExactSealTimingMap: true,
        }),
      );
      const wrongId = randomBytes(32).toString("hex");
      const wrong = await runWithinCanonicalLiveExactVerification(() =>
        decodeVideo({
          videoPath: outputPath,
          idInput: wrongId,
          workDir: path.join(work, "read-wrong"),
          exactSealTimingMapProvider: async () => exactMap,
          requireExactSealTimingMap: true,
        }),
      );
      const noId = await runWithinCanonicalLiveExactVerification(() =>
        decodeVideo({
          videoPath: outputPath,
          idInput: "",
          workDir: path.join(work, "read-no-id"),
          exactSealTimingMapProvider: async () => undefined,
          requireExactSealTimingMap: true,
        }),
      );
      const sourceTimeline = await probeVideoTimeline(sourcePath, this.paths);
      const outputTimeline = await probeVideoTimeline(outputPath, this.paths);
      const timeline = compareTimeline(sourceTimeline, outputTimeline);
      const sourceAudioHash = await rawAudioHash(sourcePath, path.join(work, "source-audio.raw"), this.paths);
      const outputAudioHash = await rawAudioHash(outputPath, path.join(work, "output-audio.raw"), this.paths);
      const previewPath = path.join(work, "sealed-preview.webm");
      await runTool(this.paths.ffmpeg, [
        "-y", "-hide_banner", "-loglevel", "error", "-i", outputPath,
        "-map", "0:v:0", "-map", "0:a:0", "-c:v", "libvpx-vp9",
        "-deadline", "good", "-cpu-used", "4", "-b:v", "900k",
        "-c:a", "libopus", "-b:a", "128k", previewPath,
      ], this.paths, 180_000);
      const registry = this.registry.verify(record.idHex);
      const correctExact = isVideoExact(correct, record.idHex);
      const wrongOwnership = isVideoOwnership(wrong);
      const noIdOwnership = isVideoOwnership(noId);
      const exact =
        correctExact &&
        !wrongOwnership &&
        !noIdOwnership &&
        timeline.frameDrop === 0 &&
        timeline.duplicateFrame === 0 &&
        timeline.cumulativeDrift === 0 &&
        sourceAudioHash === outputAudioHash &&
        registry.signatureVerified;
      assert.equal(sha256File(sourcePath), sourceHashBefore, "video fixture mutated");
      return {
        module: "video",
        status: exact ? "DEMO_EXACT_VERIFIED" : "DEMO_NOT_FOUND",
        demoOnly: true,
        authoritativeFormat: "FFV1 + PCM / Matroska",
        previewFormat: "VP9 + Opus / WebM",
        previewIsOwnershipDecisionSource: false,
        videoDemoRealEngine: true,
        videoExactRecovered: correctExact,
        correct: summarizeVideo(correct),
        registryMatch: registry.exactRecord && registry.tenantMatched,
        signatureVerified: registry.signatureVerified,
        videoWrongIdOwnership: wrongOwnership,
        videoNoIdOwnership: noIdOwnership,
        videoFrameDrop: timeline.frameDrop,
        videoDuplicateFrame: timeline.duplicateFrame,
        videoCumulativeDrift: timeline.cumulativeDrift,
        videoTimeBasePreserved: timeline.timeBasePreserved,
        audioPacketPayloadPreserved: sourceAudioHash === outputAudioHash,
        videoOriginalFixtureModified: false,
        productionOwnership: false,
        productionVault: false,
        recordHandle: record.recordHandle,
        previewDataUrl: options.includePreviewData
          ? `data:video/webm;base64,${fs.readFileSync(previewPath).toString("base64")}`
          : undefined,
        durationMs: roundMs(performance.now() - started),
      };
    } finally {
      this.removeWorkDir(work);
    }
  }

  runRegistryVerification(): Record<string, unknown> {
    const record = this.registry.createRecord("registry");
    const positive = this.registry.verify(record.idHex);
    const wrongTenant = this.registry.verify(record.idHex, `wrong-${this.registry.tenantId}`);
    return {
      module: "registry-signature",
      status:
        positive.exactRecord && positive.tenantMatched && positive.signatureVerified
          ? "DEMO_EXACT_VERIFIED"
          : "DEMO_NOT_FOUND",
      demoOnly: true,
      registryMatch: positive.exactRecord && positive.tenantMatched,
      signatureVerified: positive.signatureVerified,
      wrongTenantOwnership: wrongTenant.tenantMatched,
      changedRegistryRecordAccepted: this.registry.verifyTamperedRecord(record.idHex),
      wrongSignatureAccepted: this.registry.verifyWrongSignature(record.idHex),
      productionOwnership: false,
      productionVault: false,
      recordHandle: record.recordHandle,
    };
  }

  reset(): void {
    this.registry.reset();
    for (const entry of fs.readdirSync(this.paths.tempRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("tancmark-demo-")) {
        this.removeWorkDir(path.join(this.paths.tempRoot, entry.name));
      }
    }
  }

  private makeWorkDir(label: string): string {
    return fs.mkdtempSync(path.join(this.paths.tempRoot, `tancmark-demo-${label}-`));
  }

  private removeWorkDir(work: string): void {
    const relative = path.relative(this.paths.tempRoot, path.resolve(work));
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

export function loadRuntimePaths(): DemoRuntimePaths {
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value || !path.isAbsolute(value)) throw new Error(`${name}_ABSOLUTE_PATH_REQUIRED`);
    return path.resolve(value);
  };
  const requiredLibraryPath = (name: string): string => {
    const value = process.env[name]?.trim();
    const entries = value?.split(path.delimiter).filter(Boolean) ?? [];
    if (entries.length === 0 || entries.some((entry) => !path.isAbsolute(entry))) {
      throw new Error(`${name}_ABSOLUTE_PATH_LIST_REQUIRED`);
    }
    return entries.map((entry) => path.resolve(entry)).join(path.delimiter);
  };
  return {
    repoRoot: required("TANCMARK_DEMO_REPO_ROOT"),
    tempRoot: required("TANCMARK_DEMO_TEMP_ROOT"),
    ffmpeg: required("TANCMARK_DEMO_FFMPEG"),
    ffprobe: required("TANCMARK_DEMO_FFPROBE"),
    python: required("TANCMARK_DEMO_PYTHON"),
    adapterC: required("TANCMARK_DEMO_ADAPTER_C"),
    mediaLibraryPath: requiredLibraryPath("TANCMARK_DEMO_LD_LIBRARY_PATH"),
  };
}

function validateRuntimePaths(input: DemoRuntimePaths): DemoRuntimePaths {
  for (const [name, value] of Object.entries(input)) {
    if (name === "mediaLibraryPath") {
      for (const entry of value.split(path.delimiter)) {
        assert(fs.lstatSync(entry).isDirectory(), `${name}_DIRECTORY_REQUIRED`);
      }
      continue;
    }
    const stat = fs.lstatSync(value);
    if (name === "repoRoot" || name === "tempRoot") {
      assert(stat.isDirectory(), `${name}_DIRECTORY_REQUIRED`);
    } else {
      assert(stat.isFile() && !stat.isSymbolicLink(), `${name}_NORMAL_FILE_REQUIRED`);
    }
  }
  assert.equal(path.basename(input.ffmpeg), "ffmpeg");
  assert.equal(path.basename(input.ffprobe), "ffprobe");
  fs.mkdirSync(input.tempRoot, { recursive: true });
  return input;
}

function configureCoreRuntime(paths: DemoRuntimePaths): void {
  process.env["NODE_ENV"] = "demo";
  process.env["TANCMARK_DEMO_ONLY"] = "1";
  process.env["TANCMARK_MEDIA_RUNTIME_PROFILE"] = "CODESPACES_LINUX_DEMO_PROFILE_V1";
  process.env["TANCMARK_FFMPEG_PATH"] = paths.ffmpeg;
  process.env["TANCMARK_FFPROBE_PATH"] = paths.ffprobe;
  process.env["TANCMARK_VIDEO_WRITEBACK_ADAPTER"] = "unified_pts_watermark_adapter_c";
  process.env["TANCMARK_VIDEO_WRITEBACK_THREADS"] = "1";
  process.env["TANCMARK_UNIFIED_PYAV_PYTHON"] = paths.python;
  process.env["TANCMARK_UNIFIED_PYAV_SCRIPT"] = paths.adapterC;
  process.env["TANCMARK_UNIFIED_PYAV_PROFILE"] = "mkv_ffv1_codespaces_demo";
  process.env["TANCMARK_UNIFIED_OUTPUT_MODE"] = "VIDEO_TIMELINE_CONTROL";
  process.env["TANCMARK_DEMO_LD_LIBRARY_PATH"] = paths.mediaLibraryPath;
  delete process.env["AEGIS_PRODUCT_RUNTIME"];
}

function assertValidText(value: string): void {
  assert(value.length > 0 && Buffer.byteLength(value, "utf8") <= 8_000, "DEMO_TEXT_SIZE_INVALID");
  assert([...value].length <= 2_000, "DEMO_TEXT_TOO_LONG");
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      assert(next >= 0xdc00 && next <= 0xdfff, "DEMO_TEXT_INVALID_UNICODE");
      index += 1;
    } else {
      assert(!(code >= 0xdc00 && code <= 0xdfff), "DEMO_TEXT_INVALID_UNICODE");
    }
  }
}

async function probeAudio(filePath: string, runtime: DemoRuntimePaths) {
  const output = await runTool(runtime.ffprobe, [
    "-v", "error", "-select_streams", "a:0", "-show_entries",
    "stream=sample_rate,channels,duration_ts,time_base,codec_name", "-of", "json", filePath,
  ], runtime, 30_000);
  const parsed = JSON.parse(output) as { streams?: Array<Record<string, string | number>> };
  const stream = parsed.streams?.[0] ?? {};
  return {
    codec: String(stream.codec_name ?? "unknown"),
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
    durationTs: Number(stream.duration_ts ?? 0),
    timeBase: String(stream.time_base ?? "unknown"),
  };
}

interface VideoTimeline {
  pts: string[];
  timeBase: string;
  frameCount: number;
}

async function probeVideoTimeline(filePath: string, runtime: DemoRuntimePaths): Promise<VideoTimeline> {
  const output = await runTool(runtime.ffprobe, [
    "-v", "error", "-select_streams", "v:0", "-show_streams", "-show_frames",
    "-show_entries", "stream=time_base:frame=best_effort_timestamp_time", "-of", "json", filePath,
  ], runtime, 60_000);
  const parsed = JSON.parse(output) as {
    streams?: Array<{ time_base?: string }>;
    frames?: Array<{ best_effort_timestamp_time?: string }>;
  };
  const pts = (parsed.frames ?? []).map((frame) => String(frame.best_effort_timestamp_time ?? "missing"));
  return { pts, timeBase: parsed.streams?.[0]?.time_base ?? "unknown", frameCount: pts.length };
}

function compareTimeline(source: VideoTimeline, output: VideoTimeline) {
  const sourceSet = new Set(source.pts);
  const outputSet = new Set(output.pts);
  const frameDrop = source.pts.filter((pts) => !outputSet.has(pts)).length;
  const duplicateFrame = output.pts.length - outputSet.size;
  let cumulativeDrift = Number.POSITIVE_INFINITY;
  if (source.pts.length === output.pts.length) {
    cumulativeDrift = source.pts.reduce((max, pts, index) => {
      const diff = Math.abs(Number(pts) - Number(output.pts[index]));
      return Math.max(max, Number.isFinite(diff) ? diff : Number.POSITIVE_INFINITY);
    }, 0);
  }
  return {
    frameDrop,
    duplicateFrame,
    cumulativeDrift,
    timeBasePreserved: source.timeBase === output.timeBase,
    sourceFrameCount: source.pts.length,
    outputFrameCount: output.pts.length,
    extraFrames: output.pts.filter((pts) => !sourceSet.has(pts)).length,
  };
}

async function rawAudioHash(filePath: string, outputPath: string, runtime: DemoRuntimePaths): Promise<string> {
  await runTool(runtime.ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error", "-i", filePath,
    "-map", "0:a:0", "-c:a", "copy", "-f", "s16le", outputPath,
  ], runtime, 60_000);
  return sha256File(outputPath);
}

function summarizeVideo(result: DecodeResult) {
  return {
    verdict: result.verdict,
    channelAVerdict: result.channelAVerdict,
    channelAIdMatched: result.channelAIdMatched,
    channelBIdMatched: result.channelBIdMatched,
    bothChannelsMatched: result.bothChannelsMatched,
    finalConfirmedBy: result.finalConfirmedBy,
    strongFrames: result.strongFrames,
    vaultFrames: result.vaultFrames,
    totalFramesAttempted: result.totalFramesAttempted,
    wallMs: result.wallMs,
  };
}

function isVideoOwnership(result: DecodeResult): boolean {
  return result.verdict === "VAULT" || result.channelAIdMatched || result.aggregatedVault;
}

function isVideoExact(result: DecodeResult, idHex: string): boolean {
  return isVideoOwnership(result) && result.idHex === normalizeId(idHex).toString("hex");
}

async function runTool(
  executable: string,
  args: string[],
  runtime: DemoRuntimePaths,
  timeoutMs: number,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: "/usr/bin:/bin",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        LD_LIBRARY_PATH: runtime.mediaLibraryPath,
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("DEMO_OPERATION_TIMED_OUT"));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < 8_000_000) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 64_000) stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`DEMO_CHILD_FAILED:${code ?? "null"}:${stderr.slice(-2000)}`));
    });
  });
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}
