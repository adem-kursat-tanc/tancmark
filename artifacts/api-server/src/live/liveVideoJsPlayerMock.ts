import { buildLiveHlsOutputPreview } from "./liveHlsOutputPreview";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_VIDEOJS_PLAYER_MOCK_DECISION_ROLE =
  "live_videojs_player_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveVideoJsPlayerMock {
  liveSessionId: string;
  provider: "videojs";
  status: "mock_player_shell";
  realPlayerLoaded: false;
  realStreamLoaded: false;
  hlsUrlPreview: string;
  lowLatencyFuture: true;
  accessBridgeStatus: "mock_only";
  playerEventsPreview: string[];
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_VIDEOJS_PLAYER_MOCK_DECISION_ROLE;
}

export function buildLiveVideoJsPlayerMock(session: TancMarkLiveSession): LiveVideoJsPlayerMock {
  const hls = buildLiveHlsOutputPreview(session.engine, session.sessionId);
  return {
    liveSessionId: session.sessionId,
    provider: "videojs",
    status: "mock_player_shell",
    realPlayerLoaded: false,
    realStreamLoaded: false,
    hlsUrlPreview: hls.hlsManifestUrlPreview,
    lowLatencyFuture: true,
    accessBridgeStatus: "mock_only",
    playerEventsPreview: ["player.loaded", "player.play.requested", "player.buffering"],
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_VIDEOJS_PLAYER_MOCK_DECISION_ROLE,
  };
}
