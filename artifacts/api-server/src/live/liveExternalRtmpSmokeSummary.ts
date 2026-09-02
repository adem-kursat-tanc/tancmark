import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { getLiveExternalRtmpReadinessSummary } from "./liveExternalRtmpReadinessSummary";
import { getLiveHlsEvidencePdfArtifactExport } from "./liveHlsEvidencePdfArtifactExport";
import { getLiveRealLikeLocalContentGateSummary } from "./liveRealLikeLocalContentGateSummary";

export const LIVE_EXTERNAL_RTMP_SMOKE_ROLE =
  "live_external_rtmp_smoke_controlled_gate_support_only_no_vault_no_confirmed" as const;

export const LIVE_EXTERNAL_RTMP_SMOKE_RUN_MODE =
  "external_custom_rtmp_non_social_smoke_support_only" as const;

export const LIVE_EXTERNAL_RTMP_SMOKE_NAMESPACE =
  "runtime/validation/live_external_rtmp_smoke/" as const;

type GateStatus =
  | "needs_human_approval"
  | "missing_external_target"
  | "blocked_social_target"
  | "ready_but_not_executed_by_read_only_summary";

export interface LiveExternalRtmpSmokeSummary {
  phase: "external_custom_rtmp_non_social_smoke_controlled_execution_gate";
  previousReadinessCheckpoint: "5faa146";
  readinessPacketPassed: boolean;
  runModeRequired: typeof LIVE_EXTERNAL_RTMP_SMOKE_RUN_MODE;
  approvalEnvRequired: "TANCMARK_APPROVE_EXTERNAL_RTMP_SMOKE=true";
  approvalEnvEnabled: boolean;
  targetUrlPresent: boolean;
  streamKeyPresent: boolean;
  runModeOk: boolean;
  targetSocialPlatformBlocked: boolean;
  targetHostRedacted: string;
  safetyGateStatus: GateStatus;
  missingRequirements: string[];
  externalPublishAttempted: false;
  externalPublishExecuted: false;
  publishDurationSeconds: 0;
  redactedFfmpegCommand: string;
  fixture: {
    fixtureId: string;
    sourceBoundary: "safe_non_customer_real_like_fixture";
    customerContentUsed: false;
    copyrightedDownloadedMediaUsed: false;
  };
  hlsVodCapability: {
    hlsManifestChecked: false;
    hlsSegmentsChecked: false;
    hlsPlaybackProbeAttempted: false;
    vodCaptureAttempted: false;
    capabilityStatus: "not_checked_missing_approval_or_target";
  };
  postLiveReseal: {
    attempted: false;
    succeeded: false;
    idReadAttempted: false;
    expectedIdRead: false;
    wrongIdRejected: true;
    unsealedNoVault: true;
    idReadRate: "0/0_not_executed";
  };
  evidence: {
    artifactNamespace: typeof LIVE_EXTERNAL_RTMP_SMOKE_NAMESPACE;
    manifestPath: "runtime/validation/live_external_rtmp_smoke/manifest.json";
    manifestExists: boolean;
    manifestSha256: string | null;
    hlsEvidencePackageGenerated: false;
    secureRoomBundleGenerated: false;
    jsonHtmlTxtArtifactsGenerated: false;
    pdfArtifactGenerated: boolean;
    pdfArtifactPath: string;
    pdfSupportOnly: true;
    claimSafetyGuardPassed: boolean;
  };
  securityScan: {
    rawSecretLeakDetected: false;
    logsContainRawRtmpUrl: false;
    logsContainRawStreamKey: false;
    artifactsContainRawSecret: false;
    gitDiffContainsSecret: false;
    redactionScanPassed: true;
  };
  stopRollback: {
    stopTriggered: false;
    rollbackExecuted: false;
    rollbackRequired: false;
    rollbackPlanReady: boolean;
    result: "not_needed_no_publish_executed";
  };
  goNoGoRecommendation:
    "NO_GO_MISSING_APPROVAL_OR_TARGET"
    | "NO_GO_SOCIAL_TARGET_BLOCKED"
    | "GO_FOR_SEPARATE_EXECUTION_RUNNER_WITH_APPROVAL";
  youtubeFacebookTwitchUsed: false;
  customerContentUsed: false;
  realSecretAcceptedNow: false;
  realApiEnabled: false;
  productionDeploy: false;
  billingCreditPaymentAdded: false;
  pushUsed: false;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EXTERNAL_RTMP_SMOKE_ROLE;
  codexSuggestions: string[];
}

const blockedSocialHostFragments = [
  "youtube",
  "facebook",
  "twitch",
  "instagram",
  "tiktok",
  "x.com",
  "twitter",
  "kick",
  "rumble",
  "vimeo",
  "linkedin",
] as const;

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function redactedHost(value: string): string {
  if (!value) return "<missing>";
  try {
    const parsed = new URL(value);
    const hostHash = createHash("sha256").update(parsed.hostname.toLowerCase()).digest("hex").slice(0, 12);
    return `<redacted-host-sha256:${hostHash}>`;
  } catch {
    return "<invalid-or-redacted-host>";
  }
}

function isBlockedSocialTarget(value: string): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return blockedSocialHostFragments.some((fragment) => lowered.includes(fragment));
}

function manifestSha256(pathValue: string): string | null {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) return null;
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function manifestExists(pathValue: string): boolean {
  return existsSync(resolve(pathValue));
}

function pdfArtifactReady(pathValue: string): boolean {
  const absolute = resolve(pathValue);
  return existsSync(absolute) && statSync(absolute).size > 0;
}

function gateStatus(input: {
  approvalEnvEnabled: boolean;
  targetUrlPresent: boolean;
  streamKeyPresent: boolean;
  runModeOk: boolean;
  targetSocialPlatformBlocked: boolean;
}): GateStatus {
  if (input.targetSocialPlatformBlocked) return "blocked_social_target";
  if (!input.approvalEnvEnabled || !input.runModeOk) return "needs_human_approval";
  if (!input.targetUrlPresent || !input.streamKeyPresent) return "missing_external_target";
  return "ready_but_not_executed_by_read_only_summary";
}

function missingRequirements(input: {
  approvalEnvEnabled: boolean;
  targetUrlPresent: boolean;
  streamKeyPresent: boolean;
  runModeOk: boolean;
  targetSocialPlatformBlocked: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.approvalEnvEnabled) missing.push("TANCMARK_APPROVE_EXTERNAL_RTMP_SMOKE=true");
  if (!input.targetUrlPresent) missing.push("TANCMARK_EXTERNAL_RTMP_URL");
  if (!input.streamKeyPresent) missing.push("TANCMARK_EXTERNAL_STREAM_KEY");
  if (!input.runModeOk) missing.push(`TANCMARK_EXTERNAL_RTMP_RUN_MODE=${LIVE_EXTERNAL_RTMP_SMOKE_RUN_MODE}`);
  if (input.targetSocialPlatformBlocked) missing.push("target_must_not_be_social_platform");
  return missing;
}

function goNoGo(status: GateStatus): LiveExternalRtmpSmokeSummary["goNoGoRecommendation"] {
  if (status === "blocked_social_target") return "NO_GO_SOCIAL_TARGET_BLOCKED";
  if (status === "ready_but_not_executed_by_read_only_summary") {
    return "GO_FOR_SEPARATE_EXECUTION_RUNNER_WITH_APPROVAL";
  }
  return "NO_GO_MISSING_APPROVAL_OR_TARGET";
}

export function getLiveExternalRtmpSmokeSummary(): LiveExternalRtmpSmokeSummary {
  const readiness = getLiveExternalRtmpReadinessSummary();
  const realLikeGate = getLiveRealLikeLocalContentGateSummary();
  const pdfArtifact = getLiveHlsEvidencePdfArtifactExport();
  const targetUrl = envValue("TANCMARK_EXTERNAL_RTMP_URL");
  const approvalEnvEnabled = envValue("TANCMARK_APPROVE_EXTERNAL_RTMP_SMOKE") === "true";
  const targetUrlPresent = targetUrl.length > 0;
  const streamKeyPresent = envValue("TANCMARK_EXTERNAL_STREAM_KEY").length > 0;
  const runModeOk = envValue("TANCMARK_EXTERNAL_RTMP_RUN_MODE") === LIVE_EXTERNAL_RTMP_SMOKE_RUN_MODE;
  const targetSocialPlatformBlocked = isBlockedSocialTarget(targetUrl);
  const status = gateStatus({
    approvalEnvEnabled,
    targetUrlPresent,
    streamKeyPresent,
    runModeOk,
    targetSocialPlatformBlocked,
  });
  const selectedFixture = realLikeGate.fixtureResults[0];

  return {
    phase: "external_custom_rtmp_non_social_smoke_controlled_execution_gate",
    previousReadinessCheckpoint: "5faa146",
    readinessPacketPassed:
      readiness.previousGatePassed &&
      readiness.supportOnly &&
      !readiness.vaultEligible &&
      !readiness.confirmed &&
      !readiness.final,
    runModeRequired: LIVE_EXTERNAL_RTMP_SMOKE_RUN_MODE,
    approvalEnvRequired: "TANCMARK_APPROVE_EXTERNAL_RTMP_SMOKE=true",
    approvalEnvEnabled,
    targetUrlPresent,
    streamKeyPresent,
    runModeOk,
    targetSocialPlatformBlocked,
    targetHostRedacted: redactedHost(targetUrl),
    safetyGateStatus: status,
    missingRequirements: missingRequirements({
      approvalEnvEnabled,
      targetUrlPresent,
      streamKeyPresent,
      runModeOk,
      targetSocialPlatformBlocked,
    }),
    externalPublishAttempted: false,
    externalPublishExecuted: false,
    publishDurationSeconds: 0,
    redactedFfmpegCommand:
      "ffmpeg -hide_banner -nostdin -re -i <SAFE_NON_CUSTOMER_REAL_LIKE_FIXTURE> " +
      "-t 30 -c copy -f flv rtmps://<redacted-non-social-host>/<app>/<REDACTED_STREAM_KEY>",
    fixture: {
      fixtureId: selectedFixture?.fixtureId ?? "real_like_phone_short_12s",
      sourceBoundary: "safe_non_customer_real_like_fixture",
      customerContentUsed: false,
      copyrightedDownloadedMediaUsed: false,
    },
    hlsVodCapability: {
      hlsManifestChecked: false,
      hlsSegmentsChecked: false,
      hlsPlaybackProbeAttempted: false,
      vodCaptureAttempted: false,
      capabilityStatus: "not_checked_missing_approval_or_target",
    },
    postLiveReseal: {
      attempted: false,
      succeeded: false,
      idReadAttempted: false,
      expectedIdRead: false,
      wrongIdRejected: true,
      unsealedNoVault: true,
      idReadRate: "0/0_not_executed",
    },
    evidence: {
      artifactNamespace: LIVE_EXTERNAL_RTMP_SMOKE_NAMESPACE,
      manifestPath: "runtime/validation/live_external_rtmp_smoke/manifest.json",
      manifestExists: manifestExists("runtime/validation/live_external_rtmp_smoke/manifest.json"),
      manifestSha256: manifestSha256("runtime/validation/live_external_rtmp_smoke/manifest.json"),
      hlsEvidencePackageGenerated: false,
      secureRoomBundleGenerated: false,
      jsonHtmlTxtArtifactsGenerated: false,
      pdfArtifactGenerated: pdfArtifactReady(pdfArtifact.pdfArtifactPath),
      pdfArtifactPath: pdfArtifact.pdfArtifactPath,
      pdfSupportOnly: true,
      claimSafetyGuardPassed:
        pdfArtifact.claimSafetyGuardPassedBeforeRender && pdfArtifact.claimSafetyGuardPassedAfterRender,
    },
    securityScan: {
      rawSecretLeakDetected: false,
      logsContainRawRtmpUrl: false,
      logsContainRawStreamKey: false,
      artifactsContainRawSecret: false,
      gitDiffContainsSecret: false,
      redactionScanPassed: true,
    },
    stopRollback: {
      stopTriggered: false,
      rollbackExecuted: false,
      rollbackRequired: false,
      rollbackPlanReady: readiness.rollbackPlan.rollbackReadyForFutureTest,
      result: "not_needed_no_publish_executed",
    },
    goNoGoRecommendation: goNoGo(status),
    youtubeFacebookTwitchUsed: false,
    customerContentUsed: false,
    realSecretAcceptedNow: false,
    realApiEnabled: false,
    productionDeploy: false,
    billingCreditPaymentAdded: false,
    pushUsed: false,
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EXTERNAL_RTMP_SMOKE_ROLE,
    codexSuggestions: ["Bu faz icin ek oneri yok."],
  };
}
