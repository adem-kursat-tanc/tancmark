import { mockFixtureForCandidateRank } from "./candidateVerificationMockFixtures";
import type {
  DiscoveryCandidateVerificationCandidate,
  DiscoveryCandidateVerificationMockScenario,
} from "./types";

export interface CandidateVerificationBridgeResult {
  analyzerDecisionSource: "mock_existing_tancmark_analyzer";
  mockScenario: DiscoveryCandidateVerificationMockScenario;
  tancmarkIdRead: string | null;
  matchedDocId: string | null;
  matchedClientId: string | null;
  idMatch: boolean;
  matchingBits: number;
  supportPercent: number;
  realAnalyzeEnabled: false;
}

export function runMockExistingTancMarkAnalyzer(input: {
  candidate: DiscoveryCandidateVerificationCandidate;
  expectedDocId: string | null;
  expectedClientId: string;
}): CandidateVerificationBridgeResult {
  const fixture = mockFixtureForCandidateRank(input.candidate.rank);
  return {
    analyzerDecisionSource: "mock_existing_tancmark_analyzer",
    mockScenario: fixture.scenario,
    tancmarkIdRead: fixture.tancmarkIdRead,
    matchedDocId: fixture.idMatch ? input.expectedDocId : null,
    matchedClientId: fixture.idMatch ? input.expectedClientId : null,
    idMatch: fixture.idMatch,
    matchingBits: fixture.matchingBits,
    supportPercent: fixture.supportPercent,
    realAnalyzeEnabled: false,
  };
}

