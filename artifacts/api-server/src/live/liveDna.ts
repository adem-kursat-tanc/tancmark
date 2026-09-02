import { getLiveAtsCdnCachePlan } from "./liveAtsCdnCachePlan";
import { buildLiveImprovementProposals } from "./liveImprovementProposals";
import { getLiveLearningSignalCatalog } from "./liveLearningSignals";
import { seedLiveLearningMemoryForMock } from "./liveLearningMemory";

export const LIVE_DNA_DECISION_ROLE = "live_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveDnaSummary {
  liveModuleSummary: string;
  bestWorkingEngine: string;
  weakEngine: string;
  bestTargetRoute: string;
  riskyTargetRoute: string;
  latencySummary: string;
  costLearningSummary: string;
  sealSurvivalSummary: string;
  atsCacheLearningSummary: string;
  recommendedNextTests: string[];
  humanApprovedImprovementProposal: ReturnType<typeof buildLiveImprovementProposals>;
  learnedSignalCount: number;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  autoRepairEnabled: false;
  autoPatchEnabled: false;
  autoDeployEnabled: false;
  autoApiConnectionEnabled: false;
  autoDrmConnectionEnabled: false;
  autoPricingEnabled: false;
  inventedId: false;
  completesMissingId: false;
  changesThreshold: false;
  changesOwnershipPreSeal: false;
  autonomousLiveRepair: false;
  decisionRole: typeof LIVE_DNA_DECISION_ROLE;
}

export function getLiveDnaSummary(): LiveDnaSummary {
  const signalCatalog = getLiveLearningSignalCatalog();
  const records = seedLiveLearningMemoryForMock();
  const atsPlan = getLiveAtsCdnCachePlan();

  return {
    liveModuleSummary:
      "Live DNA learns from live API attempts, provider docs, SRS/MediaMTX/ATS/FFmpeg behavior, targets, cost, QoE, watermark durability, post-live ID reads and security/license signals; it only summarizes and recommends.",
    bestWorkingEngine: "unknown_until_real_lab",
    weakEngine: "unknown_until_real_lab",
    bestTargetRoute: "mock_custom_rtmp_first_for_future_lab",
    riskyTargetRoute: "social_platform_api_before_provider_docs_and_safety_gate",
    latencySummary: "No real latency measurement yet; mock records only.",
    costLearningSummary: "Estimated-vs-actual cost learning is deferred until real lab measurement.",
    sealSurvivalSummary: "Live watermark survival is not claimed until post-live ID read tests exist.",
    atsCacheLearningSummary: `${atsPlan.layerName} is blueprint-only; cache hit/miss and origin load reduction must be measured later.`,
    recommendedNextTests: records.map((record) => record.recommendedNextTest),
    humanApprovedImprovementProposal: buildLiveImprovementProposals(records),
    learnedSignalCount: signalCatalog.signals.length,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    autoRepairEnabled: false,
    autoPatchEnabled: false,
    autoDeployEnabled: false,
    autoApiConnectionEnabled: false,
    autoDrmConnectionEnabled: false,
    autoPricingEnabled: false,
    inventedId: false,
    completesMissingId: false,
    changesThreshold: false,
    changesOwnershipPreSeal: false,
    autonomousLiveRepair: false,
    decisionRole: LIVE_DNA_DECISION_ROLE,
  };
}
