import {
  getLiveEventTypeDefinition,
  type LiveEventRecord,
  type LiveEventSeverity,
  type LiveEventSource,
  type LiveEventType,
} from "./liveEventTypes";

export const LIVE_EVENT_BUS_DECISION_ROLE = "live_event_bus_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveMockEventInput {
  liveSessionId: string;
  eventType?: LiveEventType;
  severity?: LiveEventSeverity;
  source?: LiveEventSource;
  message?: string;
}

export interface LiveEventBusMockResult {
  event: LiveEventRecord;
  realEventPublished: false;
  realWebhookSent: false;
  realNetworkCall: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EVENT_BUS_DECISION_ROLE;
}

const eventsBySession = new Map<string, LiveEventRecord[]>();
let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `live_event_mock_${String(eventCounter).padStart(5, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeSessionId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_session";
}

export function resetLiveEventBusMockForTests(): void {
  eventsBySession.clear();
  eventCounter = 0;
}

export function createLiveMockEvent(input: LiveMockEventInput): LiveEventBusMockResult {
  const eventType = input.eventType ?? "stream.started";
  const definition = getLiveEventTypeDefinition(eventType);
  const liveSessionId = safeSessionId(input.liveSessionId);
  const event: LiveEventRecord = {
    eventId: nextEventId(),
    eventType,
    liveSessionId,
    severity: input.severity ?? definition.defaultSeverity,
    source: input.source ?? definition.source,
    timestamp: nowIso(),
    message: input.message?.trim() || definition.description,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: definition.decisionRole,
  };
  const existing = eventsBySession.get(liveSessionId) ?? [];
  eventsBySession.set(liveSessionId, [...existing, event]);
  return {
    event,
    realEventPublished: false,
    realWebhookSent: false,
    realNetworkCall: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EVENT_BUS_DECISION_ROLE,
  };
}

export function listLiveMockEvents(liveSessionId: string): LiveEventRecord[] {
  return eventsBySession.get(safeSessionId(liveSessionId)) ?? [];
}

export function seedDefaultLiveMockEvents(liveSessionId: string): LiveEventRecord[] {
  if (listLiveMockEvents(liveSessionId).length > 0) return listLiveMockEvents(liveSessionId);
  for (const eventType of [
    "stream.created",
    "stream.ready",
    "engine.config.previewed",
    "ffmpeg.dryrun.created",
    "watermark.preseal.planned",
  ] as const) {
    createLiveMockEvent({ liveSessionId, eventType });
  }
  return listLiveMockEvents(liveSessionId);
}
