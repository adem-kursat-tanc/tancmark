import { createHash } from "node:crypto";

export const VIDEO_AI_SEAL_FEATURE_FLAG =
  "TANCMARK_AI_SEAL_VIDEO_ENABLED" as const;

export const VIDEO_AI_SEAL_DECISION_ROLE =
  "video_ai_exact_id_ownership_no_vault_no_final" as const;

export const VIDEO_AI_SEAL_VERSION = "tancmark-ai-seal-video-mvp-v1" as const;

export type VideoAiSealDisplayText =
  | "AI kesin ID okundu"
  | "AI destek izi bulunamadi"
  | "Zayif AI sinyal var";

export type VideoAiSealOwnershipDecision =
  | "ai_ownership_asserted_by_exact_id"
  | "ai_weak_trace_percent_only"
  | "ai_ownership_not_asserted";

export interface VideoAiSealGate {
  module: "video_ai_seal";
  enabled: boolean;
  featureFlag: typeof VIDEO_AI_SEAL_FEATURE_FLAG;
  defaultEnabled: false;
  productReady: false;
  decisionRole: typeof VIDEO_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface SealVideoAiMediaInput {
  media: Buffer;
  tancmarkId: string;
}

export interface SealVideoAiMediaResult {
  media: Buffer;
  aiSealEmbedded: true;
  sourceMediaMutated: false;
  markerCopiesWritten: number;
  containerStrategy: "mp4_free_box_and_tail_marker" | "tail_marker_only";
  decisionRole: typeof VIDEO_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface ReadVideoAiSealInput {
  media: Buffer;
  expectedTancmarkId: string;
}

export interface ReadVideoAiSealResult {
  found: boolean;
  weakSignal: boolean;
  score: number;
  markerCopiesFound: number;
  displayText: VideoAiSealDisplayText;
  decisionRole: typeof VIDEO_AI_SEAL_DECISION_ROLE;
  canAssertAiOwnership: boolean;
  aiOwnershipDecision: VideoAiSealOwnershipDecision;
  ownershipConfidencePercent: number;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

const MAX_SUPPORTED_VIDEO_BYTES = 250 * 1024 * 1024;
const MARKER_BEGIN = "TANCMARK_VIDEO_AI_SEAL_BEGIN_V1";
const MARKER_END = "TANCMARK_VIDEO_AI_SEAL_END_V1";
const MARKER_BOX_TYPE = "free";

export function getVideoAiSealGate(
  env: NodeJS.ProcessEnv = process.env,
): VideoAiSealGate {
  return {
    module: "video_ai_seal",
    enabled:
      env[VIDEO_AI_SEAL_FEATURE_FLAG] === "1" ||
      env[VIDEO_AI_SEAL_FEATURE_FLAG] === "true",
    featureFlag: VIDEO_AI_SEAL_FEATURE_FLAG,
    defaultEnabled: false,
    productReady: false,
    decisionRole: VIDEO_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export async function sealVideoAiMedia(
  input: SealVideoAiMediaInput,
): Promise<SealVideoAiMediaResult> {
  assertVideoAiFeatureEnabled();
  assertSafeId(input.tancmarkId);
  assertSafeVideoSize(input.media);
  assertSupportedVideoContainer(input.media);

  const marker = createMarker(input.tancmarkId);
  const mp4InsertOffset = findMp4FtypEnd(input.media);
  if (mp4InsertOffset > 0) {
    const freeBox = createMp4FreeBox(marker);
    return {
      media: Buffer.concat([
        input.media.subarray(0, mp4InsertOffset),
        freeBox,
        input.media.subarray(mp4InsertOffset),
        marker,
      ]),
      aiSealEmbedded: true,
      sourceMediaMutated: false,
      markerCopiesWritten: 2,
      containerStrategy: "mp4_free_box_and_tail_marker",
      decisionRole: VIDEO_AI_SEAL_DECISION_ROLE,
      canOpenVault: false,
      canConfirmFinal: false,
      externalApiUsed: false,
      modelDownloaded: false,
    };
  }

  return {
    media: Buffer.concat([input.media, marker]),
    aiSealEmbedded: true,
    sourceMediaMutated: false,
    markerCopiesWritten: 1,
    containerStrategy: "tail_marker_only",
    decisionRole: VIDEO_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export async function readVideoAiSeal(
  input: ReadVideoAiSealInput,
): Promise<ReadVideoAiSealResult> {
  assertVideoAiFeatureEnabled();
  assertSafeId(input.expectedTancmarkId);
  assertSafeVideoSize(input.media);
  assertSupportedVideoContainer(input.media);

  const expectedTag = createIdTag(input.expectedTancmarkId);
  const markerCopiesFound = extractMarkers(input.media).filter(
    (marker) => marker.idTag === expectedTag && marker.format === "video",
  ).length;
  const found = markerCopiesFound >= 1;
  const weakSignal = !found && extractMarkers(input.media).length > 0;
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
    decisionRole: VIDEO_AI_SEAL_DECISION_ROLE,
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

function assertVideoAiFeatureEnabled() {
  if (!getVideoAiSealGate().enabled) {
    throw new Error("video_ai_seal_feature_flag_disabled");
  }
}

function assertSafeId(value: string) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(value)) {
    throw new Error("invalid_video_ai_seal_tancmark_id");
  }
}

function assertSafeVideoSize(media: Buffer) {
  if (media.length <= 0 || media.length > MAX_SUPPORTED_VIDEO_BYTES) {
    throw new Error("unsafe_video_ai_seal_size");
  }
}

function assertSupportedVideoContainer(media: Buffer) {
  if (isMp4Like(media) || isWebmOrMkv(media) || isAvi(media)) return;
  throw new Error("unsupported_video_ai_seal_container");
}

function isMp4Like(media: Buffer): boolean {
  return findMp4FtypEnd(media) > 0;
}

function isWebmOrMkv(media: Buffer): boolean {
  return media.length >= 4 && media.readUInt32BE(0) === 0x1a45dfa3;
}

function isAvi(media: Buffer): boolean {
  return (
    media.length >= 12 &&
    media.toString("ascii", 0, 4) === "RIFF" &&
    media.toString("ascii", 8, 12) === "AVI "
  );
}

function createMarker(tancmarkId: string): Buffer {
  const payload = {
    version: VIDEO_AI_SEAL_VERSION,
    role: VIDEO_AI_SEAL_DECISION_ROLE,
    format: "video",
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
    .update(VIDEO_AI_SEAL_VERSION)
    .update(":")
    .update(tancmarkId)
    .digest("hex");
}

function extractMarkers(media: Buffer): Array<{ idTag: string; format: string }> {
  const text = media.toString("latin1");
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
        parsed.version !== VIDEO_AI_SEAL_VERSION ||
        parsed.role !== VIDEO_AI_SEAL_DECISION_ROLE ||
        parsed.format !== "video" ||
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

function findMp4FtypEnd(media: Buffer): number {
  if (media.length < 16) return -1;
  const size = media.readUInt32BE(0);
  const type = media.toString("ascii", 4, 8);
  if (type !== "ftyp" || size < 8 || size > media.length) return -1;
  return size;
}

function createMp4FreeBox(payload: Buffer): Buffer {
  const size = 8 + payload.length;
  const header = Buffer.alloc(8);
  header.writeUInt32BE(size, 0);
  header.write(MARKER_BOX_TYPE, 4, 4, "ascii");
  return Buffer.concat([header, payload]);
}
