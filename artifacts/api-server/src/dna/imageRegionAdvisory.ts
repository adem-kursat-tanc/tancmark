export const IMAGE_REGION_ADVISORY_DECISION_ROLE =
  "advisory_only_no_vault_no_confirmed" as const;

export interface ImageRegionAdvisoryInput {
  width: number;
  height: number;
  protectedRegions?: ReadonlyArray<ImageBox> | undefined;
  maxRecommendations?: number | undefined;
}

export interface ImageBox {
  regionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageRecommendedRegion extends ImageBox {
  centerSafety: number;
  cropRisk: number;
  edgeRisk: number;
  textureStability: number;
  compressionRisk: number;
  regionScore: number;
  suggestedPlacementReason: string;
}

export interface ImageRegionAdvisoryResult {
  module: "image";
  decisionRole: typeof IMAGE_REGION_ADVISORY_DECISION_ROLE;
  placementWillChange: false;
  productRouteChanged: false;
  recommendedRegions: ImageRecommendedRegion[];
  safety: {
    advisoryOnly: true;
    canOpenVault: false;
    confirmed: false;
    canChangeSealPlacement: false;
  };
}

export function buildImageRegionAdvisory(
  input: ImageRegionAdvisoryInput,
): ImageRegionAdvisoryResult {
  const width = safeDimension(input.width);
  const height = safeDimension(input.height);
  const maxRecommendations = Math.max(1, input.maxRecommendations ?? 4);
  const candidates = candidateBoxes(width, height)
    .map((box) => scoreRegion(box, width, height, input.protectedRegions ?? []))
    .sort((a, b) => b.regionScore - a.regionScore)
    .slice(0, maxRecommendations);

  return {
    module: "image",
    decisionRole: IMAGE_REGION_ADVISORY_DECISION_ROLE,
    placementWillChange: false,
    productRouteChanged: false,
    recommendedRegions: candidates,
    safety: {
      advisoryOnly: true,
      canOpenVault: false,
      confirmed: false,
      canChangeSealPlacement: false,
    },
  };
}

function candidateBoxes(width: number, height: number): ImageBox[] {
  const w = Math.max(16, Math.round(width * 0.28));
  const h = Math.max(16, Math.round(height * 0.24));
  return [
    centeredBox("image.center-core", width, height, 0.5, 0.5, w, h),
    centeredBox("image.upper-core", width, height, 0.5, 0.34, w, h),
    centeredBox("image.lower-core", width, height, 0.5, 0.66, w, h),
    centeredBox("image.left-core", width, height, 0.34, 0.5, w, h),
    centeredBox("image.right-core", width, height, 0.66, 0.5, w, h),
  ];
}

function centeredBox(
  regionId: string,
  width: number,
  height: number,
  cxRatio: number,
  cyRatio: number,
  boxWidth: number,
  boxHeight: number,
): ImageBox {
  const x = Math.round(width * cxRatio - boxWidth / 2);
  const y = Math.round(height * cyRatio - boxHeight / 2);
  return {
    regionId,
    x: clampInt(x, 0, Math.max(0, width - boxWidth)),
    y: clampInt(y, 0, Math.max(0, height - boxHeight)),
    width: boxWidth,
    height: boxHeight,
  };
}

function scoreRegion(
  box: ImageBox,
  width: number,
  height: number,
  protectedRegions: ReadonlyArray<ImageBox>,
): ImageRecommendedRegion {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const nx = Math.abs(cx / width - 0.5) * 2;
  const ny = Math.abs(cy / height - 0.5) * 2;
  const centerSafety = round3(clamp01(1 - Math.max(nx, ny)));
  const edgeDistance = Math.min(box.x, box.y, width - (box.x + box.width), height - (box.y + box.height));
  const edgeRisk = round3(clamp01(1 - edgeDistance / Math.max(1, Math.min(width, height) * 0.18)));
  const cropRisk = round3(clamp01(Math.max(nx, ny) * 0.75 + edgeRisk * 0.25));
  const overlapRisk = protectedRegions.some((r) => overlaps(box, r)) ? 0.4 : 0;
  const textureStability = round3(clamp01(0.72 - overlapRisk + centerSafety * 0.18));
  const compressionRisk = round3(clamp01(0.38 + edgeRisk * 0.2 - textureStability * 0.18));
  const regionScore = round3(
    clamp01(centerSafety * 0.38 + textureStability * 0.34 + (1 - cropRisk) * 0.18 + (1 - compressionRisk) * 0.1),
  );
  return {
    ...box,
    centerSafety,
    cropRisk,
    edgeRisk,
    textureStability,
    compressionRisk,
    regionScore,
    suggestedPlacementReason:
      regionScore >= 0.7
        ? "central_region_low_crop_risk"
        : "advisory_region_requires_review",
  };
}

function overlaps(a: ImageBox, b: ImageBox) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function safeDimension(value: number) {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
