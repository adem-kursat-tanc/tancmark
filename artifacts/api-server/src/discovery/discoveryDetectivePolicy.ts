import type { DiscoveryDetectivePolicySummary } from "./types";
import { DISCOVERY_NO_AUTO_ENFORCEMENT_POLICY } from "./discoveryEnforcementPolicy";
import { TELEGRAM_PUBLIC_ONLY_POLICY } from "./telegramPublicOnlyPolicy";

export const DISCOVERY_DETECTIVE_POLICY_NOTICE =
  "Bu kayit otomatik kaldirma/sikayet gondermez. TancMark sadece delil adayi ve hazir ihtar taslagi sunar. Gonderme karari kullanicidadir.";

export interface DiscoveryDetectivePolicy {
  tancmarkRole: "detective_not_police";
  policyName: "TancMark Detective Model / No Auto Enforcement Policy";
  summary: string;
  autoTakedownEnabled: false;
  autoDmcaEnabled: false;
  autoComplaintEnabled: false;
  userMustSubmitNotice: true;
  supportOnlyDiscovery: true;
  requiresTancMarkVerificationForFinal: true;
  publicSourcesOnly: true;
  privateGroupScanAllowed: false;
  loginBypassAllowed: false;
  paywallBypassAllowed: false;
  drmBypassAllowed: false;
  platformComplaintApiEnabled: false;
  noAutoEnforcementPolicy: typeof DISCOVERY_NO_AUTO_ENFORCEMENT_POLICY;
  telegramPublicOnlyPolicy: typeof TELEGRAM_PUBLIC_ONLY_POLICY;
  decisionRole: "detective_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export const DISCOVERY_DETECTIVE_POLICY: DiscoveryDetectivePolicy = {
  tancmarkRole: "detective_not_police",
  policyName: "TancMark Detective Model / No Auto Enforcement Policy",
  summary:
    "TancMark polis degildir, dedektiftir: supheli aday ve delil paketi hazirlar, otomatik sikayet veya DMCA gondermez.",
  autoTakedownEnabled: false,
  autoDmcaEnabled: false,
  autoComplaintEnabled: false,
  userMustSubmitNotice: true,
  supportOnlyDiscovery: true,
  requiresTancMarkVerificationForFinal: true,
  publicSourcesOnly: true,
  privateGroupScanAllowed: false,
  loginBypassAllowed: false,
  paywallBypassAllowed: false,
  drmBypassAllowed: false,
  platformComplaintApiEnabled: false,
  noAutoEnforcementPolicy: DISCOVERY_NO_AUTO_ENFORCEMENT_POLICY,
  telegramPublicOnlyPolicy: TELEGRAM_PUBLIC_ONLY_POLICY,
  decisionRole: "detective_policy_no_vault_no_confirmed",
  canOpenVault: false,
  confirmed: false,
  final: false,
};

export function getDiscoveryDetectivePolicy(): DiscoveryDetectivePolicy {
  return {
    ...DISCOVERY_DETECTIVE_POLICY,
    noAutoEnforcementPolicy: { ...DISCOVERY_NO_AUTO_ENFORCEMENT_POLICY },
    telegramPublicOnlyPolicy: { ...TELEGRAM_PUBLIC_ONLY_POLICY },
  };
}

export function buildDiscoveryDetectivePolicySummary(input: {
  takedownNoticeDraftAvailable?: boolean;
} = {}): DiscoveryDetectivePolicySummary {
  return {
    tancmarkRole: "detective_not_police",
    autoTakedownEnabled: false,
    autoDmcaEnabled: false,
    autoComplaintEnabled: false,
    userMustSubmitNotice: true,
    supportOnlyDiscovery: true,
    requiresTancMarkVerificationForFinal: true,
    publicSourcesOnly: true,
    privateGroupScanAllowed: false,
    loginBypassAllowed: false,
    paywallBypassAllowed: false,
    drmBypassAllowed: false,
    platformComplaintApiEnabled: false,
    autoEnforcementEnabled: false,
    noticeDeliveryByTancMark: false,
    userActionRequiredForNotice: true,
    takedownNoticeDraftAvailable: input.takedownNoticeDraftAvailable === true,
    discoveryResultsAreSupportOnly: true,
    policyNotice: DISCOVERY_DETECTIVE_POLICY_NOTICE,
    decisionRole: "detective_policy_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
