import {
  buildAudioSupportAdvisory,
  type AudioSupportLevel,
} from "./audioSupportAdvisory";

export type AudioVaultFeatureGateRejectionReason =
  | "feature_gate_disabled"
  | "audio_id_not_exact_32_32"
  | "audio_claim_client_id_required"
  | "audio_registry_record_missing_or_mismatch"
  | "audio_ownership_client_mismatch"
  | "audio_doc_id_required"
  | "audio_ownership_doc_mismatch"
  | "negative_safety_not_passed";

export interface AudioVaultFeatureGateDecisionInput {
  featureGateEnabled: boolean;
  idMatched: boolean;
  matchingBitsMax: number;
  expectedDnaId: string;
  registryDnaId: string | null;
  registryClientId: string | null;
  registryDocId: string | null;
  claimClientId: string | null;
  claimDocId: string | null;
  negativeSafetyPassed: boolean;
}

export interface AudioVaultFeatureGateDecision {
  featureGateEnabled: boolean;
  internalRolloutOnly: true;
  audioConfirmed: boolean;
  audioVaultEligible: boolean;
  confirmed: boolean;
  canOpenVault: boolean;
  vaultEligible: boolean;
  final: false;
  decisionBasis:
    | "AUDIO_VAULT_FEATURE_GATE_EXACT_ID_REGISTRY_OWNERSHIP_MATCH"
    | "AUDIO_VAULT_FEATURE_GATE_REJECTED";
  rejectionReason: AudioVaultFeatureGateRejectionReason | null;
  exactMatchBits: number;
  matchingBits: number;
  matchPercent: number;
  audioSupportLevel: AudioSupportLevel;
  idMatched: boolean;
  registryMatched: boolean;
  clientMatched: boolean;
  docMatched: boolean;
  ownershipMatched: boolean;
  docIdRequired: true;
  negativeSafetyPassed: boolean;
  candidateSupportOnly: boolean;
  candidateSupportOnlyNoVault: boolean;
  decisionRole: "feature_gated_audio_vault_exact_id_registry_ownership_only";
  ignoredSignalsForDecision: string[];
}

export function evaluateAudioVaultFeatureGateDecision(
  input: AudioVaultFeatureGateDecisionInput,
): AudioVaultFeatureGateDecision {
  const advisory = buildAudioSupportAdvisory(input.matchingBitsMax);
  const exactId =
    input.idMatched && advisory.matchingBits === advisory.exactMatchBits;
  const registryMatched = input.registryDnaId === input.expectedDnaId;
  const clientMatched =
    registryMatched &&
    input.claimClientId !== null &&
    input.registryClientId === input.claimClientId;
  const docPresent = input.claimDocId !== null && input.registryDocId !== null;
  const docMatched =
    clientMatched && docPresent && input.registryDocId === input.claimDocId;
  const ownershipMatched = clientMatched && docMatched;

  let rejectionReason: AudioVaultFeatureGateRejectionReason | null = null;
  if (!input.featureGateEnabled) {
    rejectionReason = "feature_gate_disabled";
  } else if (!exactId) {
    rejectionReason = "audio_id_not_exact_32_32";
  } else if (input.claimClientId === null) {
    rejectionReason = "audio_claim_client_id_required";
  } else if (!registryMatched) {
    rejectionReason = "audio_registry_record_missing_or_mismatch";
  } else if (!clientMatched) {
    rejectionReason = "audio_ownership_client_mismatch";
  } else if (!docPresent) {
    rejectionReason = "audio_doc_id_required";
  } else if (!docMatched) {
    rejectionReason = "audio_ownership_doc_mismatch";
  } else if (!input.negativeSafetyPassed) {
    rejectionReason = "negative_safety_not_passed";
  }

  const accepted = rejectionReason === null;
  return {
    featureGateEnabled: input.featureGateEnabled,
    internalRolloutOnly: true,
    audioConfirmed: accepted,
    audioVaultEligible: accepted,
    confirmed: accepted,
    canOpenVault: accepted,
    vaultEligible: accepted,
    final: false,
    decisionBasis: accepted
      ? "AUDIO_VAULT_FEATURE_GATE_EXACT_ID_REGISTRY_OWNERSHIP_MATCH"
      : "AUDIO_VAULT_FEATURE_GATE_REJECTED",
    rejectionReason,
    exactMatchBits: advisory.exactMatchBits,
    matchingBits: advisory.matchingBits,
    matchPercent: advisory.matchPercent,
    audioSupportLevel: advisory.audioSupportLevel,
    idMatched: input.idMatched,
    registryMatched,
    clientMatched,
    docMatched,
    ownershipMatched,
    docIdRequired: true,
    negativeSafetyPassed: input.negativeSafetyPassed,
    candidateSupportOnly: advisory.candidateSupportOnly,
    candidateSupportOnlyNoVault: !accepted,
    decisionRole: "feature_gated_audio_vault_exact_id_registry_ownership_only",
    ignoredSignalsForDecision: [
      "dna_advisory",
      "c2pa",
      "ecc",
      "ocr",
      "metadata",
      "candidate_support",
      "partial_id",
    ],
  };
}
