export const LIVE_EVENT_DECISION_ROLE = "live_event_support_only_no_vault_no_confirmed" as const;

export type LiveEventSeverity = "info" | "warning" | "error" | "critical";
export type LiveEventSource = "live" | "mock" | "engine" | "target" | "recording" | "vod" | "dna" | "secure_room";

export type LiveEventType =
  | "stream.created"
  | "stream.ready"
  | "stream.started"
  | "stream.stopped"
  | "stream.ended"
  | "stream.error"
  | "stream.health.warning"
  | "stream.health.recovered"
  | "ingest.connected"
  | "ingest.disconnected"
  | "target.connected"
  | "target.failed"
  | "target.recovered"
  | "recording.started"
  | "recording.ready"
  | "recording.failed"
  | "vod.asset.created"
  | "vod.asset.ready"
  | "watermark.preseal.planned"
  | "watermark.test.result.future"
  | "ffmpeg.dryrun.created"
  | "engine.config.previewed"
  | "ats.cache.warning.future"
  | "drm.license.error.future";

export interface LiveEventTypeDefinition {
  eventType: LiveEventType;
  defaultSeverity: LiveEventSeverity;
  source: LiveEventSource;
  description: string;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EVENT_DECISION_ROLE;
}

export interface LiveEventRecord {
  eventId: string;
  eventType: LiveEventType;
  liveSessionId: string;
  severity: LiveEventSeverity;
  source: LiveEventSource;
  timestamp: string;
  message: string;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EVENT_DECISION_ROLE;
}

const definitions: LiveEventTypeDefinition[] = [
  event("stream.created", "info", "live", "Mock live session created."),
  event("stream.ready", "info", "live", "Mock stream is ready."),
  event("stream.started", "info", "live", "Mock stream started."),
  event("stream.stopped", "info", "live", "Mock stream stopped."),
  event("stream.ended", "info", "live", "Mock stream ended."),
  event("stream.error", "error", "live", "Mock stream error preview."),
  event("stream.health.warning", "warning", "mock", "Mock health warning preview."),
  event("stream.health.recovered", "info", "mock", "Mock health recovery preview."),
  event("ingest.connected", "info", "engine", "Mock ingest connected."),
  event("ingest.disconnected", "warning", "engine", "Mock ingest disconnected."),
  event("target.connected", "info", "target", "Mock target connected."),
  event("target.failed", "error", "target", "Mock target failed."),
  event("target.recovered", "info", "target", "Mock target recovered."),
  event("recording.started", "info", "recording", "Mock recording started."),
  event("recording.ready", "info", "recording", "Mock recording ready."),
  event("recording.failed", "error", "recording", "Mock recording failed."),
  event("vod.asset.created", "info", "vod", "Mock VOD asset created."),
  event("vod.asset.ready", "info", "vod", "Mock VOD asset ready."),
  event("watermark.preseal.planned", "info", "dna", "Pre-seal planning signal only."),
  event("watermark.test.result.future", "info", "dna", "Future watermark test result signal."),
  event("ffmpeg.dryrun.created", "info", "mock", "FFmpeg dry-run command created."),
  event("engine.config.previewed", "info", "engine", "Engine config preview generated."),
  event("ats.cache.warning.future", "warning", "mock", "Future ATS cache warning signal."),
  event("drm.license.error.future", "error", "mock", "Future DRM license error signal."),
];

export function getLiveEventTypeDefinitions(): LiveEventTypeDefinition[] {
  return definitions;
}

export function getLiveEventTypeDefinition(eventType: LiveEventType): LiveEventTypeDefinition {
  return definitions.find((entry) => entry.eventType === eventType) ?? definitions[0];
}

function event(
  eventType: LiveEventType,
  defaultSeverity: LiveEventSeverity,
  source: LiveEventSource,
  description: string,
): LiveEventTypeDefinition {
  return {
    eventType,
    defaultSeverity,
    source,
    description,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EVENT_DECISION_ROLE,
  };
}
