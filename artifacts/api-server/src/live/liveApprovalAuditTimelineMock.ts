import { buildLiveApprovalAuditEvents, type LiveApprovalAuditEvent } from "./liveApprovalEventTypes";

export const LIVE_APPROVAL_AUDIT_TIMELINE_DECISION_ROLE =
  "live_approval_audit_timeline_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalAuditTimelineMock {
  liveSessionId: string;
  timelineStatus: "mock_readonly";
  realApprovalGranted: false;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  approvalEvents: LiveApprovalAuditEvent[];
  requiredApprovalPhrasePreview: "APPROVE_LIVE_REAL_SMOKE_TEST";
  approvalPhraseAcceptedNow: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_AUDIT_TIMELINE_DECISION_ROLE;
}

export function buildLiveApprovalAuditTimelineMock(liveSessionId: string): LiveApprovalAuditTimelineMock {
  return {
    liveSessionId,
    timelineStatus: "mock_readonly",
    realApprovalGranted: false,
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    approvalEvents: buildLiveApprovalAuditEvents(liveSessionId),
    requiredApprovalPhrasePreview: "APPROVE_LIVE_REAL_SMOKE_TEST",
    approvalPhraseAcceptedNow: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_AUDIT_TIMELINE_DECISION_ROLE,
  };
}
