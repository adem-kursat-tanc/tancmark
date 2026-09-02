// Stylometric DNA analyzer — measures the *style* fingerprint of a text:
// average sentence length, lexical diversity (type-token ratio), and the
// distribution of common Turkish stop words. These metrics are robust to
// content paraphrasing and serve as a corroborating "Stylometric_DNA"
// channel alongside the synonym/homoglyph/zero-width signals.

const TURKISH_STOP_WORDS = [
  "ve",
  "veya",
  "ile",
  "için",
  "ama",
  "fakat",
  "ancak",
  "çünkü",
  "ki",
  "de",
  "da",
  "mi",
  "mı",
  "mu",
  "mü",
  "bu",
  "şu",
  "o",
  "bir",
  "her",
  "bazı",
  "hiç",
  "çok",
  "az",
  "daha",
  "en",
  "olan",
  "olarak",
  "gibi",
  "kadar",
  "sonra",
  "önce",
  "kendi",
  "ben",
  "sen",
  "biz",
  "siz",
  "onlar",
  "şey",
  "eğer",
  "ya",
  "yani",
  "ise",
  "ne",
  "nasıl",
  "hem",
] as const;

const STOP_WORD_SET = new Set<string>(TURKISH_STOP_WORDS);

const WORD_RE = /[A-Za-zÇĞİıÖŞÜçğıöşü0-9]+/g;
// Turkish sentence terminators: . ! ? + their ellipsis variants.
function isSentenceWhitespace(value: string): boolean {
  return value.trim().length === 0;
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let cursor = 0;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char !== "." && char !== "!" && char !== "?") {
      cursor += 1;
      continue;
    }
    let terminatorEnd = cursor + 1;
    while (
      terminatorEnd < text.length &&
      (text[terminatorEnd] === "." || text[terminatorEnd] === "!" || text[terminatorEnd] === "?")
    ) {
      terminatorEnd += 1;
    }
    if (terminatorEnd < text.length && !isSentenceWhitespace(text[terminatorEnd] ?? "")) {
      cursor = terminatorEnd;
      continue;
    }
    sentences.push(text.slice(start, cursor));
    cursor = terminatorEnd;
    while (cursor < text.length && isSentenceWhitespace(text[cursor] ?? "")) cursor += 1;
    start = cursor;
  }
  sentences.push(text.slice(start));
  return sentences;
}

export interface StylometricMetrics {
  /** Total word count (any token matched by [letters/digits]+). */
  wordCount: number;
  /** Number of distinct lowercase word forms. */
  uniqueWordCount: number;
  /** Number of detected sentences (split on . ! ?). */
  sentenceCount: number;
  /**
   * Mean words per sentence. Higher → longer, more complex sentences.
   * Returns 0 when sentenceCount === 0.
   */
  avgSentenceLength: number;
  /**
   * Type-token ratio (uniqueWordCount / wordCount). Range [0, 1].
   * 1.0 = every word is unique; lower values → more lexical repetition.
   * Returns 0 when wordCount === 0.
   */
  lexicalDiversity: number;
  /**
   * Total stop-word occurrences in the text.
   */
  stopWordCount: number;
  /**
   * stopWordCount / wordCount, range [0, 1]. Returns 0 when wordCount === 0.
   */
  stopWordRatio: number;
  /**
   * Per-stop-word occurrence count. Only keys with count > 0 are included
   * (sorted descending by count, then alphabetically). Capped at 12 entries
   * to keep payloads bounded for UI/PDF rendering.
   */
  stopWordDistribution: Array<{ word: string; count: number }>;
  /**
   * Mean characters per word (excluding whitespace and punctuation).
   * Returns 0 when wordCount === 0.
   */
  avgWordLength: number;
}

const STOP_WORD_DIST_LIMIT = 12;

export function analyzeStylometry(text: string): StylometricMetrics {
  if (typeof text !== "string" || text.length === 0) {
    return emptyMetrics();
  }

  // Tokenize words.
  const matches: string[] = text.match(WORD_RE) ?? [];
  const wordCount = matches.length;
  if (wordCount === 0) return emptyMetrics();

  const lowered = matches.map((w) => w.toLocaleLowerCase("tr"));
  const uniqueSet = new Set(lowered);

  // Sentences: split on terminators, drop empties.
  // Use a NON-GLOBAL regex for the per-sentence "has-a-word" check so we
  // don't accidentally mutate `WORD_RE.lastIndex` (which breaks subsequent
  // tests on the same global regex and made `sentenceCount` flaky).
  const HAS_WORD_RE = /[A-Za-zÇĞİıÖŞÜçğıöşü0-9]/u;
  const sentences = splitSentences(text)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && HAS_WORD_RE.test(s));
  const sentenceCount = sentences.length;

  // Stop-word distribution.
  const stopCounts = new Map<string, number>();
  let stopWordCount = 0;
  for (const w of lowered) {
    if (STOP_WORD_SET.has(w)) {
      stopCounts.set(w, (stopCounts.get(w) ?? 0) + 1);
      stopWordCount++;
    }
  }

  const stopWordDistribution = Array.from(stopCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => (b.count - a.count) || a.word.localeCompare(b.word, "tr"))
    .slice(0, STOP_WORD_DIST_LIMIT);

  const totalCharLen = matches.reduce((acc, w) => acc + Array.from(w).length, 0);

  return {
    wordCount,
    uniqueWordCount: uniqueSet.size,
    sentenceCount,
    avgSentenceLength: sentenceCount > 0 ? wordCount / sentenceCount : 0,
    lexicalDiversity: uniqueSet.size / wordCount,
    stopWordCount,
    stopWordRatio: stopWordCount / wordCount,
    stopWordDistribution,
    avgWordLength: totalCharLen / wordCount,
  };
}

function emptyMetrics(): StylometricMetrics {
  return {
    wordCount: 0,
    uniqueWordCount: 0,
    sentenceCount: 0,
    avgSentenceLength: 0,
    lexicalDiversity: 0,
    stopWordCount: 0,
    stopWordRatio: 0,
    stopWordDistribution: [],
    avgWordLength: 0,
  };
}

export const TURKISH_STOP_WORD_LIST: readonly string[] = TURKISH_STOP_WORDS;
