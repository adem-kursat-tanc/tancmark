import type { LiveEngineProvider } from "./liveObsIngestPreview";

export const LIVE_HLS_OUTPUT_PREVIEW_DECISION_ROLE =
  "live_hls_output_preview_support_only_no_real_playback_no_vault_no_confirmed" as const;

export interface LiveHlsOutputPreview {
  provider: LiveEngineProvider;
  hlsManifestUrlPreview: string;
  segmentPatternPreview: string;
  latencyProfilePreview: "standard_mock_preview" | "low_latency_future";
  cacheableByAtsFuture: true;
  playableByShakaFuture: true;
  playableByVideoJsFuture: true;
  realPlaybackEnabled: false;
  realHlsTraffic: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_OUTPUT_PREVIEW_DECISION_ROLE;
}

function providerOrDefault(provider: unknown): LiveEngineProvider {
  return provider === "mediamtx" ? "mediamtx" : "srs";
}

export function buildLiveHlsOutputPreview(provider?: unknown, sessionId = "live_mock_preview"): LiveHlsOutputPreview {
  const selectedProvider = providerOrDefault(provider);
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_preview";
  const manifest =
    selectedProvider === "srs"
      ? `http://localhost:8080/live/${safeSessionId}.m3u8`
      : `http://localhost:8888/${safeSessionId}/index.m3u8`;
  return {
    provider: selectedProvider,
    hlsManifestUrlPreview: manifest,
    segmentPatternPreview: manifest.replace(/index\.m3u8|\.m3u8/, "segment_%03d.ts"),
    latencyProfilePreview: "standard_mock_preview",
    cacheableByAtsFuture: true,
    playableByShakaFuture: true,
    playableByVideoJsFuture: true,
    realPlaybackEnabled: false,
    realHlsTraffic: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_OUTPUT_PREVIEW_DECISION_ROLE,
  };
}
