import { buildLiveDnaEventLearningBridge } from "./liveDnaEventLearningBridge";
import { buildLiveEventTimeline } from "./liveEventTimeline";
import { buildLiveHealthMonitorMock } from "./liveHealthMonitorMock";
import { buildLiveRecordingHealthModel } from "./liveRecordingHealthModel";
import { buildLiveTargetHealthModel } from "./liveTargetHealthModel";
import { buildLiveWebhookPayloadPreviewCatalog } from "./liveWebhookPayloadPreview";
import type { LiveTargetModel } from "./liveTargetModel";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_EVENT_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_event_health_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveEventSecureRoomHandoff {
  liveSessionId: string;
  eventSummary: ReturnType<typeof buildLiveEventTimeline>;
  healthSummary: ReturnType<typeof buildLiveHealthMonitorMock>;
  targetHealthSummary: ReturnType<typeof buildLiveTargetHealthModel>;
  recordingHealthSummary: ReturnType<typeof buildLiveRecordingHealthModel>;
  webhookPreviewSummary: {
    payloadCount: number;
    realWebhookSent: false;
    payloadsRedacted: true;
  };
  liveDnaLearningSummary: ReturnType<typeof buildLiveDnaEventLearningBridge>;
  autoRepairEnabled: false;
  autoPatchEnabled: false;
  realWebhookSent: false;
  realBroadcastStarted: false;
  realMediaProcessed: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_EVENT_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

export function buildLiveEventSecureRoomHandoff(
  session: TancMarkLiveSession,
  targets: LiveTargetModel[] = [],
): LiveEventSecureRoomHandoff {
  const eventSummary = buildLiveEventTimeline(session.sessionId);
  const healthSummary = buildLiveHealthMonitorMock(session);
  const targetHealthSummary = buildLiveTargetHealthModel(session.sessionId, targets);
  const recordingHealthSummary = buildLiveRecordingHealthModel(session);
  const webhookPayloads = buildLiveWebhookPayloadPreviewCatalog(session.sessionId);
  const liveDnaLearningSummary = buildLiveDnaEventLearningBridge({
    liveSessionId: session.sessionId,
    events: eventSummary.events,
    health: healthSummary,
    targetHealth: targetHealthSummary,
    recordingHealth: recordingHealthSummary,
  });

  return {
    liveSessionId: session.sessionId,
    eventSummary,
    healthSummary,
    targetHealthSummary,
    recordingHealthSummary,
    webhookPreviewSummary: {
      payloadCount: webhookPayloads.length,
      realWebhookSent: false,
      payloadsRedacted: true,
    },
    liveDnaLearningSummary,
    autoRepairEnabled: false,
    autoPatchEnabled: false,
    realWebhookSent: false,
    realBroadcastStarted: false,
    realMediaProcessed: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_EVENT_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
