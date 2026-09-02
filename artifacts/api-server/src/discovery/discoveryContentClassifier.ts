import type { DiscoveryJobRecord, DiscoveryLayer } from "./types";

export const DISCOVERY_SEARCH_DNA_DECISION_ROLE =
  "discovery_search_dna_support_only_no_vault_no_confirmed" as const;

export type DiscoverySearchDnaDecisionRole = typeof DISCOVERY_SEARCH_DNA_DECISION_ROLE;

export type DiscoveryContentType =
  | "education_course"
  | "podcast_speech"
  | "music"
  | "news_video"
  | "visual_artwork"
  | "social_video"
  | "screen_recording"
  | "text_document"
  | "link_url"
  | "mixed_media";

export interface DiscoveryContentClassification {
  contentType: DiscoveryContentType;
  confidence: number;
  detectedSignals: string[];
  recommendedSearchLayers: DiscoveryLayer[];
  supportOnly: true;
  decisionRole: DiscoverySearchDnaDecisionRole;
  requiresTancMarkVerification: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

function textCorpus(job: DiscoveryJobRecord): string {
  return [
    job.mediaType,
    job.scanType,
    job.title,
    job.instructorName,
    job.description,
    ...(job.tags ?? []),
    ...(job.keywords ?? []),
    job.sourceContentId,
    job.uploadRef,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function hasAny(corpus: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => corpus.includes(token));
}

function uniq<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function confidence(base: number, signals: readonly string[]): number {
  return Math.max(0.35, Math.min(0.98, Math.round((base + signals.length * 0.04) * 100) / 100));
}

export function classifyDiscoveryContent(job: DiscoveryJobRecord): DiscoveryContentClassification {
  const corpus = textCorpus(job);
  const detectedSignals: string[] = [];
  let contentType: DiscoveryContentType = "mixed_media";
  let layers: DiscoveryLayer[] = ["metadata_text"];
  let baseConfidence = 0.55;

  if (job.mediaType === "text" || job.scanType === "text_only") {
    contentType = hasAny(corpus, ["http://", "https://", "www."]) ? "link_url" : "text_document";
    layers = ["metadata_text"];
    detectedSignals.push(job.mediaType === "text" ? "media_text" : "scan_text_only");
    baseConfidence = 0.72;
  } else if (job.mediaType === "image" || job.scanType === "visual_only") {
    contentType = "visual_artwork";
    layers = ["visual", "metadata_text"];
    detectedSignals.push("visual_media");
    baseConfidence = 0.72;
  } else if (job.mediaType === "audio" || job.scanType === "audio_only") {
    contentType = hasAny(corpus, ["music", "song", "track", "album", "şarkı", "müzik"])
      ? "music"
      : "podcast_speech";
    layers = ["audio", "metadata_text"];
    detectedSignals.push("audio_media");
    baseConfidence = 0.74;
  } else if (hasAny(corpus, ["course", "kurs", "eğitim", "egitim", "lesson", "training", "instructor", "öğretmen", "egitmen", "eğitmen"])) {
    contentType = "education_course";
    layers = ["metadata_text", "telegram", "visual", "audio", "video_metadata"];
    detectedSignals.push("education_terms");
    if (job.instructorName) detectedSignals.push("instructor_name_present");
    baseConfidence = 0.78;
  } else if (hasAny(corpus, ["podcast", "speech", "talk", "interview", "konuşma", "konusma", "sohbet"])) {
    contentType = "podcast_speech";
    layers = ["audio", "metadata_text", "telegram"];
    detectedSignals.push("speech_terms");
    baseConfidence = 0.76;
  } else if (hasAny(corpus, ["news", "haber", "breaking", "report", "press"])) {
    contentType = "news_video";
    layers = ["metadata_text", "visual", "video_metadata"];
    detectedSignals.push("news_terms");
    baseConfidence = 0.73;
  } else if (hasAny(corpus, ["screen", "screencast", "recording", "ekran", "demo", "webinar"])) {
    contentType = "screen_recording";
    layers = ["visual", "metadata_text", "video_metadata"];
    detectedSignals.push("screen_recording_terms");
    baseConfidence = 0.72;
  } else if (hasAny(corpus, ["tiktok", "reels", "shorts", "instagram", "social"])) {
    contentType = "social_video";
    layers = ["visual", "metadata_text", "telegram"];
    detectedSignals.push("social_video_terms");
    baseConfidence = 0.7;
  } else if (job.mediaType === "video" || job.scanType === "hybrid_video") {
    contentType = "mixed_media";
    layers = ["visual", "audio", "metadata_text", "video_metadata", "telegram"];
    detectedSignals.push("hybrid_video_media");
    baseConfidence = 0.64;
  }

  if (job.durationSec && job.durationSec > 0) detectedSignals.push("duration_present");
  if ((job.tags ?? []).length > 0) detectedSignals.push("tags_present");
  if ((job.keywords ?? []).length > 0) detectedSignals.push("keywords_present");

  return {
    contentType,
    confidence: confidence(baseConfidence, detectedSignals),
    detectedSignals: uniq(detectedSignals),
    recommendedSearchLayers: uniq(layers),
    supportOnly: true,
    decisionRole: DISCOVERY_SEARCH_DNA_DECISION_ROLE,
    requiresTancMarkVerification: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}
