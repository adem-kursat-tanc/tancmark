import {
  CanonicalLearningDnaMemory,
  type CanonicalEvidenceClass,
  type CanonicalLearningAppendResult,
  type CanonicalObservationClass,
  type CanonicalRiskClass,
} from "./learningDnaMemory";
import type { CanonicalDnaId } from "./canonicalDnaRegistry";

export const VIDEO_CANONICAL_BASELINE_COMMIT = "e071fed7dc896ca3bd95158a438f9a0c2cb2309f" as const;

export interface RedactedLearningReceipt {
  receiptId: string;
  tenantScope: string;
  moduleId: string;
  sourceType: string;
  sourceEvidenceId: string;
  sourceCreatedAt: string;
  observedAt: string;
  sourceCodeCommit: string;
  sourceCodeTree: string;
  sourceFileHashes: Record<string, string>;
  runtimeIdentity: string;
  algorithmVersion: string;
  testContractVersion: string;
  mediaClass: string;
  evidenceClass: CanonicalEvidenceClass;
  observationClass: CanonicalObservationClass;
  exactIdMatched: boolean;
  partialMatchedUnits: number;
  partialTotalUnits: number;
  registryVerified: boolean;
  signatureVerified: boolean;
  wrongIdResult: string;
  noIdResult: string;
  wrongTenantResult: string;
  unsealedResult: string;
  authoritativeDecision: string;
  learnedSignals: string[];
  limitations: string[];
  riskLevel?: CanonicalRiskClass;
  privateEvidenceReference?: string;
}

export type CanonicalLearningAdapter = (
  memory: CanonicalLearningDnaMemory,
  receipt: RedactedLearningReceipt,
) => CanonicalLearningAppendResult;

function createAdapter(dnaId: CanonicalDnaId): CanonicalLearningAdapter {
  return (memory, receipt) => {
    if (dnaId === "video" && receipt.sourceCodeCommit !== VIDEO_CANONICAL_BASELINE_COMMIT) {
      throw new Error("VIDEO_DNA_BASELINE_COMMIT_MISMATCH");
    }
    const partialMatchPercent = receipt.partialTotalUnits === 0
      ? 0
      : Number(((receipt.partialMatchedUnits / receipt.partialTotalUnits) * 100).toFixed(6));
    return memory.append({
      eventId: receipt.receiptId,
      tenantScope: receipt.tenantScope,
      moduleId: receipt.moduleId,
      dnaId,
      sourceType: receipt.sourceType,
      sourceEvidenceId: receipt.sourceEvidenceId,
      sourceCreatedAt: receipt.sourceCreatedAt,
      observedAt: receipt.observedAt,
      sourceCodeCommit: receipt.sourceCodeCommit,
      sourceCodeTree: receipt.sourceCodeTree,
      sourceFileHashes: receipt.sourceFileHashes,
      runtimeIdentity: receipt.runtimeIdentity,
      algorithmVersion: receipt.algorithmVersion,
      testContractVersion: receipt.testContractVersion,
      mediaClass: receipt.mediaClass,
      evidenceClass: receipt.evidenceClass,
      observationClass: receipt.observationClass,
      exactIdMatched: receipt.exactIdMatched,
      partialMatchedUnits: receipt.partialMatchedUnits,
      partialTotalUnits: receipt.partialTotalUnits,
      partialMatchPercent,
      registryVerified: receipt.registryVerified,
      signatureVerified: receipt.signatureVerified,
      wrongIdResult: receipt.wrongIdResult,
      noIdResult: receipt.noIdResult,
      wrongTenantResult: receipt.wrongTenantResult,
      unsealedResult: receipt.unsealedResult,
      decisionBefore: receipt.authoritativeDecision,
      decisionAfter: receipt.authoritativeDecision,
      decisionChanged: false,
      learnedSignals: receipt.learnedSignals,
      limitations: receipt.limitations,
      riskLevel: receipt.riskLevel ?? "SAFE_AUTOMATIC_LEARNING",
      redactionState: "REDACTED_NO_PRIVATE_CONTENT",
      createdBy: `canonical-adapter:${dnaId}`,
      privateEvidenceReference: receipt.privateEvidenceReference ?? null,
    });
  };
}

// Existing format-specific adapters remain authoritative for extracting their
// receipts. These delegates only normalize already-redacted receipts into the
// one canonical memory writer.
export const formatLearningAdapter = createAdapter("format");
export const visualLearningAdapterV1 = createAdapter("image");
export const videoLearningAdapterV1 = createAdapter("video");
export const audioLearningAdapterV1 = createAdapter("audio");
export const textLearningAdapterV1 = createAdapter("text-document");
export const discoverySearchLearningAdapter = createAdapter("discovery-search");
export const liveLearningAdapter = createAdapter("tanclive");
export const secureRoomLearningAdapter = createAdapter("secure-room-zehir");
export const evidenceLearningAdapter = createAdapter("evidence");
export const legalLicenseLearningAdapter = createAdapter("license-product-gate");
export const securityLearningAdapter = createAdapter("security");
export const userSubscriptionLearningAdapter = createAdapter("user-subscription");
export const costMarginLearningAdapter = createAdapter("pricing-cost");
export const infrastructureLearningAdapter = createAdapter("saas-operations");
export const productMarketingLearningAdapter = createAdapter("product-marketing-legal");
export const codexDevelopmentLearningAdapter = createAdapter("codex-development");

export const CANONICAL_LEARNING_ADAPTERS: Readonly<Record<CanonicalDnaId, CanonicalLearningAdapter>> = {
  format: formatLearningAdapter,
  image: visualLearningAdapterV1,
  video: videoLearningAdapterV1,
  audio: audioLearningAdapterV1,
  "text-document": textLearningAdapterV1,
  "discovery-search": discoverySearchLearningAdapter,
  tanclive: liveLearningAdapter,
  "secure-room-zehir": secureRoomLearningAdapter,
  evidence: evidenceLearningAdapter,
  "license-product-gate": legalLicenseLearningAdapter,
  security: securityLearningAdapter,
  "user-subscription": userSubscriptionLearningAdapter,
  "pricing-cost": costMarginLearningAdapter,
  "saas-operations": infrastructureLearningAdapter,
  "product-marketing-legal": productMarketingLearningAdapter,
  "codex-development": codexDevelopmentLearningAdapter,
};
