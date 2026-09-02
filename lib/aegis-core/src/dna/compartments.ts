/**
 * AEGIS DNA — Compartments (v0.6.9)
 * ─────────────────────────────────────────────────────────────────────
 * AEGIS DNA zengindir; ancak içindeki her bilgi aynı yetkiye sahip
 * değildir. Bu modül mevcut `AegisDNA` struct'ı üzerinden 11 bölümlü
 * salt-okuma projeksiyon üretir ve bölümler-arası YETKİ sözleşmesini
 * kodda zorlar.
 *
 * Kayıt şeması (lib/aegis-core/src/dna/types.ts) DOKUNULMADI — tüm
 * mevcut DNA satırları aynı struct'la okunabilir, yeni kayıt formatı
 * gerekmez. Bu modül **lazy projection** sağlar.
 *
 * ANA KURAL:
 *   - Aday sinyal (candidateSignals) FINAL KARAR alanı (finalDecisionGate)
 *     üzerinde söz hakkına sahip DEĞİL.
 *   - Kurtarma ipucu (recoveryHints) FINAL KARAR alanı üzerinde söz
 *     hakkına sahip DEĞİL.
 *   - Karşılaştırma sonucu (comparison) FINAL KARAR alanı üzerinde
 *     tek başına söz hakkına sahip DEĞİL.
 *   - finalDecisionGate sadece mevcut güçlü doğrulama kapıları (verdict
 *     ladder, A5, vault confirmation, eşik geçişleri) geçerse oluşur.
 *
 * Bu modül EŞİK / A5 / Layer B / T6 / verdict mantığını ETKİLEMEZ.
 * Sadece DNA bölümlerini ayırır ve yetki sözleşmesini açıkça kodlar.
 */

import type {
  AegisDNA,
  AegisMediaType,
  DNAEvidenceRef,
  DNALayer,
  DNAReservedZone,
  DNASealedUnit,
} from "./types.js";

/** 11 bölümün adı — yetki sözleşmesinde discriminator. */
export type DnaCompartmentKind =
  | "identity"
  | "mathematicalTwin"
  | "sealMap"
  | "searchMap"
  | "reservedZones"
  | "recoveryHints"
  | "comparison"
  | "candidateSignals"
  | "evidenceLink"
  | "confidenceLevels"
  | "finalDecisionGate";

/**
 * Aday/öneri/karşılaştırma kaynakları — FINAL kararı tek başına
 * üretemez. Bu set genişletilirken çok dikkatli olunmalı.
 */
export const ADVISORY_ONLY_SOURCES: ReadonlySet<DnaCompartmentKind> = new Set([
  "candidateSignals",
  "recoveryHints",
  "comparison",
]);

/** Kesin karar hedefi — sadece güçlü doğrulama geçerse yazılır. */
export const FINAL_DECISION_TARGETS: ReadonlySet<DnaCompartmentKind> = new Set([
  "finalDecisionGate",
]);

/**
 * Bölümler-arası yazma yetkisi sözleşmesi.
 *
 * Aday / kurtarma / karşılaştırma bölümlerinden gelen bir bilginin
 * doğrudan FINAL karar bölümüne yazılması yasaktır; bu durumda
 * `Error` atılır. Çağıran kod, mevcut güçlü doğrulama kapılarından
 * (verdict ladder, vault confirm, A5, eşikler) geçen sonucu
 * yazmalıdır.
 *
 * Karar üreten yerlerde:
 *   assertCompartmentAuthority("candidateSignals", "finalDecisionGate")
 *   → throw
 *   assertCompartmentAuthority("verdictLadder" /* whitelisted source *\/, "finalDecisionGate")
 *   → ok
 *
 * Security note: this is a compartment boundary guard, not the final VAULT
 * decision lock. Final authority still belongs to the existing ID/vault
 * verification gates; this helper never changes thresholds or ID rules.
 */
export function assertCompartmentAuthority(
  source: string,
  target: string,
): void {
  if (
    ADVISORY_ONLY_SOURCES.has(source as DnaCompartmentKind) &&
    FINAL_DECISION_TARGETS.has(target as DnaCompartmentKind)
  ) {
    throw new Error(
      `AEGIS DNA compartment authority violation: '${source}' is ADVISORY-only and cannot write directly to '${target}'. ` +
        `Final decisions must pass existing strong-verification gates (verdict ladder / vault confirmation / A5).`,
    );
  }
}

// ── Bölüm tipleri ────────────────────────────────────────────────────

/** Bölüm 1 — Kimlik. */
export interface DnaIdentityCompartment {
  dnaId: string;
  schemaVersion: AegisDNA["schemaVersion"];
  primaryMediaType: AegisMediaType;
  activeMediaTypes: ReadonlyArray<AegisMediaType>;
  pipelineVersion: string;
  createdAt: string;
  contentSizeBytes?: number;
}

/** Bölüm 2 — Matematiksel ikiz / yapısal hafıza. */
export interface DnaMathematicalTwinCompartment {
  contentDigest: AegisDNA["contentDigest"];
  structuralFingerprint: AegisDNA["structuralFingerprint"];
  geometry?: AegisDNA["geometry"];
  /** Tek başına karar üretemez; sadece karşılaştırma girdisi. */
  authority: "verification_input_only";
}

/** Bölüm 3 — Mühür basma haritası (encode-yönlü). */
export interface DnaSealMapCompartment {
  layers: ReadonlyArray<{
    layerId: string;
    mediaType: AegisMediaType;
    version: string;
    active: boolean;
    unitCount: number;
    regionCount: number;
    units: ReadonlyArray<DNASealedUnit>;
  }>;
  encodeMap?: Record<string, unknown>;
}

/** Bölüm 4 — Arama haritası (decode/lookup-yönlü). */
export interface DnaSearchMapCompartment {
  layers: ReadonlyArray<{
    layerId: string;
    mediaType: AegisMediaType;
    active: boolean;
    freeZoneHint?: string;
  }>;
  decodeMap?: Record<string, unknown>;
  /** DNA yoksa eski sistemin devam edeceğine dair sözleşme notu. */
  fallbackPolicy:
    "If DNA missing or read fails: legacy search path continues unchanged.";
}

/** Bölüm 5 — Korunan / yasak alanlar. */
export interface DnaReservedZonesCompartment {
  zones: ReadonlyArray<{
    ownerLayer: string;
    unitScope: DNAReservedZone["unitScope"];
    regionId: string;
    reason: string;
  }>;
  overlapWarnings: ReadonlyArray<{
    unitKey: number | string;
    layerA: string;
    layerB: string;
    regionA: string;
    regionB: string;
    reason: string;
  }>;
}

/** Bölüm 6 — Kurtarma ipuçları (ADVISORY, delil değil). */
export interface DnaRecoveryHintsCompartment {
  freeZoneHints: ReadonlyArray<string>;
  perLayerHints: ReadonlyArray<{ layerId: string; hint: string }>;
  /** Yetki: yalnız ipucu — kesin karar üretemez. */
  authority: "advisory_only_never_final";
}

/** Bölüm 7 — Karşılaştırma (ADVISORY, tek başına suçlama değil). */
export interface DnaComparisonCompartment {
  perceptualHash?: string;
  linguisticFingerprint?: string;
  geometricChecksum?: string;
  /** Yetki: yalnız benzerlik girdisi — tek başına suçlama yapamaz. */
  authority: "advisory_only_never_final";
}

/** Bölüm 8 — Aday sinyaller (ADVISORY, T6_CANDIDATE vb. burada kalır). */
export interface DnaCandidateSignalsCompartment {
  /** Modüller bu listeye aday sinyal yazar (ör. video.t6: T6_CANDIDATE).
   *  Modüllerden gelen aday bilgisini barındırma alanı. */
  candidates: ReadonlyArray<{
    layerId: string;
    label: string;
    note?: string;
  }>;
  /** Yetki: yalnız sinyal — kesin başarı/VAULT/strong sayılamaz. */
  authority: "advisory_only_never_final";
}

/** Bölüm 9 — Delil bağlantısı. */
export interface DnaEvidenceLinkCompartment {
  evidence: DNAEvidenceRef;
  /** İleride Secure Room / zehir / oturum bağlantısı için rezerve. */
  reservedFutureLinks: {
    secureRoom: "dna_slot_reserved";
    poison: "dna_slot_reserved";
    sessionAttribution: "dna_slot_reserved";
  };
}

/** Bölüm 10 — Güven seviyesi (modüllere göre). */
export type DnaConfidenceTier = "weak" | "medium" | "strong";
export interface DnaConfidenceLevelsCompartment {
  perLayer: ReadonlyArray<{
    layerId: string;
    mediaType: AegisMediaType;
    active: boolean;
    /** Heuristic tier — yalnız raporlama; karar zincirine girmez. */
    tier: DnaConfidenceTier;
  }>;
}

/** Confirmed kapısı — KESİN doğrulama yalnız ID okunup sistemdeki ID
 *  ile eşleşirse oluşur. Başka hiçbir sinyal/skor confirmed üretemez. */
export interface DnaConfirmedDecision {
  /** Bu zincirde confirmed üretildi mi? */
  matched: boolean;
  /** Mühürden okunan ID (varsa). Yoksa null. */
  decodedIdHex: string | null;
  /** Sistemde aranan ID (varsa). */
  expectedIdHex: string | null;
  /** Confirmed kuralı (sabit insan-okuru). */
  rule:
    "confirmed = (decodedIdHex !== null) AND (decodedIdHex === expectedIdHex). Hiçbir DNA sinyali, aday skoru, kurtarma ipucu veya karşılaştırma confirmed üretemez.";
}

/** Aday güven skoru — ID okunamazsa DNA + diğer izler üzerinden
 *  hesaplanan 0..1 destekleyici sinyal. Confirmed değildir, mahkemelik
 *  delil değildir; araştırma/önceliklendirme içindir. */
export type DnaCandidateConfidenceTier =
  | "none"
  | "weak"
  | "medium"
  | "strong";

export interface DnaCandidateConfidenceContributors {
  /** DNA içerik özeti benzerliği (matematiksel ikiz). */
  dnaSimilarity?: number;
  /** Mühür haritası eşleşme oranı (sealMap layers/units). */
  sealMapMatch?: number;
  /** Katman sinyalleri (her aktif katmandan gelen kanıt). */
  layerSignals?: number;
  /** Yapısal parmak izi benzerliği (perceptual / linguistic / geometric). */
  structuralFingerprint?: number;
  /** Kurtarma ipuçlarının uygulanabilirliği. */
  recoveryHints?: number;
  /** Modüller arası tutarlılık (text+image+video birlikte). */
  crossModuleConsistency?: number;
  /** Çakışma / çelişki uyarıları (negatif katkı). */
  conflictPenalty?: number;
}

export interface DnaCandidateConfidence {
  /** 0..1 birleşik skor. */
  score: number;
  /** Skor → kademe etiketi. */
  tier: DnaCandidateConfidenceTier;
  /** Katkı veren temel alanlar. */
  contributors: DnaCandidateConfidenceContributors;
  /** Her zaman true — bu skor asla kesin karar yerine geçmez. */
  neverFinal: true;
  /** Bu alanın yetkisi (insan-okuru sabit not). */
  authority:
    "candidate_support_only_never_confirmation";
  /** Açıklama notları (insan-okuru, raporlama dili). */
  notes: ReadonlyArray<string>;
}

/** Bölüm 11 — Kesin karar bölümü (iki seviyeli).
 *
 *  AEGIS iki seviyeli karar verir:
 *    1) **confirmed** — KESİN. Yalnız mühürdeki ID okunup sistem ID ile
 *       EŞLEŞİRSE oluşur. Hiçbir DNA / aday skor / kurtarma ipucu
 *       confirmed üretemez.
 *    2) **candidateConfidence** — ADAY. ID yoksa/okunamazsa DNA ve
 *       diğer izlerden 0..1 yüzdeli destekleyici skor. Confirmed değildir.
 *
 *  Bu bölümü DNA snapshot tek başına DOLDURMAZ — `status="not_populated_from_dna"`
 *  default'tur. Karar üretim noktası (mevcut güçlü doğrulama kapıları)
 *  `confirmed` alanını yazar; aday skor isteğe bağlı caller tarafından
 *  doldurulur (saf helper `buildCandidateConfidence` aşağıda). */
export interface DnaFinalDecisionGateCompartment {
  status: "not_populated_from_dna";
  /** Buraya yazma yetkisi olan tek meşru kaynak. */
  allowedSource: "strong_verification_gates_only";
  /** Yetki kuralları (insan okuru için). */
  rules: ReadonlyArray<string>;
  /** Seviye 1 — Kesin doğrulama. DNA dolduramaz; karar zinciri yazar. */
  confirmed: DnaConfirmedDecision;
  /** Seviye 2 — Aday güven skoru. ID yoksa caller `buildCandidateConfidence`
   *  ile doldurabilir. Bu projeksiyonda default boş iskelet. */
  candidateConfidence: DnaCandidateConfidence;
  /** İki seviyeli karar sözleşmesi (insan-okuru sabit not). */
  twoTierContract:
    "AEGIS two-tier decision: (1) confirmed = ID-decoded AND ID-matched; (2) candidateConfidence = ADVISORY 0..1 score from DNA traces when ID is missing/unreadable. The two tiers NEVER cross — candidateConfidence is never a confirmation, no matter how high the score.";
}

/** 11 bölümün tamamı. */
export interface DnaCompartments {
  identity: DnaIdentityCompartment;
  mathematicalTwin: DnaMathematicalTwinCompartment;
  sealMap: DnaSealMapCompartment;
  searchMap: DnaSearchMapCompartment;
  reservedZones: DnaReservedZonesCompartment;
  recoveryHints: DnaRecoveryHintsCompartment;
  comparison: DnaComparisonCompartment;
  candidateSignals: DnaCandidateSignalsCompartment;
  evidenceLink: DnaEvidenceLinkCompartment;
  confidenceLevels: DnaConfidenceLevelsCompartment;
  finalDecisionGate: DnaFinalDecisionGateCompartment;
  /** Mimari sözleşme yapısal not. */
  contract:
    "Compartmentalized DNA — advisory sources (candidateSignals, recoveryHints, comparison) cannot write directly to finalDecisionGate. Existing strong-verification gates remain authoritative.";
}

const COMPARTMENT_CONTRACT =
  "Compartmentalized DNA — advisory sources (candidateSignals, recoveryHints, comparison) cannot write directly to finalDecisionGate. Existing strong-verification gates remain authoritative." as const;

const FINAL_GATE_RULES = Object.freeze([
  "Aday sinyal (candidateSignals) tek başına finalDecisionGate üretemez.",
  "Kurtarma ipucu (recoveryHints) tek başına finalDecisionGate üretemez.",
  "Karşılaştırma sonucu (comparison) tek başına finalDecisionGate üretemez.",
  "Kesin karar ancak mevcut güçlü doğrulama kapıları (verdict ladder, vault confirmation, A5, eşik geçişleri) geçerse oluşur.",
  "VAULT / kesin başarı kararları mevcut güvenlik kurallarını bypass edemez.",
  "Yanlış kişiyi suçlama riski açılmaz.",
]);

// ── İki seviyeli karar yardımcıları ──────────────────────────────────

/**
 * **Seviye 1 — Confirmed kapısı.**
 *
 * KESİN doğrulama yalnız mühürden okunan ID, sistemdeki beklenen ID
 * ile eşleşirse oluşur. Hiçbir DNA sinyali / aday skoru / kurtarma
 * ipucu / karşılaştırma sonucu confirmed üretemez.
 *
 * Saf fonksiyon: yalnız `decodedIdHex === expectedIdHex` (case-insensitive
 * hex karşılaştırması) doğru ve `decodedIdHex !== null` ise `matched=true`.
 * Yan etki yok; mevcut karar zincirini ETKİLEMEZ — caller'ın çağırması
 * isteğe bağlı.
 */
/** Canonical hex regex — sadece 0-9a-f, çift uzunluk (8..128 nibble).
 *  AEGIS ID'leri tipik olarak 64 hex (sha256) veya 8/16/32 hex bayt zinciri.
 *  Geçersiz format → confirmed REDDEDİLİR (false positive guard). */
const HEX_RE = /^[0-9a-f]+$/;
const HEX_MIN_LEN = 8;
const HEX_MAX_LEN = 128;

function canonicalizeIdHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const lower = v.toLowerCase();
  if (lower.length < HEX_MIN_LEN || lower.length > HEX_MAX_LEN) return null;
  if (lower.length % 2 !== 0) return null;
  if (!HEX_RE.test(lower)) return null;
  return lower;
}

export function evaluateConfirmedDecision(input: {
  decodedIdHex: string | null;
  expectedIdHex: string | null;
}): DnaConfirmedDecision {
  // Hex doğrulaması — non-hex/yanlış uzunluk girdiler null'a düşer ve
  // confirmed üretmez (adli sistem için false attribution guard).
  const decoded = canonicalizeIdHex(input.decodedIdHex);
  const expected = canonicalizeIdHex(input.expectedIdHex);
  const matched = decoded !== null && expected !== null && decoded === expected;
  return {
    matched,
    decodedIdHex: decoded,
    expectedIdHex: expected,
    rule:
      "confirmed = (decodedIdHex !== null) AND (decodedIdHex === expectedIdHex). Hiçbir DNA sinyali, aday skoru, kurtarma ipucu veya karşılaştırma confirmed üretemez.",
  };
}

/**
 * **Seviye 2 — Candidate confidence skoru.**
 *
 * ID okunamazsa DNA + diğer izlerden 0..1 yüzdeli destekleyici skor
 * hesaplar. Saf fonksiyon; girdi olarak katkı veren temel alanları
 * alır (her biri opsiyonel, 0..1 normalleştirilmiş).
 *
 * **ASLA confirmed üretemez** — sonuç tipi `DnaCandidateConfidence`
 * `neverFinal: true` ile etiketlenir. Eşik / verdict ladder etkilenmez.
 */
export function buildCandidateConfidence(
  contributors: DnaCandidateConfidenceContributors,
): DnaCandidateConfidence {
  const clamp = (v: number | undefined): number =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(1, v))
      : 0;
  const dna = clamp(contributors.dnaSimilarity);
  const seal = clamp(contributors.sealMapMatch);
  const layer = clamp(contributors.layerSignals);
  const fp = clamp(contributors.structuralFingerprint);
  const rec = clamp(contributors.recoveryHints);
  const cross = clamp(contributors.crossModuleConsistency);
  const conflict = clamp(contributors.conflictPenalty);

  // Ağırlıklar — yapısal/mühür/katman daha güçlü, kurtarma/ipucu daha
  // zayıf, çakışma negatif. Toplam pozitif ağırlık = 1.0.
  const positive =
    dna * 0.18 +
    seal * 0.22 +
    layer * 0.22 +
    fp * 0.18 +
    rec * 0.05 +
    cross * 0.15;
  const raw = positive - 0.5 * conflict;
  const score = Math.max(0, Math.min(1, raw));

  let tier: DnaCandidateConfidenceTier;
  if (score < 0.2) tier = "none";
  else if (score < 0.5) tier = "weak";
  else if (score < 0.8) tier = "medium";
  else tier = "strong";

  // Conflict cap — yüksek çakışma/çelişki varsa tier'ı bastır (architect
  // önerisi). Adli sistem için aday skor güvenilirliği korunur.
  if (conflict >= 0.7) {
    // Şiddetli çelişki → en fazla "weak" çıkabilir.
    if (tier === "strong" || tier === "medium") tier = "weak";
  } else if (conflict >= 0.4) {
    // Orta çelişki → "strong" yasak.
    if (tier === "strong") tier = "medium";
  }

  return {
    score,
    tier,
    contributors: {
      dnaSimilarity: dna,
      sealMapMatch: seal,
      layerSignals: layer,
      structuralFingerprint: fp,
      recoveryHints: rec,
      crossModuleConsistency: cross,
      conflictPenalty: conflict,
    },
    neverFinal: true,
    authority: "candidate_support_only_never_confirmation",
    notes: [
      "Bu skor ADAY/DESTEKLEYİCİ — kesin karar değildir.",
      "ID okunamadığında DNA izlerinden hesaplanır.",
      "Mahkemelik delil yerine geçmez; araştırma + önceliklendirme + delil desteği içindir.",
      "Tier 'strong' bile olsa, ID okunmadıkça confirmed üretilmez.",
    ],
  };
}

function tierFromLayer(l: DNALayer): DnaConfidenceTier {
  if (!l.active) return "weak";
  const units = Array.isArray(l.units) ? l.units : [];
  const total = units.reduce(
    (acc, u) => acc + (Array.isArray(u.regions) ? u.regions.length : 0),
    0,
  );
  if (total >= 6) return "strong";
  if (total >= 2) return "medium";
  return "weak";
}

/** Layer'ı eski/parçalı kayıtlara karşı normalize et (mutate etmez). */
function normalizeLayer(l: DNALayer): DNALayer {
  return {
    ...l,
    units: Array.isArray(l.units) ? l.units : [],
    reservedZones: Array.isArray(l.reservedZones) ? l.reservedZones : [],
  };
}

/** Projeksiyon seçenekleri. */
export interface BuildDnaCompartmentsOptions {
  /** "summary" (default) → sealMap.layers[].units ve encodeMap/decodeMap
   *  detaylarını boşaltır (payload bloat'tan kaçınır). "full" → her şeyi
   *  bırakır. Mevcut karar zinciri bu helper'ı çağırmadığı için varsayılan
   *  güvenli kalır; ileride telemetry/admin endpoint'leri "full" isterse açar. */
  mode?: "summary" | "full";
}

/**
 * `AegisDNA` üzerinden 11 bölümlü salt-okuma projeksiyon üretir.
 *
 * Side-effect yok. Eski DNA kayıtları (`schemaVersion: "aegis-dna-v1"`)
 * AYNEN bu helper'la okunabilir — geriye dönük uyum tam. Eksik/legacy
 * alanlar (layers/evidence/freeZoneHints) defansif olarak boş varsayılır.
 *
 * `finalDecisionGate` alanı `Object.freeze` ile sealed döner — caller
 * runtime'da bu alana yazamaz (yetki sözleşmesinin ek garantisi).
 */
export function buildDnaCompartments(
  dna: AegisDNA,
  opts: BuildDnaCompartmentsOptions = {},
): DnaCompartments {
  const mode = opts.mode ?? "summary";
  // Defansif giriş normalizasyonu — eski/parçalı satırlar için.
  const layersRaw: ReadonlyArray<DNALayer> = Array.isArray(dna.layers)
    ? dna.layers.map(normalizeLayer)
    : [];
  const freeZoneHintsRaw: ReadonlyArray<string> = Array.isArray(dna.freeZoneHints)
    ? dna.freeZoneHints
    : [];
  const evidenceRaw: DNAEvidenceRef = (dna.evidence ?? {
    idHex: dna.dnaId ?? "",
    evidencePackId: null,
  }) as DNAEvidenceRef;
  const mapsRaw = dna.maps ?? {};
  const fp = dna.structuralFingerprint ?? {};
  // Eski kod kalıbı için lokal AegisDNA görünümü:
  const dnaSafe: AegisDNA = {
    ...dna,
    layers: layersRaw as DNALayer[],
    freeZoneHints: freeZoneHintsRaw as string[],
    evidence: evidenceRaw,
    maps: mapsRaw,
    structuralFingerprint: fp,
  };
  return buildDnaCompartmentsInternal(dnaSafe, mode);
}

function buildDnaCompartmentsInternal(
  dna: AegisDNA,
  mode: "summary" | "full",
): DnaCompartments {
  // Bölüm 1 — Identity
  const identity: DnaIdentityCompartment = {
    dnaId: dna.dnaId,
    schemaVersion: dna.schemaVersion,
    primaryMediaType: dna.primaryMediaType,
    activeMediaTypes: dna.activeMediaTypes,
    pipelineVersion: dna.pipelineVersion,
    createdAt: dna.createdAt,
    contentSizeBytes: dna.contentDigest.sizeBytes,
  };

  // Bölüm 2 — Matematiksel ikiz
  const mathematicalTwin: DnaMathematicalTwinCompartment = {
    contentDigest: dna.contentDigest,
    structuralFingerprint: dna.structuralFingerprint,
    geometry: dna.geometry,
    authority: "verification_input_only",
  };

  // Bölüm 3 — Mühür basma haritası
  // summary mode'da units[] ve encodeMap detaylarını boşaltırız (payload bloat
  // kaçınma); full mode'da tam detay döner.
  const sealMap: DnaSealMapCompartment = {
    layers: dna.layers.map((l) => ({
      layerId: l.layerId,
      mediaType: l.mediaType,
      version: l.version,
      active: l.active,
      unitCount: l.units.length,
      regionCount: l.units.reduce((acc, u) => acc + u.regions.length, 0),
      units: mode === "full" ? l.units : [],
    })),
    encodeMap: mode === "full" ? dna.maps?.encodeMap : undefined,
  };

  // Bölüm 4 — Arama haritası
  const searchMap: DnaSearchMapCompartment = {
    layers: dna.layers
      .filter((l) => l.active)
      .map((l) => ({
        layerId: l.layerId,
        mediaType: l.mediaType,
        active: l.active,
        freeZoneHint: l.freeZoneHint,
      })),
    decodeMap: mode === "full" ? dna.maps?.decodeMap : undefined,
    fallbackPolicy:
      "If DNA missing or read fails: legacy search path continues unchanged.",
  };

  // Bölüm 5 — Korunan/yasak alanlar
  const zones: DnaReservedZonesCompartment["zones"] = dna.layers.flatMap((l) =>
    l.reservedZones.map((z) => ({
      ownerLayer: z.ownerLayer,
      unitScope: z.unitScope,
      regionId: z.region.regionId,
      reason: z.reason,
    })),
  );
  // detectLayerOverlap import etmemek için lazy — caller (dnaReport)
  // zaten overlap'leri hesaplıyor; buraya boş geçiriyoruz ki çevrim
  // olmasın. Caller compartments.reservedZones.overlapWarnings'i kendi
  // detection sonucuyla doldurabilir.
  const reservedZones: DnaReservedZonesCompartment = {
    zones,
    overlapWarnings: [],
  };

  // Bölüm 6 — Kurtarma ipuçları
  const recoveryHints: DnaRecoveryHintsCompartment = {
    freeZoneHints: dna.freeZoneHints ?? [],
    perLayerHints: dna.layers
      .filter((l) => typeof l.freeZoneHint === "string")
      .map((l) => ({ layerId: l.layerId, hint: l.freeZoneHint as string })),
    authority: "advisory_only_never_final",
  };

  // Bölüm 7 — Karşılaştırma
  const comparison: DnaComparisonCompartment = {
    perceptualHash: dna.structuralFingerprint?.perceptualHash,
    linguisticFingerprint: dna.structuralFingerprint?.linguisticFingerprint,
    geometricChecksum: dna.structuralFingerprint?.geometricChecksum,
    authority: "advisory_only_never_final",
  };

  // Bölüm 8 — Aday sinyaller. Kayıt-zamanı struct'ından çıkar:
  // active=false layer'lar genelde "iskelet/aday" (örn T6).
  const candidateSignals: DnaCandidateSignalsCompartment = {
    candidates: dna.layers
      .filter((l) => !l.active)
      .map((l) => ({
        layerId: l.layerId,
        label: "skeleton_or_candidate_layer",
        note: l.freeZoneHint,
      })),
    authority: "advisory_only_never_final",
  };

  // Bölüm 9 — Delil bağlantısı
  const evidenceLink: DnaEvidenceLinkCompartment = {
    evidence: dna.evidence,
    reservedFutureLinks: {
      secureRoom: "dna_slot_reserved",
      poison: "dna_slot_reserved",
      sessionAttribution: "dna_slot_reserved",
    },
  };

  // Bölüm 10 — Güven seviyesi
  const confidenceLevels: DnaConfidenceLevelsCompartment = {
    perLayer: dna.layers.map((l) => ({
      layerId: l.layerId,
      mediaType: l.mediaType,
      active: l.active,
      tier: tierFromLayer(l),
    })),
  };

  // Bölüm 11 — Final karar (iki seviyeli, DNA tarafından doldurulmaz).
  // Sealed object — caller bu alana mutation yapamaz (yetki sözleşmesinin
  // runtime garantisi).
  const finalDecisionGate: DnaFinalDecisionGateCompartment = Object.freeze({
    status: "not_populated_from_dna" as const,
    allowedSource: "strong_verification_gates_only" as const,
    rules: FINAL_GATE_RULES,
    confirmed: Object.freeze({
      matched: false,
      decodedIdHex: null,
      expectedIdHex: null,
      rule:
        "confirmed = (decodedIdHex !== null) AND (decodedIdHex === expectedIdHex). Hiçbir DNA sinyali, aday skoru, kurtarma ipucu veya karşılaştırma confirmed üretemez." as const,
    }),
    candidateConfidence: Object.freeze({
      score: 0,
      tier: "none" as const,
      contributors: {},
      neverFinal: true as const,
      authority: "candidate_support_only_never_confirmation" as const,
      notes: Object.freeze([
        "Bu alan ADAY/DESTEKLEYİCİ skordur — kesin karar değildir.",
        "ID okunamadığında DNA izlerinden hesaplanır.",
        "Mahkemelik kesin karar yerine geçmez; araştırma ve önceliklendirme içindir.",
      ]),
    }),
    twoTierContract:
      "AEGIS two-tier decision: (1) confirmed = ID-decoded AND ID-matched; (2) candidateConfidence = ADVISORY 0..1 score from DNA traces when ID is missing/unreadable. The two tiers NEVER cross — candidateConfidence is never a confirmation, no matter how high the score." as const,
  });

  return {
    identity,
    mathematicalTwin,
    sealMap,
    searchMap,
    reservedZones,
    recoveryHints,
    comparison,
    candidateSignals,
    evidenceLink,
    confidenceLevels,
    finalDecisionGate,
    contract: COMPARTMENT_CONTRACT,
  };
}
