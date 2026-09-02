export const LIVE_APPROVAL_SCOPE_PREVIEW_DECISION_ROLE =
  "live_approval_scope_preview_support_only_no_vault_no_confirmed" as const;

export type LiveApprovalTargetTypePreview = "youtube" | "custom_rtmp";

export interface LiveApprovalScopePreview {
  liveSessionId: string;
  targetTypePreview: LiveApprovalTargetTypePreview;
  durationLimitPreview: "short_single_target_lab_only";
  realSecretRequiredFuture: true;
  rollbackRequired: true;
  costApprovalRequired: true;
  securityReviewRequired: true;
  operatorRunbookRequired: true;
  recordingVodCheckRequired: true;
  postTestReportRequired: true;
  vaultImpact: "none";
  supportOnly: true;
  realApprovalGranted: false;
  realSmokeAllowed: false;
  canProceedToRealBroadcast: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_SCOPE_PREVIEW_DECISION_ROLE;
}

export function buildLiveApprovalScopePreview(
  liveSessionId: string,
  targetType?: unknown,
): LiveApprovalScopePreview {
  return {
    liveSessionId,
    targetTypePreview: normalizeTargetType(targetType),
    durationLimitPreview: "short_single_target_lab_only",
    realSecretRequiredFuture: true,
    rollbackRequired: true,
    costApprovalRequired: true,
    securityReviewRequired: true,
    operatorRunbookRequired: true,
    recordingVodCheckRequired: true,
    postTestReportRequired: true,
    vaultImpact: "none",
    supportOnly: true,
    realApprovalGranted: false,
    realSmokeAllowed: false,
    canProceedToRealBroadcast: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_SCOPE_PREVIEW_DECISION_ROLE,
  };
}

function normalizeTargetType(targetType?: unknown): LiveApprovalTargetTypePreview {
  return String(targetType ?? "").toLowerCase().includes("custom") ? "custom_rtmp" : "youtube";
}
