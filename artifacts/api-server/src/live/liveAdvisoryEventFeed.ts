export interface LiveAdvisoryEvent {
  schemaVersion: "tancmark-live-advisory-event-v1"; eventType: string; sessionId: string; observedAt: string;
  redactedSignals: Record<string, boolean | number | string>; autoApply: false; ownershipAuthority: false; dnaMutationAllowed: false;
}

/** Redacted learning feed only; it cannot mutate canonical DNA or decide ownership. */
export function buildLiveAdvisoryEvent(input: { eventType: string; sessionId: string; signals?: Record<string, boolean | number | string> }): LiveAdvisoryEvent {
  if (!/^[a-z0-9.-]{1,80}$/.test(input.eventType) || !/^[0-9a-f-]{36}$/i.test(input.sessionId)) throw new Error("live_advisory_event_invalid");
  const signals = Object.fromEntries(Object.entries(input.signals ?? {}).filter(([key, value]) => /^[a-zA-Z0-9._-]{1,64}$/.test(key) && (typeof value === "boolean" || typeof value === "number" || (typeof value === "string" && value.length <= 120))).slice(0, 32));
  return { schemaVersion: "tancmark-live-advisory-event-v1", eventType: input.eventType, sessionId: input.sessionId, observedAt: new Date().toISOString(), redactedSignals: signals, autoApply: false, ownershipAuthority: false, dnaMutationAllowed: false };
}
