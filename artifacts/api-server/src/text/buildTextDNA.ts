/**
 * Text → AEGIS DNA builder (v0.6.6)
 * ─────────────────────────────────────────────────────────────────────
 * cloak-text rotasından gelen veriyi alır, ortak AegisDNA struct'ına
 * dönüştürür. KARAR mantığına dokunmaz — sadece kayıt struct'u üretir.
 * Mevcut /api/aegis/cloak-text response/header zinciri AYNI kalır.
 */

import {
  addLayer,
  createEmptyDNA,
  detectLayerOverlap,
  dnaSha256Hex,
  geometricChecksumFromRegions,
  type AegisDNA,
  type DNALayer,
  type DNAOverlapWarning,
  type DNARegion,
  type DNASealedUnit,
} from "@workspace/aegis-core";

export interface BuildTextDNAInput {
  cloakId: string;
  clientId: string;
  docId: string;
  pipelineVersion: string;
  /** Normalize edilmiş orijinal metin (hash girdisi). Saklanmaz; sadece
   *  contentDigest hesaplanır. */
  normalizedText: string;
  /** Hangi metin katmanları aktif (örn ["zeroWidth","homoglyph","linguistic"]). */
  activeLayers: string[];
  /** Linguistic shuffler / semantic positional plan varsa span'lar (free-form
   *  carrier konumları). */
  spans?: ReadonlyArray<{
    layerId: string;
    charStart: number;
    charEnd: number;
    carries?: string;
  }>;
  /** Stylometric / linguistic fingerprint hex (varsa). */
  linguisticFingerprint?: string;
  /** payload4 hex (varsa). */
  payload4Hex?: string;
}

export interface BuildTextDNAResult {
  dna: AegisDNA;
  overlapWarnings: DNAOverlapWarning[];
}

/** cloak-text çıktısından AegisDNA üret. Tek metin modülü aktifse iki
 *  bağımsız katman (carrier-steg ve linguistic) AegisDNA.layers[]'da
 *  ayrı tutulur — AEGIS sözleşmesi "tek modül → mümkünse iki mühür".
 *  reservedZones aynı charStart..charEnd span'larını sahiplenir. */
export function buildTextDNA(input: BuildTextDNAInput): BuildTextDNAResult {
  const contentHex = dnaSha256Hex(input.normalizedText);
  const dnaId = `text:${input.cloakId}`;

  // Span'ları katman id'ye göre grupla.
  const byLayer = new Map<
    string,
    Array<{ charStart: number; charEnd: number; carries?: string }>
  >();
  for (const s of input.spans ?? []) {
    if (!byLayer.has(s.layerId)) byLayer.set(s.layerId, []);
    byLayer.get(s.layerId)!.push({
      charStart: s.charStart,
      charEnd: s.charEnd,
      carries: s.carries,
    });
  }
  // Eğer caller span vermediyse activeLayers'tan iskelet üret.
  for (const lid of input.activeLayers) {
    if (!byLayer.has(lid)) byLayer.set(lid, []);
  }

  const allRegions: DNARegion[] = [];

  const dna = createEmptyDNA({
    dnaId,
    primaryMediaType: "text",
    activeMediaTypes: ["text"],
    pipelineVersion: input.pipelineVersion,
    contentDigest: {
      algo: "sha256",
      hex: contentHex,
      sizeBytes: Buffer.byteLength(input.normalizedText, "utf8"),
      source: "normalized",
    },
    structuralFingerprint: {
      linguisticFingerprint: input.linguisticFingerprint,
      structuralStats: {
        textLength: input.normalizedText.length,
      },
    },
    geometry: { textLength: input.normalizedText.length },
    evidence: {
      idHex: input.cloakId,
      payload4Hex: input.payload4Hex,
      evidencePackId: null,
    },
    freeZoneHints: ["text:free-zones-derived-from-non-carrier-spans"],
    meta: { clientId: input.clientId, docId: input.docId },
  });

  for (const [layerId, spans] of byLayer.entries()) {
    const regions: DNARegion[] = spans.map((s, idx) => ({
      regionId: `${layerId}.s${idx}`,
      shape: "tokenSpan",
      charStart: s.charStart,
      charEnd: s.charEnd,
      carries: s.carries ?? layerId,
    }));
    allRegions.push(...regions);

    const unit: DNASealedUnit = {
      unitKey: 0, // metin = tek doküman, ünite=0 (paragraf ayrımı şu an yok)
      unitMeta: { docId: input.docId },
      regions,
    };
    const layer: DNALayer = {
      layerId,
      mediaType: "text",
      version: input.pipelineVersion,
      active: spans.length > 0,
      units: [unit],
      reservedZones: regions.map((r) => ({
        unitScope: 0,
        region: r,
        ownerLayer: layerId,
        reason: "text carrier span owned by layer",
      })),
      freeZoneHint: `non-${layerId} spans free for other layers`,
    };
    addLayer(dna, layer);
  }

  // Geometric checksum: tüm region span'larının deterministik özeti.
  dna.structuralFingerprint.geometricChecksum =
    geometricChecksumFromRegions(allRegions);

  const overlapWarnings = detectLayerOverlap(dna);
  return { dna, overlapWarnings };
}
