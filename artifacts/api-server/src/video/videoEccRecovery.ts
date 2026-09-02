import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  VISUAL_ECC_RECOVERY_LAYER_ID,
  embedVisualEccRecoveryLayer,
  verifyVisualEccRecoveryCandidateFrames,
  type VisualEccCandidateResult,
  type VisualEccReadFrame,
  type VisualEccRecoveryEmbedResult,
} from "@workspace/aegis-core";
import { extractFrames, videoInfo } from "./ffmpegHelper";

export const VIDEO_ECC_RECOVERY_LAYER_ID =
  "video-ecc-visual-recovery-v1" as const;

export type VideoEccRecoveryCarrier =
  "visual_ecc_ring_soft14_margin24_on_frame_disjoint_video_frames";

export interface VideoEccRecoveryPlan {
  enabled: boolean;
  active: boolean;
  layerId: typeof VIDEO_ECC_RECOVERY_LAYER_ID;
  visualLayerId: typeof VISUAL_ECC_RECOVERY_LAYER_ID;
  carrier: VideoEccRecoveryCarrier;
  role: "candidate_support_only_no_vault";
  frameIdxs: number[];
  frameCount: number;
  width: number;
  height: number;
  payload4Hex: string;
  cloakId: string;
  frameWindowOffsets: number[];
  normalizeRead: true;
  changesChannelA: false;
  changesChannelB: false;
  changesMainPlacement: false;
  createsChannelC: false;
  sealOverlaps: false;
  canOpenVault: false;
  confirmed: false;
  vaultEligible: false;
  note: string;
}

export interface VideoEccRecoveryEmbedTelemetry {
  plan: VideoEccRecoveryPlan;
  framesStamped: number;
  embeds: Array<
    VisualEccRecoveryEmbedResult & {
      frameIdx: number;
    }
  >;
}

export interface VideoEccRecoveryDecodeTelemetry {
  enabled: boolean;
  attempted: boolean;
  layerId: typeof VIDEO_ECC_RECOVERY_LAYER_ID;
  visualLayerId: typeof VISUAL_ECC_RECOVERY_LAYER_ID;
  carrier: VideoEccRecoveryCarrier;
  role: "candidate_support_only_no_vault";
  frameIdxs: number[];
  frameCount: number;
  frameWindowOffsets: number[];
  bestOffset: number | null;
  normalizedReadUsed: boolean;
  candidateSupport: boolean;
  recoveredIdHex: string | null;
  recoveredMatchesExpected: boolean;
  parityBitMatches: number;
  parityByteMatches: number;
  confidenceBand: VisualEccCandidateResult["confidenceBand"];
  averageConfidence: number;
  verdict: "VIDEO_ECC_SUPPORT" | "VIDEO_ECC_CANDIDATE" | "VIDEO_ECC_NONE";
  exactOnly: true;
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
  reason:
    | "ok"
    | "no_plan"
    | "missing_expected_id"
    | "no_exact_match"
    | "decode_error";
  note: string;
  wallMs: number;
}

const VIDEO_ECC_FRAME_PCTS = [
  0.13,
  0.185,
  0.24,
  0.315,
  0.41,
  0.505,
  0.61,
  0.72,
  0.83,
  0.91,
];
const VIDEO_ECC_MAX_FRAMES = 8;
const VIDEO_ECC_FRAME_WINDOW_OFFSETS = [-2, -1, 0, 1, 2] as const;
const VIDEO_ECC_CLOAK_SUFFIX_HEX = "e5f60718293a4b5c";

export function buildVideoEccRecoveryPlan(input: {
  totalFrames: number;
  usedFrameIdxs: ReadonlySet<number> | ReadonlyArray<number>;
  width: number;
  height: number;
  payload4Hex: string;
}): VideoEccRecoveryPlan {
  const used = new Set(
    Array.isArray(input.usedFrameIdxs)
      ? input.usedFrameIdxs
      : Array.from(input.usedFrameIdxs),
  );
  const frameIdxs = pickFrameDisjointSlots(input.totalFrames, used);
  const active =
    frameIdxs.length >= 4 &&
    input.width >= 96 &&
    input.height >= 96 &&
    /^[0-9a-f]{8}$/i.test(input.payload4Hex);
  return {
    enabled: true,
    active,
    layerId: VIDEO_ECC_RECOVERY_LAYER_ID,
    visualLayerId: VISUAL_ECC_RECOVERY_LAYER_ID,
    carrier: "visual_ecc_ring_soft14_margin24_on_frame_disjoint_video_frames",
    role: "candidate_support_only_no_vault",
    frameIdxs: active ? frameIdxs : [],
    frameCount: active ? frameIdxs.length : 0,
    width: input.width,
    height: input.height,
    payload4Hex: input.payload4Hex.toLowerCase(),
    cloakId: `${input.payload4Hex.toLowerCase()}${VIDEO_ECC_CLOAK_SUFFIX_HEX}`,
    frameWindowOffsets: [...VIDEO_ECC_FRAME_WINDOW_OFFSETS],
    normalizeRead: true,
    changesChannelA: false,
    changesChannelB: false,
    changesMainPlacement: false,
    createsChannelC: false,
    sealOverlaps: false,
    canOpenVault: false,
    confirmed: false,
    vaultEligible: false,
    note: active
      ? "Video ECC recovery layer stamps external visual ECC parity on frame-disjoint video frames. It is candidate-support only and never opens VAULT."
      : "Video ECC recovery layer found no safe frame-disjoint slots or invalid geometry.",
  };
}

export async function stampVideoEccRecoveryFrames(input: {
  videoPath: string;
  fps: number;
  workDir: string;
  plan: VideoEccRecoveryPlan;
}): Promise<{
  replacements: Array<{ frameIdx: number; pngPath: string }>;
  telemetry: VideoEccRecoveryEmbedTelemetry;
}> {
  if (!input.plan.active) {
    return { replacements: [], telemetry: { plan: input.plan, framesStamped: 0, embeds: [] } };
  }
  const originals = await extractFrames(
    input.videoPath,
    input.plan.frameIdxs.map((idx) => idx / input.fps + 0.5 / input.fps),
    input.workDir,
  );
  const replacements: Array<{ frameIdx: number; pngPath: string }> = [];
  const embeds: VideoEccRecoveryEmbedTelemetry["embeds"] = [];
  let stampedWidth = input.plan.width;
  let stampedHeight = input.plan.height;
  for (let i = 0; i < input.plan.frameIdxs.length; i++) {
    const frameIdx = input.plan.frameIdxs[i]!;
    const original = originals[i];
    if (!original) continue;
    const { data, info } = await sharp(original.pngPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (embeds.length === 0) {
      stampedWidth = info.width;
      stampedHeight = info.height;
    }
    const embed = embedVisualEccRecoveryLayer(
      rgba,
      info.width,
      info.height,
      4,
      input.plan.cloakId,
    );
    const dst = path.join(
      input.workDir,
      `video_ecc_${frameIdx.toString().padStart(6, "0")}.png`,
    );
    await sharp(Buffer.from(rgba), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 1 })
      .toFile(dst);
    embeds.push({ ...embed, frameIdx });
    if (embed.embedded) replacements.push({ frameIdx, pngPath: dst });
  }
  return {
    replacements,
    telemetry: {
      plan: {
        ...input.plan,
        active: replacements.length > 0,
        width: stampedWidth,
        height: stampedHeight,
        frameIdxs: replacements.map((item) => item.frameIdx),
        frameCount: replacements.length,
        note:
          replacements.length > 0
            ? input.plan.note
            : "Video ECC recovery layer was planned, but no frames were stamped.",
      },
      framesStamped: replacements.length,
      embeds,
    },
  };
}

export async function decodeVideoEccRecoveryFromDna(input: {
  videoPath: string;
  workDir: string;
  dna: unknown;
  expectedPayload4Hex: string;
}): Promise<VideoEccRecoveryDecodeTelemetry> {
  const t0 = Date.now();
  const plan = extractVideoEccRecoveryPlanFromDna(input.dna);
  const expectedPayload4Hex = (input.expectedPayload4Hex ?? "").toLowerCase();
  if (!plan?.active || plan.frameIdxs.length === 0) {
    return emptyDecode("no_plan", Date.now() - t0, plan);
  }
  if (!/^[0-9a-f]{8}$/.test(expectedPayload4Hex)) {
    return emptyDecode("missing_expected_id", Date.now() - t0, plan);
  }
  if (!plan.cloakId.toLowerCase().startsWith(expectedPayload4Hex)) {
    return emptyDecode("missing_expected_id", Date.now() - t0, plan);
  }

  try {
    const info = await videoInfo(input.videoPath);
    let best: {
      result: VisualEccCandidateResult;
      offset: number;
      normalized: boolean;
    } | null = null;
    for (const offset of plan.frameWindowOffsets) {
      const shifted = plan.frameIdxs.map((idx) =>
        clampInt(idx + offset, 0, Math.max(0, info.frameCount - 1)),
      );
      const frameDir = path.join(input.workDir, `video_ecc_decode_o${offset}`);
      const extracted = await extractFrames(
        input.videoPath,
        shifted.map((idx) => idx / info.fps + 0.5 / info.fps),
        frameDir,
      );
      const directFrames = await loadReadFrames(extracted.map((frame) => frame.pngPath));
      const direct = verifyVisualEccRecoveryCandidateFrames(directFrames, [plan.cloakId]);
      best = chooseBest(best, { result: direct, offset, normalized: false });
      if (direct.exactParityMatch) break;

      const needsNormalize =
        info.width !== plan.width ||
        info.height !== plan.height ||
        direct.parityBitMatches >= 20;
      if (needsNormalize) {
        const normalizedFrames = await loadReadFrames(
          extracted.map((frame) => frame.pngPath),
          { width: plan.width, height: plan.height },
        );
        const normalized = verifyVisualEccRecoveryCandidateFrames(
          normalizedFrames,
          [plan.cloakId],
        );
        best = chooseBest(best, { result: normalized, offset, normalized: true });
        if (normalized.exactParityMatch) break;
      }
    }
    if (!best) return emptyDecode("no_exact_match", Date.now() - t0, plan);
    const result = best.result;
    const support =
      result.exactParityMatch &&
      result.recoveredMatchesExpected &&
      result.recoveredIdHex === expectedPayload4Hex;
    return {
      enabled: true,
      attempted: true,
      layerId: VIDEO_ECC_RECOVERY_LAYER_ID,
      visualLayerId: VISUAL_ECC_RECOVERY_LAYER_ID,
      carrier: plan.carrier,
      role: "candidate_support_only_no_vault",
      frameIdxs: [...plan.frameIdxs],
      frameCount: plan.frameCount,
      frameWindowOffsets: [...plan.frameWindowOffsets],
      bestOffset: best.offset,
      normalizedReadUsed: best.normalized,
      candidateSupport: support,
      recoveredIdHex: support ? result.recoveredIdHex : null,
      recoveredMatchesExpected: support,
      parityBitMatches: result.parityBitMatches,
      parityByteMatches: result.parityByteMatches,
      confidenceBand: result.confidenceBand,
      averageConfidence: result.averageConfidence,
      verdict: support
        ? "VIDEO_ECC_SUPPORT"
        : result.parityBitMatches >= 24
          ? "VIDEO_ECC_CANDIDATE"
          : "VIDEO_ECC_NONE",
      exactOnly: true,
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
      reason: support ? "ok" : "no_exact_match",
      note: support
        ? "Video ECC recovered the registered payload exactly as candidate support only; it does not open VAULT."
        : "Video ECC did not recover an exact registered payload. Partial bits remain candidate telemetry only.",
      wallMs: Date.now() - t0,
    };
  } catch {
    return emptyDecode("decode_error", Date.now() - t0, plan);
  }
}

export function extractVideoEccRecoveryPlanFromDna(
  dna: unknown,
): VideoEccRecoveryPlan | null {
  const rec = asRecord(dna);
  const meta = asRecord(rec["meta"]);
  const fromMeta = meta["videoEccRecovery"];
  if (isVideoEccRecoveryPlan(fromMeta)) return fromMeta;
  const maps = asRecord(rec["maps"]);
  const encodeMap = asRecord(maps["encodeMap"]);
  const fromMap = encodeMap["videoEccRecovery"];
  if (isVideoEccRecoveryPlan(fromMap)) return fromMap;
  return null;
}

async function loadReadFrames(
  pngPaths: readonly string[],
  normalizeTo?: { width: number; height: number },
): Promise<VisualEccReadFrame[]> {
  const frames: VisualEccReadFrame[] = [];
  for (const pngPath of pngPaths) {
    const img = sharp(pngPath).ensureAlpha();
    const normalized = normalizeTo
      ? img.resize(normalizeTo.width, normalizeTo.height, {
          fit: "fill",
          kernel: "lanczos3",
        })
      : img;
    const { data, info } = await normalized
      .raw()
      .toBuffer({ resolveWithObject: true });
    frames.push({
      raw: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      width: info.width,
      height: info.height,
      channels: 4,
    });
  }
  return frames;
}

function chooseBest(
  current: {
    result: VisualEccCandidateResult;
    offset: number;
    normalized: boolean;
  } | null,
  next: {
    result: VisualEccCandidateResult;
    offset: number;
    normalized: boolean;
  },
) {
  if (!current) return next;
  if (next.result.exactParityMatch !== current.result.exactParityMatch) {
    return next.result.exactParityMatch ? next : current;
  }
  if (next.result.parityByteMatches !== current.result.parityByteMatches) {
    return next.result.parityByteMatches > current.result.parityByteMatches
      ? next
      : current;
  }
  if (next.result.parityBitMatches !== current.result.parityBitMatches) {
    return next.result.parityBitMatches > current.result.parityBitMatches
      ? next
      : current;
  }
  return next.result.averageConfidence > current.result.averageConfidence
    ? next
    : current;
}

function pickFrameDisjointSlots(
  totalFrames: number,
  used: Set<number>,
): number[] {
  const picked: number[] = [];
  const local = new Set<number>();
  for (const pct of VIDEO_ECC_FRAME_PCTS) {
    const center = clampInt(
      Math.round(totalFrames * pct),
      0,
      Math.max(0, totalFrames - 1),
    );
    const idx = nearestUnusedFrame(center, totalFrames, used, local);
    if (idx === null) continue;
    picked.push(idx);
    local.add(idx);
    used.add(idx);
    if (picked.length >= VIDEO_ECC_MAX_FRAMES) break;
  }
  return picked.sort((a, b) => a - b);
}

function nearestUnusedFrame(
  center: number,
  totalFrames: number,
  used: ReadonlySet<number>,
  local: ReadonlySet<number>,
): number | null {
  for (let radius = 0; radius < totalFrames; radius++) {
    const left = center - radius;
    if (left >= 0 && !used.has(left) && !local.has(left)) return left;
    const right = center + radius;
    if (right < totalFrames && !used.has(right) && !local.has(right)) {
      return right;
    }
  }
  return null;
}

function emptyDecode(
  reason: VideoEccRecoveryDecodeTelemetry["reason"],
  wallMs: number,
  plan?: VideoEccRecoveryPlan | null,
): VideoEccRecoveryDecodeTelemetry {
  return {
    enabled: plan?.enabled ?? false,
    attempted: reason !== "no_plan",
    layerId: VIDEO_ECC_RECOVERY_LAYER_ID,
    visualLayerId: VISUAL_ECC_RECOVERY_LAYER_ID,
    carrier:
      plan?.carrier ??
      "visual_ecc_ring_soft14_margin24_on_frame_disjoint_video_frames",
    role: "candidate_support_only_no_vault",
    frameIdxs: plan?.frameIdxs ? [...plan.frameIdxs] : [],
    frameCount: plan?.frameCount ?? 0,
    frameWindowOffsets: plan?.frameWindowOffsets
      ? [...plan.frameWindowOffsets]
      : [...VIDEO_ECC_FRAME_WINDOW_OFFSETS],
    bestOffset: null,
    normalizedReadUsed: false,
    candidateSupport: false,
    recoveredIdHex: null,
    recoveredMatchesExpected: false,
    parityBitMatches: 0,
    parityByteMatches: 0,
    confidenceBand: "none",
    averageConfidence: 0,
    verdict: "VIDEO_ECC_NONE",
    exactOnly: true,
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
    reason,
    note:
      reason === "no_plan"
        ? "Video ECC recovery plan is absent."
        : "Video ECC recovery did not produce exact candidate support.",
    wallMs,
  };
}

function isVideoEccRecoveryPlan(value: unknown): value is VideoEccRecoveryPlan {
  const rec = asRecord(value);
  return (
    rec["layerId"] === VIDEO_ECC_RECOVERY_LAYER_ID &&
    rec["visualLayerId"] === VISUAL_ECC_RECOVERY_LAYER_ID &&
    Array.isArray(rec["frameIdxs"]) &&
    typeof rec["cloakId"] === "string"
  );
}

function clampInt(v: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, v));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
