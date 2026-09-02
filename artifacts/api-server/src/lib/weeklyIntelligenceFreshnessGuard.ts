import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";

export const WEEKLY_INTELLIGENCE_FRESHNESS_GUARD_VERSION =
  "weekly-intelligence-freshness-guard-v0.1" as const;

export interface WeeklyIntelligenceHistoryItem {
  knowledgeId: string;
  dnaName: string;
  topic: string;
  sourceName: string;
  sourceDate: string;
  firstSeenDate: string;
  lastCheckedDate: string;
  isNew: boolean;
  isRepeated: boolean;
  isUpdated: boolean;
  changedSinceLastScan: boolean;
  whyUsefulForTancMark: string;
  actionNeeded: string;
  staleStatus: "fresh" | "repeated" | "updated" | "stale" | "no_meaningful_update";
}

export interface WeeklyIntelligenceFreshnessInput {
  dnaName: string;
  topic: string;
  sourceName: string;
  sourceDate: string;
  whyUsefulForTancMark: string;
  history: readonly WeeklyIntelligenceHistoryItem[];
  changedSinceLastScan?: boolean;
}

export interface WeeklyIntelligenceFreshnessResult {
  guardVersion: typeof WEEKLY_INTELLIGENCE_FRESHNESS_GUARD_VERSION;
  dnaName: string;
  topic: string;
  sourceName: string;
  sourceDate: string;
  isNew: boolean;
  isRepeated: boolean;
  isUpdated: boolean;
  changedSinceLastScan: boolean;
  staleStatus: "fresh" | "repeated" | "updated" | "stale" | "no_meaningful_update";
  actionNeeded: string;
  usefulnessAccepted: boolean;
  reason: string;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function isUseful(value: string): boolean {
  const clean = normalize(value);
  return clean.length >= 16 && !["interesting", "general news", "unknown"].includes(clean);
}

export function evaluateWeeklyIntelligenceFreshness(
  input: WeeklyIntelligenceFreshnessInput,
): WeeklyIntelligenceFreshnessResult {
  const sameTopic = input.history.find(
    (item) =>
      normalize(item.dnaName) === normalize(input.dnaName) &&
      normalize(item.topic) === normalize(input.topic) &&
      normalize(item.sourceName) === normalize(input.sourceName),
  );
  const changedSinceLastScan = input.changedSinceLastScan === true;
  const usefulnessAccepted = isUseful(input.whyUsefulForTancMark);
  const isNew = !sameTopic;
  const isUpdated = !!sameTopic && changedSinceLastScan;
  const isRepeated = !!sameTopic && !changedSinceLastScan;
  const staleStatus =
    !usefulnessAccepted
      ? "no_meaningful_update"
      : isNew
        ? "fresh"
        : isUpdated
          ? "updated"
          : isRepeated
            ? "repeated"
            : "stale";

  return {
    guardVersion: WEEKLY_INTELLIGENCE_FRESHNESS_GUARD_VERSION,
    dnaName: input.dnaName,
    topic: input.topic,
    sourceName: input.sourceName,
    sourceDate: input.sourceDate,
    isNew,
    isRepeated,
    isUpdated,
    changedSinceLastScan,
    staleStatus,
    actionNeeded:
      staleStatus === "fresh" || staleStatus === "updated"
        ? "Add as weekly intelligence support knowledge."
        : "Do not add as new knowledge; record as repeated/stale/no meaningful update.",
    usefulnessAccepted,
    reason:
      staleStatus === "fresh"
        ? "Topic/source is new and useful for TancMark."
        : staleStatus === "updated"
          ? "Topic/source was seen before but has a meaningful update."
          : "Topic/source does not add meaningful new value this week.",
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
  };
}
