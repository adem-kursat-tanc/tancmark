export const LIVE_ATS_DEPLOYMENT_PLAN_DECISION_ROLE =
  "ats_deployment_plan_only_no_vault_no_confirmed" as const;

export interface LiveAtsDeploymentPlan {
  planName: "live_ats_deployment_plan";
  status: "blueprint_mock_first";
  phases: string[];
  origin: "SRS/MediaMTX/HLS origin";
  cacheInvalidationPlan: string[];
  purgePlan: string[];
  loggingPlan: string[];
  monitoringPlan: string[];
  rollbackPlan: string[];
  realAtsServerProvisioned: false;
  realTrafficServed: false;
  productionDeployEnabled: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ATS_DEPLOYMENT_PLAN_DECISION_ROLE;
}

export function getLiveAtsDeploymentPlan(): LiveAtsDeploymentPlan {
  return {
    planName: "live_ats_deployment_plan",
    status: "blueprint_mock_first",
    phases: ["local mock", "staging ATS", "single edge ATS", "multi-edge future"],
    origin: "SRS/MediaMTX/HLS origin",
    cacheInvalidationPlan: [
      "Define manifest TTL separately from segment TTL.",
      "Keep low TTL for live playlists.",
      "Use explicit purge keys for session/VOD asset groups in a future lab.",
    ],
    purgePlan: [
      "Mock-only purge contract first.",
      "Staging purge smoke test before production.",
      "Emergency rollback to direct origin delivery.",
    ],
    loggingPlan: [
      "Log cache hit/miss without personal viewer tokens.",
      "Log origin latency and edge latency only as operational metrics.",
      "Never log stream keys, DRM license secrets or live watermark ID secrets.",
    ],
    monitoringPlan: [
      "Measure cache hit ratio.",
      "Measure origin load reduction.",
      "Measure edge latency.",
      "Track playback errors without changing TancMark ID decisions.",
    ],
    rollbackPlan: [
      "Disable ATS route and serve directly from origin.",
      "Purge affected assets.",
      "Preserve evidence logs as support-only operational records.",
    ],
    realAtsServerProvisioned: false,
    realTrafficServed: false,
    productionDeployEnabled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ATS_DEPLOYMENT_PLAN_DECISION_ROLE,
  };
}
