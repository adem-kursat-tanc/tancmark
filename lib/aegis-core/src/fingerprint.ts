import { createHmac } from "node:crypto";
import {
  isHomoglyphCarrier,
  readHomoglyphBit,
  setHomoglyphBit,
  stripHomoglyphs,
} from "./homoglyph.js";
import {
  ZW_MARK,
  ZW_ONE,
  ZW_ZERO,
  bitsToZeroWidth,
  isZeroWidth,
} from "./zerowidth.js";

export const FINGERPRINT_BITS = 32;

export function deriveBits(secret: string, userId: string, nBits = FINGERPRINT_BITS): Array<0 | 1> {
  const mac = createHmac("sha256", secret).update(userId).digest();
  const bits: Array<0 | 1> = [];
  for (let i = 0; i < nBits; i++) {
    const byte = mac[i >> 3]!;
    bits.push(((byte >> (7 - (i & 7))) & 1) as 0 | 1);
  }
  return bits;
}

function bitsEqual(a: ReadonlyArray<0 | 1>, b: ReadonlyArray<0 | 1>): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let same = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) same++;
  return same / n;
}

export interface EncodeOptions {
  homoglyph?: boolean;
  zeroWidth?: boolean;
}

export function encodeFingerprint(
  text: string,
  bits: ReadonlyArray<0 | 1>,
  opts: EncodeOptions = {},
): string {
  const useHomo = opts.homoglyph !== false;
  const useZW = opts.zeroWidth !== false;
  const clean = stripHomoglyphs(text);

  let out = "";
  let bitIdx = 0;
  const chars = Array.from(clean);

  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i]!;
    if (useHomo && isHomoglyphCarrier(ch)) {
      const bit = bits[bitIdx % bits.length]!;
      ch = setHomoglyphBit(ch, bit);
      bitIdx++;
    }
    out += ch;
  }

  if (useZW) {
    out = ZW_MARK + bitsToZeroWidth(bits) + ZW_MARK + out;
  }

  return out;
}

export interface ChannelReading {
  bits: Array<0 | 1>;
  source: "homoglyph" | "zeroWidth";
}

function extractFramedZWBits(text: string): Array<0 | 1> {
  const first = text.indexOf(ZW_MARK);
  if (first === -1) return [];
  const second = text.indexOf(ZW_MARK, first + 1);
  if (second === -1) return [];
  const payload = text.slice(first + 1, second);
  const bits: Array<0 | 1> = [];
  for (const ch of payload) {
    if (ch === ZW_ZERO) bits.push(0);
    else if (ch === ZW_ONE) bits.push(1);
  }
  return bits;
}

export function readChannels(text: string): ChannelReading[] {
  const homoBits: Array<0 | 1> = [];
  for (const ch of text) {
    const b = readHomoglyphBit(ch);
    if (b !== null) homoBits.push(b);
  }
  const zwBits = extractFramedZWBits(text);
  const readings: ChannelReading[] = [];
  if (homoBits.length > 0) readings.push({ bits: homoBits, source: "homoglyph" });
  if (zwBits.length > 0) readings.push({ bits: zwBits, source: "zeroWidth" });
  return readings;
}

function foldToLength(observed: ReadonlyArray<0 | 1>, n: number): Array<number> {
  const sums = new Array<number>(n).fill(0);
  const counts = new Array<number>(n).fill(0);
  for (let i = 0; i < observed.length; i++) {
    const slot = i % n;
    sums[slot]! += observed[i]!;
    counts[slot]! += 1;
  }
  const folded: number[] = [];
  for (let i = 0; i < n; i++) {
    folded.push(counts[i] === 0 ? -1 : sums[i]! / counts[i]!);
  }
  return folded;
}

function scoreCandidate(folded: ReadonlyArray<number>, expected: ReadonlyArray<0 | 1>): number {
  let scored = 0;
  let total = 0;
  for (let i = 0; i < expected.length; i++) {
    const f = folded[i]!;
    if (f < 0) continue;
    const predicted = f >= 0.5 ? 1 : 0;
    if (predicted === expected[i]) scored++;
    total++;
  }
  return total === 0 ? 0 : scored / total;
}

export interface IdentifyResult {
  userId: string | null;
  confidence: number;
  channels: Record<string, number>;
  ranked: Array<{ userId: string; confidence: number }>;
}

export function identifyFingerprint(
  text: string,
  candidates: ReadonlyArray<string>,
  secret: string,
  nBits = FINGERPRINT_BITS,
): IdentifyResult {
  const channels = readChannels(text);
  const channelScores: Record<string, number> = {};
  const perCandidate = new Map<string, number>();

  for (const cand of candidates) {
    const expected = deriveBits(secret, cand, nBits);
    let combined = 0;
    let weight = 0;
    for (const ch of channels) {
      const folded = foldToLength(ch.bits, nBits);
      const score = scoreCandidate(folded, expected);
      const w = ch.bits.length >= nBits ? 1 : ch.bits.length / nBits;
      combined += score * w;
      weight += w;
    }
    perCandidate.set(cand, weight === 0 ? 0 : combined / weight);
  }

  const ranked = [...perCandidate.entries()]
    .map(([userId, confidence]) => ({ userId, confidence }))
    .sort((a, b) => b.confidence - a.confidence);

  for (const ch of channels) {
    let best = 0;
    for (const cand of candidates) {
      const expected = deriveBits(secret, cand, nBits);
      const folded = foldToLength(ch.bits, nBits);
      const s = scoreCandidate(folded, expected);
      if (s > best) best = s;
    }
    channelScores[ch.source] = best;
  }

  const top = ranked[0];
  return {
    userId: top && top.confidence >= 0.7 ? top.userId : null,
    confidence: top?.confidence ?? 0,
    channels: channelScores,
    ranked,
  };
}

export function stripFingerprint(text: string): string {
  let out = "";
  for (const ch of text) {
    if (isZeroWidth(ch)) continue;
    out += ch;
  }
  return stripHomoglyphs(out);
}

export function _bitsEqual(a: ReadonlyArray<0 | 1>, b: ReadonlyArray<0 | 1>): number {
  return bitsEqual(a, b);
}
