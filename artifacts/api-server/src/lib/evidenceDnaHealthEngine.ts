import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const EVIDENCE_DNA_HEALTH_ENGINE_VERSION = "evidence-dna-health-engine-v0.1" as const;

export interface EvidenceDnaHealthSummary extends HierarchicalDnaHealthSummary {
  evidenceEngineVersion: typeof EVIDENCE_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestEvidenceLayers: string[];
  missingEvidenceLayers: string[];
  supportOnlyReports: string[];
  notFinalEvidenceLayers: string[];
  productEvidenceReadiness: string;
  canDecideFinalEvidence: false;
  nextEvidenceWork: string;
}

const EVIDENCE_LEARNS_FROM_SIGNALS = [
  "PDF evidence report",
  "hash records",
  "timestamp",
  "C2PA",
  "OpenTimestamps",
  "blockchain support",
  "support evidence report",
  "evidence package gap",
  "evidence strength/weakness",
] as const;

const EVIDENCE_ENGINE_CONFIG = {
  dnaName: "Evidence/Delil DNA",
  modules: ["evidence", "format_layers", "live_tanclive", "license_product_gate", "secure_room"] as const,
  eventTypes: [
    "evidence_signal",
    "license_gate_signal",
    "live_test_result",
    "live_signal",
    "secure_room_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "evidence",
    "delil",
    "pdf report",
    "hash",
    "timestamp",
    "c2pa",
    "opentimestamps",
    "blockchain",
    "proof",
    "support report",
    "package",
    "vault",
    "final",
  ] as const,
  readinessNote:
    "Evidence DNA summarizes proof package strength only; legal/final decisions remain outside DNA.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Build evidence package readiness matrix",
      reason:
        "Evidence layers are useful, but support reports, hash/timestamp proof and final legal proof must stay separate.",
      nextStep:
        "Prepare a support-only evidence matrix for report, hash, timestamp, C2PA, OpenTimestamps and blockchain support.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildEvidenceDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): EvidenceDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(EVIDENCE_ENGINE_CONFIG, input);

  return {
    ...base,
    evidenceEngineVersion: EVIDENCE_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: EVIDENCE_LEARNS_FROM_SIGNALS,
    strongestEvidenceLayers: [
      "hash and timestamp support records",
      "PDF support evidence reports",
      "post-live evidence and ID-read support summaries",
    ],
    missingEvidenceLayers: [
      "final launch evidence package closure",
      "final C2PA/OpenTimestamps/blockchain packaging proof",
      "legal/product final proof language review",
    ],
    supportOnlyReports: [
      "lab/support PDF evidence report",
      "HLS/VOD support evidence report",
      "Discovery candidate support evidence",
    ],
    notFinalEvidenceLayers: [
      "candidate/support evidence without exact embedded ID",
      "OCR/AI advisory signal",
      "Discovery similar-content result",
      "any evidence summary without human/legal review",
    ],
    productEvidenceReadiness:
      "Evidence package is useful for support, but final product launch evidence closure remains open.",
    canDecideFinalEvidence: false,
    nextEvidenceWork:
      "Create a read-only Evidence readiness matrix, then close final report/NOTICE/proof package under human review.",
  };
}
