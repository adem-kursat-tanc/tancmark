export interface LiveFfmpegProcessingPlan {
  processingEngine: "ffmpeg_cli_external";
  embeddedInCode: false;
  licenseCheckRequired: true;
  plannedUses: readonly string[];
  realProcessingEnabled: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLiveFfmpegProcessingPlan(): LiveFfmpegProcessingPlan {
  return {
    processingEngine: "ffmpeg_cli_external",
    embeddedInCode: false,
    licenseCheckRequired: true,
    plannedUses: ["recording", "thumbnail", "clip", "future_transcoding", "future_live_seal_lab"],
    realProcessingEnabled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
