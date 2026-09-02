import type { TancMarkLiveSession } from "./liveSessionModel";
import {
  getLiveNativeVideoFactoryPolicy,
  LIVE_NATIVE_VIDEO_FACTORY_DECISION_ROLE,
  type LiveNativeVideoFactoryPolicy,
} from "./liveNativeVideoFactoryPolicy";

export const LIVE_NATIVE_VIDEO_FACTORY_VERSION =
  "live-native-video-factory-v0.1" as const;

export const LIVE_NATIVE_VIDEO_FACTORY_PLAN_DECISION_ROLE =
  "live_native_video_factory_plan_support_only_no_vault_no_confirmed" as const;

export interface LiveNativeVideoFactoryInput {
  sessionId?: string;
  recordingId?: string;
  durationSeconds?: number;
  segmentDurationSeconds?: number;
  startSequence?: number;
  inputRef?: string;
}

export interface LiveNativeVideoSegment {
  sequence: number;
  durationSeconds: number;
  uri: string;
  startsAtSeconds: number;
  endsAtSeconds: number;
  generatedBy: "tancmark_native_video_factory";
  ffmpegUsed: false;
  dirtyFfmpegUsed: false;
}

export interface LiveNativeVideoFactoryPlan {
  version: typeof LIVE_NATIVE_VIDEO_FACTORY_VERSION;
  decisionRole: typeof LIVE_NATIVE_VIDEO_FACTORY_PLAN_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  policySummary: Pick<
    LiveNativeVideoFactoryPolicy,
    | "oldFfmpegProductDefault"
    | "dirtyFfmpegAllowedInProduct"
    | "gplFfmpegAllowedInProduct"
    | "nonfreeFfmpegAllowedInProduct"
    | "licenseRule"
    | "noPaidClosedLicense"
    | "noContainersRequiredForProductDefault"
  >;
  liveSessionId: string;
  recordingId: string;
  inputRef: string;
  hlsManifestPath: string;
  vodRecordingPath: string;
  durationSeconds: number;
  segmentDurationSeconds: number;
  targetDurationSeconds: number;
  segmentCount: number;
  segments: LiveNativeVideoSegment[];
  mediaPlaylist: string;
  manifestLineCount: number;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  productDefaultUsesNativeFactory: true;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  visibleLogoFeatureSeparate: true;
  realNetworkPull: false;
  realNetworkPush: false;
  realBroadcastStarted: false;
  realCustomerContentUsed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
}

const MAX_DURATION_SECONDS = 24 * 60 * 60;
const MAX_SEGMENT_DURATION_SECONDS = 60;
const MAX_SEGMENT_COUNT = 24 * 60 * 12;

function safeId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return safe.length > 0 ? safe : fallback;
}

function safePositiveInteger(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.ceil(value), max);
}

function safeInputRef(value: unknown, liveSessionId: string): string {
  if (typeof value !== "string") return `tancmark://live/native/${liveSessionId}/input`;
  const trimmed = value.trim();
  if (!trimmed) return `tancmark://live/native/${liveSessionId}/input`;
  if (/^(?:https?|rtmps?|srt):\/\//i.test(trimmed)) {
    return `blocked-network-ref://${liveSessionId}`;
  }
  return trimmed.replace(/[\r\n<>`$;]/g, "_").slice(0, 180);
}

function buildSegments(input: {
  recordingId: string;
  durationSeconds: number;
  segmentDurationSeconds: number;
  startSequence: number;
}): LiveNativeVideoSegment[] {
  const segmentCount = Math.min(Math.ceil(input.durationSeconds / input.segmentDurationSeconds), MAX_SEGMENT_COUNT);
  const segments: LiveNativeVideoSegment[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const startsAtSeconds = i * input.segmentDurationSeconds;
    const endsAtSeconds = Math.min(input.durationSeconds, startsAtSeconds + input.segmentDurationSeconds);
    const durationSeconds = Math.max(0, endsAtSeconds - startsAtSeconds);
    const sequence = input.startSequence + i;
    segments.push({
      sequence,
      durationSeconds,
      uri: `segment_${String(sequence).padStart(6, "0")}.m4s`,
      startsAtSeconds,
      endsAtSeconds,
      generatedBy: "tancmark_native_video_factory",
      ffmpegUsed: false,
      dirtyFfmpegUsed: false,
    });
  }

  return segments;
}

function buildMediaPlaylist(input: {
  targetDurationSeconds: number;
  startSequence: number;
  segments: readonly LiveNativeVideoSegment[];
}): string {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    `#EXT-X-TARGETDURATION:${input.targetDurationSeconds}`,
    `#EXT-X-MEDIA-SEQUENCE:${input.startSequence}`,
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    "# TancMark native video factory; no dirty FFmpeg product path",
  ];

  for (const segment of input.segments) {
    lines.push(`#EXTINF:${segment.durationSeconds.toFixed(3)},`);
    lines.push(segment.uri);
  }

  lines.push("#EXT-X-ENDLIST");
  return `${lines.join("\n")}\n`;
}

export function buildLiveNativeVideoFactoryPlan(
  input: LiveNativeVideoFactoryInput = {},
): LiveNativeVideoFactoryPlan {
  const policy = getLiveNativeVideoFactoryPolicy();
  const liveSessionId = safeId(input.sessionId, "native_live_session");
  const recordingId = safeId(input.recordingId, `${liveSessionId}_native_recording`);
  const durationSeconds = safePositiveInteger(input.durationSeconds, 300, MAX_DURATION_SECONDS);
  const segmentDurationSeconds = safePositiveInteger(
    input.segmentDurationSeconds,
    6,
    MAX_SEGMENT_DURATION_SECONDS,
  );
  const startSequence = safePositiveInteger(input.startSequence, 0, 999_999);
  const inputRef = safeInputRef(input.inputRef, liveSessionId);
  const segments = buildSegments({ recordingId, durationSeconds, segmentDurationSeconds, startSequence });
  const targetDurationSeconds = Math.ceil(Math.max(...segments.map((segment) => segment.durationSeconds), 1));
  const mediaPlaylist = buildMediaPlaylist({ targetDurationSeconds, startSequence, segments });

  return {
    version: LIVE_NATIVE_VIDEO_FACTORY_VERSION,
    decisionRole: LIVE_NATIVE_VIDEO_FACTORY_PLAN_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    policySummary: {
      oldFfmpegProductDefault: policy.oldFfmpegProductDefault,
      dirtyFfmpegAllowedInProduct: policy.dirtyFfmpegAllowedInProduct,
      gplFfmpegAllowedInProduct: policy.gplFfmpegAllowedInProduct,
      nonfreeFfmpegAllowedInProduct: policy.nonfreeFfmpegAllowedInProduct,
      licenseRule: policy.licenseRule,
      noPaidClosedLicense: policy.noPaidClosedLicense,
      noContainersRequiredForProductDefault: policy.noContainersRequiredForProductDefault,
    },
    liveSessionId,
    recordingId,
    inputRef,
    hlsManifestPath: `tancmark://vod/native/${recordingId}/index.m3u8`,
    vodRecordingPath: `tancmark://vod/native/${recordingId}/recording.mp4`,
    durationSeconds,
    segmentDurationSeconds,
    targetDurationSeconds,
    segmentCount: segments.length,
    segments,
    mediaPlaylist,
    manifestLineCount: mediaPlaylist.trimEnd().split("\n").length,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    productDefaultUsesNativeFactory: true,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    visibleLogoFeatureSeparate: true,
    realNetworkPull: false,
    realNetworkPush: false,
    realBroadcastStarted: false,
    realCustomerContentUsed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
  };
}

export function buildLiveNativeVideoFactoryPlanForSession(
  session: TancMarkLiveSession,
): LiveNativeVideoFactoryPlan {
  return buildLiveNativeVideoFactoryPlan({
    sessionId: session.sessionId,
    recordingId: `${session.sessionId}_native_recording`,
    durationSeconds: session.status === "stopped" ? 900 : 300,
    segmentDurationSeconds: 6,
    inputRef: `tancmark://live/native/${safeId(session.sessionId, "native_live_session")}/input`,
  });
}

export function explainNativeVideoFactoryForClaude(): string {
  return [
    "Claude gorevi: TancMark native video factory icin MP4/MOV container parser ve metadata stamp hardening yaz.",
    "Kirli FFmpeg, GPL/nonfree, ucretli/kapali lisans yok.",
    "Video goruntusu, ses, anlam ve kalite bozulmayacak.",
    "VAULT/exact ID/final karar mantigina dokunma.",
    "Cikti: saf TypeScript modul, test, rapor; FFmpeg kodu kopyalama.",
  ].join("\n");
}
