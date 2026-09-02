import type { LiveLearningSignalType } from "./liveLearningSignals";

export const LIVE_LEARNING_MEMORY_DECISION_ROLE =
  "live_learning_record_only_no_vault_no_confirmed" as const;

export interface LiveLearningRecord {
  recordId: string;
  source: string;
  signalType: LiveLearningSignalType;
  observedResult: string;
  success: boolean;
  failureReason: string | null;
  confidence: number;
  recommendedNextTest: string;
  humanApprovalRequired: true;
  autoApply: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_LEARNING_MEMORY_DECISION_ROLE;
}

const records: LiveLearningRecord[] = [];

export function resetLiveLearningMemoryForTests(): void {
  records.length = 0;
}

export function recordLiveLearningSignal(
  input: Omit<
    LiveLearningRecord,
    "recordId" | "humanApprovalRequired" | "autoApply" | "canOpenVault" | "confirmed" | "final" | "decisionRole"
  >,
): LiveLearningRecord {
  const record: LiveLearningRecord = {
    ...input,
    recordId: `live-learn-${String(records.length + 1).padStart(4, "0")}`,
    humanApprovalRequired: true,
    autoApply: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_LEARNING_MEMORY_DECISION_ROLE,
  };
  records.push(record);
  return record;
}

export function seedLiveLearningMemoryForMock(): LiveLearningRecord[] {
  resetLiveLearningMemoryForTests();
  return [
    recordLiveLearningSignal({
      source: "mock_srs_target_lab",
      signalType: "custom_rtmp_result",
      observedResult: "Custom RTMP mock route is simpler than social API first-step testing.",
      success: true,
      failureReason: null,
      confidence: 0.72,
      recommendedNextTest: "Test custom RTMP before YouTube or Facebook real provider pilots.",
    }),
    recordLiveLearningSignal({
      source: "mock_ats_cache_plan",
      signalType: "cache_hit_miss",
      observedResult: "ATS cache value cannot be priced until hit/miss and origin load are measured.",
      success: false,
      failureReason: "Real ATS traffic has not been served.",
      confidence: 0.66,
      recommendedNextTest: "Measure ATS cache hit/miss in staging before production routing.",
    }),
    recordLiveLearningSignal({
      source: "mock_provider_readiness",
      signalType: "do_not_retry_solution",
      observedResult: "Provider configs that fail documentation checks should not be retried blindly.",
      success: false,
      failureReason: "Provider documentation or credential readiness missing.",
      confidence: 0.7,
      recommendedNextTest: "Check provider docs and safety gate before another connection attempt.",
    }),
  ];
}

export function listLiveLearningRecords(): LiveLearningRecord[] {
  return [...records];
}
