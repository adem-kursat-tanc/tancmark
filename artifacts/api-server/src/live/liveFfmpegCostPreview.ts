export const LIVE_FFMPEG_COST_PREVIEW_DECISION_ROLE =
  "live_ffmpeg_cost_preview_support_only_no_billing_no_vault_no_confirmed" as const;

export interface LiveFfmpegCostPreview {
  cpuSecondsEstimate: number;
  storageMbEstimate: number;
  segmentCountEstimate: number;
  recordingRetentionEstimate: "short_retention_3_7_days_preview";
  thumbnailPreviewEstimate: number;
  clipPreviewEstimate: number;
  unknownUntilRealLabMeasured: true;
  realPrice: false;
  billingCreditPaymentAdded: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_FFMPEG_COST_PREVIEW_DECISION_ROLE;
}

export interface LiveFfmpegCostPreviewInput {
  durationSecondsPreview?: number;
  segmentDurationSeconds?: number;
  segmentCountPreview?: number;
  thumbnailCountPreview?: number;
  clipCountPreview?: number;
}

function positiveNumber(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.ceil(value), max);
}

export function buildLiveFfmpegCostPreview(input: LiveFfmpegCostPreviewInput = {}): LiveFfmpegCostPreview {
  const durationSeconds = positiveNumber(input.durationSecondsPreview, 300, 7200);
  const segmentDuration = positiveNumber(input.segmentDurationSeconds, 6, 60);
  const thumbnailCount = positiveNumber(input.thumbnailCountPreview, 4, 30);
  const clipCount = positiveNumber(input.clipCountPreview, 2, 10);

  return {
    cpuSecondsEstimate: Math.ceil(durationSeconds * 0.8),
    storageMbEstimate: Math.ceil(durationSeconds * 1.5),
    segmentCountEstimate: Math.ceil(durationSeconds / segmentDuration),
    recordingRetentionEstimate: "short_retention_3_7_days_preview",
    thumbnailPreviewEstimate: thumbnailCount,
    clipPreviewEstimate: clipCount,
    unknownUntilRealLabMeasured: true,
    realPrice: false,
    billingCreditPaymentAdded: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_FFMPEG_COST_PREVIEW_DECISION_ROLE,
  };
}
