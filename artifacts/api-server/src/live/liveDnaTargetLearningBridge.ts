import type { LiveSimulcastPlanMock } from "./liveSimulcastPlanMock";
import type { LiveTargetEventBridge } from "./liveTargetEventBridge";

export const LIVE_DNA_TARGET_LEARNING_DECISION_ROLE =
  "live_dna_target_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveDnaTargetLearningBridgeInput {
  liveSessionId: string;
  targetEvents?: LiveTargetEventBridge;
  simulcastPlan?: LiveSimulcastPlanMock;
}

export interface LiveDnaTargetLearningBridge {
  liveSessionId: string;
  learningSignals: string[];
  learnedFromEvents: number;
  learnedFromTargets: number;
  recommendations: string[];
  approvalPhraseRequired: "APPROVE_LIVE_SAFE_IMPROVEMENT";
  humanApprovalRequired: true;
  autoTargetDisableEnabled: false;
  autoApiConnectionEnabled: false;
  autoStreamKeyRotationEnabled: false;
  autoSocialBroadcastEnabled: false;
  autoPricingEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DNA_TARGET_LEARNING_DECISION_ROLE;
}

export function buildLiveDnaTargetLearningBridge(
  input: LiveDnaTargetLearningBridgeInput,
): LiveDnaTargetLearningBridge {
  const signals = new Set<string>();
  const recommendations = new Set<string>();

  for (const event of input.targetEvents?.events ?? []) {
    if (event.eventType === "target.failed.mock") {
      signals.add("frequent_target_failure");
      recommendations.add("Review target retry policy in an isolated mock lab.");
    }
    if (event.eventType === "simulcast.route.warning") {
      signals.add("simulcast_route_warning");
      recommendations.add("Keep custom RTMP behind explicit real-lab approval.");
    }
    if (event.eventType === "target.connect.previewed") signals.add("target_connection_previewed");
  }

  const selectedTargets = input.simulcastPlan?.selectedTargetsPreview ?? [];
  if (selectedTargets.some((target) => target.targetType === "custom_rtmp_mock")) {
    signals.add("custom_rtmp_risk");
  }
  if (selectedTargets.length > 2) {
    signals.add("simulcast_target_count_cost_risk");
    recommendations.add("Measure target fanout cost before pricing.");
  }
  if (selectedTargets.some((target) => target.streamKeyPresent && !target.streamKeyValueExposed)) {
    signals.add("credential_redaction_ok");
  }
  if (selectedTargets.some((target) => target.targetType === "youtube_mock")) signals.add("youtube_compatibility_note");
  if (selectedTargets.some((target) => target.targetType === "facebook_mock")) signals.add("facebook_compatibility_note");
  if (selectedTargets.some((target) => target.targetType === "twitch_mock")) signals.add("twitch_compatibility_note");

  if (recommendations.size === 0) {
    recommendations.add("Keep collecting target routing mock signals until real provider lab is approved.");
  }

  return {
    liveSessionId: input.liveSessionId,
    learningSignals: Array.from(signals),
    learnedFromEvents: input.targetEvents?.eventCount ?? 0,
    learnedFromTargets: selectedTargets.length,
    recommendations: Array.from(recommendations),
    approvalPhraseRequired: "APPROVE_LIVE_SAFE_IMPROVEMENT",
    humanApprovalRequired: true,
    autoTargetDisableEnabled: false,
    autoApiConnectionEnabled: false,
    autoStreamKeyRotationEnabled: false,
    autoSocialBroadcastEnabled: false,
    autoPricingEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DNA_TARGET_LEARNING_DECISION_ROLE,
  };
}
