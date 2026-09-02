export const LIVE_ENGINE_CONFIG_POLICY_DECISION_ROLE =
  "live_engine_config_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveEngineConfigPolicy {
  phase: "local_lab_config_dry_run";
  realSrsServerStarted: false;
  realMediaMtxServerStarted: false;
  dockerContainerStarted: false;
  configPreviewOnly: true;
  configWillBeWritten: false;
  realSecretsIncluded: false;
  secretValuesLogged: false;
  portsArePlanOnly: true;
  realFirewallChange: false;
  realPortsOpened: false;
  realNetworkTraffic: false;
  realMediaIngestOutput: false;
  realRecordingEnabled: false;
  realCdnAtsConnection: false;
  realFfmpegConnection: false;
  srsProvidesTancMarkWatermark: false;
  mediaMtxProvidesTancMarkWatermark: false;
  tancmarkWatermarkStrategy: "separate_preseal_live_lab_future";
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_ENGINE_CONFIG_POLICY_DECISION_ROLE;
  rules: readonly string[];
}

export function getLiveEngineConfigPolicy(): LiveEngineConfigPolicy {
  return {
    phase: "local_lab_config_dry_run",
    realSrsServerStarted: false,
    realMediaMtxServerStarted: false,
    dockerContainerStarted: false,
    configPreviewOnly: true,
    configWillBeWritten: false,
    realSecretsIncluded: false,
    secretValuesLogged: false,
    portsArePlanOnly: true,
    realFirewallChange: false,
    realPortsOpened: false,
    realNetworkTraffic: false,
    realMediaIngestOutput: false,
    realRecordingEnabled: false,
    realCdnAtsConnection: false,
    realFfmpegConnection: false,
    srsProvidesTancMarkWatermark: false,
    mediaMtxProvidesTancMarkWatermark: false,
    tancmarkWatermarkStrategy: "separate_preseal_live_lab_future",
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_ENGINE_CONFIG_POLICY_DECISION_ROLE,
    rules: [
      "Bu fazda gercek SRS/MediaMTX calistirilmayacak.",
      "Sadece config preview uretilecek.",
      "Config preview gercek secret icermez.",
      "Stream key, token, password, API key loglanmaz.",
      "Portlar sadece plan olarak gosterilir.",
      "Gercek firewall/port acma yok.",
      "Gercek network trafigi yok.",
      "Gercek media ingest/output yok.",
      "Gercek recording yok.",
      "Gercek CDN/ATS baglantisi yok.",
      "Gercek FFmpeg baglantisi yok.",
      "Config dry-run VAULT/confirmed/final kararina etki etmez.",
      "SRS/MediaMTX TancMark gorunmez muhur basmaz.",
      "TancMark muhru ileride ayri pre-seal/live-seal lab katmaninda baglanacaktir.",
    ],
  };
}
