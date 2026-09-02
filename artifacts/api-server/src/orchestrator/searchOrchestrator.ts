/**
 * AEGIS Orchestrator — Search Orchestrator (wrapper iskelet)
 * ─────────────────────────────────────────────────────────────────────
 * Bu sprintte mevcut route'ları YENİDEN YAZMAZ. Var olan
 * video/image/text decode sonuçlarını ortak `EvidenceItem[]` listesine
 * çeviren wrapper. Gelecekte `searchContent(input, dna)` girişine zemin.
 *
 * KIRMIZI ÇİZGİ:
 *  - Decode pipeline çağırmaz; caller modülün karar sonucunu HAZIR verir.
 *  - Karar üretmez; yalnız topluyor.
 *  - lib/aegis-core'a dokunmaz.
 */

import {
  videoToEvidence,
  imageToEvidence,
  textToEvidence,
  mergeEvidence,
  type EvidenceItem,
  type VideoEvidenceInput,
  type ImageEvidenceInput,
  type TextEvidenceInput,
} from "./evidenceChain.js";

export interface SearchOrchestratorInput {
  video?: VideoEvidenceInput;
  image?: ImageEvidenceInput;
  text?: TextEvidenceInput;
}

export interface SearchOrchestratorOutput {
  evidence: EvidenceItem[];
}

/** Caller'ın hazır decode sonuçlarını ortak delil zincirine çevirir. */
export function searchOrchestrator(
  input: SearchOrchestratorInput,
): SearchOrchestratorOutput {
  const lists: EvidenceItem[][] = [];
  if (input.video) lists.push(videoToEvidence(input.video));
  if (input.image) lists.push(imageToEvidence(input.image));
  if (input.text) lists.push(textToEvidence(input.text));
  return { evidence: mergeEvidence(...lists) };
}
