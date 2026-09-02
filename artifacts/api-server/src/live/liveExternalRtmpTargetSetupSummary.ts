import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getLiveExternalRtmpSmokeSummary } from "./liveExternalRtmpSmokeSummary";

export const LIVE_EXTERNAL_RTMP_TARGET_SETUP_ROLE =
  "live_external_rtmp_target_setup_gate_support_only_no_vault_no_confirmed" as const;

export const LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE =
  "mediamtx_or_srs_test_only" as const;

export const LIVE_EXTERNAL_RTMP_TARGET_SETUP_NAMESPACE =
  "runtime/validation/live_external_rtmp_target_setup/" as const;

export const LIVE_EXTERNAL_RTMP_TARGET_SETUP_BLOCKLIST = [
  "youtube",
  "youtu.be",
  "facebook",
  "fbcdn",
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

type TargetSetupStatus =
  | "needs_target_credentials"
  | "blocked_social_target"
  | "ready_for_manual_target_setup_review_not_executed";

export interface LiveExternalRtmpTargetSetupSummary {
  phase: "external_non_social_rtmp_target_setup_gate";
  previousSmokeGateCheckpoint: "29e422c";
  previousSmokeGateInstalled: boolean;
  approvalEnvRequired: "TANCMARK_APPROVE_RTMP_TARGET_SETUP=true";
  installModeRequired: typeof LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE;
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  targetSocialPlatformBlocked: boolean;
  targetHostRedacted: string;
  setupStatus: TargetSetupStatus;
  missingRequirements: string[];
  targetSetupAttempted: false;
  targetSetupExecuted: false;
  externalServerConnectionAttempted: false;
  externalPublishAttempted: false;
  externalPublishExecuted: false;
  productionDeploy: false;
  billingResourceCreation: false;
  customerContentUsed: false;
  youtubeFacebookTwitchUsed: false;
  realSecretAcceptedNow: false;
  templateArtifacts: {
    artifactNamespace: typeof LIVE_EXTERNAL_RTMP_TARGET_SETUP_NAMESPACE;
    manifestPath: "runtime/validation/live_external_rtmp_target_setup/manifest.json";
    targetConfigTemplatePath: "runtime/validation/live_external_rtmp_target_setup/target_config_template.redacted.json";
    mediaMtxTemplatePath: "runtime/validation/live_external_rtmp_target_setup/mediamtx_test_config_template.yml";
    redactionPolicyPath: "runtime/validation/live_external_rtmp_target_setup/redaction_policy.md";
    rollbackPlanPath: "runtime/validation/live_external_rtmp_target_setup/rollback_plan.md";
    healthcheckPlanPath: "runtime/validation/live_external_rtmp_target_setup/target_healthcheck_plan.md";
    manifestExists: boolean;
    targetConfigTemplateExists: boolean;
    mediaMtxTemplateExists: boolean;
    redactionPolicyExists: boolean;
    rollbackPlanExists: boolean;
    healthcheckPlanExists: boolean;
    manifestSha256: string | null;
  };
  targetPlan: {
    preferredEngines: ["MediaMTX", "SRS"];
    selectedDefault: "MediaMTX";
    selectionReason: string;
    rtmpIngestPlan: string;
    hlsOutputPlan: string;
    vodRecordingPlan: string;
    firewallPorts: Array<{ port: number; protocol: "tcp"; purpose: string; publicExposure: "test_only_minimized" }>;
    disposableTargetRequired: true;
    cleanupRequired: true;
  };
  dryRunHealthcheckPlan: {
    endpointFormatCheck: true;
    socialBlocklistCheck: true;
    secretRedactionCheck: true;
    hlsOutputPathCheck: true;
    vodRecordingCapabilityCheck: true;
    stopCleanupPlanCheck: true;
    willConnectToExternalHost: false;
    willPublishExternalStream: false;
  };
  securityBoundary: {
    fullAccessIsNotApproval: true;
    rawSecretLeakDetected: false;
    rawHostLogged: false;
    rawStreamKeyLogged: false;
    rawTokenLogged: false;
    secretValuesStored: false;
    socialPlatformsBlocked: readonly string[];
    hlsCapturePreferredPath: true;
    rtmpDirectRole: "diagnostic_only";
  };
  goNoGoRecommendation:
    | "NO_GO_NEEDS_TARGET_CREDENTIALS"
    | "NO_GO_SOCIAL_TARGET_BLOCKED"
    | "READY_FOR_SEPARATE_MANUAL_TARGET_SETUP_GATE";
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EXTERNAL_RTMP_TARGET_SETUP_ROLE;
  codexSuggestions: string[];
}

function envValue(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function fileExists(pathValue: string): boolean {
  return existsSync(resolve(pathValue));
}

function fileSha256(pathValue: string): string | null {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) return null;
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function redactedHost(value: string): string {
  if (!value) return "<missing>";
  const normalized = value.toLowerCase();
  const hostHash = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `<redacted-host-sha256:${hostHash}>`;
}

function isBlockedSocialTarget(value: string): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return LIVE_EXTERNAL_RTMP_TARGET_SETUP_BLOCKLIST.some((fragment) => lowered.includes(fragment));
}

function setupStatus(input: {
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  targetSocialPlatformBlocked: boolean;
}): TargetSetupStatus {
  if (input.targetSocialPlatformBlocked) return "blocked_social_target";
  if (
    !input.approvalEnvEnabled ||
    !input.targetHostPresent ||
    !input.sshUserPresent ||
    !input.authModePresent ||
    !input.installModeOk ||
    !input.socialPlatformFlagOk
  ) {
    return "needs_target_credentials";
  }
  return "ready_for_manual_target_setup_review_not_executed";
}

function missingRequirements(input: {
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  targetSocialPlatformBlocked: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.approvalEnvEnabled) missing.push("TANCMARK_APPROVE_RTMP_TARGET_SETUP=true");
  if (!input.targetHostPresent) missing.push("TANCMARK_RTMP_TARGET_HOST");
  if (!input.sshUserPresent) missing.push("TANCMARK_RTMP_TARGET_SSH_USER");
  if (!input.authModePresent) missing.push("TANCMARK_RTMP_TARGET_AUTH_MODE");
  if (!input.installModeOk) {
    missing.push(`TANCMARK_RTMP_TARGET_INSTALL_MODE=${LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE}`);
  }
  if (!input.socialPlatformFlagOk) missing.push("TANCMARK_RTMP_TARGET_SOCIAL_PLATFORM=false");
  if (input.targetSocialPlatformBlocked) missing.push("target_must_not_be_social_platform");
  return missing;
}

function goNoGo(status: TargetSetupStatus): LiveExternalRtmpTargetSetupSummary["goNoGoRecommendation"] {
  if (status === "blocked_social_target") return "NO_GO_SOCIAL_TARGET_BLOCKED";
  if (status === "ready_for_manual_target_setup_review_not_executed") {
    return "READY_FOR_SEPARATE_MANUAL_TARGET_SETUP_GATE";
  }
  return "NO_GO_NEEDS_TARGET_CREDENTIALS";
}

export function getLiveExternalRtmpTargetSetupSummary(): LiveExternalRtmpTargetSetupSummary {
  const previousSmoke = getLiveExternalRtmpSmokeSummary();
  const targetHost = envValue("TANCMARK_RTMP_TARGET_HOST");
  const approvalEnvEnabled = envValue("TANCMARK_APPROVE_RTMP_TARGET_SETUP") === "true";
  const targetHostPresent = targetHost.length > 0;
  const sshUserPresent = envValue("TANCMARK_RTMP_TARGET_SSH_USER").length > 0;
  const authModePresent = envValue("TANCMARK_RTMP_TARGET_AUTH_MODE").length > 0;
  const installModeOk = envValue("TANCMARK_RTMP_TARGET_INSTALL_MODE") === LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE;
  const socialPlatformFlagOk = envValue("TANCMARK_RTMP_TARGET_SOCIAL_PLATFORM") === "false";
  const targetSocialPlatformBlocked = isBlockedSocialTarget(targetHost);
  const status = setupStatus({
    approvalEnvEnabled,
    targetHostPresent,
    sshUserPresent,
    authModePresent,
    installModeOk,
    socialPlatformFlagOk,
    targetSocialPlatformBlocked,
  });

  return {
    phase: "external_non_social_rtmp_target_setup_gate",
    previousSmokeGateCheckpoint: "29e422c",
    previousSmokeGateInstalled:
      previousSmoke.previousReadinessCheckpoint === "5faa146" &&
      previousSmoke.supportOnly &&
      !previousSmoke.vaultEligible &&
      !previousSmoke.confirmed &&
      !previousSmoke.final,
    approvalEnvRequired: "TANCMARK_APPROVE_RTMP_TARGET_SETUP=true",
    installModeRequired: LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE,
    approvalEnvEnabled,
    targetHostPresent,
    sshUserPresent,
    authModePresent,
    installModeOk,
    socialPlatformFlagOk,
    targetSocialPlatformBlocked,
    targetHostRedacted: redactedHost(targetHost),
    setupStatus: status,
    missingRequirements: missingRequirements({
      approvalEnvEnabled,
      targetHostPresent,
      sshUserPresent,
      authModePresent,
      installModeOk,
      socialPlatformFlagOk,
      targetSocialPlatformBlocked,
    }),
    targetSetupAttempted: false,
    targetSetupExecuted: false,
    externalServerConnectionAttempted: false,
    externalPublishAttempted: false,
    externalPublishExecuted: false,
    productionDeploy: false,
    billingResourceCreation: false,
    customerContentUsed: false,
    youtubeFacebookTwitchUsed: false,
    realSecretAcceptedNow: false,
    templateArtifacts: {
      artifactNamespace: LIVE_EXTERNAL_RTMP_TARGET_SETUP_NAMESPACE,
      manifestPath: "runtime/validation/live_external_rtmp_target_setup/manifest.json",
      targetConfigTemplatePath:
        "runtime/validation/live_external_rtmp_target_setup/target_config_template.redacted.json",
      mediaMtxTemplatePath: "runtime/validation/live_external_rtmp_target_setup/mediamtx_test_config_template.yml",
      redactionPolicyPath: "runtime/validation/live_external_rtmp_target_setup/redaction_policy.md",
      rollbackPlanPath: "runtime/validation/live_external_rtmp_target_setup/rollback_plan.md",
      healthcheckPlanPath: "runtime/validation/live_external_rtmp_target_setup/target_healthcheck_plan.md",
      manifestExists: fileExists("runtime/validation/live_external_rtmp_target_setup/manifest.json"),
      targetConfigTemplateExists: fileExists(
        "runtime/validation/live_external_rtmp_target_setup/target_config_template.redacted.json",
      ),
      mediaMtxTemplateExists: fileExists(
        "runtime/validation/live_external_rtmp_target_setup/mediamtx_test_config_template.yml",
      ),
      redactionPolicyExists: fileExists("runtime/validation/live_external_rtmp_target_setup/redaction_policy.md"),
      rollbackPlanExists: fileExists("runtime/validation/live_external_rtmp_target_setup/rollback_plan.md"),
      healthcheckPlanExists: fileExists("runtime/validation/live_external_rtmp_target_setup/target_healthcheck_plan.md"),
      manifestSha256: fileSha256("runtime/validation/live_external_rtmp_target_setup/manifest.json"),
    },
    targetPlan: {
      preferredEngines: ["MediaMTX", "SRS"],
      selectedDefault: "MediaMTX",
      selectionReason:
        "MediaMTX is the simplest disposable first target for RTMP ingest plus HLS output; SRS remains the stronger later engine candidate.",
      rtmpIngestPlan: "rtmp://<REDACTED_HOST>:1935/live/<REDACTED_STREAM_KEY>",
      hlsOutputPlan: "http://<REDACTED_HOST>:8888/live/<REDACTED_STREAM_KEY>/index.m3u8",
      vodRecordingPlan: "recordings stay disabled until a separate approved target run enables disposable test storage.",
      firewallPorts: [
        { port: 1935, protocol: "tcp", purpose: "RTMP ingest", publicExposure: "test_only_minimized" },
        { port: 8888, protocol: "tcp", purpose: "HLS playback probe", publicExposure: "test_only_minimized" },
        { port: 9997, protocol: "tcp", purpose: "local/admin health API if explicitly enabled", publicExposure: "test_only_minimized" },
      ],
      disposableTargetRequired: true,
      cleanupRequired: true,
    },
    dryRunHealthcheckPlan: {
      endpointFormatCheck: true,
      socialBlocklistCheck: true,
      secretRedactionCheck: true,
      hlsOutputPathCheck: true,
      vodRecordingCapabilityCheck: true,
      stopCleanupPlanCheck: true,
      willConnectToExternalHost: false,
      willPublishExternalStream: false,
    },
    securityBoundary: {
      fullAccessIsNotApproval: true,
      rawSecretLeakDetected: false,
      rawHostLogged: false,
      rawStreamKeyLogged: false,
      rawTokenLogged: false,
      secretValuesStored: false,
      socialPlatformsBlocked: LIVE_EXTERNAL_RTMP_TARGET_SETUP_BLOCKLIST,
      hlsCapturePreferredPath: true,
      rtmpDirectRole: "diagnostic_only",
    },
    goNoGoRecommendation: goNoGo(status),
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EXTERNAL_RTMP_TARGET_SETUP_ROLE,
    codexSuggestions: ["Bu faz icin ek oneri yok."],
  };
}
