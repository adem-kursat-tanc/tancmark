export const LIVE_OPERATOR_RUNBOOK_POLICY_DECISION_ROLE =
  "live_operator_runbook_secret_redaction_support_only_no_vault_no_confirmed" as const;

export interface LiveOperatorRunbookPolicy {
  phase: "operator_runbook_secret_redaction_dry_run";
  realSecretAccepted: false;
  realSecretStored: false;
  streamKeyAccepted: false;
  apiKeyAccepted: false;
  oauthTokenAccepted: false;
  signedUrlSecretAccepted: false;
  webhookSecretAccepted: false;
  redactionRequired: true;
  realBroadcastStarted: false;
  realSrsMediaMtxFfmpegAtsStarted: false;
  realTargetPushEnabled: false;
  realApiEnabled: false;
  realTokenGenerated: false;
  realSignedUrlGenerated: false;
  dryRunOnly: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_OPERATOR_RUNBOOK_POLICY_DECISION_ROLE;
  rules: readonly string[];
}

const rules = [
  "Bu fazda gercek secret kabul edilmez.",
  "Stream key, API key, OAuth token, signed URL secret ve webhook secret saklanmaz.",
  "Secret benzeri degerler tespit edilirse redacted preview olarak gosterilir.",
  "Gercek yayin baslatilmaz.",
  "Gercek SRS/MediaMTX/FFmpeg/ATS calistirilmaz.",
  "Gercek target push yapilmaz.",
  "Gercek sosyal medya API cagrisi yapilmaz.",
  "Gercek token veya signed URL uretilmez.",
  "Bu sadece operator hazirlik ve guvenlik dry-run fazidir.",
  "Runbook VAULT/confirmed/final kararina etki etmez.",
  "Runbook supportOnly kalir.",
];

export function getLiveOperatorRunbookPolicy(): LiveOperatorRunbookPolicy {
  return {
    phase: "operator_runbook_secret_redaction_dry_run",
    realSecretAccepted: false,
    realSecretStored: false,
    streamKeyAccepted: false,
    apiKeyAccepted: false,
    oauthTokenAccepted: false,
    signedUrlSecretAccepted: false,
    webhookSecretAccepted: false,
    redactionRequired: true,
    realBroadcastStarted: false,
    realSrsMediaMtxFfmpegAtsStarted: false,
    realTargetPushEnabled: false,
    realApiEnabled: false,
    realTokenGenerated: false,
    realSignedUrlGenerated: false,
    dryRunOnly: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_OPERATOR_RUNBOOK_POLICY_DECISION_ROLE,
    rules,
  };
}
