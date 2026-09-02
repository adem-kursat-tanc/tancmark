export interface DiscoveryNoAutoEnforcementPolicy {
  tancmarkRole: "detective_not_police";
  autoTakedownEnabled: false;
  autoDmcaEnabled: false;
  autoComplaintEnabled: false;
  userMustSubmitNotice: true;
  supportOnlyDiscovery: true;
  requiresTancMarkVerificationForFinal: true;
  platformComplaintApiEnabled: false;
  emailSendEnabled: false;
  webhookEnabled: false;
  automaticFormSubmitEnabled: false;
  botDeliveryEnabled: false;
  noticeDeliveryByTancMark: false;
  legalReviewRecommended: true;
  decisionRole: "no_auto_enforcement_policy_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export const DISCOVERY_NO_AUTO_ENFORCEMENT_POLICY: DiscoveryNoAutoEnforcementPolicy = {
  tancmarkRole: "detective_not_police",
  autoTakedownEnabled: false,
  autoDmcaEnabled: false,
  autoComplaintEnabled: false,
  userMustSubmitNotice: true,
  supportOnlyDiscovery: true,
  requiresTancMarkVerificationForFinal: true,
  platformComplaintApiEnabled: false,
  emailSendEnabled: false,
  webhookEnabled: false,
  automaticFormSubmitEnabled: false,
  botDeliveryEnabled: false,
  noticeDeliveryByTancMark: false,
  legalReviewRecommended: true,
  decisionRole: "no_auto_enforcement_policy_no_vault_no_confirmed",
  canOpenVault: false,
  confirmed: false,
  final: false,
};

export function getDiscoveryNoAutoEnforcementPolicy(): DiscoveryNoAutoEnforcementPolicy {
  return { ...DISCOVERY_NO_AUTO_ENFORCEMENT_POLICY };
}
