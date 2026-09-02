import {
  buildAudioSupportAdvisory,
  type AudioSupportLevel,
} from "./audioSupportAdvisory";

export type AudioVaultPreviewRejectionReason =
  | "audio_id_not_exact_32_32"
  | "audio_registry_record_missing_or_mismatch"
  | "audio_ownership_client_mismatch"
  | "audio_ownership_doc_mismatch";

export interface AudioVaultPreviewDecisionInput {
  idMatched: boolean;
  matchingBitsMax: number;
  expectedDnaId: string;
  registryDnaId: string | null;
  registryClientId: string | null;
  registryDocId: string | null;
  claimClientId: string;
  claimDocId: string | null;
}

export interface AudioVaultPreviewDecision {
  audioConfirmed: boolean;
  audioVaultEligible: boolean;
  decisionBasis:
    | "AUDIO_VAULT_PREVIEW_EXACT_ID_REGISTRY_OWNERSHIP_MATCH"
    | "AUDIO_VAULT_PREVIEW_REJECTED";
  rejectionReason: AudioVaultPreviewRejectionReason | null;
  exactMatchBits: number;
  matchingBits: number;
  matchPercent: number;
  audioSupportLevel: AudioSupportLevel;
  idMatched: boolean;
  registryMatched: boolean;
  ownershipMatched: boolean;
  negativeSafetyPassed: boolean;
  candidateSupportOnly: boolean;
  candidateSupportOnlyNoVault: boolean;
}

export function evaluateAudioVaultPreviewDecision(
  input: AudioVaultPreviewDecisionInput,
): AudioVaultPreviewDecision {
  const advisory = buildAudioSupportAdvisory(input.matchingBitsMax);
  const exactId = input.idMatched && advisory.matchingBits === advisory.exactMatchBits;
  const registryMatched = input.registryDnaId === input.expectedDnaId;
  const clientMatched =
    registryMatched && input.registryClientId === input.claimClientId;
  const docMatched =
    clientMatched &&
    input.claimDocId !== null &&
    input.registryDocId === input.claimDocId;
  const ownershipMatched = clientMatched && docMatched;

  let rejectionReason: AudioVaultPreviewRejectionReason | null = null;
  if (!exactId) rejectionReason = "audio_id_not_exact_32_32";
  else if (!registryMatched) {
    rejectionReason = "audio_registry_record_missing_or_mismatch";
  } else if (!clientMatched) {
    rejectionReason = "audio_ownership_client_mismatch";
  } else if (!docMatched) {
    rejectionReason = "audio_ownership_doc_mismatch";
  }

  const accepted = rejectionReason === null;
  return {
    audioConfirmed: accepted,
    audioVaultEligible: accepted,
    decisionBasis: accepted
      ? "AUDIO_VAULT_PREVIEW_EXACT_ID_REGISTRY_OWNERSHIP_MATCH"
      : "AUDIO_VAULT_PREVIEW_REJECTED",
    rejectionReason,
    exactMatchBits: advisory.exactMatchBits,
    matchingBits: advisory.matchingBits,
    matchPercent: advisory.matchPercent,
    audioSupportLevel: advisory.audioSupportLevel,
    idMatched: input.idMatched,
    registryMatched,
    ownershipMatched,
    negativeSafetyPassed: true,
    candidateSupportOnly: advisory.candidateSupportOnly,
    candidateSupportOnlyNoVault: !accepted,
  };
}
