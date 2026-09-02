/**
 * Channel Integrity Profile — AEGIS v4.0 "Sentient Fortress" Faz 3.
 *
 * Her kanıt kanalını dayanıklılığına ve atfetme gücüne göre Tier'lara
 * sınıflandırır. Tiered Verdict Aggregator buradaki profili tüketir.
 *
 * Tier semantiği:
 *   T0 (Decisive)      — Honeytoken. Doğrudan suçüstü, kanıt 0/1.
 *   T1 (Strong)        — Zero-Width Steganography, Homoglyph. Carrier
 *                        steganografisi; sıyırma/normalize zor, sayısal
 *                        skor (0..1) doğrudan atfetme gücüdür.
 *   T2 (Collaborator)  — Linguistic DNA (synonym channel). Stilometrik
 *                        örüntü; doğal yazımda da kısmen oluşabildiği için
 *                        tek başına yetmez, T1 ile birlikte STRONG'a
 *                        katkı verir.
 *   AUX (Auxiliary)    — Cascade Hash bütünlüğü. Yapısal manipülasyon
 *                        haritası; verdict'e GİRMEZ, sadece raporlanır.
 *
 * Decay metric: `decay = 1 - score` — bir kanalın teorik maksimumdan ne
 * kadar uzaklaştığını gösterir (1.0 = tamamen yıkılmış, 0.0 = pristine).
 * "Vital" bayrağı kanal STRONG eşiğini (T1 için 0.70, T2 için 0.70)
 * geçtiğinde set edilir → PDF rapor görsel vurguda kullanır.
 *
 * KRİTİK: Bu modül **saf veri dönüşümü** yapar. Side effect yok, DB
 * erişimi yok, sinyal emit etmez. Aggregator deterministik kalsın diye.
 */

export const CHANNEL_TIERS = ["T0", "T1", "T2", "AUX"] as const;
export type ChannelTier = (typeof CHANNEL_TIERS)[number];

export const CHANNEL_NAMES = [
  "honeytoken",
  "zeroWidth",
  "homoglyph",
  "linguisticDna",
  "semanticPositional",
  "cascadeHash",
] as const;
export type ChannelName = (typeof CHANNEL_NAMES)[number];

/** Tier eşiği — bir kanalın kendi başına "vital" (güçlü) sayılması için. */
export const VITAL_THRESHOLDS: Record<ChannelTier, number> = {
  T0: 1.0, // honeytoken yes/no
  T1: 0.7,
  T2: 0.7,
  AUX: 1.0, // auxiliary kanallar verdict eşiği taşımaz
};

/** Kanal → tier eşlemesi. Aggregator bu haritaya göre kuralları uygular. */
export const CHANNEL_TIER_MAP: Record<ChannelName, ChannelTier> = {
  honeytoken: "T0",
  zeroWidth: "T1",
  homoglyph: "T1",
  linguisticDna: "T2",
  semanticPositional: "T2",
  cascadeHash: "AUX",
};

export interface ChannelProfile {
  /** Kanonik kanal adı. */
  name: ChannelName;
  /** Sınıflandırma tier'ı. */
  tier: ChannelTier;
  /** [0,1] aralığında normalize skor. T0 için 0/1. */
  score: number;
  /** 1 - score. Görsel decay raporu için. */
  decay: number;
  /** Bu kanal kendi tier eşiğini geçti mi? */
  vital: boolean;
  /** Kanal mevcutsa true (ZW frame yok, kanal "yok" sayılır). */
  present: boolean;
  /** İnsan-okur kısa not (PDF/UI için). */
  note?: string;
}

export interface BuildProfileInput {
  honeytokenHit: boolean;
  zeroWidth: { score: number; present: boolean };
  homoglyph: { score: number; present?: boolean };
  linguisticDna: { score: number; present?: boolean };
  /**
   * Faz 4 — Semantic Positional Watermarking signal. T2 corroborator.
   * Verilmezse kanal `present=false`. score = `1 - p_value` (Binomial test);
   * tek başına STRONG kararı vermez (aggregator'daki R2 kuralı sadece
   * `linguisticDna`'yı T2 olarak sayar — bu tasarım gereği).
   */
  semanticPositional?: { score: number; present?: boolean; note?: string } | null;
  /**
   * Cascade Hash auxiliary; verilmezse kanal `present=false`. integrityScore
   * 1.0 = pristine, 0.0 = tamamen bozulmuş. Verdict'e girmez.
   */
  cascade?: { integrityScore: number } | null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function profile(
  name: ChannelName,
  rawScore: number,
  present: boolean,
  note?: string,
): ChannelProfile {
  const score = clamp01(rawScore);
  const tier = CHANNEL_TIER_MAP[name];
  const vital = present && score >= VITAL_THRESHOLDS[tier];
  const out: ChannelProfile = {
    name,
    tier,
    score,
    decay: clamp01(1 - score),
    vital,
    present,
  };
  if (note !== undefined) out.note = note;
  return out;
}

/**
 * Multi-channel result + honeytoken state'inden tek bir profil dizisi üret.
 * Sıralama deterministik: T0 → T1 (zw, homo) → T2 → AUX. Bu sıra PDF/UI'de
 * stable kolon düzeni sağlar.
 */
export function buildChannelProfile(input: BuildProfileInput): ChannelProfile[] {
  const profiles: ChannelProfile[] = [];

  // T0 — Honeytoken (decisive, 0/1).
  profiles.push(
    profile(
      "honeytoken",
      input.honeytokenHit ? 1 : 0,
      true,
      input.honeytokenHit ? "Doğrudan suçüstü" : "Tetiklenmedi",
    ),
  );

  // T1 — Zero-Width.
  profiles.push(
    profile(
      "zeroWidth",
      input.zeroWidth.score,
      input.zeroWidth.present,
      input.zeroWidth.present ? "ZW frame mevcut" : "ZW frame silinmiş",
    ),
  );

  // T1 — Homoglyph.
  profiles.push(
    profile(
      "homoglyph",
      input.homoglyph.score,
      input.homoglyph.present !== false,
    ),
  );

  // T2 — Linguistic DNA (synonym channel).
  profiles.push(
    profile(
      "linguisticDna",
      input.linguisticDna.score,
      input.linguisticDna.present !== false,
    ),
  );

  // T2 — Semantic Positional (Faz 4). Corroborator; STRONG kuralına
  // GİRMEZ (R2 sadece linguisticDna'yı T2 olarak değerlendirir). Sadece
  // AMBIGUOUS_FLOOR'a katkı verir → "tek başına STRONG yapamaz" garantisi.
  if (input.semanticPositional) {
    profiles.push(
      profile(
        "semanticPositional",
        input.semanticPositional.score,
        input.semanticPositional.present !== false,
        input.semanticPositional.note,
      ),
    );
  } else {
    profiles.push(
      profile("semanticPositional", 0, false, "Plan bulunamadı"),
    );
  }

  // AUX — Cascade Hash. Yardımcı kanıt; verdict'e girmez.
  if (input.cascade) {
    profiles.push(
      profile(
        "cascadeHash",
        input.cascade.integrityScore,
        true,
        "Yardımcı (verdict dışı)",
      ),
    );
  } else {
    profiles.push(
      profile("cascadeHash", 0, false, "Cascade ref verilmedi"),
    );
  }

  return profiles;
}

/** Profil dizisini kanal-adına göre hızlı arama Map'i. */
export function indexProfiles(
  profiles: ReadonlyArray<ChannelProfile>,
): Map<ChannelName, ChannelProfile> {
  const m = new Map<ChannelName, ChannelProfile>();
  for (const p of profiles) m.set(p.name, p);
  return m;
}
