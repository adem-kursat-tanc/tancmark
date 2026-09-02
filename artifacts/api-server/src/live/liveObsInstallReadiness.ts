export const LIVE_OBS_INSTALL_READINESS_DECISION_ROLE =
  "live_obs_install_readiness_no_execution_no_vault_no_confirmed" as const;

export interface LiveObsInstallReadiness {
  tool: "obs";
  requiredForFirstLocalSmoke: false;
  optionalGuiSource: true;
  pathCommandFound: false;
  knownInstallPathsFound: false;
  installed: false;
  userActionRequiredIfGuiPreferred: true;
  recommendedAlternativeForFirstSmoke: "portable_ffmpeg_test_pattern";
  openedNow: false;
  installedNow: false;
  secretValuesAccepted: false;
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_OBS_INSTALL_READINESS_DECISION_ROLE;
}

export function getLiveObsInstallReadiness(): LiveObsInstallReadiness {
  return {
    tool: "obs",
    requiredForFirstLocalSmoke: false,
    optionalGuiSource: true,
    pathCommandFound: false,
    knownInstallPathsFound: false,
    installed: false,
    userActionRequiredIfGuiPreferred: true,
    recommendedAlternativeForFirstSmoke: "portable_ffmpeg_test_pattern",
    openedNow: false,
    installedNow: false,
    secretValuesAccepted: false,
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_OBS_INSTALL_READINESS_DECISION_ROLE,
  };
}
