import { getLiveFfmpegInstallReadiness } from "./liveFfmpegInstallReadiness";
import { getLiveLocalSmokeHumanActionChecklist } from "./liveLocalSmokeHumanActionChecklist";
import { getLiveMediaMtxInstallReadiness } from "./liveMediaMtxInstallReadiness";
import { getLiveObsInstallReadiness } from "./liveObsInstallReadiness";
import { getLiveRealSmokeLocalLabPlan } from "./liveRealSmokeLocalLabPlan";
import { getLiveRealSmokeLocalPreflight } from "./liveRealSmokeLocalPreflight";

export const LIVE_LOCAL_TOOLING_SETUP_STATUS_DECISION_ROLE =
  "live_local_tooling_setup_status_no_execution_no_vault_no_confirmed" as const;

export interface LiveLocalToolingSetupStatus {
  phase: "local_tooling_setup_feasibility_prepared";
  firstRealTestCandidate: "custom_rtmp";
  selectedEngine: "mediamtx";
  mediamtx: ReturnType<typeof getLiveMediaMtxInstallReadiness>;
  ffmpeg: ReturnType<typeof getLiveFfmpegInstallReadiness>;
  obs: ReturnType<typeof getLiveObsInstallReadiness>;
  humanActionChecklist: ReturnType<typeof getLiveLocalSmokeHumanActionChecklist>;
  docker: {
    cliFound: true;
    daemonRunning: false;
    dockerDesktopProcessFound: false;
    configAccessIssueObserved: true;
    requiredForFirstSmoke: false;
  };
  ports: {
    checkedPorts: number[];
    listenersFound: false;
    observedAsFreeForLocalSmoke: true;
  };
  localLabFiles: {
    mediaMtxConfigExists: true;
    localLabPlanHelperExists: true;
    localPreflightHelperExists: true;
  };
  preflightSummary: ReturnType<typeof getLiveRealSmokeLocalPreflight>;
  localLabPlanSummary: ReturnType<typeof getLiveRealSmokeLocalLabPlan>;
  actualSmokeExecuted: false;
  readyForActualSmokeNow: false;
  requiresHumanExplicitSmokeCommand: true;
  realBroadcastStarted: false;
  publicSocialTargetsEnabled: false;
  youtubeRealTestEnabled: false;
  facebookRealTestEnabled: false;
  twitchRealTestEnabled: false;
  tiktokRealTestEnabled: false;
  realSecretStored: false;
  realApiEnabled: false;
  realPushEnabled: false;
  billingCreditPaymentAdded: false;
  pathChanged: false;
  registryChanged: false;
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_LOCAL_TOOLING_SETUP_STATUS_DECISION_ROLE;
}

export function getLiveLocalToolingSetupStatus(): LiveLocalToolingSetupStatus {
  return {
    phase: "local_tooling_setup_feasibility_prepared",
    firstRealTestCandidate: "custom_rtmp",
    selectedEngine: "mediamtx",
    mediamtx: getLiveMediaMtxInstallReadiness(),
    ffmpeg: getLiveFfmpegInstallReadiness(),
    obs: getLiveObsInstallReadiness(),
    humanActionChecklist: getLiveLocalSmokeHumanActionChecklist(),
    docker: {
      cliFound: true,
      daemonRunning: false,
      dockerDesktopProcessFound: false,
      configAccessIssueObserved: true,
      requiredForFirstSmoke: false,
    },
    ports: {
      checkedPorts: [1935, 8888, 9997],
      listenersFound: false,
      observedAsFreeForLocalSmoke: true,
    },
    localLabFiles: {
      mediaMtxConfigExists: true,
      localLabPlanHelperExists: true,
      localPreflightHelperExists: true,
    },
    preflightSummary: getLiveRealSmokeLocalPreflight(),
    localLabPlanSummary: getLiveRealSmokeLocalLabPlan(),
    actualSmokeExecuted: false,
    readyForActualSmokeNow: false,
    requiresHumanExplicitSmokeCommand: true,
    realBroadcastStarted: false,
    publicSocialTargetsEnabled: false,
    youtubeRealTestEnabled: false,
    facebookRealTestEnabled: false,
    twitchRealTestEnabled: false,
    tiktokRealTestEnabled: false,
    realSecretStored: false,
    realApiEnabled: false,
    realPushEnabled: false,
    billingCreditPaymentAdded: false,
    pathChanged: false,
    registryChanged: false,
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_LOCAL_TOOLING_SETUP_STATUS_DECISION_ROLE,
  };
}
