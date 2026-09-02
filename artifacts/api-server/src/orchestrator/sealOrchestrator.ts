/**
 * AEGIS Orchestrator — Seal Orchestrator (iskelet)
 * ─────────────────────────────────────────────────────────────────────
 * Şu an mevcut encode davranışını DEĞİŞTİRMEZ. Yalnız ileride modüllerin
 * DNA yazımını ortak plana bağlamak için tip/iskelet sağlar.
 *
 * KIRMIZI ÇİZGİ:
 *  - encodeVideo / image / text encode'larını ÇAĞIRMAZ.
 *  - Anchor seçimi / frame seçimi / payload mantığını DEĞİŞTİRMEZ.
 *  - lib/aegis-core'a dokunmaz.
 *  - Bu iskelet ileride sealContent(input, modules) → ortak DNA
 *    persistans + reservedZone disjoint kontrolü için kullanılır.
 */

import type { AegisModuleKind } from "./detectActiveModules.js";
import type { DnaSealAdvisory } from "../dna/dnaSealAdvisory.js";

/** Modülün DNA yazım planı (record-only, henüz aktif değil). */
export interface SealPlanEntry {
  module: AegisModuleKind;
  /** Modülün DNA'sını yazma sözleşmesi (insan-okuru). */
  dnaWritePolicy:
    | "module_writes_own_dna"
    | "deferred_to_module";
  /** Bu modül için DNA katman ID'leri. */
  expectedLayerIds: ReadonlyArray<string>;
}

export interface SealOrchestratorInput {
  modules: ReadonlyArray<AegisModuleKind>;
}

export interface SealOrchestratorOutput {
  plan: SealPlanEntry[];
  /** Sözleşme notu (sabit). */
  contract:
    "sealOrchestrator currently SKELETON — modules continue to write their own DNA via existing routes. No encode behavior change.";
  /**
   * AEGIS DNA Faz 1 — opsiyonel seal advisory iskeleti (L1).
   * Caller doldurursa response'a yansıtılabilir; modüller bu alanı
   * OKUMAZ. authority = "advisory_only_no_seal_gate" SABİT.
   * Final VAULT kapısı modül ID match'inde KALIR.
   */
  sealAdvisory?: DnaSealAdvisory;
}

/**
 * Saf fonksiyon — hangi modülün hangi DNA katmanlarını yazacağına dair
 * salt-okuma plan döner. Mevcut encode davranışı dokunulmaz.
 */
export function sealOrchestrator(
  input: SealOrchestratorInput,
): SealOrchestratorOutput {
  const plan: SealPlanEntry[] = input.modules.map((m) => {
    if (m === "video") {
      return {
        module: m,
        dnaWritePolicy: "module_writes_own_dna",
        expectedLayerIds: ["main-tripleShield", "t6-lowband"],
      };
    }
    if (m === "image") {
      return {
        module: m,
        dnaWritePolicy: "module_writes_own_dna",
        expectedLayerIds: ["image.visual-module-video-frame-seal", "image.main"],
      };
    }
    if (m === "text") {
      return {
        module: m,
        dnaWritePolicy: "module_writes_own_dna",
        expectedLayerIds: ["text.cloak"],
      };
    }
    if (m === "audio") {
      return {
        module: m,
        dnaWritePolicy: "module_writes_own_dna",
        expectedLayerIds: ["audio-v01-dual-fsk"],
      };
    }
    const exhaustive: never = m;
    return {
      module: exhaustive,
      dnaWritePolicy: "deferred_to_module",
      expectedLayerIds: [],
    };
  });
  return {
    plan,
    contract:
      "sealOrchestrator currently SKELETON — modules continue to write their own DNA via existing routes. No encode behavior change.",
  };
}
