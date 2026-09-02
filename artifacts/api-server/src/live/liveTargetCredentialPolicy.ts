export const LIVE_TARGET_CREDENTIAL_POLICY_DECISION_ROLE =
  "live_target_credential_policy_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetCredentialPolicy {
  secretStorageEnabled: false;
  realCredentialAccepted: false;
  redactionRequired: true;
  tokenValueExposed: false;
  streamKeyValueExposed: false;
  oauthFuture: true;
  realApiEnabled: false;
  realTargetPushEnabled: false;
  productionSecretManagementDeferred: true;
  rules: string[];
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_CREDENTIAL_POLICY_DECISION_ROLE;
}

const rules = [
  "Gercek stream key tutulmaz.",
  "Gercek OAuth token tutulmaz.",
  "Secret/token/key loglanmaz.",
  "Raporlarda redacted gosterilir.",
  "Gercek API baglantisi yoktur.",
  "Gercek target push yoktur.",
  "Bu fazda sadece credential shape/mock policy vardir.",
  "Production secret management future/deferred kalir.",
];

export function getLiveTargetCredentialPolicy(): LiveTargetCredentialPolicy {
  return {
    secretStorageEnabled: false,
    realCredentialAccepted: false,
    redactionRequired: true,
    tokenValueExposed: false,
    streamKeyValueExposed: false,
    oauthFuture: true,
    realApiEnabled: false,
    realTargetPushEnabled: false,
    productionSecretManagementDeferred: true,
    rules,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_CREDENTIAL_POLICY_DECISION_ROLE,
  };
}
