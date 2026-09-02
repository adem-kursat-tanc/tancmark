import { createHash } from "node:crypto";
import type { CanonicalDnaId, DnaApprovalClass } from "./canonicalDnaRegistry";
import { VIDEO_CANONICAL_BASELINE_COMMIT } from "./canonicalDnaAdapters";

export const CHIEF_BRAIN_VERSION = "tancmark-chief-brain-advisory-v1" as const;
export const CHIEF_BRAIN_APPROVAL_PHRASE = "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export interface DnaHealthSignal {
  dnaId: CanonicalDnaId;
  health: "HEALTHY" | "WEAK" | "FAILED" | "STALE" | "NOT_MEASURED";
  evidenceRecordIds: string[];
  solvedCanonical: boolean;
  solvedCommit: string | null;
  sourceHashChanged: boolean;
  newRealNegativeFailure: boolean;
  securityVulnerabilityFound: boolean;
  ownerNewRequirement: boolean;
  strengthScore: number;
  observedProblem: string | null;
}

export interface PriorSolvedCapabilityCheck {
  checked: true;
  solvedCanonical: boolean;
  canonicalCommit: string | null;
  canonicalHashChanged: boolean;
  newRealNegativeFailure: boolean;
  securityVulnerabilityFound: boolean;
  ownerNewRequirement: boolean;
  decision: "DO_NOT_REOPEN" | "REAL_REGRESSION_REVIEW" | "NOT_PREVIOUSLY_SOLVED";
}

export interface ChiefBrainProposal {
  proposalVersion: typeof CHIEF_BRAIN_VERSION;
  proposalId: string;
  proposalDigest: string;
  originatingDnaIds: CanonicalDnaId[];
  evidenceRecordIds: string[];
  problemStatement: string;
  priorSolvedCapabilityCheck: PriorSolvedCapabilityCheck;
  rootCause: string;
  proposedChange: string;
  expectedBenefit: string;
  affectedModules: string[];
  regressionRisk: "low" | "medium" | "high";
  securityRisk: "low" | "medium" | "high";
  legalLicenseRisk: "low" | "medium" | "high";
  costImpact: string;
  testPlan: string[];
  negativeControls: string[];
  rollbackPlan: string[];
  patchPreview: string;
  approvalClass: DnaApprovalClass;
  approvalRequired: true;
  forbiddenReasons: string[];
  applyReadiness:
    | "OWNER_APPROVAL_REQUIRED"
    | "HIGH_RISK_ENGINEERING_REVIEW_REQUIRED"
    | "NOT_APPLICABLE_DO_NOT_REOPEN"
    | "FORBIDDEN";
  canSelfApprove: false;
  canOpenVault: false;
  canChangeOwnership: false;
  autoApply: false;
}

export interface ChiefBrainSummary {
  chiefBrainCountedAsDna: false;
  dnaCountRead: number;
  weakestDnaId: CanonicalDnaId | null;
  strongestDnaId: CanonicalDnaId | null;
  staleDnaIds: CanonicalDnaId[];
  conflictDetected: boolean;
  recommendedDecision: "ADVISORY_ONLY" | "MANUAL_REVIEW";
  proposals: ChiefBrainProposal[];
}

function stableDigest(value: unknown): string {
  function canonical(item: unknown): string {
    if (item === null || typeof item !== "object") return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    const record = item as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function priorSolvedCheck(signal: DnaHealthSignal): PriorSolvedCapabilityCheck {
  const legitimateReopen = signal.sourceHashChanged || signal.newRealNegativeFailure ||
    signal.securityVulnerabilityFound || signal.ownerNewRequirement;
  return {
    checked: true,
    solvedCanonical: signal.solvedCanonical,
    canonicalCommit: signal.solvedCommit,
    canonicalHashChanged: signal.sourceHashChanged,
    newRealNegativeFailure: signal.newRealNegativeFailure,
    securityVulnerabilityFound: signal.securityVulnerabilityFound,
    ownerNewRequirement: signal.ownerNewRequirement,
    decision: signal.solvedCanonical
      ? legitimateReopen ? "REAL_REGRESSION_REVIEW" : "DO_NOT_REOPEN"
      : "NOT_PREVIOUSLY_SOLVED",
  };
}

function proposalFor(signal: DnaHealthSignal): ChiefBrainProposal {
  const prior = priorSolvedCheck(signal);
  const doNotReopen = prior.decision === "DO_NOT_REOPEN";
  const highRisk = signal.newRealNegativeFailure || signal.securityVulnerabilityFound;
  const body = {
    dnaId: signal.dnaId,
    evidence: signal.evidenceRecordIds,
    health: signal.health,
    prior,
  };
  const digest = stableDigest(body);
  const approvalClass: DnaApprovalClass = doNotReopen
    ? "SAFE_AUTOMATIC_LEARNING"
    : highRisk ? "HIGH_RISK_MANUAL_ENGINEERING_REVIEW" : "MEDIUM_RISK_OWNER_APPROVAL";
  return {
    proposalVersion: CHIEF_BRAIN_VERSION,
    proposalId: `dna-proposal-${digest.slice(0, 20)}`,
    proposalDigest: digest,
    originatingDnaIds: [signal.dnaId],
    evidenceRecordIds: signal.evidenceRecordIds,
    problemStatement: doNotReopen
      ? `${signal.dnaId} daha once cozulmus ve kanonik kaynak degismemistir.`
      : signal.observedProblem ?? `${signal.dnaId} icin yeni dogrulanmis zayiflik incelenmelidir.`,
    priorSolvedCapabilityCheck: prior,
    rootCause: doNotReopen
      ? "Yeni oturum veya klasor teknik regresyon kaniti degildir."
      : "Kok neden kanit-temelli izole testte belirlenmelidir; Chief Brain tahminle urun kodu degistiremez.",
    proposedChange: doNotReopen
      ? "DO_NOT_REOPEN; mevcut SOLVED_CANONICAL kaydini koru."
      : "Izole patch preview hazirla; owner ve muhendislik onayi olmadan uygulama yapma.",
    expectedBenefit: doNotReopen
      ? "Cozulmus isin tekrarlanmasini ve kanonik davranisin bozulmasini onler."
      : "Gercek regresyonu kanonik davranisi koruyarak sinirli ve geri alinabilir sekilde inceler.",
    affectedModules: [signal.dnaId],
    regressionRisk: highRisk ? "high" : "medium",
    securityRisk: signal.securityVulnerabilityFound ? "high" : "low",
    legalLicenseRisk: "low",
    costImpact: "Olculmeden maliyet iddiasi yok; izole test butcesi owner incelemesine sunulur.",
    testPlan: [
      "Dondurulmus girdilerle mevcut davranisi yeniden dogrula",
      "Exact ID, registry ve imza karar zincirini degistirmeden karsilastir",
      "Held-out ve negatif kontrolleri calistir",
    ],
    negativeControls: ["wrong ID -> no VAULT", "no ID -> no VAULT", "wrong tenant -> no result", "unsealed -> no result"],
    rollbackPlan: ["Exact patch tersini dry-run kontrol et", "Kaynak hashleri degismediyse kanonik committe kal"],
    patchPreview: doNotReopen ? "NO_PATCH_DO_NOT_REOPEN" : "PATCH_PREVIEW_REQUIRED_BEFORE_APPLY",
    approvalClass,
    approvalRequired: true,
    forbiddenReasons: [],
    applyReadiness: doNotReopen
      ? "NOT_APPLICABLE_DO_NOT_REOPEN"
      : highRisk ? "HIGH_RISK_ENGINEERING_REVIEW_REQUIRED" : "OWNER_APPROVAL_REQUIRED",
    canSelfApprove: false,
    canOpenVault: false,
    canChangeOwnership: false,
    autoApply: false,
  };
}

export function buildChiefBrainSummary(
  signals: readonly DnaHealthSignal[],
  conflictingAuthoritativeModules: boolean,
): ChiefBrainSummary {
  const sorted = [...signals].sort((a, b) => a.strengthScore - b.strengthScore);
  const actionable = signals.filter((signal) =>
    signal.health === "WEAK" || signal.health === "FAILED" || signal.newRealNegativeFailure ||
    signal.securityVulnerabilityFound ||
    (signal.solvedCanonical && !signal.sourceHashChanged && signal.dnaId === "video"),
  );
  return {
    chiefBrainCountedAsDna: false,
    dnaCountRead: new Set(signals.map((signal) => signal.dnaId)).size,
    weakestDnaId: sorted[0]?.dnaId ?? null,
    strongestDnaId: sorted.at(-1)?.dnaId ?? null,
    staleDnaIds: signals.filter((signal) => signal.health === "STALE").map((signal) => signal.dnaId),
    conflictDetected: conflictingAuthoritativeModules,
    recommendedDecision: conflictingAuthoritativeModules ? "MANUAL_REVIEW" : "ADVISORY_ONLY",
    proposals: actionable.map(proposalFor),
  };
}

export function canonicalVideoHealthSignal(overrides: Partial<DnaHealthSignal> = {}): DnaHealthSignal {
  return {
    dnaId: "video",
    health: "HEALTHY",
    evidenceRecordIds: ["video-primary-canonical-evidence"],
    solvedCanonical: true,
    solvedCommit: VIDEO_CANONICAL_BASELINE_COMMIT,
    sourceHashChanged: false,
    newRealNegativeFailure: false,
    securityVulnerabilityFound: false,
    ownerNewRequirement: false,
    strengthScore: 1,
    observedProblem: null,
    ...overrides,
  };
}
