export interface LiveAnalyticsPlan {
  analyticsCandidate: "openqoe_future";
  muxDataEquivalentGoal: "raw_viewer_quality_metrics_future";
  realAnalyticsEnabled: false;
  status: "research_only_future_phase";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLiveAnalyticsPlan(): LiveAnalyticsPlan {
  return {
    analyticsCandidate: "openqoe_future",
    muxDataEquivalentGoal: "raw_viewer_quality_metrics_future",
    realAnalyticsEnabled: false,
    status: "research_only_future_phase",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
