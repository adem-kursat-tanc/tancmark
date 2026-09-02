export const LIVE_REAL_SMOKE_BLOCKER_REPORT_DECISION_ROLE =
  "live_real_smoke_blocker_report_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeBlocker {
  blockerId: string;
  title: string;
  severity: "medium" | "high" | "critical";
  requiredBeforeRealSmoke: true;
  resolutionPreview: string;
  humanApprovalRequired: true;
  supportOnly: true;
}

export interface LiveRealSmokeBlockerReport {
  reportStatus: "readonly_blocker_preview";
  blockers: LiveRealSmokeBlocker[];
  blockerCount: number;
  readyForRealSmoke: false;
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_BLOCKER_REPORT_DECISION_ROLE;
}

export function getLiveRealSmokeBlockerReport(): LiveRealSmokeBlockerReport {
  const blockers: LiveRealSmokeBlocker[] = [
    blocker("human_approval_missing", "Human approval missing", "critical", "Require APPROVE_LIVE_REAL_SMOKE_TEST in a separate future approval workflow."),
    blocker("real_lab_infrastructure_missing", "Real lab infrastructure missing", "critical", "Prepare explicit SRS/MediaMTX or approved target-only lab infrastructure."),
    blocker("real_stream_key_missing", "Real stream key missing", "critical", "Collect real stream key only through future approved secret manager."),
    blocker("real_target_account_api_missing", "Real target account/API missing", "high", "Validate target account/API readiness in a separate approved lab."),
    blocker("real_secret_management_not_enabled", "Real secret management not enabled", "critical", "Enable secret storage/revoke/rotation only in a later approved phase."),
    blocker("real_rollback_drill_not_executed", "Real rollback drill not executed", "high", "Run stop/revoke/freeze drill before any real smoke."),
    blocker("real_cost_approval_missing", "Real cost approval missing", "medium", "Approve expected platform/server/bandwidth cost cap."),
    blocker("real_security_review_missing", "Real security review missing", "high", "Complete target/API/secret/access review before real test."),
    blocker("real_test_asset_session_not_selected", "Real test asset/session not selected", "medium", "Select a short safe test asset and session ID."),
    blocker("production_deploy_not_allowed", "Production deploy not allowed", "critical", "Keep production deploy disabled for this packet."),
  ];

  return {
    reportStatus: "readonly_blocker_preview",
    blockers,
    blockerCount: blockers.length,
    readyForRealSmoke: false,
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_BLOCKER_REPORT_DECISION_ROLE,
  };
}

function blocker(
  blockerId: string,
  title: string,
  severity: LiveRealSmokeBlocker["severity"],
  resolutionPreview: string,
): LiveRealSmokeBlocker {
  return {
    blockerId,
    title,
    severity,
    requiredBeforeRealSmoke: true,
    resolutionPreview,
    humanApprovalRequired: true,
    supportOnly: true,
  };
}
