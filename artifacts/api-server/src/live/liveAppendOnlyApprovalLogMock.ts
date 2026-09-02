import { buildLiveApprovalActorPreview, type LiveApprovalActorPreview } from "./liveApprovalActorPreview";
import { buildLiveApprovalScopePreview, type LiveApprovalScopePreview } from "./liveApprovalScopePreview";

export type LiveAppendOnlyApprovalEventType =
  | "approval.identity.previewed"
  | "approval.scope.previewed"
  | "approval.risk.previewed"
  | "approval.required.mock"
  | "approval.not_granted.mock"
  | "approval.real_test.future";

export interface LiveAppendOnlyApprovalLogEntryMock {
  logEntryId: string;
  sequenceNumber: number;
  previousHashPreview: string;
  currentHashPreview: string;
  eventType: LiveAppendOnlyApprovalEventType;
  liveSessionId: string;
  actorPreview: LiveApprovalActorPreview;
  scopePreview: LiveApprovalScopePreview;
  timestampPreview: string;
  immutablePreview: true;
  realApprovalGranted: false;
  canStartRealSmoke: false;
  supportOnly: true;
}

export interface LiveAppendOnlyApprovalLogMock {
  liveSessionId: string;
  appendOnlyPreview: true;
  realAppendOnlyStorage: false;
  deleteAllowed: false;
  updateAllowed: false;
  entries: LiveAppendOnlyApprovalLogEntryMock[];
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

const EVENTS: LiveAppendOnlyApprovalEventType[] = [
  "approval.identity.previewed",
  "approval.scope.previewed",
  "approval.risk.previewed",
  "approval.required.mock",
  "approval.not_granted.mock",
  "approval.real_test.future",
];

export function buildLiveAppendOnlyApprovalLogMock(liveSessionId: string): LiveAppendOnlyApprovalLogMock {
  const actorPreview = buildLiveApprovalActorPreview(liveSessionId);
  const scopePreview = buildLiveApprovalScopePreview(liveSessionId, "youtube");
  let previousHashPreview = "GENESIS_APPROVAL_AUDIT_HASH_PREVIEW";
  const entries = EVENTS.map((eventType, index) => {
    const sequenceNumber = index + 1;
    const currentHashPreview = mockHash(liveSessionId, sequenceNumber, eventType, previousHashPreview);
    const entry: LiveAppendOnlyApprovalLogEntryMock = {
      logEntryId: `approval_log_mock_${String(sequenceNumber).padStart(3, "0")}`,
      sequenceNumber,
      previousHashPreview,
      currentHashPreview,
      eventType,
      liveSessionId,
      actorPreview,
      scopePreview,
      timestampPreview: new Date(Date.parse("2026-06-19T00:00:00.000Z") + index * 60_000).toISOString(),
      immutablePreview: true,
      realApprovalGranted: false,
      canStartRealSmoke: false,
      supportOnly: true,
    };
    previousHashPreview = currentHashPreview;
    return entry;
  });

  return {
    liveSessionId,
    appendOnlyPreview: true,
    realAppendOnlyStorage: false,
    deleteAllowed: false,
    updateAllowed: false,
    entries,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

export function mockHash(
  liveSessionId: string,
  sequenceNumber: number,
  eventType: string,
  previousHashPreview: string,
): string {
  const raw = `${liveSessionId}:${sequenceNumber}:${eventType}:${previousHashPreview}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `MOCK_HASH_${hash.toString(16).padStart(8, "0")}`;
}
