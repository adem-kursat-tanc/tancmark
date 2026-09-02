import { SCREEN_LIGHT_FINAL_DECISION } from "./screenLightSessionModel.js";

/**
 * SAFETY NOTE
 *
 * This layer does not sign files.
 * It does not change data.
 * It is only an experimental candidate trace model for a future
 * viewer/display/light presentation layer.
 * It is default-off.
 * It is not connected to the main AEGIS flow.
 * It cannot produce VAULT or confirmed decisions by itself.
 * It must not be connected to product flows before real iPhone/Android
 * screen-capture tests are completed and reviewed.
 */

export const PRESENTATION_SIGNATURE_STATUS = "isolated_default_off" as const;
export const PRESENTATION_SIGNATURE_DECISION = SCREEN_LIGHT_FINAL_DECISION;

export type PresentationContentClass =
  | "ordinary_image_video"
  | "ordinary_text"
  | "sensitive_any";

export type PresentationSurface =
  | "background_flat"
  | "overlay_layer"
  | "empty_margin"
  | "light_temporal"
  | "glyph_render"
  | "line_gap";

export interface PresentationSafetyInvariants {
  dataValueChanged: false;
  codepointChanged: false;
  diagnosticPixelsChanged: false;
  affectsOriginalFile: false;
  medicalDataSafe: true;
  photosensitiveSafe: true;
  canOpenVault: false;
  confirmed: false;
  idMatched: false;
  finalDecision: typeof PRESENTATION_SIGNATURE_DECISION;
}

export interface PresentationLightTemporalConfig {
  frequencyHz: number;
  brightnessDeltaPct: number;
}

export interface GeneratePresentationPatternInput {
  presentationId: string;
  viewerSessionId: string;
  contentClass: PresentationContentClass;
  surfaces: readonly PresentationSurface[];
  lightTemporal?: PresentationLightTemporalConfig;
}

export interface PresentationPatternDescriptor extends PresentationSafetyInvariants {
  status: typeof PRESENTATION_SIGNATURE_STATUS;
  presentationId: string;
  viewerSessionId: string;
  patternId: string;
  contentClass: PresentationContentClass;
  surfaces: readonly PresentationSurface[];
  lightTemporal?: PresentationLightTemporalConfig;
  writesFile: false;
  changesOriginalContent: false;
  note: string;
}

export interface ReadPresentationCandidateInput {
  expectedPatternId: string;
  observedPatternId?: string | null;
  confidence?: number | null;
}

export interface PresentationCandidateResult extends PresentationSafetyInvariants {
  candidateSupport: boolean;
  confidence: number;
  note: string;
}

const INVARIANTS: PresentationSafetyInvariants = {
  dataValueChanged: false,
  codepointChanged: false,
  diagnosticPixelsChanged: false,
  affectsOriginalFile: false,
  medicalDataSafe: true,
  photosensitiveSafe: true,
  canOpenVault: false,
  confirmed: false,
  idMatched: false,
  finalDecision: PRESENTATION_SIGNATURE_DECISION,
};

const ALLOWED_SURFACES: Record<PresentationContentClass, ReadonlySet<PresentationSurface>> = {
  ordinary_image_video: new Set([
    "background_flat",
    "overlay_layer",
    "empty_margin",
    "light_temporal",
  ]),
  ordinary_text: new Set(["glyph_render", "line_gap", "empty_margin", "overlay_layer"]),
  sensitive_any: new Set(["empty_margin", "overlay_layer"]),
};

function assertValidSurfacePolicy(
  contentClass: PresentationContentClass,
  surfaces: readonly PresentationSurface[],
): void {
  const allowed = ALLOWED_SURFACES[contentClass];
  for (const surface of surfaces) {
    if (!allowed.has(surface)) {
      throw new Error(`presentation_signature_surface_forbidden:${surface}`);
    }
  }
}

function assertPhotosensitiveSafe(config?: PresentationLightTemporalConfig): void {
  if (!config) return;
  if (config.frequencyHz >= 3) {
    throw new Error("presentation_signature_frequency_too_high");
  }
  if (config.brightnessDeltaPct > 5) {
    throw new Error("presentation_signature_brightness_delta_too_high");
  }
}

function clampConfidence(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Returns only a descriptor that a future viewer could draw.
 * It does not generate real physics, does not write to a file, and does not
 * modify source pixels, text, numbers, coordinates, medical values, financial
 * values, or engineering values.
 *
 * Real pattern generation and reading physics must not be connected to the
 * product before iPhone/Android screen-capture tests are completed.
 */
export function generatePresentationPattern(
  input: GeneratePresentationPatternInput,
): PresentationPatternDescriptor {
  assertValidSurfacePolicy(input.contentClass, input.surfaces);
  if (input.surfaces.includes("light_temporal")) {
    assertPhotosensitiveSafe(input.lightTemporal);
  }

  return {
    ...INVARIANTS,
    status: PRESENTATION_SIGNATURE_STATUS,
    presentationId: input.presentationId,
    viewerSessionId: input.viewerSessionId,
    patternId: `presentation:${input.viewerSessionId}:${input.presentationId}`,
    contentClass: input.contentClass,
    surfaces: input.surfaces,
    lightTemporal: input.lightTemporal,
    writesFile: false,
    changesOriginalContent: false,
    note:
      "Candidate-only presentation descriptor. It is a viewer/display contract, not a file seal.",
  };
}

/**
 * Candidate-only read stub.
 *
 * This function does not recover an AEGIS ID, cannot confirm identity, and
 * cannot open VAULT. It only reports whether a future viewer-side presentation
 * pattern observation may provide candidate support.
 */
export function readPresentationCandidate(
  input: ReadPresentationCandidateInput,
): PresentationCandidateResult {
  const confidence = clampConfidence(input.confidence);
  const candidateSupport =
    confidence > 0 &&
    typeof input.observedPatternId === "string" &&
    input.observedPatternId.length > 0 &&
    input.observedPatternId === input.expectedPatternId;

  return {
    ...INVARIANTS,
    candidateSupport,
    confidence,
    note:
      "Candidate-only presentation observation. It never produces confirmed, idMatched, canOpenVault, or VAULT.",
  };
}
