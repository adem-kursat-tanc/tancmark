import { createHmac } from "node:crypto";

const PUA_START = 0xe000;
const PUA_END = 0xf8ff;
const PUA_SIZE = PUA_END - PUA_START + 1;

export type ScrambleMap = Record<string, string>;

export interface ScrambleOptions {
  secret?: string;
  seed?: string;
  preserveWhitespace?: boolean;
  preserveDigits?: boolean;
  preservePunctuation?: boolean;
}

const DEFAULT_PRESERVE_PUNCT = new Set([
  ".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}",
  "\"", "'", "`", "-", "_", "/", "\\", "@", "#", "&", "%", "*", "+", "=", "<", ">",
]);

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function shouldPreserve(ch: string, opts: ScrambleOptions): boolean {
  if (opts.preserveWhitespace !== false && isWhitespace(ch)) return true;
  if (opts.preserveDigits && isDigit(ch)) return true;
  if (opts.preservePunctuation && DEFAULT_PRESERVE_PUNCT.has(ch)) return true;
  return false;
}

function uniqueChars(text: string, opts: ScrambleOptions): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of text) {
    if (shouldPreserve(ch, opts)) continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function makeRandom(opts: ScrambleOptions): () => number {
  if (opts.secret && opts.seed) {
    let counter = 0;
    return () => {
      const mac = createHmac("sha256", opts.secret!)
        .update(`${opts.seed}:${counter++}`)
        .digest();
      return mac.readUInt32BE(0) / 0xffffffff;
    };
  }
  return Math.random;
}

export function generateScrambleMap(
  text: string,
  opts: ScrambleOptions = {},
): ScrambleMap {
  const chars = uniqueChars(text, opts);
  if (chars.length > PUA_SIZE) {
    throw new Error(
      `Distinct character count (${chars.length}) exceeds PUA range (${PUA_SIZE}).`,
    );
  }
  const rand = makeRandom(opts);
  const codepoints: number[] = [];
  for (let i = 0; i < PUA_SIZE; i++) codepoints.push(PUA_START + i);
  const shuffled = shuffle(codepoints, rand);

  const map: ScrambleMap = {};
  for (let i = 0; i < chars.length; i++) {
    map[chars[i]!] = String.fromCodePoint(shuffled[i]!);
  }
  return map;
}

export function obfuscateText(text: string, map: ScrambleMap): string {
  let out = "";
  for (const ch of text) {
    out += map[ch] ?? ch;
  }
  return out;
}

export function deobfuscateText(text: string, map: ScrambleMap): string {
  const reverse: Record<string, string> = {};
  for (const [plain, pua] of Object.entries(map)) {
    reverse[pua] = plain;
  }
  let out = "";
  for (const ch of text) {
    out += reverse[ch] ?? ch;
  }
  return out;
}

export function describeMap(map: ScrambleMap): Array<{ from: string; to: string; codepoint: string }> {
  return Object.entries(map).map(([from, to]) => ({
    from,
    to,
    codepoint: "U+" + to.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
  }));
}
