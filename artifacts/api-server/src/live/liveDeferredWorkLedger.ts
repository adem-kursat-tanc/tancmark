export type LiveLedgerStatus = "done" | "mock-first" | "planned" | "future" | "blocked" | "external dependency";
export type DeferredWorkStatus =
  | "deferred"
  | "deferred_until_live_completion"
  | "planned"
  | "blocked"
  | "ready_for_lab"
  | "ready_for_real_api"
  | "mock-first"
  | "future"
  | "future_after_live"
  | "future_policy"
  | "done";
export type DeferredWorkCategory =
  | "Live"
  | "Discovery"
  | "Audio"
  | "Video"
  | "DNA"
  | "Chief Brain"
  | "Secure Room"
  | "Billing"
  | "Legal"
  | "Infrastructure"
  | "Marketing";

export const LIVE_DEFERRED_WORK_DECISION_ROLE =
  "live_deferred_work_read_only_no_vault_no_confirmed" as const;

export interface LiveCompletionGateItem {
  key: string;
  title: string;
  status: LiveLedgerStatus;
  missingWork: string;
  canMoveForward: boolean;
  notes: string;
}

export interface LiveMuxParityItem {
  feature: string;
  targetInTancMark: string;
  status: LiveLedgerStatus;
  currentCheckpoint: string;
  missingWork: string;
  canMoveForward: boolean;
  notes: string;
}

export interface DeferredWorkItem {
  id: string;
  title: string;
  category: DeferredWorkCategory;
  status: DeferredWorkStatus;
  whyDeferred: string;
  neededBeforeLaunch: boolean;
  neededBeforeLiveCompletion: boolean;
  neededAfterLiveCompletion?: boolean;
  dependencies: string[];
  riskIfForgotten: string;
  ownerAction: string;
  lastCheckpoint: string;
  notes: string;
}

export function getLiveCompletionGate() {
  const requiredItems = getLiveCompletionGateItems();
  return {
    gateName: "tancmark_live_completion_gate",
    rule: "Canli yayin modulu tamamlanmadan yeni buyuk module gecilmeyecek.",
    status: "not_complete_mock_first" as const,
    liveMustCompleteBeforeNewMajorModule: true,
    canMoveToNewMajorModule: false,
    muxParityComplete: false,
    realBroadcastEnabled: false,
    realApiCalled: false,
    realDrmConnected: false,
    realMediaSentOrDownloaded: false,
    creditPaymentBillingAdded: false,
    postLiveDeferredMajorPhases: [
      "Chief Brain / Root DNA",
      "Weekly Intelligence Brain",
      "Chief Brain to Codex command bridge",
      "Security DNA / Cyber Defense DNA",
    ],
    postLiveDeferredRule:
      "Chief Brain / Root DNA, Weekly Intelligence Brain, Security DNA / Cyber Defense DNA ve Codex command bridge canli yayin Mux-parity hedefi tamamlandiktan sonra ele alinacak buyuk fazdir. Canli yayin tamamlanmadan bu faz uygulanmayacak; sadece deferred plan olarak tutulacak.",
    requiredItems,
    completedCount: requiredItems.filter((item) => item.status === "done" || item.status === "mock-first").length,
    totalCount: requiredItems.length,
    decisionRole: LIVE_DEFERRED_WORK_DECISION_ROLE,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  };
}

export function getLiveCompletionGateItems(): LiveCompletionGateItem[] {
  return [
    gate("live_architecture_blueprint", "Live architecture blueprint", "done", "No missing blueprint work.", true, "Checkpoint 332cac9."),
    gate("srs_primary_engine_plan", "SRS primary engine plan", "done", "Real SRS install is still deferred.", true, "Plan exists; server not provisioned."),
    gate("mediamtx_secondary_plan", "MediaMTX secondary/lab plan", "done", "Real MediaMTX install is still deferred.", true, "Plan exists; lab runtime not started."),
    gate("srs_config_dry_run", "SRS config dry-run", "mock-first", "Real SRS server lab is still deferred.", true, "Config preview only."),
    gate("mediamtx_config_dry_run", "MediaMTX config dry-run", "mock-first", "Real MediaMTX server lab is still deferred.", true, "Config preview only."),
    gate("live_engine_port_plan", "Live engine port/security plan", "mock-first", "Real firewall/port opening is still deferred.", true, "Port plan and security policy only."),
    gate("obs_ingest_preview", "OBS ingest preview", "mock-first", "Real OBS ingest is still deferred.", true, "No real connection."),
    gate("hls_output_preview", "HLS output preview", "mock-first", "Real HLS playback is still deferred.", true, "No real traffic."),
    gate("ffmpeg_external_cli_policy", "FFmpeg external CLI policy", "done", "Real build/license choice pending.", true, "External CLI only."),
    gate("ffmpeg_dry_run_command_builder", "FFmpeg dry-run command builder", "mock-first", "Real FFmpeg execution is still deferred.", true, "Command previews only; willExecute=false."),
    gate("recording_vod_mock_pipeline", "Recording/VOD mock pipeline", "mock-first", "Real recording/VOD packaging is still deferred.", true, "Mock manifest, dry-run commands and support-only handoff exist."),
    gate("player_plan", "Player plan: Shaka / Video.js", "done", "Real player app pending.", true, "Plan only."),
    gate("ats_cdn_cache_blueprint", "ATS CDN/cache blueprint", "done", "Real ATS install and traffic lab are still deferred.", true, "Apache Traffic Server plan exists; no server provisioned."),
    gate("ats_cache_asset_policy", "ATS cache asset policy", "done", "Real cache validation is still deferred.", true, "Sensitive tokens, DRM endpoints and Secure Room payloads remain non-cacheable."),
    gate("ats_deployment_plan", "ATS deployment plan", "done", "Staging and production deploy are deferred.", true, "Plan only; no ATS traffic."),
    gate("live_ingest_mock", "Live ingest mock", "mock-first", "Real ingest lab is missing.", true, "Mock ingest model exists."),
    gate("live_target_mock", "Live target mock", "mock-first", "Real target delivery tests are missing.", true, "Mock target model exists."),
    gate("live_recording_mock", "Live recording mock", "mock-first", "Real recording/VOD test is missing.", true, "Mock recording policy exists."),
    gate("live_health_monitoring_mock", "Live health monitoring mock", "mock-first", "Production monitoring is missing.", true, "Mock health plan exists."),
    gate("live_event_bus_mock", "Live Event Bus mock", "mock-first", "Real event bus/webhook delivery is still deferred.", true, "Mock timeline only."),
    gate("live_webhook_payload_preview", "Webhook payload preview", "mock-first", "Real webhook send is still deferred.", true, "Redacted preview only."),
    gate("live_dna_event_learning_bridge", "Live DNA event learning bridge", "mock-first", "Real live learning feed is still deferred.", true, "Learning signal support-only."),
    gate("live_access_policy_mock", "Live Access Policy mock", "mock-first", "Real access enforcement is still deferred.", true, "Policy preview only."),
    gate("live_viewer_session_mock", "Viewer session mock", "mock-first", "Real viewer identity is still deferred.", true, "Viewer/session access preview only."),
    gate("live_signed_url_mock", "Signed URL mock", "mock-first", "Real signed URL generation is still deferred.", true, "Redacted mock only."),
    gate("live_playback_authorization_mock", "Playback authorization mock", "mock-first", "Real playback authorization is still deferred.", true, "No real gate."),
    gate("live_domain_referrer_policy_mock", "Domain/referrer restriction mock", "mock-first", "Real domain/referrer enforcement is still deferred.", true, "Policy preview only."),
    gate("live_access_audit_trail_mock", "Access audit trail mock", "mock-first", "Real access log pipeline is still deferred.", true, "Mock audit only."),
    gate("live_dna_access_learning_bridge", "Live DNA access learning bridge", "mock-first", "Real access learning feed is still deferred.", true, "Learning signal support-only."),
    gate("live_player_policy_mock", "Live Player Policy mock", "mock-first", "Real player policy enforcement is still deferred.", true, "Policy preview only."),
    gate("live_shaka_player_mock", "Shaka Player mock", "mock-first", "Real Shaka player integration is still deferred.", true, "No CDN import or real player."),
    gate("live_videojs_player_mock", "Video.js mock", "mock-first", "Real Video.js integration is still deferred.", true, "No CDN import or real player."),
    gate("live_playback_page_mock", "Playback page mock", "mock-first", "Real playback page is still deferred.", true, "Mock shell only; no stream."),
    gate("live_embed_code_preview", "Embed code preview", "mock-first", "Real embed enforcement is still deferred.", true, "Redacted preview only."),
    gate("live_player_event_mock", "Player event mock", "mock-first", "Real player telemetry is still deferred.", true, "Support-only player events."),
    gate("live_player_qoe_preview", "Player QoE preview", "mock-first", "Real QoE measurement is still deferred.", true, "Mock QoE only."),
    gate("live_player_access_bridge", "Player access bridge", "mock-first", "Real player access enforcement is still deferred.", true, "Connects mock access to mock player only."),
    gate("live_target_catalog_mock", "Live target catalog mock", "mock-first", "Real provider/API connection is still deferred.", true, "Target catalog preview only."),
    gate("youtube_target_mock", "YouTube target mock", "mock-first", "Real YouTube API/push is still deferred.", true, "No real social connection."),
    gate("facebook_target_mock", "Facebook target mock", "mock-first", "Real Facebook API/push is still deferred.", true, "No real social connection."),
    gate("twitch_target_mock", "Twitch target mock", "mock-first", "Real Twitch API/push is still deferred.", true, "No real social connection."),
    gate("custom_rtmp_target_mock", "Custom RTMP target mock", "mock-first", "Real custom RTMP push is still deferred.", true, "No real RTMP traffic."),
    gate("simulcast_route_plan_mock", "Simulcast route plan mock", "mock-first", "Real simulcast engine is still deferred.", true, "Route plan only."),
    gate("target_credential_policy_mock", "Target credential policy", "mock-first", "Real secret management is still deferred.", true, "Secrets are redacted; no values stored."),
    gate("target_event_bridge_mock", "Target event bridge", "mock-first", "Real target event feed is still deferred.", true, "Support-only target events."),
    gate("target_failure_policy_mock", "Target failure policy", "mock-first", "Real failover/retry is still deferred.", true, "Failure policy preview only."),
    gate("live_dna_target_learning_bridge", "Live DNA target learning bridge", "mock-first", "Real target learning feed is still deferred.", true, "Learning signal support-only."),
    gate("target_secure_room_handoff", "Target Secure Room handoff", "mock-first", "Real target evidence from live session is missing.", true, "Support-only target handoff exists."),
    gate("single_target_smoke_readiness_checklist", "Single-target smoke readiness checklist", "mock-first", "Real single-target smoke test is still deferred.", true, "Readiness only; no real broadcast."),
    gate("youtube_smoke_readiness_mock", "YouTube smoke readiness mock", "mock-first", "Real YouTube smoke test is still deferred.", true, "No real YouTube API or push."),
    gate("custom_rtmp_smoke_readiness_mock", "Custom RTMP smoke readiness mock", "mock-first", "Real custom RTMP smoke test is still deferred.", true, "No real RTMP traffic."),
    gate("real_lab_gate_summary", "Real lab gate summary", "mock-first", "Explicit real-lab approval and infrastructure are still missing.", true, "liveRealLabAllowed=false."),
    gate("smoke_readiness_risk_report", "Smoke readiness risk report", "mock-first", "Real risk drill is still deferred.", true, "Support-only risk list."),
    gate("smoke_readiness_secure_room_handoff", "Smoke readiness Secure Room handoff", "mock-first", "Real smoke-test evidence is missing.", true, "Readiness handoff only."),
    gate("operator_runbook_mock", "Operator runbook mock", "mock-first", "Real operator-run smoke test is still deferred.", true, "Runbook preview only."),
    gate("secret_redaction_dry_run_form", "Secret redaction dry-run form", "mock-first", "Real secret acceptance/storage is still deferred.", true, "Redacted preview only."),
    gate("secret_redaction_validator", "Secret redaction validator", "mock-first", "Production secret manager is still deferred.", true, "storageAllowed=false and logAllowed=false."),
    gate("pre_smoke_operator_checklist", "Pre-smoke operator checklist", "mock-first", "Real smoke approval is still missing.", true, "readyForRealSmoke=false."),
    gate("rollback_runbook_preview", "Rollback runbook", "mock-first", "Real rollback drill is still deferred.", true, "Preview/future steps only."),
    gate("real_smoke_approval_gate", "Real smoke approval gate", "mock-first", "Real smoke remains disallowed.", true, "APPROVE_LIVE_REAL_SMOKE_TEST documented."),
    gate("live_dna_operator_learning_bridge", "Live DNA operator learning bridge", "mock-first", "Real operator metric feed is still deferred.", true, "Learning support-only."),
    gate("operator_secure_room_handoff", "Operator Secure Room handoff", "mock-first", "Real smoke-test evidence is missing.", true, "Runbook readiness handoff only."),
    gate("real_lab_readiness_dashboard_summary", "Live real-lab readiness dashboard summary", "mock-first", "Real dashboard-triggered smoke test is still deferred.", true, "Read-only summary endpoint only."),
    gate("operator_runbook_dashboard_preview", "Operator runbook read-only preview panel", "mock-first", "Real operator approval workflow is still deferred.", true, "Preview exposes readyForRealSmoke=false."),
    gate("secret_redaction_dashboard_preview", "Secret redaction read-only preview", "mock-first", "Real secret entry/storage is still deferred.", true, "Redaction summary only; no secret values."),
    gate("smoke_readiness_dashboard_preview", "Smoke readiness read-only preview", "mock-first", "Real smoke execution is still deferred.", true, "supportOnly dashboard summary."),
    gate("real_lab_readiness_dashboard_ui_preview", "Live real-lab readiness dashboard UI preview", "mock-first", "Real dashboard approval workflow is still deferred.", true, "Route /live-readiness reads summary only."),
    gate("read_only_readiness_panel", "Read-only readiness panel", "mock-first", "Real action button/form is still deferred.", true, "No start/connect/push/secret form."),
    gate("live_approval_audit_timeline_mock", "Live approval audit timeline mock", "mock-first", "Real approval workflow is still deferred.", true, "realApprovalGranted=false."),
    gate("approval_scope_preview", "Approval scope preview", "mock-first", "Real approval actor identity is still deferred.", true, "Scope preview only."),
    gate("approval_risk_snapshot", "Approval risk snapshot", "mock-first", "Real smoke approval is still deferred.", true, "Risk support-only."),
    gate("dashboard_read_only_approval_audit_section", "Dashboard read-only approval audit section", "mock-first", "Real approval button/form is still deferred.", true, "No real approval action."),
    gate("approval_actor_identity_preview", "Approval actor identity preview", "mock-first", "Real actor identity verification is still deferred.", true, "Mock identity preview only."),
    gate("signed_approval_audit_policy_mock", "Signed approval audit policy mock", "mock-first", "Real signature/private key policy is still deferred.", true, "Policy shape only; no real signature."),
    gate("append_only_approval_log_mock", "Append-only approval log mock", "mock-first", "Real append-only production audit storage is still deferred.", true, "Mock log entries only."),
    gate("hash_chain_preview", "Hash-chain preview", "mock-first", "Real hash-chain persistence is still deferred.", true, "Preview chain only."),
    gate("signature_preview", "Signature preview", "mock-first", "Real cryptographic signature is still deferred.", true, "REDACTED_MOCK_SIGNATURE only."),
    gate("immutability_validator_preview", "Immutability validator preview", "mock-first", "Real immutability validation is still deferred.", true, "Mock validator only."),
    gate("dashboard_read_only_signed_audit_section", "Dashboard read-only signed audit section", "mock-first", "Real signed approval action is still deferred.", true, "No approval/sign/start/connect/input."),
    gate("real_smoke_go_no_go_policy", "Real Smoke Go/No-Go policy", "mock-first", "Real smoke remains disallowed until a separate approved real-lab setup.", true, "NO_GO_UNTIL_HUMAN_APPROVAL_AND_REAL_LAB_SETUP."),
    gate("real_smoke_preflight_checklist", "Real Smoke preflight checklist", "mock-first", "Real server, stream key, API, rollback, cost, security and operator approval remain missing.", true, "readyForMockReview=true; readyForRealSmoke=false."),
    gate("real_smoke_blocker_report", "Real Smoke blocker report", "mock-first", "Human approval, real lab infra, real secrets and real rollback drill are still blockers.", true, "Blockers are support-only."),
    gate("real_smoke_required_inputs", "Real Smoke required inputs preview", "mock-first", "Real inputs are listed but not accepted.", true, "realSecretAcceptedNow=false."),
    gate("real_smoke_scenario_plan", "Real Smoke scenario plan", "mock-first", "Real custom RTMP and YouTube tests remain deferred.", true, "custom_rtmp first; YouTube second."),
    gate("real_smoke_rollback_preview", "Real Smoke rollback preview", "mock-first", "Rollback is preview only; no stop/revoke/freeze action executes now.", true, "executedNow=false."),
    gate("go_no_go_dashboard_section", "Go/No-Go dashboard section", "mock-first", "Dashboard shows read-only Go/No-Go packet; real action UI is still deferred.", true, "No approval/input/start/connect/secret button."),
    gate("local_custom_rtmp_lab_plan", "Local custom RTMP lab plan", "mock-first", "MediaMTX local-only custom RTMP lab plan exists; actual smoke requires operator tools.", true, "selectedEngine=mediamtx; targetType=custom_rtmp."),
    gate("local_custom_rtmp_preflight", "Local custom RTMP preflight", "mock-first", "MediaMTX/FFmpeg or OBS are not started by TancMark; operator setup remains required.", true, "readyForActualSmokeNow=false."),
    gate("custom_rtmp_local_command_preview", "Custom RTMP local command preview", "mock-first", "MediaMTX and FFmpeg command previews exist; commands are not executed now.", true, "willExecuteCommandsNow=false."),
    gate("local_lab_secure_room_handoff", "Local lab Secure Room handoff", "mock-first", "Local lab readiness handoff exists; no real smoke evidence yet.", true, "actualSmokeExecuted=false."),
    gate("live_cost_preview", "Live cost preview", "mock-first", "Real cost measurement is missing.", true, "Unknown until lab measured."),
    gate("live_secure_room_handoff", "Live Secure Room handoff", "mock-first", "Real evidence from a live session is missing.", true, "Support-only handoff exists."),
    gate("live_dna_learning_brain", "Live DNA learning brain", "mock-first", "Real live learning metrics are deferred.", true, "Learns/summarizes/recommends only."),
    gate("live_human_approval_policy", "Live human approval policy", "done", "Human-approved apply remains future/deferred.", true, "APPROVE_LIVE_SAFE_IMPROVEMENT required."),
    gate("live_learning_signals", "Live learning signals", "mock-first", "Real signal feeds are deferred.", true, "Broad signal catalog exists."),
    gate("live_improvement_proposals", "Live improvement proposals", "mock-first", "No proposal is auto-applied.", true, "Proposal preview only."),
    gate("preseal_live_seal_policy", "Pre-seal/live-seal policy", "done", "Real live-seal lab is missing.", true, "Policy only."),
    gate("general_live_watermark_lab", "General live TancMark watermark lab", "planned", "No live watermark durability lab yet.", false, "Must not alter current watermark core."),
    gate("youtube_single_target_test", "YouTube single-target live test", "planned", "No real YouTube test yet.", false, "Requires explicit later approval."),
    gate("custom_rtmp_target_test", "Custom RTMP target test", "planned", "No real custom RTMP test yet.", false, "Requires real lab."),
    gate("live_to_vod_recording_test", "Live-to-VOD recording test", "planned", "No real recording test yet.", false, "Requires real lab."),
    gate("post_live_reseal_recommendation", "Post-live re-seal recommendation", "mock-first", "Real post-live re-seal execution is still deferred.", true, "Advisory policy only."),
    gate("external_multi_drm_plan", "External Multi-DRM plan", "done", "Provider selection and real integration pending.", true, "Plan only; no DRM connected."),
    gate("analytics_qoe_plan", "Analytics/QoE plan", "done", "Real QoE collection missing.", true, "OpenQoE future candidate."),
    gate("webhook_event_bus_plan", "Webhook/event bus plan", "mock-first", "Real event bus/webhook delivery is still deferred.", true, "Mock events and payload previews exist."),
    gate("thumbnail_gif_subtitle_clip_plan", "Thumbnail/GIF/subtitle/clip plan", "planned", "No real FFmpeg media processing pipeline yet.", false, "Future media processing."),
    gate("future_personalized_watermark_plan", "Future personalized forensic watermark plan", "future", "Future premium R&D.", false, "Not a current product promise."),
    gate("future_ab_watermark_plan", "Future A/B watermark plan", "future", "Future premium R&D.", false, "Not a current product promise."),
    gate("live_memory_update_protocol", "Live memory update protocol", "done", "Checkpoint hash should be added after this commit.", true, "System Memory and ledger are updated."),
  ];
}

export function getLiveMuxParityChecklist(): LiveMuxParityItem[] {
  const checkpoint = "332cac9";
  return [
    parity("Live ingest", "Mock ingest model and future SRS/MediaMTX ingest", "mock-first", checkpoint, "Real ingest lab.", true, "No real stream."),
    parity("RTMPS/SRT input", "SRS/MediaMTX protocol config dry-run", "mock-first", checkpoint, "RTMPS/SRT real protocol tests.", true, "No server provisioned; preview only."),
    parity("Encoding/transcoding", "FFmpeg external CLI dry-run command builder", "mock-first", checkpoint, "Real encoding ladder lab.", true, "Dry-run only; no media processing."),
    parity("Adaptive bitrate", "Future ABR ladder", "planned", checkpoint, "Real ABR ladder and playback tests.", false, "Needs FFmpeg/player lab."),
    parity("Low latency", "SRS/WebRTC and MediaMTX/WebRTC preview", "mock-first", checkpoint, "Latency lab and infra.", true, "No production target; preview only."),
    parity("Simulcast/multistream", "Target catalog, social/custom RTMP mocks and simulcast route plan", "mock-first", "pending", "Real provider API, stream key management and target fanout tests.", true, "Mock-only; no social API, stream key or push."),
    parity("CDN/delivery", "ATS CDN/cache blueprint plus Bunny/Cloudflare/external CDN future", "planned", checkpoint, "Real ATS staging, cache hit/miss and provider cost lab.", false, "Plan exists; no mini-CDN traffic."),
    parity("Live-to-VOD", "Recording/VOD mock pipeline", "mock-first", checkpoint, "Real recording and VOD packaging.", true, "Mock manifest and Secure Room handoff only."),
    parity("Recording retention", "Short retention 3-7 days storage policy", "mock-first", checkpoint, "Storage policy and cost lab.", true, "No storage provisioning."),
    parity("Token/signed URL", "Live Access Policy + Token/Signed URL mock layer", "mock-first", "pending", "Real token secret management and access enforcement.", true, "Mock-only; no real token or signed URL."),
    parity("External Multi-DRM", "External provider plan", "external dependency", checkpoint, "Provider selection and contract.", false, "No DRM connected."),
    parity("Player", "Shaka/Video.js mock adapters and playback page shell", "mock-first", "pending", "Real Shaka/Video.js/HLS/DASH/WebRTC playback.", true, "Mock-only; no real player, stream or playback."),
    parity("Analytics/QoE", "Health/QoE mock signals and player QoE preview", "mock-first", "pending", "Real QoE event collection.", true, "No real player telemetry."),
    parity("Webhooks/events", "Live Event Bus + webhook payload preview", "mock-first", checkpoint, "Real event bus and webhook delivery.", true, "No webhook delivery."),
    parity("Thumbnail/GIF", "FFmpeg dry-run previews", "mock-first", checkpoint, "Real media processing tests.", true, "Preview command builder only."),
    parity("Subtitles/captions", "Future text track workflow", "future", checkpoint, "Workflow design.", false, "Future only."),
    parity("Clipping", "FFmpeg dry-run clip workflow", "mock-first", checkpoint, "Clip generation tests.", true, "Dry-run clip command only."),
    parity("General TancMark live pre-seal", "Separate pre-seal/live-seal lab", "planned", checkpoint, "Live watermark durability lab.", false, "Core watermark unchanged."),
    parity("Post-live re-seal", "Post-live re-seal advisory policy", "mock-first", checkpoint, "Real post-live analyze/reseal execution.", true, "Advisory only."),
    parity("Secure Room handoff", "Live support-only handoff", "mock-first", checkpoint, "Real session evidence lab.", true, "No decision authority."),
    parity("Future personalized forensic watermark", "Premium R&D", "future", checkpoint, "Research and feasibility.", false, "Not product ready."),
    parity("Future A/B forensic watermark", "Premium R&D / standards research", "future", checkpoint, "Research and feasibility.", false, "Not product ready."),
    parity("Future Secure Classroom", "Education package later", "future", checkpoint, "Product design after Live completion.", false, "Blocked by Live gate."),
  ];
}

export function getDeferredWorkLedgerSummary() {
  const items = getDeferredWorkItems();
  return {
    ledgerPath: "docs/TANCMARK_DEFERRED_WORK_LEDGER.md",
    purpose: "Official deferred work, technical debt and Live completion gate ledger.",
    liveCompletionGate: getLiveCompletionGate(),
    muxParityChecklist: getLiveMuxParityChecklist(),
    deferredWorkItems: items,
    completedItemsSnapshot: getCompletedItemsSnapshot(),
    queryAnswers: getDeferredWorkQueryAnswers(),
    realApiCalled: false,
    realBroadcastStarted: false,
    realDrmConnected: false,
    realMediaSentOrDownloaded: false,
    creditPaymentBillingAdded: false,
    decisionRole: LIVE_DEFERRED_WORK_DECISION_ROLE,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  };
}

export function getDeferredWorkItems(): DeferredWorkItem[] {
  return [
    item("DISC-001", "Gercek Discovery API baglantilari", "Discovery", "ready_for_real_api", "Launch'a yakin fiyat ve provider kosullari tekrar olculmeli.", true, false, ["Brave", "Exa", "DataForSEO", "ACRCloud", "Apify Telegram"], "Web tarama pilotlari unutulabilir.", "Launch'tan yaklasik 1 hafta once tek provider pilotu.", "4b7456f", "Gercek API default kapali."),
    item("DISC-002", "Gercek maliyet olcumu", "Discovery", "deferred", "Real provider kullanimi olmadan fiyat konmamali.", true, false, ["Provider pilots"], "Yanlis fiyatlandirma riski.", "Pilotlardan sonra cost calibration.", "aeaa341", "Cost quote internal preview kalir."),
    item("DISC-003", "Live DB migration / production DB", "Infrastructure", "deferred", "Bu faz DB push/migration yapmiyor.", true, false, ["Production readiness"], "Canli ortamda kayit/izleme eksik kalabilir.", "Ayrica migration planla ve onayla.", "eb495b4", "DB push yok."),
    item("DISC-004", "DB migration/live DB", "Infrastructure", "deferred", "Discovery ve Live production kayitlari icin canli DB daha sonra planlanmali.", true, false, ["Production readiness", "migration approval"], "Production persistence borcu unutulabilir.", "DB migration planini ayri onayla.", "eb495b4", "Bu fazda DB migration yok."),
    item("LIVE-001", "Gercek live server", "Live", "deferred", "Bu faz mock-first blueprint.", true, true, ["SRS/MediaMTX selection", "Hetzner/prod infra"], "Live hazir sanilabilir.", "Lab server karari ve explicit approval.", "332cac9", "Gercek sunucu kurulmadi."),
    item("LIVE-002", "Gercek SRS kurulumu", "Live", "ready_for_lab", "SRS planlandi ama kurulmadi.", true, true, ["Live server"], "Primary engine test edilmeden Live tamam sayilabilir.", "SRS lab install and smoke test.", "332cac9", "No real SRS."),
    item("LIVE-003", "Gercek MediaMTX kurulumu", "Live", "ready_for_lab", "MediaMTX lab alternatifi planlandi ama kurulmadi.", false, true, ["Live server"], "Secondary/lab fallback eksik kalir.", "MediaMTX lab install and smoke test.", "332cac9", "No real MediaMTX."),
    item("LIVE-004", "Gercek FFmpeg live pipeline", "Live", "planned", "FFmpeg external CLI policy var, pipeline yok.", true, true, ["FFmpeg build/license choice"], "Transcode/record/clip iddialari desteksiz kalir.", "Build policy and lab pipeline.", "332cac9", "Kod icine gomulmeyecek."),
    item("LIVE-005", "ATS/CDN/cache kurulumu", "Infrastructure", "planned", "ATS blueprint var ama gercek kurulum yok.", true, true, ["External CDN choice", "ATS plan"], "Delivery maliyeti ve performansi bilinmez.", "ATS/CDN/cache lab.", "pending", "ATS planlandi; gercek trafik yok."),
    item("LIVE-006", "Gercek YouTube yayini", "Live", "planned", "Sosyal target bu fazda yasak.", false, true, ["Custom RTMP lab", "SRS/MediaMTX"], "YouTube sonrasi dayanim bilinmez.", "Single-target YouTube lab with explicit approval.", "332cac9", "No real YouTube connection."),
    item("LIVE-007", "Gercek sosyal hedefler", "Live", "deferred", "Facebook/Twitch/TikTok/Instagram baglantisi yok.", false, true, ["Live target lab"], "Simulcast iddiasi erken olur.", "Provider-specific target plan later.", "332cac9", "No real social API."),
    item("LIVE-008", "Gercek canli muhurleme", "Live", "planned", "Pre-seal/live-seal ayri lab gerektirir.", true, true, ["Live watermark lab"], "Canli koruma yanlis pazarlanabilir.", "General live watermark lab.", "332cac9", "Mevcut watermark core degismez."),
    item("LIVE-009", "Canli muhur dayanim testi", "Live", "planned", "Real platform cikislari uzerinde ID okuma olculmedi.", true, true, ["LIVE-008", "YouTube/custom RTMP lab"], "Yanlis koruma guveni.", "Durability matrix.", "332cac9", "ID yoksa VAULT yok."),
    item("LIVE-010", "YouTube sonrasi ID okuma testi", "Live", "planned", "Gercek YouTube lab yok.", false, true, ["LIVE-006", "LIVE-009"], "YouTube yeniden encode etkisi bilinmez.", "Read-after-YouTube test.", "332cac9", "No real media download now."),
    item("LIVE-011", "Live-to-VOD gercek kayit testi", "Live", "planned", "Recording policy mock.", true, true, ["FFmpeg pipeline", "storage"], "VOD iddiasi eksik kalir.", "Record and post-live verify lab.", "332cac9", "No real recording."),
    item("LIVE-012", "Gercek maliyet olcumu", "Live", "planned", "Cost preview unknownUntilLabMeasured.", true, true, ["Live lab"], "Paket/fiyat yanlis olur.", "Measure server, bandwidth, storage, CPU.", "332cac9", "No billing."),
    item("LIVE-013", "Gercek failover", "Infrastructure", "planned", "Failover production yok.", true, true, ["Production infra"], "Canli yayin kesinti riski.", "Failover design and lab.", "332cac9", "No production server."),
    item("LIVE-014", "Otonom tamir", "Live", "blocked", "Otonom tamir yok ve olmayacak.", false, false, [], "Yanlis otomasyon riski.", "Yasak olarak tut.", "332cac9", "No autonomous live repair."),
    item("LIVE-015", "Multi-DRM gercek baglantisi", "Live", "planned", "External provider gerekir.", false, true, ["DRM provider selection"], "DRM hazir sanilabilir.", "Provider research and gated adapter.", "332cac9", "No Widevine/FairPlay/PlayReady in-house."),
    item("LIVE-016", "Kisiye ozel forensic watermark", "Live", "deferred", "Future premium R&D.", false, false, ["Research"], "Premium vaat erken olur.", "Research only after general Live.", "332cac9", "No personalized watermark."),
    item("LIVE-017", "A/B watermark", "Live", "deferred", "Future premium R&D.", false, false, ["DASH-IF/ETSI research"], "A/B standardi urun gibi anlatilabilir.", "Research only.", "332cac9", "No A/B watermark."),
    item("LIVE-018", "Secure Classroom", "Live", "deferred", "Live tamamlanmadan yeni buyuk module gecilmeyecek.", false, false, ["Live completion gate"], "Odak dagilir.", "Wait until Live completion.", "332cac9", "Future product."),
    item("INFRA-001", "Hetzner/production sunucu", "Infrastructure", "deferred", "Gercek sunucu kurulumu bu fazda yok.", true, true, ["Infra approval"], "Deployment hazir sanilabilir.", "Prod server plan later.", "332cac9", "No server provisioned."),
    item("INFRA-002", "Monitoring/alert production", "Infrastructure", "planned", "Mock health var, prod monitoring yok.", true, true, ["Live server"], "Ariza gorunurlugu eksik kalir.", "Monitoring stack decision.", "332cac9", "OpenQoE future only."),
    item("INFRA-003", "Backup/failover production", "Infrastructure", "planned", "Production backup/failover yok.", true, true, ["Prod infra"], "Kesinti ve veri kaybi riski.", "Backup/failover plan.", "332cac9", "No DB migration."),
    item("BILL-001", "Live fiyatlandirma", "Billing", "deferred", "Gercek maliyet olculmeden fiyat yok.", true, true, ["LIVE-012"], "Zararli paket/fiyat riski.", "Cost-based pricing after lab.", "332cac9", "No credit/payment/billing."),
    item("BILL-002", "Live credit/billing", "Billing", "blocked", "Bu fazda kredi/odeme/billing yasak.", false, false, ["Pricing decision"], "Yanlis ticari davranis eklenir.", "Do not implement before approval.", "332cac9", "No billing schema."),
    item("LEGAL-001", "FFmpeg build/license choice", "Legal", "planned", "Policy var ama build secimi yok.", true, true, ["FFmpeg lab"], "Lisans uyumsuzlugu.", "Choose build and document notices.", "332cac9", "External CLI only."),
    item("LEGAL-002", "THIRD_PARTY_NOTICES", "Legal", "planned", "Acilabilir kaynaklar icin notice gerekebilir.", true, true, ["Provider/library choices"], "Lisans/notice eksigi.", "Prepare notices before release.", "332cac9", "SRS/MediaMTX/Shaka/Video.js/FFmpeg."),
    item("LEGAL-003", "Codec/patent risk", "Legal", "planned", "Codec secimleri mali/lisans riski tasiyabilir.", true, true, ["FFmpeg pipeline"], "Patent/lisans riski.", "Separate codec review.", "332cac9", "Needs legal review."),
    item("LEGAL-004", "ATS Apache 2.0 notu", "Legal", "done", "ATS/CDN/cache planinda Apache Traffic Server notu eklendi.", false, true, ["ATS plan"], "License/NOTICE takibi unutulabilir.", "THIRD_PARTY_NOTICES hazirlanirken ATS Apache-2.0 notunu koru.", "bd61e6a", "ATS modeled as cache blueprint; no real ATS server."),
    item("LEGAL-005", "OvenMediaEngine AGPL guard", "Legal", "done", "AGPL riski nedeniyle bu fazda kullanilmiyor.", false, false, [], "AGPL kodu yanlislikla urune girebilir.", "Keep blocked unless legal approves.", "332cac9", "Not used this phase."),
    item("ATS-001", "Gercek ATS kurulumu", "Infrastructure", "deferred", "Bu faz blueprint/mock-first; ATS kurulmaz.", true, true, ["Live server", "ATS staging approval"], "ATS hazir sanilabilir.", "Staging onayi sonrasi ATS kurulum lab.", "pending", "realAtsServerProvisioned=false."),
    item("ATS-002", "ATS staging testi", "Infrastructure", "planned", "Staging trafik testi yok.", true, true, ["ATS-001"], "Cache kurali hatalari gozukmez.", "Staging ATS smoke test.", "pending", "Gercek trafik yok."),
    item("ATS-003", "ATS cache hit/miss gercek olcumu", "Infrastructure", "planned", "Mock plan var, metrik yok.", true, true, ["ATS-002"], "Origin yuk ve maliyet tahmini yanlis olur.", "Hit/miss ve TTL matrisi olc.", "pending", "No real measurement."),
    item("ATS-004", "ATS origin load reduction testi", "Infrastructure", "planned", "Origin yuk azaltma olculmedi.", true, true, ["ATS-003"], "CDN faydasi kanitsiz kalir.", "Origin load before/after lab.", "pending", "support-only metric."),
    item("ATS-005", "ATS purge/invalidation testi", "Infrastructure", "planned", "Purge davranisi dogrulanmadi.", true, true, ["ATS-002"], "Eski veya yanlis asset yayinda kalabilir.", "Purge/invalidation lab.", "pending", "No production purge."),
    item("ATS-006", "ATS production deploy", "Infrastructure", "deferred", "Production deploy bu fazda yasak.", true, true, ["ATS-002", "ATS-003", "ATS-005"], "Hazir olmayan cache katmani canliya cikabilir.", "Explicit approval before deploy.", "pending", "productionDeployEnabled=false."),
    item("LDNA-001", "Live DNA gercek ogrenme verisi", "Live", "deferred", "Bu faz mock/read-only ogrenme kaydi.", true, true, ["Live lab"], "Oneriler gercek metrikten sanilabilir.", "Real metric feeds later.", "pending", "Learning only."),
    item("LDNA-002", "Live DNA canli metrik baglantisi", "Live", "planned", "Canli metrik pipeline yok.", true, true, ["Live monitoring"], "Gecikme/dropout/player hatalari hafizaya akmaz.", "Metric bridge lab.", "pending", "No real live connection."),
    item("LDNA-003", "Live DNA onerileri izole test hatti", "Live", "planned", "Oneri testleri contract seviyesinde.", true, true, ["LDNA-001"], "Oneri dogrulama eksik kalir.", "Isolated test runner.", "pending", "No auto apply."),
    item("LDNA-004", "Live DNA human-approved apply hatti", "Live", "deferred", "APPROVE_LIVE_SAFE_IMPROVEMENT olmadan apply yok.", false, true, ["LDNA-003"], "Onaysiz degisiklik riski.", "Future human-approved workflow only.", "pending", "autoApply=false."),
    item("LDNA-005", "Live DNA otonom tamir yasagi", "Live", "blocked", "Canli sistemde otonom tamir yapilmayacak.", false, false, [], "Yanlis otomasyon canli sistemi bozabilir.", "Blocked rule olarak koru.", "pending", "autoRepairEnabled=false."),
    item("LIVE-019", "Mux-Parity Gap Audit / Next Safe Step Report", "Live", "done", "Live gap audit raporu olusturuldu.", false, false, ["Live Completion Gate"], "Sonraki guvenli adim unutulabilir.", "FFmpeg dry-run command builder + recording/VOD mock pipeline next safe step olarak koru.", "pending", "docs/TANCMARK_LIVE_MUX_PARITY_GAP_AUDIT.md."),
    item("LIVE-020", "FFmpeg dry-run command builder", "Live", "done", "Guvenli komut preview hatti eklendi; gercek FFmpeg calismaz.", false, true, ["LIVE-019"], "Komut preview ile real execution karisabilir.", "willExecute=false ve dryRunOnly=true contractlarini koru.", "pending", "No real FFmpeg execution."),
    item("LIVE-021", "Recording/VOD mock pipeline", "Live", "done", "Mock recording manifest, VOD metadata ve Secure Room handoff eklendi.", false, true, ["LIVE-020"], "VOD hazir sanilabilir.", "supportOnly ve realMediaProcessed=false alanlarini koru.", "pending", "No real recording."),
    item("LIVE-022", "Post-live re-seal policy", "Live", "done", "Yayin sonrasi re-seal tavsiyesi mock/advisory olarak eklendi.", false, true, ["LIVE-021"], "Policy execution ile karisabilir.", "Policy advisory-only kalsin; ownership/pre-seal degismedi.", "pending", "No real re-seal execution."),
    item("LIVE-023", "Gercek HLS segment generation", "Live", "planned", "Bu fazda yalniz dry-run command preview var.", true, true, ["LIVE-020", "Real FFmpeg lab"], "Segment iddiasi gercek sanilabilir.", "Gercek FFmpeg lab icin ayri onay al.", "pending", "No HLS segment generated."),
    item("LIVE-024", "Gercek post-live ID read", "Live", "planned", "Bu fazda tancmarkIdRead=false.", true, true, ["LIVE-021", "Watermark durability lab"], "VOD kaniti yanlis yorumlanabilir.", "Post-live ID read matrix'i ayri labda olc.", "pending", "No ID read."),
    item("LIVE-025", "Gercek post-live re-seal execution", "Live", "planned", "Policy var ama re-seal calismadi.", true, true, ["LIVE-022", "Ownership/pre-seal approval"], "Yanlis sahiplik akisi riski.", "Re-seal execution'i ayri onayli fazda yap.", "pending", "No watermark applied."),
    item("LIVE-026", "SRS config dry-run", "Live", "mock-first", "SRS config preview eklendi; gercek server calismaz.", false, true, ["LIVE-019"], "SRS hazir sanilabilir.", "Config preview only ve realServerStarted=false kontratini koru.", "pending", "No real SRS server."),
    item("LIVE-027", "MediaMTX config dry-run", "Live", "mock-first", "MediaMTX config preview eklendi; gercek server calismaz.", false, true, ["LIVE-019"], "MediaMTX hazir sanilabilir.", "Config preview only ve realServerStarted=false kontratini koru.", "pending", "No real MediaMTX server."),
    item("LIVE-028", "Live engine port/security policy", "Live", "mock-first", "Port plan ve security policy eklendi; gercek firewall/port acma yok.", false, true, ["LIVE-026", "LIVE-027"], "Portlar acilmis sanilabilir.", "realPortsOpened=false ve admin public=false kalsin.", "pending", "No firewall change."),
    item("LIVE-029", "OBS ingest preview", "Live", "mock-first", "OBS ingest yonde preview eklendi; gercek OBS baglantisi yok.", false, true, ["LIVE-026", "LIVE-027"], "Kullanici gercek adres sanabilir.", "setupStatus=mock_only kalsin.", "pending", "No real OBS ingest."),
    item("LIVE-030", "HLS output preview", "Live", "mock-first", "HLS manifest/segment preview eklendi; gercek HLS trafigi yok.", false, true, ["LIVE-026", "LIVE-027"], "Playback hazir sanilabilir.", "realPlaybackEnabled=false kalsin.", "pending", "No real playback."),
    item("LIVE-031", "Engine compatibility matrix", "Live", "mock-first", "SRS primary, MediaMTX secondary/lab karsilastirma eklendi.", false, true, ["LIVE-026", "LIVE-027"], "Yanlis engine secimi riski.", "Real lab performans testi sonraya kalsin.", "pending", "Both need real lab."),
    item("LIVE-032", "Gercek OBS ingest", "Live", "planned", "Bu fazda OBS baglantisi yok.", true, true, ["LIVE-026", "LIVE-027", "Real engine lab"], "Ingest davranisi bilinmez.", "Ayri onayla real OBS smoke test.", "pending", "No RTMP/SRT/WebRTC traffic."),
    item("LIVE-033", "Gercek HLS playback", "Live", "planned", "Bu fazda HLS trafigi yok.", true, true, ["LIVE-030", "Real engine lab"], "Player/cdn davranisi bilinmez.", "Ayri onayla HLS playback lab.", "pending", "No HLS traffic."),
    item("LIVE-034", "Gercek SRS vs MediaMTX performance test", "Live", "planned", "Bu fazda performans olcumu yok.", true, true, ["LIVE-026", "LIVE-027", "Real engine lab"], "Engine secimi verisiz kalir.", "Latency/dropout/CPU/bandwidth matrix olc.", "pending", "No performance test."),
    item("LIVE-035", "Live Event Bus mock", "Live", "mock-first", "Mock event timeline ve event type katalogu eklendi.", false, true, ["Live mock session"], "Event akisi unutulabilir.", "Eventlerin supportOnly ve no-vault kaldigini koru.", "pending", "No real event publish."),
    item("LIVE-036", "Live health monitoring mock", "Live", "mock-first", "Health/target/recording/QoE mock sinyalleri eklendi.", false, true, ["Live mock session"], "Monitoring hazir sanilabilir.", "realBroadcastMeasured=false ve realServerChecked=false kalsin.", "pending", "No real health measurement."),
    item("LIVE-037", "Webhook payload preview", "Live", "mock-first", "Redacted webhook payload preview eklendi.", false, true, ["LIVE-035"], "Webhook gonderimi var sanilabilir.", "realWebhookSent=false kalsin.", "pending", "No real webhook send."),
    item("LIVE-038", "Live DNA event learning bridge", "Live", "mock-first", "Event/health sinyallerinden Live DNA advisory learning summary eklendi.", false, true, ["LIVE-035", "LIVE-036"], "Otomatik tamir sanilabilir.", "autoRepair=false, autoPatch=false ve human approval kalsin.", "pending", "No auto apply."),
    item("LIVE-039", "Gercek webhook gonderimi", "Live", "planned", "Bu fazda dis webhook yok.", true, true, ["LIVE-037", "production webhook approval"], "Integrasyonlar calisiyor sanilabilir.", "Ayri onayla webhook delivery lab.", "pending", "No external network call."),
    item("LIVE-040", "Gercek live health olcumu", "Live", "planned", "Bu fazda real server/player telemetry yok.", true, true, ["real live server"], "Monitoring verisiz kalir.", "Real health metric bridge lab.", "pending", "No real measurement."),
    item("LIVE-041", "Gercek target health polling", "Live", "planned", "Bu fazda provider/social target polling yok.", true, true, ["real target lab"], "Hedef arizalari olculemez.", "Provider-specific polling plan.", "pending", "No social API."),
    item("LIVE-042", "Gercek player QoE", "Live", "planned", "Bu fazda player telemetry yok.", true, true, ["player implementation"], "Viewer deneyimi bilinmez.", "Player QoE event schema + lab.", "pending", "No viewer tracking."),
    item("LIVE-043", "Gercek alerting/notification", "Live", "planned", "Bu fazda alert/notification yok.", true, true, ["LIVE-040"], "Ariza bildirimi eksik kalir.", "Alert policy and notification lab.", "pending", "No notification sent."),
    item("LIVE-044", "Gercek incident workflow", "Live", "planned", "Bu fazda incident workflow yok.", true, true, ["LIVE-043"], "Operasyonel surec eksik kalir.", "Incident workflow design.", "pending", "No incident automation."),
    item("LIVE-045", "Live Access Policy mock", "Live", "mock-first", "Access policy preview eklendi; gercek erisim engelleme yok.", false, true, ["Live mock session"], "Access katmani hazir sanilabilir.", "realAccessEnabled=false kalsin.", "pending", "No real access enforcement."),
    item("LIVE-046", "Viewer session mock", "Live", "mock-first", "Viewer session preview eklendi; gercek viewer identity yok.", false, true, ["LIVE-045"], "Viewer identity hazir sanilabilir.", "tokenValueExposed=false ve signedUrlValueExposed=false kalsin.", "pending", "No real identity."),
    item("LIVE-047", "Signed URL mock", "Live", "mock-first", "Redacted signed URL preview eklendi; gercek imza yok.", false, true, ["LIVE-045"], "Signed URL uretiliyor sanilabilir.", "realSignedUrlGenerated=false kalsin.", "pending", "No real signed URL."),
    item("LIVE-048", "Playback authorization mock", "Live", "mock-first", "Playback authorization preview eklendi; gercek gate yok.", false, true, ["LIVE-045", "LIVE-046"], "Gercek playback block var sanilabilir.", "realAccessEnforced=false kalsin.", "pending", "No real authorization."),
    item("LIVE-049", "Domain/referrer restriction mock", "Live", "mock-first", "Domain/referrer policy preview eklendi; gercek enforcement yok.", false, true, ["LIVE-045"], "Domain/referrer bloklari aktif sanilabilir.", "realDomainEnforcementEnabled=false kalsin.", "pending", "No real domain/referrer enforcement."),
    item("LIVE-050", "Access audit trail mock", "Live", "mock-first", "Access audit trail mock eklendi; gercek access log pipeline yok.", false, true, ["LIVE-046", "LIVE-048"], "Audit hazir sanilabilir.", "Mock audit supportOnly kalsin.", "pending", "No production audit pipeline."),
    item("LIVE-051", "Live DNA access learning bridge", "Live", "mock-first", "Access sinyallerinden Live DNA advisory learning summary eklendi.", false, true, ["LIVE-050"], "Otomatik ban/firewall sanilabilir.", "autoBan=false, autoFirewall=false ve human approval kalsin.", "pending", "No auto access action."),
    item("LIVE-052", "Gercek signed URL uretimi", "Live", "planned", "Bu fazda gercek signed URL yok.", true, true, ["LIVE-047", "token secret management"], "Playback access guvenligi eksik kalir.", "Explicit approval ile real signed URL lab.", "pending", "No real signature."),
    item("LIVE-053", "Gercek access enforcement", "Live", "planned", "Bu fazda gercek access gate yok.", true, true, ["LIVE-048", "player implementation"], "Access iddiasi erken olur.", "Real access enforcement lab.", "pending", "No real block."),
    item("LIVE-054", "Gercek token secret management", "Infrastructure", "planned", "Bu fazda token secret/rotation yok.", true, true, ["LIVE-052"], "Secret yonetimi unutulabilir.", "Secret storage/rotation policy tasarla.", "pending", "No secret value."),
    item("LIVE-055", "Gercek course/payment entitlement", "Billing", "deferred", "Bu fazda odeme/kurs uyeligi yok.", true, false, ["pricing", "billing approval"], "Paid course access yanlis pazarlanabilir.", "Billing karari sonrasi entitlement planla.", "pending", "No billing."),
    item("LIVE-056", "Gercek Secure Classroom access", "Live", "future", "Secure Classroom future producttir.", false, false, ["Secure Classroom product plan"], "Future urun bugun var sanilabilir.", "Live tamamlandiktan sonra degerlendir.", "pending", "Future only."),
    item("LIVE-057", "Gercek DRM access", "Live", "planned", "Bu fazda DRM provider yok.", false, true, ["External DRM provider"], "DRM hazir sanilabilir.", "Provider secimi ve gated adapter.", "pending", "No DRM."),
    item("LIVE-058", "Gercek viewer identity", "Infrastructure", "planned", "Bu fazda real viewer auth/identity yok.", true, true, ["auth product decision"], "Viewer session mock ile real identity karisabilir.", "Identity policy ve privacy review tasarla.", "pending", "No real user auth."),
    item("LIVE-059", "Live Player Policy mock", "Live", "mock-first", "Player policy mock olarak eklendi; gercek player calismaz.", false, true, ["LIVE-045"], "Player policy real sanilabilir.", "realPlayerLoaded=false ve realStreamLoaded=false kalsin.", "pending", "No real player."),
    item("LIVE-060", "Shaka Player mock", "Live", "mock-first", "Shaka player adapter mock shell olarak eklendi.", false, true, ["LIVE-059"], "Shaka entegre sanilabilir.", "realPlayerLoaded=false ve CDN import yok kalsin.", "pending", "No real Shaka import."),
    item("LIVE-061", "Video.js mock", "Live", "mock-first", "Video.js player adapter mock shell olarak eklendi.", false, true, ["LIVE-059"], "Video.js entegre sanilabilir.", "realPlayerLoaded=false ve CDN import yok kalsin.", "pending", "No real Video.js import."),
    item("LIVE-062", "Playback page mock", "Live", "mock-first", "Mock playback page modeli eklendi; gercek playback yok.", false, true, ["LIVE-060", "LIVE-061"], "Playback hazir sanilabilir.", "realPlaybackEnabled=false kalsin.", "pending", "No real playback."),
    item("LIVE-063", "Embed code preview", "Live", "mock-first", "Redacted iframe/script preview eklendi.", false, true, ["LIVE-062"], "Token veya signed URL ifsa riski.", "tokenValueExposed=false ve realSignedUrlGenerated=false kalsin.", "pending", "No real embed enforcement."),
    item("LIVE-064", "Player event mock", "Live", "mock-first", "Player event mock eklendi; eventler karar vermez.", false, true, ["LIVE-062"], "Player eventleri kanit sanilabilir.", "supportOnly ve canOpenVault=false kalsin.", "pending", "No real telemetry."),
    item("LIVE-065", "Player QoE preview", "Live", "mock-first", "Player QoE preview eklendi; gercek olcum yok.", false, true, ["LIVE-064"], "QoE metrikleri gercek sanilabilir.", "unknownUntilRealLabMeasured=true kalsin.", "pending", "No real QoE."),
    item("LIVE-066", "Player access bridge", "Live", "mock-first", "Access mock layer ile player mock layer arasinda preview koprusu eklendi.", false, true, ["LIVE-045", "LIVE-062"], "Access enforcement aktif sanilabilir.", "realAccessEnforced=false kalsin.", "pending", "No real access enforcement."),
    item("LIVE-067", "Gercek Shaka Player entegrasyonu", "Live", "planned", "Bu fazda Shaka CDN/import/player yok.", true, true, ["LIVE-060", "HLS/DASH lab"], "DASH/DRM davranisi bilinmez.", "Explicit approval ile real Shaka lab.", "pending", "No real Shaka player."),
    item("LIVE-068", "Gercek Video.js entegrasyonu", "Live", "planned", "Bu fazda Video.js CDN/import/player yok.", true, true, ["LIVE-061", "HLS lab"], "HLS player davranisi bilinmez.", "Explicit approval ile real Video.js lab.", "pending", "No real Video.js player."),
    item("LIVE-069", "Gercek HLS playback", "Live", "planned", "Bu fazda HLS stream cekilmedi.", true, true, ["LIVE-062", "Real engine lab"], "Playback davranisi bilinmez.", "Ayri onayla real HLS playback lab.", "pending", "No real HLS playback."),
    item("LIVE-070", "Gercek DASH playback", "Live", "planned", "Bu fazda DASH stream yok.", false, true, ["LIVE-067", "DASH packaging lab"], "DRM/DASH future belirsiz kalir.", "DASH lab planla.", "pending", "No real DASH playback."),
    item("LIVE-071", "Gercek WebRTC playback", "Live", "planned", "Bu fazda WebRTC stream yok.", false, true, ["SRS/MediaMTX real lab"], "Low-latency davranisi bilinmez.", "WebRTC playback lab planla.", "pending", "No real WebRTC."),
    item("LIVE-072", "Gercek low-latency playback", "Live", "planned", "Bu fazda latency olcumu yok.", false, true, ["LIVE-071", "QoE lab"], "Gecikme iddiasi kanitsiz kalir.", "Low-latency test matrix olc.", "pending", "No real low latency."),
    item("LIVE-073", "Gercek DRM playback", "Live", "planned", "Bu fazda DRM provider/player baglantisi yok.", false, true, ["LIVE-057", "LIVE-067"], "DRM hazir sanilabilir.", "External DRM provider secimi sonrasi lab.", "pending", "No real DRM playback."),
    item("LIVE-074", "Gercek player QoE olcumu", "Live", "planned", "Bu fazda player telemetry yok.", true, true, ["LIVE-067", "LIVE-068"], "Viewer deneyimi olculemez.", "Player QoE event collection lab.", "pending", "No real player telemetry."),
    item("LIVE-075", "Gercek embed domain enforcement", "Live", "planned", "Bu fazda embed domain enforcement yok.", true, true, ["LIVE-063", "LIVE-053"], "Embed izinsiz paylasim kontrolu eksik kalir.", "Domain/referrer enforcement lab.", "pending", "No real embed enforcement."),
    item("LIVE-076", "Live target catalog", "Live", "mock-first", "Target/provider katalogu eklendi; gercek API yok.", false, true, ["Live mock session"], "Target destegi gercek sanilabilir.", "realApiEnabled=false ve realPushEnabled=false kalsin.", "pending", "No real provider API."),
    item("LIVE-077", "YouTube target mock", "Live", "mock-first", "YouTube target mock eklendi; gercek YouTube baglantisi yok.", false, true, ["LIVE-076"], "YouTube yayini var sanilabilir.", "streamKeyValueExposed=false ve realPushEnabled=false kalsin.", "pending", "No real YouTube push."),
    item("LIVE-078", "Facebook target mock", "Live", "mock-first", "Facebook target mock eklendi; gercek Facebook baglantisi yok.", false, true, ["LIVE-076"], "Facebook yayini var sanilabilir.", "streamKeyValueExposed=false ve realPushEnabled=false kalsin.", "pending", "No real Facebook push."),
    item("LIVE-079", "Twitch target mock", "Live", "mock-first", "Twitch target mock eklendi; gercek Twitch baglantisi yok.", false, true, ["LIVE-076"], "Twitch yayini var sanilabilir.", "streamKeyValueExposed=false ve realPushEnabled=false kalsin.", "pending", "No real Twitch push."),
    item("LIVE-080", "Custom RTMP target mock", "Live", "mock-first", "Custom RTMP target mock eklendi; gercek RTMP push yok.", false, true, ["LIVE-076"], "Custom RTMP calisiyor sanilabilir.", "realPushEnabled=false kalsin.", "pending", "No real RTMP traffic."),
    item("LIVE-081", "Simulcast route plan mock", "Live", "mock-first", "Coklu hedef route plani mock olarak eklendi.", false, true, ["LIVE-077", "LIVE-078", "LIVE-079", "LIVE-080"], "Simulcast engine hazir sanilabilir.", "realBroadcastStarted=false ve realPushEnabled=false kalsin.", "pending", "No real simulcast."),
    item("LIVE-082", "Target credential policy", "Live", "mock-first", "Stream key/OAuth redaction policy eklendi.", false, true, ["LIVE-076"], "Secret degeri loglanabilir sanilabilir.", "secretStorageEnabled=false ve tokenValueExposed=false kalsin.", "pending", "No real credential stored."),
    item("LIVE-083", "Target event bridge", "Live", "mock-first", "Target event bridge eklendi; eventler supportOnly.", false, true, ["LIVE-081"], "Target eventleri karar sanilabilir.", "canOpenVault=false ve final=false kalsin.", "pending", "No real event feed."),
    item("LIVE-084", "Target failure policy", "Live", "mock-first", "Target failure/retry/fallback policy preview eklendi.", false, true, ["LIVE-083"], "Failover aktif sanilabilir.", "auto action yok; human approval kalsin.", "pending", "No real failover."),
    item("LIVE-085", "Live DNA target learning bridge", "Live", "mock-first", "Target sinyallerinden Live DNA advisory learning summary eklendi.", false, true, ["LIVE-083", "LIVE-084"], "Otomatik target kapatma/API baglama sanilabilir.", "autoTargetDisable=false ve human approval kalsin.", "pending", "No auto target action."),
    item("LIVE-086", "Target Secure Room handoff", "Live", "mock-first", "Target catalog/credential/simulcast/event/failure/DNA ozeti Secure Room'a support-only aktarildi.", false, true, ["LIVE-081", "LIVE-085"], "Target delili karar sanilabilir.", "vaultEligible=false ve confirmed=false kalsin.", "pending", "No decision authority."),
    item("LIVE-087", "Gercek YouTube API baglantisi", "Live", "planned", "Bu fazda YouTube API yok.", true, true, ["LIVE-077", "provider approval"], "YouTube simulcast dogrulanmamis kalir.", "Explicit approval ile YouTube API/push lab.", "pending", "No real YouTube API."),
    item("LIVE-088", "Gercek Facebook API baglantisi", "Live", "planned", "Bu fazda Facebook API yok.", false, true, ["LIVE-078", "provider approval"], "Facebook simulcast dogrulanmamis kalir.", "Explicit approval ile Facebook API/push lab.", "pending", "No real Facebook API."),
    item("LIVE-089", "Gercek Twitch API baglantisi", "Live", "planned", "Bu fazda Twitch API yok.", false, true, ["LIVE-079", "provider approval"], "Twitch simulcast dogrulanmamis kalir.", "Explicit approval ile Twitch API/push lab.", "pending", "No real Twitch API."),
    item("LIVE-090", "Gercek custom RTMP push", "Live", "planned", "Bu fazda custom RTMP push yok.", true, true, ["LIVE-080", "real engine lab"], "Custom target davranisi bilinmez.", "Ayri onayla custom RTMP smoke test.", "pending", "No real RTMP push."),
    item("LIVE-091", "Gercek stream key secret management", "Infrastructure", "planned", "Bu fazda gercek secret storage yok.", true, true, ["LIVE-082"], "Secret sızıntisi riski.", "Secret storage/rotation policy ve vault entegrasyonunu ayri tasarla.", "pending", "No secret value stored."),
    item("LIVE-092", "Gercek OAuth flow", "Infrastructure", "planned", "Bu fazda OAuth yok.", false, true, ["LIVE-087", "LIVE-088", "LIVE-089"], "Provider token akisi eksik kalir.", "Provider bazli OAuth flow planla.", "pending", "No OAuth token."),
    item("LIVE-093", "Gercek target health polling", "Live", "planned", "Bu fazda provider polling yok.", true, true, ["LIVE-083", "real provider lab"], "Target arizalari olculemez.", "Provider-specific polling lab.", "pending", "No real target polling."),
    item("LIVE-094", "Gercek simulcast engine", "Live", "planned", "Bu fazda simulcast engine yok.", true, true, ["LIVE-081", "real engine lab"], "Coklu hedef yayin iddiasi erken olur.", "SRS/MediaMTX/FFmpeg fanout lab.", "pending", "No real simulcast engine."),
    item("LIVE-095", "Gercek target failover", "Live", "planned", "Bu fazda failover otomasyonu yok.", true, true, ["LIVE-084", "LIVE-094"], "Hedef dusunce davranis bilinmez.", "Manual/approved failover lab.", "pending", "No real failover."),
    item("LIVE-096", "Gercek platform cost/rate-limit olcumu", "Live", "planned", "Bu fazda provider cost/rate-limit olcumu yok.", true, true, ["LIVE-087", "LIVE-088", "LIVE-089"], "Paket/fiyat ve limitler yanlis olabilir.", "Provider bazli cost/rate-limit olc.", "pending", "No real provider measurement."),
    item("LIVE-097", "Single-target smoke readiness checklist", "Live", "mock-first", "Readiness checklist eklendi ama gercek smoke test yok.", false, true, ["LIVE-076", "LIVE-080", "engine/access/player/event mock layers"], "Readiness ile real test karisabilir.", "supportOnly ve realBroadcastStarted=false alanlarini koru.", "pending", "No real smoke test."),
    item("LIVE-098", "YouTube readiness mock", "Live", "mock-first", "YouTube readiness eklendi ama gercek API/push yok.", false, true, ["LIVE-077", "LIVE-097"], "YouTube hazir sanilabilir.", "realApiEnabled=false ve realPushEnabled=false kalsin.", "pending", "No real YouTube smoke."),
    item("LIVE-099", "Custom RTMP readiness mock", "Live", "mock-first", "Custom RTMP readiness eklendi ama gercek RTMP push yok.", false, true, ["LIVE-080", "LIVE-097"], "Custom RTMP hazir sanilabilir.", "realRtmpSrtWebRtcHlsTraffic=false kalsin.", "pending", "No real RTMP smoke."),
    item("LIVE-100", "Real lab gate summary", "Live", "mock-first", "Gercek lab gate kapali; explicit onay yok.", true, true, ["LIVE-097", "secret management", "lab infra"], "Hazirlik raporu real izin sanilabilir.", "liveRealLabAllowed=false kalsin.", "pending", "canProceedToRealBroadcast=false."),
    item("LIVE-101", "Smoke readiness risk report", "Live", "mock-first", "Risk listesi var ama real risk drill yok.", true, true, ["LIVE-097"], "Secret/cost/outage riskleri unutulabilir.", "Risk report supportOnly kalsin.", "pending", "No real incident drill."),
    item("LIVE-102", "Smoke readiness Secure Room handoff", "Secure Room", "mock-first", "Secure Room readiness handoff var ama real smoke delili yok.", false, true, ["LIVE-097", "mock session"], "Handoff delil/karar sanilabilir.", "vaultEligible=false ve confirmed=false kalsin.", "pending", "Readiness evidence only."),
    item("LIVE-103", "Gercek YouTube single-target smoke test", "Live", "planned", "Bu fazda gercek YouTube yayini/API yok.", false, true, ["LIVE-098", "LIVE-100", "secret management", "real lab"], "YouTube davranisi bilinmez.", "Explicit approval ile kisa tek hedef lab.", "pending", "No real YouTube test."),
    item("LIVE-104", "Gercek custom RTMP single-target smoke test", "Live", "planned", "Bu fazda gercek custom RTMP push yok.", true, true, ["LIVE-099", "LIVE-100", "real engine lab"], "Custom RTMP davranisi bilinmez.", "Explicit approval ile kisa custom RTMP lab.", "pending", "No real custom RTMP test."),
    item("LIVE-105", "Gercek SRS/MediaMTX lab start", "Live", "planned", "Bu fazda real server/container yok.", true, true, ["LIVE-026", "LIVE-027", "LIVE-100"], "Engine davranisi bilinmez.", "Ayrik lab kurulumu ve rollback.", "pending", "No real server."),
    item("LIVE-106", "Gercek OBS ingest", "Live", "planned", "Bu fazda OBS baglantisi yok.", true, true, ["LIVE-029", "LIVE-105"], "Ingest kabul/reconnect bilinmez.", "OBS smoke test explicit approval.", "pending", "No real ingest."),
    item("LIVE-107", "Gercek HLS playback", "Live", "planned", "Bu fazda real playback yok.", true, true, ["LIVE-030", "LIVE-105"], "Player/delivery davranisi bilinmez.", "HLS playback lab.", "pending", "No real playback."),
    item("LIVE-108", "Gercek rollback drill", "Live", "planned", "Bu fazda durdurma/secret rotate/target disable drill yok.", true, true, ["LIVE-100", "LIVE-103 veya LIVE-104"], "Real testte geri donus eksik kalabilir.", "Rollback drill ayri onayla.", "pending", "No real rollback drill."),
    item("LIVE-109", "Operator runbook mock", "Live", "mock-first", "Operator runbook eklendi ama gercek test baslatmaz.", false, true, ["LIVE-097"], "Runbook real test izni sanilabilir.", "supportOnly ve readyForRealSmoke=false kalsin.", "pending", "No real run."),
    item("LIVE-110", "Secret redaction dry-run form", "Live", "mock-first", "Form secret-like inputlari redacted preview yapar; gercek secret kabul etmez.", false, true, ["LIVE-109"], "Secret degeri saklandi sanilabilir.", "realSecretStored=false ve exposed=false kalsin.", "pending", "No real secret."),
    item("LIVE-111", "Secret redaction validator", "Live", "mock-first", "Validator secret-like degerleri tespit eder ama secret manager degildir.", false, true, ["LIVE-110"], "Production secret policy eksik kalabilir.", "storageAllowed=false ve logAllowed=false kalsin.", "pending", "No storage/log."),
    item("LIVE-112", "Pre-smoke operator checklist", "Live", "mock-first", "Checklist eklendi ama real smoke approval yok.", true, true, ["LIVE-109", "LIVE-110"], "Checklist real-ready sanilabilir.", "readyForRealSmoke=false kalsin.", "pending", "Human approval required."),
    item("LIVE-113", "Rollback runbook preview", "Live", "mock-first", "Rollback adimlari preview/future; gercek islem yok.", true, true, ["LIVE-108", "LIVE-112"], "Rollback drill yapildi sanilabilir.", "realRollbackExecuted=false kalsin.", "pending", "No real rollback."),
    item("LIVE-114", "Real smoke approval gate", "Live", "mock-first", "APPROVE_LIVE_REAL_SMOKE_TEST phrase belirlendi ama gate kapali.", true, true, ["LIVE-112"], "Gate acik sanilabilir.", "realSmokeAllowed=false kalsin.", "pending", "canProceedToRealBroadcast=false."),
    item("LIVE-115", "Live DNA operator learning bridge", "Live", "mock-first", "Operator sinyalleri advisory olarak ogrenilir; otomatik test/API/deploy yok.", false, true, ["LIVE-109", "LIVE-112"], "Live DNA otomatik aksiyon aliyor sanilabilir.", "autoRealSmokeStartEnabled=false kalsin.", "pending", "Learning only."),
    item("LIVE-116", "Operator Secure Room handoff", "Secure Room", "mock-first", "Runbook/redaction/checklist/rollback/approval/DNA ozeti handoff'a eklendi.", false, true, ["LIVE-109", "LIVE-115"], "Handoff karar/delil sanilabilir.", "vaultEligible=false ve confirmed=false kalsin.", "pending", "Readiness evidence only."),
    item("LIVE-117", "Gercek secret management", "Infrastructure", "planned", "Bu fazda stream key/API key/OAuth secret saklanmaz.", true, true, ["LIVE-110", "secret storage approval"], "Real test secret guvenligi eksik kalir.", "Secret manager/rotation planini ayri onayla.", "pending", "No real secret storage."),
    item("LIVE-118", "Gercek stream key revoke", "Infrastructure", "planned", "Revoke sadece rollback preview; gercek revoke yok.", true, true, ["LIVE-117", "LIVE-113"], "Key sizintisinde donus eksik kalir.", "Revoke/rotate drill ayri onayla.", "pending", "No real revoke."),
    item("LIVE-119", "Gercek SRS/MediaMTX process start/stop", "Live", "planned", "Bu fazda real process yok.", true, true, ["LIVE-105", "LIVE-113"], "Process lifecycle olculmez.", "Lab start/stop drill ayri onayla.", "pending", "No process action."),
    item("LIVE-120", "Gercek incident workflow ve post-test report", "Live", "planned", "Incident note ve post-test report sadece taslak.", true, true, ["LIVE-113", "LIVE-116"], "Operasyon raporu eksik kalabilir.", "Incident/report workflow'u real lab sonrasi kur.", "pending", "No real incident/report."),
    item("LIVE-121", "Live real-lab readiness dashboard summary", "Live", "mock-first", "Read-only dashboard summary endpoint eklendi; gercek test baslatmaz.", false, true, ["LIVE-109", "LIVE-112", "LIVE-114"], "Dashboard real test izni sanilabilir.", "readyForRealSmoke=false ve supportOnly=true acik kalsin.", "pending", "No real dashboard action."),
    item("LIVE-122", "Operator runbook read-only preview panel", "Live", "mock-first", "Operator runbook ozeti dashboard summary icinde read-only gosterilir.", false, true, ["LIVE-109", "LIVE-121"], "Operator adimlari onay akisi sanilabilir.", "Preview only ve human approval required kalsin.", "pending", "Read-only operator preview."),
    item("LIVE-123", "Secret redaction read-only preview", "Live", "mock-first", "Secret redaction ozeti dashboard summary icinde redacted/read-only kalir.", false, true, ["LIVE-110", "LIVE-121"], "Secret degeri gosterilebilir sanilabilir.", "token/streamKey/apiKey/oauth exposed=false kalsin.", "pending", "No real secret value."),
    item("LIVE-124", "Smoke readiness read-only preview", "Live", "mock-first", "Smoke readiness ve real smoke gate dashboard summary icinde gosterilir.", false, true, ["LIVE-097", "LIVE-100", "LIVE-121"], "Readiness real smoke izni sanilabilir.", "realSmokeAllowed=false ve canProceedToRealBroadcast=false kalsin.", "pending", "No real smoke."),
    item("LIVE-125", "Gercek dashboard'dan smoke test baslatma", "Live", "planned", "Bu fazda dashboard real smoke trigger yok.", true, true, ["LIVE-121", "APPROVE_LIVE_REAL_SMOKE_TEST", "real lab"], "Yanlislikla real yayin baslatma riski.", "Ayri onayli workflow ve stop/rollback drill olmadan acma.", "pending", "No UI trigger."),
    item("LIVE-126", "Gercek approval workflow", "Live", "planned", "Bu fazda approval workflow sadece policy/gate olarak var.", true, true, ["LIVE-114", "LIVE-121"], "Onay kaydi ve sorumluluk zinciri eksik kalir.", "Explicit approval audit workflow tasarla.", "pending", "No approval automation."),
    item("LIVE-127", "Gercek secret entry form", "Infrastructure", "planned", "Bu fazda secret entry yok; redaction dry-run var.", true, true, ["LIVE-117", "LIVE-123"], "Secret sizintisi riski.", "Secret manager ve revoke/rotate plani ile ayri uygula.", "pending", "No real secret entry."),
    item("LIVE-128", "Gercek live smoke execution", "Live", "planned", "Bu fazda real smoke execution yok.", true, true, ["LIVE-103 veya LIVE-104", "LIVE-125", "LIVE-126", "LIVE-127"], "Gercek yayin davranisi bilinmez.", "Tek hedef, kisa sureli, onayli real lab olarak planla.", "pending", "No real execution."),
    item("LIVE-129", "Gercek incident/test report UI", "Live", "planned", "Bu fazda incident/test report UI yok; PROJECT_REPORT notu var.", true, true, ["LIVE-120", "LIVE-121"], "Real test sonucu operasyon kaydi eksik kalir.", "Incident and post-test UI workflow'u ayri tasarla.", "pending", "No real incident UI."),
    item("LIVE-130", "Live real-lab readiness dashboard UI preview", "Live", "mock-first", "`/live-readiness` paneli sadece summary endpointini okur.", false, true, ["LIVE-121"], "Panel real smoke izni sanilabilir.", "Read-only warning ve no-action contract kalsin.", "pending", "No start/connect/push form."),
    item("LIVE-131", "Read-only readiness panel", "Live", "mock-first", "Hazirlik, secret, target, player, engine, FFmpeg/VOD, Secure Room ve Live DNA ozetleri gorunur.", false, true, ["LIVE-121", "LIVE-130"], "Operator hazirlik raporunu aksiyon sanabilir.", "readyForRealSmoke=false ve supportOnly=true gorunur kalsin.", "pending", "No real operation."),
    item("LIVE-132", "Gercek dashboard approval workflow", "Live", "planned", "UI panelde approval workflow yok.", true, true, ["LIVE-130", "APPROVE_LIVE_REAL_SMOKE_TEST"], "Onay kaydi olmadan real test riski.", "Ayrik approval audit workflow tasarla.", "pending", "No approval UI."),
    item("LIVE-133", "Gercek smoke test start button", "Live", "planned", "UI panelde real smoke baslatma butonu yok.", true, true, ["LIVE-132", "real lab"], "Yanlislikla yayin baslatma riski.", "Stop/rollback drill olmadan acma.", "pending", "No real button."),
    item("LIVE-134", "Gercek secret input form", "Infrastructure", "planned", "UI panelde secret input/form yok.", true, true, ["LIVE-117", "LIVE-132"], "Secret sizintisi riski.", "Secret manager/revoke/rotate ile ayri uygula.", "pending", "No secret field."),
    item("LIVE-135", "Gercek YouTube/custom RTMP connect UI", "Live", "planned", "UI panelde YouTube/custom RTMP connect veya target push yok.", true, true, ["LIVE-103 veya LIVE-104", "LIVE-132", "LIVE-134"], "Gercek API/stream key/push riski.", "Tek hedef real lab onayi olmadan acma.", "pending", "No connect UI."),
    item("LIVE-136", "Gercek incident/test report UI", "Live", "planned", "UI panel sadece readiness gosterir; real incident/test raporu yok.", true, true, ["LIVE-120", "LIVE-133"], "Real test sonucu operasyon kaydi eksik kalir.", "Real smoke sonrasi incident/test UI tasarla.", "pending", "No incident UI."),
    item("LIVE-137", "Live approval audit timeline mock", "Live", "mock-first", "Approval audit policy ve mock timeline eklendi; gercek onay kabul etmez.", false, true, ["LIVE-130"], "Timeline real approval sanilabilir.", "realApprovalGranted=false ve approvalPhraseAcceptedNow=false kalsin.", "pending", "No real approval."),
    item("LIVE-138", "Approval scope preview", "Live", "mock-first", "Hedef, sure, rollback, cost/security ve post-test kapsam preview edilir.", false, true, ["LIVE-137"], "Scope preview real izin sanilabilir.", "supportOnly ve vaultImpact=none kalsin.", "pending", "Preview only."),
    item("LIVE-139", "Approval risk snapshot", "Live", "mock-first", "Approval riskleri support-only olarak listelenir.", false, true, ["LIVE-137"], "Risk listesi karar gibi anlasilabilir.", "humanApprovalRequired=true kalsin.", "pending", "No enforcement."),
    item("LIVE-140", "Dashboard read-only approval audit section", "Live", "mock-first", "`/live-readiness` paneline Approval Audit Timeline bolumu eklendi.", false, true, ["LIVE-130", "LIVE-137"], "UI onay butonu sanilabilir.", "Buton/input/start/connect yok contract'i kalsin.", "pending", "Read-only UI."),
    item("LIVE-141", "Gercek approval actor identity", "Infrastructure", "planned", "Mock actorPreview var; gercek admin/operator kimligi yok.", true, true, ["LIVE-132"], "Kim onay verdi audit'i eksik kalir.", "Identity/audit chain ayri tasarla.", "pending", "No real identity."),
    item("LIVE-142", "Gercek approval signature/audit log", "Infrastructure", "planned", "Bu fazda imzali/kalici approval audit log yok.", true, true, ["LIVE-141"], "Onay inkari ve sorumluluk zinciri eksik kalir.", "Signed append-only audit log ayri tasarla.", "pending", "No real signature."),
    item("LIVE-143", "Gercek smoke test approval", "Live", "planned", "APPROVE_LIVE_REAL_SMOKE_TEST bu fazda kabul edilmez.", true, true, ["LIVE-132", "LIVE-141", "LIVE-142"], "Real smoke onaysiz baslatilabilir sanilabilir.", "Ayrik onay workflow olmadan acma.", "pending", "No real approval accepted."),
    item("LIVE-144", "Gercek incident/test report approval", "Live", "planned", "Bu fazda incident/test report approval yok.", true, true, ["LIVE-120", "LIVE-136", "LIVE-143"], "Real test raporu onaysiz kalabilir.", "Post-test report approval akisi ayri tasarla.", "pending", "No report approval."),
    item("LIVE-145", "Approval actor identity preview", "Live", "mock-first", "Actor identity alanlari mock preview olarak eklendi; gercek kimlik dogrulama yok.", false, true, ["LIVE-137"], "Mock actor gercek onay veren kisi sanilabilir.", "identityVerified=false ve realApprovalGranted=false kalsin.", "pending", "No real actor verification."),
    item("LIVE-146", "Signed approval audit policy mock", "Live", "mock-first", "Signed audit policy shape eklendi; gercek private key veya imza yok.", false, true, ["LIVE-145"], "Signature preview gercek imza sanilabilir.", "realSignatureGenerated=false ve privateKeyUsed=false kalsin.", "pending", "Policy preview only."),
    item("LIVE-147", "Append-only approval log mock", "Live", "mock-first", "Approval eventleri append-only mock log olarak listelenir; production storage yok.", false, true, ["LIVE-146"], "Mock log kalici audit zannedilebilir.", "realAppendOnlyStorage=false ve delete/update endpoint yok kalsin.", "pending", "Mock log only."),
    item("LIVE-148", "Hash-chain preview", "Live", "mock-first", "Approval log hash-chain preview eklendi; real zincir saklama yok.", false, true, ["LIVE-147"], "Preview chain delil zinciri sanilabilir.", "realHashChainStored=false kalsin.", "pending", "Preview only."),
    item("LIVE-149", "Signature preview", "Live", "mock-first", "REDACTED_MOCK_SIGNATURE ile imza sekli gosterilir; kriptografik imza uretilmez.", false, true, ["LIVE-146"], "Mock imza gercek imza sanilabilir.", "signatureVerifiableNow=false kalsin.", "pending", "No private key."),
    item("LIVE-150", "Immutability validator preview", "Live", "mock-first", "Sequence/hash/update/delete kontrolleri mock validator ile gosterilir.", false, true, ["LIVE-147", "LIVE-148"], "Mock validator production dogrulama sanilabilir.", "realValidationPerformed=false kalsin.", "pending", "Mock validation only."),
    item("LIVE-151", "Dashboard read-only signed audit section", "Live", "mock-first", "`/live-readiness` paneline Signed Approval Audit Preview bolumu eklendi.", false, true, ["LIVE-130", "LIVE-145", "LIVE-146"], "UI signed approval aksiyonu sanilabilir.", "Onay/sign/start/input/connect yok contract'i kalsin.", "pending", "Read-only UI."),
    item("LIVE-152", "Gercek approval actor identity", "Infrastructure", "planned", "Gercek admin/operator identity provider baglantisi yok.", true, true, ["LIVE-145"], "Kimlik kaniti eksik kalir.", "Identity provider ve privacy review ayri onayla.", "pending", "No real identity provider."),
    item("LIVE-153", "Gercek approval signature", "Infrastructure", "planned", "Gercek private key, HSM/KMS veya signing service yok.", true, true, ["LIVE-146", "LIVE-152"], "Onay kaydi imzalanmamis kalir.", "KMS/HSM/signing planini ayri tasarla.", "pending", "No real signature."),
    item("LIVE-154", "Gercek append-only approval storage", "Infrastructure", "planned", "Production append-only/WORM audit storage yok.", true, true, ["LIVE-147", "LIVE-153"], "Audit log degistirilebilir sanilabilir.", "Append-only storage ve retention planini ayri onayla.", "pending", "No production audit storage."),
    item("LIVE-155", "Gercek audit export", "Infrastructure", "planned", "Imzali audit export/PDF/JSON delil cikisi yok.", false, true, ["LIVE-154"], "Real-lab audit raporu eksik kalir.", "Export format ve verification contract ayri tasarla.", "pending", "No real export."),
    item("LIVE-156", "Gercek smoke test approval workflow", "Live", "planned", "Mock signed audit gercek smoke izni kabul etmez.", true, true, ["LIVE-152", "LIVE-153", "LIVE-154"], "Real smoke onaysiz baslatilabilir sanilabilir.", "Gercek workflow'u explicit onayla ve stop/rollback ile bagla.", "pending", "No real approval workflow."),
    item("LIVE-157", "Gercek approval actor access control", "Infrastructure", "planned", "Kimlerin real smoke onayi verebilecegi enforce edilmiyor.", true, true, ["LIVE-152", "auth policy"], "Yetkisiz onay riski.", "Role/access-control policy ve audit ile ayri uygula.", "pending", "No real access control."),
    item("LIVE-158", "Real Smoke Go/No-Go policy", "Live", "mock-first", "Go/No-Go policy eklendi; gercek smoke test izni vermez.", false, true, ["LIVE-151", "LIVE-156"], "Policy real izin sanilabilir.", "allowsRealSmokeNow=false ve startsRealSmokeTestNow=false kalsin.", "pending", "NO_GO_UNTIL_HUMAN_APPROVAL_AND_REAL_LAB_SETUP."),
    item("LIVE-159", "Real Smoke preflight checklist", "Live", "mock-first", "Tum readiness katmanlari ve real blocker'lar tek checklistte toplandi.", false, true, ["LIVE-158"], "Checklist real smoke hazirligi sanilabilir.", "readyForRealSmoke=false ve supportOnly=true kalsin.", "pending", "Read-only preflight."),
    item("LIVE-160", "Real Smoke blocker report", "Live", "mock-first", "Gercek teste gecmeden onceki insan onayi, lab, secret, cost, security ve rollback engelleri listelendi.", false, true, ["LIVE-159"], "Blocker raporu izin gibi anlasilabilir.", "requiredBeforeRealSmoke=true ve supportOnly=true kalsin.", "pending", "No blocker resolved now."),
    item("LIVE-161", "Real Smoke required inputs preview", "Live", "mock-first", "Gercek test icin gereken future girdiler listelendi; bu fazda kabul edilmedi.", false, true, ["LIVE-158"], "Secret girisi var sanilabilir.", "acceptedNow=false ve realSecretAcceptedNow=false kalsin.", "pending", "No real secret accepted."),
    item("LIVE-162", "Real Smoke scenario plan", "Live", "mock-first", "Ilk real lab icin custom RTMP daha guvenli aday, YouTube ikinci adim olarak belgelendi.", false, true, ["LIVE-159"], "Scenario plan real target push sanilabilir.", "No real API/push/stream; supportOnly=true.", "pending", "custom_rtmp first; YouTube second."),
    item("LIVE-163", "Real Smoke rollback preview", "Live", "mock-first", "Broadcast stop, target push stop, stream key revoke, Secure Room freeze ve post-test report preview edildi.", false, true, ["LIVE-160"], "Rollback preview gercek drill sanilabilir.", "futureActionOnly=true ve executedNow=false kalsin.", "pending", "No real rollback executed."),
    item("LIVE-164", "Go/No-Go dashboard section", "Live", "mock-first", "`/live-readiness` paneline Real Smoke Go / No-Go bolumu eklendi.", false, true, ["LIVE-158", "LIVE-159", "LIVE-160"], "UI real test aksiyonu sanilabilir.", "Onay/input/start/connect/secret button yok contract'i kalsin.", "pending", "Read-only UI section."),
    item("LIVE-165", "Local custom RTMP lab plan", "Live", "mock-first", "MediaMTX secimli local-only custom RTMP lab plan eklendi; gercek smoke henuz calismadi.", false, true, ["LIVE-158", "LIVE-162"], "Plan real test tamamlandi sanilabilir.", "actualSmokeExecuted=false ve publicSocialTargetsEnabled=false kalsin.", "pending", "MediaMTX selected; custom_rtmp only."),
    item("LIVE-166", "Local custom RTMP preflight", "Live", "mock-first", "Local engine/config/secret redaction/port/operator eksikleri preflight olarak listelendi.", false, true, ["LIVE-165"], "Preflight gercek smoke izni sanilabilir.", "readyForActualSmokeNow=false ve humanOperatorRequired=true kalsin.", "pending", "Operator must install/start MediaMTX and FFmpeg/OBS."),
    item("LIVE-167", "Custom RTMP local command preview", "Live", "mock-first", "MediaMTX ve FFmpeg test pattern komutlari preview olarak eklendi; calistirilmaz.", false, true, ["LIVE-166"], "Komut preview yanlislikla execution sanilabilir.", "willExecuteCommandsNow=false kalsin.", "pending", "No real command execution."),
    item("LIVE-168", "Local lab Secure Room handoff", "Live", "mock-first", "Local lab hazirlik handoff'u eklendi; gercek smoke kaniti henuz yok.", false, true, ["LIVE-165", "LIVE-166"], "Handoff delil sanilabilir.", "actualSmokeExecuted=false ve supportOnly=true kalsin.", "pending", "No real local smoke evidence yet."),
    item("CBRAIN-001", "Chief Brain / Root DNA", "Chief Brain", "deferred_until_live_completion", "Canli yayin Mux-parity tamamlanmadan uygulanmayacak.", false, false, ["Live Completion Gate"], "TancMark ogrenme modullerinin daginik kalmasi, cozum uretiminde tekrar/unutma riski.", "Live tamamlandiktan sonra ana beyin mimarisini planla.", "pending", "neededAfterLiveCompletion=true.", true),
    item("CBRAIN-002", "DNA-to-Chief-Brain bridge", "Chief Brain", "future", "Tum alt DNA'larin ogrendiklerini ana beyne aktarma koprusu gelecekte kurulacak.", false, false, ["CBRAIN-001"], "Alt DNA ogrenmeleri merkez beyne akmayabilir.", "Bridge contract tasarla.", "pending", "Future only.", true),
    item("CBRAIN-003", "Chief Brain to Codex command bridge", "Chief Brain", "future", "Chief Brain ileride Codex'e guvenli komut taslagi hazirlayacak; otomasyon kurulmayacak.", false, false, ["CBRAIN-001"], "Guvenli komut taslagi standardi unutulabilir.", "Human-approved command draft flow tasarla.", "pending", "humanApprovalRequired=true.", true),
    item("CBRAIN-004", "Chief Brain risk/test/rollback planner", "Chief Brain", "future", "Her oneri icin test ve rollback plani uretme katmani gelecekte kurulacak.", false, false, ["CBRAIN-001"], "Oneriler test/rollback olmadan kalabilir.", "Risk/test/rollback schema tasarla.", "pending", "No auto apply.", true),
    item("CBRAIN-005", "Weekly Intelligence Brain", "Chief Brain", "future_after_live", "Haftalik teknoloji/hukuk/pazar/rakip arastirmasi Live sonrasina ertelendi.", false, false, ["Live Completion Gate"], "Dis dunya degisiklikleri kacirilabilir.", "Weekly research workflow planla.", "pending", "No real web scan now.", true),
    item("CBRAIN-006", "Intelligence Library", "Chief Brain", "future_after_live", "docs/TANCMARK_INTELLIGENCE_LIBRARY.md Live tamamlandiktan sonra olusturulacak.", false, false, ["CBRAIN-005"], "Haftalik arastirma daginik kalabilir.", "Intelligence Library dosyasini future fazda olustur.", "pending", "File not created now.", true),
    item("CBRAIN-007", "Outdated Information Cleaner", "Chief Brain", "future", "Eski/gecersiz bilgiyi isaretleme ve guncelleme gelecekte olacak.", false, false, ["CBRAIN-006"], "Eski bilgi pazarlama/teknik planlarda kalabilir.", "Validity status workflow tasarla.", "pending", "No scheduled job now.", true),
    item("CBRAIN-008", "Legal/License Watcher", "Chief Brain", "future", "KVKK, Resmi Gazete, WIPO, AB/ABD hukuk ve lisans kaynaklari ileride izlenecek.", false, false, ["CBRAIN-005"], "Lisans/hukuk degisiklikleri kacirilabilir.", "Legal/license watch list tasarla.", "pending", "No real legal scan now.", true),
    item("CBRAIN-009", "Cost/Market Watcher", "Chief Brain", "future", "Fiyat, API maliyet, rakip paket ve altyapi maliyeti takibi gelecekte olacak.", false, false, ["CBRAIN-005"], "Maliyet ve pazar firsatlari kacirilabilir.", "Cost/market watch list tasarla.", "pending", "No real market scan now.", true),
    item("CBRAIN-010", "Human Approval Governance", "Chief Brain", "future_policy", "Tum beyinlerin insan onay protokolu future policy olarak tutulacak.", false, false, ["CBRAIN-001"], "Onaysiz kritik degisiklik riski dogabilir.", "APPROVE_CHIEF_BRAIN_SAFE_ACTION policy tasarla.", "pending", "No patch/deploy/API/pricing without approval.", true),
    item("CBRAIN-011", "Security DNA / Cyber Defense DNA", "Chief Brain", "future_after_live", "Saldiri, abuse, anomaly, learning poison ve guvenlik arastirmalarindan ogrenip savunma onerisi uretecek alt beyin future plan olarak tutulacak.", false, false, ["CBRAIN-001", "CBRAIN-005"], "Guvenlik ogrenmeleri daginik kalabilir veya offensive/otomatik savunma ile karisabilir.", "Defensive-only Security DNA contract ve human-approved defense policy tasarla.", "pending", "No real security system/config/deploy; critical defense requires human approval.", true),
  ];
}

export function getCompletedItemsSnapshot(): string[] {
  return [
    "TancMark System Memory deep audit tamamlandi.",
    "Replit/AEGIS legacy memory tamamlandi.",
    "Discovery API-haric kapanis tamamlandi.",
    "Detective/no-auto-enforcement policy tamamlandi.",
    "Open-source Mux-like live blueprint tamamlandi.",
    "SRS/MediaMTX/FFmpeg/Shaka/Video.js/external DRM plani eklendi.",
    "Live blueprint gercek urun degildir; mock-first hazirliktir.",
    "ATS CDN/cache blueprint ve Live DNA learning brain mock-first olarak eklendi.",
    "Chief Brain / Root DNA, Weekly Intelligence Brain ve Security DNA / Cyber Defense DNA Live sonrasina ertelenmis buyuk borc olarak kaydedildi.",
    "Live Mux-Parity Gap Audit tamamlandi; next safe step FFmpeg dry-run command builder + recording/VOD mock pipeline.",
    "FFmpeg dry-run command builder ve Recording/VOD mock pipeline eklendi; gercek FFmpeg/medya isleme yok.",
    "SRS + MediaMTX local lab config dry-run eklendi; gercek server/config/port/yayin yok.",
    "Live Event Bus + Health Monitoring + Webhook Mock Layer eklendi; gercek webhook/yayin/network yok.",
    "Live Access Policy + Token/Signed URL Mock Layer eklendi; gercek token/signed URL/access/DRM yok.",
    "Live Player Shell + Embed / Playback Page Mock Layer eklendi; gercek player/stream/playback/DRM yok.",
    "Live Target Routing + Simulcast Mock Layer eklendi; gercek target push/API/stream key/yayin yok.",
    "Live Single-Target Smoke Test Readiness Checklist eklendi; YouTube/custom RTMP readiness, real-lab gate, risk report ve Secure Room readiness handoff mock-first oldu; gercek smoke test/yayin/API/stream key/RTMP trafigi yok.",
    "Live Operator Runbook + Secret Redaction Dry-Run eklendi; operator runbook, secret redaction validator/form, pre-smoke checklist, rollback runbook, real smoke approval gate, Live DNA operator learning ve Secure Room handoff mock-first oldu; gercek secret/yayin/API/target push yok.",
    "Live Real-Lab Readiness Dashboard Preview eklendi; operator runbook, secret redaction, smoke readiness, target/player/access/event/engine/FFmpeg/VOD, Secure Room ve Live DNA ozetleri read-only tek endpointte toplandi; gercek test/yayin/API/secret yok.",
    "Live Real-Lab Readiness Dashboard UI Panel eklendi; /live-readiness read-only paneli mevcut readiness summary endpointini gosterir; gercek test/yayin/API/secret/DRM/target push baslatmaz.",
    "Live Approval Audit Timeline Read-Only Layer eklendi; approval audit policy, mock timeline, scope preview, risk snapshot, Live DNA approval learning, Secure Room handoff ve dashboard read-only approval audit bolumu mock-first oldu; gercek onay/test/API/secret/target push/yayin yok.",
    "Live Approval Actor Identity + Signed Append-Only Audit Log Mock Layer eklendi; actor identity preview, signed audit policy, append-only log mock, hash-chain, signature, immutability validator, Live DNA approval audit learning, Secure Room handoff ve dashboard read-only signed audit bolumu mock-first oldu; gercek onay/imza/private key/append-only storage/test/API/secret/target push/yayin yok.",
    "Live Real Smoke Test Go/No-Go Final Decision Packet eklendi; Go/No-Go policy, preflight checklist, blocker report, required inputs, scenario plan, rollback preview, Secure Room handoff ve dashboard read-only Go/No-Go bolumu mock-first oldu; gercek test/onay/API/secret/target push/yayin yok.",
    "Live custom RTMP local lab preparation eklendi; MediaMTX secildi, local-only preflight, command preview, config artefact ve Secure Room handoff hazirlandi; mediamtx/ffmpeg bulunmadigi icin gercek smoke test calismadi.",
  ];
}

export function getDeferredWorkQueryAnswers() {
  return {
    whatIsDone:
      "System Memory, legacy sweep, Discovery non-API closure, detective policy, Live open-source mock blueprint, ATS cache blueprint, Live DNA learning brain, FFmpeg/VOD dry-run, SRS/MediaMTX config dry-run, Live Event Bus/Health/Webhook mock layer, Live Access Policy + Token/Signed URL Mock Layer, Live Player Shell + Embed / Playback Page Mock Layer, Live Target Routing + Simulcast Mock Layer, Live Single-Target Smoke Test Readiness Checklist, Live Operator Runbook + Secret Redaction Dry-Run, Live Real-Lab Readiness Dashboard Preview, Live Real-Lab Readiness Dashboard UI Panel, Live Approval Audit Timeline Read-Only Layer, Live Approval Actor Identity + Signed Append-Only Audit Log Mock Layer, Live Real Smoke Test Go/No-Go Final Decision Packet and Live custom RTMP local lab preparation are done/mock-first.",
    whatIsNotDone:
      "Real live server, SRS/MediaMTX install, FFmpeg live pipeline, real ATS traffic, real social targets, real target push, real stream key/OAuth, real secret acceptance/storage, real dashboard smoke trigger, real dashboard approval workflow, real approval actor identity, real approval signature/audit log, real append-only approval storage, real audit export, real smoke test approval workflow, real approval actor access control, real incident/test report approval, real smoke test start button, real secret input form, real YouTube/custom RTMP connect UI, real incident/test report UI, real custom RTMP single-target smoke test, real YouTube single-target smoke test, real server start/stop, real broadcast start/stop, real post-test report, real webhook delivery, real health polling, real Shaka/Video.js player, real HLS/DASH/WebRTC playback, real player QoE, real token/signed URL generation, real access enforcement, real viewer identity, real single-target smoke test, real live watermarking, DRM, billing and production infra are not done.",
    remainingLiveDebt:
      "Real lab setup, real SRS/MediaMTX server lab, real OBS ingest, real YouTube/Facebook/Twitch API, real custom RTMP push, real stream key secret management, real secret storage/revoke, real OAuth flow, real dashboard smoke trigger, real dashboard approval workflow, real approval actor identity, real approval signature/audit log, real append-only approval storage, real audit export, real smoke test approval workflow, real approval actor access control, real incident/test report approval, real smoke test start button, real secret input form, real YouTube/custom RTMP connect UI, real approval workflow, real live smoke execution, real simulcast engine, real target failover, real provider cost/rate-limit measurement, real Shaka/Video.js integration, real HLS/DASH/WebRTC playback, real engine performance test, real webhook delivery, real live health measurement, real target health polling, real player QoE, real alerting/notification, incident workflow, real token/signed URL generation, real access enforcement, real domain/referrer/embed enforcement, real viewer identity, real course/payment entitlement, ATS staging/cache measurement, real YouTube single-target smoke test, real custom RTMP smoke test, real SRS/MediaMTX lab start/stop, real OBS ingest, real HLS playback, rollback drill, real incident workflow/post-test report UI, live watermark durability, real live-to-VOD, real HLS segment generation, post-live ID read, real re-seal execution, cost measurement, monitoring, failover and legal/license notices remain.",
    nextSafeStep:
      "Live Approval Actor Identity + Signed Append-Only Audit Log Mock Layer, Live Real Smoke Test Go/No-Go Final Decision Packet and Live custom RTMP local lab preparation completed as read-only/mock-first. Next safe step is operator-assisted local custom RTMP smoke: install/start MediaMTX and FFmpeg or OBS, run the 10-second 127.0.0.1-only custom RTMP test, then record result; no real provider API, stream key, public social target push, broadcast, secret storage, dashboard smoke trigger, real dashboard approval workflow, real approval actor identity, real approval signature/audit log, real append-only audit storage, real audit export, real smoke test approval workflow, real approval actor access control, real smoke test start button, real secret input form, real YouTube/custom RTMP connect UI, real YouTube single-target smoke test, real server start/stop beyond local lab, real broadcast start/stop beyond local lab, real post-test report or media transfer without APPROVE_LIVE_REAL_SMOKE_TEST and separate local lab setup.",
    postLiveMajorDebt:
      "Chief Brain / Root DNA, Weekly Intelligence Brain, Security DNA / Cyber Defense DNA, Intelligence Library and Chief Brain to Codex command bridge are deferred until Live Mux parity is complete.",
    canMoveToNewModule:
      "Hayir. Canli yayin modulu tamamlanmadan yeni buyuk module gecilmeyecek.",
    muxParity:
      "Blueprint/mock parity is started; production Mux parity is not complete.",
    beforeLaunch:
      "Real Discovery pilots, Live lab, production infra, legal/license notices, real cost measurement and pricing must be handled before launch as applicable.",
    premiumFuture:
      "Personalized forensic watermark, A/B watermark, external Multi-DRM, encrypted streaming and Secure Classroom remain premium/future.",
  };
}

function gate(
  key: string,
  title: string,
  status: LiveLedgerStatus,
  missingWork: string,
  canMoveForward: boolean,
  notes: string,
): LiveCompletionGateItem {
  return { key, title, status, missingWork, canMoveForward, notes };
}

function parity(
  feature: string,
  targetInTancMark: string,
  status: LiveLedgerStatus,
  currentCheckpoint: string,
  missingWork: string,
  canMoveForward: boolean,
  notes: string,
): LiveMuxParityItem {
  return { feature, targetInTancMark, status, currentCheckpoint, missingWork, canMoveForward, notes };
}

function item(
  id: string,
  title: string,
  category: DeferredWorkCategory,
  status: DeferredWorkStatus,
  whyDeferred: string,
  neededBeforeLaunch: boolean,
  neededBeforeLiveCompletion: boolean,
  dependencies: string[],
  riskIfForgotten: string,
  ownerAction: string,
  lastCheckpoint: string,
  notes: string,
  neededAfterLiveCompletion = false,
): DeferredWorkItem {
  return {
    id,
    title,
    category,
    status,
    whyDeferred,
    neededBeforeLaunch,
    neededBeforeLiveCompletion,
    neededAfterLiveCompletion,
    dependencies,
    riskIfForgotten,
    ownerAction,
    lastCheckpoint,
    notes,
  };
}
