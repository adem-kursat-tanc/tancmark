/**
 * Lightweight, fully local paraphrase / fuzzy match scoring for canary
 * verification. The only purpose is to surface a *low/medium-confidence*
 * signal when a leaked text looks like a paraphrased version of a known
 * canary phrase or marker term — strict equality is still handled
 * elsewhere and produces the high-confidence verdict.
 *
 * Hard rules (defended by the test battery):
 *   - Fuzzy / token-overlap signal alone is **never** decisive
 *     (`tier <= "medium"`).
 *   - A leaked text that shares no meaningful tokens with the canary
 *     returns `score=0` and tier `"none"` — never a false high.
 *   - Birebir / marker hit is owned by `canary.ts::verifyCanary` and is
 *     not re-decided here.
 *
 * Algorithm (intentionally simple, no embeddings, no third-party deps):
 *   1. Lowercase + Turkish stop-word strip + tokenize on Unicode letters.
 *   2. Compute Jaccard similarity over the token sets.
 *   3. Compute a normalized Levenshtein on the canary *term* against
 *      every text token; take the best score (handles "yağmursoylu" vs
 *      "yağmurlusoylu", common transcription drift).
 *   4. Combined score = max(jaccard*0.6 + bestTerm*0.4, bestTerm*0.8)
 *      capped at 0.79 (never reach the 0.9 high-confidence band).
 */

const TR_STOPWORDS = new Set([
  "ve", "veya", "ile", "de", "da", "için", "icin", "ki", "mi", "mı", "mu",
  "mü", "bir", "bu", "şu", "su", "o", "ben", "sen", "biz", "siz", "onlar",
  "ama", "fakat", "lakin", "çünkü", "cunku", "ise", "gibi", "kadar", "daha",
  "en", "her", "hiç", "hic", "olarak", "üzere", "uzere",
]);

const WORD_RE = /[A-Za-zÇĞİıÖŞÜçğıöşü0-9]+/gu;

function tokenize(text: string): string[] {
  const lowered = text.toLocaleLowerCase("tr-TR");
  return (lowered.match(WORD_RE) ?? []).filter(
    (t) => t.length >= 3 && !TR_STOPWORDS.has(t),
  );
}

function jaccard(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Normalized Levenshtein similarity in [0,1]. */
function normLevenshtein(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const dp: number[] = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= lb; j++) {
      const tmp = dp[j]!;
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  const dist = dp[lb]!;
  return 1 - dist / Math.max(la, lb);
}

export type FuzzyTier = "none" | "low" | "medium" | "high";

export interface FuzzyMatchResult {
  /** [0..0.79], capped — fuzzy alone never reaches 0.9+. */
  score: number;
  tier: FuzzyTier;
  jaccard: number;
  bestTermSimilarity: number;
  matchedTerm: string | null;
}

/**
 * Compare a suspect text against the canary phrase + the canary term.
 * Returns a low/medium fuzzy score; tier "high" is only reachable from
 * exact verification in `canary.ts`, never from here.
 */
export function fuzzyCanaryMatch(
  suspectText: string,
  canaryPhrase: string,
  canaryTerm: string,
): FuzzyMatchResult {
  if (
    typeof suspectText !== "string" ||
    typeof canaryPhrase !== "string" ||
    typeof canaryTerm !== "string" ||
    suspectText.length === 0
  ) {
    return { score: 0, tier: "none", jaccard: 0, bestTermSimilarity: 0, matchedTerm: null };
  }
  const phraseTokens = tokenize(canaryPhrase);
  const suspectTokens = tokenize(suspectText);
  const j = jaccard(suspectTokens, phraseTokens);
  const termLower = canaryTerm.toLocaleLowerCase("tr-TR");
  let best = 0;
  let matched: string | null = null;
  for (const t of suspectTokens) {
    const s = normLevenshtein(t, termLower);
    if (s > best) {
      best = s;
      matched = t;
    }
  }
  // Combined: weight token-overlap less, term-similarity more — but cap
  // at 0.79 so a fuzzy hit can never single-handedly reach the 0.9 band.
  const combined = Math.min(0.79, Math.max(j * 0.6 + best * 0.4, best * 0.8));
  let tier: FuzzyTier;
  if (best >= 0.85 && j >= 0.3) tier = "medium";
  else if (best >= 0.7 || j >= 0.4) tier = "low";
  else if (combined >= 0.2) tier = "low";
  else tier = "none";
  return {
    score: combined,
    tier,
    jaccard: j,
    bestTermSimilarity: best,
    matchedTerm: matched,
  };
}
