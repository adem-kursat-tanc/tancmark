import { parseLiveSmokeTargetType, type LiveSingleTargetSmokeTargetType } from "./liveSingleTargetSmokeReadiness";
import { validateLiveSecretRedaction, type LiveSecretRedactionResult } from "./liveSecretRedactionValidator";

export const LIVE_SECRET_REDACTION_DRY_RUN_DECISION_ROLE =
  "live_secret_redaction_dry_run_support_only_no_vault_no_confirmed" as const;

export interface LiveSecretRedactionDryRunInput {
  targetType?: unknown;
  streamKeyPlaceholder?: unknown;
  apiKeyPlaceholder?: unknown;
  oauthTokenPlaceholder?: unknown;
  webhookSecretPlaceholder?: unknown;
  signedUrlSecretPlaceholder?: unknown;
  rtmpUrlPlaceholder?: unknown;
}

export interface LiveSecretRedactionDryRunForm {
  targetType: LiveSingleTargetSmokeTargetType;
  mockOnly: true;
  inputFields: string[];
  fieldResults: LiveSecretRedactionResult[];
  detectedSecretLikeValue: boolean;
  shouldRejectRealSecret: true;
  realSecretAccepted: false;
  realSecretStored: false;
  tokenValueExposed: false;
  streamKeyValueExposed: false;
  apiKeyValueExposed: false;
  oauthTokenValueExposed: false;
  webhookSecretValueExposed: false;
  signedUrlSecretValueExposed: false;
  rtmpUrlSecretValueExposed: false;
  storageAllowed: false;
  logAllowed: false;
  realApiEnabled: false;
  realPushEnabled: false;
  realBroadcastStarted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SECRET_REDACTION_DRY_RUN_DECISION_ROLE;
}

const fieldNames = [
  "streamKeyPlaceholder",
  "apiKeyPlaceholder",
  "oauthTokenPlaceholder",
  "webhookSecretPlaceholder",
  "signedUrlSecretPlaceholder",
  "rtmpUrlPlaceholder",
] as const;

export function buildLiveSecretRedactionDryRunForm(input: LiveSecretRedactionDryRunInput = {}): LiveSecretRedactionDryRunForm {
  const fieldResults = fieldNames.map((fieldName) => validateLiveSecretRedaction(input[fieldName], fieldName));

  return {
    targetType: parseLiveSmokeTargetType(input.targetType),
    mockOnly: true,
    inputFields: [...fieldNames],
    fieldResults,
    detectedSecretLikeValue: fieldResults.some((result) => result.detectedSecretLikeValue),
    shouldRejectRealSecret: true,
    realSecretAccepted: false,
    realSecretStored: false,
    tokenValueExposed: false,
    streamKeyValueExposed: false,
    apiKeyValueExposed: false,
    oauthTokenValueExposed: false,
    webhookSecretValueExposed: false,
    signedUrlSecretValueExposed: false,
    rtmpUrlSecretValueExposed: false,
    storageAllowed: false,
    logAllowed: false,
    realApiEnabled: false,
    realPushEnabled: false,
    realBroadcastStarted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SECRET_REDACTION_DRY_RUN_DECISION_ROLE,
  };
}
