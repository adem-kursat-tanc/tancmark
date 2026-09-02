import { getLivePortPlan } from "./livePortPlan";

export const LIVE_SRS_CONFIG_TEMPLATE_DECISION_ROLE =
  "live_srs_config_template_dry_run_support_only_no_vault_no_confirmed" as const;

export interface LiveSrsConfigTemplate {
  provider: "srs";
  status: "dry_run_config_preview";
  realServerStarted: false;
  configWillBeWritten: false;
  supportedPreviewInputs: readonly ["rtmp", "srt_future", "webrtc_future"];
  supportedPreviewOutputs: readonly ["hls", "dash_future", "http_flv_future"];
  recordingPreview: "planned";
  portsPreview: ReturnType<typeof getLivePortPlan>["entries"];
  obsIngestUrlPreview: string;
  hlsPlaybackUrlPreview: string;
  recordingPathPreview: string;
  srtPreview: "future_lab";
  webRtcPreview: "future_lab";
  dvrRecordingPreview: "future_lab";
  forwardCustomTargetPreview: "future_lab";
  healthEndpointPreview: string;
  secretValuesHidden: true;
  requiresFutureRealLab: true;
  tancmarkWatermarkApplied: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_SRS_CONFIG_TEMPLATE_DECISION_ROLE;
}

export function buildLiveSrsConfigTemplate(sessionId = "live_mock_preview"): LiveSrsConfigTemplate {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_preview";
  return {
    provider: "srs",
    status: "dry_run_config_preview",
    realServerStarted: false,
    configWillBeWritten: false,
    supportedPreviewInputs: ["rtmp", "srt_future", "webrtc_future"],
    supportedPreviewOutputs: ["hls", "dash_future", "http_flv_future"],
    recordingPreview: "planned",
    portsPreview: getLivePortPlan().entries,
    obsIngestUrlPreview: `rtmp://localhost:1935/live/${safeSessionId}`,
    hlsPlaybackUrlPreview: `http://localhost:8080/live/${safeSessionId}.m3u8`,
    recordingPathPreview: `mock://recordings/srs/${safeSessionId}/`,
    srtPreview: "future_lab",
    webRtcPreview: "future_lab",
    dvrRecordingPreview: "future_lab",
    forwardCustomTargetPreview: "future_lab",
    healthEndpointPreview: "http://localhost:1985/api/v1/versions",
    secretValuesHidden: true,
    requiresFutureRealLab: true,
    tancmarkWatermarkApplied: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_SRS_CONFIG_TEMPLATE_DECISION_ROLE,
  };
}
