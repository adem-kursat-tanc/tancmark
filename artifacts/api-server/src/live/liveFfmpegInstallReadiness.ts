export const LIVE_FFMPEG_INSTALL_READINESS_DECISION_ROLE =
  "live_ffmpeg_install_readiness_no_execution_no_vault_no_confirmed" as const;

export interface LiveFfmpegInstallReadiness {
  tool: "ffmpeg";
  pathStatus: "portable_ready_not_on_path";
  pathCommandFound: false;
  portableBinaryAvailable: true;
  portableBinaryPath: string;
  version: "8.1.1";
  versionLineObserved: string;
  configurationGplDetected: true;
  configurationNonfreeDetected: false;
  currentLocalBinaryProductApproved: false;
  currentLocalBinaryLabOnly: true;
  cleanLgplReplacementRequiredForProduct: true;
  canGenerateLocalTestPatternLater: true;
  mediaProcessedNow: false;
  commandExecutedNow: false;
  pathChanged: false;
  registryChanged: false;
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_FFMPEG_INSTALL_READINESS_DECISION_ROLE;
}

export function getLiveFfmpegInstallReadiness(): LiveFfmpegInstallReadiness {
  return {
    tool: "ffmpeg",
    pathStatus: "portable_ready_not_on_path",
    pathCommandFound: false,
    portableBinaryAvailable: true,
    portableBinaryPath:
      "runtime/tools/ffmpeg/ffmpeg.exe",
    version: "8.1.1",
    versionLineObserved:
      "ffmpeg version 8.1.1-essentials_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers",
    configurationGplDetected: true,
    configurationNonfreeDetected: false,
    currentLocalBinaryProductApproved: false,
    currentLocalBinaryLabOnly: true,
    cleanLgplReplacementRequiredForProduct: true,
    canGenerateLocalTestPatternLater: true,
    mediaProcessedNow: false,
    commandExecutedNow: false,
    pathChanged: false,
    registryChanged: false,
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_FFMPEG_INSTALL_READINESS_DECISION_ROLE,
  };
}
