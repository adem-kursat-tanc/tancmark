/**
 * AEGIS DNA — Çekirdek Yardımcılar (builder)
 * ─────────────────────────────────────────────────────────────────────
 * Tipler `./types.ts` içinde. Bu modül:
 *   - boş bir AegisDNA iskeleti üretmek için `createEmptyDNA`
 *   - katman eklemek için `addLayer`
 *   - reservedZone'ları katmana bağlamak için `addReservedZone`
 *   - hash hesaplama için `sha256Hex`
 *   - geometrik checksum için `geometricChecksumFromRegions`
 * sağlar. Karar mantığı / eşik / decode YOKTUR.
 */

import { createHash } from "node:crypto";
import type {
  AegisDNA,
  AegisDNAPurpose,
  AegisMediaType,
  DNAContentDigest,
  DNALayer,
  DNARegion,
  DNAReservedZone,
  DNASealedUnit,
  DNAStructuralFingerprint,
} from "./types.js";

/** Hex SHA256. AEGIS DNA namespace içinde sunulur (`dnaSha256Hex`) —
 *  `semantic/projection.ts`'in `sha256Hex` export'uyla çakışmamak için
 *  yeniden adlandırıldı (lib barrel'da iki ayrı tüketici aynı isimle
 *  re-export çakışmasını önler). */
export function dnaSha256Hex(input: Buffer | string): string {
  const h = createHash("sha256");
  h.update(input);
  return h.digest("hex");
}

/** Verilen region listesinden deterministik geometric checksum (SHA256 over
 *  normalized JSON). Anchor harita / region yerleşimi parmak izi olarak
 *  kullanılır — iki kaydın aynı geometriyi paylaşıp paylaşmadığını söyler. */
export function geometricChecksumFromRegions(
  regions: ReadonlyArray<DNARegion>,
): string {
  // Deterministik sıralama: regionId asc.
  const sorted = [...regions].sort((a, b) =>
    a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : 0,
  );
  const json = JSON.stringify(
    sorted.map((r) => ({
      regionId: r.regionId,
      shape: r.shape,
      cx: r.cx ?? null,
      cy: r.cy ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      frameIdx: r.frameIdx ?? null,
      charStart: r.charStart ?? null,
      charEnd: r.charEnd ?? null,
      timeStart: r.timeStart ?? null,
      timeEnd: r.timeEnd ?? null,
      freqBinStart: r.freqBinStart ?? null,
      freqBinEnd: r.freqBinEnd ?? null,
    })),
  );
  return dnaSha256Hex(json);
}

/** Boş bir AegisDNA iskeleti üret. */
export interface CreateEmptyDNAInput {
  dnaId: string;
  primaryMediaType: AegisMediaType;
  activeMediaTypes?: AegisMediaType[];
  purposes?: AegisDNAPurpose[];
  geometry?: AegisDNA["geometry"];
  contentDigest: DNAContentDigest;
  structuralFingerprint?: DNAStructuralFingerprint;
  pipelineVersion: string;
  evidence: AegisDNA["evidence"];
  freeZoneHints?: string[];
  meta?: Record<string, unknown>;
}

export function createEmptyDNA(input: CreateEmptyDNAInput): AegisDNA {
  return {
    schemaVersion: "aegis-dna-v1",
    dnaId: input.dnaId,
    primaryMediaType: input.primaryMediaType,
    activeMediaTypes: input.activeMediaTypes ?? [input.primaryMediaType],
    purposes: input.purposes ?? [
      "seal",
      "search",
      "compare",
      "recover",
      "evidence",
      "moduleRouter",
      "forensicMemory",
    ],
    geometry: input.geometry,
    contentDigest: input.contentDigest,
    structuralFingerprint: input.structuralFingerprint ?? {},
    layers: [],
    maps: {},
    freeZoneHints: input.freeZoneHints ?? [],
    pipelineVersion: input.pipelineVersion,
    evidence: input.evidence,
    createdAt: new Date().toISOString(),
    meta: input.meta,
  };
}

/** Mevcut DNA'ya yeni katman ekle (in-place + return). */
export function addLayer(dna: AegisDNA, layer: DNALayer): AegisDNA {
  dna.layers.push(layer);
  return dna;
}

/** Bir katmana reservedZone ekle (in-place). */
export function addReservedZone(
  layer: DNALayer,
  zone: DNAReservedZone,
): DNALayer {
  layer.reservedZones.push(zone);
  return layer;
}

/** Hangi medya türlerinin aktif olduğunu DNA üzerinden işaretle.
 *  `moduleRouter` amacı için tek noktadan okunur. */
export function setActiveMediaTypes(
  dna: AegisDNA,
  types: AegisMediaType[],
): AegisDNA {
  dna.activeMediaTypes = [...new Set(types)];
  return dna;
}

/** Çakışma kontrolü uyarısı — iki katmanın aynı bölgeyi paylaştığı durum.
 *  v0.6.6: rapor/uyarı seviyesinde, zorla engelleme yok. Mevcut sistemi bozmaz. */
export interface DNAOverlapWarning {
  layerAId: string;
  layerBId: string;
  unitKey: number | string;
  regionAId: string;
  regionBId: string;
  reason: string;
}

function regionsOverlap(a: DNARegion, b: DNARegion): boolean {
  // Aynı ünite içinde aynı regionId → kesin çakışma.
  if (a.regionId === b.regionId) return true;
  // Pixel patch / ring / dctBand: bounding box kesişimi.
  const ax = a.cx, ay = a.cy, aw = a.width, ah = a.height;
  const bx = b.cx, by = b.cy, bw = b.width, bh = b.height;
  if (
    typeof ax === "number" &&
    typeof ay === "number" &&
    typeof aw === "number" &&
    typeof ah === "number" &&
    typeof bx === "number" &&
    typeof by === "number" &&
    typeof bw === "number" &&
    typeof bh === "number"
  ) {
    const ax1 = ax - aw / 2, ay1 = ay - ah / 2;
    const ax2 = ax + aw / 2, ay2 = ay + ah / 2;
    const bx1 = bx - bw / 2, by1 = by - bh / 2;
    const bx2 = bx + bw / 2, by2 = by + bh / 2;
    if (ax2 <= bx1 || bx2 <= ax1 || ay2 <= by1 || by2 <= ay1) return false;
    return true;
  }
  // Metin span çakışması.
  if (
    typeof a.charStart === "number" &&
    typeof a.charEnd === "number" &&
    typeof b.charStart === "number" &&
    typeof b.charEnd === "number"
  ) {
    return !(a.charEnd <= b.charStart || b.charEnd <= a.charStart);
  }
  return false;
}

/** Tüm aktif katmanlar arasında bölge çakışmalarını tarar. Aynı `unitKey`
 *  üstünde iki farklı katmanın bölgeleri kesişiyorsa uyarı üretir. Karar
 *  zincirine girmez; modüller arası AEGIS DNA sözleşmesinin runtime sağlık
 *  kontrolüdür. */
export function detectLayerOverlap(dna: AegisDNA): DNAOverlapWarning[] {
  const warnings: DNAOverlapWarning[] = [];
  const active = dna.layers.filter((l) => l.active);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const A = active[i]!;
      const B = active[j]!;
      // Aynı medya tipinde olmalı; farklı medya → fiziksel çakışma yok.
      if (A.mediaType !== B.mediaType) continue;
      const bUnits = new Map<number | string, DNASealedUnit>();
      for (const u of B.units) bUnits.set(u.unitKey, u);
      for (const ua of A.units) {
        const ub = bUnits.get(ua.unitKey);
        if (!ub) continue;
        for (const ra of ua.regions) {
          for (const rb of ub.regions) {
            if (regionsOverlap(ra, rb)) {
              warnings.push({
                layerAId: A.layerId,
                layerBId: B.layerId,
                unitKey: ua.unitKey,
                regionAId: ra.regionId,
                regionBId: rb.regionId,
                reason: "region geometry overlap",
              });
            }
          }
        }
      }
    }
  }
  return warnings;
}
