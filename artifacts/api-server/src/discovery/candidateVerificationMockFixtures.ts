import type {
  DiscoveryCandidateVerificationMockScenario,
  DiscoveryCandidateVerificationStatus,
} from "./types";

export interface CandidateVerificationMockFixture {
  scenario: DiscoveryCandidateVerificationMockScenario;
  verificationStatus: DiscoveryCandidateVerificationStatus;
  tancmarkIdRead: string | null;
  idMatch: boolean;
  matchingBits: number;
  supportPercent: number;
}

export const CANDIDATE_VERIFICATION_MOCK_FIXTURES: CandidateVerificationMockFixture[] = [
  {
    scenario: "valid_tancmark_id_match",
    verificationStatus: "verified_by_tancmark_mock",
    tancmarkIdRead: "mock-tancmark-id-match",
    idMatch: true,
    matchingBits: 32,
    supportPercent: 100,
  },
  {
    scenario: "wrong_tancmark_id",
    verificationStatus: "wrong_id_mock",
    tancmarkIdRead: "mock-wrong-tancmark-id",
    idMatch: false,
    matchingBits: 0,
    supportPercent: 0,
  },
  {
    scenario: "no_tancmark_id",
    verificationStatus: "no_id_mock",
    tancmarkIdRead: null,
    idMatch: false,
    matchingBits: 0,
    supportPercent: 0,
  },
  {
    scenario: "partial_candidate_support",
    verificationStatus: "partial_support_mock",
    tancmarkIdRead: "mock-partial-tancmark-id",
    idMatch: false,
    matchingBits: 29,
    supportPercent: 90.625,
  },
  {
    scenario: "unreadable_media",
    verificationStatus: "unreadable_mock",
    tancmarkIdRead: null,
    idMatch: false,
    matchingBits: 0,
    supportPercent: 0,
  },
  {
    scenario: "unsupported_media",
    verificationStatus: "unsupported_media_mock",
    tancmarkIdRead: null,
    idMatch: false,
    matchingBits: 0,
    supportPercent: 0,
  },
  {
    scenario: "blocked_private_or_login_required",
    verificationStatus: "skipped_by_policy",
    tancmarkIdRead: null,
    idMatch: false,
    matchingBits: 0,
    supportPercent: 0,
  },
  {
    scenario: "skipped_by_policy",
    verificationStatus: "skipped_by_policy",
    tancmarkIdRead: null,
    idMatch: false,
    matchingBits: 0,
    supportPercent: 0,
  },
];

export function mockFixtureForCandidateRank(rank: number): CandidateVerificationMockFixture {
  const index = Math.max(0, rank - 1) % CANDIDATE_VERIFICATION_MOCK_FIXTURES.length;
  return CANDIDATE_VERIFICATION_MOCK_FIXTURES[index] ?? CANDIDATE_VERIFICATION_MOCK_FIXTURES[0];
}

