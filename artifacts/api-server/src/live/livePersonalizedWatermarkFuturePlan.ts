export interface LivePersonalizedWatermarkFuturePlan {
  personalizedWatermarkEnabled: false;
  abForensicWatermarkEnabled: false;
  status: "future_premium_rd";
  standardsResearchOnly: readonly ["DASH-IF", "ETSI"];
  openSourceProductionReadyAccepted: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function getLivePersonalizedWatermarkFuturePlan(): LivePersonalizedWatermarkFuturePlan {
  return {
    personalizedWatermarkEnabled: false,
    abForensicWatermarkEnabled: false,
    status: "future_premium_rd",
    standardsResearchOnly: ["DASH-IF", "ETSI"],
    openSourceProductionReadyAccepted: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
