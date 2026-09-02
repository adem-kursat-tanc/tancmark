import sharp from "sharp";
import type { DnaPreAnalysisReport } from "../dna/preAnalysis";

export type DnaPilotVerdict =
  | "PILOT_ID_MATCH"
  | "PILOT_CANDIDATE"
  | "PILOT_NONE";

export interface DnaPilotTracePlan {
  enabled: boolean;
  activeTraceApplied: boolean;
  selectedRegionId: string | null;
  selectedRegionLabel: string | null;
  selectedReason: string;
  frameIdxs: number[];
  frameCount: number;
  carrier: "dna-pilot-center-differential";
  bitCount: 32;
  quantStep: number;
  changesChannelA: false;
  changesChannelB: false;
  changesMainPlacement: false;
  createsChannelC: false;
  canOpenVault: false;
  decisionRole: "candidate_only";
  note: string;
}

export interface DnaPilotTraceTelemetry extends DnaPilotTracePlan {
  attempted: boolean;
  framesDecoded: number;
  expectedPayloadHex: string;
  candidatePayloadHex: string;
  matchingBits: number;
  unknownBits: number;
  idMatched: boolean;
  verdict: DnaPilotVerdict;
  bestGeometryVariant: string;
  variantMatches: Array<{
    variant: string;
    matchingBits: number;
    candidatePayloadHex: string;
  }>;
  readAlignLayer: {
    enabled: boolean;
    layerId: "READ_ALIGN_LAYER";
    mode: "read_side_variant_search";
    legacyBestMatchingBits: number;
    alignedBestMatchingBits: number;
    improved: boolean;
    officialDecisionChanged: boolean;
    variantsTried: number;
    bestVariant: string;
    note: string;
  };
  decisive: false;
  wallMs: number;
}

const PILOT_BITS = 32;
const PILOT_BLOCK = 12;
const PILOT_Q = 10;
const PILOT_DIFF_MARGIN = 34;
const PILOT_DIFF_CLAMP = 26;
const PILOT_PAIRS_PER_ROW = 8;
const PILOT_ROWS = 4;
const CENTER_RING_REGION_ID = "video.pilot-center-ring-multi-zone";

const EMPTY_PLAN: DnaPilotTracePlan = {
  enabled: false,
  activeTraceApplied: false,
  selectedRegionId: null,
  selectedRegionLabel: null,
  selectedReason: "DNA active placement pilot is disabled.",
  frameIdxs: [],
  frameCount: 0,
  carrier: "dna-pilot-center-differential",
  bitCount: PILOT_BITS,
  quantStep: PILOT_Q,
  changesChannelA: false,
  changesChannelB: false,
  changesMainPlacement: false,
  createsChannelC: false,
  canOpenVault: false,
  decisionRole: "candidate_only",
  note: "No pilot trace.",
};

export function emptyDnaPilotTraceTelemetry(
  expectedPayloadHex = "",
): DnaPilotTraceTelemetry {
  return {
    ...EMPTY_PLAN,
    attempted: false,
    framesDecoded: 0,
    expectedPayloadHex,
    candidatePayloadHex: "",
    matchingBits: 0,
    unknownBits: PILOT_BITS,
    idMatched: false,
    verdict: "PILOT_NONE",
    bestGeometryVariant: "none",
    variantMatches: [],
    readAlignLayer: emptyReadAlignLayer(),
    decisive: false,
    wallMs: 0,
  };
}

function emptyReadAlignLayer(): DnaPilotTraceTelemetry["readAlignLayer"] {
  return {
    enabled: false,
    layerId: "READ_ALIGN_LAYER",
    mode: "read_side_variant_search",
    legacyBestMatchingBits: 0,
    alignedBestMatchingBits: 0,
    improved: false,
    officialDecisionChanged: false,
    variantsTried: 0,
    bestVariant: "none",
    note:
      "Read-side alignment was not attempted because the trace was disabled or unavailable.",
  };
}

function buildReadAlignVariants(): Array<{
  name: string;
  scale: number;
  dx: number;
  dy: number;
  readAlign: true;
}> {
  if (["0", "false", "off", "no"].includes((process.env.AEGIS_READ_ALIGN_LAYER ?? "").toLowerCase())) {
    return [];
  }
  const scales = [1.4, 1.67, 2.0];
  const offsets = [
    { label: "center", dx: 0, dy: 0 },
    { label: "left", dx: -18, dy: 0 },
    { label: "right", dx: 18, dy: 0 },
    { label: "up", dx: 0, dy: -18 },
    { label: "down", dx: 0, dy: 18 },
    { label: "up_left", dx: -18, dy: -18 },
    { label: "up_right", dx: 18, dy: -18 },
    { label: "down_left", dx: -18, dy: 18 },
    { label: "down_right", dx: 18, dy: 18 },
  ];
  const variants: Array<{
    name: string;
    scale: number;
    dx: number;
    dy: number;
    readAlign: true;
  }> = [];
  for (const scale of scales) {
    for (const offset of offsets) {
      variants.push({
        name: `read_align_scale_${scale}_${offset.label}`,
        scale,
        dx: offset.dx,
        dy: offset.dy,
        readAlign: true,
      });
    }
  }
  return variants;
}

export function buildDnaPilotTracePlan(
  report: DnaPreAnalysisReport,
): DnaPilotTracePlan {
  const pilot = report.placementPilot;
  if (!pilot?.enabled || pilot.mode !== "active_trace_candidate_only") {
    return { ...EMPTY_PLAN };
  }
  const requestedRegion =
    process.env.AEGIS_DNA_ACTIVE_PLACEMENT_REGION === "center_ring_multi_zone"
      ? CENTER_RING_REGION_ID
      : null;
  const selected =
    (requestedRegion
      ? pilot.candidateRegions.find((r) => r.regionId === requestedRegion)
      : undefined) ??
    pilot.candidateRegions[0] ??
    null;
  const frameIdxs = pilot.candidateFrameSample.slice(0, 6);
  return {
    enabled: true,
    activeTraceApplied: frameIdxs.length > 0 && selected !== null,
    selectedRegionId: selected?.regionId ?? null,
    selectedRegionLabel: selected?.label ?? null,
    selectedReason:
      selected?.reason ??
      "No candidate region was available for active pilot tracing.",
    frameIdxs,
    frameCount: frameIdxs.length,
    carrier: "dna-pilot-center-differential",
    bitCount: PILOT_BITS,
    quantStep: PILOT_Q,
    changesChannelA: false,
    changesChannelB: false,
    changesMainPlacement: false,
    createsChannelC: false,
    canOpenVault: false,
    decisionRole: "candidate_only",
    note:
      "DNA active placement trace: separate from classic Channel A/B. It never opens classic VAULT directly; route finalDecision may classify DNA_VAULT only on 32/32 ID match.",
  };
}

export async function stampDnaPilotTracePng(
  pngBuffer: Buffer,
  payload4: Buffer,
  selectedRegionId?: string | null,
): Promise<Buffer> {
  const img = sharp(pngBuffer).ensureAlpha();
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("dnaPilot: missing PNG dimensions");
  }
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const blocks = pilotBlocks(width, height, 1, selectedRegionId);
  const bits = payloadToBits(payload4);

  for (let i = 0; i < PILOT_BITS; i++) {
    const left = blocks[i * 2]!;
    const right = blocks[i * 2 + 1]!;
    const leftMean = blockMeanY(rgba, width, left.x, left.y);
    const rightMean = blockMeanY(rgba, width, right.x, right.y);
    const currentDiff = leftMean - rightMean;
    const targetDiff = bits[i]! === 1
      ? PILOT_DIFF_MARGIN
      : -PILOT_DIFF_MARGIN;
    const adjust = clampFloat(
      (targetDiff - currentDiff) / 2,
      -PILOT_DIFF_CLAMP,
      PILOT_DIFF_CLAMP,
    );
    applyYDelta(rgba, width, left.x, left.y, adjust);
    applyYDelta(rgba, width, right.x, right.y, -adjust);
  }

  return sharp(Buffer.from(rgba), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 1 })
    .toBuffer();
}

export async function decodeDnaPilotTraceFromFramePaths(input: {
  framePaths: Array<{ frameIdx: number; pngPath: string }>;
  expectedPayload4: Buffer;
  plan: DnaPilotTracePlan;
}): Promise<DnaPilotTraceTelemetry> {
  const t0 = Date.now();
  const expectedPayloadHex = input.expectedPayload4.toString("hex");
  if (!input.plan.enabled || input.framePaths.length === 0) {
    return {
      ...emptyDnaPilotTraceTelemetry(expectedPayloadHex),
      ...input.plan,
      attempted: input.plan.enabled,
      wallMs: Date.now() - t0,
    };
  }

  const expectedBits = payloadToBits(input.expectedPayload4);
  const legacyVariants = [
    { name: "identity", scale: 1, dx: 0, dy: 0, readAlign: false },
    {
      name: "inner_geometry_scale_1.12",
      scale: 1.12,
      dx: 0,
      dy: 0,
      readAlign: false,
    },
    {
      name: "inner_geometry_scale_1.25",
      scale: 1.25,
      dx: 0,
      dy: 0,
      readAlign: false,
    },
  ];
  const variants = [...legacyVariants, ...buildReadAlignVariants()];
  const variantMatches: DnaPilotTraceTelemetry["variantMatches"] = [];
  let legacyBestMatchingBits = -1;
  let best = {
    variant: "identity",
    matchingBits: -1,
    candidatePayloadHex: "",
    recoveredBits: [] as number[],
    unknownBits: PILOT_BITS,
    framesDecoded: 0,
  };

  for (const variant of variants) {
    const votes = Array.from({ length: PILOT_BITS }, () => ({
      positive: 0,
      negative: 0,
    }));
    let framesDecoded = 0;
    for (const frame of input.framePaths) {
      try {
        const bits = await decodeDnaPilotPng(
          frame.pngPath,
          variant.scale,
          input.plan.selectedRegionId,
          variant.dx,
          variant.dy,
        );
        framesDecoded++;
        for (let i = 0; i < PILOT_BITS; i++) {
          if (bits[i] === 1) votes[i]!.positive++;
          else votes[i]!.negative++;
        }
      } catch {
        // Candidate-only pilot: bad frame means no vote.
      }
    }
    const recoveredBits: number[] = [];
    let unknownBits = 0;
    for (const vote of votes) {
      if (vote.positive === vote.negative) {
        unknownBits++;
        recoveredBits.push(0);
      } else {
        recoveredBits.push(vote.positive > vote.negative ? 1 : 0);
      }
    }
    let matchingBits = 0;
    for (let i = 0; i < PILOT_BITS; i++) {
      if (recoveredBits[i] === expectedBits[i]) matchingBits++;
    }
    const candidatePayloadHex = bitsToHex(recoveredBits);
    variantMatches.push({
      variant: variant.name,
      matchingBits,
      candidatePayloadHex,
    });
    if (!variant.readAlign && matchingBits > legacyBestMatchingBits) {
      legacyBestMatchingBits = matchingBits;
    }
    if (matchingBits > best.matchingBits) {
      best = {
        variant: variant.name,
        matchingBits,
        candidatePayloadHex,
        recoveredBits,
        unknownBits,
        framesDecoded,
      };
    }
  }

  const idMatched =
    best.framesDecoded >= 3 &&
    best.unknownBits === 0 &&
    best.matchingBits === PILOT_BITS &&
    best.candidatePayloadHex === expectedPayloadHex;
  const verdict: DnaPilotVerdict = idMatched
    ? "PILOT_ID_MATCH"
    : best.matchingBits >= 24
      ? "PILOT_CANDIDATE"
      : "PILOT_NONE";

  return {
    ...input.plan,
    attempted: true,
    framesDecoded: best.framesDecoded,
    expectedPayloadHex,
    candidatePayloadHex: best.candidatePayloadHex,
    matchingBits: Math.max(0, best.matchingBits),
    unknownBits: best.unknownBits,
    idMatched,
    verdict,
    bestGeometryVariant: best.variant,
    variantMatches,
    readAlignLayer: {
      enabled: true,
      layerId: "READ_ALIGN_LAYER",
      mode: "read_side_variant_search",
      legacyBestMatchingBits: Math.max(0, legacyBestMatchingBits),
      alignedBestMatchingBits: Math.max(0, best.matchingBits),
      improved: best.matchingBits > legacyBestMatchingBits,
      officialDecisionChanged:
        legacyBestMatchingBits < PILOT_BITS && idMatched === true,
      variantsTried: variants.length,
      bestVariant: best.variant,
      note:
        "Read-side alignment only: same trace is retried at shifted/scaled read positions. It does not add a seal, does not combine module fragments, and still requires 32/32 ID match.",
    },
    decisive: false,
    wallMs: Date.now() - t0,
    note: idMatched
      ? "Pilot trace read the expected payload. It remains separate from classic VAULT; route finalDecision may classify DNA_VAULT."
      : verdict === "PILOT_CANDIDATE"
        ? `Pilot candidate only (${best.matchingBits}/32 bits); not decisive.`
        : `Pilot trace insufficient (${Math.max(0, best.matchingBits)}/32 bits).`,
  };
}

async function decodeDnaPilotPng(
  pngPath: string,
  geometryScale: number,
  selectedRegionId?: string | null,
  offsetXPx = 0,
  offsetYPx = 0,
): Promise<number[]> {
  const img = sharp(pngPath).ensureAlpha();
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("dnaPilot: missing PNG dimensions");
  }
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const blocks = pilotBlocks(
    width,
    height,
    geometryScale,
    selectedRegionId,
    offsetXPx,
    offsetYPx,
  );
  const bits: number[] = [];
  for (let i = 0; i < PILOT_BITS; i++) {
    const left = blocks[i * 2]!;
    const right = blocks[i * 2 + 1]!;
    const leftMean = blockMeanY(rgba, width, left.x, left.y);
    const rightMean = blockMeanY(rgba, width, right.x, right.y);
    bits.push(leftMean > rightMean ? 1 : 0);
  }
  return bits;
}

function pilotBlocks(
  width: number,
  height: number,
  geometryScale: number,
  selectedRegionId?: string | null,
  offsetXPx = 0,
  offsetYPx = 0,
): Array<{ x: number; y: number }> {
  if (selectedRegionId === CENTER_RING_REGION_ID) {
    return centerRingMultiZonePilotBlocks(
      width,
      height,
      geometryScale,
      offsetXPx,
      offsetYPx,
    );
  }
  const pairGap = Math.max(3, Math.floor(Math.min(width, height) * 0.006));
  const strideX = Math.max(
    PILOT_BLOCK * 2 + pairGap + 4,
    Math.floor(width * 0.027),
  );
  const strideY = Math.max(PILOT_BLOCK + 8, Math.floor(height * 0.038));
  const pairWidth = PILOT_BLOCK * 2 + pairGap;
  const gridW = (PILOT_PAIRS_PER_ROW - 1) * strideX + pairWidth;
  const gridH = (PILOT_ROWS - 1) * strideY + PILOT_BLOCK;
  const centerX = width / 2 + offsetXPx;
  const centerY = height / 2 + offsetYPx;
  const startX = centerX - (gridW * geometryScale) / 2;
  const startY = centerY - (gridH * geometryScale) / 2;
  const out: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < PILOT_ROWS; row++) {
    for (let pair = 0; pair < PILOT_PAIRS_PER_ROW; pair++) {
      const leftX = startX + pair * strideX * geometryScale;
      const y = startY + row * strideY * geometryScale;
      out.push({
        x: clampInt(Math.round(leftX), 0, width - PILOT_BLOCK),
        y: clampInt(Math.round(y), 0, height - PILOT_BLOCK),
      });
      out.push({
        x: clampInt(
          Math.round(leftX + (PILOT_BLOCK + pairGap) * geometryScale),
          0,
          width - PILOT_BLOCK,
        ),
        y: clampInt(Math.round(y), 0, height - PILOT_BLOCK),
      });
    }
  }
  return out;
}

function centerRingMultiZonePilotBlocks(
  width: number,
  height: number,
  geometryScale: number,
  offsetXPx = 0,
  offsetYPx = 0,
): Array<{ x: number; y: number }> {
  const pairGap = Math.max(3, Math.floor(Math.min(width, height) * 0.006));
  const zonePairCols = 4;
  const zoneRows = 2;
  const strideX = Math.max(
    PILOT_BLOCK * 2 + pairGap + 4,
    Math.floor(width * 0.031),
  );
  const strideY = Math.max(PILOT_BLOCK + 8, Math.floor(height * 0.045));
  const pairWidth = PILOT_BLOCK * 2 + pairGap;
  const zoneW = (zonePairCols - 1) * strideX + pairWidth;
  const zoneH = (zoneRows - 1) * strideY + PILOT_BLOCK;
  const centerX = width / 2 + offsetXPx;
  const centerY = height / 2 + offsetYPx;
  const zoneOffsetX = Math.max(zoneW * 0.7, width * 0.12) * geometryScale;
  const zoneOffsetY = Math.max(zoneH * 0.7, height * 0.1) * geometryScale;
  const zoneCenters = [
    { x: centerX - zoneOffsetX, y: centerY - zoneOffsetY },
    { x: centerX + zoneOffsetX, y: centerY - zoneOffsetY },
    { x: centerX - zoneOffsetX, y: centerY + zoneOffsetY },
    { x: centerX + zoneOffsetX, y: centerY + zoneOffsetY },
  ];
  const out: Array<{ x: number; y: number }> = [];
  for (const zone of zoneCenters) {
    const startX = zone.x - (zoneW * geometryScale) / 2;
    const startY = zone.y - (zoneH * geometryScale) / 2;
    for (let row = 0; row < zoneRows; row++) {
      for (let pair = 0; pair < zonePairCols; pair++) {
        const leftX = startX + pair * strideX * geometryScale;
        const y = startY + row * strideY * geometryScale;
        out.push({
          x: clampInt(Math.round(leftX), 0, width - PILOT_BLOCK),
          y: clampInt(Math.round(y), 0, height - PILOT_BLOCK),
        });
        out.push({
          x: clampInt(
            Math.round(leftX + (PILOT_BLOCK + pairGap) * geometryScale),
            0,
            width - PILOT_BLOCK,
          ),
          y: clampInt(Math.round(y), 0, height - PILOT_BLOCK),
        });
      }
    }
  }
  return out.slice(0, PILOT_BITS * 2);
}

function blockMeanY(
  rgba: Uint8Array,
  width: number,
  x0: number,
  y0: number,
): number {
  let sum = 0;
  for (let y = 0; y < PILOT_BLOCK; y++) {
    for (let x = 0; x < PILOT_BLOCK; x++) {
      const ix = ((y0 + y) * width + (x0 + x)) * 4;
      const r = rgba[ix] ?? 0;
      const g = rgba[ix + 1] ?? 0;
      const b = rgba[ix + 2] ?? 0;
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return sum / (PILOT_BLOCK * PILOT_BLOCK);
}

function applyYDelta(
  rgba: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  delta: number,
) {
  for (let y = 0; y < PILOT_BLOCK; y++) {
    for (let x = 0; x < PILOT_BLOCK; x++) {
      const ix = ((y0 + y) * width + (x0 + x)) * 4;
      for (let c = 0; c < 3; c++) {
        const next = Math.round((rgba[ix + c] ?? 0) + delta);
        rgba[ix + c] = next < 0 ? 0 : next > 255 ? 255 : next;
      }
    }
  }
}

function payloadToBits(payload4: Buffer): number[] {
  const bits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const byte = payload4[i] ?? 0;
    for (let bit = 7; bit >= 0; bit--) bits.push((byte >>> bit) & 1);
  }
  return bits;
}

function bitsToHex(bits: ReadonlyArray<number>): string {
  const buf = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] ?? 0);
    buf[i] = byte;
  }
  return buf.toString("hex");
}

function clampInt(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function clampFloat(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
