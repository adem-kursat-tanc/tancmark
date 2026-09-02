import { getLiveAccessPolicies } from "./liveAccessPolicy";
import { summarizeLiveAccessAuditTrail, type LiveAccessAuditEvent } from "./liveAccessAuditTrail";
import { buildLiveDnaAccessLearningBridge } from "./liveDnaAccessLearningBridge";
import { getLiveDomainReferrerPolicy } from "./liveDomainReferrerPolicy";
import { buildLivePlaybackAuthorizationMock } from "./livePlaybackAuthorizationMock";
import { buildLiveSignedUrlMock } from "./liveSignedUrlMock";
import type { TancMarkLiveSession } from "./liveSessionModel";
import { listLiveViewerSessionMocks, type LiveViewerSessionModel } from "./liveViewerSessionModel";

export const LIVE_ACCESS_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_access_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveAccessSecureRoomHandoff {
  liveSessionId: string;
  viewerSessionSummary: {
    viewerSessionCount: number;
    tokenValueExposed: false;
    signedUrlValueExposed: false;
    sessions: LiveViewerSessionModel[];
  };
  accessPolicySummary: {
    accessModeCount: number;
    policies: ReturnType<typeof getLiveAccessPolicies>;
  };
  signedUrlMockSummary: ReturnType<typeof buildLiveSignedUrlMock>;
  playbackAuthorizationSummary: ReturnType<typeof buildLivePlaybackAuthorizationMock>;
  domainReferrerPolicySummary: ReturnType<typeof getLiveDomainReferrerPolicy>;
  accessAuditSummary: ReturnType<typeof summarizeLiveAccessAuditTrail>;
  liveDnaAccessLearningSummary: ReturnType<typeof buildLiveDnaAccessLearningBridge>;
  realAccessEnforced: false;
  realSignedUrlGenerated: false;
  realTokenGenerated: false;
  drmEnabled: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ACCESS_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveAccessSecureRoomHandoff(
  session: TancMarkLiveSession,
  viewerSessions: LiveViewerSessionModel[] = listLiveViewerSessionMocks(session.sessionId),
  auditEvents?: LiveAccessAuditEvent[],
): LiveAccessSecureRoomHandoff {
  const accessAuditSummary = summarizeLiveAccessAuditTrail(session.sessionId);
  const selectedAuditEvents = auditEvents ?? accessAuditSummary.events;
  const liveDnaAccessLearningSummary = buildLiveDnaAccessLearningBridge({
    liveSessionId: session.sessionId,
    viewerSessions,
    auditEvents: selectedAuditEvents,
  });

  return {
    liveSessionId: session.sessionId,
    viewerSessionSummary: {
      viewerSessionCount: viewerSessions.length,
      tokenValueExposed: false,
      signedUrlValueExposed: false,
      sessions: viewerSessions,
    },
    accessPolicySummary: {
      accessModeCount: getLiveAccessPolicies().length,
      policies: getLiveAccessPolicies(),
    },
    signedUrlMockSummary: buildLiveSignedUrlMock({ liveSessionId: session.sessionId }),
    playbackAuthorizationSummary: buildLivePlaybackAuthorizationMock("viewer_allowed"),
    domainReferrerPolicySummary: getLiveDomainReferrerPolicy(),
    accessAuditSummary: {
      ...accessAuditSummary,
      events: selectedAuditEvents,
      eventCount: selectedAuditEvents.length,
    },
    liveDnaAccessLearningSummary,
    realAccessEnforced: false,
    realSignedUrlGenerated: false,
    realTokenGenerated: false,
    drmEnabled: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ACCESS_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
