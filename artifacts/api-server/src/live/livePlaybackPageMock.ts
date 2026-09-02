import { parseLiveAccessMode, type LiveAccessMode } from "./liveAccessPolicy";
import { buildLiveHlsOutputPreview } from "./liveHlsOutputPreview";
import type { LivePlayerProviderName } from "./livePlayerProviderMatrix";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_PLAYBACK_PAGE_MOCK_DECISION_ROLE =
  "live_playback_page_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlaybackPageMock {
  liveSessionId: string;
  playbackPageId: string;
  pageStatus: "mock_ready";
  playerProviderPreview: LivePlayerProviderName;
  titlePreview: string;
  posterPreview: string;
  hlsUrlPreview: string;
  accessModePreview: LiveAccessMode;
  signedUrlRequiredPreview: boolean;
  drmRequiredFuture: boolean;
  viewerSessionRequiredPreview: true;
  embedAvailablePreview: true;
  realPlaybackEnabled: false;
  realPlayerLoaded: false;
  realStreamLoaded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PLAYBACK_PAGE_MOCK_DECISION_ROLE;
}

export function buildLivePlaybackPageMock(
  session: TancMarkLiveSession,
  providerInput?: unknown,
  accessModeInput?: unknown,
): LivePlaybackPageMock {
  const provider: LivePlayerProviderName = providerInput === "shaka" ? "shaka" : "videojs";
  const accessMode = parseLiveAccessMode(accessModeInput);
  const hls = buildLiveHlsOutputPreview(session.engine, session.sessionId);
  return {
    liveSessionId: session.sessionId,
    playbackPageId: `playback_page_mock_${session.sessionId}`,
    pageStatus: "mock_ready",
    playerProviderPreview: provider,
    titlePreview: `TancMark Live Mock - ${session.docId}`,
    posterPreview: `mock://live/${session.sessionId}/poster.jpg`,
    hlsUrlPreview: hls.hlsManifestUrlPreview,
    accessModePreview: accessMode,
    signedUrlRequiredPreview: accessMode === "signed_url_required_mock",
    drmRequiredFuture: accessMode === "drm_required_future",
    viewerSessionRequiredPreview: true,
    embedAvailablePreview: true,
    realPlaybackEnabled: false,
    realPlayerLoaded: false,
    realStreamLoaded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PLAYBACK_PAGE_MOCK_DECISION_ROLE,
  };
}
