/**
 * AEGIS Orchestrator — Barrel
 * ─────────────────────────────────────────────────────────────────────
 * Tek import noktası. Mevcut route'lar buradan tüketir; iç dosya
 * yapısını değiştirsek bile dış tüketim sabit kalır.
 */

export {
  detectActiveModules,
  type AegisModuleKind,
  type AegisModuleStatus,
  type ActiveModuleEntry,
  type DetectActiveModulesInput,
  type DetectActiveModulesResult,
} from "./detectActiveModules.js";

export {
  videoToEvidence,
  imageToEvidence,
  textToEvidence,
  mergeEvidence,
  type EvidenceItem,
  type VideoEvidenceInput,
  type ImageEvidenceInput,
  type TextEvidenceInput,
} from "./evidenceChain.js";

export {
  commonDecisionTail,
  type CommonDecisionTailInput,
  type CommonDecisionTailOutput,
  type OrchestratorDecision,
  type DnaUsageStatus,
  type DnaUsageStatusKind,
} from "./commonDecisionTail.js";

export {
  searchOrchestrator,
  type SearchOrchestratorInput,
  type SearchOrchestratorOutput,
} from "./searchOrchestrator.js";

export {
  sealOrchestrator,
  type SealOrchestratorInput,
  type SealOrchestratorOutput,
  type SealPlanEntry,
} from "./sealOrchestrator.js";

export {
  buildCommonMediaDecisionPhase1,
  type CommonMediaDecisionPhase1,
  type CommonMediaModulePhase1,
  type BuildCommonMediaDecisionPhase1Input,
} from "./commonMediaDecision.js";

// ── AEGIS DNA — Faz 1 Seal Advisory read-only re-exports ──
// Davranış değiştirmez; sadece tip + advisory builder görünür.
export {
  DNA_SEAL_ADVISORY_AUTHORITY,
  buildVideoSealAdvisory,
  buildImageSealAdvisory,
  buildTextSealAdvisory,
  type DnaSealAdvisory,
  type DnaSealAdvisoryAuthority,
  type BuildSealAdvisoryContext,
  type SuggestedRegion,
  type ReservedZone,
  type ForbiddenZone,
  type ModuleConflictWarning,
  type RecommendedFrameHint,
  type RecommendedAnchorHint,
  type LayerOwnership,
  type ExpectedSearchHint,
} from "../dna/dnaSealAdvisory.js";

export {
  projectDnaSealAdvisory,
  type DnaSealAdvisoryProjection,
} from "../dna/dnaSealAdvisoryProjection.js";
