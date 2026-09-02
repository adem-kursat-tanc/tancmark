export const LIVE_PLAYER_POLICY_DECISION_ROLE =
  "live_player_policy_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlayerPolicy {
  phase: "mock_player_shell_only";
  rules: string[];
  realPlayerLoaded: false;
  realStreamLoaded: false;
  realHlsDashWebRtcLoaded: false;
  realShakaCdnImport: false;
  realVideoJsCdnImport: false;
  playerIsTancMarkWatermark: false;
  playerCanDecideVault: false;
  drmEnabled: false;
  drmFuture: true;
  accessBridgeMockOnly: true;
  billingCreditPaymentAdded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PLAYER_POLICY_DECISION_ROLE;
}

const rules = [
  "Bu fazda gercek player calistirilmaz.",
  "Gercek HLS/DASH/WebRTC stream cekilmez.",
  "Gercek Shaka/Video.js CDN import yapilmaz.",
  "Sadece player shell/mock preview uretilir.",
  "Player TancMark muhru degildir.",
  "Player VAULT/confirmed/final karar vermez.",
  "Player eventleri sadece supportOnly sinyaldir.",
  "DRM bu fazda yoktur, future olarak kalir.",
  "Access/token/signed URL gercek enforcement yapmaz; sadece mock bridge kurulur.",
];

export function getLivePlayerPolicy(): LivePlayerPolicy {
  return {
    phase: "mock_player_shell_only",
    rules,
    realPlayerLoaded: false,
    realStreamLoaded: false,
    realHlsDashWebRtcLoaded: false,
    realShakaCdnImport: false,
    realVideoJsCdnImport: false,
    playerIsTancMarkWatermark: false,
    playerCanDecideVault: false,
    drmEnabled: false,
    drmFuture: true,
    accessBridgeMockOnly: true,
    billingCreditPaymentAdded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PLAYER_POLICY_DECISION_ROLE,
  };
}
