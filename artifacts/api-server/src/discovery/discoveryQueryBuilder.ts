import type { DiscoveryJobRecord } from "./types";
import type { DiscoveryContentClassification } from "./discoveryContentClassifier";
import { DISCOVERY_SEARCH_DNA_DECISION_ROLE } from "./discoveryContentClassifier";

export type DiscoveryQueryType =
  | "title_exact"
  | "speaker_or_instructor"
  | "broad_web_terms"
  | "telegram_short_terms"
  | "file_name"
  | "semantic_description";

export interface DiscoveryQueryVariant {
  queryText: string;
  queryType: DiscoveryQueryType;
  target: "web" | "semantic_web" | "telegram";
  priority: number;
  expectedValue: number;
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
}

export interface DiscoverySelectedSearchPieces {
  title: string | null;
  instructorOrSpeaker: string | null;
  courseName: string | null;
  fileName: string | null;
  descriptionTerms: string[];
  tags: string[];
  telegramShortPatterns: string[];
  webBroadPatterns: string[];
  keyframeCandidates: Array<{ frameIndex: number; reason: string; priority: number }>;
  audioFingerprintHints: Array<{ startSec: number; durationSec: number; reason: string; priority: number }>;
  queryVariants: DiscoveryQueryVariant[];
  supportOnly: true;
  decisionRole: typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return trimmed.length > 0 ? trimmed.slice(0, 160) : null;
}

function cleanWords(values: Array<string | null | undefined>): string[] {
  const joined = values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ");
  return Array.from(new Set(joined.split(/\s+/).filter((word) => word.length >= 3))).slice(0, 16);
}

function addVariant(
  variants: DiscoveryQueryVariant[],
  queryText: string | null,
  queryType: DiscoveryQueryType,
  target: DiscoveryQueryVariant["target"],
  priority: number,
  expectedValue: number,
): void {
  if (!queryText) return;
  const normalized = queryText.trim().replace(/\s+/g, " ");
  if (!normalized) return;
  if (variants.some((variant) => variant.queryText === normalized && variant.target === target)) return;
  variants.push({
    queryText: normalized.slice(0, 220),
    queryType,
    target,
    priority,
    expectedValue,
    supportOnly: true,
    decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
  });
}

function fileNameFromRef(job: DiscoveryJobRecord): string | null {
  const raw = job.uploadRef ?? job.sourceContentId ?? null;
  if (!raw) return null;
  const parts = raw.split(/[\\/]/);
  return clean(parts[parts.length - 1] ?? raw);
}

export function buildDiscoverySearchPieces(
  job: DiscoveryJobRecord,
  classification: DiscoveryContentClassification,
): DiscoverySelectedSearchPieces {
  const title = clean(job.title);
  const instructorOrSpeaker = clean(job.instructorName);
  const fileName = fileNameFromRef(job);
  const tags = Array.from(new Set([...(job.tags ?? []), ...(job.keywords ?? [])].map((value) => clean(value)).filter((value): value is string => Boolean(value)))).slice(0, 12);
  const descriptionTerms = cleanWords([job.description, title, ...tags]).slice(0, 10);
  const courseName = classification.contentType === "education_course" ? title : null;
  const variants: DiscoveryQueryVariant[] = [];

  addVariant(variants, title ? `"${title}"` : null, "title_exact", "web", 10, 0.9);
  addVariant(
    variants,
    title && instructorOrSpeaker ? `"${title}" "${instructorOrSpeaker}"` : null,
    "speaker_or_instructor",
    "web",
    9,
    0.88,
  );
  addVariant(
    variants,
    [title, instructorOrSpeaker, ...tags.slice(0, 4)].filter(Boolean).join(" "),
    "broad_web_terms",
    "web",
    7,
    0.68,
  );
  addVariant(
    variants,
    [title, ...descriptionTerms.slice(0, 5)].filter(Boolean).join(" "),
    "semantic_description",
    "semantic_web",
    6,
    0.66,
  );
  addVariant(
    variants,
    [title, ...tags.slice(0, 3)].filter(Boolean).join(" "),
    "telegram_short_terms",
    "telegram",
    classification.contentType === "education_course" ? 8 : 5,
    classification.contentType === "education_course" ? 0.76 : 0.52,
  );
  addVariant(variants, fileName, "file_name", "web", 4, 0.45);

  const telegramShortPatterns = variants
    .filter((variant) => variant.target === "telegram")
    .map((variant) => variant.queryText)
    .slice(0, 6);
  const webBroadPatterns = variants
    .filter((variant) => variant.target !== "telegram")
    .map((variant) => variant.queryText)
    .slice(0, 8);

  const duration = Math.max(0, job.durationSec ?? 0);
  const keyframeCandidates =
    classification.recommendedSearchLayers.includes("visual") || classification.recommendedSearchLayers.includes("video_metadata")
      ? [0, 1, 2].map((frameIndex) => ({
          frameIndex,
          reason: frameIndex === 1 ? "middle_frame_balances_intro_and_outro_risk" : "coverage_keyframe_candidate",
          priority: frameIndex === 1 ? 9 : 7,
        }))
      : [];
  const audioFingerprintHints =
    classification.recommendedSearchLayers.includes("audio") && duration > 0
      ? [
          {
            startSec: Math.round(Math.max(0, duration * 0.2) * 100) / 100,
            durationSec: Math.min(30, Math.max(8, Math.round(duration * 0.08))),
            reason: "avoid_intro_trim_and_capture_stable_speech_or_audio",
            priority: 8,
          },
        ]
      : [];

  return {
    title,
    instructorOrSpeaker,
    courseName,
    fileName,
    descriptionTerms,
    tags,
    telegramShortPatterns,
    webBroadPatterns,
    keyframeCandidates,
    audioFingerprintHints,
    queryVariants: variants.sort((a, b) => b.priority - a.priority),
    supportOnly: true,
    decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
  };
}
