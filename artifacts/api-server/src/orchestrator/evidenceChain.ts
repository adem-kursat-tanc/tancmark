/**
 * AEGIS Orchestrator — Ortak Delil Zinciri (saf transformer)
 * ─────────────────────────────────────────────────────────────────────
 * Video / görsel / metin modüllerinin ham karar sonuçlarını ortak bir
 * `EvidenceItem[]` listesine çevirir. **Karar üretmez.** Yalnız raporlama
 * için yapısal birleştirme yapar.
 *
 * Ana kurallar:
 *  - Bir modülün `found=true` üretmesi için MEVCUT karar kapıları geçmiş
 *    olmalı (örn video aggregatedVault, text verdict=STRONG, image
 *    visualVaultConfirmed). Bu helper o kapıları YENİDEN HESAPLAMAZ;
 *    caller bayrak olarak verir.
 *  - `idMatch` ayrı bir alan — yalnız mühürden çıkan ID sistemdeki
 *    beklenen ID ile eşleşirse true. confirmed kuralının girdisi.
 *  - `candidateScore` 0..1 ADAY destek; asla `found`/`idMatch` üretemez.
 *  - `vaultProof` opsiyonel insan-okuru kanıt etiketi (örn "aggregatedVault",
 *    "verdict=STRONG", "visualVaultConfirmed").
 *
 * KIRMIZI ÇİZGİ:
 *  - lib/aegis-core'a dokunmaz, modüllerin karar bloğunu değiştirmez.
 */

import type { AegisModuleKind } from "./detectActiveModules.js";

export interface EvidenceItem {
  /** Modülün benzersiz katman ID'si (örn "video.tripleShield", "image.l2-l3"). */
  layerId: string;
  mediaType: AegisModuleKind;
  /** Modülün KENDİ karar kapısı geçildi mi? (mevcut gate'in sonucu, helper YENİDEN HESAPLAMAZ). */
  found: boolean;
  /** Decoded ID === Expected ID mi? (confirmed kararına girdi). */
  idMatch: boolean;
  /** 0..1 aday destek skoru (ADVISORY — confirmed üretemez). */
  candidateScore: number;
  /** Kanıt etiketi (insan-okuru, örn "aggregatedVault=true"). */
  vaultProof?: string;
  /** Uyarılar (overlap, low-signal, vb). */
  warnings?: ReadonlyArray<string>;
  /** Modülün ham telemetrisi (debug için, opsiyonel). */
  telemetry?: Record<string, unknown>;
}

export interface VideoEvidenceInput {
  /** decodeVideo result'ından `aggregatedVault`. */
  aggregatedVault: boolean;
  vaultFrames: number;
  strongFrames: number;
  /** Mühürden okunan ID (varsa). decodeVideo `idHex` alanı. */
  decodedIdHex: string | null;
  /** Beklenen ID — caller'ın iddia ettiği (normalize edilmiş hex). */
  expectedIdHex: string | null;
  /** T6 telemetry (varsa). verdict yalnız T6_VAULT/T6_CANDIDATE/T6_NONE. */
  t6Verdict?: string | null;
  /** DNA overlap uyarıları (detectLayerOverlap çıktısı). */
  dnaOverlapWarnings?: ReadonlyArray<unknown>;
}

export interface ImageEvidenceInput {
  /** Visual route'unun karar kapısı sonucu (örn `visualVaultConfirmed`). */
  vaultConfirmed: boolean;
  decodedIdHex: string | null;
  expectedIdHex: string | null;
  /** Opsiyonel ekstra telemetri. */
  extra?: Record<string, unknown>;
}

export interface TextEvidenceInput {
  /** verdict ladder sonucu STRONG ise true. */
  strongVerdict: boolean;
  decodedCloakId: string | null;
  expectedCloakId: string | null;
  extra?: Record<string, unknown>;
}

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

const idsMatch = (a: string | null, b: string | null): boolean =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length > 0 &&
  a.toLowerCase() === b.toLowerCase();

/** Video decode sonucundan tek ana evidence item. Karar YENİDEN HESAPLANMAZ. */
export function videoToEvidence(input: VideoEvidenceInput): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const warnings: string[] = [];
  if (input.dnaOverlapWarnings && input.dnaOverlapWarnings.length > 0) {
    warnings.push(
      `dna_overlap_warnings=${input.dnaOverlapWarnings.length}`,
    );
  }

  const main: EvidenceItem = {
    layerId: "video.tripleShield",
    mediaType: "video",
    found: input.aggregatedVault === true,
    idMatch: idsMatch(input.decodedIdHex, input.expectedIdHex),
    // Strong frame oranı 30 frame üstünden normalize — yalnız aday skor.
    candidateScore: clamp01(
      0.6 * Math.min(1, input.vaultFrames / 5) +
        0.4 * Math.min(1, input.strongFrames / 30),
    ),
    vaultProof: input.aggregatedVault
      ? `aggregatedVault=true vaultFrames=${input.vaultFrames}`
      : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    telemetry: {
      vaultFrames: input.vaultFrames,
      strongFrames: input.strongFrames,
    },
  };
  items.push(main);

  // T6 yalnız ADAY/destek katmanı; FOUND üretemez (T6_VAULT bile orchestrator
  // tarafından final FOUND'a YÜKSELTİLMEZ — yalnız T6'nın kendi sıkı gate'i
  // decodeVideo içinde çalışır; burası rapor).
  if (input.t6Verdict && input.t6Verdict !== "T6_NONE") {
    const isVault = input.t6Verdict === "T6_VAULT";
    items.push({
      layerId: "video.t6.lowBand",
      mediaType: "video",
      // Orchestrator T6_VAULT'u BİLE found=true yapmaz — kullanıcı kuralı:
      // "Yeni vault kapısı ekleme yok". T6 verdict raporlamada bağımsız döner.
      found: false,
      idMatch: false,
      candidateScore: isVault ? 0.6 : 0.3,
      vaultProof: undefined,
      telemetry: { t6Verdict: input.t6Verdict },
    });
  }

  return items;
}

export function imageToEvidence(input: ImageEvidenceInput): EvidenceItem[] {
  return [
    {
      layerId: "image.visualVault",
      mediaType: "image",
      found: input.vaultConfirmed === true,
      idMatch: idsMatch(input.decodedIdHex, input.expectedIdHex),
      candidateScore: input.vaultConfirmed ? 1 : 0,
      vaultProof: input.vaultConfirmed ? "visualVaultConfirmed=true" : undefined,
      telemetry: input.extra,
    },
  ];
}

export function textToEvidence(input: TextEvidenceInput): EvidenceItem[] {
  return [
    {
      layerId: "text.cloak",
      mediaType: "text",
      found: input.strongVerdict === true,
      idMatch: idsMatch(input.decodedCloakId, input.expectedCloakId),
      candidateScore: input.strongVerdict ? 1 : 0,
      vaultProof: input.strongVerdict ? "verdict=STRONG" : undefined,
      telemetry: input.extra,
    },
  ];
}

/** Tüm modül evidence'larını tek listede birleştir. */
export function mergeEvidence(
  ...lists: ReadonlyArray<ReadonlyArray<EvidenceItem>>
): EvidenceItem[] {
  return lists.flatMap((l) => [...l]);
}
