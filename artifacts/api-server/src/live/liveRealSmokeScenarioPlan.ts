export const LIVE_REAL_SMOKE_SCENARIO_PLAN_DECISION_ROLE =
  "live_real_smoke_scenario_plan_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeScenario {
  targetType: "custom_rtmp" | "youtube";
  recommendationOrder: 1 | 2;
  riskLevel: "low_medium" | "medium";
  rationale: string;
  stepsPreview: string[];
  expectedSuccessCriteria: string[];
  expectedFailureCriteria: string[];
  rollbackStepsPreview: string[];
  supportOnly: true;
}

export interface LiveRealSmokeScenarioPlan {
  planStatus: "readonly_scenario_preview";
  recommendedFirstRealTarget: "custom_rtmp";
  youtubeRecommendedAsSecondStep: true;
  scenarios: LiveRealSmokeScenario[];
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_SCENARIO_PLAN_DECISION_ROLE;
}

export function getLiveRealSmokeScenarioPlan(): LiveRealSmokeScenarioPlan {
  return {
    planStatus: "readonly_scenario_preview",
    recommendedFirstRealTarget: "custom_rtmp",
    youtubeRecommendedAsSecondStep: true,
    scenarios: [
      {
        targetType: "custom_rtmp",
        recommendationOrder: 1,
        riskLevel: "low_medium",
        rationale: "Daha kontrollu; sosyal API gerekmez; sadece onayli RTMP URL/stream key gerekir.",
        stepsPreview: [
          "Create short controlled test session.",
          "Use approved custom RTMP target.",
          "Limit duration and monitor health.",
          "Stop target push and freeze report.",
        ],
        expectedSuccessCriteria: [
          "Broadcast starts and stops inside duration limit.",
          "No secret is exposed in logs or UI.",
          "Secure Room post-test report is frozen.",
        ],
        expectedFailureCriteria: [
          "Target rejects stream.",
          "Health monitor detects dropout.",
          "Rollback step cannot stop push quickly.",
        ],
        rollbackStepsPreview: ["Stop broadcast", "Stop target push", "Revoke stream key future", "Freeze Secure Room report"],
        supportOnly: true,
      },
      {
        targetType: "youtube",
        recommendationOrder: 2,
        riskLevel: "medium",
        rationale: "Gercek platforma daha yakin; hesap/stream key/API ve platform policy riski daha yuksek.",
        stepsPreview: [
          "Use approved YouTube lab account.",
          "Use short private/unlisted smoke where allowed.",
          "Measure platform health and delay.",
          "Stop and create post-test report.",
        ],
        expectedSuccessCriteria: [
          "YouTube accepts stream.",
          "Delay and health are measured.",
          "No OAuth/stream key leaks.",
        ],
        expectedFailureCriteria: [
          "Platform policy or API rejects setup.",
          "Unexpected public exposure risk appears.",
          "Cost or rate-limit exceeds cap.",
        ],
        rollbackStepsPreview: ["Stop YouTube broadcast", "Revoke/rotate key future", "Freeze evidence", "Write incident note"],
        supportOnly: true,
      },
    ],
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_SCENARIO_PLAN_DECISION_ROLE,
  };
}
