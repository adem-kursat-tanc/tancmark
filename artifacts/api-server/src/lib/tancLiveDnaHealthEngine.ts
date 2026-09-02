import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const TANCLIVE_DNA_HEALTH_ENGINE_VERSION = "tanclive-dna-health-engine-v0.1" as const;

export interface TancLiveDnaHealthSummary extends HierarchicalDnaHealthSummary {
  tancLiveEngineVersion: typeof TANCLIVE_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  liveOverallHealth: string;
  realPlatformTestRemaining: true;
  mediaMtxStatus: string;
  ffmpegRequiredForProductRuntime: false;
  multiStreamDebtPresent: true;
  postLiveEvidenceStatus: string;
  nextTancLiveWork: string;
}

const TANCLIVE_LEARNS_FROM_SIGNALS = [
  "stream started",
  "stream ended",
  "disconnect",
  "delay",
  "MediaMTX",
  "FFmpeg",
  "HLS",
  "VOD",
  "post-live ID read",
  "post-live evidence",
  "multi-stream",
  "bandwidth",
  "CPU",
  "RAM",
  "real platform test debt",
] as const;

const TANCLIVE_ENGINE_CONFIG = {
  dnaName: "TancLive DNA",
  modules: ["live_tanclive", "video", "evidence", "license_product_gate", "cost_margin", "pricing_learning"] as const,
  eventTypes: [
    "live_signal",
    "live_test_result",
    "evidence_signal",
    "finance_cost_signal",
    "pricing_cost_signal",
    "license_gate_signal",
    "debt_signal",
  ] as const,
  debtKeywords: [
    "live",
    "tanclive",
    "rtmp",
    "hls",
    "vod",
    "mediamtx",
    "ffmpeg",
    "platform",
    "youtube",
    "twitch",
    "broadcast",
    "bandwidth",
    "cpu",
    "ram",
    "multistream",
  ] as const,
  readinessNote:
    "TancLive DNA summarizes local/support readiness only; real external platform proof remains separate.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Keep live platform proof as explicit debt",
      reason: "Local/no-platform native live pieces are useful, but real external platform proof is still open.",
      nextStep:
        "Prepare a human-approved real platform test packet after native/live evidence summaries are stable.",
      requiresHumanApproval: true,
    },
  ],
};

export function buildTancLiveDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): TancLiveDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(TANCLIVE_ENGINE_CONFIG, input);

  return {
    ...base,
    tancLiveEngineVersion: TANCLIVE_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: TANCLIVE_LEARNS_FROM_SIGNALS,
    liveOverallHealth:
      "Local/native/support evidence is useful, but external platform proof is still required before product-ready live claims.",
    realPlatformTestRemaining: true,
    mediaMtxStatus:
      "MediaMTX is a permissive/MIT backbone candidate and local lab helper; final product role remains notice/package gated.",
    ffmpegRequiredForProductRuntime: false,
    multiStreamDebtPresent: true,
    postLiveEvidenceStatus:
      "HLS/VOD and post-live evidence are support-only; exact ID rules and final proof boundaries are unchanged.",
    nextTancLiveWork:
      "Build read-only TancLive DNA live-readiness summary, then run real platform proof only under explicit human approval.",
  };
}
