export const LIVE_PORT_PLAN_DECISION_ROLE =
  "live_engine_port_plan_support_only_no_ports_opened_no_vault_no_confirmed" as const;

export interface LivePortPlanEntry {
  name: string;
  protocol: string;
  portPreview: number;
  publicByDefault: false;
  realPortOpened: false;
  notes: string;
}

export interface LivePortPlan {
  entries: LivePortPlanEntry[];
  prodFirewallRequired: true;
  adminControlPortPublic: false;
  streamKeyTokenLogged: false;
  realFirewallChange: false;
  realPortsOpened: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PORT_PLAN_DECISION_ROLE;
}

export function getLivePortPlan(): LivePortPlan {
  return {
    entries: [
      { name: "RTMP ingest", protocol: "rtmp", portPreview: 1935, publicByDefault: false, realPortOpened: false, notes: "OBS RTMP lab preview." },
      { name: "SRT ingest", protocol: "srt/udp", portPreview: 8890, publicByDefault: false, realPortOpened: false, notes: "SRT lab preview; firewall rule later." },
      { name: "HLS HTTP", protocol: "http", portPreview: 8080, publicByDefault: false, realPortOpened: false, notes: "HLS playback preview only." },
      { name: "WebRTC", protocol: "udp/tcp", portPreview: 8000, publicByDefault: false, realPortOpened: false, notes: "Future WebRTC preview." },
      { name: "API/control", protocol: "http", portPreview: 9997, publicByDefault: false, realPortOpened: false, notes: "Admin/control must not be public." },
      { name: "Metrics/health", protocol: "http", portPreview: 1985, publicByDefault: false, realPortOpened: false, notes: "Health/metrics future preview." },
    ],
    prodFirewallRequired: true,
    adminControlPortPublic: false,
    streamKeyTokenLogged: false,
    realFirewallChange: false,
    realPortsOpened: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PORT_PLAN_DECISION_ROLE,
  };
}
