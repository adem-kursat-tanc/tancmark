import { buildDiscoveryConfig, type DiscoveryConfig } from "./config";

export interface DiscoveryApiDeferralPolicy {
  realApiConnectionDeferred: true;
  reason: "launch_minus_one_week_cost_validation";
  plannedTiming: "before_public_launch";
  suggestedWindow: "approximately_1_week_before_launch";
  realApiDefaultEnabled: false;
  allowRealApiBeforePreLaunch: false;
  requiresHumanGoNoGo: true;
  requiresProviderKeys: true;
  requiresSmallPilotTests: true;
  requiresCostMeasurementBeforePricing: true;
  supportOnlyUntilVerified: true;
  pilotOrder: readonly ["brave", "exa", "dataforseo", "acrcloud", "apify_telegram"];
  noRealApiCallToday: true;
  noRealApiKeysToday: true;
  noRealUrlOrMediaDownloadToday: true;
  noDbMigrationToday: true;
  noCommercialBehaviorAdded: true;
  decisionRole: "api_deferral_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function buildDiscoveryApiDeferralPolicy(
  config: DiscoveryConfig = buildDiscoveryConfig({ DISCOVERY_ENABLE_REAL_API: "false" }),
): DiscoveryApiDeferralPolicy {
  return {
    realApiConnectionDeferred: true,
    reason: "launch_minus_one_week_cost_validation",
    plannedTiming: "before_public_launch",
    suggestedWindow: "approximately_1_week_before_launch",
    realApiDefaultEnabled: config.realApiEnabled === true ? false : config.realApiEnabled,
    allowRealApiBeforePreLaunch: false,
    requiresHumanGoNoGo: true,
    requiresProviderKeys: true,
    requiresSmallPilotTests: true,
    requiresCostMeasurementBeforePricing: true,
    supportOnlyUntilVerified: true,
    pilotOrder: ["brave", "exa", "dataforseo", "acrcloud", "apify_telegram"],
    noRealApiCallToday: true,
    noRealApiKeysToday: true,
    noRealUrlOrMediaDownloadToday: true,
    noDbMigrationToday: true,
    noCommercialBehaviorAdded: true,
    decisionRole: "api_deferral_policy_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

export interface DiscoveryNextSteps {
  today: readonly string[];
  approximatelyOneWeekBeforeLaunch: readonly string[];
  realApiConnectionDeferred: true;
  realApiDefaultEnabled: false;
  supportOnlyUntilVerified: true;
  decisionRole: "discovery_next_steps_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function buildDiscoveryNextSteps(
  config: DiscoveryConfig = buildDiscoveryConfig({ DISCOVERY_ENABLE_REAL_API: "false" }),
): DiscoveryNextSteps {
  return {
    today: [
      "gercek API baglama yok",
      "gercek maliyet testi yok",
      "web tarama API-haric kapanis",
      "diger modullere gecilebilir",
    ],
    approximatelyOneWeekBeforeLaunch: [
      "Brave pilot",
      "Exa pilot",
      "DataForSEO pilot",
      "ACRCloud pilot",
      "Apify Telegram pilot",
      "gercek maliyet olcumu",
      "fiyatlandirma karari",
    ],
    realApiConnectionDeferred: true,
    realApiDefaultEnabled: config.realApiEnabled === true ? false : config.realApiEnabled,
    supportOnlyUntilVerified: true,
    decisionRole: "discovery_next_steps_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
