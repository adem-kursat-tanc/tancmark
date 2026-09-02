export const LIVE_MEDIAMTX_INSTALL_READINESS_DECISION_ROLE =
  "live_mediamtx_install_readiness_no_execution_no_vault_no_confirmed" as const;

export interface LiveMediaMtxInstallReadiness {
  tool: "mediamtx";
  selectedForFirstLocalSmoke: true;
  pathStatus: "portable_ready_not_on_path";
  pathCommandFound: false;
  portableBinaryPrepared: true;
  portableBinaryPath: string;
  version: "v1.19.1";
  officialSourceUrl: string;
  downloadedFromOfficialRelease: true;
  checksumVerified: true;
  sha256: string;
  sourceBuildPrepared: true;
  sourceBuildPreferredForLocalLab: true;
  sourceRepositoryUrl: string;
  sourceTag: "v1.19.1";
  sourceCommit: string;
  sourcePath: string;
  sourceLicense: "MIT";
  sourceLicenseVerified: true;
  goToolchainPath: string;
  goToolchainVersion: "go1.26.0 windows/amd64";
  goToolchainLicense: "BSD-3-Clause";
  goToolchainSha256: string;
  sourceBuildBinaryPath: string;
  sourceBuildSha256: string;
  sourceBuildVersion: "v1.19.1";
  sourceBuildSmokeStarted: true;
  sourceBuildSmokeStopped: true;
  sourceBuildSmokeResult: "passed";
  embeddedHlsPlayerLicense: "Apache-2.0";
  embeddedHlsPlayerNoticeRequired: true;
  helperRole: "live_transport_only_no_tancmark_decision";
  tancLiveOwnEngineKeepsSealEvidenceDecision: true;
  ffmpegRequiredForMediaMtxBackbone: false;
  configReady: true;
  configPath: "runtime/validation/mediamtx_custom_rtmp_smoke.yml";
  serverStarted: false;
  pathChanged: false;
  registryChanged: false;
  installScope: "user_local_tools_folder";
  requiredPorts: number[];
  supportOnly: true;
  canOpenVault: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_MEDIAMTX_INSTALL_READINESS_DECISION_ROLE;
}

export function getLiveMediaMtxInstallReadiness(): LiveMediaMtxInstallReadiness {
  return {
    tool: "mediamtx",
    selectedForFirstLocalSmoke: true,
    pathStatus: "portable_ready_not_on_path",
    pathCommandFound: false,
    portableBinaryPrepared: true,
    portableBinaryPath:
      "runtime/tools/mediamtx/v1.19.1/mediamtx.exe",
    version: "v1.19.1",
    officialSourceUrl: "https://github.com/bluenviron/mediamtx/releases/tag/v1.19.1",
    downloadedFromOfficialRelease: true,
    checksumVerified: true,
    sha256: "ca3d89c370bf73dc33ef9ee87afea04834f21b129f499d4b645490fcb01cce22",
    sourceBuildPrepared: true,
    sourceBuildPreferredForLocalLab: true,
    sourceRepositoryUrl: "https://github.com/bluenviron/mediamtx",
    sourceTag: "v1.19.1",
    sourceCommit: "6a5761f7e6c41ea2202696a0a683809b79646eba",
    sourcePath:
      "runtime/tools/mediamtx-source/v1.19.1",
    sourceLicense: "MIT",
    sourceLicenseVerified: true,
    goToolchainPath:
      "runtime/tools/go/go1.26.0.windows-amd64/go/bin/go.exe",
    goToolchainVersion: "go1.26.0 windows/amd64",
    goToolchainLicense: "BSD-3-Clause",
    goToolchainSha256: "9BBE0FC64236B2B51F6255C05C4232532B8ECC0E6D2E00950BD3021D8A4D07D4",
    sourceBuildBinaryPath:
      "runtime/tools/mediamtx-source-build/v1.19.1/mediamtx.exe",
    sourceBuildSha256: "33271A0F10F820FCA79B4A29340867A8C7FD00FFD15ECBFACD0181341B926CEC",
    sourceBuildVersion: "v1.19.1",
    sourceBuildSmokeStarted: true,
    sourceBuildSmokeStopped: true,
    sourceBuildSmokeResult: "passed",
    embeddedHlsPlayerLicense: "Apache-2.0",
    embeddedHlsPlayerNoticeRequired: true,
    helperRole: "live_transport_only_no_tancmark_decision",
    tancLiveOwnEngineKeepsSealEvidenceDecision: true,
    ffmpegRequiredForMediaMtxBackbone: false,
    configReady: true,
    configPath: "runtime/validation/mediamtx_custom_rtmp_smoke.yml",
    serverStarted: false,
    pathChanged: false,
    registryChanged: false,
    installScope: "user_local_tools_folder",
    requiredPorts: [1935, 8888, 9997],
    supportOnly: true,
    canOpenVault: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_MEDIAMTX_INSTALL_READINESS_DECISION_ROLE,
  };
}
