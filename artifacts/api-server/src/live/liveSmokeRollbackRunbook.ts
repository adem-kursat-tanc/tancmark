export const LIVE_SMOKE_ROLLBACK_RUNBOOK_DECISION_ROLE =
  "live_smoke_rollback_runbook_support_only_no_vault_no_confirmed" as const;

export interface LiveSmokeRollbackStep {
  stepId: string;
  title: string;
  description: string;
  executionMode: "preview_future_only";
  realActionTaken: false;
  supportOnly: true;
}

export interface LiveSmokeRollbackRunbook {
  phase: "rollback_runbook_preview_only";
  steps: LiveSmokeRollbackStep[];
  rollbackAvailableForFutureRealLab: true;
  realRollbackExecuted: false;
  realBroadcastStopped: false;
  realTargetPushDisabled: false;
  realStreamKeyRevoked: false;
  realProcessStopped: false;
  realAccessTokenInvalidated: false;
  evidenceFrozen: false;
  incidentCreated: false;
  noVaultFinalImpact: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SMOKE_ROLLBACK_RUNBOOK_DECISION_ROLE;
}

export function getLiveSmokeRollbackRunbook(): LiveSmokeRollbackRunbook {
  return {
    phase: "rollback_runbook_preview_only",
    steps: [
      rollbackStep("stop_broadcast", "Yayini durdur", "Real labda yayin baslatilirsa operator tarafindan derhal durdurma adimi."),
      rollbackStep("disable_target_push", "Target push kapat", "Provider/custom RTMP hedefine push kapatma adimi."),
      rollbackStep("revoke_stream_key_future", "Stream key revoke future", "Stream key rotate/revoke ancak real secret management fazinda uygulanabilir."),
      rollbackStep("stop_srs_mediamtx_future", "SRS/MediaMTX process stop future", "Real process bu fazda yok; ileride stop komutu ayrica onaylanir."),
      rollbackStep("stop_ffmpeg_future", "FFmpeg process stop future", "FFmpeg calistirilmaz; ileride process stop runbook ayrica uygulanir."),
      rollbackStep("disable_hls_output_future", "HLS output disable future", "Gercek HLS output yok; ileride output disable plani uygulanir."),
      rollbackStep("invalidate_access_future", "Access token invalidate future", "Gercek token yok; ileride token invalidation plani gerekir."),
      rollbackStep("freeze_evidence", "Evidence/report freeze", "Test sonucu ve olay notlari dondurulur; karar kapisi acilmaz."),
      rollbackStep("create_incident_note", "Incident note create", "Gercek incident workflow future kalir; simdilik rapor notu taslagi."),
      rollbackStep("no_vault_final_impact", "No VAULT/final impact", "Rollback adimlari VAULT/confirmed/final kararlarini degistirmez."),
    ],
    rollbackAvailableForFutureRealLab: true,
    realRollbackExecuted: false,
    realBroadcastStopped: false,
    realTargetPushDisabled: false,
    realStreamKeyRevoked: false,
    realProcessStopped: false,
    realAccessTokenInvalidated: false,
    evidenceFrozen: false,
    incidentCreated: false,
    noVaultFinalImpact: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SMOKE_ROLLBACK_RUNBOOK_DECISION_ROLE,
  };
}

function rollbackStep(stepId: string, title: string, description: string): LiveSmokeRollbackStep {
  return {
    stepId,
    title,
    description,
    executionMode: "preview_future_only",
    realActionTaken: false,
    supportOnly: true,
  };
}
