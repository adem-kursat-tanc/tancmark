import type { LiveSimulcastPlanMock } from "./liveSimulcastPlanMock";

export type LiveTargetRoutingEventType =
  | "target.created"
  | "target.route.planned"
  | "target.connect.previewed"
  | "target.connected.mock"
  | "target.failed.mock"
  | "target.recovered.mock"
  | "target.disabled.future"
  | "simulcast.plan.created"
  | "simulcast.route.warning";

export const LIVE_TARGET_EVENT_BRIDGE_DECISION_ROLE =
  "live_target_event_bridge_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetRoutingEvent {
  eventId: string;
  liveSessionId: string;
  targetId: string | null;
  eventType: LiveTargetRoutingEventType;
  severity: "info" | "warning" | "error";
  message: string;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_EVENT_BRIDGE_DECISION_ROLE;
}

export interface LiveTargetEventBridge {
  liveSessionId: string;
  events: LiveTargetRoutingEvent[];
  eventCount: number;
  realEventPublished: false;
  realWebhookSent: false;
  realNetworkCall: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_EVENT_BRIDGE_DECISION_ROLE;
}

export function buildLiveTargetEventBridge(
  liveSessionId: string,
  simulcastPlan?: LiveSimulcastPlanMock,
): LiveTargetEventBridge {
  const events: LiveTargetRoutingEvent[] = [
    event(liveSessionId, null, "simulcast.plan.created", "info", "Mock simulcast plan created."),
    event(liveSessionId, null, "target.route.planned", "info", "Mock target route planned."),
    event(liveSessionId, null, "target.connect.previewed", "info", "Mock target connection previewed."),
  ];

  for (const target of simulcastPlan?.selectedTargetsPreview ?? []) {
    events.push(
      event(
        liveSessionId,
        target.targetId,
        target.healthStatusPreview === "mock_warning" ? "target.failed.mock" : "target.connected.mock",
        target.healthStatusPreview === "mock_warning" ? "warning" : "info",
        target.failureReasonPreview ?? `${target.targetName} connection is mock-ready.`,
      ),
    );
  }

  if (simulcastPlan?.targetRiskSummary.customRtmpWarning) {
    events.push(event(liveSessionId, null, "simulcast.route.warning", "warning", "Custom RTMP requires real lab validation."));
  }

  return {
    liveSessionId,
    events,
    eventCount: events.length,
    realEventPublished: false,
    realWebhookSent: false,
    realNetworkCall: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_EVENT_BRIDGE_DECISION_ROLE,
  };
}

function event(
  liveSessionId: string,
  targetId: string | null,
  eventType: LiveTargetRoutingEventType,
  severity: "info" | "warning" | "error",
  message: string,
): LiveTargetRoutingEvent {
  return {
    eventId: `${eventType.replace(/[^a-z0-9]+/gi, "_")}_${liveSessionId}`,
    liveSessionId,
    targetId,
    eventType,
    severity,
    message,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_EVENT_BRIDGE_DECISION_ROLE,
  };
}
