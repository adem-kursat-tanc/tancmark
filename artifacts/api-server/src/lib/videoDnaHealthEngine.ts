import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const VIDEO_DNA_HEALTH_ENGINE_VERSION = "video-dna-health-engine-v0.1" as const;

export interface VideoDnaHealthSummary extends HierarchicalDnaHealthSummary {
  videoEngineVersion: typeof VIDEO_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestVideoPath: string;
  weakestVideoScenario: string;
  repeatedTestsRequired: string[];
  labOnlyLegacyPaths: string[];
  ffmpegFreeSolidPaths: string[];
  nextVideoWork: string;
}

const VIDEO_LEARNS_FROM_SIGNALS = [
  "video seal/read",
  "frame choice",
  "recompression",
  "platform",
  "FFmpeg product-outside state",
  "product retest",
  "video cost",
  "performance",
  "failed read/recovery",
] as const;

const VIDEO_ENGINE_CONFIG = {
  dnaName: "Video DNA",
  modules: ["video", "live_tanclive", "license_product_gate", "cost_margin", "pricing_learning"] as const,
  eventTypes: [
    "read_attempt",
    "recovery_attempt",
    "format_test_result",
    "live_signal",
    "live_test_result",
    "license_gate_signal",
    "finance_cost_signal",
    "pricing_cost_signal",
    "debt_signal",
  ] as const,
  debtKeywords: [
    "video",
    "mp4",
    "mov",
    "webm",
    "native video",
    "ffmpeg",
    "platform",
    "social",
    "camera",
    "frame",
    "recompression",
    "performance",
    "cost",
  ] as const,
  readinessNote:
    "Video DNA reports native/support health only; it cannot re-encode, open VAULT or promote product-ready status.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Prioritize native video product proof",
      reason: "Native video factory paths are the desired product direction, while legacy FFmpeg paths stay lab-only.",
      nextStep:
        "Summarize native MP4/MOV/WebM evidence and list missing real platform/device roundtrip tests.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildVideoDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): VideoDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(VIDEO_ENGINE_CONFIG, input);

  return {
    ...base,
    videoEngineVersion: VIDEO_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: VIDEO_LEARNS_FROM_SIGNALS,
    strongestVideoPath:
      "Native video factory and native ID-envelope paths where media payload is not re-encoded.",
    weakestVideoScenario:
      "Real social/platform roundtrip and unstable RTMP direct capture remain the weakest evidence areas.",
    repeatedTestsRequired: [
      "large real video corpus",
      "phone/camera capture",
      "social/messaging platform roundtrip",
      "wrong-ID/unsealed negative set",
      "bounded recovery runtime",
    ],
    labOnlyLegacyPaths: [
      "local GPL-enabled FFmpeg helpers",
      "old FFmpeg re-encode lab harness",
      "RTMP direct capture diagnostic path",
    ],
    ffmpegFreeSolidPaths: [
      "native MP4/MOV metadata/atom support path",
      "native camera capture ID envelope path",
      "native fMP4/CMAF segment read/write support path",
    ],
    nextVideoWork:
      "Create read-only Video DNA native-proof summary, then close missing device/platform roundtrip debts under a separate approved test task.",
  };
}
