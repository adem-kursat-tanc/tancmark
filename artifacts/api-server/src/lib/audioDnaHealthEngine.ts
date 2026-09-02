import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const AUDIO_DNA_HEALTH_ENGINE_VERSION = "audio-dna-health-engine-v0.1" as const;

export interface AudioDnaHealthSummary extends HierarchicalDnaHealthSummary {
  audioEngineVersion: typeof AUDIO_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestAudioFormats: string[];
  riskyAudioConversions: string[];
  workingRecoveryPaths: string[];
  retestRequiredAudioWork: string[];
  exactIdSupportBoundary: string;
  nextAudioWork: string;
}

const AUDIO_LEARNS_FROM_SIGNALS = [
  "WAV",
  "MP3",
  "AAC",
  "M4A",
  "FLAC",
  "OGG",
  "Opus",
  "WMA",
  "AIFF",
  "audio seal/read",
  "bitrate",
  "format conversion",
  "noise",
  "cut/resave",
  "recovery results",
  "exact ID/support boundary",
  "product-ready/support-only/lab-only state",
] as const;

const AUDIO_ENGINE_CONFIG = {
  dnaName: "Audio DNA",
  modules: ["audio", "format_layers", "watermark", "license_product_gate", "evidence"] as const,
  eventTypes: [
    "seal_attempt",
    "read_attempt",
    "recovery_attempt",
    "format_test_result",
    "evidence_signal",
    "license_gate_signal",
    "debt_signal",
  ] as const,
  debtKeywords: [
    "audio",
    "wav",
    "mp3",
    "aac",
    "m4a",
    "flac",
    "ogg",
    "opus",
    "wma",
    "aiff",
    "bitrate",
    "noise",
    "conversion",
    "32/32",
    "exact id",
    "recovery",
    "product-ready",
  ] as const,
  readinessNote:
    "Audio DNA summarizes audio support evidence only; 32/32 exact-ID VAULT rules remain outside advisory DNA.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Keep audio support separate from exact-ID proof",
      reason:
        "Audio partial matches can support recovery, but exact-ID and 32/32 AUDIO_VAULT rules must stay untouched.",
      nextStep:
        "Build a support-only audio matrix for strong formats, risky conversions and recovery hints.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildAudioDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): AudioDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(AUDIO_ENGINE_CONFIG, input);

  return {
    ...base,
    audioEngineVersion: AUDIO_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: AUDIO_LEARNS_FROM_SIGNALS,
    strongestAudioFormats: [
      "WAV/FLAC support evidence where lossless paths preserve strongest signals",
      "M4A/AAC/MP3 support evidence when exact-ID proof is separately available",
      "OGG/Opus/WMA/AIFF remain summarized only until broader corpus proof is complete",
    ],
    riskyAudioConversions: [
      "low bitrate lossy conversion",
      "noise plus cut plus resave chain",
      "codec conversion through unapproved or lab-only helper tools",
    ],
    workingRecoveryPaths: [
      "partial advisory percentage signals below AUDIO_VAULT threshold",
      "format-specific recovery hints for bitrate/noise damage",
      "negative wrong-ID and unsealed checks stay outside advisory acceptance",
    ],
    retestRequiredAudioWork: [
      "lossy bitrate ladder",
      "noise and room-recording roundtrip",
      "cut/resave attack matrix",
      "WMA/AIFF/OGG/Opus real-world corpus",
    ],
    exactIdSupportBoundary:
      "Audio DNA cannot replace the 32/32 AUDIO_VAULT rule; 31/32 and below remain support/advisory only.",
    nextAudioWork:
      "Create a read-only Audio DNA matrix before any wider audio product-readiness claim.",
  };
}
