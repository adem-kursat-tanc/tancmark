import {
  SCREEN_LIGHT_FINAL_DECISION,
  type ScreenLightSessionModel,
} from "./screenLightSessionModel.js";

export interface ScreenLightObservation {
  observedPatternId?: string | null;
  confidence?: number | null;
  source: "phone_photo" | "phone_video" | "screen_recording" | "unknown";
}

export interface ScreenLightCandidateResult {
  candidateSupport: boolean;
  displayOnly: true;
  fileContentModified: false;
  affectsOriginalFile: false;
  medicalDataSafe: true;
  canOpenVault: false;
  confirmed: false;
  idMatched: false;
  finalDecision: typeof SCREEN_LIGHT_FINAL_DECISION;
  note: string;
}

export function detectScreenLightCandidate(
  session: ScreenLightSessionModel,
  observation: ScreenLightObservation,
): ScreenLightCandidateResult {
  const confidence =
    typeof observation.confidence === "number" ? observation.confidence : 0;
  const patternMatches =
    typeof observation.observedPatternId === "string" &&
    observation.observedPatternId.length > 0 &&
    observation.observedPatternId === session.lightPatternId;

  return {
    candidateSupport: patternMatches && confidence > 0,
    displayOnly: true,
    fileContentModified: false,
    affectsOriginalFile: false,
    medicalDataSafe: true,
    canOpenVault: false,
    confirmed: false,
    idMatched: false,
    finalDecision: SCREEN_LIGHT_FINAL_DECISION,
    note:
      "The screen light detector is theoretical and candidate-only. It cannot open VAULT, cannot confirm identity, and cannot modify original content.",
  };
}

