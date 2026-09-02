export type LivePlayerEventType =
  | "player.loaded"
  | "player.play.requested"
  | "player.play.started"
  | "player.buffering"
  | "player.error"
  | "player.ended"
  | "player.access.denied"
  | "player.token.expired"
  | "player.drm.required.future";

export type LivePlayerEventSeverity = "info" | "warning" | "error";

export const LIVE_PLAYER_EVENT_MOCK_DECISION_ROLE =
  "live_player_event_mock_support_only_no_vault_no_confirmed" as const;

export interface LivePlayerEventMockInput {
  liveSessionId: string;
  viewerSessionId?: string;
  eventType?: LivePlayerEventType;
  severity?: LivePlayerEventSeverity;
}

export interface LivePlayerEventMock {
  eventId: string;
  liveSessionId: string;
  viewerSessionId: string;
  eventType: LivePlayerEventType;
  severity: LivePlayerEventSeverity;
  timestamp: string;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_PLAYER_EVENT_MOCK_DECISION_ROLE;
}

const playerEventsBySession = new Map<string, LivePlayerEventMock[]>();
let playerEventCounter = 0;

function nextEventId(): string {
  playerEventCounter += 1;
  return `live_player_event_mock_${String(playerEventCounter).padStart(5, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeSessionId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_session";
}

function parseEventType(value: unknown): LivePlayerEventType {
  if (
    value === "player.loaded" ||
    value === "player.play.requested" ||
    value === "player.play.started" ||
    value === "player.buffering" ||
    value === "player.error" ||
    value === "player.ended" ||
    value === "player.access.denied" ||
    value === "player.token.expired" ||
    value === "player.drm.required.future"
  ) {
    return value;
  }
  return "player.loaded";
}

function parseSeverity(value: unknown, eventType: LivePlayerEventType): LivePlayerEventSeverity {
  if (value === "warning" || value === "error" || value === "info") return value;
  if (eventType === "player.error" || eventType === "player.access.denied") return "error";
  if (eventType === "player.buffering" || eventType === "player.token.expired") return "warning";
  return "info";
}

export function resetLivePlayerEventsForTests(): void {
  playerEventsBySession.clear();
  playerEventCounter = 0;
}

export function createLivePlayerEventMock(input: LivePlayerEventMockInput): LivePlayerEventMock {
  const liveSessionId = safeSessionId(input.liveSessionId);
  const eventType = parseEventType(input.eventType);
  const event: LivePlayerEventMock = {
    eventId: nextEventId(),
    liveSessionId,
    viewerSessionId: input.viewerSessionId?.trim() || "mock-viewer-session",
    eventType,
    severity: parseSeverity(input.severity, eventType),
    timestamp: nowIso(),
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_PLAYER_EVENT_MOCK_DECISION_ROLE,
  };
  const existing = playerEventsBySession.get(liveSessionId) ?? [];
  playerEventsBySession.set(liveSessionId, [...existing, event]);
  return event;
}

export function listLivePlayerEventMocks(liveSessionId: string): LivePlayerEventMock[] {
  return playerEventsBySession.get(safeSessionId(liveSessionId)) ?? [];
}
