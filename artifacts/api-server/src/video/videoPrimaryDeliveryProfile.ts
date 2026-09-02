import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import {
  createSignedExactAudioIntegrityRecordV1,
  probeCanonicalExactAudioManifest,
  verifySignedExactAudioIntegrityRecordV1,
  type AudioExactIntegrityVerification,
  type AudioExactKeyMaterial,
  type ExactAudioManifestProbe,
  type SignedExactAudioIntegrityEnvelopeV1,
} from "./videoPrimaryAudioExactIntegrity";
import { assertApprovedMediaRuntimePath } from "./mediaRuntimePathResolver";

const execFileAsync = promisify(execFile);

export const VIDEO_PRIMARY_MASTER_PROFILE =
  "VIDEO_PRIMARY_MASTER_EXACT_COPY_V1" as const;
export const VIDEO_PRIMARY_USER_DELIVERY_PROFILE =
  "VIDEO_PRIMARY_USER_STREAM_COPY_MP4_V1" as const;

type JsonObject = Record<string, unknown>;

export interface FileIdentity {
  path: string;
  bytes: number;
  sha256: string;
}

export interface MediaStreamContract {
  streamOrdinal: number;
  sourceStreamIndex: number;
  codecType: string;
  codecName: string;
  profile: string;
  sampleRate: string;
  channels: number;
  channelLayout: string;
  width: number;
  height: number;
  pixelFormat: string;
  timeBase: string;
  startTimeRational: string;
  durationRational: string;
  extradataHashSha256: string;
  disposition: Record<string, number>;
  safeMetadata: {
    language: string;
    title: string;
  };
  rotationDegrees: number | null;
  packetCount: number;
  totalPayloadBytes: string;
  orderedPacketDigestSha256: string;
  reportedContainerFields: {
    codecTagString: string;
    codecTag: string;
    startPts: string;
    startTime: string;
    durationTs: string;
    duration: string;
  };
}

export interface ChapterContract {
  chapterOrdinal: number;
  startTimeRational: string;
  endTimeRational: string;
  title: string;
}

export interface MediaDeliveryContract {
  schemaVersion: "tancmark-video-primary-media-delivery-contract-v1";
  formatName: string;
  formatLongName: string;
  majorBrand: string;
  compatibleBrands: string;
  streams: MediaStreamContract[];
  chapters: ChapterContract[];
  safeFormatMetadata: {
    title: string;
    artist: string;
    album: string;
    comment: string;
    copyright: string;
  };
}

export interface MasterDeliveryResult {
  profile: typeof VIDEO_PRIMARY_MASTER_PROFILE;
  status: "MASTER_EXACT_COPY_PASSED";
  source: FileIdentity;
  output: FileIdentity;
  byteExact: true;
}

export interface UserDeliveryResult {
  profile: typeof VIDEO_PRIMARY_USER_DELIVERY_PROFILE;
  status: "USER_DELIVERY_PASSED" | "USER_DELIVERY_FAIL_CLOSED";
  reason: string;
  outputProduced: boolean;
  deliveryOperation:
    | "FILE_EXACT_COPY"
    | "FFMPEG_STREAM_COPY_REMUX"
    | "NONE";
  ffmpegExecuted: boolean;
  source: FileIdentity;
  output?: FileIdentity;
  sourceContract: MediaDeliveryContract;
  outputContract?: MediaDeliveryContract;
  streamContractExact: boolean;
  audioIntegrity: AudioExactIntegrityVerification;
  signedAudioRecord: SignedExactAudioIntegrityEnvelopeV1;
  sourceAudioManifest: ExactAudioManifestProbe;
  outputAudioManifest?: ExactAudioManifestProbe;
  webMobileCompatibility: {
    status: "SUPPORTED_PRIMARY_AV" | "NOT_SUPPORTED" | "NOT_MEASURED";
    primaryVideoCodec: string;
    audioCodecs: string[];
  };
  ffmpegArguments: string[];
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asScalarString(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function asInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

function canonicalLanguage(value: unknown): string {
  const language = asString(value).trim().toLowerCase();
  return language === "und" ? "" : language;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

function normalizeRational(numerator: bigint, denominator: bigint): string {
  if (denominator === 0n) throw new Error("TIME_BASE_ZERO");
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  return `${n / divisor}/${d / divisor}`;
}

function timestampRational(raw: string, timeBase: string): string {
  if (!raw || raw === "N/A") return "N/A";
  const timeBaseMatch = /^(-?\d+)\/(-?\d+)$/.exec(timeBase);
  if (!timeBaseMatch || !/^-?\d+$/.test(raw)) return "N/A";
  return normalizeRational(
    BigInt(raw) * BigInt(timeBaseMatch[1]!),
    BigInt(timeBaseMatch[2]!),
  );
}

function decimalTimeToRational(raw: string): string {
  if (!raw || raw === "N/A") return "N/A";
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return "N/A";
  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = sign *
    (BigInt(match[2]!) * denominator + BigInt(fraction || "0"));
  return normalizeRational(numerator, denominator);
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}

export async function identifyFile(filePath: string): Promise<FileIdentity> {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`MEDIA_NOT_FILE:${filePath}`);
  return {
    path: filePath,
    bytes: info.size,
    sha256: await sha256File(filePath),
  };
}

function canonicalDisposition(value: unknown): Record<string, number> {
  const source = asObject(value);
  const result: Record<string, number> = {};
  for (const key of Object.keys(source).sort()) {
    result[key] = asInteger(source[key]);
  }
  return result;
}

function rotationFromStream(raw: JsonObject): number | null {
  const tags = asObject(raw["tags"]);
  if (/^-?\d+(?:\.\d+)?$/.test(asString(tags["rotate"]))) {
    return Number(tags["rotate"]);
  }
  const sideData = Array.isArray(raw["side_data_list"])
    ? raw["side_data_list"] as unknown[]
    : [];
  for (const entry of sideData) {
    const rotation = asObject(entry)["rotation"];
    if (typeof rotation === "number" && Number.isFinite(rotation)) return rotation;
  }
  return null;
}

function parseCompactPacketLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of line.split("|")) {
    const separator = part.indexOf("=");
    if (separator > 0) result[part.slice(0, separator)] = part.slice(separator + 1);
  }
  return result;
}

interface MutablePacketDigest {
  streamIndex: number;
  timeBase: string;
  hash: ReturnType<typeof createHash>;
  packetCount: number;
  totalPayloadBytes: bigint;
}

async function probeAllPacketDigests(input: {
  ffprobePath: string;
  mediaPath: string;
  streams: readonly { streamIndex: number; timeBase: string }[];
}): Promise<Map<number, { packetCount: number; totalPayloadBytes: string; digest: string }>> {
  const states = new Map<number, MutablePacketDigest>();
  for (const stream of input.streams) {
    states.set(stream.streamIndex, {
      streamIndex: stream.streamIndex,
      timeBase: stream.timeBase,
      hash: createHash("sha256"),
      packetCount: 0,
      totalPayloadBytes: 0n,
    });
  }
  const child = spawn(input.ffprobePath, [
    "-v", "error",
    "-show_packets",
    "-show_data_hash", "sha256",
    "-show_entries", "packet=stream_index,pts,dts,duration,size,flags,data_hash",
    "-of", "compact=p=0:nk=0",
    input.mediaPath,
  ], { windowsHide: true });
  if (!child.stdout || !child.stderr) {
    child.kill();
    throw new Error("FFPROBE_PACKET_STREAM_UNAVAILABLE");
  }
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
  });
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line.trim()) continue;
    const packet = parseCompactPacketLine(line);
    const streamIndex = Number(packet["stream_index"]);
    const state = states.get(streamIndex);
    if (!state) throw new Error(`PACKET_UNKNOWN_STREAM:${streamIndex}`);
    const payloadHash = (packet["data_hash"] ?? "")
      .replace(/^SHA256:/i, "")
      .toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(payloadHash)) {
      throw new Error(`PACKET_PAYLOAD_HASH_MISSING:${streamIndex}`);
    }
    const size = packet["size"] ?? "0";
    if (!/^\d+$/.test(size)) throw new Error(`PACKET_SIZE_INVALID:${size}`);
    state.hash.update([
      `pts=${timestampRational(packet["pts"] ?? "", state.timeBase)}`,
      `dts=${timestampRational(packet["dts"] ?? "", state.timeBase)}`,
      `duration=${timestampRational(packet["duration"] ?? "", state.timeBase)}`,
      `size=${size}`,
      `flags=${packet["flags"] ?? ""}`,
      `payloadSha256=${payloadHash}`,
    ].join(";"), "utf8");
    state.hash.update("\n", "utf8");
    state.packetCount += 1;
    state.totalPayloadBytes += BigInt(size);
  }
  const exitCode = await exit;
  if (exitCode !== 0) {
    throw new Error(`FFPROBE_PACKET_FAILED:${exitCode}:${stderr.trim()}`);
  }
  const result = new Map<number, {
    packetCount: number;
    totalPayloadBytes: string;
    digest: string;
  }>();
  for (const [streamIndex, state] of states) {
    result.set(streamIndex, {
      packetCount: state.packetCount,
      totalPayloadBytes: state.totalPayloadBytes.toString(),
      digest: state.hash.digest("hex"),
    });
  }
  return result;
}

export async function probeMediaDeliveryContract(input: {
  ffprobePath: string;
  mediaPath: string;
}): Promise<MediaDeliveryContract> {
  const ffprobePath = assertApprovedMediaRuntimePath("ffprobe", input.ffprobePath);
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-show_streams",
    "-show_format",
    "-show_chapters",
    "-show_data_hash", "sha256",
    "-of", "json",
    input.mediaPath,
  ], { maxBuffer: 8 * 1024 * 1024, encoding: "utf8" });
  const root = asObject(JSON.parse(stdout));
  const rawStreams = Array.isArray(root["streams"])
    ? root["streams"] as unknown[]
    : [];
  const indexedStreams = rawStreams.map((value, streamOrdinal) => {
    const raw = asObject(value);
    return {
      raw,
      streamOrdinal,
      streamIndex: asInteger(raw["index"]),
      timeBase: asString(raw["time_base"]),
    };
  });
  const packetDigests = await probeAllPacketDigests({
    ffprobePath,
    mediaPath: input.mediaPath,
    streams: indexedStreams,
  });
  const streams: MediaStreamContract[] = indexedStreams.map((indexed) => {
    const raw = indexed.raw;
    const tags = asObject(raw["tags"]);
    const timeBase = indexed.timeBase;
    const startPts = asScalarString(raw["start_pts"]);
    const durationTs = asScalarString(raw["duration_ts"]);
    const packet = packetDigests.get(indexed.streamIndex);
    const extradataHash = asString(raw["extradata_hash"])
      .replace(/^SHA256:/i, "")
      .toLowerCase();
    return {
      streamOrdinal: indexed.streamOrdinal,
      sourceStreamIndex: indexed.streamIndex,
      codecType: asString(raw["codec_type"]),
      codecName: asString(raw["codec_name"]),
      profile: asString(raw["profile"]),
      sampleRate: asString(raw["sample_rate"]),
      channels: asInteger(raw["channels"]),
      channelLayout: asString(raw["channel_layout"]),
      width: asInteger(raw["width"]),
      height: asInteger(raw["height"]),
      pixelFormat: asString(raw["pix_fmt"]),
      timeBase,
      startTimeRational: startPts && timeBase
        ? timestampRational(startPts, timeBase)
        : decimalTimeToRational(asString(raw["start_time"])),
      durationRational: durationTs && timeBase
        ? timestampRational(durationTs, timeBase)
        : decimalTimeToRational(asString(raw["duration"])),
      extradataHashSha256: /^[0-9a-f]{64}$/.test(extradataHash)
        ? extradataHash
        : "NOT_PRESENT",
      disposition: canonicalDisposition(raw["disposition"]),
      safeMetadata: {
        language: canonicalLanguage(tags["language"]),
        title: asString(tags["title"]),
      },
      rotationDegrees: rotationFromStream(raw),
      packetCount: packet?.packetCount ?? 0,
      totalPayloadBytes: packet?.totalPayloadBytes ?? "0",
      orderedPacketDigestSha256: packet?.digest ??
        createHash("sha256").digest("hex"),
      reportedContainerFields: {
        codecTagString: asString(raw["codec_tag_string"]),
        codecTag: asString(raw["codec_tag"]),
        startPts,
        startTime: asString(raw["start_time"]),
        durationTs,
        duration: asString(raw["duration"]),
      },
    };
  });
  const chaptersRaw = Array.isArray(root["chapters"])
    ? root["chapters"] as unknown[]
    : [];
  const chapters: ChapterContract[] = chaptersRaw.map((value, chapterOrdinal) => {
    const raw = asObject(value);
    const timeBase = asString(raw["time_base"]);
    const tags = asObject(raw["tags"]);
    return {
      chapterOrdinal,
      startTimeRational: timestampRational(asString(raw["start"]), timeBase),
      endTimeRational: timestampRational(asString(raw["end"]), timeBase),
      title: asString(tags["title"]),
    };
  });
  const format = asObject(root["format"]);
  const formatTags = asObject(format["tags"]);
  return {
    schemaVersion: "tancmark-video-primary-media-delivery-contract-v1",
    formatName: asString(format["format_name"]),
    formatLongName: asString(format["format_long_name"]),
    majorBrand: asString(formatTags["major_brand"]),
    compatibleBrands: asString(formatTags["compatible_brands"]),
    streams,
    chapters,
    safeFormatMetadata: {
      title: asString(formatTags["title"]),
      artist: asString(formatTags["artist"]),
      album: asString(formatTags["album"]),
      comment: asString(formatTags["comment"]),
      copyright: asString(formatTags["copyright"]),
    },
  };
}

function canonicalDeliveryContract(contract: MediaDeliveryContract): string {
  return JSON.stringify({
    chapters: contract.chapters,
    safeFormatMetadata: contract.safeFormatMetadata,
    streams: contract.streams.map((stream) => ({
      channelLayout: stream.channelLayout,
      channels: stream.channels,
      codecName: stream.codecName,
      codecType: stream.codecType,
      disposition: stream.disposition,
      durationRational: stream.durationRational,
      extradataHashSha256: stream.extradataHashSha256,
      height: stream.height,
      orderedPacketDigestSha256: stream.orderedPacketDigestSha256,
      packetCount: stream.packetCount,
      pixelFormat: stream.pixelFormat,
      profile: stream.profile,
      rotationDegrees: stream.rotationDegrees,
      safeMetadata: stream.safeMetadata,
      sampleRate: stream.sampleRate,
      sourceStreamIndex: stream.sourceStreamIndex,
      startTimeRational: stream.startTimeRational,
      streamOrdinal: stream.streamOrdinal,
      timeBase: stream.timeBase,
      totalPayloadBytes: stream.totalPayloadBytes,
      width: stream.width,
    })),
  });
}

export function deliveryContractsExact(
  source: MediaDeliveryContract,
  output: MediaDeliveryContract,
): boolean {
  return canonicalDeliveryContract(source) === canonicalDeliveryContract(output);
}

function webMobileCompatibility(contract: MediaDeliveryContract): {
  status: "SUPPORTED_PRIMARY_AV" | "NOT_SUPPORTED";
  primaryVideoCodec: string;
  audioCodecs: string[];
} {
  const video = contract.streams.find((stream) => stream.codecType === "video");
  const audio = contract.streams.filter((stream) => stream.codecType === "audio");
  const primaryVideoCodec = video?.codecName ?? "";
  const audioCodecs = audio.map((stream) => stream.codecName);
  const normalizedBrand = contract.majorBrand.trim().toLowerCase();
  const isoBmffMp4Brand = normalizedBrand === "mp42" ||
    normalizedBrand === "mp41" || normalizedBrand === "isom" ||
    normalizedBrand === "avc1" || /^iso\d$/.test(normalizedBrand);
  const supported = isoBmffMp4Brand &&
    contract.formatName.split(",").some((name) => name === "mp4") &&
    primaryVideoCodec === "h264" &&
    audio.length > 0 && audioCodecs.every((codec) => codec === "aac");
  return {
    status: supported ? "SUPPORTED_PRIMARY_AV" : "NOT_SUPPORTED",
    primaryVideoCodec,
    audioCodecs,
  };
}

export async function createVideoPrimaryMasterExactCopy(input: {
  sourcePath: string;
  outputPath: string;
}): Promise<MasterDeliveryResult> {
  const source = await identifyFile(input.sourcePath);
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  try {
    await stat(input.outputPath);
    throw new Error(`MASTER_OUTPUT_ALREADY_EXISTS:${input.outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("MASTER_OUTPUT_ALREADY_EXISTS")) {
      throw error;
    }
  }
  await copyFile(input.sourcePath, input.outputPath);
  const output = await identifyFile(input.outputPath);
  if (source.bytes !== output.bytes || source.sha256 !== output.sha256) {
    throw new Error("MASTER_EXACT_COPY_VERIFICATION_FAILED");
  }
  return {
    profile: VIDEO_PRIMARY_MASTER_PROFILE,
    status: "MASTER_EXACT_COPY_PASSED",
    source,
    output,
    byteExact: true,
  };
}

export async function createVideoPrimaryUserDelivery(input: {
  ffmpegPath: string;
  ffprobePath: string;
  sourcePath: string;
  outputPath: string;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
  videoIdentityDigestSha256: string;
  createdAt: string;
  key: AudioExactKeyMaterial;
}): Promise<UserDeliveryResult> {
  const ffmpegPath = assertApprovedMediaRuntimePath("ffmpeg", input.ffmpegPath);
  const ffprobePath = assertApprovedMediaRuntimePath("ffprobe", input.ffprobePath);
  const source = await identifyFile(input.sourcePath);
  const sourceContract = await probeMediaDeliveryContract({
    ffprobePath,
    mediaPath: input.sourcePath,
  });
  const sourceAudioManifest = await probeCanonicalExactAudioManifest({
    ffprobePath,
    mediaPath: input.sourcePath,
  });
  const signedAudioRecord = createSignedExactAudioIntegrityRecordV1({
    manifest: sourceAudioManifest,
    tenantId: input.tenantId,
    accountId: input.accountId,
    registryRecordId: input.registryRecordId,
    registryRevision: input.registryRevision,
    videoIdentityDigestSha256: input.videoIdentityDigestSha256,
    createdAt: input.createdAt,
    keyId: input.key.keyId,
    masterSecret: input.key.masterSecret,
    tenantSalt: input.key.tenantSalt,
  });
  const primaryVideo = sourceContract.streams.find((stream) =>
    stream.codecType === "video");
  const videoTimeBaseMatch = primaryVideo
    ? /^1\/(\d+)$/.exec(primaryVideo.timeBase)
    : null;
  const ffmpegArguments = [
    "-hide_banner", "-nostdin", "-y", "-copyts",
    "-i", input.sourcePath,
    "-map", "0",
    "-c", "copy",
    "-copy_unknown",
    "-map_metadata", "0",
    "-map_chapters", "0",
    "-copytb", "1",
    "-avoid_negative_ts", "disabled",
    ...(videoTimeBaseMatch
      ? ["-video_track_timescale", videoTimeBaseMatch[1]!]
      : []),
    "-movflags", "+faststart+use_metadata_tags",
  ];
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  try {
    await stat(input.outputPath);
    throw new Error(`USER_OUTPUT_ALREADY_EXISTS:${input.outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("USER_OUTPUT_ALREADY_EXISTS")) {
      throw error;
    }
  }
  const temporaryPath = `${input.outputPath}.partial-${randomBytes(8).toString("hex")}.mp4`;
  const fullArguments = [...ffmpegArguments, "-f", "mp4", temporaryPath];
  let outputContract: MediaDeliveryContract | undefined;
  let outputAudioManifest: ExactAudioManifestProbe | undefined;
  let audioIntegrity: AudioExactIntegrityVerification = {
    status: "AUDIO_EXACT_INTEGRITY_NOT_MEASURED",
    reason: "PROBE_NOT_RUN",
    signedRecordVerified: false,
    outputManifestMeasured: false,
    exactMatch: false,
  };
  let streamContractExact = false;
  let deliveryOperation: UserDeliveryResult["deliveryOperation"] = "NONE";
  let ffmpegExecuted = false;
  let compatibility: UserDeliveryResult["webMobileCompatibility"] = {
    status: "NOT_MEASURED",
    primaryVideoCodec: "",
    audioCodecs: [],
  };
  try {
    const sourceCompatibility = webMobileCompatibility(sourceContract);
    if (sourceCompatibility.status === "SUPPORTED_PRIMARY_AV") {
      await copyFile(input.sourcePath, temporaryPath);
      deliveryOperation = "FILE_EXACT_COPY";
    } else {
      ffmpegExecuted = true;
      await execFileAsync(ffmpegPath, fullArguments, {
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
      });
      deliveryOperation = "FFMPEG_STREAM_COPY_REMUX";
    }
    outputContract = await probeMediaDeliveryContract({
      ffprobePath,
      mediaPath: temporaryPath,
    });
    outputAudioManifest = await probeCanonicalExactAudioManifest({
      ffprobePath,
      mediaPath: temporaryPath,
    });
    audioIntegrity = verifySignedExactAudioIntegrityRecordV1({
      envelope: signedAudioRecord,
      outputManifest: outputAudioManifest,
      expectedTenantId: input.tenantId,
      expectedAccountId: input.accountId,
      expectedRegistryRecordId: input.registryRecordId,
      expectedRegistryRevision: input.registryRevision,
      expectedVideoIdentityDigestSha256: input.videoIdentityDigestSha256,
      key: input.key,
    });
    streamContractExact = deliveryContractsExact(sourceContract, outputContract);
    compatibility = webMobileCompatibility(outputContract);
    if (!streamContractExact) throw new Error("MEDIA_STREAM_OR_METADATA_CONTRACT_CHANGED");
    if (audioIntegrity.status !== "AUDIO_EXACT_INTEGRITY_MATCH") {
      throw new Error(`AUDIO_EXACT_INTEGRITY_GATE_FAILED:${audioIntegrity.reason}`);
    }
    if (compatibility.status !== "SUPPORTED_PRIMARY_AV") {
      throw new Error("WEB_MOBILE_PRIMARY_AV_NOT_SUPPORTED");
    }
    await rename(temporaryPath, input.outputPath);
    return {
      profile: VIDEO_PRIMARY_USER_DELIVERY_PROFILE,
      status: "USER_DELIVERY_PASSED",
      reason: "STREAM_COPY_ALL_CONTRACTS_VERIFIED",
      outputProduced: true,
      deliveryOperation,
      ffmpegExecuted,
      source,
      output: await identifyFile(input.outputPath),
      sourceContract,
      outputContract,
      streamContractExact,
      audioIntegrity,
      signedAudioRecord,
      sourceAudioManifest,
      outputAudioManifest,
      webMobileCompatibility: compatibility,
      ffmpegArguments: fullArguments,
    };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    return {
      profile: VIDEO_PRIMARY_USER_DELIVERY_PROFILE,
      status: "USER_DELIVERY_FAIL_CLOSED",
      reason: error instanceof Error ? error.message : String(error),
      outputProduced: false,
      deliveryOperation,
      ffmpegExecuted,
      source,
      sourceContract,
      ...(outputContract ? { outputContract } : {}),
      streamContractExact,
      audioIntegrity,
      signedAudioRecord,
      sourceAudioManifest,
      ...(outputAudioManifest ? { outputAudioManifest } : {}),
      webMobileCompatibility: compatibility,
      ffmpegArguments: fullArguments,
    };
  }
}
