import type { LearningRecordMediaType, LearningRecordRow } from "@workspace/db";
import type { LearningDnaMemory } from "../../lib/learningDnaMemory";
import { buildLearningMemoryFromRows } from "../../lib/learningRecordStore";

const LEARNING_MEDIA_TYPES = new Set<LearningRecordMediaType>([
  "image",
  "video",
  "audio",
  "text",
  "multimodal",
]);

function cleanString(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function mediaTypeFromQuery(value: unknown): LearningRecordMediaType | undefined {
  const raw = cleanString(value, 40);
  return raw && LEARNING_MEDIA_TYPES.has(raw as LearningRecordMediaType)
    ? (raw as LearningRecordMediaType)
    : undefined;
}

export function limitFromQuery(value: unknown, fallback = 50): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : fallback;
}

export function buildLearningModeResponse(automation: unknown): {
  ok: true;
  automation: unknown;
} {
  return {
    ok: true,
    automation,
  };
}

export function buildLearningRecordsResponse(records: readonly LearningRecordRow[]): {
  ok: true;
  records: readonly LearningRecordRow[];
  safety: {
    note: string;
  };
} {
  return {
    ok: true,
    records,
    safety: {
      note: "Learning records are advisory-only and do not change VAULT, confirmed, or final decisions.",
    },
  };
}

export function buildLearningRecordsSummaryResponse(records: readonly LearningRecordRow[]): {
  ok: true;
  recordCount: number;
  learningMemory: LearningDnaMemory;
} {
  return {
    ok: true,
    recordCount: records.length,
    learningMemory: buildLearningMemoryFromRows(records),
  };
}
