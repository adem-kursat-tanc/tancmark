import { createHmac } from "node:crypto";

export interface NumericNoiseOptions {
  biasPercent?: number;
  seed?: string;
  secret?: string;
}

function seededUnit(secret: string, seed: string): number {
  const mac = createHmac("sha256", secret).update(seed).digest();
  const v = mac.readUInt32BE(0) / 0xffffffff;
  return v * 2 - 1;
}

export function addNumericNoise(value: number, opts: NumericNoiseOptions = {}): number {
  if (!Number.isFinite(value)) return value;
  const bias = opts.biasPercent ?? 0.2;
  let delta: number;
  if (opts.secret && opts.seed) {
    delta = seededUnit(opts.secret, opts.seed) * (bias / 100);
  } else {
    delta = (Math.random() * 2 - 1) * (bias / 100);
  }
  return value * (1 + delta);
}

export interface TextNoiseOptions {
  density?: number;
  secret?: string;
  seed?: string;
}

const ZW_NOISE = ["\u200B", "\u200C", "\u2060"];

export function addTextNoise(text: string, opts: TextNoiseOptions = {}): string {
  const density = opts.density ?? 0.05;
  let out = "";
  let counter = 0;
  for (const ch of text) {
    out += ch;
    let r: number;
    if (opts.secret && opts.seed) {
      const mac = createHmac("sha256", opts.secret).update(`${opts.seed}:${counter}`).digest();
      r = mac.readUInt32BE(0) / 0xffffffff;
    } else {
      r = Math.random();
    }
    if (r < density) {
      const idx = Math.floor((r / density) * ZW_NOISE.length) % ZW_NOISE.length;
      out += ZW_NOISE[idx];
    }
    counter++;
  }
  return out;
}
