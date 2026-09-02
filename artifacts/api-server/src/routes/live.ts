import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { requireAdminToken } from "../middlewares/adminAuth";
import { getLiveAccessPolicies } from "../live/liveAccessPolicy";
import { createLiveAccessAuditEvent, listLiveAccessAuditTrail, summarizeLiveAccessAuditTrail } from "../live/liveAccessAuditTrail";
import { buildLiveAccessDecisionPreview } from "../live/liveAccessDecisionPreview";
import { buildLiveAccessSecureRoomHandoff } from "../live/liveAccessSecureRoomHandoff";
import { getLiveApprovalAuditPolicy } from "../live/liveApprovalAuditPolicy";
import { buildLiveApprovalAuditSecureRoomHandoff } from "../live/liveApprovalAuditSecureRoomHandoff";
import { buildLiveApprovalAuditTimelineMock } from "../live/liveApprovalAuditTimelineMock";
import { buildLiveApprovalRiskSnapshot } from "../live/liveApprovalRiskSnapshot";
import { buildLiveApprovalScopePreview } from "../live/liveApprovalScopePreview";
import { getLiveApprovalActorIdentityPolicy } from "../live/liveApprovalActorIdentityPolicy";
import { buildLiveApprovalActorPreview } from "../live/liveApprovalActorPreview";
import { buildLiveApprovalHashChainPreview } from "../live/liveApprovalHashChainPreview";
import { buildLiveApprovalIdentitySecureRoomHandoff } from "../live/liveApprovalIdentitySecureRoomHandoff";
import { buildLiveApprovalImmutabilityValidatorPreview } from "../live/liveApprovalImmutabilityValidator";
import { buildLiveApprovalSignaturePreview } from "../live/liveApprovalSignaturePreview";
import { buildLiveAppendOnlyApprovalLogMock } from "../live/liveAppendOnlyApprovalLogMock";
import { buildLiveHealthMonitorPlan } from "../live/liveHealthMonitorPlan";
import { buildLiveSecureRoomHandoff } from "../live/liveSecureRoomHandoff";
import { buildLiveCostPreview } from "../live/liveCostPreview";
import { getLiveAtsCacheAssetPolicy } from "../live/liveAtsCacheAssetPolicy";
import { getLiveAtsCdnCachePlan } from "../live/liveAtsCdnCachePlan";
import { getLiveAtsDeploymentPlan } from "../live/liveAtsDeploymentPlan";
import { createMockLiveIngest, listMockLiveIngests } from "../live/liveIngestModel";
import { createMockLiveSession, getMockLiveSession, startMockLiveSession, stopMockLiveSession } from "../live/liveSessionModel";
import {
  activateMockLiveTargets,
  createMockLiveTarget,
  listMockLiveTargets,
  stopMockLiveTargets,
} from "../live/liveTargetModel";
import { getLiveAnalyticsPlan } from "../live/liveAnalyticsPlan";
import { getLiveCdnPlan } from "../live/liveCdnPlan";
import {
  getDeferredWorkLedgerSummary,
  getLiveCompletionGate,
  getLiveMuxParityChecklist,
} from "../live/liveDeferredWorkLedger";
import { buildLiveDnaAccessLearningBridge } from "../live/liveDnaAccessLearningBridge";
import { buildLiveDnaApprovalLearningBridge } from "../live/liveDnaApprovalLearningBridge";
import { buildLiveDnaApprovalAuditLearningBridge } from "../live/liveDnaApprovalAuditLearningBridge";
import { getLiveExternalDrmPlan } from "../live/liveExternalDrmPlan";
import { buildLiveDnaTargetLearningBridge } from "../live/liveDnaTargetLearningBridge";
import { getLiveDomainReferrerPolicy } from "../live/liveDomainReferrerPolicy";
import { getLiveEngineCompatibilityMatrix } from "../live/liveEngineCompatibilityMatrix";
import { buildLiveEngineConfigDryRun } from "../live/liveEngineConfigDryRun";
import { getLiveEngineConfigPolicy } from "../live/liveEngineConfigPolicy";
import { buildLiveEngineCostPreview } from "../live/liveEngineCostPreview";
import { getLiveEngineSecurityPolicy } from "../live/liveEngineSecurityPolicy";
import { buildLiveEngineSecureRoomHandoff } from "../live/liveEngineSecureRoomHandoff";
import { buildLiveDnaEventLearningBridge } from "../live/liveDnaEventLearningBridge";
import { createLiveMockEvent, listLiveMockEvents } from "../live/liveEventBusMock";
import { buildLiveEventSecureRoomHandoff } from "../live/liveEventSecureRoomHandoff";
import { buildLiveEventTimeline } from "../live/liveEventTimeline";
import { getLiveEventTypeDefinitions } from "../live/liveEventTypes";
import { getLiveFeatureStatusMatrix } from "../live/liveFeatureStatusMatrix";
import { buildLiveFfmpegDryRunCommand } from "../live/liveFfmpegCommandBuilder";
import { buildLiveFfmpegCostPreview } from "../live/liveFfmpegCostPreview";
import { buildLiveFfmpegDryRunPreview } from "../live/liveFfmpegDryRun";
import { getLiveFfmpegExternalCliPolicy } from "../live/liveFfmpegExternalCliPolicy";
import { getLiveFfmpegInstallReadiness } from "../live/liveFfmpegInstallReadiness";
import { getLiveFfmpegProcessingPlan } from "../live/liveFfmpegProcessingPlan";
import { getLiveNativeIngestBufferPolicy } from "../live/liveNativeIngestBuffer";
import { getLiveNativeAudioTrackGatePolicy } from "../live/liveNativeAudioTrackGate";
import { getLiveNativeClipGatePolicy } from "../live/liveNativeClipGate";
import { getLiveNativeFragmentedMp4SegmentGatePolicy } from "../live/liveNativeFragmentedMp4SegmentGate";
import { getLiveNativeFmp4CmafExtremeChainResult } from "../live/liveNativeFmp4CmafExtremeChainResult";
import { getLiveNativeLiveStackCompletionResult } from "../live/liveNativeLiveStackCompletionResult";
import { getLiveNativeInterleaveWriterGatePolicy } from "../live/liveNativeInterleaveWriterGate";
import { getLiveNativeLargeVideoOffsetGatePolicy } from "../live/liveNativeLargeVideoOffsetGate";
import { getLiveNativeLargeVideoWriterGatePolicy } from "../live/liveNativeLargeVideoWriterGate";
import { getLiveNativeMp4MetadataPolicy } from "../live/liveNativeMp4MetadataEngine";
import { getLiveNativeMuxGatePolicy } from "../live/liveNativeMuxGate";
import { getLiveNativeSampleTableClipGatePolicy } from "../live/liveNativeSampleTableClipGate";
import { getLiveNativeSegmentIntegrityPolicy } from "../live/liveNativeSegmentIntegrityChain";
import { getLiveNativeTimedTextTrackGatePolicy } from "../live/liveNativeTimedTextTrackGate";
import { getLiveNativeThumbnailGatePolicy } from "../live/liveNativeThumbnailGate";
import { getLiveNativeTrackInterleavePlanGatePolicy } from "../live/liveNativeTrackInterleavePlanGate";
import { buildLiveNativeVideoFactoryPlan } from "../live/liveNativeVideoFactory";
import { getLiveNativeVideoFactoryPolicy } from "../live/liveNativeVideoFactoryPolicy";
import { getLiveNativeSegmentWriterPolicy } from "../live/liveNativeSegmentWriter";
import { buildLiveHlsOutputPreview } from "../live/liveHlsOutputPreview";
import { buildLiveHealthMonitorMock } from "../live/liveHealthMonitorMock";
import { getLiveDnaSummary } from "../live/liveDna";
import { buildLiveDnaOperatorLearningBridge } from "../live/liveDnaOperatorLearningBridge";
import { getLiveHumanApprovalPolicy } from "../live/liveHumanApprovalPolicy";
import { buildLiveImprovementProposals } from "../live/liveImprovementProposals";
import { getLiveLocalLabTopology } from "../live/liveLocalLabTopology";
import { getLiveLocalLabCompletionSummary } from "../live/liveLocalLabCompletionSummary";
import { getLiveLocalSmokeHumanActionChecklist } from "../live/liveLocalSmokeHumanActionChecklist";
import { getLiveLocalToolingSetupStatus } from "../live/liveLocalToolingSetupStatus";
import { getLiveLearningSignalCatalog } from "../live/liveLearningSignals";
import { getLiveLicenseRiskPolicy } from "../live/liveLicenseRiskPolicy";
import { getLiveMediaMtxInstallReadiness } from "../live/liveMediaMtxInstallReadiness";
import { buildLiveMediaMtxConfigTemplate } from "../live/liveMediaMtxConfigTemplate";
import { getLiveModuleOverview } from "../live/liveModuleOverview";
import { getLiveMuxLikeCapabilityMap } from "../live/liveMuxLikeCapabilityMap";
import { buildLiveObsIngestPreview } from "../live/liveObsIngestPreview";
import { getLiveObsInstallReadiness } from "../live/liveObsInstallReadiness";
import { getLiveOpenSourceArchitecture } from "../live/liveOpenSourceArchitecture";
import { buildLiveOperatorRunbookSecureRoomHandoff } from "../live/liveOperatorRunbookSecureRoomHandoff";
import { getLiveOperatorRunbookPolicy } from "../live/liveOperatorRunbookPolicy";
import { getLivePersonalizedWatermarkFuturePlan } from "../live/livePersonalizedWatermarkFuturePlan";
import { buildLiveEmbedCodePreview } from "../live/liveEmbedCodePreview";
import { buildLivePlayerAccessBridge } from "../live/livePlayerAccessBridge";
import { createLivePlayerEventMock } from "../live/livePlayerEventMock";
import { getLivePlayerPolicy } from "../live/livePlayerPolicy";
import { getLivePlayerPlan } from "../live/livePlayerPlan";
import { getLivePlayerProviderMatrix } from "../live/livePlayerProviderMatrix";
import { buildLivePlayerQoEPreview } from "../live/livePlayerQoEPreview";
import { buildLivePlayerSecureRoomHandoff } from "../live/livePlayerSecureRoomHandoff";
import { buildLivePlaybackPageMock } from "../live/livePlaybackPageMock";
import { buildLivePlaybackAuthorizationMock } from "../live/livePlaybackAuthorizationMock";
import { getLivePreSmokeOperatorChecklist } from "../live/livePreSmokeOperatorChecklist";
import { getLiveE2ELocalLiveVodResealIdReadResult } from "../live/liveE2ELocalLiveVodResealIdReadResult";
import { getLiveEvidencePathClassifier } from "../live/liveEvidencePathClassifier";
import { getLiveEvidencePathPolicy } from "../live/liveEvidencePathPolicy";
import { buildLiveEvidencePathSecureRoomHandoff } from "../live/liveEvidencePathSecureRoomHandoff";
import { getLiveHlsEvidenceDashboardSummary } from "../live/liveHlsEvidenceDashboardSummary";
import { getLiveHlsEvidenceDecisionBoundary } from "../live/liveHlsEvidenceDecisionBoundary";
import { getLiveHlsEvidencePackage } from "../live/liveHlsEvidencePackage";
import { getLiveExternalRtmpReadinessSummary } from "../live/liveExternalRtmpReadinessSummary";
import { getLiveExternalRtmpSmokeSummary } from "../live/liveExternalRtmpSmokeSummary";
import { getLiveExternalRtmpTargetSetupSummary } from "../live/liveExternalRtmpTargetSetupSummary";
import { getLiveRtmpTargetCredentialPreflightSummary } from "../live/liveRtmpTargetCredentialPreflightSummary";
import { getLiveNoCostRtmpTargetAutoSetupSummary } from "../live/liveNoCostRtmpTargetAutoSetupSummary";
import { getLiveHlsEvidencePdfClaimSafetyGuard } from "../live/liveHlsEvidencePdfClaimSafetyGuard";
import { getLiveHlsEvidencePdfArtifactExport } from "../live/liveHlsEvidencePdfArtifactExport";
import { getLiveHlsEvidenceReportArtifactExport } from "../live/liveHlsEvidenceReportArtifactExport";
import { getLiveHlsEvidencePdfExportReadiness } from "../live/liveHlsEvidencePdfExportReadiness";
import { getLiveHlsEvidencePdfReadyExport } from "../live/liveHlsEvidencePdfReadyExport";
import { getLiveHlsEvidencePdfRenderPlan } from "../live/liveHlsEvidencePdfRenderPlan";
import { getLiveHlsEvidencePdfSecureRoomBoundary } from "../live/liveHlsEvidencePdfSecureRoomBoundary";
import { getLiveHlsEvidencePdfTemplatePolicy } from "../live/liveHlsEvidencePdfTemplatePolicy";
import { getLiveHlsEvidencePdfTemplateSections } from "../live/liveHlsEvidencePdfTemplateSections";
import { getLiveHlsEvidenceReportDashboardSummary } from "../live/liveHlsEvidenceReportDashboardSummary";
import { getLiveHlsEvidenceReportDecisionText } from "../live/liveHlsEvidenceReportDecisionText";
import { getLiveHlsEvidenceReportModel } from "../live/liveHlsEvidenceReportModel";
import { getLiveHlsEvidenceReportRiskSummary } from "../live/liveHlsEvidenceReportRiskSummary";
import { buildLiveHlsEvidenceReportSecureRoomExport } from "../live/liveHlsEvidenceReportSecureRoomExport";
import { buildLiveHlsEvidenceSecureRoomBundle } from "../live/liveHlsEvidenceSecureRoomBundle";
import { getLiveHlsEvidenceSourceSummary } from "../live/liveHlsEvidenceSourceSummary";
import { getLiveActualLocalHlsPlaybackVodResult } from "../live/liveActualLocalHlsPlaybackVodResult";
import { getLiveActualLocalSmokeRepeatabilityResult } from "../live/liveActualLocalSmokeRepeatabilityResult";
import { getLiveActualLocalSmokeTestResult } from "../live/liveActualLocalSmokeTestResult";
import { getLivePresealedLocalSourceSurvivalResult } from "../live/livePresealedLocalSourceSurvivalResult";
import { getLivePresealedHlsSurvivalRepeatabilityResult } from "../live/livePresealedHlsSurvivalRepeatabilityResult";
import { getLivePresealedSurvivalFailureDiagnosticsResult } from "../live/livePresealedSurvivalFailureDiagnosticsResult";
import { getLivePostLiveVodResealLabResult } from "../live/livePostLiveVodResealLabResult";
import { getLiveRealLabReadinessDashboard } from "../live/liveRealLabReadinessDashboard";
import { getLiveRealLikeLocalContentGateSummary } from "../live/liveRealLikeLocalContentGateSummary";
import { getLiveRealFourGbVideoCorpusResult } from "../live/liveRealFourGbVideoCorpusResult";
import { getLiveRealFourGbMp4MovVideoCorpusResult } from "../live/liveRealFourGbMp4MovVideoCorpusResult";
import { getLiveNativeFourGbMovWriterOutputProofResult } from "../live/liveNativeFourGbMovWriterOutputProofResult";
import { getLiveLocalCameraCaptureProbeResult } from "../live/liveLocalCameraCaptureProbeResult";
import { getLiveLocalCameraCaptureToIdChainResult } from "../live/liveLocalCameraCaptureToIdChainResult";
import { getLiveNoPlatformNativeLiveStackResult } from "../live/liveNoPlatformNativeLiveStackResult";
import { getLiveRealSmokeApprovalGate } from "../live/liveRealSmokeApprovalGate";
import { getLiveRealSmokeBlockerReport } from "../live/liveRealSmokeBlockerReport";
import { buildLiveRealSmokeCustomRtmpLocalPlan } from "../live/liveRealSmokeCustomRtmpLocalPlan";
import { buildLiveRealSmokeDecisionPacket } from "../live/liveRealSmokeDecisionPacket";
import { getLiveRealSmokeGoNoGoPolicy } from "../live/liveRealSmokeGoNoGoPolicy";
import { buildLiveRealSmokeLocalLabHandoff } from "../live/liveRealSmokeLocalLabHandoff";
import { getLiveRealSmokeLocalLabPlan } from "../live/liveRealSmokeLocalLabPlan";
import { getLiveRealSmokeLocalPreflight } from "../live/liveRealSmokeLocalPreflight";
import { getLiveRealSmokePreflightChecklist } from "../live/liveRealSmokePreflightChecklist";
import { getLiveRealSmokeRequiredInputs } from "../live/liveRealSmokeRequiredInputs";
import { getLiveRealSmokeRollbackPlanPreview } from "../live/liveRealSmokeRollbackPlanPreview";
import { getLiveRealSmokeScenarioPlan } from "../live/liveRealSmokeScenarioPlan";
import { buildLiveRealSmokeSecureRoomHandoff } from "../live/liveRealSmokeSecureRoomHandoff";
import { getLivePostLiveResealPolicy } from "../live/livePostLiveResealPolicy";
import { getLivePortPlan } from "../live/livePortPlan";
import { getLivePreSealPolicy } from "../live/livePreSealPolicy";
import { buildLiveRecordingManifest } from "../live/liveRecordingManifest";
import { getLiveRecordingPolicy } from "../live/liveRecordingPolicy";
import { getLiveRecordingStoragePolicy } from "../live/liveRecordingStoragePolicy";
import { buildLiveRecordingHealthModel } from "../live/liveRecordingHealthModel";
import { buildLiveRecordingVodMockPipeline } from "../live/liveRecordingVodPipeline";
import { buildLiveShakaPlayerMock } from "../live/liveShakaPlayerMock";
import { buildLiveSecretRedactionDryRunForm } from "../live/liveSecretRedactionDryRunForm";
import { buildLiveSignedUrlMock } from "../live/liveSignedUrlMock";
import { getLiveSignedApprovalAuditPolicy } from "../live/liveSignedApprovalAuditPolicy";
import { getLiveSingleTargetOperatorRunbook } from "../live/liveSingleTargetOperatorRunbook";
import { createLiveSimulcastPlanMock, getLatestLiveSimulcastPlanMock } from "../live/liveSimulcastPlanMock";
import { getLiveSmokeReadinessRiskReport } from "../live/liveSmokeReadinessRiskReport";
import { buildLiveSmokeReadinessSecureRoomHandoff } from "../live/liveSmokeReadinessSecureRoomHandoff";
import { getLiveSmokeTestReadinessChecklist } from "../live/liveSmokeTestReadinessChecklist";
import { getLiveSmokeRollbackRunbook } from "../live/liveSmokeRollbackRunbook";
import { buildLiveSrsConfigTemplate } from "../live/liveSrsConfigTemplate";
import { buildLiveCustomRtmpTargetMock } from "../live/liveCustomRtmpTargetMock";
import { getLiveCustomRtmpSmokeReadiness } from "../live/liveCustomRtmpSmokeReadiness";
import { buildLiveFacebookTargetMock } from "../live/liveFacebookTargetMock";
import { getLiveRealLabGateSummary } from "../live/liveRealLabGateSummary";
import { getLiveTargetCatalog } from "../live/liveTargetCatalog";
import { getLiveTargetCredentialPolicy } from "../live/liveTargetCredentialPolicy";
import { buildLiveTargetEventBridge } from "../live/liveTargetEventBridge";
import { getLiveTargetFailurePolicy } from "../live/liveTargetFailurePolicy";
import { buildLiveTargetHealthModel } from "../live/liveTargetHealthModel";
import { buildLiveTargetSecureRoomHandoff } from "../live/liveTargetSecureRoomHandoff";
import { buildLiveTwitchTargetMock } from "../live/liveTwitchTargetMock";
import { buildLiveVideoJsPlayerMock } from "../live/liveVideoJsPlayerMock";
import { buildLiveVodSecureRoomHandoff } from "../live/liveVodSecureRoomHandoff";
import { buildLiveWebhookPayloadPreviewCatalog } from "../live/liveWebhookPayloadPreview";
import { buildLiveYouTubeTargetMock } from "../live/liveYouTubeTargetMock";
import { getLiveYouTubeSmokeReadiness } from "../live/liveYouTubeSmokeReadiness";
import { createLiveViewerSessionMock, listLiveViewerSessionMocks } from "../live/liveViewerSessionModel";
import { LIVE_PROVIDER_DECISION_ROLE } from "../live/liveProviderAdapter";
import { getMediaMtxLiveAdapterCapabilities } from "../live/mediaMtxLiveAdapter";
import { getSrsLiveAdapterCapabilities } from "../live/srsLiveAdapter";

const router: IRouter = Router();

function requireLiveMutationAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  requireAdminToken(req, res, next);
}

router.use(requireLiveMutationAuth);

function sessionNotFound(res: Response): Response {
  return res.status(404).json({ error: "live_session_not_found" });
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function queryParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) return String(value[0] ?? "");
  if (typeof value === "string") return value;
  return undefined;
}

function sessionBundle(sessionId: string) {
  const session = getMockLiveSession(sessionId);
  if (!session) return null;
  const ingests = listMockLiveIngests(sessionId);
  const targets = listMockLiveTargets(sessionId);
  return {
    session,
    ingests,
    targets,
    secureRoomHandoff: buildLiveSecureRoomHandoff({ session, ingests, targets }),
  };
}

router.get("/overview", (_req: Request, res: Response) => {
  res.json(getLiveModuleOverview());
});

router.get("/architecture", (_req: Request, res: Response) => {
  res.json({
    architecture: getLiveOpenSourceArchitecture(),
    ffmpegProcessingPlan: getLiveFfmpegProcessingPlan(),
    playerPlan: getLivePlayerPlan(),
    analyticsPlan: getLiveAnalyticsPlan(),
    cdnPlan: getLiveCdnPlan(),
    drmPlan: getLiveExternalDrmPlan(),
    personalizedWatermarkFuturePlan: getLivePersonalizedWatermarkFuturePlan(),
    engineConfigDryRun: {
      configPolicy: getLiveEngineConfigPolicy(),
      localLabTopology: getLiveLocalLabTopology(),
      compatibilityMatrix: getLiveEngineCompatibilityMatrix(),
      realServerStarted: false,
      realConfigWritten: false,
      realPortsOpened: false,
      realBroadcastStarted: false,
    },
    ffmpegExternalCliPolicy: getLiveFfmpegExternalCliPolicy(),
    nativeVideoFactoryPolicy: getLiveNativeVideoFactoryPolicy(),
    nativeIngestBufferPolicy: getLiveNativeIngestBufferPolicy(),
    nativeVideoFactoryPlan: buildLiveNativeVideoFactoryPlan(),
    nativeSegmentWriterPolicy: getLiveNativeSegmentWriterPolicy(),
    nativeSegmentIntegrityPolicy: getLiveNativeSegmentIntegrityPolicy(),
    nativeFragmentedMp4SegmentGatePolicy: getLiveNativeFragmentedMp4SegmentGatePolicy(),
    nativeFmp4CmafExtremeChainResult: getLiveNativeFmp4CmafExtremeChainResult(),
    nativeMp4MetadataPolicy: getLiveNativeMp4MetadataPolicy(),
    nativeThumbnailGatePolicy: getLiveNativeThumbnailGatePolicy(),
    nativeAudioTrackGatePolicy: getLiveNativeAudioTrackGatePolicy(),
    nativeClipGatePolicy: getLiveNativeClipGatePolicy(),
    nativeSampleTableClipGatePolicy: getLiveNativeSampleTableClipGatePolicy(),
    nativeMuxGatePolicy: getLiveNativeMuxGatePolicy(),
    nativeTimedTextTrackGatePolicy: getLiveNativeTimedTextTrackGatePolicy(),
    nativeLargeVideoOffsetGatePolicy: getLiveNativeLargeVideoOffsetGatePolicy(),
    nativeLargeVideoWriterGatePolicy: getLiveNativeLargeVideoWriterGatePolicy(),
    nativeTrackInterleavePlanGatePolicy: getLiveNativeTrackInterleavePlanGatePolicy(),
    nativeInterleaveWriterGatePolicy: getLiveNativeInterleaveWriterGatePolicy(),
    recordingVodPolicy: {
      recordingPolicy: getLiveRecordingPolicy(true),
      postLiveResealPolicy: getLivePostLiveResealPolicy(),
      realFfmpegExecuted: false,
      realMediaProcessed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    },
  });
});

router.get("/mux-like-capabilities", (_req: Request, res: Response) => {
  res.json({
    capabilities: getLiveMuxLikeCapabilityMap(),
    decisionRole: "live_capability_support_only_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  });
});

router.get("/feature-status", (_req: Request, res: Response) => {
  res.json({
    featureStatus: getLiveFeatureStatusMatrix(),
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  });
});

router.get("/events/types", (_req: Request, res: Response) => {
  res.json({
    eventTypes: getLiveEventTypeDefinitions(),
    realEventPublished: false,
    realWebhookSent: false,
    realNetworkCall: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "live_event_types_support_only_no_vault_no_confirmed",
  });
});

router.get("/access/policy", (_req: Request, res: Response) => {
  res.json({
    policies: getLiveAccessPolicies(),
    realAccessEnabled: false,
    realTokenGenerated: false,
    realSignedUrlGenerated: false,
    drmEnabled: false,
    billingCreditPaymentAdded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "live_access_policy_mock_support_only_no_vault_no_confirmed",
  });
});

router.get("/access/domain-referrer-policy", (_req: Request, res: Response) => {
  res.json(getLiveDomainReferrerPolicy());
});

router.get("/player/policy", (_req: Request, res: Response) => {
  res.json(getLivePlayerPolicy());
});

router.get("/player/provider-matrix", (_req: Request, res: Response) => {
  res.json({
    providers: getLivePlayerProviderMatrix(),
    realPlayerLoaded: false,
    realStreamLoaded: false,
    drmEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "live_player_provider_matrix_mock_support_only_no_vault_no_confirmed",
  });
});

router.get("/targets/catalog", (_req: Request, res: Response) => {
  res.json({
    targets: getLiveTargetCatalog(),
    realApiEnabled: false,
    realPushEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "live_target_catalog_mock_support_only_no_vault_no_confirmed",
  });
});

router.get("/targets/credential-policy", (_req: Request, res: Response) => {
  res.json(getLiveTargetCredentialPolicy());
});

router.get("/targets/failure-policy", (_req: Request, res: Response) => {
  res.json(getLiveTargetFailurePolicy());
});

router.get("/smoke-readiness/checklist", (_req: Request, res: Response) => {
  res.json(getLiveSmokeTestReadinessChecklist());
});

router.get("/smoke-readiness/youtube", (_req: Request, res: Response) => {
  res.json(getLiveYouTubeSmokeReadiness());
});

router.get("/smoke-readiness/custom-rtmp", (_req: Request, res: Response) => {
  res.json(getLiveCustomRtmpSmokeReadiness());
});

router.get("/smoke-readiness/real-lab-gate", (_req: Request, res: Response) => {
  res.json(getLiveRealLabGateSummary());
});

router.get("/smoke-readiness/risk-report", (_req: Request, res: Response) => {
  res.json(getLiveSmokeReadinessRiskReport());
});

router.get("/operator-runbook/policy", (_req: Request, res: Response) => {
  res.json(getLiveOperatorRunbookPolicy());
});

router.get("/operator-runbook/single-target", (req: Request, res: Response) => {
  res.json(getLiveSingleTargetOperatorRunbook(queryParam(req, "targetType")));
});

router.post("/operator-runbook/secret-redaction/dry-run", (req: Request, res: Response) => {
  res.json(
    buildLiveSecretRedactionDryRunForm({
      targetType: req.body?.targetType,
      streamKeyPlaceholder: req.body?.streamKeyPlaceholder,
      apiKeyPlaceholder: req.body?.apiKeyPlaceholder,
      oauthTokenPlaceholder: req.body?.oauthTokenPlaceholder,
      webhookSecretPlaceholder: req.body?.webhookSecretPlaceholder,
      signedUrlSecretPlaceholder: req.body?.signedUrlSecretPlaceholder,
      rtmpUrlPlaceholder: req.body?.rtmpUrlPlaceholder,
    }),
  );
});

router.get("/operator-runbook/pre-smoke-checklist", (req: Request, res: Response) => {
  res.json(getLivePreSmokeOperatorChecklist(queryParam(req, "targetType")));
});

router.get("/operator-runbook/rollback", (_req: Request, res: Response) => {
  res.json(getLiveSmokeRollbackRunbook());
});

router.get("/operator-runbook/real-smoke-approval-gate", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeApprovalGate());
});

router.get("/dashboard/real-lab-readiness", (_req: Request, res: Response) => {
  res.json(getLiveRealLabReadinessDashboard());
});

router.get("/local-lab/completion-summary", (_req: Request, res: Response) => {
  res.json(getLiveLocalLabCompletionSummary());
});

router.get("/real-like-local-content-gate/summary", (_req: Request, res: Response) => {
  res.json(getLiveRealLikeLocalContentGateSummary());
});

router.get("/external-rtmp-readiness/summary", (_req: Request, res: Response) => {
  res.json(getLiveExternalRtmpReadinessSummary());
});

router.get("/external-rtmp-smoke/summary", (_req: Request, res: Response) => {
  res.json(getLiveExternalRtmpSmokeSummary());
});

router.get("/external-rtmp-target-setup/summary", (_req: Request, res: Response) => {
  res.json(getLiveExternalRtmpTargetSetupSummary());
});

router.get("/rtmp-target-credential-preflight/summary", (_req: Request, res: Response) => {
  res.json(getLiveRtmpTargetCredentialPreflightSummary());
});

router.get("/no-cost-rtmp-target-auto-setup/summary", (_req: Request, res: Response) => {
  res.json(getLiveNoCostRtmpTargetAutoSetupSummary());
});

router.get("/real-smoke/go-no-go-policy", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeGoNoGoPolicy());
});

router.get("/real-smoke/preflight-checklist", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokePreflightChecklist());
});

router.get("/real-smoke/blocker-report", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeBlockerReport());
});

router.get("/real-smoke/required-inputs", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeRequiredInputs());
});

router.get("/real-smoke/scenario-plan", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeScenarioPlan());
});

router.get("/real-smoke/rollback-plan", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeRollbackPlanPreview());
});

router.get("/real-smoke/local-lab-plan", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeLocalLabPlan());
});

router.get("/real-smoke/local-preflight", (_req: Request, res: Response) => {
  res.json(getLiveRealSmokeLocalPreflight());
});

router.get("/real-smoke/local-result", (_req: Request, res: Response) => {
  res.json(getLiveActualLocalSmokeTestResult());
});

router.get("/real-smoke/local-repeatability-result", (_req: Request, res: Response) => {
  res.json(getLiveActualLocalSmokeRepeatabilityResult());
});

router.get("/real-smoke/local-hls-playback-vod-result", (_req: Request, res: Response) => {
  res.json(getLiveActualLocalHlsPlaybackVodResult());
});

router.get("/real-smoke/post-live-vod-reseal-result", (_req: Request, res: Response) => {
  res.json(getLivePostLiveVodResealLabResult());
});

router.get("/real-smoke/e2e-local-live-vod-reseal-idread-result", (_req: Request, res: Response) => {
  res.json(getLiveE2ELocalLiveVodResealIdReadResult());
});

router.get("/real-smoke/presealed-local-source-survival-result", (_req: Request, res: Response) => {
  res.json(getLivePresealedLocalSourceSurvivalResult());
});

router.get("/real-smoke/presealed-survival-failure-diagnostics-result", (_req: Request, res: Response) => {
  res.json(getLivePresealedSurvivalFailureDiagnosticsResult());
});

router.get("/real-smoke/presealed-hls-survival-repeatability-result", (_req: Request, res: Response) => {
  res.json(getLivePresealedHlsSurvivalRepeatabilityResult());
});

router.get("/evidence-path/policy", (_req: Request, res: Response) => {
  res.json(getLiveEvidencePathPolicy());
});

router.get("/evidence-path/classifier", (_req: Request, res: Response) => {
  res.json(getLiveEvidencePathClassifier());
});

router.get("/evidence-path/secure-room-handoff", (_req: Request, res: Response) => {
  res.json(buildLiveEvidencePathSecureRoomHandoff());
});

router.get("/evidence-package/hls-local", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePackage());
});

router.get("/evidence-package/hls-local/source-summary", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceSourceSummary());
});

router.get("/evidence-package/hls-local/decision-boundary", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceDecisionBoundary());
});

router.get("/evidence-package/hls-local/secure-room-bundle", (_req: Request, res: Response) => {
  res.json(buildLiveHlsEvidenceSecureRoomBundle());
});

router.get("/evidence-package/hls-local/dashboard-summary", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceDashboardSummary());
});

router.get("/evidence-report/hls-local/model", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceReportModel());
});

router.get("/evidence-report/hls-local/pdf-ready-export", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfReadyExport());
});

router.get("/evidence-report/hls-local/artifact-export", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceReportArtifactExport());
});

router.get("/evidence-report/hls-local/pdf-artifact-export", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfArtifactExport());
});

router.get("/evidence-report/hls-local/pdf-export-readiness", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfExportReadiness());
});

router.get("/evidence-report/hls-local/pdf-template-policy", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfTemplatePolicy());
});

router.get("/evidence-report/hls-local/pdf-template-sections", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfTemplateSections());
});

router.get("/evidence-report/hls-local/pdf-claim-safety", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfClaimSafetyGuard());
});

router.get("/evidence-report/hls-local/pdf-render-plan", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfRenderPlan());
});

router.get("/evidence-report/hls-local/pdf-secure-room-boundary", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidencePdfSecureRoomBoundary());
});

router.get("/evidence-report/hls-local/decision-text", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceReportDecisionText());
});

router.get("/evidence-report/hls-local/risk-summary", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceReportRiskSummary());
});

router.get("/evidence-report/hls-local/secure-room-export", (_req: Request, res: Response) => {
  res.json(buildLiveHlsEvidenceReportSecureRoomExport());
});

router.get("/evidence-report/hls-local/dashboard-summary", (_req: Request, res: Response) => {
  res.json(getLiveHlsEvidenceReportDashboardSummary());
});

router.get("/local-tooling/status", (_req: Request, res: Response) => {
  res.json(getLiveLocalToolingSetupStatus());
});

router.get("/local-tooling/mediamtx-readiness", (_req: Request, res: Response) => {
  res.json(getLiveMediaMtxInstallReadiness());
});

router.get("/local-tooling/ffmpeg-readiness", (_req: Request, res: Response) => {
  res.json(getLiveFfmpegInstallReadiness());
});

router.get("/local-tooling/obs-readiness", (_req: Request, res: Response) => {
  res.json(getLiveObsInstallReadiness());
});

router.get("/local-tooling/human-action-checklist", (_req: Request, res: Response) => {
  res.json(getLiveLocalSmokeHumanActionChecklist());
});

router.get("/sessions/:sessionId/real-smoke/decision-packet", (req: Request, res: Response) => {
  res.json(buildLiveRealSmokeDecisionPacket(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/real-smoke/secure-room-handoff", (req: Request, res: Response) => {
  res.json(buildLiveRealSmokeSecureRoomHandoff(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/real-smoke/custom-rtmp-local-plan", (req: Request, res: Response) => {
  res.json(buildLiveRealSmokeCustomRtmpLocalPlan(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/real-smoke/local-lab-handoff", (req: Request, res: Response) => {
  res.json(buildLiveRealSmokeLocalLabHandoff(routeParam(req, "sessionId")));
});

router.get("/approval-audit/policy", (_req: Request, res: Response) => {
  res.json(getLiveApprovalAuditPolicy());
});

router.get("/approval-identity/policy", (_req: Request, res: Response) => {
  res.json(getLiveApprovalActorIdentityPolicy());
});

router.get("/approval-audit/signed-policy", (_req: Request, res: Response) => {
  res.json(getLiveSignedApprovalAuditPolicy());
});

router.get("/sessions/:sessionId/approval-audit/timeline", (req: Request, res: Response) => {
  res.json(buildLiveApprovalAuditTimelineMock(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/approval-identity/actor-preview", (req: Request, res: Response) => {
  res.json(buildLiveApprovalActorPreview(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/approval-audit/scope-preview", (req: Request, res: Response) => {
  res.json(buildLiveApprovalScopePreview(routeParam(req, "sessionId"), queryParam(req, "targetType")));
});

router.get("/sessions/:sessionId/approval-audit/risk-snapshot", (req: Request, res: Response) => {
  res.json(buildLiveApprovalRiskSnapshot(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/approval-audit/append-only-log/mock", (req: Request, res: Response) => {
  res.json(buildLiveAppendOnlyApprovalLogMock(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/approval-audit/hash-chain-preview", (req: Request, res: Response) => {
  res.json(buildLiveApprovalHashChainPreview(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/approval-audit/signature-preview", (req: Request, res: Response) => {
  res.json(buildLiveApprovalSignaturePreview(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/approval-audit/immutability-validator", (req: Request, res: Response) => {
  res.json(buildLiveApprovalImmutabilityValidatorPreview(routeParam(req, "sessionId")));
});

router.get("/sessions/:sessionId/dna/approval-learning", (req: Request, res: Response) => {
  const liveSessionId = routeParam(req, "sessionId");
  const timeline = buildLiveApprovalAuditTimelineMock(liveSessionId);
  const scopePreview = buildLiveApprovalScopePreview(liveSessionId, queryParam(req, "targetType"));
  const riskSnapshot = buildLiveApprovalRiskSnapshot(liveSessionId);
  res.json(
    buildLiveDnaApprovalLearningBridge({
      liveSessionId,
      timeline,
      scopePreview,
      riskSnapshot,
    }),
  );
});

router.get("/sessions/:sessionId/dna/approval-audit-learning", (req: Request, res: Response) => {
  const liveSessionId = routeParam(req, "sessionId");
  const actorPreview = buildLiveApprovalActorPreview(liveSessionId);
  const appendOnlyLog = buildLiveAppendOnlyApprovalLogMock(liveSessionId);
  const hashChain = buildLiveApprovalHashChainPreview(liveSessionId);
  const signaturePreview = buildLiveApprovalSignaturePreview(liveSessionId);
  const immutabilityValidator = buildLiveApprovalImmutabilityValidatorPreview(liveSessionId);
  res.json(
    buildLiveDnaApprovalAuditLearningBridge({
      liveSessionId,
      actorPreview,
      appendOnlyLog,
      hashChain,
      signaturePreview,
      immutabilityValidator,
    }),
  );
});

router.get("/sessions/:sessionId/approval-audit/secure-room-handoff", (req: Request, res: Response) => {
  res.json(buildLiveApprovalAuditSecureRoomHandoff(routeParam(req, "sessionId"), queryParam(req, "targetType")));
});

router.get("/sessions/:sessionId/approval-identity/secure-room-handoff", (req: Request, res: Response) => {
  res.json(buildLiveApprovalIdentitySecureRoomHandoff(routeParam(req, "sessionId")));
});

router.get("/completion-gate", (_req: Request, res: Response) => {
  res.json(getLiveCompletionGate());
});

router.get("/deferred-work", (_req: Request, res: Response) => {
  res.json(getDeferredWorkLedgerSummary());
});

router.get("/mux-parity-checklist", (_req: Request, res: Response) => {
  res.json({
    checklist: getLiveMuxParityChecklist(),
    decisionRole: "live_deferred_work_read_only_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  });
});

router.get("/license-risk-policy", (_req: Request, res: Response) => {
  res.json(getLiveLicenseRiskPolicy());
});

router.get("/ffmpeg/policy", (_req: Request, res: Response) => {
  res.json(getLiveFfmpegExternalCliPolicy());
});

router.get("/native-video-factory/policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeVideoFactoryPolicy());
});

router.get("/native-video-factory/plan", (_req: Request, res: Response) => {
  res.json(buildLiveNativeVideoFactoryPlan());
});

router.get("/native-video-factory/ingest-buffer-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeIngestBufferPolicy());
});

router.get("/native-video-factory/segment-writer-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeSegmentWriterPolicy());
});

router.get("/native-video-factory/segment-integrity-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeSegmentIntegrityPolicy());
});

router.get("/native-video-factory/fragmented-mp4-segment-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeFragmentedMp4SegmentGatePolicy());
});

router.get("/native-video-factory/fmp4-cmaf-extreme-chain-result", (_req: Request, res: Response) => {
  res.json(getLiveNativeFmp4CmafExtremeChainResult());
});

router.get("/native-video-factory/live-stack-completion-result", (_req: Request, res: Response) => {
  res.json(getLiveNativeLiveStackCompletionResult());
});

router.get("/native-video-factory/real-4gb-video-corpus-result", (_req: Request, res: Response) => {
  res.json(getLiveRealFourGbVideoCorpusResult());
});

router.get("/native-video-factory/real-4gb-mp4-mov-video-corpus-result", (_req: Request, res: Response) => {
  res.json(getLiveRealFourGbMp4MovVideoCorpusResult());
});

router.get("/native-video-factory/native-4gb-mov-writer-output-proof-result", (_req: Request, res: Response) => {
  res.json(getLiveNativeFourGbMovWriterOutputProofResult());
});

router.get("/native-video-factory/local-camera-capture-probe-result", (_req: Request, res: Response) => {
  res.json(getLiveLocalCameraCaptureProbeResult());
});

router.get("/native-video-factory/local-camera-capture-to-id-chain-result", (_req: Request, res: Response) => {
  res.json(getLiveLocalCameraCaptureToIdChainResult());
});

router.get("/native-video-factory/no-platform-native-live-stack-result", (_req: Request, res: Response) => {
  res.json(getLiveNoPlatformNativeLiveStackResult());
});

router.get("/native-video-factory/mp4-metadata-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeMp4MetadataPolicy());
});

router.get("/native-video-factory/thumbnail-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeThumbnailGatePolicy());
});

router.get("/native-video-factory/audio-track-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeAudioTrackGatePolicy());
});

router.get("/native-video-factory/clip-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeClipGatePolicy());
});

router.get("/native-video-factory/sample-table-clip-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeSampleTableClipGatePolicy());
});

router.get("/native-video-factory/mux-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeMuxGatePolicy());
});

router.get("/native-video-factory/timed-text-track-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeTimedTextTrackGatePolicy());
});

router.get("/native-video-factory/large-video-offset-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeLargeVideoOffsetGatePolicy());
});

router.get("/native-video-factory/large-video-writer-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeLargeVideoWriterGatePolicy());
});

router.get("/native-video-factory/track-interleave-plan-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeTrackInterleavePlanGatePolicy());
});

router.get("/native-video-factory/interleave-writer-gate-policy", (_req: Request, res: Response) => {
  res.json(getLiveNativeInterleaveWriterGatePolicy());
});

router.post("/ffmpeg/commands/dry-run", (req: Request, res: Response) => {
  res.json({
    command: buildLiveFfmpegDryRunCommand({
      commandKind: req.body?.commandKind,
      sessionId: req.body?.sessionId,
      recordingId: req.body?.recordingId,
      inputRef: req.body?.inputRef,
      outputRef: req.body?.outputRef,
      durationSecondsPreview: req.body?.durationSecondsPreview,
      segmentDurationSeconds: req.body?.segmentDurationSeconds,
      segmentCountPreview: req.body?.segmentCountPreview,
      overwrite: req.body?.overwrite,
    }),
    preview: buildLiveFfmpegDryRunPreview({
      sessionId: req.body?.sessionId,
      recordingId: req.body?.recordingId,
      durationSecondsPreview: req.body?.durationSecondsPreview,
      segmentDurationSeconds: req.body?.segmentDurationSeconds,
    }),
  });
});

router.get("/ats-cache-plan", (_req: Request, res: Response) => {
  res.json(getLiveAtsCdnCachePlan());
});

router.get("/ats-cache-asset-policy", (_req: Request, res: Response) => {
  res.json(getLiveAtsCacheAssetPolicy());
});

router.get("/ats-deployment-plan", (_req: Request, res: Response) => {
  res.json(getLiveAtsDeploymentPlan());
});

router.get("/dna/summary", (_req: Request, res: Response) => {
  res.json(getLiveDnaSummary());
});

router.get("/dna/learning-signals", (_req: Request, res: Response) => {
  res.json(getLiveLearningSignalCatalog());
});

router.get("/dna/recommendations", (_req: Request, res: Response) => {
  res.json(buildLiveImprovementProposals());
});

router.get("/dna/human-approval-policy", (_req: Request, res: Response) => {
  res.json(getLiveHumanApprovalPolicy());
});

router.get("/providers", (_req: Request, res: Response) => {
  res.json({
    providers: [getSrsLiveAdapterCapabilities(), getMediaMtxLiveAdapterCapabilities()],
    decisionRole: LIVE_PROVIDER_DECISION_ROLE,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  });
});

router.get("/providers/srs/capabilities", (_req: Request, res: Response) => {
  res.json(getSrsLiveAdapterCapabilities());
});

router.get("/providers/mediamtx/capabilities", (_req: Request, res: Response) => {
  res.json(getMediaMtxLiveAdapterCapabilities());
});

router.get("/engines/config-policy", (_req: Request, res: Response) => {
  res.json(getLiveEngineConfigPolicy());
});

router.get("/engines/srs/config-template", (req: Request, res: Response) => {
  res.json(buildLiveSrsConfigTemplate(queryParam(req, "sessionId")));
});

router.get("/engines/mediamtx/config-template", (req: Request, res: Response) => {
  res.json(buildLiveMediaMtxConfigTemplate(queryParam(req, "sessionId")));
});

router.get("/engines/local-lab-topology", (_req: Request, res: Response) => {
  res.json(getLiveLocalLabTopology());
});

router.get("/engines/port-plan", (_req: Request, res: Response) => {
  res.json(getLivePortPlan());
});

router.get("/engines/obs-ingest-preview", (req: Request, res: Response) => {
  res.json(buildLiveObsIngestPreview(queryParam(req, "provider")));
});

router.get("/engines/hls-output-preview", (req: Request, res: Response) => {
  res.json(buildLiveHlsOutputPreview(queryParam(req, "provider"), queryParam(req, "sessionId")));
});

router.get("/engines/recording-storage-policy", (_req: Request, res: Response) => {
  res.json(getLiveRecordingStoragePolicy());
});

router.get("/engines/security-policy", (_req: Request, res: Response) => {
  res.json(getLiveEngineSecurityPolicy());
});

router.get("/engines/compatibility-matrix", (_req: Request, res: Response) => {
  res.json(getLiveEngineCompatibilityMatrix());
});

router.post("/engines/config/dry-run", (req: Request, res: Response) => {
  res.json(
    buildLiveEngineConfigDryRun({
      provider: req.body?.provider,
      sessionId: req.body?.sessionId,
      streamKey: req.body?.streamKey,
    }),
  );
});

router.post("/sessions/mock", (req: Request, res: Response) => {
  const session = createMockLiveSession({
    clientId: req.body?.clientId,
    docId: req.body?.docId,
    ownerUserId: req.body?.ownerUserId,
    engine: req.body?.engine,
    preSealEnabled: req.body?.preSealEnabled,
    recordingEnabled: req.body?.recordingEnabled,
    secureRoomEnabled: req.body?.secureRoomEnabled,
  });
  res.status(201).json(sessionBundle(session.sessionId));
});

router.get("/sessions/:sessionId", (req: Request, res: Response) => {
  const bundle = sessionBundle(routeParam(req, "sessionId"));
  if (!bundle) return sessionNotFound(res);
  return res.json(bundle);
});

router.post("/sessions/:sessionId/ingest/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const ingest = createMockLiveIngest(session.sessionId, {
    ingestType: req.body?.ingestType,
    ingestUrlMock: req.body?.ingestUrlMock,
    streamKey: req.body?.streamKey,
    streamKeyPresent: req.body?.streamKeyPresent,
  });
  return res.status(201).json({
    ingest,
    bundle: sessionBundle(session.sessionId),
  });
});

router.post("/sessions/:sessionId/targets/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const target = createMockLiveTarget(session.sessionId, {
    targetType: req.body?.targetType,
    rtmpUrl: req.body?.rtmpUrl,
    rtmpUrlPresent: req.body?.rtmpUrlPresent,
    streamKey: req.body?.streamKey,
    streamKeyPresent: req.body?.streamKeyPresent,
  });
  return res.status(201).json({
    target,
    bundle: sessionBundle(session.sessionId),
  });
});

router.post("/sessions/:sessionId/events/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.status(201).json(
    createLiveMockEvent({
      liveSessionId: session.sessionId,
      eventType: req.body?.eventType,
      severity: req.body?.severity,
      source: req.body?.source,
      message: req.body?.message,
    }),
  );
});

router.post("/sessions/:sessionId/viewer-session/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const viewerSession = createLiveViewerSessionMock(session.sessionId, {
    viewerIdMock: req.body?.viewerIdMock,
    clientId: req.body?.clientId ?? session.clientId,
    accessMode: req.body?.accessMode,
    accessStatusPreview: req.body?.accessStatusPreview,
    tokenPresent: req.body?.tokenPresent,
    signedUrlPresent: req.body?.signedUrlPresent,
    ipRiskPreview: req.body?.ipRiskPreview,
    deviceRiskPreview: req.body?.deviceRiskPreview,
    referrerRiskPreview: req.body?.referrerRiskPreview,
  });
  createLiveAccessAuditEvent({
    liveSessionId: session.sessionId,
    viewerSessionId: viewerSession.viewerSessionId,
    eventType: "viewer.session.created",
    riskLevel: viewerSession.ipRiskPreview === "high" ? "high" : "low",
  });
  return res.status(201).json(viewerSession);
});

router.post("/sessions/:sessionId/signed-url/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.status(201).json(
    buildLiveSignedUrlMock({
      liveSessionId: session.sessionId,
      viewerSessionId: req.body?.viewerSessionId,
      domainRestrictionPreview: req.body?.domainRestrictionPreview,
      referrerRestrictionPreview: req.body?.referrerRestrictionPreview,
      expiresInSecondsPreview: req.body?.expiresInSecondsPreview,
    }),
  );
});

router.post("/sessions/:sessionId/playback-authorization/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const authorization = buildLivePlaybackAuthorizationMock(req.body?.scenario);
  const eventType =
    authorization.scenario === "token_expired"
      ? "viewer.token.expired"
      : authorization.scenario === "wrong_domain"
        ? "viewer.domain.blocked"
        : authorization.scenario === "wrong_referrer"
          ? "viewer.referrer.blocked"
          : authorization.scenario === "future_drm_required"
            ? "viewer.drm.required.future"
            : authorization.authorizedPreview
              ? "viewer.access.allowed"
              : "viewer.access.denied";
  createLiveAccessAuditEvent({
    liveSessionId: session.sessionId,
    viewerSessionId: req.body?.viewerSessionId,
    eventType,
    riskLevel: authorization.riskLevel,
  });
  return res.json({
    authorization,
    accessDecisionPreview: buildLiveAccessDecisionPreview({
      liveSessionId: session.sessionId,
      accessMode: req.body?.accessMode,
      scenario: authorization.scenario,
    }),
  });
});

router.get("/sessions/:sessionId/player/shaka/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveShakaPlayerMock(session));
});

router.get("/sessions/:sessionId/player/videojs/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveVideoJsPlayerMock(session));
});

router.get("/sessions/:sessionId/playback-page/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLivePlaybackPageMock(session, queryParam(req, "provider"), queryParam(req, "accessMode")));
});

router.get("/sessions/:sessionId/embed-code/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(
    buildLiveEmbedCodePreview({
      liveSessionId: session.sessionId,
      signedUrlMockAttached: req.query.signedUrlMockAttached !== "false",
    }),
  );
});

router.post("/sessions/:sessionId/player/events/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.status(201).json(
    createLivePlayerEventMock({
      liveSessionId: session.sessionId,
      viewerSessionId: req.body?.viewerSessionId,
      eventType: req.body?.eventType,
      severity: req.body?.severity,
    }),
  );
});

router.get("/sessions/:sessionId/player/qoe/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLivePlayerQoEPreview(session, queryParam(req, "provider")));
});

router.get("/sessions/:sessionId/player-access-bridge", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLivePlayerAccessBridge(session, listLiveViewerSessionMocks(session.sessionId)));
});

router.get("/sessions/:sessionId/player-secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLivePlayerSecureRoomHandoff(session));
});

router.get("/sessions/:sessionId/targets/youtube/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveYouTubeTargetMock(session.sessionId));
});

router.get("/sessions/:sessionId/targets/facebook/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveFacebookTargetMock(session.sessionId));
});

router.get("/sessions/:sessionId/targets/twitch/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveTwitchTargetMock(session.sessionId));
});

router.get("/sessions/:sessionId/targets/custom-rtmp/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveCustomRtmpTargetMock(session.sessionId));
});

router.post("/sessions/:sessionId/simulcast-plan/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const targetTypes = Array.isArray(req.body?.targetTypes) ? req.body.targetTypes : undefined;
  return res.status(201).json(createLiveSimulcastPlanMock(session, targetTypes));
});

router.get("/sessions/:sessionId/targets/events/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveTargetEventBridge(session.sessionId, getLatestLiveSimulcastPlanMock(session)));
});

router.get("/sessions/:sessionId/dna/target-learning", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const simulcastPlan = getLatestLiveSimulcastPlanMock(session);
  const targetEvents = buildLiveTargetEventBridge(session.sessionId, simulcastPlan);
  return res.json(
    buildLiveDnaTargetLearningBridge({
      liveSessionId: session.sessionId,
      targetEvents,
      simulcastPlan,
    }),
  );
});

router.get("/sessions/:sessionId/target-secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveTargetSecureRoomHandoff(session));
});

router.get("/sessions/:sessionId/smoke-readiness/secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveSmokeReadinessSecureRoomHandoff(session, queryParam(req, "targetType")));
});

router.get("/sessions/:sessionId/operator-runbook/dna-learning", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const targetType = queryParam(req, "targetType");
  return res.json(
    buildLiveDnaOperatorLearningBridge({
      liveSessionId: session.sessionId,
      preSmokeChecklist: getLivePreSmokeOperatorChecklist(targetType),
      secretRedaction: buildLiveSecretRedactionDryRunForm({ targetType }),
    }),
  );
});

router.get("/sessions/:sessionId/operator-runbook/secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveOperatorRunbookSecureRoomHandoff(session, queryParam(req, "targetType")));
});

router.get("/sessions/:sessionId/events/timeline", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveEventTimeline(session.sessionId, listLiveMockEvents(session.sessionId)));
});

router.post("/sessions/:sessionId/start-mock", (req: Request, res: Response) => {
  const session = startMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  activateMockLiveTargets(session.sessionId);
  return res.json(sessionBundle(session.sessionId));
});

router.post("/sessions/:sessionId/stop-mock", (req: Request, res: Response) => {
  const session = stopMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  stopMockLiveTargets(session.sessionId);
  return res.json(sessionBundle(session.sessionId));
});

router.get("/sessions/:sessionId/health", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveHealthMonitorPlan(session));
});

router.get("/sessions/:sessionId/health/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveHealthMonitorMock(session));
});

router.get("/sessions/:sessionId/targets/health/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveTargetHealthModel(session.sessionId, listMockLiveTargets(session.sessionId)));
});

router.get("/sessions/:sessionId/recording", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(getLiveRecordingPolicy(session.recordingEnabled));
});

router.get("/sessions/:sessionId/recording/health/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveRecordingHealthModel(session));
});

router.get("/sessions/:sessionId/access-audit", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(summarizeLiveAccessAuditTrail(session.sessionId));
});

router.get("/recording-vod/policy", (_req: Request, res: Response) => {
  res.json({
    recordingPolicy: getLiveRecordingPolicy(true),
    ffmpegPolicy: getLiveFfmpegExternalCliPolicy(),
    postLiveResealPolicy: getLivePostLiveResealPolicy(),
    realRecordingEnabled: false,
    realFfmpegExecuted: false,
    realMediaProcessed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "live_recording_vod_policy_support_only_no_vault_no_confirmed",
  });
});

router.get("/webhooks/payload-preview", (_req: Request, res: Response) => {
  res.json({
    payloads: buildLiveWebhookPayloadPreviewCatalog(),
    realWebhookSent: false,
    realNetworkCall: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "live_webhook_payload_preview_support_only_no_vault_no_confirmed",
  });
});

router.post("/sessions/:sessionId/recording-vod/mock", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.status(201).json(buildLiveRecordingVodMockPipeline(session));
});

router.get("/sessions/:sessionId/recording-manifest", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveRecordingManifest(session));
});

router.get("/sessions/:sessionId/post-live-reseal-policy", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json({
    liveSessionId: session.sessionId,
    policy: getLivePostLiveResealPolicy(),
  });
});

router.get("/sessions/:sessionId/vod-secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const pipeline = buildLiveRecordingVodMockPipeline(session);
  return res.json(buildLiveVodSecureRoomHandoff(session, pipeline));
});

router.get("/sessions/:sessionId/ffmpeg-cost-preview", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const manifest = buildLiveRecordingManifest(session);
  return res.json({
    liveSessionId: session.sessionId,
    costPreview: buildLiveFfmpegCostPreview({
      durationSecondsPreview: manifest.durationSecondsPreview,
      segmentDurationSeconds: manifest.segmentDurationSecondsPreview,
      segmentCountPreview: manifest.segmentCountPreview,
      thumbnailCountPreview: manifest.thumbnailsPreview.length,
      clipCountPreview: manifest.clipsPreview.length,
    }),
  });
});

router.get("/sessions/:sessionId/engine-secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveEngineSecureRoomHandoff(session, queryParam(req, "provider")));
});

router.get("/sessions/:sessionId/engine-cost-preview", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json({
    liveSessionId: session.sessionId,
    costPreview: buildLiveEngineCostPreview(),
  });
});

router.get("/sessions/:sessionId/dna/event-learning", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  const timeline = buildLiveEventTimeline(session.sessionId, listLiveMockEvents(session.sessionId));
  const health = buildLiveHealthMonitorMock(session);
  const targetHealth = buildLiveTargetHealthModel(session.sessionId, listMockLiveTargets(session.sessionId));
  const recordingHealth = buildLiveRecordingHealthModel(session);
  return res.json(
    buildLiveDnaEventLearningBridge({
      liveSessionId: session.sessionId,
      events: timeline.events,
      health,
      targetHealth,
      recordingHealth,
    }),
  );
});

router.get("/sessions/:sessionId/dna/access-learning", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(
    buildLiveDnaAccessLearningBridge({
      liveSessionId: session.sessionId,
      viewerSessions: listLiveViewerSessionMocks(session.sessionId),
      auditEvents: listLiveAccessAuditTrail(session.sessionId),
    }),
  );
});

router.get("/sessions/:sessionId/event-secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(buildLiveEventSecureRoomHandoff(session, listMockLiveTargets(session.sessionId)));
});

router.get("/sessions/:sessionId/access-secure-room-handoff", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json(
    buildLiveAccessSecureRoomHandoff(
      session,
      listLiveViewerSessionMocks(session.sessionId),
      listLiveAccessAuditTrail(session.sessionId),
    ),
  );
});

router.get("/sessions/:sessionId/cost-preview", (req: Request, res: Response) => {
  const session = getMockLiveSession(routeParam(req, "sessionId"));
  if (!session) return sessionNotFound(res);
  return res.json({
    sessionId: session.sessionId,
    costPreview: buildLiveCostPreview(),
  });
});

router.get("/preseal-policy", (_req: Request, res: Response) => {
  res.json(getLivePreSealPolicy());
});

export default router;
