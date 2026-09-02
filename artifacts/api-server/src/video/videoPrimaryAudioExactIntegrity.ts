import {
  canonicalizeVaultPayload,
  deriveVaultKeypair,
  signVaultAnchor,
  verifyVaultAnchorRaw,
} from "@workspace/aegis-core";
import { execFile, spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { assertApprovedMediaRuntimePath } from "./mediaRuntimePathResolver";

const execFileAsync = promisify(execFile);

export const VIDEO_PRIMARY_AUDIO_EXACT_RECORD_SCHEMA =
  "tancmark-video-primary-audio-exact-integrity-record-v1" as const;
export const VIDEO_PRIMARY_AUDIO_EXACT_SIGNATURE_VERSION =
  "tancmark-vault-ml-dsa-65-v1" as const;

const PIPELINE_PREFIX = "VIDEO_PRIMARY_AUDIO_EXACT_INTEGRITY_V1:";
const COMMITMENT_PREFIX = "audio-exact-manifest-sha256:";
const AUDIO_SCOPE =
  "CANONICAL_PACKET_PAYLOAD_PLUS_NORMALIZED_TIMELINE_AND_TECHNICAL_PROPERTIES_ONLY" as const;

type JsonObject = Record<string, unknown>;

export interface CanonicalAudioStreamTechnical {
  streamIndex: number;
  audioOrdinal: number;
  codecName: string;
  profile: string;
  sampleFormat: string;
  sampleRate: string;
  channels: number;
  channelLayout: string;
  bitsPerSample: number;
  initialPadding: number;
  trailingPadding: number;
  timeBase: string;
  startTimeRational: string;
  durationRational: string;
  extradataHashSha256: string;
  disposition: Record<string, number>;
  safeMetadata: {
    language: string;
    title: string;
  };
  reportedContainerFields: {
    codecTagString: string;
    codecTag: string;
    startPts: string;
    startTime: string;
    durationTs: string;
    duration: string;
  };
}

export interface CanonicalAudioPacketSummary {
  streamIndex: number;
  packetCount: number;
  totalPayloadBytes: string;
  firstPtsRational: string;
  lastPtsRational: string;
  orderedPacketDigestSha256: string;
}

export interface CanonicalExactAudioManifest {
  schemaVersion: "tancmark-canonical-exact-audio-manifest-v1";
  scope: typeof AUDIO_SCOPE;
  audioStreamCount: number;
  streams: CanonicalAudioStreamTechnical[];
  packetSummaries: CanonicalAudioPacketSummary[];
}

export interface ExactAudioManifestProbe {
  manifest: CanonicalExactAudioManifest;
  manifestCanonical: string;
  manifestDigestSha256: string;
}

export interface SignedExactAudioIntegrityRecordV1 {
  schemaVersion: typeof VIDEO_PRIMARY_AUDIO_EXACT_RECORD_SCHEMA;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
  videoIdentityDigestSha256: string;
  audioManifestDigestSha256: string;
  audioStreamCount: number;
  exactIntegrityScope: typeof AUDIO_SCOPE;
  createdAt: string;
  keyId: string;
  signatureVersion: typeof VIDEO_PRIMARY_AUDIO_EXACT_SIGNATURE_VERSION;
}

export interface SignedExactAudioIntegrityAuthorizationV1 {
  algorithm: "ml-dsa-65";
  keyDerivation: "hkdf-v1";
  keyId: string;
  signatureVersion: typeof VIDEO_PRIMARY_AUDIO_EXACT_SIGNATURE_VERSION;
  publicKeyBase64: string;
  signatureBase64: string;
  payloadCanonical: string;
  payloadDigestSha256: string;
  signedAt: string;
}

export interface SignedExactAudioIntegrityEnvelopeV1 {
  record: SignedExactAudioIntegrityRecordV1;
  recordCanonical: string;
  recordDigestSha256: string;
  authorization: SignedExactAudioIntegrityAuthorizationV1;
}

export type AudioExactIntegrityStatus =
  | "AUDIO_EXACT_INTEGRITY_MATCH"
  | "AUDIO_EXACT_INTEGRITY_CHANGED"
  | "AUDIO_EXACT_INTEGRITY_NOT_MEASURED";

export interface AudioExactIntegrityVerification {
  status: AudioExactIntegrityStatus;
  reason:
    | "MATCH"
    | "OUTPUT_MANIFEST_CHANGED"
    | "CONTEXT_MISMATCH"
    | "RECORD_CANONICAL_MISMATCH"
    | "RECORD_DIGEST_MISMATCH"
    | "KEY_UNAVAILABLE"
    | "KEY_REVOKED"
    | "PUBLIC_KEY_MISMATCH"
    | "AUTHORIZATION_CONTEXT_MISMATCH"
    | "AUTHORIZATION_METADATA_MISMATCH"
    | "AUTHORIZATION_DIGEST_MISMATCH"
    | "SIGNATURE_INVALID"
    | "OUTPUT_MANIFEST_CANONICAL_MISMATCH"
    | "OUTPUT_MANIFEST_DIGEST_MISMATCH"
    | "PROBE_NOT_RUN";
  signedRecordVerified: boolean;
  outputManifestMeasured: boolean;
  exactMatch: boolean;
}

export interface AudioExactKeyMaterial {
  keyId: string;
  masterSecret: Buffer | Uint8Array;
  tenantSalt: string;
  revoked: boolean;
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

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
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
  if (denominator === 0n) throw new Error("AUDIO_TIME_BASE_ZERO");
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  return `${n / divisor}/${d / divisor}`;
}

function parseTimeBase(timeBase: string): [bigint, bigint] {
  const match = /^(-?\d+)\/(-?\d+)$/.exec(timeBase);
  if (!match) throw new Error(`AUDIO_TIME_BASE_INVALID:${timeBase}`);
  return [BigInt(match[1]!), BigInt(match[2]!)];
}

function timestampRational(raw: string, timeBase: string): string {
  if (!raw || raw === "N/A") return "N/A";
  if (!/^-?\d+$/.test(raw)) throw new Error(`AUDIO_TIMESTAMP_INVALID:${raw}`);
  const [tbNumerator, tbDenominator] = parseTimeBase(timeBase);
  return normalizeRational(BigInt(raw) * tbNumerator, tbDenominator);
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

function canonicalDisposition(value: unknown): Record<string, number> {
  const source = asObject(value);
  const result: Record<string, number> = {};
  for (const key of Object.keys(source).sort()) {
    result[key] = asInteger(source[key]);
  }
  return result;
}

function canonicalStream(raw: JsonObject, ordinal: number): CanonicalAudioStreamTechnical {
  const tags = asObject(raw["tags"]);
  const timeBase = asString(raw["time_base"]);
  const startPts = asScalarString(raw["start_pts"]);
  const durationTs = asScalarString(raw["duration_ts"]);
  const startTime = asString(raw["start_time"]);
  const duration = asString(raw["duration"]);
  const extradataHash = asString(raw["extradata_hash"])
    .replace(/^SHA256:/i, "")
    .toLowerCase();
  return {
    streamIndex: asInteger(raw["index"]),
    audioOrdinal: ordinal,
    codecName: asString(raw["codec_name"]),
    profile: asString(raw["profile"]),
    sampleFormat: asString(raw["sample_fmt"]),
    sampleRate: asString(raw["sample_rate"]),
    channels: asInteger(raw["channels"]),
    channelLayout: asString(raw["channel_layout"]),
    bitsPerSample: asInteger(raw["bits_per_sample"]),
    initialPadding: asInteger(raw["initial_padding"]),
    trailingPadding: asInteger(raw["trailing_padding"]),
    timeBase,
    startTimeRational: startPts && timeBase
      ? timestampRational(startPts, timeBase)
      : decimalTimeToRational(startTime),
    durationRational: durationTs && timeBase
      ? timestampRational(durationTs, timeBase)
      : decimalTimeToRational(duration),
    extradataHashSha256: isSha256(extradataHash) ? extradataHash : "NOT_PRESENT",
    disposition: canonicalDisposition(raw["disposition"]),
    safeMetadata: {
      language: canonicalLanguage(tags["language"]),
      title: asString(tags["title"]),
    },
    reportedContainerFields: {
      codecTagString: asString(raw["codec_tag_string"]),
      codecTag: asString(raw["codec_tag"]),
      startPts,
      startTime,
      durationTs,
      duration,
    },
  };
}

function parseCompactPacketLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of line.split("|")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    result[part.slice(0, separator)] = part.slice(separator + 1);
  }
  return result;
}

interface MutablePacketSummary {
  streamIndex: number;
  timeBase: string;
  hash: ReturnType<typeof createHash>;
  packetCount: number;
  totalPayloadBytes: bigint;
  firstPtsRational: string;
  lastPtsRational: string;
}

async function probePacketSummaries(input: {
  ffprobePath: string;
  mediaPath: string;
  streams: readonly CanonicalAudioStreamTechnical[];
}): Promise<CanonicalAudioPacketSummary[]> {
  const mutable = new Map<number, MutablePacketSummary>();
  for (const stream of input.streams) {
    mutable.set(stream.streamIndex, {
      streamIndex: stream.streamIndex,
      timeBase: stream.timeBase,
      hash: createHash("sha256"),
      packetCount: 0,
      totalPayloadBytes: 0n,
      firstPtsRational: "N/A",
      lastPtsRational: "N/A",
    });
  }
  const child = spawn(input.ffprobePath, [
    "-v", "error",
    "-select_streams", "a",
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
    const state = mutable.get(streamIndex);
    if (!state) throw new Error(`AUDIO_PACKET_UNKNOWN_STREAM:${streamIndex}`);
    const payloadHash = (packet["data_hash"] ?? "")
      .replace(/^SHA256:/i, "")
      .toLowerCase();
    if (!isSha256(payloadHash)) {
      throw new Error(`AUDIO_PACKET_PAYLOAD_HASH_MISSING:${streamIndex}`);
    }
    const pts = timestampRational(packet["pts"] ?? "", state.timeBase);
    const dts = timestampRational(packet["dts"] ?? "", state.timeBase);
    const duration = timestampRational(packet["duration"] ?? "", state.timeBase);
    const size = packet["size"] ?? "0";
    if (!/^\d+$/.test(size)) throw new Error(`AUDIO_PACKET_SIZE_INVALID:${size}`);
    const canonicalPacket = [
      `stream=${streamIndex}`,
      `pts=${pts}`,
      `dts=${dts}`,
      `duration=${duration}`,
      `size=${size}`,
      `flags=${packet["flags"] ?? ""}`,
      `payloadSha256=${payloadHash}`,
    ].join(";");
    state.hash.update(canonicalPacket, "utf8");
    state.hash.update("\n", "utf8");
    state.packetCount += 1;
    state.totalPayloadBytes += BigInt(size);
    if (state.firstPtsRational === "N/A") state.firstPtsRational = pts;
    state.lastPtsRational = pts;
  }
  const exitCode = await exit;
  if (exitCode !== 0) {
    throw new Error(`FFPROBE_PACKET_FAILED:${exitCode}:${stderr.trim()}`);
  }
  return [...mutable.values()]
    .sort((left, right) => left.streamIndex - right.streamIndex)
    .map((state) => ({
      streamIndex: state.streamIndex,
      packetCount: state.packetCount,
      totalPayloadBytes: state.totalPayloadBytes.toString(),
      firstPtsRational: state.firstPtsRational,
      lastPtsRational: state.lastPtsRational,
      orderedPacketDigestSha256: state.hash.digest("hex"),
    }));
}

export function canonicalizeExactAudioManifest(
  manifest: CanonicalExactAudioManifest,
): string {
  return JSON.stringify({
    audioStreamCount: manifest.audioStreamCount,
    packetSummaries: manifest.packetSummaries.map((summary) => ({
      firstPtsRational: summary.firstPtsRational,
      lastPtsRational: summary.lastPtsRational,
      orderedPacketDigestSha256: summary.orderedPacketDigestSha256,
      packetCount: summary.packetCount,
      streamIndex: summary.streamIndex,
      totalPayloadBytes: summary.totalPayloadBytes,
    })),
    schemaVersion: manifest.schemaVersion,
    scope: manifest.scope,
    streams: manifest.streams.map((stream) => ({
      audioOrdinal: stream.audioOrdinal,
      bitsPerSample: stream.bitsPerSample,
      channelLayout: stream.channelLayout,
      channels: stream.channels,
      codecName: stream.codecName,
      disposition: stream.disposition,
      durationRational: stream.durationRational,
      extradataHashSha256: stream.extradataHashSha256,
      initialPadding: stream.initialPadding,
      profile: stream.profile,
      safeMetadata: stream.safeMetadata,
      sampleFormat: stream.sampleFormat,
      sampleRate: stream.sampleRate,
      startTimeRational: stream.startTimeRational,
      streamIndex: stream.streamIndex,
      timeBase: stream.timeBase,
      trailingPadding: stream.trailingPadding,
    })),
  });
}

export async function probeCanonicalExactAudioManifest(input: {
  ffprobePath: string;
  mediaPath: string;
}): Promise<ExactAudioManifestProbe> {
  const ffprobePath = assertApprovedMediaRuntimePath("ffprobe", input.ffprobePath);
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-select_streams", "a",
    "-show_streams",
    "-show_data_hash", "sha256",
    "-of", "json",
    input.mediaPath,
  ], { maxBuffer: 4 * 1024 * 1024, encoding: "utf8" });
  const parsed = asObject(JSON.parse(stdout));
  const rawStreams = Array.isArray(parsed["streams"])
    ? parsed["streams"] as unknown[]
    : [];
  const streams = rawStreams
    .map((value, ordinal) => canonicalStream(asObject(value), ordinal))
    .sort((left, right) => left.streamIndex - right.streamIndex);
  const packetSummaries = await probePacketSummaries({
    ffprobePath,
    mediaPath: input.mediaPath,
    streams,
  });
  const manifest: CanonicalExactAudioManifest = {
    schemaVersion: "tancmark-canonical-exact-audio-manifest-v1",
    scope: AUDIO_SCOPE,
    audioStreamCount: streams.length,
    streams,
    packetSummaries,
  };
  const manifestCanonical = canonicalizeExactAudioManifest(manifest);
  return {
    manifest,
    manifestCanonical,
    manifestDigestSha256: sha256Utf8(manifestCanonical),
  };
}

export function canonicalizeSignedExactAudioIntegrityRecordV1(
  record: SignedExactAudioIntegrityRecordV1,
): string {
  return JSON.stringify({
    accountId: record.accountId,
    audioManifestDigestSha256: record.audioManifestDigestSha256,
    audioStreamCount: record.audioStreamCount,
    createdAt: record.createdAt,
    exactIntegrityScope: record.exactIntegrityScope,
    keyId: record.keyId,
    registryRecordId: record.registryRecordId,
    registryRevision: record.registryRevision,
    schemaVersion: record.schemaVersion,
    signatureVersion: record.signatureVersion,
    tenantId: record.tenantId,
    videoIdentityDigestSha256: record.videoIdentityDigestSha256,
  });
}

export function createSignedExactAudioIntegrityRecordV1(input: {
  manifest: ExactAudioManifestProbe;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
  videoIdentityDigestSha256: string;
  createdAt: string;
  keyId: string;
  masterSecret: Buffer | Uint8Array;
  tenantSalt: string;
}): SignedExactAudioIntegrityEnvelopeV1 {
  if (!isSha256(input.videoIdentityDigestSha256.toLowerCase())) {
    throw new Error("VIDEO_IDENTITY_DIGEST_INVALID");
  }
  if (!Number.isInteger(input.registryRevision) || input.registryRevision < 1) {
    throw new Error("REGISTRY_REVISION_INVALID");
  }
  const record: SignedExactAudioIntegrityRecordV1 = {
    schemaVersion: VIDEO_PRIMARY_AUDIO_EXACT_RECORD_SCHEMA,
    tenantId: input.tenantId,
    accountId: input.accountId,
    registryRecordId: input.registryRecordId,
    registryRevision: input.registryRevision,
    videoIdentityDigestSha256: input.videoIdentityDigestSha256.toLowerCase(),
    audioManifestDigestSha256: input.manifest.manifestDigestSha256,
    audioStreamCount: input.manifest.manifest.audioStreamCount,
    exactIntegrityScope: AUDIO_SCOPE,
    createdAt: input.createdAt,
    keyId: input.keyId,
    signatureVersion: VIDEO_PRIMARY_AUDIO_EXACT_SIGNATURE_VERSION,
  };
  const recordCanonical = canonicalizeSignedExactAudioIntegrityRecordV1(record);
  const recordDigestSha256 = sha256Utf8(recordCanonical);
  const anchor = signVaultAnchor({
    masterSecret: input.masterSecret,
    tenantSalt: input.tenantSalt,
    clientId: input.accountId,
    docId: input.registryRecordId,
    cloakId: record.videoIdentityDigestSha256,
    payload: {
      cloakId: record.videoIdentityDigestSha256,
      clientId: record.accountId,
      docId: record.registryRecordId,
      keyVersion: record.keyId,
      pipelineVersion: `${PIPELINE_PREFIX}${record.signatureVersion}`,
      protectionHash: `${COMMITMENT_PREFIX}${recordDigestSha256}`,
      cascadeRoot: record.audioManifestDigestSha256,
      issuedAt: record.createdAt,
    },
  });
  return {
    record,
    recordCanonical,
    recordDigestSha256,
    authorization: {
      algorithm: anchor.algorithm,
      keyDerivation: anchor.keyDerivation,
      keyId: input.keyId,
      signatureVersion: record.signatureVersion,
      publicKeyBase64: Buffer.from(anchor.publicKey).toString("base64"),
      signatureBase64: Buffer.from(anchor.signature).toString("base64"),
      payloadCanonical: anchor.payloadCanonical,
      payloadDigestSha256: anchor.payloadDigestSha256,
      signedAt: record.createdAt,
    },
  };
}

function notMeasured(
  reason: Exclude<AudioExactIntegrityVerification["reason"], "MATCH" | "OUTPUT_MANIFEST_CHANGED">,
): AudioExactIntegrityVerification {
  return {
    status: "AUDIO_EXACT_INTEGRITY_NOT_MEASURED",
    reason,
    signedRecordVerified: false,
    outputManifestMeasured: false,
    exactMatch: false,
  };
}

export function verifySignedExactAudioIntegrityRecordV1(input: {
  envelope: SignedExactAudioIntegrityEnvelopeV1;
  outputManifest?: ExactAudioManifestProbe;
  expectedTenantId: string;
  expectedAccountId: string;
  expectedRegistryRecordId: string;
  expectedRegistryRevision: number;
  expectedVideoIdentityDigestSha256: string;
  key?: AudioExactKeyMaterial;
}): AudioExactIntegrityVerification {
  const record = input.envelope.record;
  if (record.tenantId !== input.expectedTenantId ||
      record.accountId !== input.expectedAccountId ||
      record.registryRecordId !== input.expectedRegistryRecordId ||
      record.registryRevision !== input.expectedRegistryRevision ||
      record.videoIdentityDigestSha256 !==
        input.expectedVideoIdentityDigestSha256.toLowerCase()) {
    return notMeasured("CONTEXT_MISMATCH");
  }
  const canonical = canonicalizeSignedExactAudioIntegrityRecordV1(record);
  if (canonical !== input.envelope.recordCanonical) {
    return notMeasured("RECORD_CANONICAL_MISMATCH");
  }
  const digest = sha256Utf8(canonical);
  if (digest !== input.envelope.recordDigestSha256) {
    return notMeasured("RECORD_DIGEST_MISMATCH");
  }
  if (!input.key || input.key.keyId !== record.keyId) {
    return notMeasured("KEY_UNAVAILABLE");
  }
  if (input.key.revoked) return notMeasured("KEY_REVOKED");
  const expectedKeypair = deriveVaultKeypair({
    masterSecret: input.key.masterSecret,
    tenantSalt: input.key.tenantSalt,
    clientId: record.accountId,
    docId: record.registryRecordId,
    cloakId: record.videoIdentityDigestSha256,
  });
  const auth = input.envelope.authorization;
  if (record.schemaVersion !== VIDEO_PRIMARY_AUDIO_EXACT_RECORD_SCHEMA ||
      record.signatureVersion !== VIDEO_PRIMARY_AUDIO_EXACT_SIGNATURE_VERSION ||
      record.exactIntegrityScope !== AUDIO_SCOPE ||
      auth.algorithm !== "ml-dsa-65" ||
      auth.keyDerivation !== "hkdf-v1" ||
      auth.keyId !== record.keyId ||
      auth.signatureVersion !== record.signatureVersion ||
      auth.signedAt !== record.createdAt) {
    return notMeasured("AUTHORIZATION_METADATA_MISMATCH");
  }
  const storedPublicKey = Buffer.from(auth.publicKeyBase64, "base64");
  const expectedPublicKey = Buffer.from(expectedKeypair.publicKey);
  if (storedPublicKey.length !== expectedPublicKey.length ||
      !timingSafeEqual(storedPublicKey, expectedPublicKey)) {
    return notMeasured("PUBLIC_KEY_MISMATCH");
  }
  const expectedAuthorizationPayload = {
    cloakId: record.videoIdentityDigestSha256,
    clientId: record.accountId,
    docId: record.registryRecordId,
    keyVersion: record.keyId,
    pipelineVersion: `${PIPELINE_PREFIX}${record.signatureVersion}`,
    protectionHash: `${COMMITMENT_PREFIX}${digest}`,
    cascadeRoot: record.audioManifestDigestSha256,
    issuedAt: record.createdAt,
  };
  if (canonicalizeVaultPayload(expectedAuthorizationPayload) !==
      auth.payloadCanonical) {
    return notMeasured("AUTHORIZATION_CONTEXT_MISMATCH");
  }
  if (sha256Utf8(auth.payloadCanonical) !== auth.payloadDigestSha256) {
    return notMeasured("AUTHORIZATION_DIGEST_MISMATCH");
  }
  if (!verifyVaultAnchorRaw({
    publicKey: storedPublicKey,
    payloadCanonical: auth.payloadCanonical,
    signature: Buffer.from(auth.signatureBase64, "base64"),
  })) {
    return notMeasured("SIGNATURE_INVALID");
  }
  if (!input.outputManifest) {
    return {
      ...notMeasured("PROBE_NOT_RUN"),
      signedRecordVerified: true,
    };
  }
  const outputManifestCanonical = canonicalizeExactAudioManifest(
    input.outputManifest.manifest,
  );
  if (outputManifestCanonical !== input.outputManifest.manifestCanonical) {
    return {
      ...notMeasured("OUTPUT_MANIFEST_CANONICAL_MISMATCH"),
      signedRecordVerified: true,
    };
  }
  const outputManifestDigestSha256 = sha256Utf8(outputManifestCanonical);
  if (outputManifestDigestSha256 !==
      input.outputManifest.manifestDigestSha256) {
    return {
      ...notMeasured("OUTPUT_MANIFEST_DIGEST_MISMATCH"),
      signedRecordVerified: true,
    };
  }
  const exactMatch = outputManifestDigestSha256 ===
    record.audioManifestDigestSha256;
  return {
    status: exactMatch
      ? "AUDIO_EXACT_INTEGRITY_MATCH"
      : "AUDIO_EXACT_INTEGRITY_CHANGED",
    reason: exactMatch ? "MATCH" : "OUTPUT_MANIFEST_CHANGED",
    signedRecordVerified: true,
    outputManifestMeasured: true,
    exactMatch,
  };
}
