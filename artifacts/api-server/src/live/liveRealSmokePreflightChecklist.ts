import { LIVE_REAL_SMOKE_NO_GO_DECISION } from "./liveRealSmokeGoNoGoPolicy";

export const LIVE_REAL_SMOKE_PREFLIGHT_DECISION_ROLE =
  "live_real_smoke_preflight_checklist_support_only_no_vault_no_confirmed" as const;

export type LiveRealSmokePreflightGroup =
  | "core_safety"
  | "engine_readiness"
  | "processing_readiness"
  | "access_readiness"
  | "player_readiness"
  | "target_readiness"
  | "evidence_readiness"
  | "real_test_blockers";

export interface LiveRealSmokePreflightItem {
  group: LiveRealSmokePreflightGroup;
  checkKey: string;
  title: string;
  status: "pass_mock" | "blocked_for_real";
  requiredBeforeRealSmoke: boolean;
  supportOnly: true;
}

export interface LiveRealSmokePreflightChecklist {
  checklistStatus: "readonly_preflight_preview";
  readyForMockReview: true;
  readyForRealSmoke: false;
  goDecision: typeof LIVE_REAL_SMOKE_NO_GO_DECISION;
  items: LiveRealSmokePreflightItem[];
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_PREFLIGHT_DECISION_ROLE;
}

export function getLiveRealSmokePreflightChecklist(): LiveRealSmokePreflightChecklist {
  return {
    checklistStatus: "readonly_preflight_preview",
    readyForMockReview: true,
    readyForRealSmoke: false,
    goDecision: LIVE_REAL_SMOKE_NO_GO_DECISION,
    items: [
      item("core_safety", "vault_confirmed_final_unchanged", "VAULT/confirmed/final unchanged", "pass_mock", true),
      item("core_safety", "id_threshold_unchanged", "ID threshold unchanged", "pass_mock", true),
      item("core_safety", "ownership_preseal_unchanged", "ownership/pre-seal unchanged", "pass_mock", true),
      item("core_safety", "dna_decision_gates_unchanged", "DNA decision gates unchanged", "pass_mock", true),
      item("core_safety", "no_billing_credit_payment", "no billing/credit/payment", "pass_mock", true),
      item("core_safety", "no_production_deploy", "no production deploy", "pass_mock", true),
      item("engine_readiness", "srs_config_dry_run_exists", "SRS config dry-run exists", "pass_mock", true),
      item("engine_readiness", "mediamtx_config_dry_run_exists", "MediaMTX config dry-run exists", "pass_mock", true),
      item("engine_readiness", "port_plan_exists", "port plan exists", "pass_mock", true),
      item("engine_readiness", "obs_ingest_preview_exists", "OBS ingest preview exists", "pass_mock", true),
      item("processing_readiness", "ffmpeg_external_cli_policy_exists", "FFmpeg external CLI policy exists", "pass_mock", true),
      item("processing_readiness", "ffmpeg_dry_run_exists", "FFmpeg dry-run exists", "pass_mock", true),
      item("processing_readiness", "recording_vod_mock_exists", "Recording/VOD mock exists", "pass_mock", true),
      item("access_readiness", "access_policy_exists", "access policy exists", "pass_mock", true),
      item("access_readiness", "signed_url_mock_exists", "signed URL mock exists", "pass_mock", true),
      item("access_readiness", "playback_authorization_mock_exists", "playback authorization mock exists", "pass_mock", true),
      item("access_readiness", "secret_redaction_dry_run_exists", "secret redaction dry-run exists", "pass_mock", true),
      item("player_readiness", "player_shell_exists", "player shell exists", "pass_mock", true),
      item("player_readiness", "playback_page_exists", "playback page exists", "pass_mock", true),
      item("player_readiness", "embed_preview_exists", "embed preview exists", "pass_mock", true),
      item("player_readiness", "qoe_mock_exists", "QoE mock exists", "pass_mock", true),
      item("target_readiness", "youtube_readiness_exists", "YouTube readiness exists", "pass_mock", true),
      item("target_readiness", "custom_rtmp_readiness_exists", "custom RTMP readiness exists", "pass_mock", true),
      item("target_readiness", "target_catalog_exists", "target catalog exists", "pass_mock", true),
      item("target_readiness", "simulcast_plan_mock_exists", "simulcast plan mock exists", "pass_mock", true),
      item("target_readiness", "credential_policy_exists", "credential policy exists", "pass_mock", true),
      item("evidence_readiness", "secure_room_handoff_exists", "Secure Room handoff exists", "pass_mock", true),
      item("evidence_readiness", "readiness_dashboard_exists", "readiness dashboard exists", "pass_mock", true),
      item("evidence_readiness", "approval_audit_timeline_exists", "approval audit timeline exists", "pass_mock", true),
      item("evidence_readiness", "signed_audit_mock_exists", "signed audit mock exists", "pass_mock", true),
      item("real_test_blockers", "real_server_not_started", "real server not started", "blocked_for_real", true),
      item("real_test_blockers", "real_stream_key_missing", "real stream key missing", "blocked_for_real", true),
      item("real_test_blockers", "real_api_not_connected", "real API not connected", "blocked_for_real", true),
      item("real_test_blockers", "real_target_push_not_approved", "real target push not approved", "blocked_for_real", true),
      item("real_test_blockers", "real_rollback_drill_not_executed", "real rollback drill not executed", "blocked_for_real", true),
      item("real_test_blockers", "real_cost_unknown", "real cost unknown", "blocked_for_real", true),
      item("real_test_blockers", "real_security_review_pending", "real security review pending", "blocked_for_real", true),
      item("real_test_blockers", "real_operator_approval_missing", "real operator approval missing", "blocked_for_real", true),
    ],
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_PREFLIGHT_DECISION_ROLE,
  };
}

function item(
  group: LiveRealSmokePreflightGroup,
  checkKey: string,
  title: string,
  status: LiveRealSmokePreflightItem["status"],
  requiredBeforeRealSmoke: boolean,
): LiveRealSmokePreflightItem {
  return {
    group,
    checkKey,
    title,
    status,
    requiredBeforeRealSmoke,
    supportOnly: true,
  };
}
