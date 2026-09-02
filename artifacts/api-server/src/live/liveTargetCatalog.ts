export type LiveTargetCatalogType =
  | "youtube_mock"
  | "facebook_mock"
  | "twitch_mock"
  | "custom_rtmp_mock"
  | "tiktok_future"
  | "instagram_future"
  | "linkedin_future"
  | "own_site_hls_mock";

export type LiveTargetCatalogStatus = "mock_only" | "planned" | "future";
export type LiveTargetRiskLevel = "low" | "medium" | "high";

export const LIVE_TARGET_CATALOG_DECISION_ROLE =
  "live_target_catalog_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetCatalogEntry {
  targetType: LiveTargetCatalogType;
  displayName: string;
  status: LiveTargetCatalogStatus;
  realApiEnabled: false;
  realPushEnabled: false;
  streamKeyRequiredPreview: boolean;
  oauthRequiredFuture: boolean;
  riskLevel: LiveTargetRiskLevel;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_CATALOG_DECISION_ROLE;
}

export function getLiveTargetCatalog(): LiveTargetCatalogEntry[] {
  return [
    entry("youtube_mock", "YouTube Live mock target", "mock_only", true, true, "medium"),
    entry("facebook_mock", "Facebook Live mock target", "mock_only", true, true, "medium"),
    entry("twitch_mock", "Twitch mock target", "mock_only", true, true, "medium"),
    entry("custom_rtmp_mock", "Custom RTMP mock target", "mock_only", true, false, "high"),
    entry("tiktok_future", "TikTok Live future target", "future", true, true, "high"),
    entry("instagram_future", "Instagram Live future target", "future", true, true, "high"),
    entry("linkedin_future", "LinkedIn Live future target", "future", true, true, "medium"),
    entry("own_site_hls_mock", "Own-site HLS mock target", "mock_only", false, false, "low"),
  ];
}

export function parseLiveTargetCatalogType(value: unknown): LiveTargetCatalogType {
  return getLiveTargetCatalog().some((entry) => entry.targetType === value)
    ? (value as LiveTargetCatalogType)
    : "custom_rtmp_mock";
}

function entry(
  targetType: LiveTargetCatalogType,
  displayName: string,
  status: LiveTargetCatalogStatus,
  streamKeyRequiredPreview: boolean,
  oauthRequiredFuture: boolean,
  riskLevel: LiveTargetRiskLevel,
): LiveTargetCatalogEntry {
  return {
    targetType,
    displayName,
    status,
    realApiEnabled: false,
    realPushEnabled: false,
    streamKeyRequiredPreview,
    oauthRequiredFuture,
    riskLevel,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_CATALOG_DECISION_ROLE,
  };
}
