/**
 * AEGIS v4.0 Faz 4 — Semantic Positional Watermarking, ortak tipler.
 *
 * Tüm semantic alt-modülleri bu yüzeyi paylaşır. Üretim API'sine doğrudan
 * serileştirilir → genişletme yapılırsa OpenAPI şeması da güncellenmelidir.
 */

import type { SensitiveTopic } from "../sensitiveTopic.js";

export const SEMANTIC_PLAN_VERSION = "v4-semanticpos-1" as const;
export const SEMANTIC_KEY_INFO = "aegis-semanticpos-v1" as const;

/** Hill-climb sırasında bir cümle için seçilen perturbation operatörleri. */
export type SemanticOpName = "punctuation" | "casing";

/** Coverage altı veya hassas konu nedeniyle atlanan cümleler için reason. */
export type SemanticSkipReason =
  | "coverage_below_threshold"
  | "sentence_too_short"
  | "no_variants_applicable"
  | "sensitive_topic";

export interface SemanticPositionalEntry {
  /** Cümle indeksi (0-based, plan içinde sıralı). */
  idx: number;
  /** Cümlenin SHA-256 hash'i (alignment doğrulaması için). */
  originalHash: string;
  /**
   * Cümlenin normalize edilmiş hali — verify aşamasında lexical Jaccard
   * (orjinal vs paraphrase) hesaplamak için tutulur. Hassas konu skip
   * olduğunda boş string olabilir.
   */
  originalNormalized: string;
  /** Watermark bu cümleye uygulandı mı? false → skip, opsApplied boş. */
  watermarked: boolean;
  /** 0 veya 1 — embed sırasında hedeflenen bit. Skip durumunda undefined. */
  targetBit?: 0 | 1;
  /**
   * Bucket sınırı: variants içinde score-medyanı. Verify aşamasında suspect
   * score bu eşikle karşılaştırılarak observedBit hesaplanır.
   */
  decisionThreshold?: number;
  /** Embed sırasındaki |chosen_score - threshold| (büyük → daha dirençli). */
  marginAtCloak?: number;
  /** Uygulanan operatörler (skip durumunda boş). */
  opsApplied?: SemanticOpName[];
  /** Skip nedeni (varsa). */
  skipReason?: SemanticSkipReason;
}

export interface SemanticPositionalPlan {
  version: typeof SEMANTIC_PLAN_VERSION;
  info: typeof SEMANTIC_KEY_INFO;
  clientId: string;
  docId: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  totalSentences: number;
  watermarkedSentences: number;
  skippedSentences: number;
  /** Detect edilen hassas konu — "none" hariç embed tamamen atlanır. */
  sensitiveTopic: SensitiveTopic;
  /** True → sensitive_topic ban, hiçbir cümleye watermark uygulanmadı. */
  sensitiveSkip: boolean;
  entries: SemanticPositionalEntry[];
}

export interface SemanticEmbedOptions {
  secret: string;
  clientId: string;
  docId: string;
}

export interface SemanticEmbedMetrics {
  totalSentences: number;
  watermarkedSentences: number;
  /** watermarkedSentences / totalSentences. */
  watermarkRate: number;
  embedTimeMs: number;
  /**
   * Modelin ilk yüklenme süresi. 0 ise model zaten süreçte yüklüydü.
   * Sürecin ilk cloak çağrısında > 0 değer alır.
   */
  coldStartMs: number;
  sensitiveSkip: boolean;
}

export interface SemanticEmbedResult {
  markedText: string;
  plan: SemanticPositionalPlan;
  metrics: SemanticEmbedMetrics;
}

export interface SemanticVerifyOptions {
  secret: string;
}

export interface SemanticPerSentenceResult {
  idx: number;
  /** Plan'dan gelen targetBit (skip ise undefined → satır verify'e dahil değil). */
  targetBit: 0 | 1;
  observedBit: 0 | 1;
  matched: boolean;
  /** suspect score - decisionThreshold (büyük → güçlü gözlem). */
  suspectMargin: number;
  /** Bu cümle için Jaccard(orijinal tokens, suspect tokens). */
  lexicalJaccard: number;
}

export interface SemanticVerifyResult {
  /** signalScore = 1 - p_value (Binomial, p=0.5). [0,1]. */
  signalScore: number;
  /** k = eşleşen bit sayısı. */
  matchedBits: number;
  /** n = verify edilebilen watermark'lı cümle sayısı. */
  totalBits: number;
  /** P(X ≥ k | n, p=0.5). */
  pValue: number;
  /** perSentence Jaccard'ların ortalaması. */
  lexicalOverlap: number;
  /**
   * "Adli Tıp Seviyesinde" paraphrase uyarısı: signalScore yüksek (≥0.70)
   * AMA lexicalOverlap düşük (≤0.50). Yani anlamsal mühür hayatta ama
   * yüzeysel kelimeler büyük ölçüde değişmiş → sadık paraphrase saldırısı.
   */
  forensicParaphraseWarning: boolean;
  perSentence: SemanticPerSentenceResult[];
  verifyTimeMs: number;
  /** Plan'a göre kaç cümle aligned bulundu (suspect ≥ plan ise = plan watermarked). */
  alignedSentences: number;
}
