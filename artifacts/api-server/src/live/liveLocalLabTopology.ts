export const LIVE_LOCAL_LAB_TOPOLOGY_DECISION_ROLE =
  "live_local_lab_topology_support_only_no_vault_no_confirmed" as const;

export interface LiveLocalLabTopology {
  input: readonly string[];
  engine: {
    primary: "srs";
    secondaryLabAlternative: "mediamtx";
    realServerStarted: false;
  };
  processing: {
    ffmpegExternalCli: "future_dry_run_only";
    realFfmpegExecuted: false;
  };
  output: readonly string[];
  recording: readonly string[];
  cacheCdn: {
    atsFuture: true;
    realAtsEnabled: false;
  };
  evidence: {
    secureRoomSupportOnlyHandoff: true;
    canOpenVault: false;
  };
  realBroadcastStarted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_LOCAL_LAB_TOPOLOGY_DECISION_ROLE;
}

export function getLiveLocalLabTopology(): LiveLocalLabTopology {
  return {
    input: ["OBS future", "browser/mobile future", "RTMP ingest preview", "SRT ingest preview", "WebRTC ingest preview"],
    engine: {
      primary: "srs",
      secondaryLabAlternative: "mediamtx",
      realServerStarted: false,
    },
    processing: {
      ffmpegExternalCli: "future_dry_run_only",
      realFfmpegExecuted: false,
    },
    output: ["HLS preview", "WebRTC preview", "own-site player future", "custom RTMP target future"],
    recording: ["short retention preview", "live-to-VOD future"],
    cacheCdn: {
      atsFuture: true,
      realAtsEnabled: false,
    },
    evidence: {
      secureRoomSupportOnlyHandoff: true,
      canOpenVault: false,
    },
    realBroadcastStarted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_LOCAL_LAB_TOPOLOGY_DECISION_ROLE,
  };
}
