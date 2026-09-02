export interface LivePreSealPolicy {
  policyName: "tancmark_live_preseal_policy";
  tancmarkInvisibleWatermarkProvidedBySrsOrMediaMtx: false;
  tancmarkWatermarkLayer: "separate_preseal_live_lab_future";
  realLiveWatermarkingEnabled: false;
  existingFileVideoWatermarkSystemChanged: false;
  requiresTargetDurabilityTestsBeforeProduct: true;
  personalizedABForensicWatermarkInThisPhase: false;
  drmInThisPhase: false;
  rules: readonly string[];
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLivePreSealPolicy(): LivePreSealPolicy {
  return {
    policyName: "tancmark_live_preseal_policy",
    tancmarkInvisibleWatermarkProvidedBySrsOrMediaMtx: false,
    tancmarkWatermarkLayer: "separate_preseal_live_lab_future",
    realLiveWatermarkingEnabled: false,
    existingFileVideoWatermarkSystemChanged: false,
    requiresTargetDurabilityTestsBeforeProduct: true,
    personalizedABForensicWatermarkInThisPhase: false,
    drmInThisPhase: false,
    rules: [
      "SRS and MediaMTX do not stamp TancMark invisible forensic marks.",
      "TancMark live watermark must be a separate pre-seal/live-seal lab layer later.",
      "No real live watermarking in this phase.",
      "Existing file/video watermark system is not changed.",
      "YouTube/Facebook/Twitch/custom HLS durability must be tested before product opening.",
      "Personalized A/B forensic watermark is not in this phase.",
      "DRM is not in this phase.",
    ],
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
