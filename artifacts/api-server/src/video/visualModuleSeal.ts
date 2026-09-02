import fs from "node:fs";
import path from "node:path";
import {
  decodeDnaPilotTraceFromFramePaths,
  emptyDnaPilotTraceTelemetry,
  stampDnaPilotTracePng,
  type DnaPilotTracePlan,
  type DnaPilotTraceTelemetry,
} from "./dnaPlacementPilot";
import { extractFrames, videoInfo } from "./ffmpegHelper";

export const VIDEO_VISUAL_MODULE_LAYER_ID =
  "image.visual-module-video-frame-seal";
export const VISUAL_CORE_TRACE_ID = "image.visual-core-trace";
export const VISUAL_RING_TRACE_ID = "image.visual-ring-trace";
export const VISUAL_CORE_REGION_ID = "image.visual-module-center-core";
export const VISUAL_RING_REGION_ID = "video.pilot-center-ring-multi-zone";

export interface VideoVisualTracePlan extends DnaPilotTracePlan {
  module: "image";
  visualTraceId: string;
  visualCarrierRole: "official_visual_id_trace";
  canOpenVisualVault: true;
}

export interface VideoVisualModuleSealPlan {
  enabled: boolean;
  active: boolean;
  defaultOn: true;
  module: "image";
  layerId: typeof VIDEO_VISUAL_MODULE_LAYER_ID;
  traces: VideoVisualTracePlan[];
  frameIdxs: number[];
  frameCount: number;
  traceCount: number;
  changesChannelA: false;
  changesChannelB: false;
  changesMainPlacement: false;
  createsChannelC: false;
  sealOverlaps: false;
  decisionRole: "visual_vault_requires_id_match";
  note: string;
}

export interface VideoVisualTraceDecodeTelemetry
  extends DnaPilotTraceTelemetry {
  module: "image";
  visualTraceId: string;
  visualCarrierRole: "official_visual_id_trace";
  canOpenVisualVault: true;
}

export interface VideoVisualModuleDecodeTelemetry {
  enabled: boolean;
  attempted: boolean;
  module: "image";
  layerId: typeof VIDEO_VISUAL_MODULE_LAYER_ID;
  traces: VideoVisualTraceDecodeTelemetry[];
  idMatched: boolean;
  matchingBitsMax: number;
  matchedTraceIds: string[];
  traceCount: number;
  frameCount: number;
  verdict: "VISUAL_ID_MATCH" | "VISUAL_CANDIDATE" | "VISUAL_NONE";
  canOpenVisualVault: boolean;
  officialDecisionRole: "VISUAL_VAULT requires 32/32 ID match";
  wallMs: number;
  note: string;
}

const VISUAL_BITS = 32;
const VISUAL_Q = 10;
const CORE_FRAME_PCTS = [0.11, 0.23, 0.35, 0.47, 0.59, 0.71, 0.83, 0.95];
const RING_FRAME_PCTS = [0.16, 0.28, 0.4, 0.52, 0.64, 0.76, 0.88];

export function videoVisualModuleSealEnabled(): boolean {
  const raw = process.env.AEGIS_VIDEO_VISUAL_MODULE_SEAL;
  if (raw === undefined || raw === "") return true;
  return !["0", "false", "off", "no"].includes(raw.toLowerCase());
}

export function buildVideoVisualModuleSealPlan(input: {
  totalFrames: number;
  usedFrameIdxs: ReadonlySet<number> | ReadonlyArray<number>;
}): VideoVisualModuleSealPlan {
  const enabled = videoVisualModuleSealEnabled();
  const used = new Set(
    Array.isArray(input.usedFrameIdxs)
      ? input.usedFrameIdxs
      : Array.from(input.usedFrameIdxs),
  );
  if (!enabled || input.totalFrames <= 0) {
    return emptyVisualPlan(enabled);
  }

  const coreFrames = pickFrames(input.totalFrames, CORE_FRAME_PCTS, used, 6);
  for (const idx of coreFrames) used.add(idx);
  const ringFrames = pickFrames(input.totalFrames, RING_FRAME_PCTS, used, 6);

  const traces: VideoVisualTracePlan[] = [];
  if (coreFrames.length >= 3) {
    traces.push(
      buildVisualTracePlan({
        visualTraceId: VISUAL_CORE_TRACE_ID,
        selectedRegionId: VISUAL_CORE_REGION_ID,
        selectedRegionLabel: "visual center core trace",
        selectedReason:
          "Video contains image frames; visual module gets a frame-disjoint center-core trace that does not overwrite video Channel A/B.",
        frameIdxs: coreFrames,
      }),
    );
  }
  if (ringFrames.length >= 3) {
    traces.push(
      buildVisualTracePlan({
        visualTraceId: VISUAL_RING_TRACE_ID,
        selectedRegionId: VISUAL_RING_REGION_ID,
        selectedRegionLabel: "visual center ring multi-zone trace",
        selectedReason:
          "Second visual trace is frame-disjoint from video Channel A/B and the first visual trace, giving the image module an independent visual ID path.",
        frameIdxs: ringFrames,
      }),
    );
  }

  const frameIdxs = traces.flatMap((trace) => trace.frameIdxs);
  return {
    enabled,
    active: traces.length > 0,
    defaultOn: true,
    module: "image",
    layerId: VIDEO_VISUAL_MODULE_LAYER_ID,
    traces,
    frameIdxs,
    frameCount: frameIdxs.length,
    traceCount: traces.length,
    changesChannelA: false,
    changesChannelB: false,
    changesMainPlacement: false,
    createsChannelC: false,
    sealOverlaps: false,
    decisionRole: "visual_vault_requires_id_match",
    note:
      traces.length >= 2
        ? "Visual module stamped two frame-disjoint ID traces. They are separate from video Channel A/B and can only produce VISUAL_VAULT after exact ID match."
        : traces.length === 1
          ? "Visual module stamped one ID trace because the safe frame pool was limited. Exact ID match is still required."
          : "Visual module found no safe frame-disjoint trace frames.",
  };
}

export async function stampVideoVisualModuleTraces(input: {
  videoPath: string;
  fps: number;
  workDir: string;
  payload4: Buffer;
  plan: VideoVisualModuleSealPlan;
}): Promise<Array<{ frameIdx: number; pngPath: string; visualTraceId: string }>> {
  if (!input.plan.enabled || !input.plan.active) return [];
  const out: Array<{ frameIdx: number; pngPath: string; visualTraceId: string }> =
    [];
  for (const trace of input.plan.traces) {
    const originals = await extractFrames(
      input.videoPath,
      trace.frameIdxs.map((idx) => idx / input.fps + 0.5 / input.fps),
      input.workDir,
    );
    for (let i = 0; i < trace.frameIdxs.length; i++) {
      const frameIdx = trace.frameIdxs[i]!;
      const original = originals[i];
      if (!original) continue;
      const stamped = await stampDnaPilotTracePng(
        fs.readFileSync(original.pngPath),
        input.payload4,
        trace.selectedRegionId,
      );
      const dst = path.join(
        input.workDir,
        `visual_${trace.visualTraceId.replace(/[^a-z0-9]+/gi, "_")}_${frameIdx
          .toString()
          .padStart(6, "0")}.png`,
      );
      fs.writeFileSync(dst, stamped);
      out.push({ frameIdx, pngPath: dst, visualTraceId: trace.visualTraceId });
    }
  }
  return out;
}

export async function decodeVideoVisualModuleFromDna(input: {
  videoPath: string;
  workDir: string;
  dna: unknown;
  expectedPayload4Hex: string;
}): Promise<VideoVisualModuleDecodeTelemetry> {
  const t0 = Date.now();
  const plan = extractVideoVisualModulePlanFromDna(input.dna);
  const expectedPayload4 = Buffer.from(input.expectedPayload4Hex || "", "hex");
  if (
    !plan.enabled ||
    !plan.active ||
    plan.traces.length === 0 ||
    expectedPayload4.length !== 4
  ) {
    return {
      enabled: plan.enabled,
      attempted: false,
      module: "image",
      layerId: VIDEO_VISUAL_MODULE_LAYER_ID,
      traces: [],
      idMatched: false,
      matchingBitsMax: 0,
      matchedTraceIds: [],
      traceCount: plan.traces.length,
      frameCount: plan.frameCount,
      verdict: "VISUAL_NONE",
      canOpenVisualVault: false,
      officialDecisionRole: "VISUAL_VAULT requires 32/32 ID match",
      wallMs: Date.now() - t0,
      note: "Visual module trace not available or expected payload missing.",
    };
  }

  const info = await videoInfo(input.videoPath);
  const traces: VideoVisualTraceDecodeTelemetry[] = [];
  for (const trace of plan.traces) {
    const readFrameIdxs = trace.frameIdxs.map((idx) =>
      Math.min(Math.max(0, idx - 1), Math.max(0, info.frameCount - 1)),
    );
    const frameDir = path.join(
      input.workDir,
      `visual_decode_${trace.visualTraceId.replace(/[^a-z0-9]+/gi, "_")}`,
    );
    const extracted = await extractFrames(
      input.videoPath,
      readFrameIdxs.map((idx) => idx / info.fps + 0.5 / info.fps),
      frameDir,
    );
    const framePaths = extracted.map((frame, i) => ({
      frameIdx: readFrameIdxs[i] ?? 0,
      pngPath: frame.pngPath,
    }));
    const telemetry = await decodeDnaPilotTraceFromFramePaths({
      framePaths,
      expectedPayload4,
      plan: trace,
    });
    traces.push({
      ...telemetry,
      module: "image",
      visualTraceId: trace.visualTraceId,
      visualCarrierRole: "official_visual_id_trace",
      canOpenVisualVault: true,
    });
  }

  const matchedTraceIds = traces
    .filter((trace) => trace.idMatched === true && trace.verdict === "PILOT_ID_MATCH")
    .map((trace) => trace.visualTraceId);
  const matchingBitsMax = traces.reduce(
    (max, trace) => Math.max(max, trace.matchingBits),
    0,
  );
  const idMatched = matchedTraceIds.length > 0;
  const verdict = idMatched
    ? "VISUAL_ID_MATCH"
    : matchingBitsMax >= 24
      ? "VISUAL_CANDIDATE"
      : "VISUAL_NONE";
  return {
    enabled: plan.enabled,
    attempted: true,
    module: "image",
    layerId: VIDEO_VISUAL_MODULE_LAYER_ID,
    traces,
    idMatched,
    matchingBitsMax,
    matchedTraceIds,
    traceCount: traces.length,
    frameCount: traces.reduce((sum, trace) => sum + trace.frameCount, 0),
    verdict,
    canOpenVisualVault: idMatched,
    officialDecisionRole: "VISUAL_VAULT requires 32/32 ID match",
    wallMs: Date.now() - t0,
    note: idMatched
      ? "Visual module read the expected ID from its own frame-disjoint trace."
      : verdict === "VISUAL_CANDIDATE"
        ? "Visual module saw candidate signal, but not an exact official ID match."
        : "Visual module did not recover the expected ID.",
  };
}

export function extractVideoVisualModulePlanFromDna(
  dna: unknown,
): VideoVisualModuleSealPlan {
  const rec = asRecord(dna);
  const meta = asRecord(rec["meta"]);
  const fromMeta = meta["videoVisualModuleSeal"];
  if (isVideoVisualModuleSealPlan(fromMeta)) {
    return fromMeta;
  }
  return emptyVisualPlan(false);
}

function emptyVisualPlan(enabled: boolean): VideoVisualModuleSealPlan {
  return {
    enabled,
    active: false,
    defaultOn: true,
    module: "image",
    layerId: VIDEO_VISUAL_MODULE_LAYER_ID,
    traces: [],
    frameIdxs: [],
    frameCount: 0,
    traceCount: 0,
    changesChannelA: false,
    changesChannelB: false,
    changesMainPlacement: false,
    createsChannelC: false,
    sealOverlaps: false,
    decisionRole: "visual_vault_requires_id_match",
    note: enabled
      ? "Visual module seal did not find enough safe frames."
      : "Visual module seal is disabled or absent in DNA.",
  };
}

function buildVisualTracePlan(input: {
  visualTraceId: string;
  selectedRegionId: string;
  selectedRegionLabel: string;
  selectedReason: string;
  frameIdxs: number[];
}): VideoVisualTracePlan {
  return {
    enabled: true,
    activeTraceApplied: true,
    selectedRegionId: input.selectedRegionId,
    selectedRegionLabel: input.selectedRegionLabel,
    selectedReason: input.selectedReason,
    frameIdxs: input.frameIdxs,
    frameCount: input.frameIdxs.length,
    carrier: "dna-pilot-center-differential",
    bitCount: VISUAL_BITS,
    quantStep: VISUAL_Q,
    changesChannelA: false,
    changesChannelB: false,
    changesMainPlacement: false,
    createsChannelC: false,
    canOpenVault: false,
    decisionRole: "candidate_only",
    note:
      "Visual module trace: separate image-module ID carrier. It never opens classic VAULT; route finalDecision may classify VISUAL_VAULT only on exact ID match.",
    module: "image",
    visualTraceId: input.visualTraceId,
    visualCarrierRole: "official_visual_id_trace",
    canOpenVisualVault: true,
  };
}

function pickFrames(
  totalFrames: number,
  percentages: ReadonlyArray<number>,
  used: ReadonlySet<number>,
  maxCount: number,
): number[] {
  const picked: number[] = [];
  const local = new Set<number>();
  for (const pct of percentages) {
    const center = Math.min(
      Math.max(0, Math.round(totalFrames * pct)),
      Math.max(0, totalFrames - 1),
    );
    const idx = nearestUnusedFrame(center, totalFrames, used, local);
    if (idx === null) continue;
    picked.push(idx);
    local.add(idx);
    if (picked.length >= maxCount) break;
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

function isVideoVisualModuleSealPlan(
  value: unknown,
): value is VideoVisualModuleSealPlan {
  const rec = asRecord(value);
  return (
    rec["module"] === "image" &&
    rec["layerId"] === VIDEO_VISUAL_MODULE_LAYER_ID &&
    Array.isArray(rec["traces"])
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
