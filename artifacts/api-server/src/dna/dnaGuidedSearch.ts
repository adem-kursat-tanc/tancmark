/**
 * AEGIS DNA — arama-tarafı öncelik haritası (v0.6.8, advisory only).
 *
 * Ana karar/verdict kurallarına dokunmaz. DNA'da işaretli katmanları
 * mevcut arama sonucundaki gözlemlenen katmanlarla karşılaştırır;
 * "DNA-guided" eşleşme ipucunu ayrı bir rapor alanı olarak döner.
 *
 * Mevcut doğrulama kapıları (eşik, A5, Layer B, T6, FRAME_VAULT_*,
 * STRONG_R1_THR, visual karar kuralları, scan-cloak verdict ladder)
 * AYNEN korunur. Bu modül "found_match" dese bile ana karar
 * `result.found` / `result.verdict` / `visualVaultConfirmed` mevcut
 * doğrulamaya bağlı kalır.
 */

import type { DnaReport } from "./dnaReport.js";

export type DnaGuidedHint =
  | "no_hint"
  | "found_match"
  | "found_no_match";

export interface DnaGuidedSearch {
  /** DNA'ya bakma denendi mi (DNA mevcut mu)? */
  attempted: boolean;
  /** DNA kaydı bulundu mu? */
  dnaPresent: boolean;
  /** DNA'da aktif olarak işaretli katmanlar (öncelik haritası). */
  expectedLayers: ReadonlyArray<string>;
  /** Arama sonucunda gözlemlenen katmanlar (caller'dan gelir). */
  observedLayers: ReadonlyArray<string>;
  /** DNA'da ve gözlemde ortak olan katmanlar. */
  matchedLayers: ReadonlyArray<string>;
  /** DNA'da var, gözlemde yok. */
  missingLayers: ReadonlyArray<string>;
  /** Gözlemde var, DNA'da yok. */
  extraLayers: ReadonlyArray<string>;
  /** Özet ipucu. */
  hint: DnaGuidedHint;
  /** Mimari sözleşme (yapısal not). */
  contract:
    "DNA-guided öncelik haritası ADVISORY; ana karar/verdict mevcut doğrulama kapılarına bağlı, DNA tek başına başarı kanıtı değildir.";
}

const CONTRACT_NOTE =
  "DNA-guided öncelik haritası ADVISORY; ana karar/verdict mevcut doğrulama kapılarına bağlı, DNA tek başına başarı kanıtı değildir." as const;

/**
 * DNA raporu ile arama gözlemini karşılaştır.
 *
 * `report.present=false` veya `observedLayerIds` boş ise hint "no_hint"
 * döner ve advisory bilgisidir; karar zincirini etkilemez.
 */
export function buildDnaGuidedSearch(
  report: DnaReport,
  observedLayerIds: ReadonlyArray<string>,
): DnaGuidedSearch {
  if (!report.present) {
    return {
      attempted: false,
      dnaPresent: false,
      expectedLayers: [],
      observedLayers: observedLayerIds,
      matchedLayers: [],
      missingLayers: [],
      extraLayers: observedLayerIds,
      hint: "no_hint",
      contract: CONTRACT_NOTE,
    };
  }
  const expected = (report.layers ?? [])
    .filter((l) => l.active)
    .map((l) => l.layerId);
  const observedSet = new Set(observedLayerIds);
  const expectedSet = new Set(expected);
  const matched = expected.filter((id) => observedSet.has(id));
  const missing = expected.filter((id) => !observedSet.has(id));
  const extras = observedLayerIds.filter((id) => !expectedSet.has(id));
  let hint: DnaGuidedHint;
  if (matched.length > 0) {
    hint = "found_match";
  } else if (expected.length > 0) {
    hint = "found_no_match";
  } else {
    hint = "no_hint";
  }
  return {
    attempted: true,
    dnaPresent: true,
    expectedLayers: expected,
    observedLayers: observedLayerIds,
    matchedLayers: matched,
    missingLayers: missing,
    extraLayers: extras,
    hint,
    contract: CONTRACT_NOTE,
  };
}
