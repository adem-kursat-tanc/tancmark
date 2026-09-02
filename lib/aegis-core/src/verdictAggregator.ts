/**
 * Tiered Verdict Aggregator — AEGIS v4.0 "Sentient Fortress" Faz 3.
 *
 * Channel Integrity Profile'ı tüketip kademeli karar üretir:
 *
 *   STRONG       — T0 = 1 (honeytoken)
 *               OR ≥2 T1 kanalı ≥ 0.70
 *               OR (bir T1 ≥ 0.80) AND (T2 ≥ 0.70)
 *   AMBIGUOUS   — STRONG değil ama ≥1 kanal ≥ 0.50
 *   INSUFFICIENT — Tüm T0/T1/T2 kanalları < 0.50
 *
 * GÜVENLİK KORUMALARI:
 *
 *   • Margin Guard: STRONG kararı sadece çok-aday senaryolarda anlamlı.
 *     Best aday vs runner-up `combinedScore` farkı < 0.20 ise STRONG
 *     kararı AMBIGUOUS'a düşer (yanlış suçlama önleyici).
 *
 *   • Multi-suspect Demote: ≥2 aday STRONG eşiğini geçerse karar
 *     AMBIGUOUS'a düşer. T0 (honeytoken) bu kuralın istisnasıdır:
 *     decisive evidence olduğunda multi-suspect listesi raporlanır
 *     ama verdict yine STRONG kalır (çoklu suçüstü mümkündür ve T0
 *     kanal modeli zaten "doğrudan suçüstü" semantiğine sahiptir).
 *
 *   • Cascade Hash AUX: integrityScore ne olursa olsun verdict'e
 *     dokunmaz. Sadece raporda görünür.
 *
 * KRİTİK: Bu modül saf fonksiyon. Side effect yok. Aynı input → aynı
 * output. Verdict ladder regresyonları bu garantiye dayanır.
 */

import {
  CHANNEL_TIER_MAP,
  indexProfiles,
  type ChannelName,
  type ChannelProfile,
} from "./channelIntegrity.js";

export const TIERED_VERDICTS = ["STRONG", "AMBIGUOUS", "INSUFFICIENT"] as const;
export type TieredVerdict = (typeof TIERED_VERDICTS)[number];

/** STRONG kararı için minimum eşikler. */
export const VERDICT_THRESHOLDS = {
  /** T1 ≥ X olan en az 2 kanal. */
  T1_PAIR_MIN: 0.7,
  /** Tek T1 ≥ X + T2 ≥ Y kombinasyonu. */
  T1_SOLO_MIN: 0.8,
  T2_PAIR_MIN: 0.7,
  /** AMBIGUOUS sınırı — herhangi bir T0/T1/T2 kanalı bu eşiği geçmeli. */
  AMBIGUOUS_FLOOR: 0.5,
  /** Margin Guard — best vs runner-up combinedScore farkı. */
  MARGIN_MIN: 0.2,
} as const;

export interface AggregatorCandidate {
  clientId: string;
  /**
   * Kanal profili (per-candidate). Cascade kanalı en fazla 1 candidate için
   * anlamlı (genellikle best); diğerlerinde AUX present=false geçilebilir.
   */
  profile: ChannelProfile[];
  /**
   * Multi-channel weighted combined skor — Margin Guard hesabında kullanılır.
   * `analyzeTextMultiChannel.combinedScore` doğrudan geçirilebilir.
   */
  combinedScore: number;
}

export interface AggregateInput {
  /** Aday listesi, en yüksek combinedScore'lu önce geleceğine güvenme; aggregator yeniden sıralar. */
  candidates: ReadonlyArray<AggregatorCandidate>;
  /**
   * Decisive honeytoken evidence varsa (route honeytoken short-circuit'ünde
   * üretilir), karar otomatik STRONG. Aday clientId'leri burada listelenir.
   * Boş array veya undefined → honeytoken yolu pasif.
   */
  decisiveHoneytokenClients?: ReadonlyArray<string>;
}

export interface AggregateResult {
  verdict: TieredVerdict;
  /**
   * Verdict'i ÜRETEN aday(lar). STRONG için tek aday (multi-suspect demote
   * sonrası); AMBIGUOUS için top aday(lar); INSUFFICIENT için en yüksek
   * combinedScore aday (varsa) veya boş.
   */
  attributedClientIds: string[];
  /** Verdict gerekçeleri — UI/PDF "Neden bu karar?" listesi. */
  reasons: string[];
  /** Margin Guard tatbik edildi (STRONG → AMBIGUOUS) mu? */
  marginGuardDemoted: boolean;
  /** Multi-suspect demote tatbik edildi (STRONG → AMBIGUOUS) mu? */
  multiSuspectDemoted: boolean;
  /** Margin değeri (best - runnerUp.combinedScore); aday sayısı 1 ise null. */
  margin: number | null;
  /** STRONG eşiğini geçen aday sayısı. */
  strongCandidateCount: number;
  /** Per-candidate per-channel kısa snapshot (audit log için). */
  candidateSummaries: Array<{
    clientId: string;
    combinedScore: number;
    channelScores: Record<ChannelName, number>;
    passesStrong: boolean;
  }>;
}

/** Tek aday için STRONG eşiklerini değerlendir. */
function candidatePassesStrong(profile: ReadonlyArray<ChannelProfile>): {
  passes: boolean;
  reason: string;
} {
  const idx = indexProfiles(profile);
  // T0 — honeytoken doğrudan kazandırır.
  const t0 = idx.get("honeytoken");
  if (t0 && t0.score >= 1) {
    return { passes: true, reason: "T0: honeytoken doğrudan suçüstü" };
  }
  // T1 — zw + homoglyph.
  const zw = idx.get("zeroWidth");
  const homo = idx.get("homoglyph");
  const t1Strong: ChannelName[] = [];
  if (zw && zw.present && zw.score >= VERDICT_THRESHOLDS.T1_PAIR_MIN) {
    t1Strong.push("zeroWidth");
  }
  if (homo && homo.present && homo.score >= VERDICT_THRESHOLDS.T1_PAIR_MIN) {
    t1Strong.push("homoglyph");
  }
  if (t1Strong.length >= 2) {
    return {
      passes: true,
      reason: `≥2 T1 kanalı ≥ ${VERDICT_THRESHOLDS.T1_PAIR_MIN} (${t1Strong.join("+")})`,
    };
  }
  // T1 ≥ 0.80 AND T2 ≥ 0.70 kombinasyonu.
  const t2 = idx.get("linguisticDna");
  const t1Solo: ChannelName | null =
    zw && zw.present && zw.score >= VERDICT_THRESHOLDS.T1_SOLO_MIN
      ? "zeroWidth"
      : homo && homo.present && homo.score >= VERDICT_THRESHOLDS.T1_SOLO_MIN
        ? "homoglyph"
        : null;
  if (
    t1Solo &&
    t2 &&
    t2.present &&
    t2.score >= VERDICT_THRESHOLDS.T2_PAIR_MIN
  ) {
    return {
      passes: true,
      reason: `T1 ${t1Solo} ≥ ${VERDICT_THRESHOLDS.T1_SOLO_MIN} + T2 linguisticDna ≥ ${VERDICT_THRESHOLDS.T2_PAIR_MIN}`,
    };
  }
  return { passes: false, reason: "" };
}

/** Tek aday için ≥1 kanal AMBIGUOUS_FLOOR'u geçti mi? (T0/T1/T2 only) */
function candidatePassesAmbiguous(
  profile: ReadonlyArray<ChannelProfile>,
): boolean {
  for (const p of profile) {
    if (CHANNEL_TIER_MAP[p.name] === "AUX") continue;
    if (!p.present) continue;
    if (p.score >= VERDICT_THRESHOLDS.AMBIGUOUS_FLOOR) return true;
  }
  return false;
}

function channelScoreMap(
  profile: ReadonlyArray<ChannelProfile>,
): Record<ChannelName, number> {
  const m: Record<ChannelName, number> = {
    honeytoken: 0,
    zeroWidth: 0,
    homoglyph: 0,
    linguisticDna: 0,
    semanticPositional: 0,
    cascadeHash: 0,
  };
  for (const p of profile) m[p.name] = p.score;
  return m;
}

/**
 * Tiered verdict üret. Saf fonksiyon — aynı input daima aynı output.
 *
 * Sıralama: best aday `combinedScore desc, clientId asc` ile belirlenir.
 * STRONG kararı margin guard + multi-suspect demote'tan geçer; T0
 * (honeytoken) yolunda multi-suspect istisnası uygulanır.
 */
export function aggregateTieredVerdict(input: AggregateInput): AggregateResult {
  // T0 decisive set'i ÇİFT-KAYNAKLI: hem route'tan geçen
  // `decisiveHoneytokenClients` listesi, hem de profil içinde T0 (honeytoken)
  // kanalı set olmuş adaylar. Bu hardening, future-callers'ın yalnızca profil
  // gönderip listeyi atlamasını güvenli kılar — tek-kaynak bağımlılığı yok.
  const decisive = new Set<string>(input.decisiveHoneytokenClients ?? []);
  for (const c of input.candidates) {
    const t0 = c.profile.find((p) => p.name === "honeytoken");
    if (t0 && t0.present && t0.score >= 1) {
      decisive.add(c.clientId);
    }
  }
  const sorted = [...input.candidates].sort((a, b) => {
    if (b.combinedScore !== a.combinedScore) return b.combinedScore - a.combinedScore;
    return a.clientId.localeCompare(b.clientId);
  });

  const summaries = sorted.map((c) => {
    const ps = candidatePassesStrong(c.profile);
    return {
      clientId: c.clientId,
      combinedScore: c.combinedScore,
      channelScores: channelScoreMap(c.profile),
      passesStrong: ps.passes,
    };
  });

  // T0 path — honeytoken decisive evidence (route'tan geçen liste).
  // Multi-suspect istisnası: ≥1 decisive client varsa verdict STRONG.
  if (decisive.size > 0) {
    const attributed = sorted
      .map((c) => c.clientId)
      .filter((id) => decisive.has(id));
    const fallback = attributed.length > 0
      ? attributed
      : Array.from(decisive); // explicit cast (decisive ama candidate listesinde yoksa)
    const reasons: string[] = [
      `T0: honeytoken doğrudan suçüstü (${fallback.length} aday)`,
    ];
    if (fallback.length > 1) {
      reasons.push(
        "Çoklu suçüstü — her aday için ayrı T0 kanıtı; verdict T0 istisnası ile STRONG kalır",
      );
    }
    return {
      verdict: "STRONG",
      attributedClientIds: fallback,
      reasons,
      marginGuardDemoted: false,
      multiSuspectDemoted: false,
      margin: null,
      strongCandidateCount: fallback.length,
      candidateSummaries: summaries,
    };
  }

  // STRONG eşiğini geçen aday(lar).
  const strongPassing = sorted.filter(
    (c) => candidatePassesStrong(c.profile).passes,
  );
  const strongCount = strongPassing.length;

  // Verdict pre-guard.
  let verdict: TieredVerdict;
  let attributed: string[] = [];
  const reasons: string[] = [];
  let marginGuardDemoted = false;
  let multiSuspectDemoted = false;

  const best = sorted[0];
  const runnerUp = sorted[1];
  const margin = runnerUp ? best!.combinedScore - runnerUp.combinedScore : null;

  if (strongCount >= 2) {
    // Multi-suspect demote (T0 istisnası yukarıda tüketildi).
    multiSuspectDemoted = true;
    verdict = "AMBIGUOUS";
    attributed = strongPassing.map((c) => c.clientId);
    reasons.push(
      `Multi-suspect demote: ${strongCount} aday STRONG eşiğini geçti → AMBIGUOUS`,
    );
  } else if (strongCount === 1) {
    // Tek STRONG aday var; margin guard kontrol et.
    const candidate = strongPassing[0]!;
    const passes = candidatePassesStrong(candidate.profile);
    if (margin !== null && margin < VERDICT_THRESHOLDS.MARGIN_MIN) {
      marginGuardDemoted = true;
      verdict = "AMBIGUOUS";
      attributed = sorted.slice(0, 2).map((c) => c.clientId);
      reasons.push(
        `Margin Guard demote: best vs runner-up margin ${margin.toFixed(3)} < ${VERDICT_THRESHOLDS.MARGIN_MIN}`,
      );
      reasons.push(
        `(STRONG nedeni saklandı: ${passes.reason})`,
      );
    } else {
      verdict = "STRONG";
      attributed = [candidate.clientId];
      reasons.push(passes.reason);
      if (margin !== null) {
        reasons.push(`Margin OK: ${margin.toFixed(3)} ≥ ${VERDICT_THRESHOLDS.MARGIN_MIN}`);
      } else {
        reasons.push("Tek aday — margin tatbik edilmez");
      }
    }
  } else {
    // STRONG yok. AMBIGUOUS / INSUFFICIENT karar ver.
    const anyAmbiguous = sorted.some((c) => candidatePassesAmbiguous(c.profile));
    if (anyAmbiguous) {
      verdict = "AMBIGUOUS";
      attributed = best ? [best.clientId] : [];
      reasons.push(
        `≥1 kanal ≥ ${VERDICT_THRESHOLDS.AMBIGUOUS_FLOOR} fakat STRONG eşikleri sağlanmadı`,
      );
    } else {
      verdict = "INSUFFICIENT";
      attributed = [];
      reasons.push(
        `Tüm T0/T1/T2 kanalları < ${VERDICT_THRESHOLDS.AMBIGUOUS_FLOOR}`,
      );
    }
  }

  return {
    verdict,
    attributedClientIds: attributed,
    reasons,
    marginGuardDemoted,
    multiSuspectDemoted,
    margin,
    strongCandidateCount: strongCount,
    candidateSummaries: summaries,
  };
}
