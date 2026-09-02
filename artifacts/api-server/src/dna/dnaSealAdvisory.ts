/**
 * AEGIS DNA — Seal Advisory (Faz 1 İSKELET, davranış değiştirmez)
 * ─────────────────────────────────────────────────────────────────────
 * Bu dosya **sadece tip + read-only advisory builder** sağlar. Hiçbir mevcut karar
 * davranışını DEĞİŞTİRMEZ; encode/decode/cloak/visual akışlarına bağlı
 * DEĞİLDİR; sadece ileride opt-in tüketicilerin (L2 guarded_assist)
 * okuyabileceği "danışmanlık" yapı taşlarını tanımlar.
 *
 * KIRMIZI ÇİZGİ:
 *  - encodeVideo / decodeVideo / cloak-text / cloak-image / visual core
 *    DOKUNULMAZ.
 *  - Final VAULT sınırı SABİT: confirmed = ID decoded AND ID matched,
 *    advisory ASLA confirmed üretmez.
 *  - authority alanı SABİT string: "advisory_only_no_seal_gate".
 *  - lib/aegis-core'a bağımlı DEĞİL.
 *  - Bu dosya import edildiğinde dahi yan etki üretmez (saf fonksiyonlar).
 *
 * Seviye merdiveni (sözleşme):
 *   L0 record_only           ← mevcut DNA persist davranışı (değişmez)
 *   L1 advisory_only         ← BU DOSYA (yer rezerve, henüz okunmuyor)
 *   L2 guarded_assist        ← (gelecek, opt-in flag, modül kazanır)
 *   L3 active_decision       ← (gelecek, alt-kararlar)
 *   L4 final_gate_forbidden  ← DNA asla final VAULT kapısı açamaz
 */

import type { AegisModuleKind } from "../orchestrator/detectActiveModules.js";

/** Sabit yetki etiketi — değişmez. */
export const DNA_SEAL_ADVISORY_AUTHORITY = "advisory_only_no_seal_gate" as const;
export type DnaSealAdvisoryAuthority = typeof DNA_SEAL_ADVISORY_AUTHORITY;

/** Yer önerisi (yeni katman için). */
export interface SuggestedRegion {
  layerId: string;
  kind: "anchor" | "carrier" | "vault";
  /** Görsel/video için kutu; metin için null (token aralığı ayrıca verilir). */
  coords:
    | { kind: "image_box"; x: number; y: number; w: number; h: number }
    | { kind: "video_frame_box"; frameIdx: number; x: number; y: number; w: number; h: number }
    | { kind: "text_span"; startCharOffset: number; endCharOffset: number }
    | null;
  /** 0..1 advisory weight (KARAR ÜRETMEZ). */
  confidence: number;
  rationale: string;
}

/** Başka modülün dokunduğu / ezilmemesi gereken alanlar. */
export interface ReservedZone {
  ownerLayerId: string;
  coords:
    | { kind: "image_box"; x: number; y: number; w: number; h: number }
    | { kind: "video_frame_box"; frameIdx: number; x: number; y: number; w: number; h: number }
    | { kind: "text_span"; startCharOffset: number; endCharOffset: number };
  reason:
    | "occupied_by_main_seal"
    | "vault_region"
    | "sync_markers"
    | "honeytoken_span"
    | "syntax_critical_text_span";
}

/** Asla basılmaması gereken (advisory; modül kararı bağımsız). */
export interface ForbiddenZone {
  coords:
    | { kind: "image_box"; x: number; y: number; w: number; h: number }
    | { kind: "video_frame_box"; frameIdx: number; x: number; y: number; w: number; h: number }
    | { kind: "text_span"; startCharOffset: number; endCharOffset: number };
  reason:
    | "frame_border"
    | "low_substrate"
    | "syntax_critical"
    | "honeytoken_span";
}

/** Modüller-arası çakışma uyarısı. */
export interface ModuleConflictWarning {
  layerA: string;
  layerB: string;
  overlapBytes: number;
  suggestedResolution: "shift_layerB" | "shrink_layerB" | "skip_layerB";
}

/** Video için frame önceliği önerisi (advisory, decode/encode okumuyor). */
export interface RecommendedFrameHint {
  frameIdx: number;
  /** 0..1 (örn substrate richness × scene stability). */
  score: number;
  rationale: string;
  stampedAlready: boolean;
}

/** Video için anchor önerisi (advisory). */
export interface RecommendedAnchorHint {
  frameIdx: number;
  coords: ReadonlyArray<{ x: number; y: number }>;
  /** Beklenen R1 NCC tahmini (ölçülmedi, türetilmiş). */
  expectedNCC: number;
}

/** Sahiplik haritası — hangi bölge hangi modüle ait. */
export interface LayerOwnership {
  layerId: string;
  /** 0..1 frame/dokuman içi piksel/token kapsama oranı. */
  coverage: number;
  primaryFor: AegisModuleKind;
}

/** Arama tarafı için karşılık ipucu (sealAdvisory ↔ searchOrchestrator köprüsü). */
export interface ExpectedSearchHint {
  layerId: string;
  searchRegion:
    | { kind: "image_box"; x: number; y: number; w: number; h: number }
    | { kind: "video_frame_box"; frameIdx: number; x: number; y: number; w: number; h: number }
    | { kind: "text_span"; startCharOffset: number; endCharOffset: number };
  expectedSignalKind: "ncc_peak" | "dct_byte_run" | "cloak_signal";
}

/**
 * AEGIS DNA Seal Advisory — Faz 1 iskelet.
 *
 * Hiçbir karar yetkisi YOKTUR. authority alanı sabit string.
 * Modüller (encodeVideo, cloak-image, cloak-text) bu yapıyı OKUMAZ.
 * Sadece response projeksiyonu (L1) ve gelecek L2 opt-in tüketici içindir.
 */
export interface DnaSealAdvisory {
  /** Sabit yetki etiketi; değişmez. */
  readonly authority: DnaSealAdvisoryAuthority;
  /** Sözleşme notu (insan-okuru). */
  readonly contract:
    "DNA seal advisory L1 (skeleton). DNA does NOT decide placement. Module decisions remain unchanged. Final VAULT requires module ID match; advisory cannot produce confirmed.";
  /** Hangi modül için üretildi. */
  module: AegisModuleKind;
  /** Versiyon (ileride şema geliştikçe artar). */
  version: "v1-skeleton";
  suggestedRegions: SuggestedRegion[];
  reservedZones: ReservedZone[];
  forbiddenZones: ForbiddenZone[];
  moduleConflictWarnings: ModuleConflictWarning[];
  /** Video-özgü (image/text için boş array). */
  recommendedFrameHints: RecommendedFrameHint[];
  /** Video-özgü (image/text için boş array). */
  recommendedAnchorHints: RecommendedAnchorHint[];
  layerOwnership: LayerOwnership[];
  expectedSearchHints: ExpectedSearchHint[];
}

/** Advisory builder input — encode/cloak çıktısının post-fact özeti.
 *  Henüz somut alan beklemiyor; ileride gerçek doldurma adımı için
 *  geniş bırakıldı. Bilinmeyen alan VARSAYILAN değerleriyle döner.
 */
export interface BuildSealAdvisoryContext {
  /** Modülün ürettiği DNA ID (varsa). */
  dnaId?: string | undefined;
  /** Modülün ürettiği expected layer ID listesi (sealOrchestrator plan'dan). */
  expectedLayerIds?: ReadonlyArray<string> | undefined;
}

/** Ortak iskelet doldurucu — alanları boş array ile başlatır. */
function emptyAdvisorySkeleton(
  module: AegisModuleKind,
): DnaSealAdvisory {
  return {
    authority: DNA_SEAL_ADVISORY_AUTHORITY,
    contract:
      "DNA seal advisory L1 (skeleton). DNA does NOT decide placement. Module decisions remain unchanged. Final VAULT requires module ID match; advisory cannot produce confirmed.",
    module,
    version: "v1-skeleton",
    suggestedRegions: [],
    reservedZones: [],
    forbiddenZones: [],
    moduleConflictWarnings: [],
    recommendedFrameHints: [],
    recommendedAnchorHints: [],
    layerOwnership: [],
    expectedSearchHints: [],
  };
}

/**
 * Video seal advisory builder — read-only advisory.
 * Bu sprintte gerçek frame/anchor önerisi üretmez; sadece iskelet döner.
 * Karar davranışını DEĞİŞTİRMEZ.
 */
export function buildVideoSealAdvisory(
  ctx: BuildSealAdvisoryContext = {},
): DnaSealAdvisory {
  const adv = emptyAdvisorySkeleton("video");
  // Faz 1: layerOwnership için bilinen layer ID'lerini read-only referans olarak ekle.
  // Coverage=0 → henüz ölçülmedi.
  for (const layerId of ctx.expectedLayerIds ?? []) {
    adv.layerOwnership.push({
      layerId,
      coverage: 0,
      primaryFor: "video",
    });
  }
  return adv;
}

/**
 * Image seal advisory builder — read-only advisory.
 * Karar davranışını DEĞİŞTİRMEZ.
 */
export function buildImageSealAdvisory(
  ctx: BuildSealAdvisoryContext = {},
): DnaSealAdvisory {
  const adv = emptyAdvisorySkeleton("image");
  for (const layerId of ctx.expectedLayerIds ?? []) {
    adv.layerOwnership.push({
      layerId,
      coverage: 0,
      primaryFor: "image",
    });
  }
  return adv;
}

/**
 * Text seal advisory builder — read-only advisory.
 * Karar davranışını DEĞİŞTİRMEZ.
 */
export function buildTextSealAdvisory(
  ctx: BuildSealAdvisoryContext = {},
): DnaSealAdvisory {
  const adv = emptyAdvisorySkeleton("text");
  for (const layerId of ctx.expectedLayerIds ?? []) {
    adv.layerOwnership.push({
      layerId,
      coverage: 0,
      primaryFor: "text",
    });
  }
  return adv;
}
