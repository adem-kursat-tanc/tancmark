export const LIVE_ENGINE_SECURITY_POLICY_DECISION_ROLE =
  "live_engine_security_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveEngineSecurityPolicy {
  streamKeyRedaction: true;
  secretLoggingDisabled: true;
  adminControlPortPublic: false;
  pathTraversalBlocked: true;
  allowlistPathPreview: true;
  noArbitraryFileWrite: true;
  noNetworkPushPullThisPhase: true;
  noRealProcessExecution: true;
  noRealMediaProcessing: true;
  noVaultDecision: true;
  realServerStarted: false;
  realConfigWritten: false;
  realPortsOpened: false;
  realBroadcastStarted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_ENGINE_SECURITY_POLICY_DECISION_ROLE;
}

export function getLiveEngineSecurityPolicy(): LiveEngineSecurityPolicy {
  return {
    streamKeyRedaction: true,
    secretLoggingDisabled: true,
    adminControlPortPublic: false,
    pathTraversalBlocked: true,
    allowlistPathPreview: true,
    noArbitraryFileWrite: true,
    noNetworkPushPullThisPhase: true,
    noRealProcessExecution: true,
    noRealMediaProcessing: true,
    noVaultDecision: true,
    realServerStarted: false,
    realConfigWritten: false,
    realPortsOpened: false,
    realBroadcastStarted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_ENGINE_SECURITY_POLICY_DECISION_ROLE,
  };
}
