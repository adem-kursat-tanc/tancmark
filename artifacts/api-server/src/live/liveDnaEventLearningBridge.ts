import type { LiveEventRecord } from "./liveEventTypes";
import type { LiveHealthMonitorMock } from "./liveHealthMonitorMock";
import type { LiveRecordingHealthModel } from "./liveRecordingHealthModel";
import type { LiveTargetHealthModel } from "./liveTargetHealthModel";

export const LIVE_DNA_EVENT_LEARNING_DECISION_ROLE =
  "live_dna_event_learning_support_only_no_vault_no_confirmed" as const;

export interface LiveDnaEventLearningBridgeInput {
  liveSessionId: string;
  events?: LiveEventRecord[];
  health?: LiveHealthMonitorMock;
  targetHealth?: LiveTargetHealthModel;
  recordingHealth?: LiveRecordingHealthModel;
}

export interface LiveDnaEventLearningBridge {
  liveSessionId: string;
  learningSignals: string[];
  learnedFromEvents: number;
  recommendations: string[];
  approvalPhraseRequired: "APPROVE_LIVE_SAFE_IMPROVEMENT";
  humanApprovalRequired: true;
  autoRepairEnabled: false;
  autoPatchEnabled: false;
  autoDeployEnabled: false;
  autoWebhookEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DNA_EVENT_LEARNING_DECISION_ROLE;
}

export function buildLiveDnaEventLearningBridge(
  input: LiveDnaEventLearningBridgeInput,
): LiveDnaEventLearningBridge {
  const signals = new Set<string>();
  const recommendations = new Set<string>();

  for (const event of input.events ?? []) {
    if (event.eventType === "target.failed") {
      signals.add("frequent_target_failure");
      recommendations.add("Review target retry/backoff policy in isolated lab.");
    }
    if (event.eventType === "stream.health.warning") signals.add("health_warning");
    if (event.eventType === "recording.failed") signals.add("recording_failure");
    if (event.eventType === "ffmpeg.dryrun.created") signals.add("ffmpeg_dryrun_risk_review");
    if (event.eventType === "engine.config.previewed") signals.add("engine_config_warning");
    if (event.eventType === "ats.cache.warning.future") signals.add("ats_cache_future_warning");
    if (event.eventType === "watermark.test.result.future") signals.add("watermark_test_future_result");
  }

  if (input.health?.signals.latencyMsPreview && input.health.signals.latencyMsPreview > 1500) {
    signals.add("high_latency");
    recommendations.add("Measure real latency only in approved live lab.");
  }
  if (input.health?.signals.reconnectCountPreview && input.health.signals.reconnectCountPreview > 0) {
    signals.add("too_many_reconnects");
  }
  if (input.health?.signals.ingestBitratePreview && input.health.signals.ingestBitratePreview < 2500) {
    signals.add("low_bitrate");
  }
  if (input.health?.signals.hlsSegmentDelayPreview && input.health.signals.hlsSegmentDelayPreview > 0) {
    signals.add("segment_delay");
  }
  if (input.health?.signals.playerBufferingPreview && input.health.signals.playerBufferingPreview > 0) {
    signals.add("player_buffering");
  }
  if (input.targetHealth?.targets.some((target) => target.status === "mock_warning" || target.status === "mock_failed")) {
    signals.add("target_health_warning");
  }
  if (input.recordingHealth?.segmentWritePreview === "mock_not_started") {
    signals.add("recording_not_started");
  }

  if (recommendations.size === 0) {
    recommendations.add("Keep collecting mock event and health signals until real lab is approved.");
  }

  return {
    liveSessionId: input.liveSessionId,
    learningSignals: Array.from(signals),
    learnedFromEvents: input.events?.length ?? 0,
    recommendations: Array.from(recommendations),
    approvalPhraseRequired: "APPROVE_LIVE_SAFE_IMPROVEMENT",
    humanApprovalRequired: true,
    autoRepairEnabled: false,
    autoPatchEnabled: false,
    autoDeployEnabled: false,
    autoWebhookEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DNA_EVENT_LEARNING_DECISION_ROLE,
  };
}
