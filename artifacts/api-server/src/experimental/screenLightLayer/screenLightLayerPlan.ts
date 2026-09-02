import {
  SCREEN_LIGHT_FINAL_DECISION,
  type ScreenLightFinalDecision,
} from "./screenLightSessionModel.js";

export const SCREEN_LIGHT_LAYER_STATUS = "isolated_prototype_default_off" as const;

export interface ScreenLightLayerPlan {
  status: typeof SCREEN_LIGHT_LAYER_STATUS;
  layerName: "Screen-to-Camera Light Layer";
  defaultEnabled: false;
  connectedToMainFlow: false;
  displayOnly: true;
  fileContentModified: false;
  affectsOriginalFile: false;
  medicalDataSafe: true;
  canOpenVault: false;
  confirmed: false;
  idMatched: false;
  finalDecision: ScreenLightFinalDecision;
  allowedSurfaceIdeas: readonly string[];
  forbiddenSurfaces: readonly string[];
  safetyNote: string;
}

export const screenLightLayerPlan: ScreenLightLayerPlan = {
  status: SCREEN_LIGHT_LAYER_STATUS,
  layerName: "Screen-to-Camera Light Layer",
  defaultEnabled: false,
  connectedToMainFlow: false,
  displayOnly: true,
  fileContentModified: false,
  affectsOriginalFile: false,
  medicalDataSafe: true,
  canOpenVault: false,
  confirmed: false,
  idMatched: false,
  finalDecision: SCREEN_LIGHT_FINAL_DECISION,
  allowedSurfaceIdeas: [
    "viewer frame",
    "empty margin",
    "temporary overlay",
    "light or display pattern layer",
  ],
  forbiddenSurfaces: [
    "source file bytes",
    "medical value pixels",
    "document text",
    "numbers",
    "coordinates",
    "technical drawing content",
    "audio/video/image/text seal logic",
  ],
  safetyNote:
    "This isolated prototype does not replace the existing AEGIS seal system, does not write a seal into files, and is intended only for future viewer-side screen-to-camera candidate traces.",
};

/**
 * Bu katman mevcut AEGIS mühürleme sisteminin yerine geçmez. Dosyaya mühür
 * basmaz. Sadece ileride AEGIS viewer üzerinde, ekrandan yayılan
 * ışık/görüntüleme katmanı üzerinden telefon çekimi aday izi üretmek için
 * tasarlanmış izole prototiptir.
 *
 * This layer does not replace the current AEGIS sealing system. It does not
 * stamp files. It is an isolated prototype designed only to model a future
 * viewer-side light/display layer that may produce a candidate trace when
 * AEGIS protected content is captured from a screen by a phone camera.
 */
export function describeScreenLightLayerPlan(): ScreenLightLayerPlan {
  return screenLightLayerPlan;
}
