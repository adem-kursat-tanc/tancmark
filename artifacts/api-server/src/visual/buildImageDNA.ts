/**
 * Image → AEGIS DNA builder (v0.6.6)
 * ─────────────────────────────────────────────────────────────────────
 * cloak-image rotasından gelen veriyi alır, ortak AegisDNA struct'ına
 * dönüştürür. KARAR mantığına dokunmaz — sadece kayıt struct'u üretir.
 * Mevcut /api/aegis/cloak-image response zinciri AYNI kalır.
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

export interface BuildImageDNAInput {
  cloakId: string;
  clientId: string;
  docId: string;
  pipelineVersion: string;
  width: number;
  height: number;
  /** PNG buffer — orijinal saklanmaz; sadece sha256 alınır. */
  pngBuffer: Buffer;
  /** L1 corner stamp sayısı (mevcut visual pipeline pozisyon listesi tutmuyor,
   *  count tutuyor). */
  l1HitCount: number;
  l1StampSize: number;
  /** L2 structural gap satır bilgisi (lineCount + base spacing). */
  l2LineCount: number;
  l2BaseSpacing: number;
  /** L3 algoritma seti (örn ["lsb-v1","dct-v1"]). */
  l3Algorithms: string[];
  l3PayloadDigestSha256: string;
  /** Vault region (varsa). */
  vault?: {
    rect: { x: number; y: number; width: number; height: number };
    pHashHex?: string;
    compactIdHex?: string;
  };
  payload4Hex?: string;
}

export interface BuildImageDNAResult {
  dna: AegisDNA;
  overlapWarnings: DNAOverlapWarning[];
}

/** cloak-image çıktısından AegisDNA üret. L1 köşe damgaları, L2 satır
 *  boşluğu, L3 LSB/DCT, vault region disjoint reservedZones olarak girer. */
export function buildImageDNA(input: BuildImageDNAInput): BuildImageDNAResult {
  const contentHex = dnaSha256Hex(input.pngBuffer);
  const dnaId = `image:${input.cloakId}`;
  const allRegions: DNARegion[] = [];

  const dna = createEmptyDNA({
    dnaId,
    primaryMediaType: "image",
    activeMediaTypes: ["image"],
    pipelineVersion: input.pipelineVersion,
    contentDigest: {
      algo: "sha256",
      hex: contentHex,
      sizeBytes: input.pngBuffer.byteLength,
      source: "bytes",
    },
    structuralFingerprint: {
      perceptualHash: input.vault?.pHashHex,
      structuralStats: {
        width: input.width,
        height: input.height,
        l1Count: input.l1HitCount,
      },
    },
    geometry: { width: input.width, height: input.height },
    evidence: {
      idHex: input.cloakId,
      payload4Hex: input.payload4Hex,
      evidencePackId: null,
    },
    freeZoneHints: [
      "image:central-band-free-of-anchors",
      "image:vault-region-disjoint-from-l1-corners",
    ],
    meta: { clientId: input.clientId, docId: input.docId },
  });

  // L1: corner stamps — count olarak gelir; tek temsili region (4 köşe).
  // Pozisyonlar visual pipeline'da tutulmaz; ileride lib tarafına eklenince
  // per-corner region'a yükseltilebilir.
  const l1Region: DNARegion = {
    regionId: "L1.cornerStamps",
    shape: "patch",
    width: input.l1StampSize,
    height: input.l1StampSize,
    carries: "L1 4-corner stamp set",
    meta: { hitCount: input.l1HitCount },
  };
  allRegions.push(l1Region);
  addLayer(dna, {
    layerId: "image.L1.cornerStamps",
    mediaType: "image",
    version: input.pipelineVersion,
    active: input.l1HitCount > 0,
    units: [{ unitKey: 0, regions: [l1Region] }],
    reservedZones: [
      {
        unitScope: 0,
        region: l1Region,
        ownerLayer: "image.L1.cornerStamps",
        reason: "L1 4-corner stamp set",
      },
    ],
    freeZoneHint: "central frame free for L2/L3",
  });

  // L2: structural line gaps (region as horizontal strip hint)
  if (input.l2LineCount > 0) {
    const l2Region: DNARegion = {
      regionId: "L2.lineGaps",
      shape: "other",
      meta: {
        lineCount: input.l2LineCount,
        baseSpacing: input.l2BaseSpacing,
      },
      carries: "L2 line-gap carrier",
    };
    allRegions.push(l2Region);
    addLayer(dna, {
      layerId: "image.L2.lineGaps",
      mediaType: "image",
      version: input.pipelineVersion,
      active: true,
      units: [{ unitKey: 0, regions: [l2Region] }],
      reservedZones: [
        {
          unitScope: 0,
          region: l2Region,
          ownerLayer: "image.L2.lineGaps",
          reason: "L2 structural line spacing",
        },
      ],
    });
  }

  // L3: LSB / DCT (frequency band region)
  const l3Region: DNARegion = {
    regionId: "L3.lsbDct",
    shape: "dctBand",
    carries: "L3 LSB+DCT mid-band payload",
    meta: {
      algorithms: input.l3Algorithms,
      payloadDigestSha256: input.l3PayloadDigestSha256,
    },
  };
  allRegions.push(l3Region);
  addLayer(dna, {
    layerId: "image.L3.lsbDct",
    mediaType: "image",
    version: input.pipelineVersion,
    active: true,
    units: [{ unitKey: 0, regions: [l3Region] }],
    reservedZones: [
      {
        unitScope: 0,
        region: l3Region,
        ownerLayer: "image.L3.lsbDct",
        reason: "L3 frequency band payload",
      },
    ],
  });

  // Vault region (varsa)
  if (input.vault) {
    const v = input.vault;
    const vaultRegion: DNARegion = {
      regionId: "vault.rect",
      shape: "patch",
      cx: v.rect.x + v.rect.width / 2,
      cy: v.rect.y + v.rect.height / 2,
      width: v.rect.width,
      height: v.rect.height,
      carries: "vault digest + sync markers",
      meta: { compactIdHex: v.compactIdHex },
    };
    allRegions.push(vaultRegion);
    addLayer(dna, {
      layerId: "image.vault",
      mediaType: "image",
      version: input.pipelineVersion,
      active: true,
      units: [{ unitKey: 0, regions: [vaultRegion] }],
      reservedZones: [
        {
          unitScope: 0,
          region: vaultRegion,
          ownerLayer: "image.vault",
          reason: "vault region — L1/L2/L3 must not overlap",
        },
      ],
    });
  }

  dna.structuralFingerprint.geometricChecksum =
    geometricChecksumFromRegions(allRegions);

  const overlapWarnings = detectLayerOverlap(dna);
  return { dna, overlapWarnings };
}
