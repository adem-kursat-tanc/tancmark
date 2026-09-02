export const LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE = "APPROVE_LIVE_SAFE_IMPROVEMENT" as const;
export const LIVE_HUMAN_APPROVAL_DECISION_ROLE =
  "live_human_approval_policy_no_vault_no_confirmed" as const;

export type LiveImprovementRiskLevel = "low" | "medium" | "high";

export interface LiveHumanApprovalPolicy {
  policyName: "live_human_approved_improvement_policy";
  approvalPhraseRequired: typeof LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE;
  riskLevels: LiveImprovementRiskLevel[];
  lowMediumRequiresHumanApproval: true;
  highRiskPlanOnly: true;
  humanApprovalRequired: true;
  autoApply: false;
  autoPatchEnabled: false;
  autoDeployEnabled: false;
  autoApiConnectionEnabled: false;
  autoDrmConnectionEnabled: false;
  autoPricingEnabled: false;
  autoRepairEnabled: false;
  forbiddenWithoutApproval: string[];
  forbiddenAlways: string[];
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_HUMAN_APPROVAL_DECISION_ROLE;
}

export function getLiveHumanApprovalPolicy(): LiveHumanApprovalPolicy {
  return {
    policyName: "live_human_approved_improvement_policy",
    approvalPhraseRequired: LIVE_SAFE_IMPROVEMENT_APPROVAL_PHRASE,
    riskLevels: ["low", "medium", "high"],
    lowMediumRequiresHumanApproval: true,
    highRiskPlanOnly: true,
    humanApprovalRequired: true,
    autoApply: false,
    autoPatchEnabled: false,
    autoDeployEnabled: false,
    autoApiConnectionEnabled: false,
    autoDrmConnectionEnabled: false,
    autoPricingEnabled: false,
    autoRepairEnabled: false,
    forbiddenWithoutApproval: [
      "patch",
      "apply",
      "config change",
      "deploy",
      "live system intervention",
      "API connection",
      "DRM connection",
      "pricing change",
    ],
    forbiddenAlways: [
      "VAULT/confirmed/final decision change",
      "ID threshold change",
      "ownership/pre-seal change",
      "TancMark ID invention",
      "missing ID completion",
      "autonomous live repair",
    ],
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_HUMAN_APPROVAL_DECISION_ROLE,
  };
}
