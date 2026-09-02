import { buildLiveHlsOutputPreview } from "./liveHlsOutputPreview";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_SHAKA_PLAYER_MOCK_DECISION_ROLE =
  "live_shaka_player_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveShakaPlayerMock {
  liveSessionId: string;
  provider: "shaka";
  status: "mock_player_shell";
  realPlayerLoaded: false;
  realStreamLoaded: false;
  hlsUrlPreview: string;
  dashUrlPreviewFuture: string;
  drmEnabled: false;
  drmFuture: true;
  accessBridgeStatus: "mock_only";
  playerEventsPreview: string[];
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SHAKA_PLAYER_MOCK_DECISION_ROLE;
}

export function buildLiveShakaPlayerMock(session: TancMarkLiveSession): LiveShakaPlayerMock {
  const hls = buildLiveHlsOutputPreview(session.engine, session.sessionId);
  return {
    liveSessionId: session.sessionId,
    provider: "shaka",
    status: "mock_player_shell",
    realPlayerLoaded: false,
    realStreamLoaded: false,
    hlsUrlPreview: hls.hlsManifestUrlPreview,
    dashUrlPreviewFuture: `mock://live/${session.sessionId}/dash/manifest.mpd`,
    drmEnabled: false,
    drmFuture: true,
    accessBridgeStatus: "mock_only",
    playerEventsPreview: ["player.loaded", "player.play.requested", "player.buffering"],
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SHAKA_PLAYER_MOCK_DECISION_ROLE,
  };
}
