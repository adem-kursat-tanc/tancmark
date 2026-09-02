import { getLiveEngineConfigPolicy } from "./liveEngineConfigPolicy";
import type { LiveEngineProvider } from "./liveObsIngestPreview";
import { buildLiveHlsOutputPreview } from "./liveHlsOutputPreview";
import { buildLiveMediaMtxConfigTemplate } from "./liveMediaMtxConfigTemplate";
import { buildLiveObsIngestPreview } from "./liveObsIngestPreview";
import { getLivePortPlan } from "./livePortPlan";
import { buildLiveSrsConfigTemplate } from "./liveSrsConfigTemplate";

export const LIVE_ENGINE_CONFIG_DRY_RUN_DECISION_ROLE =
  "live_engine_config_dryrun_support_only_no_vault_no_confirmed" as const;

export interface LiveEngineConfigDryRunInput {
  provider?: LiveEngineProvider;
  sessionId?: string;
  streamKey?: string;
}

export interface LiveEngineConfigDryRun {
  provider: LiveEngineProvider;
  status: "dry_run_config_preview";
  configTemplate: ReturnType<typeof buildLiveSrsConfigTemplate> | ReturnType<typeof buildLiveMediaMtxConfigTemplate>;
  configPolicySummary: ReturnType<typeof getLiveEngineConfigPolicy>;
  portPlanSummary: ReturnType<typeof getLivePortPlan>;
  obsIngestPreviewSummary: ReturnType<typeof buildLiveObsIngestPreview>;
  hlsOutputPreviewSummary: ReturnType<typeof buildLiveHlsOutputPreview>;
  redactedConfigPreview: string;
  streamKeyPresent: boolean;
  streamKeyValueExposed: false;
  secretValuesLogged: false;
  realServerStarted: false;
  realConfigWritten: false;
  realPortsOpened: false;
  realBroadcastStarted: false;
  realNetworkTraffic: false;
  realMediaProcessed: false;
  tancmarkWatermarkApplied: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ENGINE_CONFIG_DRY_RUN_DECISION_ROLE;
}

function providerOrDefault(provider: unknown): LiveEngineProvider {
  return provider === "mediamtx" ? "mediamtx" : "srs";
}

function safeSessionId(value: unknown): string {
  if (typeof value !== "string") return "live_mock_preview";
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_preview";
}

function configPreview(provider: LiveEngineProvider, sessionId: string): string {
  if (provider === "srs") {
    return [
      "# SRS dry-run preview only",
      "listen 1935;",
      "http_server { enabled on; listen 8080; }",
      "vhost __defaultVhost__ {",
      "  hls { enabled on; }",
      `  # stream: ${sessionId}; stream_key: <redacted>`,
      "}",
    ].join("\n");
  }
  return [
    "# MediaMTX dry-run preview only",
    "rtmp: yes",
    "rtmpAddress: :1935",
    "hls: yes",
    "hlsAddress: :8888",
    "paths:",
    `  ${sessionId}:`,
    "    source: publisher",
    "    # stream_key: <redacted>",
  ].join("\n");
}

export function buildLiveEngineConfigDryRun(input: LiveEngineConfigDryRunInput = {}): LiveEngineConfigDryRun {
  const provider = providerOrDefault(input.provider);
  const sessionId = safeSessionId(input.sessionId);
  const configTemplate = provider === "srs" ? buildLiveSrsConfigTemplate(sessionId) : buildLiveMediaMtxConfigTemplate(sessionId);

  return {
    provider,
    status: "dry_run_config_preview",
    configTemplate,
    configPolicySummary: getLiveEngineConfigPolicy(),
    portPlanSummary: getLivePortPlan(),
    obsIngestPreviewSummary: buildLiveObsIngestPreview(provider),
    hlsOutputPreviewSummary: buildLiveHlsOutputPreview(provider, sessionId),
    redactedConfigPreview: configPreview(provider, sessionId),
    streamKeyPresent: typeof input.streamKey === "string" && input.streamKey.length > 0,
    streamKeyValueExposed: false,
    secretValuesLogged: false,
    realServerStarted: false,
    realConfigWritten: false,
    realPortsOpened: false,
    realBroadcastStarted: false,
    realNetworkTraffic: false,
    realMediaProcessed: false,
    tancmarkWatermarkApplied: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ENGINE_CONFIG_DRY_RUN_DECISION_ROLE,
  };
}
