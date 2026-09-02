export interface LiveExternalDrmPlan {
  drmStrategy: "external_multi_drm_provider_future";
  candidates: readonly ["EZDRM", "BuyDRM", "Axinom", "castLabs", "DoveRunner"];
  buildWidevineFairPlayPlayReadyInHouse: false;
  realDrmEnabled: false;
  drmEnabled: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLiveExternalDrmPlan(): LiveExternalDrmPlan {
  return {
    drmStrategy: "external_multi_drm_provider_future",
    candidates: ["EZDRM", "BuyDRM", "Axinom", "castLabs", "DoveRunner"],
    buildWidevineFairPlayPlayReadyInHouse: false,
    realDrmEnabled: false,
    drmEnabled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
