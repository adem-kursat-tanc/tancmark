/**
 * Semantic Positional Watermark — Embed (Cloak) tarafı.
 *
 * Algoritma:
 *   1. Hassas konu kontrolü (savunma/sağlık/hukuk vb.) — pozitif ise
 *      embed tamamen atlanır, plan boş döner.
 *   2. Cümlelere böl (regex `(?<=[.!?])\s+`).
 *   3. Her cümle için generateSemanticVariants → 1..4 variant.
 *   4. Tüm variants embed et, score = emb · d.
 *   5. Coverage check: variants içinde her iki bit de mevcut mu? Hayır →
 *      coverage 0.5 → COVERAGE_THRESHOLD (0.30) sağlanır ama tek bit varsa
 *      0 → atla. Burada "her iki bit" = score'lar threshold'un iki tarafına
 *      düşer.
 *   6. decisionThreshold = score'ların medyanı.
 *   7. targetBit'i türet (HMAC zinciri).
 *   8. targetBit'e ait variant'lar arasından max margin'lı olanı seç.
 *   9. Plan'a yaz, markedText'e variant.text'i geçir.
 */

import { detectSensitiveTopic } from "../sensitiveTopic.js";
import { generateSemanticVariants } from "./perturb.js";
import { embedMany, isSemanticModelLoaded } from "./model.js";
import { projectionDirection, targetBitFor, dot, sha256Hex } from "./projection.js";
import {
  SEMANTIC_KEY_INFO,
  SEMANTIC_PLAN_VERSION,
  type SemanticEmbedOptions,
  type SemanticEmbedResult,
  type SemanticPositionalEntry,
  type SemanticPositionalPlan,
  type SemanticSkipReason,
} from "./types.js";

const MIN_SENTENCE_CHARS = 12;
export const COVERAGE_THRESHOLD = 0.3;
export const N_BUCKETS = 2 as const;

/**
 * Cümle ayırıcı: nokta/ünlem/soru sonrası boşluk. Türkçe için yeterli;
 * kısaltma "Dr." gibi false-split'ler kabul edilir (T2 kanal pratiğe
 * dirençli olmalı, mükemmel bir splitter şart değil).
 */
export function splitSentencesTr(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1]! + s[mid]!) / 2;
  return s[mid]!;
}

export async function embedSemanticPositional(
  rawText: string,
  opts: SemanticEmbedOptions,
): Promise<SemanticEmbedResult> {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error("embedSemanticPositional: text must be non-empty");
  }
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("embedSemanticPositional: secret must be ≥8 chars");
  }
  const wasLoaded = isSemanticModelLoaded();
  const t0 = Date.now();

  const sentences = splitSentencesTr(rawText);
  const totalSentences = sentences.length;

  const sensitive = detectSensitiveTopic(rawText);
  const sensitiveSkip = sensitive.topic !== "none";

  if (sensitiveSkip) {
    const entries: SemanticPositionalEntry[] = sentences.map((s, i) => ({
      idx: i,
      originalHash: sha256Hex(s),
      originalNormalized: "",
      watermarked: false,
      skipReason: "sensitive_topic" as SemanticSkipReason,
    }));
    const plan: SemanticPositionalPlan = {
      version: SEMANTIC_PLAN_VERSION,
      info: SEMANTIC_KEY_INFO,
      clientId: opts.clientId,
      docId: opts.docId,
      createdAt: new Date().toISOString(),
      totalSentences,
      watermarkedSentences: 0,
      skippedSentences: totalSentences,
      sensitiveTopic: sensitive.topic,
      sensitiveSkip: true,
      entries,
    };
    return {
      markedText: rawText, // değişmez
      plan,
      metrics: {
        totalSentences,
        watermarkedSentences: 0,
        watermarkRate: 0,
        embedTimeMs: Date.now() - t0,
        coldStartMs: 0,
        sensitiveSkip: true,
      },
    };
  }

  const entries: SemanticPositionalEntry[] = [];
  const outputSentences: string[] = [];
  let watermarkedCount = 0;
  let coldStartMs = 0;

  for (let idx = 0; idx < sentences.length; idx++) {
    const s = sentences[idx]!;
    if (s.length < MIN_SENTENCE_CHARS) {
      entries.push({
        idx,
        originalHash: sha256Hex(s),
        originalNormalized: s,
        watermarked: false,
        skipReason: "sentence_too_short",
      });
      outputSentences.push(s);
      continue;
    }
    const variants = generateSemanticVariants(s);
    if (variants.length < 2) {
      entries.push({
        idx,
        originalHash: sha256Hex(s),
        originalNormalized: s,
        watermarked: false,
        skipReason: "no_variants_applicable",
      });
      outputSentences.push(s);
      continue;
    }
    // Embed tüm variants. İlk cümle yüklemeyi tetikler → cold-start ölç.
    const embedT0 = idx === 0 && !wasLoaded ? Date.now() : 0;
    const embs = await embedMany(variants.map((v) => v.text));
    if (idx === 0 && !wasLoaded && embedT0 > 0) {
      coldStartMs = Date.now() - embedT0;
    }
    const d = projectionDirection(opts.secret, opts.clientId, opts.docId, idx);
    const scores = embs.map((e) => dot(e, d));
    const threshold = median(scores);
    // Bit dağılımı: score >= threshold → bit=1, < threshold → bit=0.
    // Eşitlik durumunda (median = score) bit=1 kabul (deterministik).
    const bits = scores.map<0 | 1>((s2) => (s2 >= threshold ? 1 : 0));
    const has0 = bits.some((b) => b === 0);
    const has1 = bits.some((b) => b === 1);
    const coverage = (has0 ? 0.5 : 0) + (has1 ? 0.5 : 0);
    if (coverage < COVERAGE_THRESHOLD) {
      entries.push({
        idx,
        originalHash: sha256Hex(s),
        originalNormalized: s,
        watermarked: false,
        skipReason: "coverage_below_threshold",
      });
      outputSentences.push(s);
      continue;
    }
    const target = targetBitFor(opts.secret, opts.clientId, opts.docId, idx);
    // targetBit'e uyan variants içinden |score - threshold| en büyük olanı seç.
    let bestI = -1;
    let bestMargin = -Infinity;
    for (let i = 0; i < variants.length; i++) {
      if (bits[i] !== target) continue;
      const m = Math.abs(scores[i]! - threshold);
      if (m > bestMargin) {
        bestMargin = m;
        bestI = i;
      }
    }
    if (bestI < 0) {
      // Coverage geçti ama target bit'e ait variant yok — teorik olarak imkansız
      // (coverage=1.0 ⇒ her iki bit de var). Yine de güvenli atla.
      entries.push({
        idx,
        originalHash: sha256Hex(s),
        originalNormalized: s,
        watermarked: false,
        skipReason: "coverage_below_threshold",
      });
      outputSentences.push(s);
      continue;
    }
    const chosen = variants[bestI]!;
    entries.push({
      idx,
      originalHash: sha256Hex(s),
      originalNormalized: s,
      watermarked: true,
      targetBit: target,
      decisionThreshold: threshold,
      marginAtCloak: bestMargin,
      opsApplied: chosen.ops,
    });
    outputSentences.push(chosen.text);
    watermarkedCount++;
  }

  const plan: SemanticPositionalPlan = {
    version: SEMANTIC_PLAN_VERSION,
    info: SEMANTIC_KEY_INFO,
    clientId: opts.clientId,
    docId: opts.docId,
    createdAt: new Date().toISOString(),
    totalSentences,
    watermarkedSentences: watermarkedCount,
    skippedSentences: totalSentences - watermarkedCount,
    sensitiveTopic: sensitive.topic,
    sensitiveSkip: false,
    entries,
  };

  return {
    markedText: outputSentences.join(" "),
    plan,
    metrics: {
      totalSentences,
      watermarkedSentences: watermarkedCount,
      watermarkRate: totalSentences > 0 ? watermarkedCount / totalSentences : 0,
      embedTimeMs: Date.now() - t0,
      coldStartMs,
      sensitiveSkip: false,
    },
  };
}
