import { seedDefaultLiveMockEvents, type LiveEventBusMockResult } from "./liveEventBusMock";
import type { LiveEventRecord } from "./liveEventTypes";

export const LIVE_EVENT_TIMELINE_DECISION_ROLE =
  "live_event_timeline_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveEventTimeline {
  liveSessionId: string;
  events: LiveEventRecord[];
  eventCount: number;
  warningCount: number;
  errorCount: number;
  realEventPublished: false;
  realWebhookSent: false;
  realNetworkCall: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EVENT_TIMELINE_DECISION_ROLE;
}

function eventListFrom(value: LiveEventRecord[] | LiveEventBusMockResult[] | undefined): LiveEventRecord[] {
  if (!value) return [];
  return value.map((entry) => ("event" in entry ? entry.event : entry));
}

export function buildLiveEventTimeline(
  liveSessionId: string,
  events?: LiveEventRecord[] | LiveEventBusMockResult[],
): LiveEventTimeline {
  const list = eventListFrom(events);
  const finalEvents = list.length > 0 ? list : seedDefaultLiveMockEvents(liveSessionId);
  return {
    liveSessionId,
    events: finalEvents,
    eventCount: finalEvents.length,
    warningCount: finalEvents.filter((event) => event.severity === "warning").length,
    errorCount: finalEvents.filter((event) => event.severity === "error" || event.severity === "critical").length,
    realEventPublished: false,
    realWebhookSent: false,
    realNetworkCall: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EVENT_TIMELINE_DECISION_ROLE,
  };
}
