import { buildLiveEmbedCodePreview } from "./liveEmbedCodePreview";
import { buildLivePlayerAccessBridge } from "./livePlayerAccessBridge";
import { listLivePlayerEventMocks } from "./livePlayerEventMock";
import { getLivePlayerProviderMatrix } from "./livePlayerProviderMatrix";
import { buildLivePlayerQoEPreview } from "./livePlayerQoEPreview";
import { buildLivePlaybackPageMock } from "./livePlaybackPageMock";
import type { TancMarkLiveSession } from "./liveSessionModel";
import { listLiveViewerSessionMocks } from "./liveViewerSessionModel";

export const LIVE_PLAYER_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_player_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlayerSecureRoomHandoff {
  liveSessionId: string;
  playbackPageSummary: ReturnType<typeof buildLivePlaybackPageMock>;
  embedCodeSummary: ReturnType<typeof buildLiveEmbedCodePreview>;
  playerProviderSummary: {
    providerCount: number;
    providers: ReturnType<typeof getLivePlayerProviderMatrix>;
  };
  playerEventSummary: {
    eventCount: number;
    events: ReturnType<typeof listLivePlayerEventMocks>;
  };
  playerQoESummary: ReturnType<typeof buildLivePlayerQoEPreview>;
  playerAccessBridgeSummary: ReturnType<typeof buildLivePlayerAccessBridge>;
  realPlayerLoaded: false;
  realStreamLoaded: false;
  realPlaybackEnabled: false;
  realAccessEnforced: false;
  drmEnabled: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_PLAYER_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLivePlayerSecureRoomHandoff(session: TancMarkLiveSession): LivePlayerSecureRoomHandoff {
  const providers = getLivePlayerProviderMatrix();
  const events = listLivePlayerEventMocks(session.sessionId);
  return {
    liveSessionId: session.sessionId,
    playbackPageSummary: buildLivePlaybackPageMock(session),
    embedCodeSummary: buildLiveEmbedCodePreview({ liveSessionId: session.sessionId }),
    playerProviderSummary: {
      providerCount: providers.length,
      providers,
    },
    playerEventSummary: {
      eventCount: events.length,
      events,
    },
    playerQoESummary: buildLivePlayerQoEPreview(session),
    playerAccessBridgeSummary: buildLivePlayerAccessBridge(session, listLiveViewerSessionMocks(session.sessionId)),
    realPlayerLoaded: false,
    realStreamLoaded: false,
    realPlaybackEnabled: false,
    realAccessEnforced: false,
    drmEnabled: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_PLAYER_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
