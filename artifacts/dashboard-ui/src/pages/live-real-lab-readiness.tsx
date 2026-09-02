import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminToken } from "@/hooks/use-admin-token";
import { getAdminToken } from "@/lib/admin-token-store";
import {
  Activity,
  AlertTriangle,
  Brain,
  Film,
  LockKeyhole,
  MonitorCheck,
  RadioTower,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const LIVE_REAL_SMOKE_NO_GO_DECISION = "NO_GO_UNTIL_HUMAN_APPROVAL_AND_REAL_LAB_SETUP";
const LIVE_REAL_SMOKE_REQUIRED_APPROVAL = "APPROVE_LIVE_REAL_SMOKE_TEST";
const LIVE_REAL_SMOKE_FIRST_TARGET = "custom_rtmp";

type SummaryWithItems = {
  steps?: unknown[];
  sections?: unknown[];
  targetCatalog?: unknown[];
  eventTypeDefinitions?: unknown[];
  webhookPayloadPreviews?: unknown[];
  compatibilityMatrix?: { entries?: unknown[] };
  learningRecords?: unknown[];
  operatorLearning?: { learningRecords?: unknown[] };
  recordingPolicy?: { realRecordingEnabled?: boolean };
  readyForRealSmoke?: boolean;
  realSecretStored?: boolean;
  detectedSecretLikeValue?: boolean;
  tokenValueExposed?: boolean;
  streamKeyValueExposed?: boolean;
  apiKeyValueExposed?: boolean;
  oauthTokenValueExposed?: boolean;
  signedUrlSecretExposed?: boolean;
  readyForMockChecklist?: boolean;
  readyForRealLab?: boolean;
  realRollbackExecuted?: boolean;
  noVaultFinalImpact?: boolean;
  realApiEnabled?: boolean;
  realPushEnabled?: boolean;
  realPlayerLoaded?: boolean;
  realStreamLoaded?: boolean;
  realPlaybackEnabled?: boolean;
  drmEnabled?: boolean;
  realAccessEnforced?: boolean;
  realTokenGenerated?: boolean;
  realSignedUrlGenerated?: boolean;
  realWebhookSent?: boolean;
  realNetworkCall?: boolean;
  realServerStarted?: boolean;
  realConfigWritten?: boolean;
  realPortsOpened?: boolean;
  realFfmpegExecuted?: boolean;
  realMediaProcessed?: boolean;
  evidenceRole?: string;
  secureRoomHandoffAvailable?: boolean;
  realEvidenceFromSmokeTest?: boolean;
  vaultEligible?: boolean;
  confirmed?: boolean;
  final?: boolean;
  autoRealSmokeStartEnabled?: boolean;
  autoSecretAcceptEnabled?: boolean;
  autoConfigDeployEnabled?: boolean;
  autoApiConnectionEnabled?: boolean;
  [key: string]: unknown;
};

type LiveReadinessDashboard = {
  panelName: string;
  overallStatus: string;
  warning: string;
  readyForMockReview: boolean;
  readyForRealSmoke: boolean;
  realSmokeAllowed: boolean;
  canProceedToRealBroadcast: boolean;
  supportOnly: boolean;
  realSecretStored: boolean;
  realBroadcastStarted: boolean;
  realApiEnabled: boolean;
  realPushEnabled: boolean;
  tokenValueExposed: boolean;
  streamKeyValueExposed: boolean;
  apiKeyValueExposed: boolean;
  oauthTokenValueExposed: boolean;
  signedUrlSecretExposed: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  operatorRunbookSummary?: SummaryWithItems;
  secretRedactionSummary?: SummaryWithItems;
  smokeChecklistSummary?: SummaryWithItems;
  rollbackSummary?: SummaryWithItems;
  targetReadinessSummary?: SummaryWithItems;
  playerReadinessSummary?: SummaryWithItems;
  accessReadinessSummary?: SummaryWithItems;
  eventHealthSummary?: SummaryWithItems;
  engineReadinessSummary?: SummaryWithItems;
  ffmpegVodReadinessSummary?: SummaryWithItems;
  secureRoomSummary?: SummaryWithItems;
  liveDnaLearningSummary?: SummaryWithItems;
};

type LiveApprovalAuditHandoff = {
  liveSessionId: string;
  realApprovalGranted: boolean;
  realSmokeAllowed: boolean;
  canProceedToRealBroadcast: boolean;
  realSecretStored: boolean;
  realBroadcastStarted: boolean;
  realApiEnabled: boolean;
  realPushEnabled: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  supportOnly: boolean;
  decisionRole: string;
  approvalTimelineSummary?: {
    timelineStatus?: string;
    approvalPhraseAcceptedNow?: boolean;
    approvalEvents?: unknown[];
    requiredApprovalPhrasePreview?: string;
  };
  approvalScopeSummary?: {
    targetTypePreview?: string;
    durationLimitPreview?: string;
    rollbackRequired?: boolean;
    costApprovalRequired?: boolean;
    securityReviewRequired?: boolean;
    postTestReportRequired?: boolean;
    vaultImpact?: string;
  };
  riskSnapshotSummary?: {
    risks?: unknown[];
  };
  liveDnaApprovalLearningSummary?: {
    learningRecords?: unknown[];
    autoApprovalEnabled?: boolean;
    autoRealSmokeStartEnabled?: boolean;
    autoSecretAcceptEnabled?: boolean;
    autoConfigDeployEnabled?: boolean;
    autoApiConnectionEnabled?: boolean;
    humanApprovalRequired?: boolean;
  };
};

type LiveSignedApprovalAuditHandoff = {
  liveSessionId: string;
  realApprovalGranted: boolean;
  realSignatureGenerated: boolean;
  privateKeyUsed: boolean;
  realAppendOnlyStorage: boolean;
  realSmokeAllowed: boolean;
  canProceedToRealBroadcast: boolean;
  realSecretStored: boolean;
  realBroadcastStarted: boolean;
  realApiEnabled: boolean;
  realPushEnabled: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  supportOnly: boolean;
  decisionRole: string;
  actorIdentitySummary?: {
    actorIdPreview?: string;
    actorRolePreview?: string;
    actorDisplayNamePreview?: string;
    organizationPreview?: string;
    approvalAuthorityPreview?: string;
    identityVerified?: boolean;
  };
  signedAuditPolicySummary?: {
    appendOnlyPreview?: boolean;
    realAppendOnlyStorage?: boolean;
    realSignatureGenerated?: boolean;
    privateKeyUsed?: boolean;
    deleteAllowed?: boolean;
    updateAllowed?: boolean;
  };
  appendOnlyLogSummary?: {
    entries?: unknown[];
    deleteAllowed?: boolean;
    updateAllowed?: boolean;
  };
  hashChainSummary?: {
    chainIdPreview?: string;
    entriesCountPreview?: number;
    chainValidPreview?: boolean;
    tamperDetectedPreview?: boolean;
    realHashChainStored?: boolean;
  };
  signaturePreviewSummary?: {
    signatureAlgorithmPreview?: string;
    publicKeyIdPreview?: string;
    signatureValuePreview?: string;
    realSignatureGenerated?: boolean;
    privateKeyUsed?: boolean;
    signatureVerifiableNow?: boolean;
  };
  immutabilityValidatorSummary?: {
    immutablePreviewValid?: boolean;
    realValidationPerformed?: boolean;
    checks?: unknown[];
  };
  liveDnaApprovalAuditLearningSummary?: {
    learningRecords?: unknown[];
    autoApprovalEnabled?: boolean;
    autoRealSmokeStartEnabled?: boolean;
    autoSecretAcceptEnabled?: boolean;
    autoProductionConfigDeployEnabled?: boolean;
    autoApiConnectionEnabled?: boolean;
  };
};

type LiveRealSmokeGoNoGoHandoff = {
  liveSessionId: string;
  realSmokeAllowed: boolean;
  canProceedToRealBroadcast: boolean;
  realSecretStored: boolean;
  realBroadcastStarted: boolean;
  realApiEnabled: boolean;
  realPushEnabled: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  supportOnly: boolean;
  decisionRole: string;
  decisionPacketSummary?: {
    packetStatus?: string;
    goDecision?: string;
    recommendedFirstRealTarget?: string;
    youtubeRecommendedAsSecondStep?: boolean;
    readyForMockReview?: boolean;
    readyForRealSmoke?: boolean;
    realSmokeAllowed?: boolean;
    canProceedToRealBroadcast?: boolean;
    requiredApprovalPhrase?: string;
    approvalPhraseAcceptedNow?: boolean;
    realSecretAcceptedNow?: boolean;
    realBroadcastStarted?: boolean;
    realApiEnabled?: boolean;
    realPushEnabled?: boolean;
    vaultEligible?: boolean;
    confirmed?: boolean;
    final?: boolean;
  };
  goNoGoPolicySummary?: {
    requiredApprovalPhrase?: string;
    acceptsApprovalPhraseNow?: boolean;
    acceptsRealSecretNow?: boolean;
    startsRealBroadcastNow?: boolean;
    startsRealSmokeTestNow?: boolean;
    goDecision?: string;
  };
  preflightChecklistSummary?: {
    readyForMockReview?: boolean;
    readyForRealSmoke?: boolean;
    goDecision?: string;
    items?: unknown[];
  };
  blockerReportSummary?: {
    blockers?: unknown[];
    blockerCount?: number;
    readyForRealSmoke?: boolean;
  };
  requiredInputsSummary?: {
    recommendedFirstTarget?: string;
    approvalPhraseFuture?: string;
    allRealInputsAcceptedNow?: boolean;
    realSecretAcceptedNow?: boolean;
    inputs?: unknown[];
  };
  scenarioPlanSummary?: {
    recommendedFirstRealTarget?: string;
    youtubeRecommendedAsSecondStep?: boolean;
    scenarios?: unknown[];
  };
  rollbackPlanSummary?: {
    rollbackReadyForRealSmoke?: boolean;
    steps?: unknown[];
  };
};

type LiveEvidencePathSecureRoomHandoff = {
  preferredLiveEvidencePath: string;
  rtmpDirectCaptureRole: string;
  hlsRepeatabilitySummary?: {
    hlsTotalRuns?: number;
    hlsSuccessfulIdReads?: number;
    hlsExpectedIdMatches?: number;
    summary?: string;
  };
  rtmpWindowSensitivitySummary?: {
    rtmpCapture4sEmbeddedIdRead?: boolean;
    rtmpCapture8sEmbeddedIdRead?: boolean;
    rtmpCapture12sEmbeddedIdRead?: boolean;
    rtmpCapture15sEmbeddedIdRead?: boolean;
    summary?: string;
  };
  postLiveResealSummary?: {
    role?: string;
    needsSeparateProductPhase?: boolean;
  };
  realCustomerContentUsed: boolean;
  externalTargetPush: boolean;
  publicSocialTargetsEnabled: boolean;
  realSecretUsed: boolean;
  realApiEnabled: boolean;
  realBroadcastStarted: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  supportOnly: boolean;
  decisionRole: string;
};

type LiveHlsEvidenceDashboardSummary = {
  title: string;
  preferredPath: string;
  rtmpDirect: string;
  postLiveReseal: string;
  source: string;
  localLabSuccessSummary: string;
  secureRoomBundleAvailable: boolean;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveHlsEvidenceReportDashboardSummary = {
  reportStatus: string;
  hlsCapturePreferred: boolean;
  rtmpDirectDiagnosticOnly: boolean;
  postLiveResealStrategy: string;
  sourceBoundary: string;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveLocalLabCompletionSummary = {
  completionStatus: string;
  localLabPassed: boolean;
  localSmokePassed: boolean;
  repeatabilityPassed: boolean;
  hlsPlaybackPassed: boolean;
  vodCapturePassed: boolean;
  postLiveResealPassed: boolean;
  e2eChainPassed: boolean;
  presealedHlsSurvivalPassed: boolean;
  hlsEvidencePackageReady: boolean;
  pdfArtifactReady: boolean;
  preferredEvidencePath: string;
  rtmpDirectRole: string;
  nextRecommendedGate: string;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveRealLikeLocalContentGateSummary = {
  gateStatus: string;
  fixtureCount: number;
  passedFixtureCount: number;
  failedFixtureCount: number;
  scenarioSummary?: {
    totalScenarios?: number;
    passedScenarios?: number;
    remainingScenarios?: number;
  };
  fixtureResults?: unknown[];
  hlsSurvival?: {
    successfulIdReads?: number;
    totalFixtures?: number;
    rate?: string;
  };
  postLiveResealIdRead?: {
    successfulIdReads?: number;
    totalFixtures?: number;
    rate?: string;
  };
  wrongIdResult: string;
  unsealedResult: string;
  preferredEvidencePath: string;
  rtmpDirectRole: string;
  externalCustomRtmpNonSocialGoNoGo: string;
  youtubeRecommendedAsSecondStep: boolean;
  pdfArtifactPath: string;
  pdfArtifactReady: boolean;
  claimSafetyGuardPassed: boolean;
  realCustomerContentUsed: boolean;
  externalTargetPush: boolean;
  publicSocialTargetsEnabled: boolean;
  realSecretUsed: boolean;
  realApiEnabled: boolean;
  productionDeploy: boolean;
  pushUsed: boolean;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveExternalRtmpReadinessSummary = {
  phase: string;
  readinessStatus: string;
  previousGateCheckpoint: string;
  previousGatePassed: boolean;
  targetType: string;
  targetSocialPlatform: boolean;
  externalPublishExecuted: boolean;
  realSecretAcceptedNow: boolean;
  realApiEnabled: boolean;
  customerContentUsed: boolean;
  youtubeUsed: boolean;
  facebookUsed: boolean;
  twitchUsed: boolean;
  placeholderTargetConfig?: {
    configStatus?: string;
    providerLabel?: string;
    realValuesAcceptedNow?: boolean;
    socialPlatformAllowed?: boolean;
  };
  secretRedactionPolicy?: {
    checkedFields?: unknown[];
    detectedSecretLikeValue?: boolean;
    allSecretLikeValuesRedacted?: boolean;
    storageAllowed?: boolean;
    logAllowed?: boolean;
    realSecretStored?: boolean;
  };
  dryRunCommandPreview?: {
    commandKind?: string;
    willExecute?: boolean;
    dryRunOnly?: boolean;
    usesRealTarget?: boolean;
    realNetworkPush?: boolean;
    secretValuesLogged?: boolean;
    targetUrlRedacted?: boolean;
    streamKeyRedacted?: boolean;
  };
  fixtureSelection?: {
    selectedFixtureId?: string;
    fixtureSourceBoundary?: string;
    customerContentAllowed?: boolean;
    copyrightedDownloadedMediaAllowed?: boolean;
  };
  durationPlan?: {
    minimumSmokeSeconds?: number;
    maximumSafeSeconds?: number;
    stopConditions?: unknown[];
  };
  rollbackPlan?: {
    rollbackReadyForFutureTest?: boolean;
    steps?: unknown[];
  };
  evidencePlan?: {
    hlsCapturePreferredPath?: boolean;
    rtmpDirectRole?: string;
    postLiveResealRequired?: boolean;
    idReadRequired?: boolean;
    wrongIdNegativeRequired?: boolean;
    unsealedNegativeRequired?: boolean;
    pdfSupportOnly?: boolean;
  };
  approvalPacket?: {
    approvalRequired?: boolean;
    acceptedNow?: boolean;
    requiredApprovalPhrase?: string;
    requiredFields?: unknown[];
    nonSocialTargetVerification?: unknown[];
  };
  goNoGoCriteria?: unknown[];
  artifactFreshnessAudit?: {
    artifactExists?: boolean;
    artifactSizeBytes?: number;
    artifactSha256?: string | null;
    artifactMtimeIso?: string | null;
    pathNamePotentiallyConfusing?: boolean;
    currentForRealLikeLocalGate?: boolean;
    recommendedFutureArtifactDirectory?: string;
  };
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveExternalRtmpSmokeSummary = {
  phase: string;
  previousReadinessCheckpoint: string;
  readinessPacketPassed: boolean;
  approvalEnvEnabled: boolean;
  targetUrlPresent: boolean;
  streamKeyPresent: boolean;
  runModeOk: boolean;
  targetSocialPlatformBlocked: boolean;
  targetHostRedacted: string;
  safetyGateStatus: string;
  missingRequirements?: unknown[];
  externalPublishAttempted: boolean;
  externalPublishExecuted: boolean;
  publishDurationSeconds: number;
  redactedFfmpegCommand: string;
  fixture?: {
    fixtureId?: string;
    sourceBoundary?: string;
    customerContentUsed?: boolean;
    copyrightedDownloadedMediaUsed?: boolean;
  };
  hlsVodCapability?: {
    hlsManifestChecked?: boolean;
    hlsSegmentsChecked?: boolean;
    hlsPlaybackProbeAttempted?: boolean;
    vodCaptureAttempted?: boolean;
    capabilityStatus?: string;
  };
  postLiveReseal?: {
    attempted?: boolean;
    succeeded?: boolean;
    idReadAttempted?: boolean;
    expectedIdRead?: boolean;
    wrongIdRejected?: boolean;
    unsealedNoVault?: boolean;
    idReadRate?: string;
  };
  evidence?: {
    artifactNamespace?: string;
    manifestPath?: string;
    manifestExists?: boolean;
    hlsEvidencePackageGenerated?: boolean;
    secureRoomBundleGenerated?: boolean;
    jsonHtmlTxtArtifactsGenerated?: boolean;
    pdfArtifactGenerated?: boolean;
    pdfArtifactPath?: string;
    pdfSupportOnly?: boolean;
    claimSafetyGuardPassed?: boolean;
  };
  securityScan?: {
    rawSecretLeakDetected?: boolean;
    logsContainRawRtmpUrl?: boolean;
    logsContainRawStreamKey?: boolean;
    artifactsContainRawSecret?: boolean;
    gitDiffContainsSecret?: boolean;
    redactionScanPassed?: boolean;
  };
  stopRollback?: {
    stopTriggered?: boolean;
    rollbackExecuted?: boolean;
    rollbackRequired?: boolean;
    rollbackPlanReady?: boolean;
    result?: string;
  };
  goNoGoRecommendation: string;
  youtubeFacebookTwitchUsed: boolean;
  customerContentUsed: boolean;
  realSecretAcceptedNow: boolean;
  realApiEnabled: boolean;
  productionDeploy: boolean;
  billingCreditPaymentAdded: boolean;
  pushUsed: boolean;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveExternalRtmpTargetSetupSummary = {
  phase: string;
  previousSmokeGateCheckpoint: string;
  previousSmokeGateInstalled: boolean;
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  targetSocialPlatformBlocked: boolean;
  targetHostRedacted: string;
  setupStatus: string;
  missingRequirements?: unknown[];
  targetSetupAttempted: boolean;
  targetSetupExecuted: boolean;
  externalServerConnectionAttempted: boolean;
  externalPublishAttempted: boolean;
  externalPublishExecuted: boolean;
  productionDeploy: boolean;
  billingResourceCreation: boolean;
  customerContentUsed: boolean;
  youtubeFacebookTwitchUsed: boolean;
  realSecretAcceptedNow: boolean;
  templateArtifacts?: {
    artifactNamespace?: string;
    manifestPath?: string;
    targetConfigTemplatePath?: string;
    mediaMtxTemplatePath?: string;
    redactionPolicyPath?: string;
    rollbackPlanPath?: string;
    healthcheckPlanPath?: string;
    manifestExists?: boolean;
    targetConfigTemplateExists?: boolean;
    mediaMtxTemplateExists?: boolean;
    redactionPolicyExists?: boolean;
    rollbackPlanExists?: boolean;
    healthcheckPlanExists?: boolean;
  };
  targetPlan?: {
    selectedDefault?: string;
    selectionReason?: string;
    rtmpIngestPlan?: string;
    hlsOutputPlan?: string;
    vodRecordingPlan?: string;
    firewallPorts?: unknown[];
    disposableTargetRequired?: boolean;
    cleanupRequired?: boolean;
  };
  dryRunHealthcheckPlan?: {
    endpointFormatCheck?: boolean;
    socialBlocklistCheck?: boolean;
    secretRedactionCheck?: boolean;
    hlsOutputPathCheck?: boolean;
    vodRecordingCapabilityCheck?: boolean;
    stopCleanupPlanCheck?: boolean;
    willConnectToExternalHost?: boolean;
    willPublishExternalStream?: boolean;
  };
  securityBoundary?: {
    fullAccessIsNotApproval?: boolean;
    rawSecretLeakDetected?: boolean;
    secretValuesStored?: boolean;
    hlsCapturePreferredPath?: boolean;
    rtmpDirectRole?: string;
    socialPlatformsBlocked?: unknown[];
  };
  goNoGoRecommendation: string;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveRtmpTargetCredentialPreflightSummary = {
  phase: string;
  previousTargetSetupCheckpoint: string;
  previousTargetSetupGateInstalled: boolean;
  credentialPreflightCreated: boolean;
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  allowBillingOk: boolean;
  allowProductionOk: boolean;
  targetPurposeOk: boolean;
  smokeApprovalEnvEnabled: boolean;
  smokeUrlPresent: boolean;
  smokeStreamKeyPresent: boolean;
  smokeRunModeOk: boolean;
  targetSocialPlatformBlocked: boolean;
  targetHostRedacted: string;
  preflightStatus: string;
  missingRequirements?: unknown[];
  nextApprovedPhase: string;
  realExternalServerConnectionAttempted: boolean;
  realTargetSetupExecuted: boolean;
  externalPublishExecuted: boolean;
  billingResourceCreation: boolean;
  productionDeploy: boolean;
  customerContentUsed: boolean;
  youtubeFacebookTwitchUsed: boolean;
  rawSecretLeakDetected: boolean;
  artifacts?: {
    artifactNamespace?: string;
    manifestPath?: string;
    requiredEnvTemplatePath?: string;
    targetCredentialsChecklistPath?: string;
    socialPlatformBlocklistPath?: string;
    sshSecurityChecklistPath?: string;
    mediaMtxInstallPreflightPath?: string;
    secretRedactionPreflightPath?: string;
    goNoGoChecklistPath?: string;
    manifestExists?: boolean;
    requiredEnvTemplateExists?: boolean;
    targetCredentialsChecklistExists?: boolean;
    socialPlatformBlocklistExists?: boolean;
    sshSecurityChecklistExists?: boolean;
    mediaMtxInstallPreflightExists?: boolean;
    secretRedactionPreflightExists?: boolean;
    goNoGoChecklistExists?: boolean;
  };
  requiredHumanInputs?: unknown[];
  safeEnvVariables?: unknown[];
  validationPlan?: {
    socialPlatformBlocklistCheck?: boolean;
    redactedEnvTemplateCheck?: boolean;
    hostRedactionCheck?: boolean;
    sshAuthModeReview?: boolean;
    billingMustRemainFalse?: boolean;
    productionMustRemainFalse?: boolean;
    hlsOutputRequired?: boolean;
    vodRecordingCapabilityRequired?: boolean;
    cleanupRollbackRequired?: boolean;
    willConnectToExternalHost?: boolean;
    willPublishExternalStream?: boolean;
  };
  securityBoundary?: {
    fullAccessIsNotApproval?: boolean;
    rawHostStored?: boolean;
    rawSshUserStored?: boolean;
    rawSecretStored?: boolean;
    rawStreamKeyStored?: boolean;
    socialPlatformsBlocked?: unknown[];
    hlsCapturePreferredPath?: boolean;
    rtmpDirectRole?: string;
  };
  goNoGoRecommendation: string;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveNoCostRtmpTargetAutoSetupSummary = {
  phase: string;
  previousCredentialPreflightCheckpoint: string;
  userPreference?: {
    userDoesNotWantCredentialEntry?: boolean;
    userDoesNotWantCost?: boolean;
    fullAccessIsNotApproval?: boolean;
  };
  localToolingDiscovery?: {
    discoveryStatus?: string;
    selectedEngine?: string;
    mediamtxPortableReady?: boolean;
    ffmpegPortableReady?: boolean;
    mediamtxConfigReady?: boolean;
    checkedPorts?: unknown[];
  };
  localNoCostTargetSetup?: {
    setupStatus?: string;
    localNoCostTargetSetupVerified?: boolean;
    newLocalProcessStartedNow?: boolean;
    reusedExistingLocalSmokeEvidence?: boolean;
    localhostOnly?: boolean;
    localRtmpEndpointRedacted?: string;
    localHlsEndpointRedacted?: string;
    rawStreamKeyLogged?: boolean;
    targetIsSocialPlatform?: boolean;
  };
  smokeValidation?: {
    actualSmokeEvidenceAvailable?: boolean;
    durationSeconds?: number;
    rtmpPublishObserved?: boolean;
    hlsManifestObserved?: boolean;
    hlsSegmentsObserved?: boolean;
    hlsProbeSucceeded?: boolean;
    hlsReadableByFfmpegOrFfprobe?: boolean;
    vodCaptureCreated?: boolean;
    vodCaptureDurationSeconds?: number;
    postLiveResealSucceeded?: boolean;
    embeddedIdRead?: boolean;
    idMatchExpectedLabRecord?: boolean;
    wrongIdRejected?: boolean;
    unsealedNoVault?: boolean;
    candidateDoesNotOpenVault?: boolean;
  };
  evidence?: {
    artifactNamespace?: string;
    manifestPath?: string;
    reportPath?: string;
    pdfArtifactPath?: string;
    pdfArtifactGenerated?: boolean;
    claimSafetyGuardPassed?: boolean;
    allExpectedArtifactsPresent?: boolean;
  };
  securityBoundary?: {
    billingResourceCreation?: boolean;
    externalPublishExecuted?: boolean;
    externalSshAttempted?: boolean;
    externalServerConnectionAttempted?: boolean;
    youtubeFacebookTwitchUsed?: boolean;
    customerContentUsed?: boolean;
    copyrightedMediaUsed?: boolean;
    productionDeploy?: boolean;
    rawSecretLeakDetected?: boolean;
    hlsCapturePreferredPath?: boolean;
    rtmpDirectRole?: string;
  };
  nextGate?: {
    realExternalTestStillRequiresNonSocialExternalTarget?: boolean;
    socialPlatformsDeferred?: boolean;
    customerContentDeferred?: boolean;
    legalFinalEvidenceDeferred?: boolean;
  };
  goNoGoRecommendation: string;
  supportOnly: boolean;
  vaultEligible: boolean;
  confirmed: boolean;
  final: boolean;
  decisionRole: string;
};

type LiveReadinessPageData = {
  dashboard: LiveReadinessDashboard;
  approvalAudit: LiveApprovalAuditHandoff;
  signedApprovalAudit: LiveSignedApprovalAuditHandoff;
  realSmokeGoNoGo: LiveRealSmokeGoNoGoHandoff;
  evidencePath: LiveEvidencePathSecureRoomHandoff;
  hlsEvidenceBundle: LiveHlsEvidenceDashboardSummary;
  hlsEvidenceReport: LiveHlsEvidenceReportDashboardSummary;
  localLabCompletion: LiveLocalLabCompletionSummary;
  realLikeLocalContentGate: LiveRealLikeLocalContentGateSummary;
  externalRtmpReadiness: LiveExternalRtmpReadinessSummary;
  externalRtmpSmoke: LiveExternalRtmpSmokeSummary;
  externalRtmpTargetSetup: LiveExternalRtmpTargetSetupSummary;
  rtmpTargetCredentialPreflight: LiveRtmpTargetCredentialPreflightSummary;
  noCostRtmpTargetAutoSetup: LiveNoCostRtmpTargetAutoSetupSummary;
};

type MetricRow = {
  label: string;
  value: React.ReactNode;
};

function boolLabel(value: boolean | undefined): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "-";
}

function boolClass(value: boolean | undefined, expected: boolean): string {
  if (value === expected) {
    return expected
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : "border-sky-500/40 bg-sky-500/10 text-sky-700";
  }
  return "border-red-500/40 bg-red-500/10 text-red-700";
}

function listCount(value: unknown[] | undefined): string {
  return Array.isArray(value) ? String(value.length) : "0";
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return boolLabel(value);
  if (typeof value === "number") return String(value);
  return "-";
}

function FlagTile({
  label,
  value,
  expected,
}: {
  label: string;
  value: boolean | undefined;
  expected: boolean;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-mono break-words">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="outline" className={boolClass(value, expected)}>
          {boolLabel(value)}
        </Badge>
      </CardContent>
    </Card>
  );
}

function SummarySection({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: MetricRow[];
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
            <div className="text-muted-foreground font-mono text-xs break-all">{row.label}</div>
            <div className="text-right font-medium break-words">{row.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function LiveRealLabReadinessPage() {
  const { hasToken } = useAdminToken();
  const query = useQuery({
    queryKey: ["live-real-lab-readiness"],
    enabled: hasToken,
    retry: false,
    queryFn: async (): Promise<LiveReadinessPageData> => {
      const token = getAdminToken();
      const headers: HeadersInit = token ? { "x-admin-token": token } : {};
      const [
        dashboardResponse,
        approvalAuditResponse,
        signedApprovalAuditResponse,
        realSmokeGoNoGoResponse,
        evidencePathResponse,
        hlsEvidenceBundleResponse,
        hlsEvidenceReportResponse,
        localLabCompletionResponse,
        realLikeLocalContentGateResponse,
        externalRtmpReadinessResponse,
        externalRtmpSmokeResponse,
        externalRtmpTargetSetupResponse,
        rtmpTargetCredentialPreflightResponse,
        noCostRtmpTargetAutoSetupResponse,
      ] = await Promise.all([
        fetch("/api/tancmark/live/dashboard/real-lab-readiness", { headers }),
        fetch("/api/tancmark/live/sessions/live_dashboard_readiness_preview/approval-audit/secure-room-handoff", {
          headers,
        }),
        fetch("/api/tancmark/live/sessions/live_dashboard_readiness_preview/approval-identity/secure-room-handoff", {
          headers,
        }),
        fetch("/api/tancmark/live/sessions/live_dashboard_readiness_preview/real-smoke/secure-room-handoff", {
          headers,
        }),
        fetch("/api/tancmark/live/evidence-path/secure-room-handoff", { headers }),
        fetch("/api/tancmark/live/evidence-package/hls-local/dashboard-summary", { headers }),
        fetch("/api/tancmark/live/evidence-report/hls-local/dashboard-summary", { headers }),
        fetch("/api/tancmark/live/local-lab/completion-summary", { headers }),
        fetch("/api/tancmark/live/real-like-local-content-gate/summary", { headers }),
        fetch("/api/tancmark/live/external-rtmp-readiness/summary", { headers }),
        fetch("/api/tancmark/live/external-rtmp-smoke/summary", { headers }),
        fetch("/api/tancmark/live/external-rtmp-target-setup/summary", { headers }),
        fetch("/api/tancmark/live/rtmp-target-credential-preflight/summary", { headers }),
        fetch("/api/tancmark/live/no-cost-rtmp-target-auto-setup/summary", { headers }),
      ]);
      if (
        !dashboardResponse.ok ||
        !approvalAuditResponse.ok ||
        !signedApprovalAuditResponse.ok ||
        !realSmokeGoNoGoResponse.ok ||
        !evidencePathResponse.ok ||
        !hlsEvidenceBundleResponse.ok ||
        !hlsEvidenceReportResponse.ok ||
        !localLabCompletionResponse.ok ||
        !realLikeLocalContentGateResponse.ok ||
        !externalRtmpReadinessResponse.ok ||
        !externalRtmpSmokeResponse.ok ||
        !externalRtmpTargetSetupResponse.ok ||
        !rtmpTargetCredentialPreflightResponse.ok ||
        !noCostRtmpTargetAutoSetupResponse.ok
      ) {
        const status = !dashboardResponse.ok
          ? dashboardResponse.status
          : !approvalAuditResponse.ok
            ? approvalAuditResponse.status
            : !signedApprovalAuditResponse.ok
              ? signedApprovalAuditResponse.status
              : !realSmokeGoNoGoResponse.ok
                ? realSmokeGoNoGoResponse.status
                : !evidencePathResponse.ok
                  ? evidencePathResponse.status
                  : !hlsEvidenceBundleResponse.ok
                    ? hlsEvidenceBundleResponse.status
                    : !hlsEvidenceReportResponse.ok
                      ? hlsEvidenceReportResponse.status
                      : !localLabCompletionResponse.ok
                        ? localLabCompletionResponse.status
                        : !realLikeLocalContentGateResponse.ok
                          ? realLikeLocalContentGateResponse.status
                          : !externalRtmpReadinessResponse.ok
                            ? externalRtmpReadinessResponse.status
                            : !externalRtmpSmokeResponse.ok
                            ? externalRtmpSmokeResponse.status
                            : !externalRtmpTargetSetupResponse.ok
                              ? externalRtmpTargetSetupResponse.status
                              : !rtmpTargetCredentialPreflightResponse.ok
                                ? rtmpTargetCredentialPreflightResponse.status
                                : noCostRtmpTargetAutoSetupResponse.status;
        const error = new Error(`Live readiness dashboard okunamadi (${status})`);
        (error as Error & { status?: number }).status = status;
        throw error;
      }
      return {
        dashboard: (await dashboardResponse.json()) as LiveReadinessDashboard,
        approvalAudit: (await approvalAuditResponse.json()) as LiveApprovalAuditHandoff,
        signedApprovalAudit: (await signedApprovalAuditResponse.json()) as LiveSignedApprovalAuditHandoff,
        realSmokeGoNoGo: (await realSmokeGoNoGoResponse.json()) as LiveRealSmokeGoNoGoHandoff,
        evidencePath: (await evidencePathResponse.json()) as LiveEvidencePathSecureRoomHandoff,
        hlsEvidenceBundle: (await hlsEvidenceBundleResponse.json()) as LiveHlsEvidenceDashboardSummary,
        hlsEvidenceReport: (await hlsEvidenceReportResponse.json()) as LiveHlsEvidenceReportDashboardSummary,
        localLabCompletion: (await localLabCompletionResponse.json()) as LiveLocalLabCompletionSummary,
        realLikeLocalContentGate:
          (await realLikeLocalContentGateResponse.json()) as LiveRealLikeLocalContentGateSummary,
        externalRtmpReadiness:
          (await externalRtmpReadinessResponse.json()) as LiveExternalRtmpReadinessSummary,
        externalRtmpSmoke: (await externalRtmpSmokeResponse.json()) as LiveExternalRtmpSmokeSummary,
        externalRtmpTargetSetup:
          (await externalRtmpTargetSetupResponse.json()) as LiveExternalRtmpTargetSetupSummary,
        rtmpTargetCredentialPreflight:
          (await rtmpTargetCredentialPreflightResponse.json()) as LiveRtmpTargetCredentialPreflightSummary,
        noCostRtmpTargetAutoSetup:
          (await noCostRtmpTargetAutoSetupResponse.json()) as LiveNoCostRtmpTargetAutoSetupSummary,
      };
    },
  });

  const data = query.data?.dashboard;
  const approvalAudit = query.data?.approvalAudit;
  const signedApprovalAudit = query.data?.signedApprovalAudit;
  const realSmokeGoNoGo = query.data?.realSmokeGoNoGo;
  const evidencePath = query.data?.evidencePath;
  const hlsEvidenceBundle = query.data?.hlsEvidenceBundle;
  const hlsEvidenceReport = query.data?.hlsEvidenceReport;
  const localLabCompletion = query.data?.localLabCompletion;
  const realLikeLocalContentGate = query.data?.realLikeLocalContentGate;
  const externalRtmpReadiness = query.data?.externalRtmpReadiness;
  const externalRtmpSmoke = query.data?.externalRtmpSmoke;
  const externalRtmpTargetSetup = query.data?.externalRtmpTargetSetup;
  const rtmpTargetCredentialPreflight = query.data?.rtmpTargetCredentialPreflight;
  const noCostRtmpTargetAutoSetup = query.data?.noCostRtmpTargetAutoSetup;
  const secret = data?.secretRedactionSummary;
  const access = data?.accessReadinessSummary;
  const player = data?.playerReadinessSummary;
  const engine = data?.engineReadinessSummary;
  const eventHealth = data?.eventHealthSummary;
  const ffmpegVod = data?.ffmpegVodReadinessSummary;
  const secureRoom = data?.secureRoomSummary;
  const liveDna = data?.liveDnaLearningSummary;

  const criticalFlags = [
    { label: "readyForRealSmoke", value: data?.readyForRealSmoke, expected: false },
    { label: "realSmokeAllowed", value: data?.realSmokeAllowed, expected: false },
    { label: "canProceedToRealBroadcast", value: data?.canProceedToRealBroadcast, expected: false },
    { label: "supportOnly", value: data?.supportOnly, expected: true },
    { label: "realSecretStored", value: data?.realSecretStored, expected: false },
    { label: "realBroadcastStarted", value: data?.realBroadcastStarted, expected: false },
    { label: "realApiEnabled", value: data?.realApiEnabled, expected: false },
    { label: "realPushEnabled", value: data?.realPushEnabled, expected: false },
    { label: "vaultEligible", value: data?.vaultEligible, expected: false },
    { label: "confirmed", value: data?.confirmed, expected: false },
    { label: "final", value: data?.final, expected: false },
  ];

  const secretFlags = [
    { label: "tokenValueExposed", value: data?.tokenValueExposed, expected: false },
    { label: "streamKeyValueExposed", value: data?.streamKeyValueExposed, expected: false },
    { label: "apiKeyValueExposed", value: data?.apiKeyValueExposed, expected: false },
    { label: "oauthTokenValueExposed", value: data?.oauthTokenValueExposed, expected: false },
    { label: "signedUrlSecretExposed", value: data?.signedUrlSecretExposed, expected: false },
  ];

  const approvalFlags = [
    { label: "realApprovalGranted", value: approvalAudit?.realApprovalGranted, expected: false },
    { label: "realSmokeAllowed", value: approvalAudit?.realSmokeAllowed, expected: false },
    {
      label: "canProceedToRealBroadcast",
      value: approvalAudit?.canProceedToRealBroadcast,
      expected: false,
    },
    {
      label: "approvalPhraseAcceptedNow",
      value: approvalAudit?.approvalTimelineSummary?.approvalPhraseAcceptedNow,
      expected: false,
    },
    { label: "supportOnly", value: approvalAudit?.supportOnly, expected: true },
    { label: "vaultEligible", value: approvalAudit?.vaultEligible, expected: false },
    { label: "confirmed", value: approvalAudit?.confirmed, expected: false },
    { label: "final", value: approvalAudit?.final, expected: false },
  ];

  const signedAuditFlags = [
    { label: "realApprovalGranted", value: signedApprovalAudit?.realApprovalGranted, expected: false },
    {
      label: "realSignatureGenerated",
      value: signedApprovalAudit?.realSignatureGenerated,
      expected: false,
    },
    { label: "privateKeyUsed", value: signedApprovalAudit?.privateKeyUsed, expected: false },
    {
      label: "realAppendOnlyStorage",
      value: signedApprovalAudit?.realAppendOnlyStorage,
      expected: false,
    },
    { label: "realSmokeAllowed", value: signedApprovalAudit?.realSmokeAllowed, expected: false },
    {
      label: "canProceedToRealBroadcast",
      value: signedApprovalAudit?.canProceedToRealBroadcast,
      expected: false,
    },
    { label: "supportOnly", value: signedApprovalAudit?.supportOnly, expected: true },
    { label: "vaultEligible", value: signedApprovalAudit?.vaultEligible, expected: false },
    { label: "confirmed", value: signedApprovalAudit?.confirmed, expected: false },
    { label: "final", value: signedApprovalAudit?.final, expected: false },
  ];

  const goNoGoFlags = [
    {
      label: "readyForRealSmoke",
      value: realSmokeGoNoGo?.decisionPacketSummary?.readyForRealSmoke,
      expected: false,
    },
    { label: "realSmokeAllowed", value: realSmokeGoNoGo?.realSmokeAllowed, expected: false },
    {
      label: "canProceedToRealBroadcast",
      value: realSmokeGoNoGo?.canProceedToRealBroadcast,
      expected: false,
    },
    {
      label: "approvalPhraseAcceptedNow",
      value: realSmokeGoNoGo?.decisionPacketSummary?.approvalPhraseAcceptedNow,
      expected: false,
    },
    {
      label: "realSecretAcceptedNow",
      value: realSmokeGoNoGo?.decisionPacketSummary?.realSecretAcceptedNow,
      expected: false,
    },
    { label: "supportOnly", value: realSmokeGoNoGo?.supportOnly, expected: true },
    { label: "vaultEligible", value: realSmokeGoNoGo?.vaultEligible, expected: false },
    { label: "confirmed", value: realSmokeGoNoGo?.confirmed, expected: false },
    { label: "final", value: realSmokeGoNoGo?.final, expected: false },
  ];

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-7xl mx-auto space-y-6" data-testid="live-real-lab-readiness-page">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <RadioTower className="w-8 h-8 text-primary" />
            TancMark Live Real-Lab Readiness
          </h1>
          <p className="text-muted-foreground">
            Read-only hazirlik paneli. Bu ekran yalnizca mevcut summary endpointini okur.
          </p>
        </div>

        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3"
          data-testid="live-readiness-safety-warning"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground space-y-1">
            <p>
              Bu panel sadece hazirlik kontrol ekranidir. Gercek yayin, gercek smoke test, gercek API,
              gercek stream key, gercek target push veya gercek DRM baslatmaz.
            </p>
            <p>
              decisionRole: read_only_live_readiness_ui_no_vault_no_confirmed. VAULT/confirmed/final,
              threshold, ownership/pre-seal ve DNA karar kapilari degismez.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">overallStatus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-sm break-all">
                {query.isLoading ? "..." : data?.overallStatus ?? "-"}
              </div>
            </CardContent>
          </Card>
          <FlagTile label="readyForMockReview" value={data?.readyForMockReview} expected={true} />
          <FlagTile label="readyForRealSmoke" value={data?.readyForRealSmoke} expected={false} />
          <FlagTile label="supportOnly" value={data?.supportOnly} expected={true} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-medium">Kritik karar bayraklari</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {criticalFlags.map((flag) => (
              <FlagTile key={flag.label} label={flag.label} value={flag.value} expected={flag.expected} />
            ))}
          </div>
        </div>

        <div className="space-y-3" data-testid="live-evidence-path-policy-section">
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">Live Evidence Path Policy</h2>
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu politika canlı yayın local lab sonuçlarına dayanır. HLS capture preferred path'tir; RTMP direct capture ürün evidence/read yolu değildir. Bu panel VAULT/confirmed/final kararı vermez.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Evidence path policy"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "Preferred path", value: "HLS capture" },
                { label: "RTMP direct", value: "diagnostic-only" },
                {
                  label: "Post-live re-seal",
                  value: textValue(evidencePath?.postLiveResealSummary?.role ?? "safest_local_reseal_strategy"),
                },
                { label: "decisionRole", value: textValue(evidencePath?.decisionRole) },
              ]}
            />
            <SummarySection
              title="Evidence path safety"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "supportOnly", value: boolLabel(evidencePath?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(evidencePath?.vaultEligible) },
                { label: "confirmed", value: boolLabel(evidencePath?.confirmed) },
                { label: "final", value: boolLabel(evidencePath?.final) },
                {
                  label: "hlsSuccessfulIdReads",
                  value: `${textValue(evidencePath?.hlsRepeatabilitySummary?.hlsSuccessfulIdReads)}/${textValue(evidencePath?.hlsRepeatabilitySummary?.hlsTotalRuns)}`,
                },
                {
                  label: "rtmp4s/8s/12s/15s",
                  value: `${boolLabel(evidencePath?.rtmpWindowSensitivitySummary?.rtmpCapture4sEmbeddedIdRead)}/${boolLabel(evidencePath?.rtmpWindowSensitivitySummary?.rtmpCapture8sEmbeddedIdRead)}/${boolLabel(evidencePath?.rtmpWindowSensitivitySummary?.rtmpCapture12sEmbeddedIdRead)}/${boolLabel(evidencePath?.rtmpWindowSensitivitySummary?.rtmpCapture15sEmbeddedIdRead)}`,
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="live-local-lab-completion-section">
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">Live Local Lab Completion</h2>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum sadece local lab kapanis ozetidir. Gercek test, gercek yayin, secret kabul,
              target push veya VAULT/confirmed/final karari baslatmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Completion summary"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "Local lab passed", value: boolLabel(localLabCompletion?.localLabPassed) },
                { label: "Local smoke passed", value: boolLabel(localLabCompletion?.localSmokePassed) },
                { label: "Repeatability passed", value: boolLabel(localLabCompletion?.repeatabilityPassed) },
                { label: "HLS playback passed", value: boolLabel(localLabCompletion?.hlsPlaybackPassed) },
                { label: "VOD capture passed", value: boolLabel(localLabCompletion?.vodCapturePassed) },
                { label: "Post-live re-seal passed", value: boolLabel(localLabCompletion?.postLiveResealPassed) },
                { label: "E2E chain passed", value: boolLabel(localLabCompletion?.e2eChainPassed) },
                {
                  label: "Pre-sealed HLS survival passed",
                  value: boolLabel(localLabCompletion?.presealedHlsSurvivalPassed),
                },
              ]}
            />
            <SummarySection
              title="External test gate"
              icon={<RadioTower className="w-4 h-4 text-primary" />}
              rows={[
                { label: "HLS preferred path", value: textValue(localLabCompletion?.preferredEvidencePath) },
                { label: "PDF artefact ready", value: boolLabel(localLabCompletion?.pdfArtifactReady) },
                { label: "HLS evidence package ready", value: boolLabel(localLabCompletion?.hlsEvidencePackageReady) },
                { label: "RTMP direct diagnostic-only", value: textValue(localLabCompletion?.rtmpDirectRole) },
                { label: "Next gate", value: textValue(localLabCompletion?.nextRecommendedGate) },
                { label: "supportOnly", value: boolLabel(localLabCompletion?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(localLabCompletion?.vaultEligible) },
                { label: "confirmed", value: boolLabel(localLabCompletion?.confirmed) },
                { label: "final", value: boolLabel(localLabCompletion?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="real-like-local-content-gate-section">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">Real-Like Local Content Gate</h2>
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum musteri olmayan yerel fixture kapisini okur. Dis hedef, sosyal platform,
              secret, deploy, push veya VAULT/confirmed/final karari baslatmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Fixture gate summary"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "gateStatus", value: textValue(realLikeLocalContentGate?.gateStatus) },
                { label: "fixtureCount", value: textValue(realLikeLocalContentGate?.fixtureCount) },
                { label: "passedFixtureCount", value: textValue(realLikeLocalContentGate?.passedFixtureCount) },
                { label: "failedFixtureCount", value: textValue(realLikeLocalContentGate?.failedFixtureCount) },
                {
                  label: "scenarioSummary",
                  value: `${textValue(realLikeLocalContentGate?.scenarioSummary?.passedScenarios)}/${textValue(realLikeLocalContentGate?.scenarioSummary?.totalScenarios)}`,
                },
                {
                  label: "fixtureResults",
                  value: listCount(realLikeLocalContentGate?.fixtureResults),
                },
              ]}
            />
            <SummarySection
              title="Evidence and safety"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "HLS survival rate", value: textValue(realLikeLocalContentGate?.hlsSurvival?.rate) },
                {
                  label: "Post-live re-seal ID-read rate",
                  value: textValue(realLikeLocalContentGate?.postLiveResealIdRead?.rate),
                },
                { label: "Wrong ID result", value: textValue(realLikeLocalContentGate?.wrongIdResult) },
                { label: "Unsealed result", value: textValue(realLikeLocalContentGate?.unsealedResult) },
                { label: "HLS preferred path", value: textValue(realLikeLocalContentGate?.preferredEvidencePath) },
                { label: "RTMP direct diagnostic-only", value: textValue(realLikeLocalContentGate?.rtmpDirectRole) },
                { label: "External custom RTMP Go/No-Go", value: textValue(realLikeLocalContentGate?.externalCustomRtmpNonSocialGoNoGo) },
                { label: "YouTube second step", value: boolLabel(realLikeLocalContentGate?.youtubeRecommendedAsSecondStep) },
              ]}
            />
            <SummarySection
              title="PDF artifact"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                { label: "pdfArtifactReady", value: boolLabel(realLikeLocalContentGate?.pdfArtifactReady) },
                { label: "claimSafetyGuardPassed", value: boolLabel(realLikeLocalContentGate?.claimSafetyGuardPassed) },
                { label: "pdfArtifactPath", value: textValue(realLikeLocalContentGate?.pdfArtifactPath) },
              ]}
            />
            <SummarySection
              title="Decision boundary"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                { label: "realCustomerContentUsed", value: boolLabel(realLikeLocalContentGate?.realCustomerContentUsed) },
                { label: "externalTargetPush", value: boolLabel(realLikeLocalContentGate?.externalTargetPush) },
                {
                  label: "publicSocialTargetsEnabled",
                  value: boolLabel(realLikeLocalContentGate?.publicSocialTargetsEnabled),
                },
                { label: "realSecretUsed", value: boolLabel(realLikeLocalContentGate?.realSecretUsed) },
                { label: "realApiEnabled", value: boolLabel(realLikeLocalContentGate?.realApiEnabled) },
                { label: "productionDeploy", value: boolLabel(realLikeLocalContentGate?.productionDeploy) },
                { label: "pushUsed", value: boolLabel(realLikeLocalContentGate?.pushUsed) },
                { label: "supportOnly", value: boolLabel(realLikeLocalContentGate?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(realLikeLocalContentGate?.vaultEligible) },
                { label: "confirmed", value: boolLabel(realLikeLocalContentGate?.confirmed) },
                { label: "final", value: boolLabel(realLikeLocalContentGate?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="external-rtmp-readiness-section">
          <div className="flex items-center gap-2">
            <RadioTower className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">External RTMP Readiness</h2>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum external custom RTMP non-social test oncesi hazirlik paketidir.
              Gercek target publish, secret kabul, sosyal platform, musteri icerigi veya
              VAULT/confirmed/final karari baslatmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Readiness packet"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "phase", value: textValue(externalRtmpReadiness?.phase) },
                { label: "readinessStatus", value: textValue(externalRtmpReadiness?.readinessStatus) },
                { label: "previousGateCheckpoint", value: textValue(externalRtmpReadiness?.previousGateCheckpoint) },
                { label: "previousGatePassed", value: boolLabel(externalRtmpReadiness?.previousGatePassed) },
                { label: "targetType", value: textValue(externalRtmpReadiness?.targetType) },
                {
                  label: "placeholderTargetConfig.configStatus",
                  value: textValue(externalRtmpReadiness?.placeholderTargetConfig?.configStatus),
                },
                {
                  label: "placeholderTargetConfig.socialPlatformAllowed",
                  value: boolLabel(externalRtmpReadiness?.placeholderTargetConfig?.socialPlatformAllowed),
                },
              ]}
            />
            <SummarySection
              title="Secret redaction and dry-run"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "secretRedactionPolicy.checkedFields",
                  value: listCount(externalRtmpReadiness?.secretRedactionPolicy?.checkedFields),
                },
                {
                  label: "secretRedactionPolicy.detectedSecretLikeValue",
                  value: boolLabel(externalRtmpReadiness?.secretRedactionPolicy?.detectedSecretLikeValue),
                },
                {
                  label: "secretRedactionPolicy.allSecretLikeValuesRedacted",
                  value: boolLabel(externalRtmpReadiness?.secretRedactionPolicy?.allSecretLikeValuesRedacted),
                },
                {
                  label: "dryRunCommandPreview.willExecute",
                  value: boolLabel(externalRtmpReadiness?.dryRunCommandPreview?.willExecute),
                },
                {
                  label: "dryRunCommandPreview.dryRunOnly",
                  value: boolLabel(externalRtmpReadiness?.dryRunCommandPreview?.dryRunOnly),
                },
                {
                  label: "dryRunCommandPreview.realNetworkPush",
                  value: boolLabel(externalRtmpReadiness?.dryRunCommandPreview?.realNetworkPush),
                },
                {
                  label: "dryRunCommandPreview.secretValuesLogged",
                  value: boolLabel(externalRtmpReadiness?.dryRunCommandPreview?.secretValuesLogged),
                },
              ]}
            />
            <SummarySection
              title="Approval and rollback"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "approvalPacket.approvalRequired",
                  value: boolLabel(externalRtmpReadiness?.approvalPacket?.approvalRequired),
                },
                {
                  label: "approvalPacket.acceptedNow",
                  value: boolLabel(externalRtmpReadiness?.approvalPacket?.acceptedNow),
                },
                {
                  label: "approvalPacket.requiredApprovalPhrase",
                  value: textValue(externalRtmpReadiness?.approvalPacket?.requiredApprovalPhrase),
                },
                {
                  label: "approvalPacket.requiredFields",
                  value: listCount(externalRtmpReadiness?.approvalPacket?.requiredFields),
                },
                {
                  label: "rollbackPlan.steps",
                  value: listCount(externalRtmpReadiness?.rollbackPlan?.steps),
                },
                {
                  label: "durationPlan.minimumSmokeSeconds",
                  value: textValue(externalRtmpReadiness?.durationPlan?.minimumSmokeSeconds),
                },
                {
                  label: "durationPlan.maximumSafeSeconds",
                  value: textValue(externalRtmpReadiness?.durationPlan?.maximumSafeSeconds),
                },
              ]}
            />
            <SummarySection
              title="Evidence and boundary"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "evidencePlan.hlsCapturePreferredPath",
                  value: boolLabel(externalRtmpReadiness?.evidencePlan?.hlsCapturePreferredPath),
                },
                {
                  label: "evidencePlan.rtmpDirectRole",
                  value: textValue(externalRtmpReadiness?.evidencePlan?.rtmpDirectRole),
                },
                {
                  label: "artifactFreshnessAudit.artifactExists",
                  value: boolLabel(externalRtmpReadiness?.artifactFreshnessAudit?.artifactExists),
                },
                {
                  label: "artifactFreshnessAudit.currentForRealLikeLocalGate",
                  value: boolLabel(externalRtmpReadiness?.artifactFreshnessAudit?.currentForRealLikeLocalGate),
                },
                { label: "externalPublishExecuted", value: boolLabel(externalRtmpReadiness?.externalPublishExecuted) },
                { label: "customerContentUsed", value: boolLabel(externalRtmpReadiness?.customerContentUsed) },
                { label: "supportOnly", value: boolLabel(externalRtmpReadiness?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(externalRtmpReadiness?.vaultEligible) },
                { label: "confirmed", value: boolLabel(externalRtmpReadiness?.confirmed) },
                { label: "final", value: boolLabel(externalRtmpReadiness?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="external-rtmp-smoke-section">
          <div className="flex items-center gap-2">
            <RadioTower className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">External RTMP Smoke</h2>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum controlled external custom RTMP smoke gate sonucunu okur.
              Env onayi ve approved non-social target yoksa publish yapilmaz.
              Raw secret gostermez ve VAULT/confirmed/final acmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Execution gate"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "phase", value: textValue(externalRtmpSmoke?.phase) },
                {
                  label: "previousReadinessCheckpoint",
                  value: textValue(externalRtmpSmoke?.previousReadinessCheckpoint),
                },
                { label: "readinessPacketPassed", value: boolLabel(externalRtmpSmoke?.readinessPacketPassed) },
                { label: "safetyGateStatus", value: textValue(externalRtmpSmoke?.safetyGateStatus) },
                { label: "missingRequirements", value: listCount(externalRtmpSmoke?.missingRequirements) },
                { label: "approvalEnvEnabled", value: boolLabel(externalRtmpSmoke?.approvalEnvEnabled) },
                { label: "targetUrlPresent", value: boolLabel(externalRtmpSmoke?.targetUrlPresent) },
                { label: "streamKeyPresent", value: boolLabel(externalRtmpSmoke?.streamKeyPresent) },
                { label: "runModeOk", value: boolLabel(externalRtmpSmoke?.runModeOk) },
                {
                  label: "targetSocialPlatformBlocked",
                  value: boolLabel(externalRtmpSmoke?.targetSocialPlatformBlocked),
                },
              ]}
            />
            <SummarySection
              title="Publish and fixture"
              icon={<RadioTower className="w-4 h-4 text-primary" />}
              rows={[
                { label: "externalPublishAttempted", value: boolLabel(externalRtmpSmoke?.externalPublishAttempted) },
                { label: "externalPublishExecuted", value: boolLabel(externalRtmpSmoke?.externalPublishExecuted) },
                { label: "publishDurationSeconds", value: textValue(externalRtmpSmoke?.publishDurationSeconds) },
                { label: "fixture.fixtureId", value: textValue(externalRtmpSmoke?.fixture?.fixtureId) },
                {
                  label: "fixture.sourceBoundary",
                  value: textValue(externalRtmpSmoke?.fixture?.sourceBoundary),
                },
                {
                  label: "fixture.customerContentUsed",
                  value: boolLabel(externalRtmpSmoke?.fixture?.customerContentUsed),
                },
              ]}
            />
            <SummarySection
              title="Evidence and ID-read"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "evidence.artifactNamespace",
                  value: textValue(externalRtmpSmoke?.evidence?.artifactNamespace),
                },
                { label: "evidence.manifestExists", value: boolLabel(externalRtmpSmoke?.evidence?.manifestExists) },
                {
                  label: "hlsVodCapability.capabilityStatus",
                  value: textValue(externalRtmpSmoke?.hlsVodCapability?.capabilityStatus),
                },
                {
                  label: "postLiveReseal.attempted",
                  value: boolLabel(externalRtmpSmoke?.postLiveReseal?.attempted),
                },
                {
                  label: "postLiveReseal.idReadRate",
                  value: textValue(externalRtmpSmoke?.postLiveReseal?.idReadRate),
                },
                {
                  label: "postLiveReseal.wrongIdRejected",
                  value: boolLabel(externalRtmpSmoke?.postLiveReseal?.wrongIdRejected),
                },
                {
                  label: "postLiveReseal.unsealedNoVault",
                  value: boolLabel(externalRtmpSmoke?.postLiveReseal?.unsealedNoVault),
                },
                {
                  label: "evidence.pdfSupportOnly",
                  value: boolLabel(externalRtmpSmoke?.evidence?.pdfSupportOnly),
                },
                {
                  label: "evidence.claimSafetyGuardPassed",
                  value: boolLabel(externalRtmpSmoke?.evidence?.claimSafetyGuardPassed),
                },
              ]}
            />
            <SummarySection
              title="Secret scan and decision boundary"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "securityScan.redactionScanPassed",
                  value: boolLabel(externalRtmpSmoke?.securityScan?.redactionScanPassed),
                },
                {
                  label: "securityScan.rawSecretLeakDetected",
                  value: boolLabel(externalRtmpSmoke?.securityScan?.rawSecretLeakDetected),
                },
                {
                  label: "youtubeFacebookTwitchUsed",
                  value: boolLabel(externalRtmpSmoke?.youtubeFacebookTwitchUsed),
                },
                { label: "customerContentUsed", value: boolLabel(externalRtmpSmoke?.customerContentUsed) },
                { label: "goNoGoRecommendation", value: textValue(externalRtmpSmoke?.goNoGoRecommendation) },
                { label: "supportOnly", value: boolLabel(externalRtmpSmoke?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(externalRtmpSmoke?.vaultEligible) },
                { label: "confirmed", value: boolLabel(externalRtmpSmoke?.confirmed) },
                { label: "final", value: boolLabel(externalRtmpSmoke?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="external-rtmp-target-setup-section">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">External RTMP Target Setup</h2>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum non-social external RTMP target hazirlik gate sonucunu okur.
              Target credentials veya explicit setup env yoksa dis sunucuya baglanilmaz.
              Raw secret gostermez, publish baslatmaz ve VAULT/confirmed/final acmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Target setup gate"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "phase", value: textValue(externalRtmpTargetSetup?.phase) },
                {
                  label: "previousSmokeGateCheckpoint",
                  value: textValue(externalRtmpTargetSetup?.previousSmokeGateCheckpoint),
                },
                {
                  label: "previousSmokeGateInstalled",
                  value: boolLabel(externalRtmpTargetSetup?.previousSmokeGateInstalled),
                },
                { label: "setupStatus", value: textValue(externalRtmpTargetSetup?.setupStatus) },
                { label: "missingRequirements", value: listCount(externalRtmpTargetSetup?.missingRequirements) },
                { label: "approvalEnvEnabled", value: boolLabel(externalRtmpTargetSetup?.approvalEnvEnabled) },
                { label: "targetHostPresent", value: boolLabel(externalRtmpTargetSetup?.targetHostPresent) },
                { label: "sshUserPresent", value: boolLabel(externalRtmpTargetSetup?.sshUserPresent) },
                { label: "authModePresent", value: boolLabel(externalRtmpTargetSetup?.authModePresent) },
                { label: "installModeOk", value: boolLabel(externalRtmpTargetSetup?.installModeOk) },
                {
                  label: "socialPlatformFlagOk",
                  value: boolLabel(externalRtmpTargetSetup?.socialPlatformFlagOk),
                },
                {
                  label: "targetSocialPlatformBlocked",
                  value: boolLabel(externalRtmpTargetSetup?.targetSocialPlatformBlocked),
                },
              ]}
            />
            <SummarySection
              title="Templates and plans"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "templateArtifacts.artifactNamespace",
                  value: textValue(externalRtmpTargetSetup?.templateArtifacts?.artifactNamespace),
                },
                {
                  label: "templateArtifacts.manifestExists",
                  value: boolLabel(externalRtmpTargetSetup?.templateArtifacts?.manifestExists),
                },
                {
                  label: "templateArtifacts.targetConfigTemplateExists",
                  value: boolLabel(externalRtmpTargetSetup?.templateArtifacts?.targetConfigTemplateExists),
                },
                {
                  label: "templateArtifacts.mediaMtxTemplateExists",
                  value: boolLabel(externalRtmpTargetSetup?.templateArtifacts?.mediaMtxTemplateExists),
                },
                {
                  label: "templateArtifacts.redactionPolicyExists",
                  value: boolLabel(externalRtmpTargetSetup?.templateArtifacts?.redactionPolicyExists),
                },
                {
                  label: "templateArtifacts.rollbackPlanExists",
                  value: boolLabel(externalRtmpTargetSetup?.templateArtifacts?.rollbackPlanExists),
                },
                {
                  label: "templateArtifacts.healthcheckPlanExists",
                  value: boolLabel(externalRtmpTargetSetup?.templateArtifacts?.healthcheckPlanExists),
                },
                {
                  label: "targetPlan.selectedDefault",
                  value: textValue(externalRtmpTargetSetup?.targetPlan?.selectedDefault),
                },
                {
                  label: "targetPlan.firewallPorts",
                  value: listCount(externalRtmpTargetSetup?.targetPlan?.firewallPorts),
                },
              ]}
            />
            <SummarySection
              title="Dry-run healthcheck"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "endpointFormatCheck",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.endpointFormatCheck),
                },
                {
                  label: "socialBlocklistCheck",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.socialBlocklistCheck),
                },
                {
                  label: "secretRedactionCheck",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.secretRedactionCheck),
                },
                {
                  label: "hlsOutputPathCheck",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.hlsOutputPathCheck),
                },
                {
                  label: "vodRecordingCapabilityCheck",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.vodRecordingCapabilityCheck),
                },
                {
                  label: "willConnectToExternalHost",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.willConnectToExternalHost),
                },
                {
                  label: "willPublishExternalStream",
                  value: boolLabel(externalRtmpTargetSetup?.dryRunHealthcheckPlan?.willPublishExternalStream),
                },
              ]}
            />
            <SummarySection
              title="Security boundary"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "fullAccessIsNotApproval",
                  value: boolLabel(externalRtmpTargetSetup?.securityBoundary?.fullAccessIsNotApproval),
                },
                {
                  label: "rawSecretLeakDetected",
                  value: boolLabel(externalRtmpTargetSetup?.securityBoundary?.rawSecretLeakDetected),
                },
                {
                  label: "secretValuesStored",
                  value: boolLabel(externalRtmpTargetSetup?.securityBoundary?.secretValuesStored),
                },
                {
                  label: "socialPlatformsBlocked",
                  value: listCount(externalRtmpTargetSetup?.securityBoundary?.socialPlatformsBlocked),
                },
                {
                  label: "hlsCapturePreferredPath",
                  value: boolLabel(externalRtmpTargetSetup?.securityBoundary?.hlsCapturePreferredPath),
                },
                {
                  label: "rtmpDirectRole",
                  value: textValue(externalRtmpTargetSetup?.securityBoundary?.rtmpDirectRole),
                },
                { label: "targetSetupExecuted", value: boolLabel(externalRtmpTargetSetup?.targetSetupExecuted) },
                {
                  label: "externalServerConnectionAttempted",
                  value: boolLabel(externalRtmpTargetSetup?.externalServerConnectionAttempted),
                },
                { label: "externalPublishExecuted", value: boolLabel(externalRtmpTargetSetup?.externalPublishExecuted) },
                { label: "billingResourceCreation", value: boolLabel(externalRtmpTargetSetup?.billingResourceCreation) },
                { label: "customerContentUsed", value: boolLabel(externalRtmpTargetSetup?.customerContentUsed) },
                { label: "goNoGoRecommendation", value: textValue(externalRtmpTargetSetup?.goNoGoRecommendation) },
                { label: "supportOnly", value: boolLabel(externalRtmpTargetSetup?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(externalRtmpTargetSetup?.vaultEligible) },
                { label: "confirmed", value: boolLabel(externalRtmpTargetSetup?.confirmed) },
                { label: "final", value: boolLabel(externalRtmpTargetSetup?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="rtmp-target-credential-preflight-section">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">RTMP Target Credential Preflight</h2>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum credential intake ve safe setup preflight durumunu okur.
              SSH baglantisi, gercek target setup, external publish, billing veya
              production deploy baslatmaz. Raw secret gostermez ve VAULT/confirmed/final acmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Credential preflight"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "phase", value: textValue(rtmpTargetCredentialPreflight?.phase) },
                {
                  label: "previousTargetSetupCheckpoint",
                  value: textValue(rtmpTargetCredentialPreflight?.previousTargetSetupCheckpoint),
                },
                {
                  label: "previousTargetSetupGateInstalled",
                  value: boolLabel(rtmpTargetCredentialPreflight?.previousTargetSetupGateInstalled),
                },
                {
                  label: "credentialPreflightCreated",
                  value: boolLabel(rtmpTargetCredentialPreflight?.credentialPreflightCreated),
                },
                { label: "preflightStatus", value: textValue(rtmpTargetCredentialPreflight?.preflightStatus) },
                { label: "missingRequirements", value: listCount(rtmpTargetCredentialPreflight?.missingRequirements) },
                { label: "nextApprovedPhase", value: textValue(rtmpTargetCredentialPreflight?.nextApprovedPhase) },
                { label: "goNoGoRecommendation", value: textValue(rtmpTargetCredentialPreflight?.goNoGoRecommendation) },
              ]}
            />
            <SummarySection
              title="Env gates"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                { label: "approvalEnvEnabled", value: boolLabel(rtmpTargetCredentialPreflight?.approvalEnvEnabled) },
                { label: "targetHostPresent", value: boolLabel(rtmpTargetCredentialPreflight?.targetHostPresent) },
                { label: "sshUserPresent", value: boolLabel(rtmpTargetCredentialPreflight?.sshUserPresent) },
                { label: "authModePresent", value: boolLabel(rtmpTargetCredentialPreflight?.authModePresent) },
                { label: "installModeOk", value: boolLabel(rtmpTargetCredentialPreflight?.installModeOk) },
                { label: "socialPlatformFlagOk", value: boolLabel(rtmpTargetCredentialPreflight?.socialPlatformFlagOk) },
                { label: "allowBillingOk", value: boolLabel(rtmpTargetCredentialPreflight?.allowBillingOk) },
                { label: "allowProductionOk", value: boolLabel(rtmpTargetCredentialPreflight?.allowProductionOk) },
                { label: "targetPurposeOk", value: boolLabel(rtmpTargetCredentialPreflight?.targetPurposeOk) },
                {
                  label: "targetSocialPlatformBlocked",
                  value: boolLabel(rtmpTargetCredentialPreflight?.targetSocialPlatformBlocked),
                },
              ]}
            />
            <SummarySection
              title="Artifacts"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "artifacts.artifactNamespace",
                  value: textValue(rtmpTargetCredentialPreflight?.artifacts?.artifactNamespace),
                },
                {
                  label: "manifestExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.manifestExists),
                },
                {
                  label: "requiredEnvTemplateExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.requiredEnvTemplateExists),
                },
                {
                  label: "targetCredentialsChecklistExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.targetCredentialsChecklistExists),
                },
                {
                  label: "socialPlatformBlocklistExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.socialPlatformBlocklistExists),
                },
                {
                  label: "sshSecurityChecklistExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.sshSecurityChecklistExists),
                },
                {
                  label: "mediaMtxInstallPreflightExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.mediaMtxInstallPreflightExists),
                },
                {
                  label: "secretRedactionPreflightExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.secretRedactionPreflightExists),
                },
                {
                  label: "goNoGoChecklistExists",
                  value: boolLabel(rtmpTargetCredentialPreflight?.artifacts?.goNoGoChecklistExists),
                },
              ]}
            />
            <SummarySection
              title="Boundary"
              icon={<RadioTower className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "requiredHumanInputs",
                  value: listCount(rtmpTargetCredentialPreflight?.requiredHumanInputs),
                },
                { label: "safeEnvVariables", value: listCount(rtmpTargetCredentialPreflight?.safeEnvVariables) },
                {
                  label: "willConnectToExternalHost",
                  value: boolLabel(rtmpTargetCredentialPreflight?.validationPlan?.willConnectToExternalHost),
                },
                {
                  label: "willPublishExternalStream",
                  value: boolLabel(rtmpTargetCredentialPreflight?.validationPlan?.willPublishExternalStream),
                },
                {
                  label: "realExternalServerConnectionAttempted",
                  value: boolLabel(rtmpTargetCredentialPreflight?.realExternalServerConnectionAttempted),
                },
                {
                  label: "realTargetSetupExecuted",
                  value: boolLabel(rtmpTargetCredentialPreflight?.realTargetSetupExecuted),
                },
                {
                  label: "externalPublishExecuted",
                  value: boolLabel(rtmpTargetCredentialPreflight?.externalPublishExecuted),
                },
                {
                  label: "billingResourceCreation",
                  value: boolLabel(rtmpTargetCredentialPreflight?.billingResourceCreation),
                },
                { label: "productionDeploy", value: boolLabel(rtmpTargetCredentialPreflight?.productionDeploy) },
                { label: "customerContentUsed", value: boolLabel(rtmpTargetCredentialPreflight?.customerContentUsed) },
                {
                  label: "rawSecretLeakDetected",
                  value: boolLabel(rtmpTargetCredentialPreflight?.rawSecretLeakDetected),
                },
                {
                  label: "hlsCapturePreferredPath",
                  value: boolLabel(rtmpTargetCredentialPreflight?.securityBoundary?.hlsCapturePreferredPath),
                },
                {
                  label: "rtmpDirectRole",
                  value: textValue(rtmpTargetCredentialPreflight?.securityBoundary?.rtmpDirectRole),
                },
                { label: "supportOnly", value: boolLabel(rtmpTargetCredentialPreflight?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(rtmpTargetCredentialPreflight?.vaultEligible) },
                { label: "confirmed", value: boolLabel(rtmpTargetCredentialPreflight?.confirmed) },
                { label: "final", value: boolLabel(rtmpTargetCredentialPreflight?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="no-cost-rtmp-target-auto-setup-section">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">No-Cost RTMP Target Auto-Setup</h2>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum local no-cost RTMP/HLS hedef provasini okur. Yeni external publish,
              dis SSH, billing, social platform veya customer content baslatmaz. Endpointler
              redacted gosterilir ve VAULT/confirmed/final acmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Local setup gate"
              icon={<MonitorCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "phase", value: textValue(noCostRtmpTargetAutoSetup?.phase) },
                {
                  label: "previousCredentialPreflightCheckpoint",
                  value: textValue(noCostRtmpTargetAutoSetup?.previousCredentialPreflightCheckpoint),
                },
                {
                  label: "discoveryStatus",
                  value: textValue(noCostRtmpTargetAutoSetup?.localToolingDiscovery?.discoveryStatus),
                },
                {
                  label: "selectedEngine",
                  value: textValue(noCostRtmpTargetAutoSetup?.localToolingDiscovery?.selectedEngine),
                },
                {
                  label: "mediamtxPortableReady",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localToolingDiscovery?.mediamtxPortableReady),
                },
                {
                  label: "ffmpegPortableReady",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localToolingDiscovery?.ffmpegPortableReady),
                },
                {
                  label: "mediamtxConfigReady",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localToolingDiscovery?.mediamtxConfigReady),
                },
                {
                  label: "checkedPorts",
                  value: listCount(noCostRtmpTargetAutoSetup?.localToolingDiscovery?.checkedPorts),
                },
              ]}
            />
            <SummarySection
              title="No-cost rehearsal"
              icon={<RadioTower className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "setupStatus",
                  value: textValue(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.setupStatus),
                },
                {
                  label: "localNoCostTargetSetupVerified",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.localNoCostTargetSetupVerified),
                },
                {
                  label: "reusedExistingLocalSmokeEvidence",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.reusedExistingLocalSmokeEvidence),
                },
                {
                  label: "newLocalProcessStartedNow",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.newLocalProcessStartedNow),
                },
                {
                  label: "localhostOnly",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.localhostOnly),
                },
                {
                  label: "localRtmpEndpointRedacted",
                  value: textValue(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.localRtmpEndpointRedacted),
                },
                {
                  label: "localHlsEndpointRedacted",
                  value: textValue(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.localHlsEndpointRedacted),
                },
                {
                  label: "rawStreamKeyLogged",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.localNoCostTargetSetup?.rawStreamKeyLogged),
                },
              ]}
            />
            <SummarySection
              title="HLS / VOD / ID-read"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "actualSmokeEvidenceAvailable",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.actualSmokeEvidenceAvailable),
                },
                {
                  label: "rtmpPublishObserved",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.rtmpPublishObserved),
                },
                {
                  label: "hlsManifestObserved",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.hlsManifestObserved),
                },
                {
                  label: "hlsSegmentsObserved",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.hlsSegmentsObserved),
                },
                {
                  label: "hlsProbeSucceeded",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.hlsProbeSucceeded),
                },
                {
                  label: "vodCaptureCreated",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.vodCaptureCreated),
                },
                {
                  label: "postLiveResealSucceeded",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.postLiveResealSucceeded),
                },
                {
                  label: "embeddedIdRead",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.embeddedIdRead),
                },
                {
                  label: "wrongIdRejected",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.wrongIdRejected),
                },
                {
                  label: "unsealedNoVault",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.smokeValidation?.unsealedNoVault),
                },
              ]}
            />
            <SummarySection
              title="Boundary and artifacts"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "evidence.artifactNamespace",
                  value: textValue(noCostRtmpTargetAutoSetup?.evidence?.artifactNamespace),
                },
                {
                  label: "evidence.allExpectedArtifactsPresent",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.evidence?.allExpectedArtifactsPresent),
                },
                {
                  label: "evidence.pdfArtifactGenerated",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.evidence?.pdfArtifactGenerated),
                },
                {
                  label: "evidence.claimSafetyGuardPassed",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.evidence?.claimSafetyGuardPassed),
                },
                {
                  label: "billingResourceCreation",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.billingResourceCreation),
                },
                {
                  label: "externalPublishExecuted",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.externalPublishExecuted),
                },
                {
                  label: "externalSshAttempted",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.externalSshAttempted),
                },
                {
                  label: "youtubeFacebookTwitchUsed",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.youtubeFacebookTwitchUsed),
                },
                {
                  label: "customerContentUsed",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.customerContentUsed),
                },
                {
                  label: "rawSecretLeakDetected",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.rawSecretLeakDetected),
                },
                {
                  label: "hlsCapturePreferredPath",
                  value: boolLabel(noCostRtmpTargetAutoSetup?.securityBoundary?.hlsCapturePreferredPath),
                },
                {
                  label: "rtmpDirectRole",
                  value: textValue(noCostRtmpTargetAutoSetup?.securityBoundary?.rtmpDirectRole),
                },
                { label: "goNoGoRecommendation", value: textValue(noCostRtmpTargetAutoSetup?.goNoGoRecommendation) },
                { label: "supportOnly", value: boolLabel(noCostRtmpTargetAutoSetup?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(noCostRtmpTargetAutoSetup?.vaultEligible) },
                { label: "confirmed", value: boolLabel(noCostRtmpTargetAutoSetup?.confirmed) },
                { label: "final", value: boolLabel(noCostRtmpTargetAutoSetup?.final) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="hls-local-evidence-bundle-section">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">HLS Local Evidence Bundle</h2>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu paket local sentetik canlı yayın lab sonuçlarını özetler. Gerçek müşteri içeriği, gerçek dış yayın ve final sahiplik kararı değildir.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="HLS bundle summary"
              icon={<Film className="w-4 h-4 text-primary" />}
              rows={[
                { label: "Preferred path", value: textValue(hlsEvidenceBundle?.preferredPath ?? "HLS capture") },
                { label: "RTMP direct", value: textValue(hlsEvidenceBundle?.rtmpDirect ?? "diagnostic-only") },
                {
                  label: "Post-live re-seal",
                  value: textValue(hlsEvidenceBundle?.postLiveReseal ?? "safest local reseal strategy"),
                },
                { label: "Source", value: textValue(hlsEvidenceBundle?.source ?? "synthetic/local only") },
                {
                  label: "localLabSuccessSummary",
                  value: textValue(hlsEvidenceBundle?.localLabSuccessSummary),
                },
              ]}
            />
            <SummarySection
              title="HLS bundle safety"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "supportOnly", value: boolLabel(hlsEvidenceBundle?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(hlsEvidenceBundle?.vaultEligible) },
                { label: "confirmed", value: boolLabel(hlsEvidenceBundle?.confirmed) },
                { label: "final", value: boolLabel(hlsEvidenceBundle?.final) },
                { label: "decisionRole", value: textValue(hlsEvidenceBundle?.decisionRole) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3" data-testid="live-hls-evidence-report-preview-section">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">Live HLS Evidence Report Preview</h2>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu rapor local sentetik lab evidence özetidir. Gerçek müşteri içeriği veya final hukuki sahiplik kararı değildir.
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Report preview"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                { label: "Report status", value: textValue(hlsEvidenceReport?.reportStatus ?? "pdf_ready_mock") },
                { label: "Source", value: textValue(hlsEvidenceReport?.sourceBoundary ?? "synthetic_local_only") },
                {
                  label: "Preferred path",
                  value: boolLabel(hlsEvidenceReport?.hlsCapturePreferred),
                },
                {
                  label: "RTMP direct diagnostic-only",
                  value: boolLabel(hlsEvidenceReport?.rtmpDirectDiagnosticOnly),
                },
                {
                  label: "Post-live re-seal",
                  value: textValue(hlsEvidenceReport?.postLiveResealStrategy ?? "safest_local_reseal_strategy"),
                },
              ]}
            />
            <SummarySection
              title="Report decision boundary"
              icon={<XCircle className="w-4 h-4 text-sky-600" />}
              rows={[
                { label: "supportOnly", value: boolLabel(hlsEvidenceReport?.supportOnly) },
                { label: "vaultEligible", value: boolLabel(hlsEvidenceReport?.vaultEligible) },
                { label: "confirmed", value: boolLabel(hlsEvidenceReport?.confirmed) },
                { label: "final", value: boolLabel(hlsEvidenceReport?.final) },
                { label: "decisionRole", value: textValue(hlsEvidenceReport?.decisionRole) },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LockKeyhole className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-medium">Secret guvenligi</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {secretFlags.map((flag) => (
              <FlagTile key={flag.label} label={flag.label} value={flag.value} expected={flag.expected} />
            ))}
          </div>
        </div>

        <div className="space-y-3" data-testid="approval-audit-timeline-section">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-medium">Approval Audit Timeline</h2>
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Bu bolum yalnizca onay gecmisi/audit hazirlik ekranidir. Gercek onay almaz,
              gercek smoke test baslatmaz.
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {approvalFlags.map((flag) => (
              <FlagTile key={`approval-${flag.label}`} label={flag.label} value={flag.value} expected={flag.expected} />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Approval timeline"
              icon={<ShieldCheck className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "approvalTimelineSummary.timelineStatus",
                  value: textValue(approvalAudit?.approvalTimelineSummary?.timelineStatus),
                },
                {
                  label: "approvalTimelineSummary.approvalEvents",
                  value: listCount(approvalAudit?.approvalTimelineSummary?.approvalEvents),
                },
                {
                  label: "approvalTimelineSummary.requiredApprovalPhrasePreview",
                  value: textValue(approvalAudit?.approvalTimelineSummary?.requiredApprovalPhrasePreview),
                },
                {
                  label: "approvalTimelineSummary.approvalPhraseAcceptedNow",
                  value: boolLabel(approvalAudit?.approvalTimelineSummary?.approvalPhraseAcceptedNow),
                },
              ]}
            />
            <SummarySection
              title="Approval scope and risk"
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              rows={[
                {
                  label: "approvalScopeSummary.targetTypePreview",
                  value: textValue(approvalAudit?.approvalScopeSummary?.targetTypePreview),
                },
                {
                  label: "approvalScopeSummary.durationLimitPreview",
                  value: textValue(approvalAudit?.approvalScopeSummary?.durationLimitPreview),
                },
                {
                  label: "approvalScopeSummary.rollbackRequired",
                  value: boolLabel(approvalAudit?.approvalScopeSummary?.rollbackRequired),
                },
                {
                  label: "approvalScopeSummary.costApprovalRequired",
                  value: boolLabel(approvalAudit?.approvalScopeSummary?.costApprovalRequired),
                },
                {
                  label: "approvalScopeSummary.securityReviewRequired",
                  value: boolLabel(approvalAudit?.approvalScopeSummary?.securityReviewRequired),
                },
                {
                  label: "riskSnapshotSummary.risks",
                  value: listCount(approvalAudit?.riskSnapshotSummary?.risks),
                },
              ]}
            />
            <SummarySection
              title="Approval learning"
              icon={<Brain className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "liveDnaApprovalLearningSummary.learningRecords",
                  value: listCount(approvalAudit?.liveDnaApprovalLearningSummary?.learningRecords),
                },
                {
                  label: "liveDnaApprovalLearningSummary.autoApprovalEnabled",
                  value: boolLabel(approvalAudit?.liveDnaApprovalLearningSummary?.autoApprovalEnabled),
                },
                {
                  label: "liveDnaApprovalLearningSummary.autoRealSmokeStartEnabled",
                  value: boolLabel(approvalAudit?.liveDnaApprovalLearningSummary?.autoRealSmokeStartEnabled),
                },
                {
                  label: "liveDnaApprovalLearningSummary.autoSecretAcceptEnabled",
                  value: boolLabel(approvalAudit?.liveDnaApprovalLearningSummary?.autoSecretAcceptEnabled),
                },
                {
                  label: "liveDnaApprovalLearningSummary.humanApprovalRequired",
                  value: boolLabel(approvalAudit?.liveDnaApprovalLearningSummary?.humanApprovalRequired),
                },
              ]}
            />
            <SummarySection
              title="Approval Secure Room handoff"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                { label: "decisionRole", value: textValue(approvalAudit?.decisionRole) },
                { label: "realSecretStored", value: boolLabel(approvalAudit?.realSecretStored) },
                { label: "realBroadcastStarted", value: boolLabel(approvalAudit?.realBroadcastStarted) },
                { label: "realApiEnabled", value: boolLabel(approvalAudit?.realApiEnabled) },
                { label: "realPushEnabled", value: boolLabel(approvalAudit?.realPushEnabled) },
              ]}
            />
          </div>
        </div>

        <div
          className="space-y-4 rounded-lg border border-sky-500/30 bg-sky-500/5 p-5"
          data-testid="signed-approval-audit-preview-section"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-600" />
              Signed Approval Audit Preview
            </h2>
            <p className="text-sm text-muted-foreground">
              Bu bolum sadece imzali onay kaydi mimarisinin mock onizlemesidir. Gercek onay almaz,
              gercek imza uretmez, gercek smoke test baslatmaz.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {signedAuditFlags.map((flag) => (
              <FlagTile key={flag.label} {...flag} />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Actor identity preview"
              icon={<ShieldCheck className="w-4 h-4 text-sky-600" />}
              rows={[
                {
                  label: "actorIdentitySummary.actorIdPreview",
                  value: textValue(signedApprovalAudit?.actorIdentitySummary?.actorIdPreview),
                },
                {
                  label: "actorIdentitySummary.actorRolePreview",
                  value: textValue(signedApprovalAudit?.actorIdentitySummary?.actorRolePreview),
                },
                {
                  label: "actorIdentitySummary.actorDisplayNamePreview",
                  value: textValue(signedApprovalAudit?.actorIdentitySummary?.actorDisplayNamePreview),
                },
                {
                  label: "actorIdentitySummary.organizationPreview",
                  value: textValue(signedApprovalAudit?.actorIdentitySummary?.organizationPreview),
                },
                {
                  label: "actorIdentitySummary.identityVerified",
                  value: boolLabel(signedApprovalAudit?.actorIdentitySummary?.identityVerified),
                },
              ]}
            />
            <SummarySection
              title="Signed audit policy"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "signedAuditPolicySummary.appendOnlyPreview",
                  value: boolLabel(signedApprovalAudit?.signedAuditPolicySummary?.appendOnlyPreview),
                },
                {
                  label: "signedAuditPolicySummary.realAppendOnlyStorage",
                  value: boolLabel(signedApprovalAudit?.signedAuditPolicySummary?.realAppendOnlyStorage),
                },
                {
                  label: "signedAuditPolicySummary.realSignatureGenerated",
                  value: boolLabel(signedApprovalAudit?.signedAuditPolicySummary?.realSignatureGenerated),
                },
                {
                  label: "signedAuditPolicySummary.privateKeyUsed",
                  value: boolLabel(signedApprovalAudit?.signedAuditPolicySummary?.privateKeyUsed),
                },
                {
                  label: "signedAuditPolicySummary.deleteAllowed",
                  value: boolLabel(signedApprovalAudit?.signedAuditPolicySummary?.deleteAllowed),
                },
                {
                  label: "signedAuditPolicySummary.updateAllowed",
                  value: boolLabel(signedApprovalAudit?.signedAuditPolicySummary?.updateAllowed),
                },
              ]}
            />
            <SummarySection
              title="Append-only log and hash-chain"
              icon={<Activity className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "appendOnlyLogSummary.entries",
                  value: listCount(signedApprovalAudit?.appendOnlyLogSummary?.entries),
                },
                {
                  label: "hashChainSummary.chainIdPreview",
                  value: textValue(signedApprovalAudit?.hashChainSummary?.chainIdPreview),
                },
                {
                  label: "hashChainSummary.entriesCountPreview",
                  value: textValue(signedApprovalAudit?.hashChainSummary?.entriesCountPreview),
                },
                {
                  label: "hashChainSummary.chainValidPreview",
                  value: boolLabel(signedApprovalAudit?.hashChainSummary?.chainValidPreview),
                },
                {
                  label: "hashChainSummary.tamperDetectedPreview",
                  value: boolLabel(signedApprovalAudit?.hashChainSummary?.tamperDetectedPreview),
                },
                {
                  label: "hashChainSummary.realHashChainStored",
                  value: boolLabel(signedApprovalAudit?.hashChainSummary?.realHashChainStored),
                },
              ]}
            />
            <SummarySection
              title="Signature and immutability"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "signaturePreviewSummary.signatureAlgorithmPreview",
                  value: textValue(signedApprovalAudit?.signaturePreviewSummary?.signatureAlgorithmPreview),
                },
                {
                  label: "signaturePreviewSummary.publicKeyIdPreview",
                  value: textValue(signedApprovalAudit?.signaturePreviewSummary?.publicKeyIdPreview),
                },
                {
                  label: "signaturePreviewSummary.signatureValuePreview",
                  value: textValue(signedApprovalAudit?.signaturePreviewSummary?.signatureValuePreview),
                },
                {
                  label: "signaturePreviewSummary.realSignatureGenerated",
                  value: boolLabel(signedApprovalAudit?.signaturePreviewSummary?.realSignatureGenerated),
                },
                {
                  label: "signaturePreviewSummary.privateKeyUsed",
                  value: boolLabel(signedApprovalAudit?.signaturePreviewSummary?.privateKeyUsed),
                },
                {
                  label: "signaturePreviewSummary.signatureVerifiableNow",
                  value: boolLabel(signedApprovalAudit?.signaturePreviewSummary?.signatureVerifiableNow),
                },
                {
                  label: "immutabilityValidatorSummary.immutablePreviewValid",
                  value: boolLabel(signedApprovalAudit?.immutabilityValidatorSummary?.immutablePreviewValid),
                },
                {
                  label: "immutabilityValidatorSummary.realValidationPerformed",
                  value: boolLabel(signedApprovalAudit?.immutabilityValidatorSummary?.realValidationPerformed),
                },
                {
                  label: "immutabilityValidatorSummary.checks",
                  value: listCount(signedApprovalAudit?.immutabilityValidatorSummary?.checks),
                },
              ]}
            />
            <SummarySection
              title="Signed audit learning"
              icon={<Brain className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "liveDnaApprovalAuditLearningSummary.learningRecords",
                  value: listCount(signedApprovalAudit?.liveDnaApprovalAuditLearningSummary?.learningRecords),
                },
                {
                  label: "liveDnaApprovalAuditLearningSummary.autoApprovalEnabled",
                  value: boolLabel(signedApprovalAudit?.liveDnaApprovalAuditLearningSummary?.autoApprovalEnabled),
                },
                {
                  label: "liveDnaApprovalAuditLearningSummary.autoRealSmokeStartEnabled",
                  value: boolLabel(
                    signedApprovalAudit?.liveDnaApprovalAuditLearningSummary?.autoRealSmokeStartEnabled,
                  ),
                },
                {
                  label: "liveDnaApprovalAuditLearningSummary.autoSecretAcceptEnabled",
                  value: boolLabel(signedApprovalAudit?.liveDnaApprovalAuditLearningSummary?.autoSecretAcceptEnabled),
                },
                {
                  label: "liveDnaApprovalAuditLearningSummary.autoProductionConfigDeployEnabled",
                  value: boolLabel(
                    signedApprovalAudit?.liveDnaApprovalAuditLearningSummary?.autoProductionConfigDeployEnabled,
                  ),
                },
                {
                  label: "liveDnaApprovalAuditLearningSummary.autoApiConnectionEnabled",
                  value: boolLabel(signedApprovalAudit?.liveDnaApprovalAuditLearningSummary?.autoApiConnectionEnabled),
                },
              ]}
            />
            <SummarySection
              title="Signed audit Secure Room handoff"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                { label: "decisionRole", value: textValue(signedApprovalAudit?.decisionRole) },
                { label: "realApprovalGranted", value: boolLabel(signedApprovalAudit?.realApprovalGranted) },
                {
                  label: "realSignatureGenerated",
                  value: boolLabel(signedApprovalAudit?.realSignatureGenerated),
                },
                { label: "privateKeyUsed", value: boolLabel(signedApprovalAudit?.privateKeyUsed) },
                {
                  label: "realAppendOnlyStorage",
                  value: boolLabel(signedApprovalAudit?.realAppendOnlyStorage),
                },
                { label: "realSmokeAllowed", value: boolLabel(signedApprovalAudit?.realSmokeAllowed) },
                {
                  label: "canProceedToRealBroadcast",
                  value: boolLabel(signedApprovalAudit?.canProceedToRealBroadcast),
                },
              ]}
            />
          </div>
        </div>

        <div
          className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-5"
          data-testid="real-smoke-go-no-go-section"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Real Smoke Go / No-Go
            </h2>
            <p className="text-sm text-muted-foreground">
              Bu bolum sadece gercek smoke test oncesi karar paketidir. Gercek onay almaz,
              gercek secret kabul etmez, gercek yayin baslatmaz.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {goNoGoFlags.map((flag) => (
              <FlagTile key={flag.label} {...flag} />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SummarySection
              title="Go / No-Go decision"
              icon={<XCircle className="w-4 h-4 text-red-600" />}
              rows={[
                {
                  label: "decisionPacketSummary.goDecision",
                  value: textValue(realSmokeGoNoGo?.decisionPacketSummary?.goDecision ?? LIVE_REAL_SMOKE_NO_GO_DECISION),
                },
                {
                  label: "decisionPacketSummary.recommendedFirstRealTarget",
                  value: textValue(
                    realSmokeGoNoGo?.decisionPacketSummary?.recommendedFirstRealTarget ?? LIVE_REAL_SMOKE_FIRST_TARGET,
                  ),
                },
                {
                  label: "decisionPacketSummary.youtubeRecommendedAsSecondStep",
                  value: boolLabel(realSmokeGoNoGo?.decisionPacketSummary?.youtubeRecommendedAsSecondStep),
                },
                {
                  label: "decisionPacketSummary.readyForMockReview",
                  value: boolLabel(realSmokeGoNoGo?.decisionPacketSummary?.readyForMockReview),
                },
                {
                  label: "decisionPacketSummary.requiredApprovalPhrase",
                  value: textValue(
                    realSmokeGoNoGo?.decisionPacketSummary?.requiredApprovalPhrase ?? LIVE_REAL_SMOKE_REQUIRED_APPROVAL,
                  ),
                },
              ]}
            />
            <SummarySection
              title="Preflight and blockers"
              icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
              rows={[
                {
                  label: "preflightChecklistSummary.items",
                  value: listCount(realSmokeGoNoGo?.preflightChecklistSummary?.items),
                },
                {
                  label: "preflightChecklistSummary.goDecision",
                  value: textValue(realSmokeGoNoGo?.preflightChecklistSummary?.goDecision),
                },
                {
                  label: "preflightChecklistSummary.readyForRealSmoke",
                  value: boolLabel(realSmokeGoNoGo?.preflightChecklistSummary?.readyForRealSmoke),
                },
                {
                  label: "blockerReportSummary.blockers",
                  value: listCount(realSmokeGoNoGo?.blockerReportSummary?.blockers),
                },
                {
                  label: "blockerReportSummary.readyForRealSmoke",
                  value: boolLabel(realSmokeGoNoGo?.blockerReportSummary?.readyForRealSmoke),
                },
              ]}
            />
            <SummarySection
              title="Required future inputs"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                {
                  label: "requiredInputsSummary.recommendedFirstTarget",
                  value: textValue(realSmokeGoNoGo?.requiredInputsSummary?.recommendedFirstTarget),
                },
                {
                  label: "requiredInputsSummary.approvalPhraseFuture",
                  value: textValue(realSmokeGoNoGo?.requiredInputsSummary?.approvalPhraseFuture),
                },
                {
                  label: "requiredInputsSummary.inputs",
                  value: listCount(realSmokeGoNoGo?.requiredInputsSummary?.inputs),
                },
                {
                  label: "requiredInputsSummary.allRealInputsAcceptedNow",
                  value: boolLabel(realSmokeGoNoGo?.requiredInputsSummary?.allRealInputsAcceptedNow),
                },
                {
                  label: "requiredInputsSummary.realSecretAcceptedNow",
                  value: boolLabel(realSmokeGoNoGo?.requiredInputsSummary?.realSecretAcceptedNow),
                },
              ]}
            />
            <SummarySection
              title="Scenario and rollback"
              icon={<RadioTower className="w-4 h-4 text-primary" />}
              rows={[
                {
                  label: "scenarioPlanSummary.recommendedFirstRealTarget",
                  value: textValue(realSmokeGoNoGo?.scenarioPlanSummary?.recommendedFirstRealTarget),
                },
                {
                  label: "scenarioPlanSummary.youtubeRecommendedAsSecondStep",
                  value: boolLabel(realSmokeGoNoGo?.scenarioPlanSummary?.youtubeRecommendedAsSecondStep),
                },
                {
                  label: "scenarioPlanSummary.scenarios",
                  value: listCount(realSmokeGoNoGo?.scenarioPlanSummary?.scenarios),
                },
                {
                  label: "rollbackPlanSummary.steps",
                  value: listCount(realSmokeGoNoGo?.rollbackPlanSummary?.steps),
                },
                {
                  label: "rollbackPlanSummary.rollbackReadyForRealSmoke",
                  value: boolLabel(realSmokeGoNoGo?.rollbackPlanSummary?.rollbackReadyForRealSmoke),
                },
              ]}
            />
            <SummarySection
              title="Go / No-Go Secure Room handoff"
              icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
              rows={[
                { label: "decisionRole", value: textValue(realSmokeGoNoGo?.decisionRole) },
                { label: "realSmokeAllowed", value: boolLabel(realSmokeGoNoGo?.realSmokeAllowed) },
                {
                  label: "canProceedToRealBroadcast",
                  value: boolLabel(realSmokeGoNoGo?.canProceedToRealBroadcast),
                },
                { label: "realSecretStored", value: boolLabel(realSmokeGoNoGo?.realSecretStored) },
                { label: "realBroadcastStarted", value: boolLabel(realSmokeGoNoGo?.realBroadcastStarted) },
                { label: "realApiEnabled", value: boolLabel(realSmokeGoNoGo?.realApiEnabled) },
                { label: "realPushEnabled", value: boolLabel(realSmokeGoNoGo?.realPushEnabled) },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SummarySection
            title="Operator runbook"
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
            rows={[
              { label: "operatorRunbookSummary.steps", value: listCount(data?.operatorRunbookSummary?.steps) },
              {
                label: "operatorRunbookSummary.readyForRealSmoke",
                value: boolLabel(data?.operatorRunbookSummary?.readyForRealSmoke as boolean | undefined),
              },
              {
                label: "operatorRunbookSummary.realSecretStored",
                value: boolLabel(data?.operatorRunbookSummary?.realSecretStored as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Secret redaction"
            icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
            rows={[
              {
                label: "secretRedactionSummary.detectedSecretLikeValue",
                value: boolLabel(secret?.detectedSecretLikeValue as boolean | undefined),
              },
              {
                label: "secretRedactionSummary.realSecretStored",
                value: boolLabel(secret?.realSecretStored as boolean | undefined),
              },
              {
                label: "secretRedactionSummary.tokenValueExposed",
                value: boolLabel(secret?.tokenValueExposed as boolean | undefined),
              },
              {
                label: "secretRedactionSummary.streamKeyValueExposed",
                value: boolLabel(secret?.streamKeyValueExposed as boolean | undefined),
              },
              {
                label: "secretRedactionSummary.apiKeyValueExposed",
                value: boolLabel(secret?.apiKeyValueExposed as boolean | undefined),
              },
              {
                label: "secretRedactionSummary.oauthTokenValueExposed",
                value: boolLabel(secret?.oauthTokenValueExposed as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Smoke checklist"
            icon={<MonitorCheck className="w-4 h-4 text-primary" />}
            rows={[
              { label: "smokeChecklistSummary.sections", value: listCount(data?.smokeChecklistSummary?.sections) },
              {
                label: "smokeChecklistSummary.readyForMockChecklist",
                value: boolLabel(data?.smokeChecklistSummary?.readyForMockChecklist as boolean | undefined),
              },
              {
                label: "smokeChecklistSummary.readyForRealLab",
                value: boolLabel(data?.smokeChecklistSummary?.readyForRealLab as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Rollback"
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
            rows={[
              { label: "rollbackSummary.steps", value: listCount(data?.rollbackSummary?.steps) },
              {
                label: "rollbackSummary.realRollbackExecuted",
                value: boolLabel(data?.rollbackSummary?.realRollbackExecuted as boolean | undefined),
              },
              {
                label: "rollbackSummary.noVaultFinalImpact",
                value: boolLabel(data?.rollbackSummary?.noVaultFinalImpact as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Target readiness"
            icon={<RadioTower className="w-4 h-4 text-primary" />}
            rows={[
              { label: "targetReadinessSummary.targetCatalog", value: listCount(data?.targetReadinessSummary?.targetCatalog) },
              {
                label: "targetReadinessSummary.realApiEnabled",
                value: boolLabel(data?.targetReadinessSummary?.realApiEnabled as boolean | undefined),
              },
              {
                label: "targetReadinessSummary.realPushEnabled",
                value: boolLabel(data?.targetReadinessSummary?.realPushEnabled as boolean | undefined),
              },
              {
                label: "targetReadinessSummary.streamKeyValueExposed",
                value: boolLabel(data?.targetReadinessSummary?.streamKeyValueExposed as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Player readiness"
            icon={<Film className="w-4 h-4 text-primary" />}
            rows={[
              { label: "playerReadinessSummary.realPlayerLoaded", value: boolLabel(player?.realPlayerLoaded as boolean | undefined) },
              { label: "playerReadinessSummary.realStreamLoaded", value: boolLabel(player?.realStreamLoaded as boolean | undefined) },
              {
                label: "playerReadinessSummary.realPlaybackEnabled",
                value: boolLabel(player?.realPlaybackEnabled as boolean | undefined),
              },
              { label: "playerReadinessSummary.drmEnabled", value: boolLabel(player?.drmEnabled as boolean | undefined) },
            ]}
          />

          <SummarySection
            title="Access readiness"
            icon={<LockKeyhole className="w-4 h-4 text-emerald-600" />}
            rows={[
              { label: "accessReadinessSummary.tokenValueExposed", value: boolLabel(access?.tokenValueExposed as boolean | undefined) },
              {
                label: "accessReadinessSummary.signedUrlSecretExposed",
                value: boolLabel(access?.signedUrlSecretExposed as boolean | undefined),
              },
              { label: "accessReadinessSummary.realAccessEnforced", value: boolLabel(access?.realAccessEnforced as boolean | undefined) },
              { label: "accessReadinessSummary.realTokenGenerated", value: boolLabel(access?.realTokenGenerated as boolean | undefined) },
              {
                label: "accessReadinessSummary.realSignedUrlGenerated",
                value: boolLabel(access?.realSignedUrlGenerated as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Event health"
            icon={<Activity className="w-4 h-4 text-primary" />}
            rows={[
              {
                label: "eventHealthSummary.eventTypeDefinitions",
                value: listCount(eventHealth?.eventTypeDefinitions),
              },
              {
                label: "eventHealthSummary.webhookPayloadPreviews",
                value: listCount(eventHealth?.webhookPayloadPreviews),
              },
              {
                label: "eventHealthSummary.realWebhookSent",
                value: boolLabel(eventHealth?.realWebhookSent as boolean | undefined),
              },
              {
                label: "eventHealthSummary.realNetworkCall",
                value: boolLabel(eventHealth?.realNetworkCall as boolean | undefined),
              },
            ]}
          />

          <SummarySection
            title="Engine readiness"
            icon={<Server className="w-4 h-4 text-primary" />}
            rows={[
              { label: "engineReadinessSummary.realServerStarted", value: boolLabel(engine?.realServerStarted as boolean | undefined) },
              { label: "engineReadinessSummary.realConfigWritten", value: boolLabel(engine?.realConfigWritten as boolean | undefined) },
              { label: "engineReadinessSummary.realPortsOpened", value: boolLabel(engine?.realPortsOpened as boolean | undefined) },
              {
                label: "engineReadinessSummary.compatibilityMatrix.entries",
                value: listCount(engine?.compatibilityMatrix?.entries),
              },
            ]}
          />

          <SummarySection
            title="FFmpeg / VOD"
            icon={<Film className="w-4 h-4 text-primary" />}
            rows={[
              {
                label: "ffmpegVodReadinessSummary.realFfmpegExecuted",
                value: boolLabel(ffmpegVod?.realFfmpegExecuted as boolean | undefined),
              },
              {
                label: "ffmpegVodReadinessSummary.realMediaProcessed",
                value: boolLabel(ffmpegVod?.realMediaProcessed as boolean | undefined),
              },
              {
                label: "ffmpegVodReadinessSummary.recordingPolicy.realRecordingEnabled",
                value: boolLabel(ffmpegVod?.recordingPolicy?.realRecordingEnabled),
              },
            ]}
          />

          <SummarySection
            title="Secure Room"
            icon={<ShieldCheck className="w-4 h-4 text-primary" />}
            rows={[
              { label: "secureRoomSummary.evidenceRole", value: textValue(secureRoom?.evidenceRole) },
              {
                label: "secureRoomSummary.secureRoomHandoffAvailable",
                value: boolLabel(secureRoom?.secureRoomHandoffAvailable as boolean | undefined),
              },
              {
                label: "secureRoomSummary.realEvidenceFromSmokeTest",
                value: boolLabel(secureRoom?.realEvidenceFromSmokeTest as boolean | undefined),
              },
              { label: "secureRoomSummary.vaultEligible", value: boolLabel(secureRoom?.vaultEligible as boolean | undefined) },
              { label: "secureRoomSummary.confirmed", value: boolLabel(secureRoom?.confirmed as boolean | undefined) },
              { label: "secureRoomSummary.final", value: boolLabel(secureRoom?.final as boolean | undefined) },
            ]}
          />

          <SummarySection
            title="Live DNA learning"
            icon={<Brain className="w-4 h-4 text-primary" />}
            rows={[
              {
                label: "liveDnaLearningSummary.autoRealSmokeStartEnabled",
                value: boolLabel(liveDna?.autoRealSmokeStartEnabled as boolean | undefined),
              },
              {
                label: "liveDnaLearningSummary.autoSecretAcceptEnabled",
                value: boolLabel(liveDna?.autoSecretAcceptEnabled as boolean | undefined),
              },
              {
                label: "liveDnaLearningSummary.autoConfigDeployEnabled",
                value: boolLabel(liveDna?.autoConfigDeployEnabled as boolean | undefined),
              },
              {
                label: "liveDnaLearningSummary.autoApiConnectionEnabled",
                value: boolLabel(liveDna?.autoApiConnectionEnabled as boolean | undefined),
              },
              {
                label: "liveDnaLearningSummary.operatorLearning.learningRecords",
                value: listCount(liveDna?.operatorLearning?.learningRecords),
              },
            ]}
          />
        </div>
      </div>
    </AdminGuard>
  );
}
