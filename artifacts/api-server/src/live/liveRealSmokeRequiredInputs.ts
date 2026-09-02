import { LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE } from "./liveRealSmokeGoNoGoPolicy";

export const LIVE_REAL_SMOKE_REQUIRED_INPUTS_DECISION_ROLE =
  "live_real_smoke_required_inputs_support_only_no_vault_no_confirmed" as const;

export interface LiveRealSmokeRequiredInput {
  inputKey: string;
  label: string;
  futureRequired: true;
  acceptedNow: false;
  secretLike: boolean;
  supportOnly: true;
}

export interface LiveRealSmokeRequiredInputs {
  inputStatus: "future_inputs_preview";
  selectedTargetOptions: ["custom_rtmp", "youtube"];
  recommendedFirstTarget: "custom_rtmp";
  approvalPhraseFuture: typeof LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE;
  allRealInputsAcceptedNow: false;
  realSecretAcceptedNow: false;
  inputs: LiveRealSmokeRequiredInput[];
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_REAL_SMOKE_REQUIRED_INPUTS_DECISION_ROLE;
}

export function getLiveRealSmokeRequiredInputs(): LiveRealSmokeRequiredInputs {
  return {
    inputStatus: "future_inputs_preview",
    selectedTargetOptions: ["custom_rtmp", "youtube"],
    recommendedFirstTarget: "custom_rtmp",
    approvalPhraseFuture: LIVE_REAL_SMOKE_REQUIRED_APPROVAL_PHRASE,
    allRealInputsAcceptedNow: false,
    realSecretAcceptedNow: false,
    inputs: [
      input("selectedTarget", "selectedTarget: youtube or custom_rtmp", false),
      input("testDurationLimit", "testDurationLimit", false),
      input("testLiveSessionId", "testLiveSessionId", false),
      input("realStreamKey", "realStreamKey future", true),
      input("realRTMPUrl", "realRTMPUrl future", true),
      input("operatorIdentity", "operatorIdentity future", false),
      input("approvalPhrase", "approvalPhrase future", false),
      input("rollbackOwner", "rollbackOwner future", false),
      input("securityReviewer", "securityReviewer future", false),
      input("costApproval", "costApproval future", false),
      input("testAsset", "testAsset future", false),
      input("postTestReportOwner", "postTestReportOwner future", false),
    ],
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_REAL_SMOKE_REQUIRED_INPUTS_DECISION_ROLE,
  };
}

function input(inputKey: string, label: string, secretLike: boolean): LiveRealSmokeRequiredInput {
  return {
    inputKey,
    label,
    futureRequired: true,
    acceptedNow: false,
    secretLike,
    supportOnly: true,
  };
}
