export type LivePlayerProviderName = "shaka" | "videojs";

export const LIVE_PLAYER_PROVIDER_MATRIX_DECISION_ROLE =
  "live_player_provider_matrix_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlayerProviderMatrixRow {
  provider: LivePlayerProviderName;
  license: string;
  bestUse: string;
  hlsSupportPreview: boolean;
  dashSupportPreview: boolean;
  drmFutureSupport: boolean;
  lowLatencyFuture: boolean;
  browserSupportPreview: string;
  integrationRisk: "low" | "medium";
  nextTestRecommendation: string;
  forensicWatermarkProvided: false;
  realPlayerLoaded: false;
  realStreamLoaded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PLAYER_PROVIDER_MATRIX_DECISION_ROLE;
}

export function getLivePlayerProviderMatrix(): LivePlayerProviderMatrixRow[] {
  return [
    row({
      provider: "shaka",
      license: "Apache-2.0",
      bestUse: "DASH/DRM future icin guclu aday.",
      hlsSupportPreview: true,
      dashSupportPreview: true,
      drmFutureSupport: true,
      lowLatencyFuture: true,
      browserSupportPreview: "Modern browser playback lab icin uygun aday.",
      integrationRisk: "medium",
      nextTestRecommendation: "Gercek labda DASH/HLS/DRM davranisi olculmeli; bu fazda CDN import yok.",
    }),
    row({
      provider: "videojs",
      license: "Apache-2.0",
      bestUse: "Yaygin HLS/player shell icin guclu aday.",
      hlsSupportPreview: true,
      dashSupportPreview: false,
      drmFutureSupport: true,
      lowLatencyFuture: true,
      browserSupportPreview: "Yaygin browser/player shell lablari icin uygun aday.",
      integrationRisk: "low",
      nextTestRecommendation: "Gercek labda HLS, plugin ve QoE olaylari olculmeli; bu fazda player indirme yok.",
    }),
  ];
}

function row(
  input: Omit<
    LivePlayerProviderMatrixRow,
    | "forensicWatermarkProvided"
    | "realPlayerLoaded"
    | "realStreamLoaded"
    | "supportOnly"
    | "canOpenVault"
    | "confirmed"
    | "final"
    | "decisionRole"
  >,
): LivePlayerProviderMatrixRow {
  return {
    ...input,
    forensicWatermarkProvided: false,
    realPlayerLoaded: false,
    realStreamLoaded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PLAYER_PROVIDER_MATRIX_DECISION_ROLE,
  };
}
