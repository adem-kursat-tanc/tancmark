export interface LivePlayerPlan {
  shakaPlayer: {
    status: "future_phase";
    strengths: readonly string[];
  };
  videoJs: {
    status: "future_phase";
    strengths: readonly string[];
  };
  realPlayerImplemented: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLivePlayerPlan(): LivePlayerPlan {
  return {
    shakaPlayer: {
      status: "future_phase",
      strengths: ["HLS/DASH playback", "future DRM workflow candidate"],
    },
    videoJs: {
      status: "future_phase",
      strengths: ["simple web player", "broad ecosystem"],
    },
    realPlayerImplemented: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
