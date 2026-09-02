/**
 * Semantic Positional Watermark — Verify (Analyze) tarafı.
 *
 * Algoritma:
 *   1. Plan boş veya sensitiveSkip ise erken dönüş — signalScore=0,
 *      pValue=1, forensic flag=false.
 *   2. Suspect text'i cümlelere böl.
 *   3. Plan watermarked entry'leriyle indeks-bazlı 1:1 eşleştir
 *      (min(plan, suspect)).
 *   4. Her aligned cümle için: emb hesapla, score = emb · d, observedBit =
 *      (score >= decisionThreshold ? 1 : 0).
 *   5. matched count k, total n.
 *   6. Binomial test: pValue = P(X ≥ k | n, p=0.5).
 *      signalScore = 1 - pValue (clamp [0,1]).
 *   7. Lexical Jaccard her cümle için (orijinal vs suspect tokens).
 *   8. forensicParaphraseWarning: signalScore ≥ 0.70 AND avg lexical ≤ 0.50.
 */

import { embedMany, isSemanticModelLoaded } from "./model.js";
import { projectionDirection, dot } from "./projection.js";
import { splitSentencesTr } from "./embed.js";
import type {
  SemanticPositionalPlan,
  SemanticVerifyOptions,
  SemanticVerifyResult,
  SemanticPerSentenceResult,
} from "./types.js";

/** Binomial CDF tail — P(X >= k | n, p=0.5). Logarithmic guard yok; n ≤ 200. */
function binomialPValueGEQ(k: number, n: number, p = 0.5): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  // P(X >= k) = sum_{i=k..n} C(n,i) p^i (1-p)^(n-i)
  // log binomial via lgamma for stability.
  let sum = 0;
  for (let i = k; i <= n; i++) {
    const logC = lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1);
    const logP = i * Math.log(p) + (n - i) * Math.log(1 - p);
    sum += Math.exp(logC + logP);
  }
  if (sum > 1) return 1;
  if (sum < 0) return 0;
  return sum;
}

// Stirling-based lgamma; sufficient precision for n <= a few hundred.
function lgamma(x: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = c[0]!;
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const TOKEN_RE = /[A-Za-zÇĞİıÖŞÜçğıöşü0-9]+/gu;

function tokenSet(s: string): Set<string> {
  const out = new Set<string>();
  const m = s.toLocaleLowerCase("tr-TR").match(TOKEN_RE);
  if (m) for (const t of m) out.add(t);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni > 0 ? inter / uni : 0;
}

export async function verifySemanticPositional(
  suspectText: string,
  plan: SemanticPositionalPlan,
  opts: SemanticVerifyOptions,
): Promise<SemanticVerifyResult> {
  const t0 = Date.now();
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("verifySemanticPositional: secret must be ≥8 chars");
  }
  // Erken çıkışlar — verify yapacak watermark yok.
  const watermarkedEntries = plan.entries.filter((e) => e.watermarked);
  if (plan.sensitiveSkip || watermarkedEntries.length === 0) {
    return {
      signalScore: 0,
      matchedBits: 0,
      totalBits: 0,
      pValue: 1,
      lexicalOverlap: 0,
      forensicParaphraseWarning: false,
      perSentence: [],
      verifyTimeMs: Date.now() - t0,
      alignedSentences: 0,
    };
  }
  const suspectSentences = splitSentencesTr(suspectText);
  if (suspectSentences.length === 0) {
    return {
      signalScore: 0,
      matchedBits: 0,
      totalBits: 0,
      pValue: 1,
      lexicalOverlap: 0,
      forensicParaphraseWarning: false,
      perSentence: [],
      verifyTimeMs: Date.now() - t0,
      alignedSentences: 0,
    };
  }
  // Plan tam cümle sırasını korur. Suspect'i indeks-bazlı eşleştir.
  // Her plan entry (watermarked olsun olmasın) plan.entries'de bir sıra
  // tutar; biz watermarked olanları kullanırız ama global indekste suspect
  // ile aynı pozisyondayız.
  const aligned = Math.min(plan.entries.length, suspectSentences.length);
  const perSentence: SemanticPerSentenceResult[] = [];
  // Embed sadece watermarked entry'lere karşılık gelen suspect cümleleri.
  const embedTargets: { entryIdx: number; suspectText: string }[] = [];
  for (let i = 0; i < aligned; i++) {
    const entry = plan.entries[i]!;
    if (!entry.watermarked) continue;
    embedTargets.push({ entryIdx: i, suspectText: suspectSentences[i]! });
  }
  if (embedTargets.length === 0) {
    return {
      signalScore: 0,
      matchedBits: 0,
      totalBits: 0,
      pValue: 1,
      lexicalOverlap: 0,
      forensicParaphraseWarning: false,
      perSentence: [],
      verifyTimeMs: Date.now() - t0,
      alignedSentences: aligned,
    };
  }
  void isSemanticModelLoaded; // keep import live for typecheck
  const embs = await embedMany(embedTargets.map((t) => t.suspectText));
  let matchedBits = 0;
  let lexSum = 0;
  for (let j = 0; j < embedTargets.length; j++) {
    const target = embedTargets[j]!;
    const entry = plan.entries[target.entryIdx]!;
    const d = projectionDirection(opts.secret, plan.clientId, plan.docId, entry.idx);
    const score = dot(embs[j]!, d);
    const threshold = entry.decisionThreshold ?? 0;
    const observedBit: 0 | 1 = score >= threshold ? 1 : 0;
    const tBit = entry.targetBit!;
    const matched = observedBit === tBit;
    if (matched) matchedBits++;
    const lex = jaccard(
      tokenSet(entry.originalNormalized),
      tokenSet(target.suspectText),
    );
    lexSum += lex;
    perSentence.push({
      idx: entry.idx,
      targetBit: tBit,
      observedBit,
      matched,
      suspectMargin: score - threshold,
      lexicalJaccard: lex,
    });
  }
  const totalBits = embedTargets.length;
  const pValue = binomialPValueGEQ(matchedBits, totalBits, 0.5);
  const signalScore = Math.max(0, Math.min(1, 1 - pValue));
  const lexicalOverlap = totalBits > 0 ? lexSum / totalBits : 0;
  const forensicParaphraseWarning =
    signalScore >= 0.7 && lexicalOverlap <= 0.5;
  return {
    signalScore,
    matchedBits,
    totalBits,
    pValue,
    lexicalOverlap,
    forensicParaphraseWarning,
    perSentence,
    verifyTimeMs: Date.now() - t0,
    alignedSentences: aligned,
  };
}
