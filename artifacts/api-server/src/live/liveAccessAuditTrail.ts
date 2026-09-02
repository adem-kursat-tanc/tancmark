import type { LivePlaybackRiskLevel } from "./livePlaybackAuthorizationMock";

export type LiveAccessAuditEventType =
  | "viewer.session.created"
  | "viewer.access.allowed"
  | "viewer.access.denied"
  | "viewer.token.expired"
  | "viewer.domain.blocked"
  | "viewer.referrer.blocked"
  | "viewer.drm.required.future";

export const LIVE_ACCESS_AUDIT_DECISION_ROLE =
  "live_access_audit_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveAccessAuditInput {
  liveSessionId: string;
  viewerSessionId?: string;
  eventType?: LiveAccessAuditEventType;
  riskLevel?: LivePlaybackRiskLevel;
}

export interface LiveAccessAuditEvent {
  timestamp: string;
  liveSessionId: string;
  viewerSessionId: string;
  eventType: LiveAccessAuditEventType;
  riskLevel: LivePlaybackRiskLevel;
  realAccessEnforced: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_ACCESS_AUDIT_DECISION_ROLE;
}

const auditEventsByLiveSession = new Map<string, LiveAccessAuditEvent[]>();

function nowIso(): string {
  return new Date().toISOString();
}

function parseEventType(value: unknown): LiveAccessAuditEventType {
  if (
    value === "viewer.access.allowed" ||
    value === "viewer.access.denied" ||
    value === "viewer.token.expired" ||
    value === "viewer.domain.blocked" ||
    value === "viewer.referrer.blocked" ||
    value === "viewer.drm.required.future"
  ) {
    return value;
  }
  return "viewer.session.created";
}

function parseRisk(value: unknown): LivePlaybackRiskLevel {
  if (value === "medium" || value === "high") return value;
  return "low";
}

export function resetLiveAccessAuditTrailForTests(): void {
  auditEventsByLiveSession.clear();
}

export function createLiveAccessAuditEvent(input: LiveAccessAuditInput): LiveAccessAuditEvent {
  const event: LiveAccessAuditEvent = {
    timestamp: nowIso(),
    liveSessionId: input.liveSessionId,
    viewerSessionId: input.viewerSessionId?.trim() || "mock-viewer-session",
    eventType: parseEventType(input.eventType),
    riskLevel: parseRisk(input.riskLevel),
    realAccessEnforced: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_ACCESS_AUDIT_DECISION_ROLE,
  };
  const existing = auditEventsByLiveSession.get(input.liveSessionId) ?? [];
  auditEventsByLiveSession.set(input.liveSessionId, [...existing, event]);
  return event;
}

export function listLiveAccessAuditTrail(liveSessionId: string): LiveAccessAuditEvent[] {
  const existing = auditEventsByLiveSession.get(liveSessionId);
  if (existing && existing.length > 0) return existing;
  return [
    createLiveAccessAuditEvent({
      liveSessionId,
      viewerSessionId: "mock-viewer-session",
      eventType: "viewer.session.created",
      riskLevel: "low",
    }),
  ];
}

export function summarizeLiveAccessAuditTrail(liveSessionId: string) {
  const events = listLiveAccessAuditTrail(liveSessionId);
  return {
    liveSessionId,
    eventCount: events.length,
    events,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_ACCESS_AUDIT_DECISION_ROLE,
  };
}
