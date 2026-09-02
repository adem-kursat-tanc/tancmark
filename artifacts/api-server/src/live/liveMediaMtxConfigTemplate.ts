import { getLivePortPlan } from "./livePortPlan";

export const LIVE_MEDIAMTX_CONFIG_TEMPLATE_DECISION_ROLE =
  "live_mediamtx_config_template_dry_run_support_only_no_vault_no_confirmed" as const;

export interface LiveMediaMtxConfigTemplate {
  provider: "mediamtx";
  status: "dry_run_config_preview";
  realServerStarted: false;
  configWillBeWritten: false;
  supportedPreviewInputs: readonly ["rtmp", "srt", "webrtc"];
  supportedPreviewOutputs: readonly ["hls", "webrtc"];
  recordingPreview: "planned";
  controlApiPreview: "planned";
  portsPreview: ReturnType<typeof getLivePortPlan>["entries"];
  obsIngestUrlPreview: string;
  hlsPlaybackUrlPreview: string;
  recordingPathPreview: string;
  pathPolicyPreview: "allowlist_mock_paths_only";
  secretValuesHidden: true;
  requiresFutureRealLab: true;
  tancmarkWatermarkApplied: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_MEDIAMTX_CONFIG_TEMPLATE_DECISION_ROLE;
}

export function buildLiveMediaMtxConfigTemplate(sessionId = "live_mock_preview"): LiveMediaMtxConfigTemplate {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_preview";
  return {
    provider: "mediamtx",
    status: "dry_run_config_preview",
    realServerStarted: false,
    configWillBeWritten: false,
    supportedPreviewInputs: ["rtmp", "srt", "webrtc"],
    supportedPreviewOutputs: ["hls", "webrtc"],
    recordingPreview: "planned",
    controlApiPreview: "planned",
    portsPreview: getLivePortPlan().entries,
    obsIngestUrlPreview: `rtmp://localhost:1935/${safeSessionId}`,
    hlsPlaybackUrlPreview: `http://localhost:8888/${safeSessionId}/index.m3u8`,
    recordingPathPreview: `mock://recordings/mediamtx/${safeSessionId}/`,
    pathPolicyPreview: "allowlist_mock_paths_only",
    secretValuesHidden: true,
    requiresFutureRealLab: true,
    tancmarkWatermarkApplied: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_MEDIAMTX_CONFIG_TEMPLATE_DECISION_ROLE,
  };
}
