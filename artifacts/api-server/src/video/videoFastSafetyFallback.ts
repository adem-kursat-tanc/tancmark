export type VideoFastSafetyDecision =
  | "FAST_CANDIDATE"
  | "STRONG_MODE_FALLBACK"
  | "FAST_OUTPUT_ACCEPTABLE"
  | "FAST_OUTPUT_DISCARDED"
  | "FAST_OUTPUT_NOT_READY";

export type VideoFastFinalDecision = "FAST_OUTPUT_ACCEPTABLE" | "STRONG_MODE_FALLBACK";

export interface VideoFastProbeSignals {
  codecName?: string | null;
  profile?: string | null;
  hasBFrames?: number | null;
  hasPtsDtsReorder?: boolean | null;
  hasNegativePtsDelta?: boolean | null;
  frameCountReliable?: boolean | null;
  rotateMetadataPresent?: boolean | null;
  rotateTag?: string | number | null;
  sideDataRotations?: readonly number[];
  requiredInfoKnown?: boolean | null;
}

export interface VideoFastGateResult {
  decision: Extract<VideoFastSafetyDecision, "FAST_CANDIDATE" | "STRONG_MODE_FALLBACK">;
  reasons: string[];
  canTryMetadataOnlyRotateNormalize: boolean;
  normalizeRequired: boolean;
}

export interface VideoFastOutputSignals {
  sourceFrameCount?: number | null;
  outputFrameCount?: number | null;
  sourceDurationSec?: number | null;
  outputDurationSec?: number | null;
  sourceRFrameRate?: string | null;
  outputRFrameRate?: string | null;
  sourceAvgFrameRate?: string | null;
  outputAvgFrameRate?: string | null;
  sourceTimeBase?: string | null;
  outputTimeBase?: string | null;
  sourceHasAudio?: boolean | null;
  outputHasAudio?: boolean | null;
  targetCount: number;
  correctIdFoundTargets: number;
  wrongIdFoundTargets: number;
  unsealedCorrectFoundTargets: number;
  unsealedWrongFoundTargets: number;
  durationToleranceSec?: number;
}

export interface VideoFastOutputEvaluation {
  decision: Extract<VideoFastSafetyDecision, "FAST_OUTPUT_ACCEPTABLE" | "FAST_OUTPUT_NOT_READY">;
  fallbackDecision: Extract<VideoFastSafetyDecision, "FAST_OUTPUT_ACCEPTABLE" | "FAST_OUTPUT_DISCARDED">;
  issues: string[];
  checks: {
    frameCountSame: boolean;
    durationWithinTolerance: boolean;
    rFrameRateSame: boolean;
    avgFrameRateSame: boolean;
    timeBaseSame: boolean;
    audioPreserved: boolean;
    correctIdRadius0AllTargets: boolean;
    wrongIdRadius0Clear: boolean;
    unsealedSourceClear: boolean;
  };
  fastOutputWouldBeUsed: boolean;
  fastOutputWouldBeDiscarded: boolean;
}

export interface VideoFastFallbackInput {
  initialGate: VideoFastGateResult;
  normalizedGate?: VideoFastGateResult | null;
  output?: VideoFastOutputEvaluation | null;
}

export interface VideoFastFallbackDecision {
  finalDecision: VideoFastFinalDecision;
  fastOutputDecision: Extract<VideoFastSafetyDecision, "FAST_OUTPUT_ACCEPTABLE" | "FAST_OUTPUT_DISCARDED">;
  fastOutputWouldBeUsed: boolean;
  fastOutputWouldBeDiscarded: boolean;
  reasons: string[];
  safety: {
    confirmed: false;
    canOpenVault: false;
    vaultEligible: false;
    note: "fast_video_candidate_support_only_no_vault";
  };
}

const DEFAULT_DURATION_TOLERANCE_SEC = 0.002;

function hasKnownString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value !== "unknown";
}

function sideDataHasRotation(rotations: readonly number[] | undefined): boolean {
  return (rotations ?? []).some((rotation) => Number.isFinite(rotation) && rotation !== 0);
}

function rotatePresent(input: VideoFastProbeSignals): boolean {
  return input.rotateMetadataPresent === true || input.rotateTag !== null && input.rotateTag !== undefined && input.rotateTag !== "" || sideDataHasRotation(input.sideDataRotations);
}

export function evaluateVideoFastGate(input: VideoFastProbeSignals): VideoFastGateResult {
  const reasons: string[] = [];
  const codecOk = input.codecName === "h264";
  const profileOk = input.profile === "Baseline";
  const bFrameSafe = input.hasBFrames === 0;
  const reorderSafe = input.hasPtsDtsReorder === false;
  const negativePtsSafe = input.hasNegativePtsDelta === false;
  const frameCountReliable = input.frameCountReliable === true;
  const requiredInfoKnown =
    input.requiredInfoKnown === true &&
    hasKnownString(input.codecName) &&
    hasKnownString(input.profile) &&
    typeof input.hasBFrames === "number";
  const rotateSafe = !rotatePresent(input);

  if (!codecOk) reasons.push(`codec_not_h264:${input.codecName ?? "unknown"}`);
  if (!profileOk) reasons.push(`profile_not_baseline:${input.profile ?? "unknown"}`);
  if (!bFrameSafe) reasons.push(`has_b_frames:${input.hasBFrames ?? "unknown"}`);
  if (!reorderSafe) reasons.push("pts_dts_reorder");
  if (!negativePtsSafe) reasons.push("negative_pts_delta");
  if (!frameCountReliable) reasons.push("frame_count_not_reliable");
  if (!rotateSafe) {
    const sideData = (input.sideDataRotations ?? []).join(",");
    reasons.push(`rotate_metadata:tag=${String(input.rotateTag ?? "")}:side_data=${sideData}`);
  }
  if (!requiredInfoKnown) reasons.push("required_info_unknown");

  const timelineAndCodecSafe =
    codecOk &&
    profileOk &&
    bFrameSafe &&
    reorderSafe &&
    negativePtsSafe &&
    frameCountReliable &&
    requiredInfoKnown;

  const decision = timelineAndCodecSafe && rotateSafe ? "FAST_CANDIDATE" : "STRONG_MODE_FALLBACK";

  return {
    decision,
    reasons,
    canTryMetadataOnlyRotateNormalize: timelineAndCodecSafe && !rotateSafe,
    normalizeRequired: timelineAndCodecSafe && !rotateSafe,
  };
}

export function evaluateVideoFastOutput(input: VideoFastOutputSignals): VideoFastOutputEvaluation {
  const durationToleranceSec = input.durationToleranceSec ?? DEFAULT_DURATION_TOLERANCE_SEC;
  const durationDiffSec =
    typeof input.sourceDurationSec === "number" && typeof input.outputDurationSec === "number"
      ? input.outputDurationSec - input.sourceDurationSec
      : Number.POSITIVE_INFINITY;

  const checks = {
    frameCountSame:
      typeof input.sourceFrameCount === "number" &&
      typeof input.outputFrameCount === "number" &&
      input.sourceFrameCount === input.outputFrameCount,
    durationWithinTolerance: Number.isFinite(durationDiffSec) && Math.abs(durationDiffSec) <= durationToleranceSec,
    rFrameRateSame: hasKnownString(input.sourceRFrameRate) && input.sourceRFrameRate === input.outputRFrameRate,
    avgFrameRateSame: hasKnownString(input.sourceAvgFrameRate) && input.sourceAvgFrameRate === input.outputAvgFrameRate,
    timeBaseSame: hasKnownString(input.sourceTimeBase) && input.sourceTimeBase === input.outputTimeBase,
    audioPreserved: input.sourceHasAudio === true ? input.outputHasAudio === true : true,
    correctIdRadius0AllTargets: input.targetCount > 0 && input.correctIdFoundTargets === input.targetCount,
    wrongIdRadius0Clear: input.wrongIdFoundTargets === 0,
    unsealedSourceClear: input.unsealedCorrectFoundTargets === 0 && input.unsealedWrongFoundTargets === 0,
  };

  const issues: string[] = [];
  if (!checks.frameCountSame) issues.push("frame_count_drift");
  if (!checks.durationWithinTolerance) issues.push(`duration_drift_sec:${Number.isFinite(durationDiffSec) ? Number(durationDiffSec.toFixed(6)) : "unknown"}`);
  if (!checks.rFrameRateSame) issues.push("r_frame_rate_drift");
  if (!checks.avgFrameRateSame) issues.push("avg_frame_rate_drift");
  if (!checks.timeBaseSame) issues.push("time_base_drift");
  if (!checks.audioPreserved) issues.push("audio_not_preserved");
  if (!checks.correctIdRadius0AllTargets) issues.push(`correct_id_radius0:${input.correctIdFoundTargets}/${input.targetCount}`);
  if (!checks.wrongIdRadius0Clear) issues.push(`wrong_id_radius0:${input.wrongIdFoundTargets}/${input.targetCount}`);
  if (!checks.unsealedSourceClear) issues.push(`unsealed_source:${input.unsealedCorrectFoundTargets}/${input.unsealedWrongFoundTargets}`);

  const acceptable = Object.values(checks).every(Boolean);

  return {
    decision: acceptable ? "FAST_OUTPUT_ACCEPTABLE" : "FAST_OUTPUT_NOT_READY",
    fallbackDecision: acceptable ? "FAST_OUTPUT_ACCEPTABLE" : "FAST_OUTPUT_DISCARDED",
    issues,
    checks,
    fastOutputWouldBeUsed: acceptable,
    fastOutputWouldBeDiscarded: !acceptable,
  };
}

export function decideVideoFastFallback(input: VideoFastFallbackInput): VideoFastFallbackDecision {
  const activeGate = input.normalizedGate ?? input.initialGate;
  const reasons: string[] = [];

  if (activeGate.decision !== "FAST_CANDIDATE") {
    reasons.push(...activeGate.reasons);
    return {
      finalDecision: "STRONG_MODE_FALLBACK",
      fastOutputDecision: "FAST_OUTPUT_DISCARDED",
      fastOutputWouldBeUsed: false,
      fastOutputWouldBeDiscarded: true,
      reasons,
      safety: {
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
        note: "fast_video_candidate_support_only_no_vault",
      },
    };
  }

  if (!input.output) {
    return {
      finalDecision: "STRONG_MODE_FALLBACK",
      fastOutputDecision: "FAST_OUTPUT_DISCARDED",
      fastOutputWouldBeUsed: false,
      fastOutputWouldBeDiscarded: true,
      reasons: ["fast_output_not_tested"],
      safety: {
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
        note: "fast_video_candidate_support_only_no_vault",
      },
    };
  }

  if (input.output.decision !== "FAST_OUTPUT_ACCEPTABLE") {
    return {
      finalDecision: "STRONG_MODE_FALLBACK",
      fastOutputDecision: "FAST_OUTPUT_DISCARDED",
      fastOutputWouldBeUsed: false,
      fastOutputWouldBeDiscarded: true,
      reasons: input.output.issues,
      safety: {
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
        note: "fast_video_candidate_support_only_no_vault",
      },
    };
  }

  return {
    finalDecision: "FAST_OUTPUT_ACCEPTABLE",
    fastOutputDecision: "FAST_OUTPUT_ACCEPTABLE",
    fastOutputWouldBeUsed: true,
    fastOutputWouldBeDiscarded: false,
    reasons: [],
    safety: {
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
      note: "fast_video_candidate_support_only_no_vault",
    },
  };
}
