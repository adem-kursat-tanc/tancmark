export const AUDIO_PLACEMENT_ADVISORY_DECISION_ROLE =
  "advisory_only_no_vault_no_confirmed" as const;

export interface AudioCurrentTracePlacement {
  traceId: string;
  startSec: number;
  durationSec: number;
  freqZeroHz?: number | undefined;
  freqOneHz?: number | undefined;
}

export interface AudioPlacementAdvisoryInput {
  durationSec: number;
  sampleRate?: number | undefined;
  samples?: ReadonlyArray<number> | undefined;
  currentPlacement?: ReadonlyArray<AudioCurrentTracePlacement> | undefined;
  traceDurationSec?: number | undefined;
  minTrimMarginSec?: number | undefined;
  maxRecommendations?: number | undefined;
}

export interface AudioWindowAdvisory {
  startSec: number;
  durationSec: number;
  silenceScore: number;
  energyScore: number;
  energyStability: number;
  clippingRisk: number;
  trimRisk: number;
  durationSafety: number;
  carrierBandNoise: number;
  riskScore: number;
  recommendedWindowScore: number;
  suggestedPlacementReason: string;
}

export interface AudioCurrentPlacementRisk {
  traceId: string;
  startSec: number;
  durationSec: number;
  riskScore: number;
  energyScore: number;
  silenceRisk: number;
  trimRisk: number;
  clippingRisk: number;
}

export interface AudioPlacementAdvisoryResult {
  module: "audio";
  decisionRole: typeof AUDIO_PLACEMENT_ADVISORY_DECISION_ROLE;
  placementWillChange: false;
  productRouteChanged: false;
  sampleAnalysisAvailable: boolean;
  traceDurationSec: number;
  currentPlacementRisk: AudioCurrentPlacementRisk[];
  recommendedWindows: AudioWindowAdvisory[];
  noRecommendationReason?: string | undefined;
  safety: {
    advisoryOnly: true;
    canOpenVault: false;
    confirmed: false;
    canChangeSealPlacement: false;
    canChangeThresholds: false;
  };
}

const DEFAULT_TRACE_DURATION_SEC = 32 * 0.052;
const DEFAULT_MIN_TRIM_MARGIN_SEC = 0.75;

export function buildAudioPlacementAdvisory(
  input: AudioPlacementAdvisoryInput,
): AudioPlacementAdvisoryResult {
  const durationSec = finitePositive(input.durationSec) ? input.durationSec : 0;
  const traceDurationSec = finitePositive(input.traceDurationSec)
    ? input.traceDurationSec
    : DEFAULT_TRACE_DURATION_SEC;
  const minTrimMarginSec = finitePositive(input.minTrimMarginSec)
    ? input.minTrimMarginSec
    : DEFAULT_MIN_TRIM_MARGIN_SEC;
  const sampleRate = finitePositive(input.sampleRate) ? input.sampleRate : 0;
  const samples = input.samples ?? [];
  const sampleAnalysisAvailable = sampleRate > 0 && samples.length > 0;
  const maxRecommendations = Math.max(1, input.maxRecommendations ?? 3);
  const minRequiredDuration = traceDurationSec + minTrimMarginSec * 2;

  const currentPlacementRisk = (input.currentPlacement ?? []).map((trace) => {
    const metrics = scoreWindow({
      startSec: trace.startSec,
      durationSec: trace.durationSec,
      totalDurationSec: durationSec,
      minTrimMarginSec,
      sampleRate,
      samples,
      sampleAnalysisAvailable,
    });
    return {
      traceId: trace.traceId,
      startSec: trace.startSec,
      durationSec: trace.durationSec,
      riskScore: metrics.riskScore,
      energyScore: metrics.energyScore,
      silenceRisk: metrics.silenceScore,
      trimRisk: metrics.trimRisk,
      clippingRisk: metrics.clippingRisk,
    };
  });

  if (durationSec < minRequiredDuration) {
    return baseResult({
      sampleAnalysisAvailable,
      traceDurationSec,
      currentPlacementRisk,
      recommendedWindows: [],
      noRecommendationReason: "audio_too_short_for_safe_advisory_window",
    });
  }

  const startMin = minTrimMarginSec;
  const startMax = Math.max(startMin, durationSec - traceDurationSec - minTrimMarginSec);
  const stepSec = Math.max(0.2, Math.min(0.75, durationSec / 24));
  const windows: AudioWindowAdvisory[] = [];

  for (let startSec = startMin; startSec <= startMax + 1e-9; startSec += stepSec) {
    windows.push(
      scoreWindow({
        startSec,
        durationSec: traceDurationSec,
        totalDurationSec: durationSec,
        minTrimMarginSec,
        sampleRate,
        samples,
        sampleAnalysisAvailable,
      }),
    );
  }

  const recommendedWindows = windows
    .filter((w) => w.durationSafety > 0.95 && w.silenceScore < 0.85 && w.clippingRisk < 0.65)
    .sort((a, b) => b.recommendedWindowScore - a.recommendedWindowScore)
    .slice(0, maxRecommendations);

  return baseResult({
    sampleAnalysisAvailable,
    traceDurationSec,
    currentPlacementRisk,
    recommendedWindows,
    noRecommendationReason:
      recommendedWindows.length === 0 ? "no_low_risk_audio_window_found" : undefined,
  });
}

function baseResult(input: {
  sampleAnalysisAvailable: boolean;
  traceDurationSec: number;
  currentPlacementRisk: AudioCurrentPlacementRisk[];
  recommendedWindows: AudioWindowAdvisory[];
  noRecommendationReason?: string | undefined;
}): AudioPlacementAdvisoryResult {
  return {
    module: "audio",
    decisionRole: AUDIO_PLACEMENT_ADVISORY_DECISION_ROLE,
    placementWillChange: false,
    productRouteChanged: false,
    sampleAnalysisAvailable: input.sampleAnalysisAvailable,
    traceDurationSec: round3(input.traceDurationSec),
    currentPlacementRisk: input.currentPlacementRisk,
    recommendedWindows: input.recommendedWindows,
    noRecommendationReason: input.noRecommendationReason,
    safety: {
      advisoryOnly: true,
      canOpenVault: false,
      confirmed: false,
      canChangeSealPlacement: false,
      canChangeThresholds: false,
    },
  };
}

function scoreWindow(input: {
  startSec: number;
  durationSec: number;
  totalDurationSec: number;
  minTrimMarginSec: number;
  sampleRate: number;
  samples: ReadonlyArray<number>;
  sampleAnalysisAvailable: boolean;
}): AudioWindowAdvisory {
  const trimRisk = computeTrimRisk(
    input.startSec,
    input.startSec + input.durationSec,
    input.totalDurationSec,
    input.minTrimMarginSec,
  );
  const durationSafety =
    input.totalDurationSec >= input.durationSec + input.minTrimMarginSec * 2 ? 1 : 0;
  const stats = input.sampleAnalysisAvailable
    ? sampleStats(input.samples, input.sampleRate, input.startSec, input.durationSec)
    : neutralStats();
  const silenceScore = clamp01(stats.rms < 0.012 ? 1 : 1 - stats.rms / 0.08);
  const energyScore = clamp01(1 - Math.abs(stats.rms - 0.16) / 0.16);
  const energyStability = clamp01(1 - stats.rmsVariation);
  const clippingRisk = clamp01(stats.clippingRatio * 8);
  const carrierBandNoise = clamp01(stats.zeroCrossingRate / 0.35);
  const recommendedWindowScore = clamp01(
    energyScore *
      (0.45 + 0.55 * energyStability) *
      (1 - silenceScore * 0.75) *
      (1 - clippingRisk * 0.9) *
      (1 - trimRisk * 0.85) *
      (1 - carrierBandNoise * 0.25) *
      durationSafety,
  );
  const riskScore = clamp01(1 - recommendedWindowScore);
  return {
    startSec: round3(input.startSec),
    durationSec: round3(input.durationSec),
    silenceScore: round3(silenceScore),
    energyScore: round3(energyScore),
    energyStability: round3(energyStability),
    clippingRisk: round3(clippingRisk),
    trimRisk: round3(trimRisk),
    durationSafety: round3(durationSafety),
    carrierBandNoise: round3(carrierBandNoise),
    riskScore: round3(riskScore),
    recommendedWindowScore: round3(recommendedWindowScore),
    suggestedPlacementReason: reasonFor({
      silenceScore,
      energyScore,
      energyStability,
      clippingRisk,
      trimRisk,
      carrierBandNoise,
    }),
  };
}

function sampleStats(
  samples: ReadonlyArray<number>,
  sampleRate: number,
  startSec: number,
  durationSec: number,
) {
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(samples.length, Math.max(start + 1, Math.floor((startSec + durationSec) * sampleRate)));
  let sumSq = 0;
  let clipping = 0;
  let crossings = 0;
  let prev = samples[start] ?? 0;
  for (let i = start; i < end; i++) {
    const v = clampSample(samples[i] ?? 0);
    sumSq += v * v;
    if (Math.abs(v) >= 0.98) clipping++;
    if ((v >= 0 && prev < 0) || (v < 0 && prev >= 0)) crossings++;
    prev = v;
  }
  const n = Math.max(1, end - start);
  const rms = Math.sqrt(sumSq / n);
  const chunks = 4;
  const chunkRms: number[] = [];
  for (let c = 0; c < chunks; c++) {
    const cs = start + Math.floor((n * c) / chunks);
    const ce = start + Math.floor((n * (c + 1)) / chunks);
    let css = 0;
    for (let i = cs; i < ce; i++) {
      const v = clampSample(samples[i] ?? 0);
      css += v * v;
    }
    chunkRms.push(Math.sqrt(css / Math.max(1, ce - cs)));
  }
  const mean = chunkRms.reduce((a, b) => a + b, 0) / chunkRms.length;
  const variance =
    chunkRms.reduce((a, b) => a + (b - mean) * (b - mean), 0) / chunkRms.length;
  return {
    rms,
    clippingRatio: clipping / n,
    zeroCrossingRate: crossings / n,
    rmsVariation: Math.sqrt(variance) / Math.max(0.001, mean),
  };
}

function neutralStats() {
  return {
    rms: 0.12,
    clippingRatio: 0,
    zeroCrossingRate: 0.08,
    rmsVariation: 0.25,
  };
}

function computeTrimRisk(
  startSec: number,
  endSec: number,
  durationSec: number,
  marginSec: number,
) {
  const left = clamp01((marginSec - startSec) / marginSec);
  const right = clamp01((endSec - (durationSec - marginSec)) / marginSec);
  return clamp01(Math.max(left, right));
}

function reasonFor(input: {
  silenceScore: number;
  energyScore: number;
  energyStability: number;
  clippingRisk: number;
  trimRisk: number;
  carrierBandNoise: number;
}) {
  const reasons: string[] = [];
  if (input.silenceScore < 0.25) reasons.push("non_silent");
  if (input.energyScore > 0.55) reasons.push("usable_energy");
  if (input.energyStability > 0.65) reasons.push("stable_energy");
  if (input.clippingRisk < 0.2) reasons.push("low_clipping");
  if (input.trimRisk < 0.2) reasons.push("away_from_trim_edges");
  if (input.carrierBandNoise < 0.55) reasons.push("carrier_noise_acceptable");
  return reasons.length > 0 ? reasons.join(";") : "advisory_window_requires_review";
}

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function finitePositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
