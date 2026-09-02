export type LiveEngineProvider = "srs" | "mediamtx";

export const LIVE_OBS_INGEST_PREVIEW_DECISION_ROLE =
  "live_obs_ingest_preview_support_only_no_real_connection_no_vault_no_confirmed" as const;

export interface LiveObsIngestPreview {
  provider: LiveEngineProvider;
  ingestType: "rtmp";
  serverUrlPreview: string;
  streamKeyPresent: true;
  streamKeyValueExposed: false;
  setupStatus: "mock_only";
  realConnectionEnabled: false;
  instructions: readonly string[];
  secretValuesLogged: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_OBS_INGEST_PREVIEW_DECISION_ROLE;
}

function providerOrDefault(provider: unknown): LiveEngineProvider {
  return provider === "mediamtx" ? "mediamtx" : "srs";
}

export function buildLiveObsIngestPreview(provider?: unknown): LiveObsIngestPreview {
  const selectedProvider = providerOrDefault(provider);
  const serverUrlPreview =
    selectedProvider === "srs" ? "rtmp://localhost:1935/live" : "rtmp://localhost:1935";
  return {
    provider: selectedProvider,
    ingestType: "rtmp",
    serverUrlPreview,
    streamKeyPresent: true,
    streamKeyValueExposed: false,
    setupStatus: "mock_only",
    realConnectionEnabled: false,
    instructions: [
      "OBS ac.",
      "Server alanina TancMark ingest adresi gelecek.",
      "Stream key TancMark tarafindan uretilecek.",
      "Bu fazda gercek adres yok, sadece mock preview.",
    ],
    secretValuesLogged: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_OBS_INGEST_PREVIEW_DECISION_ROLE,
  };
}
