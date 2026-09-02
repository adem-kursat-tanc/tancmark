import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getLiveActualLocalHlsPlaybackVodResult } from "./liveActualLocalHlsPlaybackVodResult";
import { getLiveActualLocalSmokeTestResult } from "./liveActualLocalSmokeTestResult";
import { getLiveE2ELocalLiveVodResealIdReadResult } from "./liveE2ELocalLiveVodResealIdReadResult";
import { getLiveFfmpegInstallReadiness } from "./liveFfmpegInstallReadiness";
import { getLiveHlsEvidencePdfArtifactExport } from "./liveHlsEvidencePdfArtifactExport";
import { getLiveMediaMtxInstallReadiness } from "./liveMediaMtxInstallReadiness";

export const LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_ROLE =
  "live_no_cost_rtmp_target_auto_setup_support_only_no_vault_no_confirmed" as const;

export const LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_NAMESPACE =
  "runtime/validation/live_no_cost_rtmp_target/" as const;

export interface LiveNoCostRtmpTargetAutoSetupSummary {
  phase: "no_cost_autonomous_rtmp_target_auto_setup_gate";
  previousCredentialPreflightCheckpoint: "71802e3";
  userPreference: {
    userDoesNotWantCredentialEntry: true;
    userDoesNotWantCost: true;
    fullAccessIsNotApproval: true;
  };
  localToolingDiscovery: {
    discoveryStatus: "portable_local_tooling_ready" | "missing_local_tooling";
    selectedEngine: "MediaMTX";
    selectedReason: string;
    mediamtxPortableReady: boolean;
    ffmpegPortableReady: boolean;
    ffprobeAssumedWithFfmpegPortable: boolean;
    mediaMtxPathStatus: string;
    ffmpegPathStatus: string;
    mediamtxConfigReady: boolean;
    checkedPorts: number[];
  };
  localNoCostTargetSetup: {
    setupStatus: "validated_from_existing_local_rehearsal_evidence" | "missing_local_tooling";
    localNoCostTargetSetupVerified: boolean;
    newLocalProcessStartedNow: false;
    reusedExistingLocalSmokeEvidence: boolean;
    localhostOnly: true;
    localRtmpEndpointRedacted: "rtmp://127.0.0.1:1935/tancmark/<redacted_local_test_key>";
    localHlsEndpointRedacted: "http://127.0.0.1:8888/tancmark/index.m3u8";
    rawStreamKeyLogged: false;
    targetIsSocialPlatform: false;
  };
  smokeValidation: {
    actualSmokeEvidenceAvailable: boolean;
    targetType: "custom_rtmp";
    engine: "mediamtx";
    mediaSource: "synthetic";
    durationSeconds: number;
    rtmpPublishObserved: boolean;
    hlsManifestObserved: boolean;
    hlsSegmentsObserved: boolean;
    hlsProbeSucceeded: boolean;
    hlsReadableByFfmpegOrFfprobe: boolean;
    vodCaptureCreated: boolean;
    vodCaptureDurationSeconds: number;
    postLiveResealSucceeded: boolean;
    embeddedIdRead: boolean;
    idMatchExpectedLabRecord: boolean;
    wrongIdRejected: boolean;
    unsealedNoVault: boolean;
    candidateDoesNotOpenVault: boolean;
  };
  evidence: {
    artifactNamespace: typeof LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_NAMESPACE;
    manifestPath: "runtime/validation/live_no_cost_rtmp_target/manifest.json";
    localToolingDiscoveryPath: "runtime/validation/live_no_cost_rtmp_target/local_tooling_discovery.json";
    mediaMtxLocalConfigPath: "runtime/validation/live_no_cost_rtmp_target/mediamtx_local_test_config.yml";
    redactedLocalEndpointsPath: "runtime/validation/live_no_cost_rtmp_target/redacted_local_endpoints.json";
    hlsProbeResultPath: "runtime/validation/live_no_cost_rtmp_target/hls_probe_result.json";
    vodCaptureResultPath: "runtime/validation/live_no_cost_rtmp_target/vod_capture_result.json";
    postLiveResealResultPath: "runtime/validation/live_no_cost_rtmp_target/post_live_reseal_result.json";
    negativeTestsResultPath: "runtime/validation/live_no_cost_rtmp_target/negative_tests_result.json";
    secretRedactionScanResultPath: "runtime/validation/live_no_cost_rtmp_target/secret_redaction_scan_result.json";
    rollbackCleanupResultPath: "runtime/validation/live_no_cost_rtmp_target/rollback_cleanup_result.json";
    reportPath: "docs/TANCMARK_LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_REPORT.md";
    pdfArtifactPath: string;
    pdfArtifactGenerated: boolean;
    claimSafetyGuardPassed: boolean;
    manifestExists: boolean;
    manifestSha256: string | null;
    allExpectedArtifactsPresent: boolean;
  };
  securityBoundary: {
    billingResourceCreation: false;
    externalPublishExecuted: false;
    externalSshAttempted: false;
    externalServerConnectionAttempted: false;
    youtubeFacebookTwitchUsed: false;
    customerContentUsed: false;
    copyrightedMediaUsed: false;
    productionDeploy: false;
    rawSecretLeakDetected: false;
    realApiEnabled: false;
    realPushEnabled: false;
    hlsCapturePreferredPath: true;
    rtmpDirectRole: "diagnostic_only";
    coreWatermarkLogicChanged: false;
    vaultDecisionChanged: false;
    thresholdChanged: false;
    ownershipPreSealChanged: false;
    dnaDecisionGateChanged: false;
  };
  nextGate: {
    realExternalTestStillRequiresNonSocialExternalTarget: true;
    socialPlatformsDeferred: true;
    customerContentDeferred: true;
    legalFinalEvidenceDeferred: true;
  };
  goNoGoRecommendation: "LOCAL_NO_COST_REHEARSAL_VERIFIED_EXTERNAL_TEST_STILL_DEFERRED" | "NO_GO_MISSING_LOCAL_TOOLING";
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_ROLE;
  codexSuggestions: string[];
}

function fileExists(pathValue: string): boolean {
  return existsSync(resolve(pathValue));
}

function fileSha256(pathValue: string): string | null {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) return null;
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function allArtifactsPresent(): boolean {
  return [
    "runtime/validation/live_no_cost_rtmp_target/manifest.json",
    "runtime/validation/live_no_cost_rtmp_target/local_tooling_discovery.json",
    "runtime/validation/live_no_cost_rtmp_target/mediamtx_local_test_config.yml",
    "runtime/validation/live_no_cost_rtmp_target/redacted_local_endpoints.json",
    "runtime/validation/live_no_cost_rtmp_target/hls_probe_result.json",
    "runtime/validation/live_no_cost_rtmp_target/vod_capture_result.json",
    "runtime/validation/live_no_cost_rtmp_target/post_live_reseal_result.json",
    "runtime/validation/live_no_cost_rtmp_target/negative_tests_result.json",
    "runtime/validation/live_no_cost_rtmp_target/secret_redaction_scan_result.json",
    "runtime/validation/live_no_cost_rtmp_target/rollback_cleanup_result.json",
  ].every(fileExists);
}

export function getLiveNoCostRtmpTargetAutoSetupSummary(): LiveNoCostRtmpTargetAutoSetupSummary {
  const mediamtx = getLiveMediaMtxInstallReadiness();
  const ffmpeg = getLiveFfmpegInstallReadiness();
  const smoke = getLiveActualLocalSmokeTestResult();
  const hlsVod = getLiveActualLocalHlsPlaybackVodResult();
  const e2e = getLiveE2ELocalLiveVodResealIdReadResult();
  const pdf = getLiveHlsEvidencePdfArtifactExport();
  const toolingReady = mediamtx.portableBinaryPrepared && mediamtx.configReady && ffmpeg.portableBinaryAvailable;
  const localEvidenceReady =
    toolingReady &&
    smoke.actualSmokeExecuted &&
    smoke.localOnly &&
    smoke.rtmpPublishObserved &&
    smoke.hlsManifestObserved &&
    hlsVod.hlsProbeSucceeded &&
    hlsVod.vodCaptureCreated &&
    e2e.postLiveResealSucceeded &&
    e2e.embeddedIdRead &&
    e2e.wrongIdRejected &&
    e2e.unstampedInputNoVault;

  return {
    phase: "no_cost_autonomous_rtmp_target_auto_setup_gate",
    previousCredentialPreflightCheckpoint: "71802e3",
    userPreference: {
      userDoesNotWantCredentialEntry: true,
      userDoesNotWantCost: true,
      fullAccessIsNotApproval: true,
    },
    localToolingDiscovery: {
      discoveryStatus: toolingReady ? "portable_local_tooling_ready" : "missing_local_tooling",
      selectedEngine: "MediaMTX",
      selectedReason:
        "MediaMTX is already available as portable local tooling and provides RTMP ingest plus HLS output without cloud billing.",
      mediamtxPortableReady: mediamtx.portableBinaryPrepared,
      ffmpegPortableReady: ffmpeg.portableBinaryAvailable,
      ffprobeAssumedWithFfmpegPortable: true,
      mediaMtxPathStatus: mediamtx.pathStatus,
      ffmpegPathStatus: ffmpeg.pathStatus,
      mediamtxConfigReady: mediamtx.configReady,
      checkedPorts: mediamtx.requiredPorts,
    },
    localNoCostTargetSetup: {
      setupStatus: localEvidenceReady ? "validated_from_existing_local_rehearsal_evidence" : "missing_local_tooling",
      localNoCostTargetSetupVerified: localEvidenceReady,
      newLocalProcessStartedNow: false,
      reusedExistingLocalSmokeEvidence: localEvidenceReady,
      localhostOnly: true,
      localRtmpEndpointRedacted: "rtmp://127.0.0.1:1935/tancmark/<redacted_local_test_key>",
      localHlsEndpointRedacted: "http://127.0.0.1:8888/tancmark/index.m3u8",
      rawStreamKeyLogged: false,
      targetIsSocialPlatform: false,
    },
    smokeValidation: {
      actualSmokeEvidenceAvailable: localEvidenceReady,
      targetType: "custom_rtmp",
      engine: "mediamtx",
      mediaSource: "synthetic",
      durationSeconds: smoke.durationSeconds,
      rtmpPublishObserved: smoke.rtmpPublishObserved,
      hlsManifestObserved: smoke.hlsManifestObserved,
      hlsSegmentsObserved: smoke.hlsSegmentsObserved,
      hlsProbeSucceeded: hlsVod.hlsProbeSucceeded,
      hlsReadableByFfmpegOrFfprobe: hlsVod.hlsReadableByFfmpegOrFfprobe,
      vodCaptureCreated: hlsVod.vodCaptureCreated,
      vodCaptureDurationSeconds: hlsVod.vodCaptureDurationSeconds,
      postLiveResealSucceeded: e2e.postLiveResealSucceeded,
      embeddedIdRead: e2e.embeddedIdRead,
      idMatchExpectedLabRecord: e2e.idMatchExpectedLabRecord,
      wrongIdRejected: e2e.wrongIdRejected,
      unsealedNoVault: e2e.unstampedInputNoVault,
      candidateDoesNotOpenVault: e2e.candidateDoesNotOpenVault,
    },
    evidence: {
      artifactNamespace: LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_NAMESPACE,
      manifestPath: "runtime/validation/live_no_cost_rtmp_target/manifest.json",
      localToolingDiscoveryPath: "runtime/validation/live_no_cost_rtmp_target/local_tooling_discovery.json",
      mediaMtxLocalConfigPath: "runtime/validation/live_no_cost_rtmp_target/mediamtx_local_test_config.yml",
      redactedLocalEndpointsPath: "runtime/validation/live_no_cost_rtmp_target/redacted_local_endpoints.json",
      hlsProbeResultPath: "runtime/validation/live_no_cost_rtmp_target/hls_probe_result.json",
      vodCaptureResultPath: "runtime/validation/live_no_cost_rtmp_target/vod_capture_result.json",
      postLiveResealResultPath: "runtime/validation/live_no_cost_rtmp_target/post_live_reseal_result.json",
      negativeTestsResultPath: "runtime/validation/live_no_cost_rtmp_target/negative_tests_result.json",
      secretRedactionScanResultPath: "runtime/validation/live_no_cost_rtmp_target/secret_redaction_scan_result.json",
      rollbackCleanupResultPath: "runtime/validation/live_no_cost_rtmp_target/rollback_cleanup_result.json",
      reportPath: "docs/TANCMARK_LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_REPORT.md",
      pdfArtifactPath: pdf.pdfArtifactPath,
      pdfArtifactGenerated: pdf.pdfArtifactGenerated,
      claimSafetyGuardPassed: pdf.claimSafetyGuardPassedBeforeRender && pdf.claimSafetyGuardPassedAfterRender,
      manifestExists: fileExists("runtime/validation/live_no_cost_rtmp_target/manifest.json"),
      manifestSha256: fileSha256("runtime/validation/live_no_cost_rtmp_target/manifest.json"),
      allExpectedArtifactsPresent: allArtifactsPresent(),
    },
    securityBoundary: {
      billingResourceCreation: false,
      externalPublishExecuted: false,
      externalSshAttempted: false,
      externalServerConnectionAttempted: false,
      youtubeFacebookTwitchUsed: false,
      customerContentUsed: false,
      copyrightedMediaUsed: false,
      productionDeploy: false,
      rawSecretLeakDetected: false,
      realApiEnabled: false,
      realPushEnabled: false,
      hlsCapturePreferredPath: true,
      rtmpDirectRole: "diagnostic_only",
      coreWatermarkLogicChanged: false,
      vaultDecisionChanged: false,
      thresholdChanged: false,
      ownershipPreSealChanged: false,
      dnaDecisionGateChanged: false,
    },
    nextGate: {
      realExternalTestStillRequiresNonSocialExternalTarget: true,
      socialPlatformsDeferred: true,
      customerContentDeferred: true,
      legalFinalEvidenceDeferred: true,
    },
    goNoGoRecommendation: localEvidenceReady
      ? "LOCAL_NO_COST_REHEARSAL_VERIFIED_EXTERNAL_TEST_STILL_DEFERRED"
      : "NO_GO_MISSING_LOCAL_TOOLING",
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_NO_COST_RTMP_TARGET_AUTO_SETUP_ROLE,
    codexSuggestions: ["Bu faz icin ek oneri yok."],
  };
}
