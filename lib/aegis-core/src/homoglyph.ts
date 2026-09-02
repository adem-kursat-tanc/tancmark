export const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: "\u0430", e: "\u0435", o: "\u043E", p: "\u0440", c: "\u0441",
  y: "\u0443", x: "\u0445",
  A: "\u0410", B: "\u0412", C: "\u0421", E: "\u0415", H: "\u041D",
  K: "\u041A", M: "\u041C", O: "\u041E", P: "\u0420", T: "\u0422",
  X: "\u0425", Y: "\u0423",
};

export const CYRILLIC_TO_LATIN: Record<string, string> = Object.fromEntries(
  Object.entries(LATIN_TO_CYRILLIC).map(([latin, cyr]) => [cyr, latin]),
);

export function isHomoglyphCarrier(ch: string): boolean {
  return ch in LATIN_TO_CYRILLIC || ch in CYRILLIC_TO_LATIN;
}

export function readHomoglyphBit(ch: string): 0 | 1 | null {
  if (ch in LATIN_TO_CYRILLIC) return 0;
  if (ch in CYRILLIC_TO_LATIN) return 1;
  return null;
}

export function setHomoglyphBit(ch: string, bit: 0 | 1): string {
  if (bit === 0) {
    return ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch]! : ch;
  }
  return ch in LATIN_TO_CYRILLIC ? LATIN_TO_CYRILLIC[ch]! : ch;
}

export function stripHomoglyphs(text: string): string {
  let out = "";
  for (const ch of text) {
    out += ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch]! : ch;
  }
  return out;
}
