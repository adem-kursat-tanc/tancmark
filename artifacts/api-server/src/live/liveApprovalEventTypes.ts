export type LiveApprovalEventType =
  | "approval.required.preview"
  | "approval.scope.previewed"
  | "approval.pending.mock"
  | "approval.not_granted.mock"
  | "approval.blocked.no_secret.mock"
  | "approval.blocked.no_real_lab.mock"
  | "approval.blocked.no_cost_approval.mock"
  | "approval.blocked.no_security_review.mock"
  | "approval.ready_for_human_review.mock"
  | "approval.real_test.future";

export type LiveApprovalActorPreview = "system" | "operator" | "future_admin";

export interface LiveApprovalAuditEvent {
  eventId: string;
  liveSessionId: string;
  eventType: LiveApprovalEventType;
  timestamp: string;
  actorPreview: LiveApprovalActorPreview;
  summary: string;
  supportOnly: true;
  realApprovalGranted: false;
  canStartRealSmoke: false;
  canOpenVault: false;
}

const APPROVAL_EVENT_TYPES: Array<{
  eventType: LiveApprovalEventType;
  actorPreview: LiveApprovalActorPreview;
  summary: string;
}> = [
  {
    eventType: "approval.required.preview",
    actorPreview: "system",
    summary: "Real smoke test icin gelecekte acik insan onayi gerekecegi gosterildi.",
  },
  {
    eventType: "approval.scope.previewed",
    actorPreview: "system",
    summary: "Onay kapsaminda hedef, sure, rollback, maliyet ve guvenlik gereklilikleri preview edildi.",
  },
  {
    eventType: "approval.pending.mock",
    actorPreview: "operator",
    summary: "Operator review bekleniyor gibi mock kayit uretildi; gercek onay alinmadi.",
  },
  {
    eventType: "approval.not_granted.mock",
    actorPreview: "operator",
    summary: "Bu fazda onay verilmemis kabul edilir.",
  },
  {
    eventType: "approval.blocked.no_secret.mock",
    actorPreview: "system",
    summary: "Gercek secret handling ve secret manager olmadigi icin real test bloklu.",
  },
  {
    eventType: "approval.blocked.no_real_lab.mock",
    actorPreview: "system",
    summary: "Real SRS/MediaMTX/OBS/HLS lab hazir olmadigi icin real test bloklu.",
  },
  {
    eventType: "approval.blocked.no_cost_approval.mock",
    actorPreview: "future_admin",
    summary: "Bant genisligi, CPU ve provider cost onayi olmadan real test bloklu.",
  },
  {
    eventType: "approval.blocked.no_security_review.mock",
    actorPreview: "future_admin",
    summary: "Secret, webhook, target ve VAULT etkisizlik guvenlik review'u eksik.",
  },
  {
    eventType: "approval.ready_for_human_review.mock",
    actorPreview: "system",
    summary: "Mock readiness insan incelemesine hazir; real approval/workflow degildir.",
  },
  {
    eventType: "approval.real_test.future",
    actorPreview: "future_admin",
    summary: "Gercek smoke test yalniz ayrik gelecek onay ve lab kapsaminda dusunulebilir.",
  },
];

export function getLiveApprovalEventTypes(): LiveApprovalEventType[] {
  return APPROVAL_EVENT_TYPES.map((event) => event.eventType);
}

export function buildLiveApprovalAuditEvents(liveSessionId: string): LiveApprovalAuditEvent[] {
  const baseTime = Date.parse("2026-06-19T00:00:00.000Z");
  return APPROVAL_EVENT_TYPES.map((event, index) => ({
    eventId: `approval_audit_mock_${String(index + 1).padStart(2, "0")}`,
    liveSessionId,
    eventType: event.eventType,
    timestamp: new Date(baseTime + index * 60_000).toISOString(),
    actorPreview: event.actorPreview,
    summary: event.summary,
    supportOnly: true,
    realApprovalGranted: false,
    canStartRealSmoke: false,
    canOpenVault: false,
  }));
}
