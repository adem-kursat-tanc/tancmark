export const VIDEO_PLACEMENT_ADVISORY_DECISION_ROLE =
  "advisory_only_no_vault_no_confirmed" as const;

export interface VideoPlacementAdvisoryInput {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec?: number | undefined;
  usedFrameIdxs?: ReadonlyArray<number> | undefined;
  riskScores?: Partial<Record<"crop" | "perspective" | "phoneCamera" | "encode", number>> | undefined;
  maxRecommendations?: number | undefined;
}

export interface VideoRecommendedFrame {
  frameIdx: number;
  tsSec: number;
  cropRisk: number;
  perspectiveRisk: number;
  phoneCameraRisk: number;
  encodeRisk: number;
  frameRegionScore: number;
  region: {
    regionId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  suggestedPlacementReason: string;
}

export interface VideoPlacementAdvisoryResult {
  module: "video";
  decisionRole: typeof VIDEO_PLACEMENT_ADVISORY_DECISION_ROLE;
  placementWillChange: false;
  productRouteChanged: false;
  recommendedFrames: VideoRecommendedFrame[];
  recommendedTimeRanges: Array<{ startSec: number; endSec: number; frameIdx: number }>;
  safety: {
    advisoryOnly: true;
    canOpenVault: false;
    confirmed: false;
    canChangeSealPlacement: false;
  };
}

export function buildVideoPlacementAdvisory(
  input: VideoPlacementAdvisoryInput,
): VideoPlacementAdvisoryResult {
  const totalFrames = Math.max(0, Math.floor(input.totalFrames));
  const fps = Number.isFinite(input.fps) && input.fps > 0 ? input.fps : 30;
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const used = new Set(input.usedFrameIdxs ?? []);
  const maxRecommendations = Math.max(1, input.maxRecommendations ?? 6);
  const recommendedFrames = framePercentages()
    .map((pct) => nearestUnusedFrame(Math.round(totalFrames * pct), totalFrames, used))
    .filter((idx): idx is number => idx !== null)
    .filter((idx, pos, arr) => arr.indexOf(idx) === pos)
    .map((idx) => scoreFrame(idx, fps, width, height, input.riskScores))
    .sort((a, b) => b.frameRegionScore - a.frameRegionScore)
    .slice(0, maxRecommendations);

  return {
    module: "video",
    decisionRole: VIDEO_PLACEMENT_ADVISORY_DECISION_ROLE,
    placementWillChange: false,
    productRouteChanged: false,
    recommendedFrames,
    recommendedTimeRanges: recommendedFrames.map((frame) => ({
      startSec: round3(Math.max(0, frame.tsSec - 0.04)),
      endSec: round3(frame.tsSec + 0.04),
      frameIdx: frame.frameIdx,
    })),
    safety: {
      advisoryOnly: true,
      canOpenVault: false,
      confirmed: false,
      canChangeSealPlacement: false,
    },
  };
}

function framePercentages() {
  return [0.18, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88];
}

function nearestUnusedFrame(
  center: number,
  totalFrames: number,
  used: ReadonlySet<number>,
): number | null {
  if (totalFrames <= 0) return null;
  const clamped = Math.max(0, Math.min(totalFrames - 1, center));
  for (let radius = 0; radius < totalFrames; radius++) {
    const left = clamped - radius;
    if (left >= 0 && !used.has(left)) return left;
    const right = clamped + radius;
    if (right < totalFrames && !used.has(right)) return right;
  }
  return null;
}

function scoreFrame(
  frameIdx: number,
  fps: number,
  width: number,
  height: number,
  riskScores: VideoPlacementAdvisoryInput["riskScores"],
): VideoRecommendedFrame {
  const cropRisk = clamp01(riskScores?.crop ?? 0.42);
  const perspectiveRisk = clamp01(riskScores?.perspective ?? 0.5);
  const phoneCameraRisk = clamp01(riskScores?.phoneCamera ?? 0.55);
  const encodeRisk = clamp01(riskScores?.encode ?? 0.28);
  const temporalCenterScore = temporalScore(frameIdx);
  const frameRegionScore = round3(
    clamp01(temporalCenterScore * 0.36 + (1 - cropRisk) * 0.2 + (1 - perspectiveRisk) * 0.18 + (1 - phoneCameraRisk) * 0.16 + (1 - encodeRisk) * 0.1),
  );
  const regionWidth = Math.max(16, Math.round(width * 0.28));
  const regionHeight = Math.max(16, Math.round(height * 0.22));
  return {
    frameIdx,
    tsSec: round3(frameIdx / fps),
    cropRisk: round3(cropRisk),
    perspectiveRisk: round3(perspectiveRisk),
    phoneCameraRisk: round3(phoneCameraRisk),
    encodeRisk: round3(encodeRisk),
    frameRegionScore,
    region: {
      regionId: "video.advisory.center-core",
      x: Math.round(width / 2 - regionWidth / 2),
      y: Math.round(height / 2 - regionHeight / 2),
      width: regionWidth,
      height: regionHeight,
    },
    suggestedPlacementReason:
      frameRegionScore >= 0.55
        ? "middle_timeline_center_region_advisory"
        : "video_frame_requires_review",
  };
}

function temporalScore(frameIdx: number) {
  const phase = Math.abs((frameIdx % 100) / 100 - 0.5) * 2;
  return clamp01(1 - phase * 0.35);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
