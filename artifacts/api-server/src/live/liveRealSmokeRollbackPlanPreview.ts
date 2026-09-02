export const LIVE_REAL_SMOKE_ROLLBACK_PLAN_DECISION_ROLE =
  "live_real_smoke_rollback_plan_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeRollbackStepPreview {
  stepKey: string;
  title: string;
  futureActionOnly: true;
  executedNow: false;
  supportOnly: true;
}

export interface LiveRealSmokeRollbackPlanPreview {
  rollbackStatus: "readonly_rollback_preview";
  rollbackReadyForRealSmoke: false;
  steps: LiveRealSmokeRollbackStepPreview[];
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_ROLLBACK_PLAN_DECISION_ROLE;
}

export function getLiveRealSmokeRollbackPlanPreview(): LiveRealSmokeRollbackPlanPreview {
  return {
    rollbackStatus: "readonly_rollback_preview",
    rollbackReadyForRealSmoke: false,
    steps: [
      step("broadcast_stop", "broadcast stop"),
      step("target_push_stop", "target push stop"),
      step("srs_mediamtx_stop_future", "SRS/MediaMTX stop future"),
      step("ffmpeg_stop_future", "FFmpeg stop future"),
      step("stream_key_revoke_future", "stream key revoke future"),
      step("access_signed_url_invalidate_future", "access/signed URL invalidate future"),
      step("recording_freeze", "recording freeze"),
      step("secure_room_report_freeze", "Secure Room report freeze"),
      step("incident_note", "incident note"),
      step("post_test_report", "post-test report"),
    ],
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_ROLLBACK_PLAN_DECISION_ROLE,
  };
}

function step(stepKey: string, title: string): LiveRealSmokeRollbackStepPreview {
  return {
    stepKey,
    title,
    futureActionOnly: true,
    executedNow: false,
    supportOnly: true,
  };
}
