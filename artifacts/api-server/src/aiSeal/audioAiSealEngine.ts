import { createHash } from "node:crypto";

export const AUDIO_AI_SEAL_FEATURE_FLAG =
  "TANCMARK_AI_SEAL_AUDIO_ENABLED" as const;

export const AUDIO_AI_SEAL_DECISION_ROLE =
  "audio_ai_exact_id_ownership_no_vault_no_final" as const;

export const AUDIO_AI_SEAL_VERSION = "tancmark-ai-seal-audio-mvp-v1" as const;

export type AudioAiSealDisplayText =
  | "AI kesin ID okundu"
  | "AI destek izi bulunamadi"
  | "Zayif AI sinyal var";

export type AudioAiSealOwnershipDecision =
  | "ai_ownership_asserted_by_exact_id"
  | "ai_weak_trace_percent_only"
  | "ai_ownership_not_asserted";

export interface AudioAiSealGate {
  module: "audio_ai_seal";
  enabled: boolean;
  featureFlag: typeof AUDIO_AI_SEAL_FEATURE_FLAG;
  defaultEnabled: false;
  productReady: false;
  decisionRole: typeof AUDIO_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface SealAudioAiMediaInput {
  audio: Buffer;
  tancmarkId: string;
}

export interface SealAudioAiMediaResult {
  audio: Buffer;
  aiSealEmbedded: true;
  sourceAudioMutated: false;
  markerCopiesWritten: number;
  containerStrategy: "wav_custom_chunk_and_tail_marker" | "tail_marker_only";
  decisionRole: typeof AUDIO_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface ReadAudioAiSealInput {
  audio: Buffer;
  expectedTancmarkId: string;
}

export interface ReadAudioAiSealResult {
  found: boolean;
  weakSignal: boolean;
  score: number;
  markerCopiesFound: number;
  displayText: AudioAiSealDisplayText;
  decisionRole: typeof AUDIO_AI_SEAL_DECISION_ROLE;
  canAssertAiOwnership: boolean;
  aiOwnershipDecision: AudioAiSealOwnershipDecision;
  ownershipConfidencePercent: number;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

const MAX_SUPPORTED_AUDIO_BYTES = 120 * 1024 * 1024;
const MARKER_BEGIN = "TANCMARK_AUDIO_AI_SEAL_BEGIN_V1";
const MARKER_END = "TANCMARK_AUDIO_AI_SEAL_END_V1";

export function getAudioAiSealGate(
  env: NodeJS.ProcessEnv = process.env,
): AudioAiSealGate {
  return {
    module: "audio_ai_seal",
    enabled:
      env[AUDIO_AI_SEAL_FEATURE_FLAG] === "1" ||
      env[AUDIO_AI_SEAL_FEATURE_FLAG] === "true",
    featureFlag: AUDIO_AI_SEAL_FEATURE_FLAG,
    defaultEnabled: false,
    productReady: false,
    decisionRole: AUDIO_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export async function sealAudioAiMedia(
  input: SealAudioAiMediaInput,
): Promise<SealAudioAiMediaResult> {
  assertAudioAiFeatureEnabled();
  assertSafeId(input.tancmarkId);
  assertSafeAudioSize(input.audio);
  assertSupportedAudioContainer(input.audio);

  const marker = createMarker(input.tancmarkId);
  if (isWave(input.audio)) {
    return {
      audio: Buffer.concat([appendWaveChunk(input.audio, marker), marker]),
      aiSealEmbedded: true,
      sourceAudioMutated: false,
      markerCopiesWritten: 2,
      containerStrategy: "wav_custom_chunk_and_tail_marker",
      decisionRole: AUDIO_AI_SEAL_DECISION_ROLE,
      canOpenVault: false,
      canConfirmFinal: false,
      externalApiUsed: false,
      modelDownloaded: false,
    };
  }

  return {
    audio: Buffer.concat([input.audio, marker]),
    aiSealEmbedded: true,
    sourceAudioMutated: false,
    markerCopiesWritten: 1,
    containerStrategy: "tail_marker_only",
    decisionRole: AUDIO_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export async function readAudioAiSeal(
  input: ReadAudioAiSealInput,
): Promise<ReadAudioAiSealResult> {
  assertAudioAiFeatureEnabled();
  assertSafeId(input.expectedTancmarkId);
  assertSafeAudioSize(input.audio);
  assertSupportedAudioContainer(input.audio);

  const expectedTag = createIdTag(input.expectedTancmarkId);
  const allMarkers = extractMarkers(input.audio);
  const markerCopiesFound = allMarkers.filter(
    (marker) => marker.idTag === expectedTag && marker.format === "audio",
  ).length;
  const found = markerCopiesFound >= 1;
  const weakSignal = !found && allMarkers.length > 0;
  const score = found ? Math.min(1, markerCopiesFound / 2) : weakSignal ? 0.35 : 0;
  const ownershipConfidencePercent = found
    ? markerCopiesFound >= 2
      ? 100
      : 95
    : weakSignal
      ? 35
      : 0;

  return {
    found,
    weakSignal,
    score,
    markerCopiesFound,
    displayText: found
      ? "AI kesin ID okundu"
      : weakSignal
        ? "Zayif AI sinyal var"
        : "AI destek izi bulunamadi",
    decisionRole: AUDIO_AI_SEAL_DECISION_ROLE,
    canAssertAiOwnership: found,
    aiOwnershipDecision: found
      ? "ai_ownership_asserted_by_exact_id"
      : weakSignal
        ? "ai_weak_trace_percent_only"
        : "ai_ownership_not_asserted",
    ownershipConfidencePercent,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

function assertAudioAiFeatureEnabled() {
  if (!getAudioAiSealGate().enabled) {
    throw new Error("audio_ai_seal_feature_flag_disabled");
  }
}

function assertSafeId(value: string) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(value)) {
    throw new Error("invalid_audio_ai_seal_tancmark_id");
  }
}

function assertSafeAudioSize(audio: Buffer) {
  if (audio.length <= 0 || audio.length > MAX_SUPPORTED_AUDIO_BYTES) {
    throw new Error("unsafe_audio_ai_seal_size");
  }
}

function assertSupportedAudioContainer(audio: Buffer) {
  if (isWave(audio) || isMp3(audio) || isMp4Audio(audio) || isOgg(audio) || isFlac(audio)) return;
  throw new Error("unsupported_audio_ai_seal_container");
}

function isWave(audio: Buffer): boolean {
  return (
    audio.length >= 12 &&
    audio.toString("ascii", 0, 4) === "RIFF" &&
    audio.toString("ascii", 8, 12) === "WAVE"
  );
}

function isMp3(audio: Buffer): boolean {
  return (
    audio.length >= 3 &&
    (audio.toString("ascii", 0, 3) === "ID3" ||
      (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0))
  );
}

function isMp4Audio(audio: Buffer): boolean {
  if (audio.length < 16) return false;
  const size = audio.readUInt32BE(0);
  return size >= 8 && size <= audio.length && audio.toString("ascii", 4, 8) === "ftyp";
}

function isOgg(audio: Buffer): boolean {
  return audio.length >= 4 && audio.toString("ascii", 0, 4) === "OggS";
}

function isFlac(audio: Buffer): boolean {
  return audio.length >= 4 && audio.toString("ascii", 0, 4) === "fLaC";
}

function appendWaveChunk(audio: Buffer, marker: Buffer): Buffer {
  const chunkSize = marker.length + (marker.length % 2);
  const header = Buffer.alloc(8);
  header.write("TMAI", 0, 4, "ascii");
  header.writeUInt32LE(marker.length, 4);
  const padding = marker.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0);
  const next = Buffer.concat([audio, header, marker, padding]);
  next.writeUInt32LE(next.length - 8, 4);
  return next;
}

function createMarker(tancmarkId: string): Buffer {
  const payload = {
    version: AUDIO_AI_SEAL_VERSION,
    role: AUDIO_AI_SEAL_DECISION_ROLE,
    format: "audio",
    idTag: createIdTag(tancmarkId),
    vault: false,
    final: false,
  };
  const body = JSON.stringify({
    ...payload,
    checksum: createHash("sha256")
      .update(payload.version)
      .update(":")
      .update(payload.role)
      .update(":")
      .update(payload.format)
      .update(":")
      .update(payload.idTag)
      .digest("hex"),
  });
  return Buffer.from(`\n${MARKER_BEGIN}\n${body}\n${MARKER_END}\n`, "utf8");
}

function createIdTag(tancmarkId: string): string {
  return createHash("sha256")
    .update(AUDIO_AI_SEAL_VERSION)
    .update(":")
    .update(tancmarkId)
    .digest("hex");
}

function extractMarkers(audio: Buffer): Array<{ idTag: string; format: string }> {
  const text = audio.toString("latin1");
  const markers: Array<{ idTag: string; format: string }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const begin = text.indexOf(MARKER_BEGIN, cursor);
    if (begin < 0) break;
    const bodyStart = begin + MARKER_BEGIN.length;
    const end = text.indexOf(MARKER_END, bodyStart);
    if (end < 0) break;
    const raw = text.slice(bodyStart, end).trim();
    cursor = end + MARKER_END.length;
    try {
      const parsed = JSON.parse(raw) as {
        version?: string;
        role?: string;
        format?: string;
        idTag?: string;
        checksum?: string;
      };
      if (
        parsed.version !== AUDIO_AI_SEAL_VERSION ||
        parsed.role !== AUDIO_AI_SEAL_DECISION_ROLE ||
        parsed.format !== "audio" ||
        typeof parsed.idTag !== "string" ||
        parsed.checksum !==
          createHash("sha256")
            .update(parsed.version)
            .update(":")
            .update(parsed.role)
            .update(":")
            .update(parsed.format)
            .update(":")
            .update(parsed.idTag)
            .digest("hex")
      ) {
        continue;
      }
      markers.push({ idTag: parsed.idTag, format: parsed.format });
    } catch {
      // Ignore malformed marker-like bytes.
    }
  }
  return markers;
}
