import { getLiveOpenSourceArchitecture } from "./liveOpenSourceArchitecture";
import { getLiveFeatureStatusMatrix } from "./liveFeatureStatusMatrix";

export interface LiveModuleOverview {
  moduleName: "TancMark Live";
  phase: "open_source_mux_like_blueprint_mock_lab";
  status: "mock_first_blueprint_not_live_product";
  summary: string;
  nonGoals: readonly string[];
  architecture: ReturnType<typeof getLiveOpenSourceArchitecture>;
  featureStatusSummary: ReturnType<typeof getLiveFeatureStatusMatrix>;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLiveModuleOverview(): LiveModuleOverview {
  return {
    moduleName: "TancMark Live",
    phase: "open_source_mux_like_blueprint_mock_lab",
    status: "mock_first_blueprint_not_live_product",
    summary:
      "TancMark Live is currently an open-source Mux-like architecture blueprint and mock lab only.",
    nonGoals: [
      "no real live broadcast",
      "no real social media connection",
      "no real Mux/FastPix/AWS/Cloudflare API call",
      "no real DRM provider",
      "no real TancMark live watermark connection",
      "no billing or credit behavior",
    ],
    architecture: getLiveOpenSourceArchitecture(),
    featureStatusSummary: getLiveFeatureStatusMatrix(),
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
