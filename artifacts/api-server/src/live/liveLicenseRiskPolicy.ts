export interface LiveLicenseRiskEntry {
  component: string;
  licenseType: string;
  riskLevel: "low" | "medium" | "high";
  status: "safe_candidate" | "external_cli_check_required" | "not_used_this_phase" | "future_research";
  note: string;
}

export interface LiveLicenseRiskPolicy {
  policyName: "tancmark_live_license_risk_policy";
  entries: LiveLicenseRiskEntry[];
  noRealProviderConnected: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
}

export function getLiveLicenseRiskPolicy(): LiveLicenseRiskPolicy {
  return {
    policyName: "tancmark_live_license_risk_policy",
    entries: [
      entry("SRS", "MIT", "low", "safe_candidate", "Primary open-source live engine candidate."),
      entry("MediaMTX", "MIT", "low", "safe_candidate", "Secondary/lab-friendly live engine candidate."),
      entry("Shaka Player", "Apache-2.0", "low", "safe_candidate", "Future player candidate."),
      entry("Video.js", "MIT", "low", "safe_candidate", "Future simple web player candidate."),
      entry("FFmpeg", "build-dependent", "medium", "external_cli_check_required", "Use as external CLI/binary only; build license must be checked."),
      entry("OvenMediaEngine", "AGPL", "high", "not_used_this_phase", "Technically strong but AGPL risk for closed commercial SaaS."),
      entry("Ant Media", "Community/Enterprise mixed", "medium", "future_research", "Community/Enterprise distinction needs separate review."),
      entry("Open-source watermark libraries", "varies", "high", "not_used_this_phase", "Do not replace TancMark forensic watermark."),
      entry("Multi-DRM", "external provider", "medium", "future_research", "Widevine/FairPlay/PlayReady require external provider strategy."),
    ],
    noRealProviderConnected: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  };
}

function entry(
  component: string,
  licenseType: string,
  riskLevel: LiveLicenseRiskEntry["riskLevel"],
  status: LiveLicenseRiskEntry["status"],
  note: string,
): LiveLicenseRiskEntry {
  return { component, licenseType, riskLevel, status, note };
}
