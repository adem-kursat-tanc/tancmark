export const LIVE_ENGINE_COMPATIBILITY_DECISION_ROLE =
  "live_engine_compatibility_support_only_no_vault_no_confirmed" as const;

export interface LiveEngineCompatibilityEntry {
  provider: "srs" | "mediamtx";
  candidateRole: "primary_engine_candidate" | "secondary_lab_lightweight_candidate";
  inputSupport: readonly string[];
  outputSupport: readonly string[];
  recordingSupport: string;
  controlApi: string;
  operationalComplexity: "medium_high" | "low_medium";
  license: "MIT";
  bestUse: string;
  risk: string;
  nextTestRecommendation: string;
  providesTancMarkForensicWatermark: false;
  requiresFutureRealLab: true;
}

export interface LiveEngineCompatibilityMatrix {
  entries: LiveEngineCompatibilityEntry[];
  shortDecision: {
    srs: "primary engine candidate";
    mediamtx: "secondary/lab/lightweight candidate";
    bothProvideTancMarkWatermark: false;
    bothNeedRealLab: true;
  };
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_ENGINE_COMPATIBILITY_DECISION_ROLE;
}

export function getLiveEngineCompatibilityMatrix(): LiveEngineCompatibilityMatrix {
  return {
    entries: [
      {
        provider: "srs",
        candidateRole: "primary_engine_candidate",
        inputSupport: ["RTMP", "SRT future lab", "WebRTC future lab"],
        outputSupport: ["HLS", "DASH future", "HTTP-FLV future"],
        recordingSupport: "planned_or_adapter_dependent",
        controlApi: "health/api future preview",
        operationalComplexity: "medium_high",
        license: "MIT",
        bestUse: "Primary engine candidate for Mux-like live core lab.",
        risk: "Operational complexity and real deployment behavior must be tested.",
        nextTestRecommendation: "SRS local lab config dry-run first, then real lab only with approval.",
        providesTancMarkForensicWatermark: false,
        requiresFutureRealLab: true,
      },
      {
        provider: "mediamtx",
        candidateRole: "secondary_lab_lightweight_candidate",
        inputSupport: ["RTMP", "SRT", "WebRTC"],
        outputSupport: ["HLS", "WebRTC"],
        recordingSupport: "built_in_candidate_future_lab",
        controlApi: "control API future preview",
        operationalComplexity: "low_medium",
        license: "MIT",
        bestUse: "Secondary/lab/lightweight candidate for quick ingest and playback tests.",
        risk: "Feature depth and production scaling must be tested against SRS.",
        nextTestRecommendation: "MediaMTX local lab config dry-run first, then lightweight real lab only with approval.",
        providesTancMarkForensicWatermark: false,
        requiresFutureRealLab: true,
      },
    ],
    shortDecision: {
      srs: "primary engine candidate",
      mediamtx: "secondary/lab/lightweight candidate",
      bothProvideTancMarkWatermark: false,
      bothNeedRealLab: true,
    },
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_ENGINE_COMPATIBILITY_DECISION_ROLE,
  };
}
