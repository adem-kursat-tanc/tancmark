export const SCREEN_LIGHT_FINAL_DECISION = "SCREEN_LIGHT_CANDIDATE_ONLY" as const;

export type ScreenLightFinalDecision = typeof SCREEN_LIGHT_FINAL_DECISION;
export type ScreenLightTriggerMode = "manual_viewer_experiment" | "future_viewer_signal";
export type ScreenLightProtectionScope = "viewer_overlay_only";

export interface ScreenLightSessionModel {
  screenSessionId: string;
  viewerSessionId: string;
  lightPatternId: string;
  triggerMode: ScreenLightTriggerMode;
  protectionScope: ScreenLightProtectionScope;
  displayOnly: true;
  fileContentModified: false;
  affectsOriginalFile: false;
  medicalDataSafe: true;
  canOpenVault: false;
  confirmed: false;
  idMatched: false;
  finalDecision: ScreenLightFinalDecision;
}

export interface CreateScreenLightSessionInput {
  screenSessionId: string;
  viewerSessionId: string;
  lightPatternId: string;
  triggerMode?: ScreenLightTriggerMode;
}

export function createScreenLightSessionModel(
  input: CreateScreenLightSessionInput,
): ScreenLightSessionModel {
  return {
    screenSessionId: input.screenSessionId,
    viewerSessionId: input.viewerSessionId,
    lightPatternId: input.lightPatternId,
    triggerMode: input.triggerMode ?? "manual_viewer_experiment",
    protectionScope: "viewer_overlay_only",
    displayOnly: true,
    fileContentModified: false,
    affectsOriginalFile: false,
    medicalDataSafe: true,
    canOpenVault: false,
    confirmed: false,
    idMatched: false,
    finalDecision: SCREEN_LIGHT_FINAL_DECISION,
  };
}

