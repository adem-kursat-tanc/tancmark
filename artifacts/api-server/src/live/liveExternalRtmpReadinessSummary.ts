import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { buildLiveSecretRedactionDryRunForm } from "./liveSecretRedactionDryRunForm";
import { getLiveHlsEvidencePdfArtifactExport } from "./liveHlsEvidencePdfArtifactExport";
import { getLiveRealLikeLocalContentGateSummary } from "./liveRealLikeLocalContentGateSummary";
import { LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE } from "./liveRealSmokeGoNoGoPolicy";

export const LIVE_EXTERNAL_RTMP_READINESS_ROLE =
  "live_external_rtmp_readiness_approval_packet_read_only_no_vault_no_confirmed" as const;

export const LIVE_EXTERNAL_RTMP_APPROVAL_PHRASE =
  "APPROVE_EXTERNAL_CUSTOM_RTMP_NON_SOCIAL_SMOKE" as const;

export interface LiveExternalRtmpReadinessSummary {
  phase: "external_custom_rtmp_non_social_target_readiness_approval_packet";
  readinessStatus: "ready_for_human_review_not_ready_for_auto_publish";
  previousGateCheckpoint: "ff783a7";
  previousGatePassed: boolean;
  targetType: "custom_rtmp";
  targetSocialPlatform: false;
  youtubeUsed: false;
  facebookUsed: false;
  twitchUsed: false;
  customerContentUsed: false;
  externalPublishExecuted: false;
  realSecretAcceptedNow: false;
  realApiEnabled: false;
  productionDeploy: false;
  billingCreditPaymentAdded: false;
  pushUsed: false;
  placeholderTargetConfig: {
    configStatus: "placeholder_only_no_real_secret";
    providerLabel: "non_social_custom_rtmp_placeholder";
    rtmpUrlPlaceholder: string;
    streamKeyPlaceholder: string;
    authHeaderPlaceholder: string;
    hostnamePlaceholder: string;
    ipAllowlistPlaceholder: string;
    tokenPlaceholder: string;
    realValuesAcceptedNow: false;
    socialPlatformAllowed: false;
  };
  secretRedactionPolicy: {
    checkedFields: string[];
    detectedSecretLikeValue: boolean;
    allSecretLikeValuesRedacted: boolean;
    storageAllowed: false;
    logAllowed: false;
    realSecretStored: false;
    redactedFields: Array<{ fieldName: string; redactedValue: string }>;
    decisionRole: string;
  };
  dryRunCommandPreview: {
    commandKind: "external_custom_rtmp_publish_preview";
    binary: "ffmpeg";
    redactedCommandPreview: string;
    willExecute: false;
    dryRunOnly: true;
    usesRealTarget: false;
    realNetworkPush: false;
    secretValuesLogged: false;
    targetUrlRedacted: true;
    streamKeyRedacted: true;
  };
  fixtureSelection: {
    selectedFixtureId: string;
    fixtureSourceBoundary: "safe_non_customer_real_like_fixture";
    customerContentAllowed: false;
    copyrightedDownloadedMediaAllowed: false;
    rationale: string;
  };
  durationPlan: {
    minimumSmokeSeconds: 30;
    maximumSafeSeconds: 120;
    stopConditions: string[];
  };
  rollbackPlan: {
    rollbackReadyForFutureTest: boolean;
    steps: string[];
  };
  evidencePlan: {
    hlsCapturePreferredPath: true;
    rtmpDirectRole: "diagnostic_only";
    postLiveResealRequired: true;
    idReadRequired: true;
    wrongIdNegativeRequired: true;
    unsealedNegativeRequired: true;
    supportOnlyArtifacts: ["json", "html", "txt", "pdf"];
    pdfSupportOnly: true;
  };
  approvalPacket: {
    approvalRequired: true;
    acceptedNow: false;
    requiredApprovalPhrase: typeof LIVE_EXTERNAL_RTMP_APPROVAL_PHRASE;
    legacyRealSmokeApprovalPhrase: typeof LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE;
    requiredFields: string[];
    nonSocialTargetVerification: string[];
  };
  goNoGoCriteria: string[];
  artifactFreshnessAudit: {
    pdfArtifactPath: string;
    artifactExists: boolean;
    artifactSizeBytes: number;
    artifactSha256: string | null;
    artifactMtimeIso: string | null;
    freshnessBasis: "path_size_sha256_mtime";
    pathNamePotentiallyConfusing: boolean;
    currentForRealLikeLocalGate: boolean;
    recommendedFutureArtifactDirectory: "runtime/validation/live_external_rtmp_readiness/";
    note: string;
  };
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EXTERNAL_RTMP_READINESS_ROLE;
  codexSuggestions: string[];
}

const REDACTION_PLACEHOLDERS = {
  streamKeyPlaceholder: "stream_key=PLACEHOLDER_STREAM_KEY_1234567890",
  apiKeyPlaceholder: "api_key=PLACEHOLDER_API_KEY_1234567890",
  oauthTokenPlaceholder: "Bearer PLACEHOLDER_OAUTH_TOKEN_1234567890",
  webhookSecretPlaceholder: "webhook_secret=PLACEHOLDER_WEBHOOK_SECRET_1234567890",
  signedUrlSecretPlaceholder: "signature=PLACEHOLDER_SIGNATURE_1234567890",
  rtmpUrlPlaceholder:
    "rtmps://non-social-example.invalid/live?token=PLACEHOLDER_TOKEN_1234567890",
} as const;

function pdfArtifactMtimeIso(pathValue: string): string | null {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) return null;
  return statSync(absolute).mtime.toISOString();
}

function pdfArtifactSize(pathValue: string): number {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) return 0;
  return statSync(absolute).size;
}

function pdfArtifactSha256(pathValue: string): string | null {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) return null;
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

export function getLiveExternalRtmpReadinessSummary(): LiveExternalRtmpReadinessSummary {
  const realLikeGate = getLiveRealLikeLocalContentGateSummary();
  const pdfArtifact = getLiveHlsEvidencePdfArtifactExport();
  const redaction = buildLiveSecretRedactionDryRunForm({
    targetType: "custom_rtmp",
    ...REDACTION_PLACEHOLDERS,
  });
  const firstFixture = realLikeGate.fixtureResults[0];

  return {
    phase: "external_custom_rtmp_non_social_target_readiness_approval_packet",
    readinessStatus: "ready_for_human_review_not_ready_for_auto_publish",
    previousGateCheckpoint: "ff783a7",
    previousGatePassed:
      realLikeGate.fixtureCount === 6 &&
      realLikeGate.passedFixtureCount === 6 &&
      realLikeGate.hlsSurvival.rate === "6/6" &&
      realLikeGate.postLiveResealIdRead.rate === "6/6",
    targetType: "custom_rtmp",
    targetSocialPlatform: false,
    youtubeUsed: false,
    facebookUsed: false,
    twitchUsed: false,
    customerContentUsed: false,
    externalPublishExecuted: false,
    realSecretAcceptedNow: false,
    realApiEnabled: false,
    productionDeploy: false,
    billingCreditPaymentAdded: false,
    pushUsed: false,
    placeholderTargetConfig: {
      configStatus: "placeholder_only_no_real_secret",
      providerLabel: "non_social_custom_rtmp_placeholder",
      rtmpUrlPlaceholder: "rtmps://<approved-non-social-host>/<app>",
      streamKeyPlaceholder: "<REDACTED_STREAM_KEY>",
      authHeaderPlaceholder: "Authorization: Bearer <REDACTED_TOKEN>",
      hostnamePlaceholder: "<approved-non-social-host>",
      ipAllowlistPlaceholder: "<approved-test-runner-ip>",
      tokenPlaceholder: "<REDACTED_TOKEN>",
      realValuesAcceptedNow: false,
      socialPlatformAllowed: false,
    },
    secretRedactionPolicy: {
      checkedFields: redaction.inputFields,
      detectedSecretLikeValue: redaction.detectedSecretLikeValue,
      allSecretLikeValuesRedacted: redaction.fieldResults.every((field) =>
        field.detectedSecretLikeValue ? field.redactedValue.includes("REDACTED") : true,
      ),
      storageAllowed: false,
      logAllowed: false,
      realSecretStored: false,
      redactedFields: redaction.fieldResults.map((field) => ({
        fieldName: field.fieldName,
        redactedValue: field.redactedValue,
      })),
      decisionRole: redaction.decisionRole,
    },
    dryRunCommandPreview: {
      commandKind: "external_custom_rtmp_publish_preview",
      binary: "ffmpeg",
      redactedCommandPreview:
        "ffmpeg -hide_banner -nostdin -re -i <SAFE_NON_CUSTOMER_REAL_LIKE_FIXTURE> " +
        "-t 30 -c copy -f flv rtmps://<approved-non-social-host>/<app>/<REDACTED_STREAM_KEY>",
      willExecute: false,
      dryRunOnly: true,
      usesRealTarget: false,
      realNetworkPush: false,
      secretValuesLogged: false,
      targetUrlRedacted: true,
      streamKeyRedacted: true,
    },
    fixtureSelection: {
      selectedFixtureId: firstFixture?.fixtureId ?? "real_like_phone_short_12s",
      fixtureSourceBoundary: "safe_non_customer_real_like_fixture",
      customerContentAllowed: false,
      copyrightedDownloadedMediaAllowed: false,
      rationale:
        "Use the shortest safe non-customer real-like fixture first, then expand only after redaction and rollback pass.",
    },
    durationPlan: {
      minimumSmokeSeconds: 30,
      maximumSafeSeconds: 120,
      stopConditions: [
        "secret_leak_detected",
        "unexpected_public_social_target_detected",
        "target_rejects_stream",
        "hls_manifest_not_observed_within_limit",
        "health_drop_or_disconnect",
        "operator_requests_stop",
      ],
    },
    rollbackPlan: {
      rollbackReadyForFutureTest: true,
      steps: [
        "stop_ffmpeg_publish_process",
        "stop_or_disable_external_target_session",
        "rotate_or_revoke_stream_key_and_token",
        "delete_temp_non_customer_fixture_outputs",
        "verify_log_redaction_after_test",
        "freeze_support_only_evidence_bundle",
        "write_post_test_incident_or_success_note",
      ],
    },
    evidencePlan: {
      hlsCapturePreferredPath: true,
      rtmpDirectRole: "diagnostic_only",
      postLiveResealRequired: true,
      idReadRequired: true,
      wrongIdNegativeRequired: true,
      unsealedNegativeRequired: true,
      supportOnlyArtifacts: ["json", "html", "txt", "pdf"],
      pdfSupportOnly: true,
    },
    approvalPacket: {
      approvalRequired: true,
      acceptedNow: false,
      requiredApprovalPhrase: LIVE_EXTERNAL_RTMP_APPROVAL_PHRASE,
      legacyRealSmokeApprovalPhrase: LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE,
      requiredFields: [
        "approved_non_social_target_name",
        "operator_identity",
        "rollback_owner",
        "test_window_start_time",
        "maximum_duration_seconds",
        "approved_fixture_id",
        "secret_redaction_confirmation",
        "target_non_social_verification",
      ],
      nonSocialTargetVerification: [
        "target_domain_is_not_youtube_facebook_twitch_or_social_platform",
        "target_account_is_test_owned_or_explicitly_authorized",
        "target_visibility_is_private_or_non_public_when_provider_supports_it",
        "terms_and_cost_risk_reviewed_before_real_test",
      ],
    },
    goNoGoCriteria: [
      "hls_manifest_and_segments_must_be_observed",
      "hls_playback_probe_must_pass",
      "vod_capture_must_be_created",
      "post_live_reseal_id_read_must_pass",
      "wrong_id_must_be_rejected",
      "unsealed_input_must_not_open_vault",
      "supportOnly_must_remain_true",
      "vaultEligible_confirmed_final_must_remain_false",
      "rtmp_direct_must_not_be_decision_path",
      "secret_leak_must_be_zero",
      "log_redaction_must_pass",
    ],
    artifactFreshnessAudit: {
      pdfArtifactPath: pdfArtifact.pdfArtifactPath,
      artifactExists: pdfArtifact.pdfArtifactGenerated,
      artifactSizeBytes: pdfArtifactSize(pdfArtifact.pdfArtifactPath),
      artifactSha256: pdfArtifactSha256(pdfArtifact.pdfArtifactPath),
      artifactMtimeIso: pdfArtifactMtimeIso(pdfArtifact.pdfArtifactPath),
      freshnessBasis: "path_size_sha256_mtime",
      pathNamePotentiallyConfusing: pdfArtifact.pdfArtifactPath.includes("live_actual_local_smoke"),
      currentForRealLikeLocalGate: realLikeGate.pdfArtifactPath === pdfArtifact.pdfArtifactPath,
      recommendedFutureArtifactDirectory: "runtime/validation/live_external_rtmp_readiness/",
      note:
        "The current PDF support artifact is reused from the HLS evidence local lab path; future external RTMP readiness artifacts should use a dedicated read-only directory to avoid naming confusion.",
    },
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EXTERNAL_RTMP_READINESS_ROLE,
    codexSuggestions: [
      "Use runtime/validation/live_external_rtmp_readiness/ for the future external RTMP readiness artifact namespace.",
    ],
  };
}
