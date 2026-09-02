export const AUDIO_EXACT_MATCH_BITS = 32;

export type AudioSupportLevel =
  | "exact_vault_candidate"
  | "strong_candidate"
  | "medium_candidate"
  | "weak_signal"
  | "not_found";

export interface AudioSupportAdvisory {
  exactMatchBits: number;
  matchingBits: number;
  matchPercent: number;
  audioSupportLevel: AudioSupportLevel;
  candidateSupportOnly: boolean;
}

function normalizeMatchingBits(matchingBits: number): number {
  if (!Number.isFinite(matchingBits)) return 0;
  return Math.max(0, Math.min(AUDIO_EXACT_MATCH_BITS, Math.round(matchingBits)));
}

export function audioSupportLevelForBits(
  matchingBitsInput: number,
): AudioSupportLevel {
  const matchingBits = normalizeMatchingBits(matchingBitsInput);
  if (matchingBits === AUDIO_EXACT_MATCH_BITS) return "exact_vault_candidate";
  if (matchingBits >= 30) return "strong_candidate";
  if (matchingBits >= 24) return "medium_candidate";
  if (matchingBits >= 1) return "weak_signal";
  return "not_found";
}

export function buildAudioSupportAdvisory(
  matchingBitsInput: number,
): AudioSupportAdvisory {
  const matchingBits = normalizeMatchingBits(matchingBitsInput);
  return {
    exactMatchBits: AUDIO_EXACT_MATCH_BITS,
    matchingBits,
    matchPercent:
      Math.round((matchingBits / AUDIO_EXACT_MATCH_BITS) * 1000) / 10,
    audioSupportLevel: audioSupportLevelForBits(matchingBits),
    candidateSupportOnly: matchingBits !== AUDIO_EXACT_MATCH_BITS,
  };
}
