import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  LIVE_EXTERNAL_RTMP_TARGET_SETUP_BLOCKLIST,
  LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE,
  getLiveExternalRtmpTargetSetupSummary,
} from "./liveExternalRtmpTargetSetupSummary";

export const LIVE_RTMP_TARGET_CREDENTIAL_PREFLIGHT_ROLE =
  "live_rtmp_target_credential_preflight_support_only_no_vault_no_confirmed" as const;

export const LIVE_RTMP_TARGET_CREDENTIAL_PREFLIGHT_NAMESPACE =
  "runtime/validation/live_rtmp_target_credential_preflight/" as const;

type PreflightStatus =
  | "needs_credentials_and_human_approval"
  | "blocked_social_target"
  | "ready_for_next_approved_target_setup_gate_not_executed";

export interface LiveRtmpTargetCredentialPreflightSummary {
  phase: "rtmp_target_credential_intake_safe_setup_preflight";
  previousTargetSetupCheckpoint: "eda930e";
  previousTargetSetupGateInstalled: boolean;
  credentialPreflightCreated: true;
  approvalEnvRequired: "TANCMARK_APPROVE_RTMP_TARGET_SETUP=true";
  installModeRequired: typeof LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE;
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
  preflightStatus: PreflightStatus;
  missingRequirements: string[];
  nextApprovedPhase: "approved_non_social_rtmp_target_setup";
  realExternalServerConnectionAttempted: false;
  realTargetSetupExecuted: false;
  externalPublishExecuted: false;
  billingResourceCreation: false;
  productionDeploy: false;
  customerContentUsed: false;
  youtubeFacebookTwitchUsed: false;
  rawSecretLeakDetected: false;
  artifacts: {
    artifactNamespace: typeof LIVE_RTMP_TARGET_CREDENTIAL_PREFLIGHT_NAMESPACE;
    manifestPath: "runtime/validation/live_rtmp_target_credential_preflight/manifest.json";
    requiredEnvTemplatePath: "runtime/validation/live_rtmp_target_credential_preflight/required_env_template.redacted.env";
    targetCredentialsChecklistPath: "runtime/validation/live_rtmp_target_credential_preflight/target_credentials_checklist.md";
    socialPlatformBlocklistPath: "runtime/validation/live_rtmp_target_credential_preflight/social_platform_blocklist.md";
    sshSecurityChecklistPath: "runtime/validation/live_rtmp_target_credential_preflight/ssh_security_checklist.md";
    mediaMtxInstallPreflightPath: "runtime/validation/live_rtmp_target_credential_preflight/mediamtx_install_preflight.md";
    secretRedactionPreflightPath: "runtime/validation/live_rtmp_target_credential_preflight/secret_redaction_preflight.md";
    goNoGoChecklistPath: "runtime/validation/live_rtmp_target_credential_preflight/go_no_go_checklist.md";
    manifestExists: boolean;
    requiredEnvTemplateExists: boolean;
    targetCredentialsChecklistExists: boolean;
    socialPlatformBlocklistExists: boolean;
    sshSecurityChecklistExists: boolean;
    mediaMtxInstallPreflightExists: boolean;
    secretRedactionPreflightExists: boolean;
    goNoGoChecklistExists: boolean;
    manifestSha256: string | null;
  };
  requiredHumanInputs: string[];
  safeEnvVariables: string[];
  validationPlan: {
    socialPlatformBlocklistCheck: true;
    redactedEnvTemplateCheck: true;
    hostRedactionCheck: true;
    sshAuthModeReview: true;
    billingMustRemainFalse: true;
    productionMustRemainFalse: true;
    hlsOutputRequired: true;
    vodRecordingCapabilityRequired: true;
    cleanupRollbackRequired: true;
    willConnectToExternalHost: false;
    willPublishExternalStream: false;
  };
  securityBoundary: {
    fullAccessIsNotApproval: true;
    rawHostStored: false;
    rawSshUserStored: false;
    rawSecretStored: false;
    rawStreamKeyStored: false;
    socialPlatformsBlocked: readonly string[];
    hlsCapturePreferredPath: true;
    rtmpDirectRole: "diagnostic_only";
  };
  goNoGoRecommendation:
    | "NO_GO_NEEDS_CREDENTIALS_AND_HUMAN_APPROVAL"
    | "NO_GO_SOCIAL_TARGET_BLOCKED"
    | "READY_FOR_NEXT_APPROVED_TARGET_SETUP_GATE";
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_RTMP_TARGET_CREDENTIAL_PREFLIGHT_ROLE;
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

function status(input: {
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  allowBillingOk: boolean;
  allowProductionOk: boolean;
  targetPurposeOk: boolean;
  targetSocialPlatformBlocked: boolean;
}): PreflightStatus {
  if (input.targetSocialPlatformBlocked) return "blocked_social_target";
  if (
    !input.approvalEnvEnabled ||
    !input.targetHostPresent ||
    !input.sshUserPresent ||
    !input.authModePresent ||
    !input.installModeOk ||
    !input.socialPlatformFlagOk ||
    !input.allowBillingOk ||
    !input.allowProductionOk ||
    !input.targetPurposeOk
  ) {
    return "needs_credentials_and_human_approval";
  }
  return "ready_for_next_approved_target_setup_gate_not_executed";
}

function missing(input: {
  approvalEnvEnabled: boolean;
  targetHostPresent: boolean;
  sshUserPresent: boolean;
  authModePresent: boolean;
  installModeOk: boolean;
  socialPlatformFlagOk: boolean;
  allowBillingOk: boolean;
  allowProductionOk: boolean;
  targetPurposeOk: boolean;
  targetSocialPlatformBlocked: boolean;
}): string[] {
  const items: string[] = [];
  if (!input.approvalEnvEnabled) items.push("TANCMARK_APPROVE_RTMP_TARGET_SETUP=true");
  if (!input.targetHostPresent) items.push("TANCMARK_RTMP_TARGET_HOST");
  if (!input.sshUserPresent) items.push("TANCMARK_RTMP_TARGET_SSH_USER");
  if (!input.authModePresent) items.push("TANCMARK_RTMP_TARGET_AUTH_MODE");
  if (!input.installModeOk) items.push(`TANCMARK_RTMP_TARGET_INSTALL_MODE=${LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE}`);
  if (!input.socialPlatformFlagOk) items.push("TANCMARK_RTMP_TARGET_SOCIAL_PLATFORM=false");
  if (!input.allowBillingOk) items.push("TANCMARK_RTMP_TARGET_ALLOW_BILLING=false");
  if (!input.allowProductionOk) items.push("TANCMARK_RTMP_TARGET_ALLOW_PRODUCTION=false");
  if (!input.targetPurposeOk) items.push("TANCMARK_RTMP_TARGET_PURPOSE=external_non_social_smoke_test_only");
  if (input.targetSocialPlatformBlocked) items.push("target_must_not_be_social_platform");
  return items;
}

function goNoGo(input: PreflightStatus): LiveRtmpTargetCredentialPreflightSummary["goNoGoRecommendation"] {
  if (input === "blocked_social_target") return "NO_GO_SOCIAL_TARGET_BLOCKED";
  if (input === "ready_for_next_approved_target_setup_gate_not_executed") {
    return "READY_FOR_NEXT_APPROVED_TARGET_SETUP_GATE";
  }
  return "NO_GO_NEEDS_CREDENTIALS_AND_HUMAN_APPROVAL";
}

export function getLiveRtmpTargetCredentialPreflightSummary(): LiveRtmpTargetCredentialPreflightSummary {
  const previousTargetSetup = getLiveExternalRtmpTargetSetupSummary();
  const targetHost = envValue("TANCMARK_RTMP_TARGET_HOST");
  const approvalEnvEnabled = envValue("TANCMARK_APPROVE_RTMP_TARGET_SETUP") === "true";
  const targetHostPresent = targetHost.length > 0;
  const sshUserPresent = envValue("TANCMARK_RTMP_TARGET_SSH_USER").length > 0;
  const authModePresent = envValue("TANCMARK_RTMP_TARGET_AUTH_MODE").length > 0;
  const installModeOk = envValue("TANCMARK_RTMP_TARGET_INSTALL_MODE") === LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE;
  const socialPlatformFlagOk = envValue("TANCMARK_RTMP_TARGET_SOCIAL_PLATFORM") === "false";
  const allowBillingOk = envValue("TANCMARK_RTMP_TARGET_ALLOW_BILLING") === "false";
  const allowProductionOk = envValue("TANCMARK_RTMP_TARGET_ALLOW_PRODUCTION") === "false";
  const targetPurposeOk = envValue("TANCMARK_RTMP_TARGET_PURPOSE") === "external_non_social_smoke_test_only";
  const smokeApprovalEnvEnabled = envValue("TANCMARK_APPROVE_EXTERNAL_RTMP_SMOKE") === "true";
  const smokeUrlPresent = envValue("TANCMARK_EXTERNAL_RTMP_URL").length > 0;
  const smokeStreamKeyPresent = envValue("TANCMARK_EXTERNAL_STREAM_KEY").length > 0;
  const smokeRunModeOk =
    envValue("TANCMARK_RUN_MODE") === "external_custom_rtmp_non_social_smoke_support_only" ||
    envValue("TANCMARK_EXTERNAL_RTMP_RUN_MODE") === "external_custom_rtmp_non_social_smoke_support_only";
  const targetSocialPlatformBlocked = isBlockedSocialTarget(targetHost);
  const preflightStatus = status({
    approvalEnvEnabled,
    targetHostPresent,
    sshUserPresent,
    authModePresent,
    installModeOk,
    socialPlatformFlagOk,
    allowBillingOk,
    allowProductionOk,
    targetPurposeOk,
    targetSocialPlatformBlocked,
  });

  return {
    phase: "rtmp_target_credential_intake_safe_setup_preflight",
    previousTargetSetupCheckpoint: "eda930e",
    previousTargetSetupGateInstalled:
      previousTargetSetup.previousSmokeGateCheckpoint === "29e422c" &&
      previousTargetSetup.supportOnly &&
      !previousTargetSetup.vaultEligible &&
      !previousTargetSetup.confirmed &&
      !previousTargetSetup.final,
    credentialPreflightCreated: true,
    approvalEnvRequired: "TANCMARK_APPROVE_RTMP_TARGET_SETUP=true",
    installModeRequired: LIVE_EXTERNAL_RTMP_TARGET_SETUP_INSTALL_MODE,
    approvalEnvEnabled,
    targetHostPresent,
    sshUserPresent,
    authModePresent,
    installModeOk,
    socialPlatformFlagOk,
    allowBillingOk,
    allowProductionOk,
    targetPurposeOk,
    smokeApprovalEnvEnabled,
    smokeUrlPresent,
    smokeStreamKeyPresent,
    smokeRunModeOk,
    targetSocialPlatformBlocked,
    targetHostRedacted: redactedHost(targetHost),
    preflightStatus,
    missingRequirements: missing({
      approvalEnvEnabled,
      targetHostPresent,
      sshUserPresent,
      authModePresent,
      installModeOk,
      socialPlatformFlagOk,
      allowBillingOk,
      allowProductionOk,
      targetPurposeOk,
      targetSocialPlatformBlocked,
    }),
    nextApprovedPhase: "approved_non_social_rtmp_target_setup",
    realExternalServerConnectionAttempted: false,
    realTargetSetupExecuted: false,
    externalPublishExecuted: false,
    billingResourceCreation: false,
    productionDeploy: false,
    customerContentUsed: false,
    youtubeFacebookTwitchUsed: false,
    rawSecretLeakDetected: false,
    artifacts: {
      artifactNamespace: LIVE_RTMP_TARGET_CREDENTIAL_PREFLIGHT_NAMESPACE,
      manifestPath: "runtime/validation/live_rtmp_target_credential_preflight/manifest.json",
      requiredEnvTemplatePath: "runtime/validation/live_rtmp_target_credential_preflight/required_env_template.redacted.env",
      targetCredentialsChecklistPath:
        "runtime/validation/live_rtmp_target_credential_preflight/target_credentials_checklist.md",
      socialPlatformBlocklistPath:
        "runtime/validation/live_rtmp_target_credential_preflight/social_platform_blocklist.md",
      sshSecurityChecklistPath: "runtime/validation/live_rtmp_target_credential_preflight/ssh_security_checklist.md",
      mediaMtxInstallPreflightPath:
        "runtime/validation/live_rtmp_target_credential_preflight/mediamtx_install_preflight.md",
      secretRedactionPreflightPath:
        "runtime/validation/live_rtmp_target_credential_preflight/secret_redaction_preflight.md",
      goNoGoChecklistPath: "runtime/validation/live_rtmp_target_credential_preflight/go_no_go_checklist.md",
      manifestExists: fileExists("runtime/validation/live_rtmp_target_credential_preflight/manifest.json"),
      requiredEnvTemplateExists: fileExists(
        "runtime/validation/live_rtmp_target_credential_preflight/required_env_template.redacted.env",
      ),
      targetCredentialsChecklistExists: fileExists(
        "runtime/validation/live_rtmp_target_credential_preflight/target_credentials_checklist.md",
      ),
      socialPlatformBlocklistExists: fileExists(
        "runtime/validation/live_rtmp_target_credential_preflight/social_platform_blocklist.md",
      ),
      sshSecurityChecklistExists: fileExists(
        "runtime/validation/live_rtmp_target_credential_preflight/ssh_security_checklist.md",
      ),
      mediaMtxInstallPreflightExists: fileExists(
        "runtime/validation/live_rtmp_target_credential_preflight/mediamtx_install_preflight.md",
      ),
      secretRedactionPreflightExists: fileExists(
        "runtime/validation/live_rtmp_target_credential_preflight/secret_redaction_preflight.md",
      ),
      goNoGoChecklistExists: fileExists("runtime/validation/live_rtmp_target_credential_preflight/go_no_go_checklist.md"),
      manifestSha256: fileSha256("runtime/validation/live_rtmp_target_credential_preflight/manifest.json"),
    },
    requiredHumanInputs: [
      "approved_non_social_disposable_target_host",
      "approved_test_only_ssh_user",
      "approved_auth_mode_without_logging_secret_value",
      "confirmation_target_is_not_social_platform",
      "confirmation_billing_false",
      "confirmation_production_false",
      "rollback_owner",
      "test_window",
    ],
    safeEnvVariables: [
      "TANCMARK_APPROVE_RTMP_TARGET_SETUP",
      "TANCMARK_RTMP_TARGET_HOST",
      "TANCMARK_RTMP_TARGET_SSH_USER",
      "TANCMARK_RTMP_TARGET_AUTH_MODE",
      "TANCMARK_RTMP_TARGET_INSTALL_MODE",
      "TANCMARK_RTMP_TARGET_SOCIAL_PLATFORM",
      "TANCMARK_RTMP_TARGET_PURPOSE",
      "TANCMARK_RTMP_TARGET_ALLOW_BILLING",
      "TANCMARK_RTMP_TARGET_ALLOW_PRODUCTION",
      "TANCMARK_APPROVE_EXTERNAL_RTMP_SMOKE",
      "TANCMARK_EXTERNAL_RTMP_URL",
      "TANCMARK_EXTERNAL_STREAM_KEY",
      "TANCMARK_RUN_MODE",
    ],
    validationPlan: {
      socialPlatformBlocklistCheck: true,
      redactedEnvTemplateCheck: true,
      hostRedactionCheck: true,
      sshAuthModeReview: true,
      billingMustRemainFalse: true,
      productionMustRemainFalse: true,
      hlsOutputRequired: true,
      vodRecordingCapabilityRequired: true,
      cleanupRollbackRequired: true,
      willConnectToExternalHost: false,
      willPublishExternalStream: false,
    },
    securityBoundary: {
      fullAccessIsNotApproval: true,
      rawHostStored: false,
      rawSshUserStored: false,
      rawSecretStored: false,
      rawStreamKeyStored: false,
      socialPlatformsBlocked: LIVE_EXTERNAL_RTMP_TARGET_SETUP_BLOCKLIST,
      hlsCapturePreferredPath: true,
      rtmpDirectRole: "diagnostic_only",
    },
    goNoGoRecommendation: goNoGo(preflightStatus),
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_RTMP_TARGET_CREDENTIAL_PREFLIGHT_ROLE,
    codexSuggestions: ["Bu faz icin ek oneri yok."],
  };
}
