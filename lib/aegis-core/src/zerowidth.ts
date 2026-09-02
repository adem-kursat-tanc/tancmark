export const ZW_ZERO = "\u200B";
export const ZW_ONE = "\u200C";
export const ZW_MARK = "\u2060";

const ZW_CHARS = new Set([ZW_ZERO, ZW_ONE, ZW_MARK, "\u200D", "\uFEFF"]);

export function isZeroWidth(ch: string): boolean {
  return ZW_CHARS.has(ch);
}

export function bitsToZeroWidth(bits: ReadonlyArray<0 | 1>): string {
  let out = "";
  for (const b of bits) out += b === 1 ? ZW_ONE : ZW_ZERO;
  return out;
}

export function extractZeroWidthBits(text: string): Array<0 | 1> {
  const out: Array<0 | 1> = [];
  for (const ch of text) {
    if (ch === ZW_ZERO) out.push(0);
    else if (ch === ZW_ONE) out.push(1);
  }
  return out;
}

export function stripZeroWidth(text: string): string {
  let out = "";
  for (const ch of text) if (!ZW_CHARS.has(ch)) out += ch;
  return out;
}
