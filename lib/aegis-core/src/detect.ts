import { CYRILLIC_TO_LATIN } from "./homoglyph.js";

const ZW_SET = new Set(["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"]);

export interface DetectResult {
  isWatermarked: boolean;
  signals: {
    homoglyphCount: number;
    zeroWidthCount: number;
    homoglyphRatio: number;
    totalChars: number;
  };
}

export function detectWatermark(text: string): DetectResult {
  let homo = 0;
  let zw = 0;
  let total = 0;
  for (const ch of text) {
    total++;
    if (ZW_SET.has(ch)) zw++;
    else if (ch in CYRILLIC_TO_LATIN) homo++;
  }
  const ratio = total === 0 ? 0 : homo / total;
  return {
    isWatermarked: homo > 0 || zw > 0,
    signals: {
      homoglyphCount: homo,
      zeroWidthCount: zw,
      homoglyphRatio: ratio,
      totalChars: total,
    },
  };
}
