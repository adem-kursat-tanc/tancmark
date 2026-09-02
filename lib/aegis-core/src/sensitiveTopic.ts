/**
 * Heuristic Turkish topic classifier — detects whether a piece of text
 * touches a sensitive domain where decoy micro-facts are dangerous (could
 * mislead readers in health, elections, disaster, war, legal, financial
 * advice, or emergency contexts).
 *
 * Pure, deterministic, no ML — just a keyword bag per topic. The goal is
 * **safety**: false positives are acceptable (we just disable decoys for
 * neutral text), false negatives are NOT (a missed health article would
 * get fake medical "facts" injected — unacceptable).
 *
 * For a hit we require ≥2 distinct keywords from the same topic to reduce
 * the chance that a single ambiguous word ("hasta" = sick OR opponent)
 * triggers a topic ban on a totally unrelated article.
 */

import type { SensitiveTopic } from "./types-shared.js";

export type { SensitiveTopic };

/**
 * Topic → distinct lowercased Turkish keyword bag. Each value is matched
 * as a whole word (Unicode letter boundaries), case-insensitive.
 */
const TOPIC_KEYWORDS: Record<Exclude<SensitiveTopic, "none">, ReadonlyArray<string>> = {
  saglik: [
    "hasta", "hastane", "doktor", "ilaç", "ilac", "tedavi", "kanser", "tümör",
    "ameliyat", "aşı", "asi", "virus", "virüs", "salgın", "salgin", "epidemi",
    "pandemi", "klinik", "teşhis", "teshis", "semptom", "covid", "grip",
    "sağlık", "saglik",
  ],
  afet: [
    "deprem", "sel", "yangın", "yangin", "tsunami", "heyelan", "çığ", "cig",
    "afet", "felaket", "tahliye", "kurtarma", "enkaz", "afad", "kızılay",
    "kizilay", "büyüklük", "buyukluk", "richter", "magnitude",
  ],
  secim: [
    "seçim", "secim", "oy", "oylama", "sandık", "sandik", "aday", "parti",
    "ysk", "milletvekili", "cumhurbaşkanı", "cumhurbaskani", "anket",
    "kampanya", "siyasi", "muhalefet", "iktidar", "koalisyon", "referandum",
  ],
  hukuk: [
    "mahkeme", "dava", "hakim", "savcı", "savci", "avukat", "tutuklama",
    "iddianame", "yargıtay", "yargitay", "karar", "ceza", "hapis", "müebbet",
    "muebbet", "anayasa", "hukuki", "mahkum", "sanık", "sanik", "müvekkil",
    "yargılama", "yargilama",
  ],
  yatirim: [
    "yatırım", "yatirim", "borsa", "hisse", "kripto", "bitcoin", "ethereum",
    "altın", "altin", "döviz", "doviz", "fon", "portföy", "portfoy", "tahvil",
    "vadeli", "spk", "bist", "nasdaq", "kazanç", "kazanc", "sermaye",
    "tavsiye",
  ],
  savas: [
    "savaş", "savas", "ordu", "asker", "saldırı", "saldiri", "bomba",
    "füze", "fuze", "tank", "drone", "çatışma", "catisma", "operasyon",
    "şehit", "sehit", "yaralı", "yarali", "cephane", "tsk", "askeri",
    "milis", "terör", "teror",
  ],
  acil: [
    "acil", "112", "ambulans", "itfaiye", "patlama", "kaza", "ölü", "olu",
    "kayıp", "kayip", "yaralı", "yarali", "tahliye", "tehlike", "uyarı",
    "uyari", "alarm",
  ],
};

const WORD_RE = /[A-Za-zÇĞİıÖŞÜçğıöşü0-9]+/gu;

export interface SensitiveTopicHit {
  topic: SensitiveTopic;
  matchedKeywords: string[];
  hits: number;
}

/**
 * Return the topic with the most distinct keyword hits (≥2 required).
 * Returns `{ topic: "none", … }` when no topic crosses the threshold.
 */
export function detectSensitiveTopic(text: string): SensitiveTopicHit {
  if (typeof text !== "string" || text.length === 0) {
    return { topic: "none", matchedKeywords: [], hits: 0 };
  }
  const lowered = text.toLocaleLowerCase("tr-TR");
  const tokens = (lowered.match(WORD_RE) ?? []) as string[];
  const tokenSet = new Set(tokens);
  // Turkish is agglutinative — "seçim" is a prefix of "seçimi/seçimin/seçimde",
  // "cumhurbaşkanı" of "cumhurbaşkanlığı", "anket" of "ankete/anketler".
  // For keywords ≥ 4 chars, allow stem prefix match; for short keywords
  // (afad, ysk, oy, …) require exact token equality to avoid false positives.
  function keywordHit(keyword: string): boolean {
    if (keyword.length <= 3) return tokenSet.has(keyword);
    if (tokenSet.has(keyword)) return true;
    return tokens.some((t) => t.length >= keyword.length && t.startsWith(keyword));
  }
  let best: SensitiveTopicHit = { topic: "none", matchedKeywords: [], hits: 0 };
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as Array<
    [Exclude<SensitiveTopic, "none">, ReadonlyArray<string>]
  >) {
    const matched = keywords.filter(keywordHit);
    if (matched.length >= 2 && matched.length > best.hits) {
      best = { topic, matchedKeywords: matched, hits: matched.length };
    }
  }
  return best;
}

/**
 * `true` when the topic is sensitive enough to disable decoy micro-facts
 * and training noise. Only canary + clientTrace + linguisticDna are
 * allowed for these topics.
 */
export function isSensitiveTopic(topic: SensitiveTopic): boolean {
  return topic !== "none";
}
