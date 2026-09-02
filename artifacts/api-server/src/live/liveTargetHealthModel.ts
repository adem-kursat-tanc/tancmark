import type { LiveTargetModel, LiveTargetType } from "./liveTargetModel";

export const LIVE_TARGET_HEALTH_DECISION_ROLE =
  "live_target_health_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetHealthEntry {
  targetId: string;
  targetType: LiveTargetType;
  status: "mock_healthy" | "mock_warning" | "mock_failed" | "future_preview";
  lastEvent: "target.connected" | "target.failed" | "target.recovered" | "target.future";
  failureReasonPreview: string | null;
  retryPolicyPreview: "mock_retry_planned" | "future_provider_specific" | "none";
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_HEALTH_DECISION_ROLE;
}

export interface LiveTargetHealthModel {
  liveSessionId: string;
  targets: LiveTargetHealthEntry[];
  realTargetPolling: false;
  realSocialConnection: false;
  realWebhookSent: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_HEALTH_DECISION_ROLE;
}

const defaultTargetTypes: LiveTargetType[] = [
  "youtube",
  "facebook",
  "twitch",
  "custom_rtmp",
  "future_tiktok",
  "future_instagram",
];

function healthFor(target: LiveTargetModel | { targetId: string; targetType: LiveTargetType }): LiveTargetHealthEntry {
  const future = target.targetType === "future_tiktok" || target.targetType === "future_instagram";
  return {
    targetId: target.targetId,
    targetType: target.targetType,
    status: future ? "future_preview" : target.targetType === "custom_rtmp" ? "mock_warning" : "mock_healthy",
    lastEvent: future ? "target.future" : target.targetType === "custom_rtmp" ? "target.failed" : "target.connected",
    failureReasonPreview: target.targetType === "custom_rtmp" ? "custom_rtmp_retry_preview" : null,
    retryPolicyPreview: future ? "future_provider_specific" : target.targetType === "custom_rtmp" ? "mock_retry_planned" : "none",
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_HEALTH_DECISION_ROLE,
  };
}

export function buildLiveTargetHealthModel(liveSessionId: string, targets: LiveTargetModel[] = []): LiveTargetHealthModel {
  const targetEntries =
    targets.length > 0
      ? targets.map(healthFor)
      : defaultTargetTypes.map((targetType, index) => healthFor({ targetId: `target_health_mock_${index + 1}`, targetType }));
  return {
    liveSessionId,
    targets: targetEntries,
    realTargetPolling: false,
    realSocialConnection: false,
    realWebhookSent: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_HEALTH_DECISION_ROLE,
  };
}
