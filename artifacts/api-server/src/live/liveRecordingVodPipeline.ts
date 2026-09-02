import { buildLiveFfmpegDryRunCommand, type LiveFfmpegDryRunCommand } from "./liveFfmpegCommandBuilder";
import { buildLiveFfmpegCostPreview, type LiveFfmpegCostPreview } from "./liveFfmpegCostPreview";
import {
  buildLiveNativeVideoFactoryPlanForSession,
  type LiveNativeVideoFactoryPlan,
} from "./liveNativeVideoFactory";
import { getLivePostLiveResealPolicy, type LivePostLiveResealPolicy } from "./livePostLiveResealPolicy";
import { buildLiveRecordingManifest, type LiveRecordingManifest } from "./liveRecordingManifest";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_RECORDING_VOD_PIPELINE_DECISION_ROLE =
  "live_recording_vod_mock_pipeline_support_only_no_vault_no_confirmed" as const;

export type LiveRecordingStatus = "mock_ready" | "mock_processing" | "mock_complete";

export interface LiveRecordingVodPipeline {
  liveSessionId: string;
  recordingId: string;
  vodAssetId: string;
  recordingStatus: LiveRecordingStatus;
  retentionDaysPreview: 3 | 7;
  hlsManifestPreview: string;
  segmentCountPreview: number;
  durationSecondsPreview: number;
  vodMp4Preview: string;
  thumbnailsPreview: string[];
  clipsPreview: string[];
  nativeVideoFactoryPlan: LiveNativeVideoFactoryPlan;
  ffmpegDryRunCommands: LiveFfmpegDryRunCommand[];
  recordingManifestSummary: LiveRecordingManifest;
  postLiveResealPolicySummary: LivePostLiveResealPolicy;
  costPreviewSummary: LiveFfmpegCostPreview;
  postLiveResealRecommended: true;
  tancmarkIdRead: false;
  tancmarkWatermarkApplied: false;
  realFfmpegExecuted: false;
  realMediaProcessed: false;
  realRecordingCreated: false;
  realNetworkPull: false;
  realNetworkPush: false;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  oldFfmpegProductDefault: false;
  dirtyFfmpegUsed: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_RECORDING_VOD_PIPELINE_DECISION_ROLE;
}

function recordingStatusFor(session: TancMarkLiveSession): LiveRecordingStatus {
  if (session.status === "mock_live") return "mock_processing";
  if (session.status === "stopped") return "mock_complete";
  return "mock_ready";
}

export function buildLiveRecordingVodMockPipeline(session: TancMarkLiveSession): LiveRecordingVodPipeline {
  const manifest = buildLiveRecordingManifest(session);
  const nativeVideoFactoryPlan = buildLiveNativeVideoFactoryPlanForSession(session);
  const commandInput = {
    sessionId: session.sessionId,
    recordingId: manifest.recordingId,
    durationSecondsPreview: manifest.durationSecondsPreview,
    segmentDurationSeconds: manifest.segmentDurationSecondsPreview,
    segmentCountPreview: manifest.segmentCountPreview,
  };
  const ffmpegDryRunCommands = [
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "live_to_hls_recording" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "live_to_vod_mp4" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "hls_segment_generation" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "thumbnail_preview" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "gif_preview" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "clip_preview" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "audio_extract_preview" }),
    buildLiveFfmpegDryRunCommand({ ...commandInput, commandKind: "post_live_vod_normalize_preview" }),
  ];

  return {
    liveSessionId: manifest.liveSessionId,
    recordingId: manifest.recordingId,
    vodAssetId: manifest.vodAssetId,
    recordingStatus: recordingStatusFor(session),
    retentionDaysPreview: manifest.retentionDaysPreview,
    hlsManifestPreview: manifest.hlsManifestPreview,
    segmentCountPreview: manifest.segmentCountPreview,
    durationSecondsPreview: manifest.durationSecondsPreview,
    vodMp4Preview: manifest.vodMp4Preview,
    thumbnailsPreview: manifest.thumbnailsPreview,
    clipsPreview: manifest.clipsPreview,
    nativeVideoFactoryPlan,
    ffmpegDryRunCommands,
    recordingManifestSummary: manifest,
    postLiveResealPolicySummary: getLivePostLiveResealPolicy(),
    costPreviewSummary: buildLiveFfmpegCostPreview({
      durationSecondsPreview: manifest.durationSecondsPreview,
      segmentDurationSeconds: manifest.segmentDurationSecondsPreview,
      segmentCountPreview: manifest.segmentCountPreview,
      thumbnailCountPreview: manifest.thumbnailsPreview.length,
      clipCountPreview: manifest.clipsPreview.length,
    }),
    postLiveResealRecommended: true,
    tancmarkIdRead: false,
    tancmarkWatermarkApplied: false,
    realFfmpegExecuted: false,
    realMediaProcessed: false,
    realRecordingCreated: false,
    realNetworkPull: false,
    realNetworkPush: false,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    oldFfmpegProductDefault: false,
    dirtyFfmpegUsed: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_RECORDING_VOD_PIPELINE_DECISION_ROLE,
  };
}
