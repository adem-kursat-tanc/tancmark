import { buildLiveCostPreview } from "./liveCostPreview";
import { getLiveAtsCacheAssetPolicy } from "./liveAtsCacheAssetPolicy";
import { getLiveAtsCdnCachePlan } from "./liveAtsCdnCachePlan";
import { getLiveDnaSummary } from "./liveDna";
import { getLiveFeatureStatusMatrix } from "./liveFeatureStatusMatrix";
import { buildLiveImprovementProposals } from "./liveImprovementProposals";
import { getLiveLearningSignalCatalog } from "./liveLearningSignals";
import { getLiveLicenseRiskPolicy } from "./liveLicenseRiskPolicy";
import { getLiveMuxLikeCapabilityMap } from "./liveMuxLikeCapabilityMap";
import { getLiveOpenSourceArchitecture } from "./liveOpenSourceArchitecture";
import { getLivePreSealPolicy } from "./livePreSealPolicy";
import type { LiveIngestModel } from "./liveIngestModel";
import type { TancMarkLiveSession } from "./liveSessionModel";
import type { LiveTargetModel } from "./liveTargetModel";

export const LIVE_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveSecureRoomHandoffInput {
  session: TancMarkLiveSession;
  ingests?: LiveIngestModel[];
  targets?: LiveTargetModel[];
}

export function buildLiveSecureRoomHandoff(input: LiveSecureRoomHandoffInput) {
  const architecture = getLiveOpenSourceArchitecture();
  const capabilities = getLiveMuxLikeCapabilityMap();
  const featureStatus = getLiveFeatureStatusMatrix();
  const licenseRisk = getLiveLicenseRiskPolicy();
  const preSealPolicy = getLivePreSealPolicy();
  const costPreview = buildLiveCostPreview();
  const atsPlan = getLiveAtsCdnCachePlan();
  const atsAssetPolicy = getLiveAtsCacheAssetPolicy();
  const liveDna = getLiveDnaSummary();
  const learningSignals = getLiveLearningSignalCatalog();
  const improvementProposals = buildLiveImprovementProposals();
  const ingests = input.ingests ?? [];
  const targets = input.targets ?? [];

  return {
    liveSessionId: input.session.sessionId,
    architectureSummary: {
      architectureName: architecture.architectureName,
      status: architecture.status,
      primaryStreamingEngine: architecture.primaryStreamingEngine,
      secondaryStreamingEngine: architecture.secondaryStreamingEngine,
    },
    engineSummary: {
      selectedEngine: input.session.engine,
      primaryCandidate: "srs",
      secondaryLabCandidate: "mediamtx",
      realServerProvisioned: false,
      realBroadcastStarted: false,
    },
    ingestSummary: {
      count: ingests.length,
      types: ingests.map((ingest) => ingest.ingestType),
      allSecretValuesHidden: ingests.every((ingest) => ingest.secretValuesHidden === true),
      realIngestEnabled: false,
    },
    targetsSummary: {
      count: targets.length,
      types: targets.map((target) => target.targetType),
      allSecretValuesHidden: targets.every((target) => target.secretValuesHidden === true),
      realSocialConnection: false,
    },
    muxLikeCapabilitySummary: {
      capabilityCount: capabilities.length,
      mockFirstCount: capabilities.filter((capability) => capability.status === "mock-first").length,
      futureOrExternalCount: capabilities.filter(
        (capability) => capability.status === "future" || capability.status === "external-provider",
      ).length,
    },
    featureStatusSummary: {
      featureCount: featureStatus.length,
      prohibitedThisPhaseCount: featureStatus.filter((feature) => feature.status === "prohibited_this_phase")
        .length,
      realBroadcastProhibited: true,
    },
    licenseRiskSummary: {
      itemCount: licenseRisk.entries.length,
      ovenMediaEngineAgplNotUsed: licenseRisk.entries.some(
        (item) =>
          item.component === "OvenMediaEngine" &&
          item.riskLevel === "high" &&
          item.status === "not_used_this_phase",
      ),
    },
    preSealPolicySummary: {
      tancmarkWatermarkProvidedBySrsOrMediaMtx: false,
      separatePreSealRequired: preSealPolicy.tancmarkWatermarkLayer === "separate_preseal_live_lab_future",
      existingWatermarkSystemChanged: false,
    },
    costPreviewSummary: {
      unknownUntilLabMeasured: costPreview.unknownUntilLabMeasured,
      realPricingEnabled: costPreview.realPricingEnabled,
      creditPaymentBillingAdded: costPreview.creditPaymentBillingAdded,
    },
    atsCdnCachePlanSummary: {
      layerName: atsPlan.layerName,
      status: atsPlan.status,
      licenseType: atsPlan.licenseType,
      realAtsServerProvisioned: atsPlan.realAtsServerProvisioned,
      realTrafficServed: atsPlan.realTrafficServed,
      isStreamingEngine: atsPlan.isStreamingEngine,
      isWatermarkEngine: atsPlan.isWatermarkEngine,
      isDrmEngine: atsPlan.isDrmEngine,
    },
    atsCacheAssetPolicySummary: {
      cacheableAssetCount: atsAssetPolicy.cacheableAssets.length,
      sensitiveNonCacheableCount: atsAssetPolicy.sensitiveNonCacheable.length,
      personalTokensCached: atsAssetPolicy.personalTokensCached,
      drmLicenseEndpointCached: atsAssetPolicy.drmLicenseEndpointCached,
      secureRoomPayloadCached: atsAssetPolicy.secureRoomPayloadCached,
    },
    liveDnaSummary: {
      liveModuleSummary: liveDna.liveModuleSummary,
      learnedSignalCount: liveDna.learnedSignalCount,
      autoRepairEnabled: liveDna.autoRepairEnabled,
      autoPatchEnabled: liveDna.autoPatchEnabled,
      inventedId: liveDna.inventedId,
      completesMissingId: liveDna.completesMissingId,
      changesThreshold: liveDna.changesThreshold,
    },
    liveLearningSignalsSummary: {
      signalCount: learningSignals.signals.length,
      supportOnly: learningSignals.supportOnly,
      decisionRole: learningSignals.decisionRole,
    },
    liveImprovementProposalSummary: {
      proposalCount: improvementProposals.recommendations.length,
      humanApprovalRequired: improvementProposals.humanApprovalRequired,
      autoApply: improvementProposals.autoApply,
      approvalPhraseRequired: improvementProposals.approvalPhraseRequired,
    },
    liveProtectionEnabled: false,
    drmEnabled: false,
    personalizedWatermarkEnabled: false,
    abForensicWatermarkEnabled: false,
    realServerProvisioned: false,
    realBroadcastStarted: false,
    humanApprovalRequired: true,
    autoRepairEnabled: false,
    autoPatchEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
