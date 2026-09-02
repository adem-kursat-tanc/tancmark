export interface DiscoveryTelegramPublicOnlyPolicy {
  provider: "apify_telegram";
  publicSourcesOnly: true;
  publicChannelsOnly: true;
  publicMessagesOnly: true;
  privateGroupScanAllowed: false;
  privateChannelScanAllowed: false;
  directMessageScanAllowed: false;
  loginBypassAllowed: false;
  paywallBypassAllowed: false;
  drmBypassAllowed: false;
  platformComplaintApiEnabled: false;
  automaticTelegramComplaintEnabled: false;
  supportOnly: true;
  secureRoomRole: "suspicious_candidate_support_only";
  decisionRole: "telegram_public_only_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export const TELEGRAM_PUBLIC_ONLY_POLICY: DiscoveryTelegramPublicOnlyPolicy = {
  provider: "apify_telegram",
  publicSourcesOnly: true,
  publicChannelsOnly: true,
  publicMessagesOnly: true,
  privateGroupScanAllowed: false,
  privateChannelScanAllowed: false,
  directMessageScanAllowed: false,
  loginBypassAllowed: false,
  paywallBypassAllowed: false,
  drmBypassAllowed: false,
  platformComplaintApiEnabled: false,
  automaticTelegramComplaintEnabled: false,
  supportOnly: true,
  secureRoomRole: "suspicious_candidate_support_only",
  decisionRole: "telegram_public_only_policy_no_vault_no_confirmed",
  canOpenVault: false,
  confirmed: false,
  final: false,
};

export function getTelegramPublicOnlyPolicy(): DiscoveryTelegramPublicOnlyPolicy {
  return { ...TELEGRAM_PUBLIC_ONLY_POLICY };
}
