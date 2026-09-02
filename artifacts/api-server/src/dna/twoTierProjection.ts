import {
  evaluateConfirmedDecision,
  buildCandidateConfidence,
  type DnaConfirmedDecision,
  type DnaCandidateConfidence,
  type DnaCandidateConfidenceContributors,
} from "@workspace/aegis-core";

/**
 * v0.7.1 — Response-level iki seviyeli karar projeksiyonu.
 *
 * **Bu helper ana karar zincirini DEĞİŞTİRMEZ.** Yalnız mevcut karar
 * çıktısını v0.7.0 yapısal sözleşmesine göre RAPORLAR:
 *   (1) `confirmed`         — ID decoded AND ID matched (KESİN)
 *   (2) `candidateConfidence` — ID yoksa/uyuşmazsa 0..1 ADAY skor
 *
 * Caller'a düşen:
 *  - `decodedIdHex`: gerçekten decode edilmiş ID (varsa) — string ya da null.
 *  - `expectedIdHex`: sistemdeki beklenen ID — string ya da null.
 *  - `candidateContributors`: ID yoksa/uyuşmazsa aday skoru üreten alanlar.
 *
 * İki seviye asla birbirinden veri almaz. Mevcut `found / VAULT / verdict`
 * sonucu DEĞİŞMEZ — caller bunları kendi alanlarında raporlamaya devam eder.
 */
export interface TwoTierDecisionProjection {
  confirmed: DnaConfirmedDecision;
  candidateConfidence: DnaCandidateConfidence;
  notes: string;
}

const ADDITIVE_NOTE =
  "v0.7.1 additive projection — ana karar (found/VAULT/verdict) DEĞİŞMEDİ. " +
  "confirmed yalnız ID decoded AND ID matched; candidateConfidence yalnız " +
  "ID yoksa/uyuşmazsa 0..1 aday skor (neverFinal).";

export function projectTwoTierDecision(input: {
  decodedIdHex: string | null;
  expectedIdHex: string | null;
  candidateContributors?: DnaCandidateConfidenceContributors;
}): TwoTierDecisionProjection {
  const confirmed = evaluateConfirmedDecision({
    decodedIdHex: input.decodedIdHex,
    expectedIdHex: input.expectedIdHex,
  });
  // ID match varsa aday skoru rapor etmeye gerek yok (ama yine de tip
  // bütünlüğü için sıfır/none döneriz — confirmed alanı zaten ayrı).
  const contributors = confirmed.matched
    ? {}
    : (input.candidateContributors ?? {});
  const candidateConfidence = buildCandidateConfidence(contributors);
  return { confirmed, candidateConfidence, notes: ADDITIVE_NOTE };
}
