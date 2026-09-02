import { buildLiveRecordingVodMockPipeline, type LiveRecordingVodPipeline } from "./liveRecordingVodPipeline";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_VOD_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_recording_vod_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveVodSecureRoomHandoff {
  liveSessionId: string;
  recordingId: string;
  vodAssetId: string;
  ffmpegDryRunSummary: {
    commandCount: number;
    allDryRunOnly: true;
    realFfmpegExecuted: false;
    realMediaProcessed: false;
  };
  recordingManifestSummary: Pick<
    LiveRecordingVodPipeline,
    | "recordingStatus"
    | "hlsManifestPreview"
    | "segmentCountPreview"
    | "durationSecondsPreview"
    | "vodMp4Preview"
    | "thumbnailsPreview"
    | "clipsPreview"
  >;
  postLiveResealPolicySummary: {
    postLiveResealRecommended: true;
    ownershipPreSealRulePreserved: true;
    finalDecisionRequiresRealIdReadAndRegistryMatch: true;
    canOpenVault: false;
  };
  costPreviewSummary: LiveRecordingVodPipeline["costPreviewSummary"];
  liveProtectionEnabled: false;
  realFfmpegExecuted: false;
  realMediaProcessed: false;
  tancmarkWatermarkApplied: false;
  tancmarkIdRead: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_VOD_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveVodSecureRoomHandoff(
  session: TancMarkLiveSession,
  pipeline: LiveRecordingVodPipeline = buildLiveRecordingVodMockPipeline(session),
): LiveVodSecureRoomHandoff {
  return {
    liveSessionId: pipeline.liveSessionId,
    recordingId: pipeline.recordingId,
    vodAssetId: pipeline.vodAssetId,
    ffmpegDryRunSummary: {
      commandCount: pipeline.ffmpegDryRunCommands.length,
      allDryRunOnly: true,
      realFfmpegExecuted: false,
      realMediaProcessed: false,
    },
    recordingManifestSummary: {
      recordingStatus: pipeline.recordingStatus,
      hlsManifestPreview: pipeline.hlsManifestPreview,
      segmentCountPreview: pipeline.segmentCountPreview,
      durationSecondsPreview: pipeline.durationSecondsPreview,
      vodMp4Preview: pipeline.vodMp4Preview,
      thumbnailsPreview: pipeline.thumbnailsPreview,
      clipsPreview: pipeline.clipsPreview,
    },
    postLiveResealPolicySummary: {
      postLiveResealRecommended: true,
      ownershipPreSealRulePreserved: pipeline.postLiveResealPolicySummary.ownershipPreSealRulePreserved,
      finalDecisionRequiresRealIdReadAndRegistryMatch:
        pipeline.postLiveResealPolicySummary.finalDecisionRequiresRealIdReadAndRegistryMatch,
      canOpenVault: false,
    },
    costPreviewSummary: pipeline.costPreviewSummary,
    liveProtectionEnabled: false,
    realFfmpegExecuted: false,
    realMediaProcessed: false,
    tancmarkWatermarkApplied: false,
    tancmarkIdRead: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_VOD_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
