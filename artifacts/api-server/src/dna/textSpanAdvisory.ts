export const TEXT_SPAN_ADVISORY_DECISION_ROLE =
  "advisory_only_no_vault_no_confirmed" as const;

export interface TextSpanAdvisoryInput {
  text: string;
  activeLayers?: ReadonlyArray<string> | undefined;
  maxRecommendations?: number | undefined;
}

export interface TextRecommendedSpan {
  spanId: string;
  startCharOffset: number;
  endCharOffset: number;
  textLength: number;
  stableSpanScore: number;
  editRisk: number;
  copyRisk: number;
  ocrRisk: number;
  suggestedPlacementReason: string;
}

export interface TextRecommendedLayer {
  layerId: string;
  layerSuitability: number;
  rationale: string;
}

export interface TextSpanAdvisoryResult {
  module: "text";
  decisionRole: typeof TEXT_SPAN_ADVISORY_DECISION_ROLE;
  placementWillChange: false;
  productRouteChanged: false;
  recommendedSpans: TextRecommendedSpan[];
  recommendedLayers: TextRecommendedLayer[];
  safety: {
    advisoryOnly: true;
    canOpenVault: false;
    confirmed: false;
    canChangeSealPlacement: false;
  };
}

export function buildTextSpanAdvisory(
  input: TextSpanAdvisoryInput,
): TextSpanAdvisoryResult {
  const spans = splitTextSpans(input.text)
    .map(scoreSpan)
    .sort((a, b) => b.stableSpanScore - a.stableSpanScore)
    .slice(0, Math.max(1, input.maxRecommendations ?? 5));

  return {
    module: "text",
    decisionRole: TEXT_SPAN_ADVISORY_DECISION_ROLE,
    placementWillChange: false,
    productRouteChanged: false,
    recommendedSpans: spans,
    recommendedLayers: recommendedLayers(input.activeLayers ?? ["linguistic", "zeroWidth", "homoglyph", "honeytoken"]),
    safety: {
      advisoryOnly: true,
      canOpenVault: false,
      confirmed: false,
      canChangeSealPlacement: false,
    },
  };
}

function splitTextSpans(text: string) {
  const spans: Array<{ spanId: string; startCharOffset: number; endCharOffset: number; value: string }> = [];
  const re = /[^.!?\n]+[.!?]?/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text)) !== null) {
    const raw = match[0] ?? "";
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const leading = raw.length - raw.trimStart().length;
    const start = match.index + leading;
    spans.push({
      spanId: `text.span.${index}`,
      startCharOffset: start,
      endCharOffset: start + trimmed.length,
      value: trimmed,
    });
    index++;
  }
  if (spans.length === 0 && text.length > 0) {
    spans.push({
      spanId: "text.span.0",
      startCharOffset: 0,
      endCharOffset: text.length,
      value: text,
    });
  }
  return spans;
}

function scoreSpan(span: {
  spanId: string;
  startCharOffset: number;
  endCharOffset: number;
  value: string;
}): TextRecommendedSpan {
  const length = span.endCharOffset - span.startCharOffset;
  const lengthScore = clamp01(1 - Math.abs(length - 140) / 140);
  const punctuationDensity = (span.value.match(/[,:;()]/g)?.length ?? 0) / Math.max(1, length);
  const digitDensity = (span.value.match(/\d/g)?.length ?? 0) / Math.max(1, length);
  const editRisk = round3(clamp01((length < 50 ? 0.45 : 0.12) + punctuationDensity * 2));
  const copyRisk = round3(clamp01(length > 260 ? 0.35 : 0.16));
  const ocrRisk = round3(clamp01(digitDensity * 1.5 + punctuationDensity * 1.2));
  const stableSpanScore = round3(
    clamp01(lengthScore * 0.45 + (1 - editRisk) * 0.25 + (1 - copyRisk) * 0.15 + (1 - ocrRisk) * 0.15),
  );
  return {
    spanId: span.spanId,
    startCharOffset: span.startCharOffset,
    endCharOffset: span.endCharOffset,
    textLength: length,
    stableSpanScore,
    editRisk,
    copyRisk,
    ocrRisk,
    suggestedPlacementReason:
      stableSpanScore >= 0.55
        ? "stable_medium_length_text_span"
        : "text_span_requires_review",
  };
}

function recommendedLayers(layers: ReadonlyArray<string>): TextRecommendedLayer[] {
  return layers.map((layerId) => {
    const normalized = layerId.toLowerCase();
    const layerSuitability = normalized.includes("linguistic")
      ? 0.86
      : normalized.includes("zero")
        ? 0.72
        : normalized.includes("honey")
          ? 0.68
          : normalized.includes("homoglyph")
            ? 0.62
            : 0.5;
    return {
      layerId,
      layerSuitability,
      rationale: "advisory_layer_only_existing_text_rules_remain_authoritative",
    };
  });
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
