import { createHmac } from "node:crypto";
import {
  CYRILLIC_TO_LATIN,
  LATIN_TO_CYRILLIC,
  stripHomoglyphs,
} from "./homoglyph.js";
import { ZW_MARK, ZW_ONE, ZW_ZERO, stripZeroWidth } from "./zerowidth.js";
import {
  shuffleByClient,
  type ShuffleReplacement,
} from "./linguisticShuffler.js";
import { extractTrapTokens } from "./forensicDetector.js";
import {
  type BreachSignalBus,
  SENSITIVITY_BOOST,
  shouldApplySensitivityBoost,
} from "./breachSignal.js";

/**
 * Multi-layer text protection.
 *
 * Three deterministic, idempotent layers are applied in order:
 *
 *   1. Linguistic DNA — Turkish synonym shuffle (re-uses `shuffleByClient`).
 *   2. Homoglyph — Latin→Cyrillic substitution at ~3% of carrier letters,
 *      positions chosen by HMAC(secret, `${clientId}|homoglyph|${pos}`).
 *   3. Zero-Width — 16-bit clientId hash framed by U+2060 markers, prepended.
 *
 * Idempotency: every call canonicalizes the input first (strips homoglyphs +
 * zero-width carriers). So `protectByClient(protectByClient(t, c), c) ===
 * protectByClient(t, c)`.
 */

export const HOMOGLYPH_DENSITY = 0.03;
export const ZW_BIT_LENGTH = 16;

/* ------------------------------------------------------------------------- */
/* Layer 2 — Homoglyph                                                        */
/* ------------------------------------------------------------------------- */

export interface HomoglyphLayerResult {
  text: string;
  /** Character positions (in the input to this layer) where Latin→Cyrillic was applied. */
  positions: number[];
  /** Total Latin carrier letters available. */
  carrierCount: number;
  /** Number of positions actually flipped (deterministic ~density * carrierCount). */
  flippedCount: number;
}

function chooseHomoglyphPositions(
  carrierPositions: ReadonlyArray<number>,
  clientId: string,
  secret: string,
  density: number,
): Set<number> {
  if (carrierPositions.length === 0) return new Set();
  const targetCount = Math.max(1, Math.round(carrierPositions.length * density));
  const scored = carrierPositions.map((pos) => {
    const h = createHmac("sha256", secret)
      .update(`${clientId}|homoglyph|${pos}`)
      .digest();
    return { pos, score: h.readUInt32BE(0) };
  });
  scored.sort((a, b) => a.score - b.score);
  const selected = scored.slice(0, targetCount).map((s) => s.pos);
  return new Set(selected);
}

export function applyHomoglyphLayer(
  text: string,
  clientId: string,
  secret: string,
  density: number = HOMOGLYPH_DENSITY,
): HomoglyphLayerResult {
  // Canonicalize: revert any prior Cyrillic homoglyphs back to Latin so the
  // layer is idempotent and the position set is computed from a stable text.
  const canonical = stripHomoglyphs(text);
  const chars = Array.from(canonical);
  const carriers: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i]! in LATIN_TO_CYRILLIC) carriers.push(i);
  }
  if (carriers.length === 0) {
    return { text: canonical, positions: [], carrierCount: 0, flippedCount: 0 };
  }
  const selected = chooseHomoglyphPositions(carriers, clientId, secret, density);
  for (const p of selected) {
    chars[p] = LATIN_TO_CYRILLIC[chars[p]!]!;
  }
  return {
    text: chars.join(""),
    positions: [...selected].sort((a, b) => a - b),
    carrierCount: carriers.length,
    flippedCount: selected.size,
  };
}

/* ------------------------------------------------------------------------- */
/* Layer 3 — Zero-Width 16-bit clientId hash                                  */
/* ------------------------------------------------------------------------- */

export interface ZeroWidthLayerResult {
  text: string;
  bits: Array<0 | 1>;
  bitCount: number;
}

export function deriveClientZwBits(
  clientId: string,
  secret: string,
  nBits: number = ZW_BIT_LENGTH,
): Array<0 | 1> {
  const h = createHmac("sha256", secret).update(`${clientId}|zerowidth`).digest();
  const bits: Array<0 | 1> = [];
  for (let i = 0; i < nBits; i++) {
    const byte = h[i >> 3]!;
    bits.push(((byte >> (7 - (i & 7))) & 1) as 0 | 1);
  }
  return bits;
}

function bitsToFramedZw(bits: ReadonlyArray<0 | 1>): string {
  let payload = "";
  for (const b of bits) payload += b === 1 ? ZW_ONE : ZW_ZERO;
  return ZW_MARK + payload + ZW_MARK;
}

export function applyZeroWidthLayer(
  text: string,
  clientId: string,
  secret: string,
  nBits: number = ZW_BIT_LENGTH,
): ZeroWidthLayerResult {
  // Strip any previous ZW characters first so re-applying is idempotent.
  const canonical = stripZeroWidth(text);
  const bits = deriveClientZwBits(clientId, secret, nBits);
  return {
    text: bitsToFramedZw(bits) + canonical,
    bits,
    bitCount: nBits,
  };
}

/* ------------------------------------------------------------------------- */
/* Orchestrator                                                               */
/* ------------------------------------------------------------------------- */

export interface ProtectOptions {
  secret: string;
  homoglyphDensity?: number;
  zeroWidthBits?: number;
}

export interface ProtectLayerSummary {
  synonym: {
    replacementCount: number;
    variantHash: string;
    replacements: ShuffleReplacement[];
  };
  homoglyph: {
    carrierCount: number;
    flippedCount: number;
    density: number;
    positions: number[];
  };
  zeroWidth: {
    bitCount: number;
    bits: Array<0 | 1>;
  };
}

export interface ProtectResult {
  protectedText: string;
  layers: ProtectLayerSummary;
  /** Combined integrity tag: short HMAC over the layer outputs. */
  protectionHash: string;
}

function canonicalizeForProtection(text: string): string {
  return stripZeroWidth(stripHomoglyphs(text));
}

export function protectByClient(
  text: string,
  clientId: string,
  opts: ProtectOptions,
): ProtectResult {
  const secret = opts.secret;
  const density = opts.homoglyphDensity ?? HOMOGLYPH_DENSITY;
  const nBits = opts.zeroWidthBits ?? ZW_BIT_LENGTH;

  // 0. Canonicalize so the pipeline is fully idempotent.
  const canonical = canonicalizeForProtection(text);

  // 1. Linguistic DNA (synonym shuffle). Already double-pass-stable.
  const syn = shuffleByClient(canonical, clientId, { secret });

  // 2. Homoglyph — applied to the synonym output.
  const homo = applyHomoglyphLayer(syn.text, clientId, secret, density);

  // 3. Zero-Width — prepended (does not affect the previous two layers).
  const zw = applyZeroWidthLayer(homo.text, clientId, secret, nBits);

  const protectionHash = createHmac("sha256", secret)
    .update(
      [
        `client:${clientId}`,
        `syn:${syn.variantHash}`,
        `homo:${homo.flippedCount}/${homo.carrierCount}`,
        `zw:${zw.bits.join("")}`,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 16);

  return {
    protectedText: zw.text,
    layers: {
      synonym: {
        replacementCount: syn.replacements.length,
        variantHash: syn.variantHash,
        replacements: syn.replacements,
      },
      homoglyph: {
        carrierCount: homo.carrierCount,
        flippedCount: homo.flippedCount,
        density,
        positions: homo.positions,
      },
      zeroWidth: {
        bitCount: zw.bitCount,
        bits: zw.bits,
      },
    },
    protectionHash,
  };
}

/* ------------------------------------------------------------------------- */
/* Multi-channel forensic detector                                            */
/* ------------------------------------------------------------------------- */

export interface ChannelScore {
  matched: number;
  total: number;
  score: number;
  /** Channel-specific notes (e.g. expectedFlipped, observedBits). */
  details?: Record<string, unknown>;
}

export interface CandidateMultiChannelMatch {
  clientId: string;
  combinedScore: number;
  synonym: ChannelScore;
  homoglyph: ChannelScore;
  zeroWidth: ChannelScore & { present: boolean };
  /** For backward-compat with the single-channel API. */
  matchedTokens: number;
  totalTokens: number;
  confidenceScore: number;
}

export interface MultiChannelForensicResult {
  suspectedClientId: string | null;
  combinedScore: number;
  /** Backward-compat: the synonym channel of the best candidate. */
  matchedTokens: number;
  totalTokens: number;
  confidenceScore: number;
  candidates: CandidateMultiChannelMatch[];
  /** Channel breakdown for the best candidate. */
  bestBreakdown: {
    synonym: ChannelScore;
    homoglyph: ChannelScore;
    zeroWidth: ChannelScore & { present: boolean };
  } | null;
  /**
   * `true` iff suspectedClientId yalnızca BreachSignal boost yolu (carrier
   * stripping tespiti → düşürülmüş eşik) sayesinde nominasyon aldı. Birincil
   * yol (synonym minMatches VEYA ZW ≥ 0.85) zaten geçtiyse `false`.
   */
  boostApplied?: boolean;
}

export interface MultiChannelOptions {
  secret: string;
  minMatches?: number;
  homoglyphDensity?: number;
  zeroWidthBits?: number;
  /** Channel weights. Default: synonym 0.5, homoglyph 0.3, zeroWidth 0.2. */
  weights?: { synonym: number; homoglyph: number; zeroWidth: number };
  /**
   * Per-call BreachSignalBus (AEGIS v4.0). Carrier-stripping ve paraphrase
   * sinyalleri buraya yayınlanır; ayrıca varlığı boost-nominasyon yolunu
   * etkinleştirir. Çağrı sonrası bus dış sahibinde kalır — bu fonksiyon
   * kalıcı state tutmaz. Verilmezse hiçbir sinyal yayınlanmaz ve boost
   * uygulanmaz (geri-uyumlu).
   */
  signals?: BreachSignalBus;
  /** Yayınlanan sinyallerde context.docId olarak surface edilir. */
  docId?: string;
}

const DEFAULT_WEIGHTS = { synonym: 0.5, homoglyph: 0.3, zeroWidth: 0.2 };

function scoreSynonymChannel(
  suspectText: string,
  clientId: string,
  secret: string,
): ChannelScore {
  // Re-runs the producer to extract the expected trap-token sequence, then
  // aligns positionally against the suspect — same algorithm as the existing
  // `analyzeText`, just isolated as one channel.
  const suspectTokens = extractTrapTokens(suspectText);
  const total = suspectTokens.length;
  if (total === 0) return { matched: 0, total: 0, score: 0 };
  const expected = shuffleByClient(suspectText, clientId, { secret });
  const expectedTokens = extractTrapTokens(expected.text);
  const expectedMap = new Map<string, number>();
  for (const t of expectedTokens) {
    expectedMap.set(`${t.groupId}|${t.occurrence}`, t.chosenIdx);
  }
  let matched = 0;
  for (const t of suspectTokens) {
    const expectedIdx = expectedMap.get(`${t.groupId}|${t.occurrence}`);
    if (expectedIdx !== undefined && expectedIdx === t.chosenIdx) matched++;
  }
  return { matched, total, score: matched / total };
}

function scoreHomoglyphChannel(
  suspectText: string,
  clientId: string,
  secret: string,
  density: number,
): ChannelScore {
  // Strip the ZW frame first so character positions line up with what the
  // protect-time homoglyph layer saw (it ran BEFORE the ZW prefix was added).
  const chars = Array.from(stripZeroWidth(suspectText));
  // Build the canonical (all-Latin) form so positions are stable regardless
  // of which carriers are currently Cyrillic.
  const canonicalChars = chars.map((ch) =>
    ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch]! : ch,
  );
  const carriers: number[] = [];
  for (let i = 0; i < canonicalChars.length; i++) {
    if (canonicalChars[i]! in LATIN_TO_CYRILLIC) carriers.push(i);
  }
  if (carriers.length === 0) {
    return { matched: 0, total: 0, score: 0, details: { carrierCount: 0 } };
  }
  const expectedSelected = chooseHomoglyphPositions(carriers, clientId, secret, density);
  // Build observed set (positions actually flipped to Cyrillic in the suspect).
  const observedSet = new Set<number>();
  for (const pos of carriers) {
    if (chars[pos]! in CYRILLIC_TO_LATIN) observedSet.add(pos);
  }
  // F1 score over the SET of flipped positions — avoids the inflated
  // "correct zeros" score that bitwise accuracy gives when density is low.
  let truePositives = 0;
  for (const p of expectedSelected) if (observedSet.has(p)) truePositives++;
  const expectedCount = expectedSelected.size;
  const observedCount = observedSet.size;
  let score = 0;
  if (expectedCount === 0 && observedCount === 0) {
    score = 0;
  } else if (truePositives === 0) {
    score = 0;
  } else {
    const precision = truePositives / observedCount;
    const recall = truePositives / expectedCount;
    score = (2 * precision * recall) / (precision + recall);
  }
  return {
    matched: truePositives,
    total: expectedCount,
    score,
    details: {
      carrierCount: carriers.length,
      expectedFlipped: expectedCount,
      observedFlipped: observedCount,
      truePositives,
      falsePositives: observedCount - truePositives,
      falseNegatives: expectedCount - truePositives,
    },
  };
}

function extractFramedZwBits(text: string, maxBits: number): Array<0 | 1> {
  const first = text.indexOf(ZW_MARK);
  if (first === -1) return [];
  const second = text.indexOf(ZW_MARK, first + 1);
  if (second === -1) return [];
  const payload = text.slice(first + 1, second);
  const bits: Array<0 | 1> = [];
  for (const ch of payload) {
    if (ch === ZW_ZERO) bits.push(0);
    else if (ch === ZW_ONE) bits.push(1);
    if (bits.length >= maxBits) break;
  }
  return bits;
}

function scoreZeroWidthChannel(
  suspectText: string,
  clientId: string,
  secret: string,
  nBits: number,
): ChannelScore & { present: boolean } {
  const expected = deriveClientZwBits(clientId, secret, nBits);
  const observed = extractFramedZwBits(suspectText, nBits);
  if (observed.length === 0) {
    return { matched: 0, total: nBits, score: 0, present: false, details: { observedBits: 0 } };
  }
  const compareCount = Math.min(observed.length, nBits);
  let matched = 0;
  for (let i = 0; i < compareCount; i++) {
    if (observed[i] === expected[i]) matched++;
  }
  return {
    matched,
    total: nBits,
    score: matched / nBits,
    present: true,
    details: { observedBits: observed.length },
  };
}

function combineScores(
  syn: ChannelScore,
  homo: ChannelScore,
  zw: ChannelScore & { present: boolean },
  weights: { synonym: number; homoglyph: number; zeroWidth: number },
): number {
  let sum = 0;
  let totalW = 0;
  if (syn.total > 0) {
    sum += syn.score * weights.synonym;
    totalW += weights.synonym;
  }
  if (homo.total > 0) {
    sum += homo.score * weights.homoglyph;
    totalW += weights.homoglyph;
  }
  if (zw.present) {
    sum += zw.score * weights.zeroWidth;
    totalW += weights.zeroWidth;
  }
  return totalW === 0 ? 0 : sum / totalW;
}

export function analyzeTextMultiChannel(
  suspectText: string,
  candidateClientIds: ReadonlyArray<string>,
  opts: MultiChannelOptions,
): MultiChannelForensicResult {
  const secret = opts.secret;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const density = opts.homoglyphDensity ?? HOMOGLYPH_DENSITY;
  const nBits = opts.zeroWidthBits ?? ZW_BIT_LENGTH;
  const minMatches = opts.minMatches ?? 1;

  const seen = new Set<string>();
  const scored: CandidateMultiChannelMatch[] = [];

  for (const candidateRaw of candidateClientIds) {
    const candidate = String(candidateRaw);
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    const syn = scoreSynonymChannel(suspectText, candidate, secret);
    const homo = scoreHomoglyphChannel(suspectText, candidate, secret, density);
    const zw = scoreZeroWidthChannel(suspectText, candidate, secret, nBits);
    const combined = combineScores(syn, homo, zw, weights);

    scored.push({
      clientId: candidate,
      combinedScore: combined,
      synonym: syn,
      homoglyph: homo,
      zeroWidth: zw,
      // Backward-compat numbers reflect the synonym channel, which is what
      // the existing UI / report fields were built around.
      matchedTokens: syn.matched,
      totalTokens: syn.total,
      confidenceScore: combined,
    });
  }

  scored.sort((a, b) => {
    if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
    return b.matchedTokens - a.matchedTokens;
  });

  const best = scored[0];
  // Nomination gate: synonym evidence above minMatches OR a strong zero-width
  // match (≥85% of bits). `present` alone is too weak — a ZW frame produces
  // present=true for every candidate; only the matching clientId scores high.
  const ZW_NOMINATION_THRESHOLD = 0.85;
  let suspectedClientId: string | null =
    best &&
    (best.matchedTokens >= minMatches ||
      (best.zeroWidth.present && best.zeroWidth.score >= ZW_NOMINATION_THRESHOLD))
      ? best.clientId
      : null;
  let boostApplied = false;

  // ── BreachSignal: post-scoring inference (per-call bus) ────────────────
  // Carrier-stripping pattern'larını best candidate üzerinden tespit edip
  // bus'a yayınla. Sinyaller, boost yolunu açacak. Bus yoksa hiçbir şey
  // yayınlanmaz (backward-compat).
  if (opts.signals && best) {
    const ctx: { clientId: string; docId?: string } = { clientId: best.clientId };
    if (opts.docId) ctx.docId = opts.docId;

    // 1. zero_width_stripped: ZW frame yok ama synonym/homoglyph evidence
    //    GÜÇLÜ. Eşikler bilinçli yüksek (synonym ≥ 0.7 veya homoglyph ≥ 0.5)
    //    — doğal Türkçe metin küçük rastlantısal synonym skorları üretebilir
    //    (kısa metinler için 0.5-0.6 normal). Bu eşikler false-positive
    //    sinyali engeller; sinyal emit edilirse gerçekten "protect edildi
    //    sonra carrier silindi" pattern'ına işaret eder.
    if (
      !best.zeroWidth.present &&
      (best.synonym.score >= 0.7 || best.homoglyph.score >= 0.5)
    ) {
      opts.signals.emitSignal({
        type: "zero_width_stripped",
        severity: "high",
        source: "analyzeTextMultiChannel",
        context: { ...ctx, synScore: best.synonym.score, homoScore: best.homoglyph.score },
      });
    }

    // 2. homoglyph_normalized: protect-time homoglyph yerleştirilmesi
    //    bekleniyordu (expectedFlipped > 0) ama suspect'te 0 gözlendi →
    //    NFC normalize ya da Cyrillic→Latin reverse uygulanmış.
    const homoDetails = best.homoglyph.details as
      | { expectedFlipped?: number; observedFlipped?: number }
      | undefined;
    if (
      homoDetails &&
      typeof homoDetails.expectedFlipped === "number" &&
      typeof homoDetails.observedFlipped === "number" &&
      homoDetails.expectedFlipped > 0 &&
      homoDetails.observedFlipped === 0 &&
      best.synonym.score >= 0.6
    ) {
      opts.signals.emitSignal({
        type: "homoglyph_normalized",
        severity: "high",
        source: "analyzeTextMultiChannel",
        context: {
          ...ctx,
          expectedFlipped: homoDetails.expectedFlipped,
          observedFlipped: homoDetails.observedFlipped,
        },
      });
    }

    // 3. linguistic_dna_paraphrased: synonym kanal düşük ama daha sağlam
    //    bir kanal (homoglyph orta, ZW güçlü) tutuyor → metin parafraz
    //    edilmiş ama carrier hayatta. Severity medium (insufficient kararı
    //    bunu strong'a çıkarmaz, sadece raporlanır).
    if (
      best.synonym.total > 0 &&
      best.synonym.matched > 0 &&
      best.synonym.score < SENSITIVITY_BOOST.linguisticDnaNormal &&
      (best.homoglyph.score >= 0.5 || (best.zeroWidth.present && best.zeroWidth.score >= 0.7))
    ) {
      opts.signals.emitSignal({
        type: "linguistic_dna_paraphrased",
        severity: "medium",
        source: "analyzeTextMultiChannel",
        context: { ...ctx, synScore: best.synonym.score },
      });
    }
  }

  // ── Adaptive sensitivity boost ─────────────────────────────────────────
  // Carrier stripping tespit edildiyse (zero_width_stripped VEYA
  // homoglyph_normalized), nominasyon eşiğini düşür: synonym ≥ 0.50 OR
  // homoglyph ≥ 0.40. False-Accusation Guard ÜÇ KATMANLI:
  //   (a) ≥2 aday boost-eşiğini geçerse nominasyon YAPILMAZ (multi-suspect).
  //   (b) Best aday combinedScore'da runner-up'tan ≥ BOOST_MARGIN önde olmalı
  //       (architect önerisi: tek aday boost geçse bile gürültülü skor
  //       farkları false-positive üretebilir; margin koruması bunu engeller).
  //   (c) Aday sayısı = 1 olan input için runner-up margin tatbik edilemez —
  //       o durumda nominasyon kabul edilir (zaten "tek aday" çağıranın
  //       kendi seçimi; boost burada yalnızca eşik gevşetme rolündedir).
  const BOOST_RUNNERUP_MARGIN = 0.2;
  if (suspectedClientId === null && best && shouldApplySensitivityBoost(opts.signals)) {
    const passingBoost = scored.filter(
      (c) =>
        c.synonym.score >= SENSITIVITY_BOOST.linguisticDnaBoosted ||
        c.homoglyph.score >= SENSITIVITY_BOOST.homoglyphBoosted,
    );
    const bestPassesBoost =
      best.synonym.score >= SENSITIVITY_BOOST.linguisticDnaBoosted ||
      best.homoglyph.score >= SENSITIVITY_BOOST.homoglyphBoosted;
    const runnerUp = scored[1];
    const marginOk =
      runnerUp === undefined ||
      best.combinedScore - runnerUp.combinedScore >= BOOST_RUNNERUP_MARGIN;
    if (bestPassesBoost && passingBoost.length === 1 && marginOk) {
      suspectedClientId = best.clientId;
      boostApplied = true;
    }
    // Diğer tüm durumlar (≥2 boost-passing aday VEYA marjin yetersiz) →
    // ambiguous, suspectedClientId null kalır. Çağrı sahibi multiSuspect
    // olarak ele alır.
  }

  return {
    suspectedClientId,
    combinedScore: best?.combinedScore ?? 0,
    matchedTokens: best?.matchedTokens ?? 0,
    totalTokens: best?.totalTokens ?? 0,
    confidenceScore: best?.combinedScore ?? 0,
    candidates: scored,
    bestBreakdown: best
      ? {
          synonym: best.synonym,
          homoglyph: best.homoglyph,
          zeroWidth: best.zeroWidth,
        }
      : null,
    boostApplied,
  };
}
