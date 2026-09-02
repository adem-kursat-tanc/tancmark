import sharp from "sharp";

export type ChannelBVerdict = "B_VAULT" | "B_CANDIDATE" | "B_NONE";

export interface ChannelBEncodeStats {
  enabled: boolean;
  frameIdxs: number[];
  frameCount: number;
  carrier: "qim-y-mean-grid";
  quantStep: number;
  note: string;
}

export interface ChannelBDecodeTelemetry extends ChannelBEncodeStats {
  attempted: boolean;
  framesDecoded: number;
  expectedPayloadHex: string;
  candidatePayloadHex: string;
  matchingBits: number;
  unknownBits: number;
  idMatched: boolean;
  verdict: ChannelBVerdict;
  wallMs: number;
}

const CHANNEL_B_MAX_FRAMES = 24;
const CHANNEL_B_MIN_VAULT_FRAMES = 8;
const CHANNEL_B_BITS = 32;
const CHANNEL_B_Q = 12;
const CHANNEL_B_DIFF_MARGIN = 24;
const CHANNEL_B_BLOCK = 8;
const CHANNEL_B_PAIRS_PER_ROW = 8;
const CHANNEL_B_ROWS = 4;

export function emptyChannelBTelemetry(
  expectedPayloadHex = "",
): ChannelBDecodeTelemetry {
  return {
    enabled: true,
    attempted: false,
    frameIdxs: [],
    frameCount: 0,
    carrier: "qim-y-mean-grid",
    quantStep: CHANNEL_B_Q,
    note: "Channel B not attempted",
    framesDecoded: 0,
    expectedPayloadHex,
    candidatePayloadHex: "",
    matchingBits: 0,
    unknownBits: CHANNEL_B_BITS,
    idMatched: false,
    verdict: "B_NONE",
    wallMs: 0,
  };
}

export function getChannelBFrameMap(
  totalFrames: number,
  channelAFrameIdxs: ReadonlyArray<number>,
): number[] {
  if (totalFrames <= 0) return [];
  const channelA = new Set(channelAFrameIdxs);
  const available: number[] = [];
  for (let i = 0; i < totalFrames; i++) {
    if (!channelA.has(i)) available.push(i);
  }
  const target = Math.min(CHANNEL_B_MAX_FRAMES, available.length);
  if (target <= 0) return [];

  const picked: number[] = [];
  const used = new Set<number>();
  for (let slot = 0; slot < target; slot++) {
    const center = Math.floor(((slot + 0.5) * available.length) / target);
    let best = Math.min(available.length - 1, Math.max(0, center));
    for (let radius = 0; radius < available.length; radius++) {
      const left = center - radius;
      const right = center + radius;
      if (left >= 0 && !used.has(available[left]!)) {
        best = left;
        break;
      }
      if (right < available.length && !used.has(available[right]!)) {
        best = right;
        break;
      }
    }
    const idx = available[best]!;
    used.add(idx);
    picked.push(idx);
  }
  return picked.sort((a, b) => a - b);
}

export function buildChannelBEncodeStats(
  frameIdxs: ReadonlyArray<number>,
): ChannelBEncodeStats {
  return {
    enabled: true,
    frameIdxs: [...frameIdxs],
    frameCount: frameIdxs.length,
    carrier: "qim-y-mean-grid",
    quantStep: CHANNEL_B_Q,
    note:
      "Sprint 2 Channel B: frame-disjoint QIM Y-mean grid; same payload4, separate carrier from Channel A.",
  };
}

export async function stampChannelBPng(
  pngBuffer: Buffer,
  payload4: Buffer,
): Promise<Buffer> {
  const img = sharp(pngBuffer).ensureAlpha();
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("channelB: missing PNG dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const blocks = channelBBlocks(width, height);
  const bits = payloadToBits(payload4);

  for (let i = 0; i < CHANNEL_B_BITS; i++) {
    const left = blocks[i * 2]!;
    const right = blocks[i * 2 + 1]!;
    const leftMean = blockMeanY(rgba, width, left.x, left.y);
    const rightMean = blockMeanY(rgba, width, right.x, right.y);
    const currentDiff = leftMean - rightMean;
    const targetDiff = bits[i]! === 1
      ? CHANNEL_B_DIFF_MARGIN
      : -CHANNEL_B_DIFF_MARGIN;
    const adjust = clampFloat((targetDiff - currentDiff) / 2, -20, 20);
    applyYDelta(rgba, width, left.x, left.y, adjust);
    applyYDelta(rgba, width, right.x, right.y, -adjust);
  }

  return sharp(Buffer.from(rgba), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 1 })
    .toBuffer();
}

export async function decodeChannelBFromFramePaths(input: {
  framePaths: Array<{ frameIdx: number; pngPath: string }>;
  expectedPayload4: Buffer;
}): Promise<ChannelBDecodeTelemetry> {
  const t0 = Date.now();
  const expectedPayloadHex = input.expectedPayload4.toString("hex");
  const expectedBits = payloadToBits(input.expectedPayload4);
  const votes = Array.from({ length: CHANNEL_B_BITS }, () => ({
    positive: 0,
    negative: 0,
  }));
  let framesDecoded = 0;

  for (const frame of input.framePaths) {
    try {
      const bits = await decodeChannelBPng(frame.pngPath);
      framesDecoded++;
      for (let i = 0; i < CHANNEL_B_BITS; i++) {
        if (bits[i] === 1) votes[i]!.positive++;
        else votes[i]!.negative++;
      }
    } catch {
      // Keep decode best-effort. Missing/corrupt frame means no vote.
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
  for (let i = 0; i < CHANNEL_B_BITS; i++) {
    if (recoveredBits[i] === expectedBits[i]) matchingBits++;
  }

  const candidatePayloadHex = bitsToHex(recoveredBits);
  const idMatched =
    framesDecoded >= CHANNEL_B_MIN_VAULT_FRAMES &&
    unknownBits === 0 &&
    matchingBits === CHANNEL_B_BITS &&
    candidatePayloadHex === expectedPayloadHex;
  const verdict: ChannelBVerdict = idMatched
    ? "B_VAULT"
    : matchingBits >= 26
      ? "B_CANDIDATE"
      : "B_NONE";

  return {
    ...buildChannelBEncodeStats(input.framePaths.map((f) => f.frameIdx)),
    attempted: true,
    framesDecoded,
    expectedPayloadHex,
    candidatePayloadHex,
    matchingBits,
    unknownBits,
    idMatched,
    verdict,
    wallMs: Date.now() - t0,
    note: idMatched
      ? "Channel B bit-exact payload4 match; ID gate passed through expected payload."
      : verdict === "B_CANDIDATE"
        ? `Channel B candidate only (${matchingBits}/32 bits); not decisive.`
        : `Channel B insufficient (${matchingBits}/32 bits).`,
  };
}

async function decodeChannelBPng(pngPath: string): Promise<number[]> {
  const img = sharp(pngPath).ensureAlpha();
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("channelB: missing PNG dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const blocks = channelBBlocks(width, height);
  const bits: number[] = [];
  for (let i = 0; i < CHANNEL_B_BITS; i++) {
    const left = blocks[i * 2]!;
    const right = blocks[i * 2 + 1]!;
    const leftMean = blockMeanY(rgba, width, left.x, left.y);
    const rightMean = blockMeanY(rgba, width, right.x, right.y);
    bits.push(leftMean > rightMean ? 1 : 0);
  }
  return bits;
}

function channelBBlocks(
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const pairGap = Math.max(2, Math.floor(Math.min(width, height) * 0.004));
  const pairStride = Math.max(
    CHANNEL_B_BLOCK * 2 + pairGap + 8,
    Math.floor(width * 0.055),
  );
  const strideY = Math.max(14, Math.floor(height * 0.045));
  const pairWidth = CHANNEL_B_BLOCK * 2 + pairGap;
  const gridW = (CHANNEL_B_PAIRS_PER_ROW - 1) * pairStride + pairWidth;
  const gridH = (CHANNEL_B_ROWS - 1) * strideY + CHANNEL_B_BLOCK;
  const startX = clampInt(Math.floor((width - gridW) / 2), 0, width - CHANNEL_B_BLOCK);
  const startY = clampInt(
    Math.floor(height * 0.62 - gridH / 2),
    0,
    height - CHANNEL_B_BLOCK,
  );
  const out: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < CHANNEL_B_ROWS; row++) {
    for (let pair = 0; pair < CHANNEL_B_PAIRS_PER_ROW; pair++) {
      const leftX = startX + pair * pairStride;
      const y = clampInt(startY + row * strideY, 0, height - CHANNEL_B_BLOCK);
      out.push({
        x: clampInt(leftX, 0, width - CHANNEL_B_BLOCK),
        y,
      });
      out.push({
        x: clampInt(leftX + CHANNEL_B_BLOCK + pairGap, 0, width - CHANNEL_B_BLOCK),
        y,
      });
    }
  }
  return out;
}

function blockMeanY(
  rgba: Uint8Array,
  width: number,
  x0: number,
  y0: number,
): number {
  let sum = 0;
  for (let y = 0; y < CHANNEL_B_BLOCK; y++) {
    for (let x = 0; x < CHANNEL_B_BLOCK; x++) {
      const ix = ((y0 + y) * width + (x0 + x)) * 4;
      const r = rgba[ix] ?? 0;
      const g = rgba[ix + 1] ?? 0;
      const b = rgba[ix + 2] ?? 0;
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return sum / (CHANNEL_B_BLOCK * CHANNEL_B_BLOCK);
}

function applyYDelta(
  rgba: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  delta: number,
) {
  for (let y = 0; y < CHANNEL_B_BLOCK; y++) {
    for (let x = 0; x < CHANNEL_B_BLOCK; x++) {
      const ix = ((y0 + y) * width + (x0 + x)) * 4;
      for (let c = 0; c < 3; c++) {
        const next = Math.round((rgba[ix + c] ?? 0) + delta);
        rgba[ix + c] = next < 0 ? 0 : next > 255 ? 255 : next;
      }
    }
  }
}

function nearestQimMean(mean: number, bit: number): number {
  const base = Math.round(mean / CHANNEL_B_Q);
  let best = mean;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let d = -4; d <= 4; d++) {
    const k = base + d;
    if ((k & 1) !== (bit & 1)) continue;
    const target = k * CHANNEL_B_Q;
    if (target < 0 || target > 255) continue;
    const dist = Math.abs(target - mean);
    if (dist < bestDistance) {
      best = target;
      bestDistance = dist;
    }
  }
  return best;
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
