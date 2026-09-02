import { buildLiveFfmpegCostPreview, type LiveFfmpegCostPreview } from "./liveFfmpegCostPreview";
import { getLiveFfmpegExternalCliPolicy, type LiveFfmpegExternalCliPolicy } from "./liveFfmpegExternalCliPolicy";

export const LIVE_FFMPEG_COMMAND_DECISION_ROLE =
  "live_ffmpeg_dry_run_command_support_only_no_execution_no_vault_no_confirmed" as const;

export type LiveFfmpegCommandKind =
  | "live_to_hls_recording"
  | "live_to_vod_mp4"
  | "hls_segment_generation"
  | "thumbnail_preview"
  | "gif_preview"
  | "clip_preview"
  | "audio_extract_preview"
  | "post_live_vod_normalize_preview";

export interface LiveFfmpegCommandBuilderInput {
  commandKind?: LiveFfmpegCommandKind;
  sessionId?: string;
  recordingId?: string;
  inputRef?: string;
  outputRef?: string;
  durationSecondsPreview?: number;
  segmentDurationSeconds?: number;
  segmentCountPreview?: number;
  overwrite?: boolean;
}

export interface LiveFfmpegDryRunCommand {
  commandKind: LiveFfmpegCommandKind;
  binary: "ffmpeg";
  argsPreview: string[];
  redactedCommandPreview: string;
  willExecute: false;
  dryRunOnly: true;
  safetyChecksPassed: boolean;
  blockedReasons: string[];
  safetyChecks: {
    shellInjectionBlocked: boolean;
    argArrayOnly: true;
    inputOutputPathAllowlist: boolean;
    secretValuesLogged: false;
    urlSecretRedaction: true;
    overwritePolicy: "explicit_preview_only";
    maxDurationPreviewSeconds: number;
    maxSegmentCountPreview: number;
    noRealExecution: true;
    noNetworkPull: true;
    noNetworkPush: true;
    noArbitraryFileReadWrite: true;
  };
  estimatedCostSummary: LiveFfmpegCostPreview;
  licensePolicySummary: Pick<
    LiveFfmpegExternalCliPolicy,
    | "processingEngine"
    | "embeddedInTancMarkCode"
    | "currentPhaseExecution"
    | "preferredBuild"
    | "enableNonfreeAllowed"
    | "gplBuildRequiresHumanApproval"
    | "gplBuildAllowedInProduct"
    | "currentKnownLocalBuild"
    | "currentKnownLocalBinaryProductApproved"
    | "productRequiresCleanLgplBuild"
    | "productMayProceedWithoutFfmpeg"
    | "ffmpegIsTancMarkWatermark"
    | "ffmpegCanOpenVault"
    | "ffmpegCanConfirm"
    | "ffmpegCanFinalize"
  >;
  realFfmpegExecuted: false;
  realMediaProcessed: false;
  realMediaDownloaded: false;
  realMediaUploaded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_FFMPEG_COMMAND_DECISION_ROLE;
}

const commandKinds: readonly LiveFfmpegCommandKind[] = [
  "live_to_hls_recording",
  "live_to_vod_mp4",
  "hls_segment_generation",
  "thumbnail_preview",
  "gif_preview",
  "clip_preview",
  "audio_extract_preview",
  "post_live_vod_normalize_preview",
];

const allowedRefPrefixes = ["mock://live/", "mock://vod/", "tancmark://live/mock/", "memory://live/mock/"] as const;
const forbiddenTokens = [";", "&&", "||", "`", "$(", ">", "<", "\n", "\r"] as const;
const secretPatterns = [/stream[_-]?key=([^&\s]+)/gi, /token=([^&\s]+)/gi, /signature=([^&\s]+)/gi, /secret=([^&\s]+)/gi];

function parseCommandKind(value: unknown): LiveFfmpegCommandKind {
  return commandKinds.includes(value as LiveFfmpegCommandKind)
    ? (value as LiveFfmpegCommandKind)
    : "live_to_hls_recording";
}

function cleanId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(trimmed) ? trimmed : fallback;
}

function safePreviewNumber(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.ceil(value), max);
}

function defaultInputRef(sessionId: string): string {
  return `mock://live/${sessionId}/input.m3u8`;
}

function defaultOutputRef(commandKind: LiveFfmpegCommandKind, recordingId: string): string {
  return `mock://vod/${recordingId}/${commandKind}`;
}

function isAllowedRef(value: string): boolean {
  return allowedRefPrefixes.some((prefix) => value.startsWith(prefix));
}

function hasShellControl(value: string): boolean {
  return forbiddenTokens.some((token) => value.includes(token));
}

function hasNetworkRef(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^rtmps?:\/\//i.test(value) || /^srt:\/\//i.test(value);
}

function redact(value: string): string {
  return secretPatterns.reduce((current, pattern) => current.replace(pattern, (match) => {
    const [key] = match.split("=");
    return `${key}=<redacted>`;
  }), value);
}

function commandArgs(
  commandKind: LiveFfmpegCommandKind,
  inputRef: string,
  outputRef: string,
  durationSeconds: number,
  segmentDurationSeconds: number,
  overwrite: boolean,
): string[] {
  const base = ["-hide_banner", "-nostdin", "-i", inputRef];
  const overwriteArgs = overwrite ? ["-y"] : ["-n"];
  switch (commandKind) {
    case "live_to_hls_recording":
      return [
        ...base,
        "-t",
        String(durationSeconds),
        "-c",
        "copy",
        "-f",
        "hls",
        "-hls_time",
        String(segmentDurationSeconds),
        "-hls_list_size",
        "0",
        ...overwriteArgs,
        `${outputRef}/index.m3u8`,
      ];
    case "live_to_vod_mp4":
      return [...base, "-t", String(durationSeconds), "-c", "copy", "-movflags", "+faststart", ...overwriteArgs, `${outputRef}.mp4`];
    case "hls_segment_generation":
      return [
        ...base,
        "-t",
        String(durationSeconds),
        "-c",
        "copy",
        "-f",
        "segment",
        "-segment_time",
        String(segmentDurationSeconds),
        ...overwriteArgs,
        `${outputRef}/segment_%03d.ts`,
      ];
    case "thumbnail_preview":
      return [...base, "-t", "1", "-frames:v", "1", "-vf", "scale=640:-1", ...overwriteArgs, `${outputRef}/thumbnail.jpg`];
    case "gif_preview":
      return [...base, "-t", "3", "-vf", "fps=8,scale=480:-1", ...overwriteArgs, `${outputRef}/preview.gif`];
    case "clip_preview":
      return [...base, "-ss", "5", "-t", "10", "-c", "copy", ...overwriteArgs, `${outputRef}/clip.mp4`];
    case "audio_extract_preview":
      return [...base, "-t", String(durationSeconds), "-vn", "-ac", "2", "-ar", "48000", ...overwriteArgs, `${outputRef}/audio.wav`];
    case "post_live_vod_normalize_preview":
      return [...base, "-t", String(durationSeconds), "-map", "0", "-c", "copy", "-movflags", "+faststart", ...overwriteArgs, `${outputRef}/normalized.mp4`];
  }
}

export function buildLiveFfmpegDryRunCommand(input: LiveFfmpegCommandBuilderInput = {}): LiveFfmpegDryRunCommand {
  const commandKind = parseCommandKind(input.commandKind);
  const sessionId = cleanId(input.sessionId, "mock-live-session");
  const recordingId = cleanId(input.recordingId, `${sessionId}-recording`);
  const inputRef = typeof input.inputRef === "string" && input.inputRef.trim() ? input.inputRef.trim() : defaultInputRef(sessionId);
  const outputRef =
    typeof input.outputRef === "string" && input.outputRef.trim()
      ? input.outputRef.trim()
      : defaultOutputRef(commandKind, recordingId);
  const durationSeconds = safePreviewNumber(input.durationSecondsPreview, 300, 1800);
  const segmentDurationSeconds = safePreviewNumber(input.segmentDurationSeconds, 6, 30);
  const maxSegmentCountPreview = safePreviewNumber(input.segmentCountPreview, Math.ceil(durationSeconds / segmentDurationSeconds), 300);
  const overwrite = input.overwrite === true;
  const blockedReasons: string[] = [];

  for (const [label, value] of [
    ["inputRef", inputRef],
    ["outputRef", outputRef],
  ] as const) {
    if (!isAllowedRef(value)) blockedReasons.push(`${label}_outside_allowlist`);
    if (hasShellControl(value)) blockedReasons.push(`${label}_contains_shell_control_token`);
    if (hasNetworkRef(value)) blockedReasons.push(`${label}_network_pull_or_push_blocked`);
  }

  const args = commandArgs(commandKind, inputRef, outputRef, durationSeconds, segmentDurationSeconds, overwrite);
  const redactedArgs = args.map(redact);
  const policy = getLiveFfmpegExternalCliPolicy();
  const costPreview = buildLiveFfmpegCostPreview({
    durationSecondsPreview: durationSeconds,
    segmentDurationSeconds,
    segmentCountPreview: maxSegmentCountPreview,
  });

  return {
    commandKind,
    binary: "ffmpeg",
    argsPreview: redactedArgs,
    redactedCommandPreview: ["ffmpeg", ...redactedArgs].join(" "),
    willExecute: false,
    dryRunOnly: true,
    safetyChecksPassed: blockedReasons.length === 0,
    blockedReasons,
    safetyChecks: {
      shellInjectionBlocked: true,
      argArrayOnly: true,
      inputOutputPathAllowlist: blockedReasons.every((reason) => !reason.includes("outside_allowlist")),
      secretValuesLogged: false,
      urlSecretRedaction: true,
      overwritePolicy: "explicit_preview_only",
      maxDurationPreviewSeconds: 1800,
      maxSegmentCountPreview,
      noRealExecution: true,
      noNetworkPull: true,
      noNetworkPush: true,
      noArbitraryFileReadWrite: true,
    },
    estimatedCostSummary: costPreview,
    licensePolicySummary: {
      processingEngine: policy.processingEngine,
      embeddedInTancMarkCode: policy.embeddedInTancMarkCode,
      currentPhaseExecution: policy.currentPhaseExecution,
      preferredBuild: policy.preferredBuild,
      enableNonfreeAllowed: policy.enableNonfreeAllowed,
      gplBuildRequiresHumanApproval: policy.gplBuildRequiresHumanApproval,
      gplBuildAllowedInProduct: policy.gplBuildAllowedInProduct,
      currentKnownLocalBuild: policy.currentKnownLocalBuild,
      currentKnownLocalBinaryProductApproved: policy.currentKnownLocalBinaryProductApproved,
      productRequiresCleanLgplBuild: policy.productRequiresCleanLgplBuild,
      productMayProceedWithoutFfmpeg: policy.productMayProceedWithoutFfmpeg,
      ffmpegIsTancMarkWatermark: policy.ffmpegIsTancMarkWatermark,
      ffmpegCanOpenVault: policy.ffmpegCanOpenVault,
      ffmpegCanConfirm: policy.ffmpegCanConfirm,
      ffmpegCanFinalize: policy.ffmpegCanFinalize,
    },
    realFfmpegExecuted: false,
    realMediaProcessed: false,
    realMediaDownloaded: false,
    realMediaUploaded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_FFMPEG_COMMAND_DECISION_ROLE,
  };
}

export function getLiveFfmpegCommandKinds(): readonly LiveFfmpegCommandKind[] {
  return commandKinds;
}
