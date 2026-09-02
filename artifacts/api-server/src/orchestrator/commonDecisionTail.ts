/**
 * AEGIS Orchestrator — Ortak Karar Kuyruğu (commonDecisionTail)
 * ─────────────────────────────────────────────────────────────────────
 * Modüllerin (video / image / text) ham decode sonuçlarından sonra
 * çalışan TEK YER. Mevcut karar zincirini DEĞİŞTİRMEZ; aşağıdaki
 * yapısal sözleşmeyi yalnız RAPOR olarak üretir:
 *
 *   1. confirmed   = (ID decoded) AND (ID matched)     — KESİN
 *   2. candidate   = 0..1 destekleyici skor (ID yoksa) — ADVISORY
 *   3. dnaUsageStatus = DNA'nın bu kararda ne için kullanıldığı (insan-okuru)
 *
 * KIRMIZI ÇİZGİ:
 *  - Bu helper YENİ bir VAULT kapısı AÇMAZ.
 *  - `result.aggregatedVault` ve mevcut modül karar alanları DEĞİŞMEZ.
 *  - Final `confirmed` yalnız (decodedIdHex !== null) AND (decodedIdHex === expectedIdHex) ise true.
 *  - DNA / aday skor / T6 / kurtarma ipucu confirmed üretemez (compartments
 *    sözleşmesi `assertCompartmentAuthority` ile beraber).
 *  - lib/aegis-core'a dokunmaz; saf okuma + projection.
 */

import {
  evaluateConfirmedDecision,
  buildCandidateConfidence,
  assertCompartmentAuthority,
  type DnaConfirmedDecision,
  type DnaCandidateConfidence,
  type DnaCandidateConfidenceContributors,
} from "@workspace/aegis-core";

import type { EvidenceItem } from "./evidenceChain.js";
import type { ActiveModuleEntry } from "./detectActiveModules.js";

export type DnaUsageStatusKind =
  | "record_only"
  | "record_and_advisory_search_hint"
  | "record_and_common_decision_tail"
  | "not_available";

export interface DnaUsageStatus {
  kind: DnaUsageStatusKind;
  /** İnsan-okuru açıklama. */
  description: string;
  /** Bu kararda DNA okundu mu? */
  dnaRead: boolean;
  /** DNA report bulundu mu? */
  dnaReportFound: boolean;
  /** Overlap uyarısı sayısı (varsa). */
  dnaOverlapWarnings: number;
}

export interface OrchestratorDecision {
  confirmed: DnaConfirmedDecision;
  candidateConfidence: DnaCandidateConfidence;
  /** Hangi evidence katmanları FOUND verdi? (insan-okuru özet) */
  foundLayers: ReadonlyArray<string>;
  /** Hangi evidence katmanları idMatch verdi? */
  idMatchedLayers: ReadonlyArray<string>;
  /** Karar zincirine etkimedi notu (sabit). */
  authority:
    "report_only_no_new_vault_gate";
  /** İnsan-okuru karar kuralı. */
  rule:
    "confirmed = ANY(evidence.idMatch=true AND evidence.found=true). candidateConfidence ADVISORY only. orchestrator NEVER creates a new vault gate; existing module gates remain authoritative.";
}

export interface CommonDecisionTailInput {
  /** Aktif modüller — detectActiveModules çıktısı. */
  activeModules: ReadonlyArray<ActiveModuleEntry>;
  /** Tüm modüllerden gelen ortak delil listesi. */
  evidence: ReadonlyArray<EvidenceItem>;
  /** Caller'ın iddia ettiği ID (varsa, modüle-özgü normalize edilmiş hex). */
  expectedIdHex: string | null;
  /** Mühürden okunan ID — caller önceden hesaplar. Yoksa null. */
  decodedIdHex: string | null;
  /** DNA'nın bu kararda durumu. */
  dnaUsage: DnaUsageStatus;
}

export interface CommonDecisionTailOutput {
  orchestratorDecision: OrchestratorDecision;
  dnaUsageStatus: DnaUsageStatus;
}

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

export function commonDecisionTail(
  input: CommonDecisionTailInput,
): CommonDecisionTailOutput {
  // ─── Seviye 1 — Confirmed kapısı ──────────────────────────────────
  // Yalnız ID match → confirmed. Hiçbir DNA / candidate / T6 sinyali
  // confirmed üretemez. assertCompartmentAuthority ile yetki sözleşmesi
  // RUNTIME'da da çalışır (compartments.ts sözleşmesinin ilk gerçek
  // tüketim noktası).
  assertCompartmentAuthority("candidateSignals", "candidateSignals");
  assertCompartmentAuthority("recoveryHints", "recoveryHints");
  assertCompartmentAuthority("comparison", "comparison");

  const confirmed = evaluateConfirmedDecision({
    decodedIdHex: input.decodedIdHex,
    expectedIdHex: input.expectedIdHex,
  });

  // ─── Seviye 2 — Candidate confidence ──────────────────────────────
  // Yalnız ID match YOKSA aday skor üretilir. ID match varsa skor sıfır
  // (confirmed zaten KESİN).
  const contributors: DnaCandidateConfidenceContributors = confirmed.matched
    ? {}
    : aggregateContributors(input.evidence);
  const candidateConfidence = buildCandidateConfidence(contributors);

  // ─── Evidence özet (insan-okuru) ──────────────────────────────────
  const foundLayers = input.evidence
    .filter((e) => e.found)
    .map((e) => e.layerId);
  const idMatchedLayers = input.evidence
    .filter((e) => e.idMatch)
    .map((e) => e.layerId);

  const orchestratorDecision: OrchestratorDecision = {
    confirmed,
    candidateConfidence,
    foundLayers,
    idMatchedLayers,
    authority: "report_only_no_new_vault_gate",
    rule:
      "confirmed = ANY(evidence.idMatch=true AND evidence.found=true). candidateConfidence ADVISORY only. orchestrator NEVER creates a new vault gate; existing module gates remain authoritative.",
  };

  return {
    orchestratorDecision,
    dnaUsageStatus: input.dnaUsage,
  };
}

function aggregateContributors(
  evidence: ReadonlyArray<EvidenceItem>,
): DnaCandidateConfidenceContributors {
  if (evidence.length === 0) return {};
  // En yüksek candidate skor + ortalama
  let maxScore = 0;
  let sum = 0;
  for (const e of evidence) {
    const s = clamp01(e.candidateScore);
    sum += s;
    if (s > maxScore) maxScore = s;
  }
  const avg = sum / evidence.length;
  // Birden fazla modülde sinyal varsa cross-module consistency artar.
  const distinctModules = new Set(evidence.map((e) => e.mediaType)).size;
  const cross = distinctModules >= 2 ? Math.min(1, distinctModules * 0.4) : 0;
  return {
    layerSignals: maxScore,
    sealMapMatch: avg,
    crossModuleConsistency: cross,
  };
}
