import { buildLivePlaybackAuthorizationMock } from "./livePlaybackAuthorizationMock";
import { buildLiveSignedUrlMock } from "./liveSignedUrlMock";
import type { TancMarkLiveSession } from "./liveSessionModel";
import { listLiveViewerSessionMocks, type LiveViewerSessionModel } from "./liveViewerSessionModel";

export const LIVE_PLAYER_ACCESS_BRIDGE_DECISION_ROLE =
  "live_player_access_bridge_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlayerAccessBridge {
  liveSessionId: string;
  viewerSessionId: string;
  accessStatusPreview: string;
  signedUrlRequired: boolean;
  signedUrlMockPresent: boolean;
  tokenValueExposed: false;
  signedUrlValueExposed: false;
  playerAllowedPreview: boolean;
  denialReasonPreview: string | null;
  realAccessEnforced: false;
  realSignedUrlGenerated: false;
  realTokenGenerated: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PLAYER_ACCESS_BRIDGE_DECISION_ROLE;
}

export function buildLivePlayerAccessBridge(
  session: TancMarkLiveSession,
  viewerSessions: LiveViewerSessionModel[] = listLiveViewerSessionMocks(session.sessionId),
): LivePlayerAccessBridge {
  const viewerSession = viewerSessions[0];
  const signedUrl = buildLiveSignedUrlMock({
    liveSessionId: session.sessionId,
    viewerSessionId: viewerSession?.viewerSessionId,
  });
  const authorization = buildLivePlaybackAuthorizationMock(
    viewerSession?.accessStatusPreview === "denied" ? "viewer_denied" : "viewer_allowed",
  );
  const signedUrlRequired = viewerSession?.accessMode === "signed_url_required_mock";
  return {
    liveSessionId: session.sessionId,
    viewerSessionId: viewerSession?.viewerSessionId ?? "mock-viewer-session",
    accessStatusPreview: viewerSession?.accessStatusPreview ?? "mock_only",
    signedUrlRequired,
    signedUrlMockPresent: signedUrlRequired || Boolean(viewerSession?.signedUrlPresent),
    tokenValueExposed: false,
    signedUrlValueExposed: false,
    playerAllowedPreview: authorization.authorizedPreview,
    denialReasonPreview: authorization.authorizedPreview ? null : authorization.reason,
    realAccessEnforced: false,
    realSignedUrlGenerated: false,
    realTokenGenerated: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PLAYER_ACCESS_BRIDGE_DECISION_ROLE,
  };
}
