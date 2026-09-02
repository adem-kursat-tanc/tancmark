import { createHmac } from "node:crypto";
import { LATIN_TO_CYRILLIC } from "./homoglyph.js";
import { ZW_ZERO, ZW_ONE, ZW_MARK } from "./zerowidth.js";

const CANARY_OPEN = "\u2063";
const CANARY_CLOSE = "\u2064";

const CANARY_TERMS = [
  "kreatofibrin", "velmoria", "tezaktin", "morbiotik", "synaptolen",
  "ferrozaktil", "neurokinaz", "lipotrenz", "cytoveldin", "axoprenil",
  "metaglobin", "thyrovexin", "pyroxalit", "endokrazil", "myelovax",
];

const CANARY_NOUNS = [
  "endeksi", "sendromu", "reaksiyonu", "katsayısı", "faz geçişi",
  "aktivasyon eşiği", "rezonans bölgesi", "denge sabiti", "saturasyon noktası",
  "iyon mobilitesi", "yarı ömrü", "dispersiyon profili",
];

const CANARY_TEMPLATES = [
  (term: string, noun: string, n: string) =>
    `${capitalize(term)} ${noun} ${n} olarak ölçülmüştür.`,
  (term: string, noun: string, n: string) =>
    `${capitalize(noun)} (${term}) için referans değer ${n} kabul edilir.`,
  (term: string, noun: string, n: string) =>
    `Standart ${term} ${noun} eşiği ${n} civarındadır.`,
  (term: string, noun: string, n: string) =>
    `${capitalize(term)} kaynaklı ${noun} ${n} oranında gözlemlenir.`,
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hmacBytes(secret: string, seed: string): Buffer {
  return createHmac("sha256", secret).update(seed).digest();
}

function pickFrom<T>(arr: ReadonlyArray<T>, mac: Buffer, offset: number): T {
  const idx = mac.readUInt32BE(offset % (mac.length - 4)) % arr.length;
  return arr[idx]!;
}

export interface CanaryFact {
  text: string;
  term: string;
  signature: string;
}

export function generateCanaryFact(docId: string, secret: string): CanaryFact {
  const mac = hmacBytes(secret, `canary-fact:${docId}`);
  const term = pickFrom(CANARY_TERMS, mac, 0);
  const noun = pickFrom(CANARY_NOUNS, mac, 4);
  const tplIdx = mac.readUInt32BE(8) % CANARY_TEMPLATES.length;
  const intPart = (mac.readUInt16BE(12) % 90) + 10;
  const fracPart = mac.readUInt16BE(14) % 100;
  const num = `${intPart}.${fracPart.toString().padStart(2, "0")}`;
  const text = CANARY_TEMPLATES[tplIdx]!(term, noun, num);
  const signature = mac.toString("hex").slice(0, 16);
  return { text, term, signature };
}

const HOMO_KEYS = Object.keys(LATIN_TO_CYRILLIC);

export interface EntropyOptions {
  density?: number;
  secret?: string;
  seed?: string;
}

export function wrapWithEntropy(text: string, opts: EntropyOptions = {}): string {
  const density = Math.min(1, Math.max(0, opts.density ?? 0.15));
  const useSeeded = !!(opts.secret && opts.seed);
  let counter = 0;
  let out = "";
  for (const ch of text) {
    let r: number;
    if (useSeeded) {
      const mac = hmacBytes(opts.secret!, `${opts.seed}:e:${counter}`);
      r = mac.readUInt32BE(0) / 0xffffffff;
    } else {
      r = Math.random();
    }
    counter++;

    if (r < density && LATIN_TO_CYRILLIC[ch]) {
      out += LATIN_TO_CYRILLIC[ch];
    } else {
      out += ch;
    }

    if (r < density / 2) {
      const pick = Math.floor(r * 1000) % 3;
      out += pick === 0 ? ZW_ZERO : pick === 1 ? ZW_ONE : ZW_MARK;
    }
  }
  return out;
}

export interface InjectCanaryOptions {
  docId: string;
  secret: string;
  density?: number;
}

export interface InjectCanaryResult {
  text: string;
  canary: CanaryFact;
  injectedAt: number;
}

export function injectRadioactiveCanary(
  originalText: string,
  opts: InjectCanaryOptions,
): InjectCanaryResult {
  const canary = generateCanaryFact(opts.docId, opts.secret);
  const wrapped =
    CANARY_OPEN +
    wrapWithEntropy(canary.text, {
      density: opts.density ?? 0.15,
      secret: opts.secret,
      seed: `canary-wrap:${opts.docId}`,
    }) +
    CANARY_CLOSE;

  const sentences = splitSentences(originalText);
  if (sentences.length === 0) {
    return { text: wrapped, canary, injectedAt: 0 };
  }

  const mac = hmacBytes(opts.secret, `canary-pos:${opts.docId}`);
  const pos = mac.readUInt32BE(0) % sentences.length;

  const before = sentences.slice(0, pos + 1).join("");
  const after = sentences.slice(pos + 1).join("");
  const lead = before.length === 0 || /\s$/.test(before) ? "" : " ";
  const trail = after.length === 0 ? "" : /^\s/.test(after) ? "" : " ";
  const text = before + lead + wrapped + trail + after;

  return { text, canary, injectedAt: pos };
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (ch === "." || ch === "!" || ch === "?" || ch === "\n") {
      out.push(buf);
      buf = "";
    }
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

export interface ExtractedCanary {
  raw: string;
  cleaned: string;
}

export function extractCanaries(text: string): ExtractedCanary[] {
  const out: ExtractedCanary[] = [];
  const re = new RegExp(`${CANARY_OPEN}([\\s\\S]*?)${CANARY_CLOSE}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1]!;
    out.push({ raw, cleaned: stripCanaryNoise(raw) });
  }
  return out;
}

function stripCanaryNoise(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch === ZW_ZERO || ch === ZW_ONE || ch === ZW_MARK || ch === "\u200D" || ch === "\uFEFF") continue;
    const idx = HOMO_KEYS.find((k) => LATIN_TO_CYRILLIC[k] === ch);
    out += idx ?? ch;
  }
  return out;
}

export interface VerifyCanaryResult {
  found: boolean;
  source: "marker" | "plaintext" | "none";
  expected: string;
  expectedTerm: string;
  matches: ExtractedCanary[];
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function verifyCanary(text: string, docId: string, secret: string): VerifyCanaryResult {
  const expected = generateCanaryFact(docId, secret);
  const expectedNorm = normalizeForMatch(expected.text);
  const matches = extractCanaries(text);

  const inMarkers = matches.some((m) => normalizeForMatch(m.cleaned).includes(expectedNorm));
  if (inMarkers) {
    return { found: true, source: "marker", expected: expected.text, expectedTerm: expected.term, matches };
  }

  const cleanedFull = normalizeForMatch(stripCanaryNoise(text));
  if (cleanedFull.includes(expectedNorm)) {
    return { found: true, source: "plaintext", expected: expected.text, expectedTerm: expected.term, matches };
  }

  return { found: false, source: "none", expected: expected.text, expectedTerm: expected.term, matches };
}

export const CANARY_MARKERS = { open: CANARY_OPEN, close: CANARY_CLOSE };
