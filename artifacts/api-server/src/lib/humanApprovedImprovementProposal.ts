import type {
  LearningModule,
  LearningRecommendation,
} from "./learningDnaMemory";

export const HUMAN_APPROVED_IMPROVEMENT_PROPOSAL_VERSION =
  "human-approved-improvement-proposal-v0.1" as const;

export type ImprovementProposalSource =
  | "learningDnaMemory"
  | "videoLab"
  | "learningRecords"
  | "manual";

export type ImprovementProposalRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "forbidden";

export type ImprovementProposalApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export type ImprovementProposalForbiddenTouchpoint =
  | "seal_logic"
  | "read_logic"
  | "vault_confirmed_final"
  | "strong_mode"
  | "ownership_block"
  | "id_thresholds"
  | "missing_id_completion"
  | "auto_apply"
  | "decision_making_support_signal"
  | "remote_push";

export interface ImprovementProposalTouchFlags {
  touchesSealLogic: boolean;
  touchesReadLogic: boolean;
  touchesVaultDecision: boolean;
  touchesStrongMode: boolean;
  touchesOwnershipBlock: boolean;
}

export interface HumanApprovedImprovementProposal {
  proposalVersion: typeof HUMAN_APPROVED_IMPROVEMENT_PROPOSAL_VERSION;
  id: string;
  proposalKey: string;
  source: ImprovementProposalSource;
  title: string;
  summary: string;
  reason: string;
  evidenceRefs: string[];
  affectedModules: LearningModule[];
  affectedFiles: string[];
  riskLevel: ImprovementProposalRiskLevel;
  riskExplanation: string;
  benefit: string;
  proposedChange: string;
  smallStep: string;
  testPlan: string[];
  rollbackPlan: string[];
  safetyChecklist: string[];
  forbiddenTouchpoints: ImprovementProposalForbiddenTouchpoint[];
  requiresHumanApproval: true;
  approvalStatus: ImprovementProposalApprovalStatus;
  patchDraftAllowed: boolean;
  patchApplied: false;
  commitAllowed: false;
  remotePushAllowed: false;
  autoApply: false;
  touchesSealLogic: boolean;
  touchesReadLogic: boolean;
  touchesVaultDecision: boolean;
  touchesStrongMode: boolean;
  touchesOwnershipBlock: boolean;
  createdAt: string;
  redFlags: string[];
  note: string;
}

export interface HumanApprovedImprovementProposalInput {
  id?: string | null;
  proposalKey?: string | null;
  source: ImprovementProposalSource;
  title: string;
  summary: string;
  reason: string;
  evidenceRefs?: string[];
  affectedModules?: LearningModule[];
  affectedFiles?: string[];
  riskLevel?: ImprovementProposalRiskLevel;
  benefit?: string | null;
  proposedChange: string;
  smallStep?: string | null;
  testPlan?: string[];
  rollbackPlan?: string[];
  safetyChecklist?: string[];
  approvalStatus?: ImprovementProposalApprovalStatus;
  touches?: Partial<ImprovementProposalTouchFlags>;
  createdAt?: string;
}

const DEFAULT_SAFETY_CHECKLIST = [
  "Does not change seal encode logic.",
  "Does not change seal read/decode logic.",
  "Does not change ID, VAULT, confirmed, or final-decision gates.",
  "Does not complete missing ID bits by guess.",
  "Does not turn ECC, DNA, C2PA, logo, or candidate support into a decision-maker.",
  "Keeps auto-apply disabled.",
  "Requires explicit human approval before any future patch draft.",
] as const;

const DEFAULT_TEST_PLAN = [
  "Run the smallest relevant isolated validation first.",
  "Run API typecheck.",
  "Run root typecheck.",
  "Run git diff --check.",
  "Verify VAULT/confirmed/final decision behavior remains unchanged.",
] as const;

const DEFAULT_ROLLBACK_PLAN = [
  "Do not apply any patch in this proposal phase.",
  "If a later approved patch changes files, revert only those files.",
  "Do not push remotely from the learning/proposal flow.",
] as const;

function cleanString(value: string | null | undefined, fallback: string, maxLength = 500): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return (trimmed || fallback).slice(0, maxLength);
}

function cleanList(values: readonly string[] | undefined, maxLength = 240): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => cleanString(value, "", maxLength))
        .filter(Boolean),
    ),
  );
}

function slug(value: string, maxLength = 64): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return cleaned || "proposal";
}

function textBag(input: HumanApprovedImprovementProposalInput): string {
  return [
    input.title,
    input.summary,
    input.reason,
    input.benefit,
    input.proposedChange,
    input.smallStep,
    ...(input.affectedFiles ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function hasChangeIntent(value: string): boolean {
  return includesAny(value, [
    "change",
    "allow",
    "accept",
    "enable",
    "open",
    "turn on",
    "relax",
    "override",
    "modify",
    "degistir",
    "değiştir",
    "izin ver",
    "kabul et",
    "ac",
    "aç",
    "gevset",
    "gevşet",
  ]);
}

function proposalActionBag(input: HumanApprovedImprovementProposalInput): string {
  return [
    input.title,
    input.proposedChange,
    input.smallStep,
    ...(input.affectedFiles ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function hasProtectedDecisionSafetyContext(value: string): boolean {
  return includesAny(value, [
    "confirmed=false",
    "confirmed false",
    "vault yok",
    "no vault",
    "vault uretmedi",
    "vault üretmedi",
    "final degismedi",
    "final değişmedi",
    "unchanged",
    "does not change",
    "remain unchanged",
    "cannot confirm",
    "cannot open vault",
    "candidate/support",
    "support-only",
    "support only",
    "advisory",
    "record-only",
    "acma",
    "açma",
    "uretme",
    "üretme",
    "degistirme",
    "değiştirme",
    "korunmali",
    "korunmalı",
    "must not",
    "do not",
    "never",
    "asla",
  ]);
}

function hasExplicitProtectedDecisionChangeIntent(value: string): boolean {
  return includesAny(value, [
    "change vault",
    "change confirmed",
    "change final",
    "modify vault",
    "modify confirmed",
    "modify final",
    "relax vault",
    "relax confirmed",
    "relax final",
    "open vault",
    "enable vault",
    "allow vault",
    "accept vault",
    "vault ac",
    "vault aç",
    "vault kararini degistir",
    "vault kararını değiştir",
    "confirmed kararini degistir",
    "confirmed kararını değiştir",
    "final kararini degistir",
    "final kararını değiştir",
    "confirmed say",
    "confirmed yap",
    "confirmed=true",
    "canopenvault=true",
    "vaulteligible=true",
    "ocr confirmed",
    "ocr ile vault",
    "ocr vault",
  ]);
}

function hasVaultDecisionChangeIntent(value: string): boolean {
  const mentionsProtectedDecision = includesAny(value, [
    "vault",
    "confirmed",
    "final",
    "canopenvault",
    "vaulteligible",
  ]);
  if (!mentionsProtectedDecision) return false;
  const explicitChange = hasExplicitProtectedDecisionChangeIntent(value);
  if (explicitChange) return true;
  if (hasProtectedDecisionSafetyContext(value)) return false;
  return hasChangeIntent(value);
}

function hasAutoApplyChangeIntent(value: string): boolean {
  return includesAny(value, ["auto-apply", "auto apply", "autoapply", "otomatik uygula"]) &&
    hasChangeIntent(value);
}

function hasIdThresholdChangeIntent(value: string): boolean {
  return includesAny(value, ["id threshold", "id esik", "id eÅŸik", "31/32", "threshold"]) &&
    hasChangeIntent(value);
}

function detectTouchFlags(input: HumanApprovedImprovementProposalInput): ImprovementProposalTouchFlags {
  const bag = textBag(input);
  const actionBag = proposalActionBag(input);
  return {
    touchesSealLogic:
      input.touches?.touchesSealLogic === true ||
      includesAny(bag, ["muhur basma", "mühür basma", "seal encode", "stamp", "encodevideo"]),
    touchesReadLogic:
      input.touches?.touchesReadLogic === true ||
      includesAny(bag, ["muhur okuma", "mühür okuma", "seal read", "decode", "analyze-image"]),
    touchesVaultDecision:
      input.touches?.touchesVaultDecision === true ||
      hasVaultDecisionChangeIntent(actionBag),
    touchesStrongMode:
      input.touches?.touchesStrongMode === true ||
      includesAny(bag, ["guclu mod", "güçlü mod", "strong mode", "strong video"]),
    touchesOwnershipBlock:
      input.touches?.touchesOwnershipBlock === true ||
      includesAny(bag, ["pre-seal", "ownership block", "sahiplik blok", "tekrar-muhurleme blok"]),
  };
}

function detectForbiddenTouchpoints(
  input: HumanApprovedImprovementProposalInput,
  touches: ImprovementProposalTouchFlags,
): ImprovementProposalForbiddenTouchpoint[] {
  const bag = textBag(input);
  const actionBag = proposalActionBag(input);
  const result: ImprovementProposalForbiddenTouchpoint[] = [];
  if (touches.touchesSealLogic) result.push("seal_logic");
  if (touches.touchesReadLogic) result.push("read_logic");
  if (touches.touchesVaultDecision) result.push("vault_confirmed_final");
  if (touches.touchesStrongMode) result.push("strong_mode");
  if (touches.touchesOwnershipBlock) result.push("ownership_block");
  if (hasIdThresholdChangeIntent(actionBag)) {
    result.push("id_thresholds");
  }
  if (includesAny(bag, ["missing id", "eksik id", "tamamla", "guess id", "tahminle id"])) {
    result.push("missing_id_completion");
  }
  if (hasAutoApplyChangeIntent(actionBag)) {
    result.push("auto_apply");
  }
  if (includesAny(bag, ["ecc karar", "dna karar", "c2pa karar", "logo karar", "candidate decision"])) {
    result.push("decision_making_support_signal");
  }
  if (includesAny(bag, ["remote push", "git push", "github push"])) {
    result.push("remote_push");
  }
  return Array.from(new Set(result));
}

function maxRisk(
  requested: ImprovementProposalRiskLevel | undefined,
  derived: ImprovementProposalRiskLevel,
): ImprovementProposalRiskLevel {
  const rank: Record<ImprovementProposalRiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    forbidden: 4,
  };
  if (!requested) return derived;
  return rank[requested] > rank[derived] ? requested : derived;
}

function deriveRiskLevel(
  input: HumanApprovedImprovementProposalInput,
  forbiddenTouchpoints: readonly ImprovementProposalForbiddenTouchpoint[],
): ImprovementProposalRiskLevel {
  const bag = textBag(input);
  const hasForbidden =
    forbiddenTouchpoints.includes("vault_confirmed_final") ||
    forbiddenTouchpoints.includes("id_thresholds") ||
    forbiddenTouchpoints.includes("missing_id_completion") ||
    forbiddenTouchpoints.includes("auto_apply") ||
    forbiddenTouchpoints.includes("decision_making_support_signal") ||
    forbiddenTouchpoints.includes("remote_push");
  if (hasForbidden) return maxRisk(input.riskLevel, "forbidden");

  if (
    forbiddenTouchpoints.length > 0 ||
    includesAny(bag, ["writeback", "fast video", "hizli video", "hızlı video"])
  ) {
    return maxRisk(input.riskLevel, "high");
  }

  if (
    includesAny(bag, [
      "adapter",
      "logging",
      "advisory store",
      "internal endpoint",
      "admin endpoint",
      "learning record",
      "ocr",
      "heavy_ocr",
      "light_ocr",
    ])
  ) {
    return maxRisk(input.riskLevel, "medium");
  }

  return maxRisk(input.riskLevel, "low");
}

function describeRiskLevel(riskLevel: ImprovementProposalRiskLevel): string {
  if (riskLevel === "low") return "Low risk: limited copy or advisory helper update.";
  if (riskLevel === "medium") return "Medium risk: internal helper or logging update; review tests first.";
  if (riskLevel === "high") return "High risk: manual safety review required before later work.";
  return "Forbidden: blocked by policy.";
}

function buildRedFlags(
  riskLevel: ImprovementProposalRiskLevel,
  forbiddenTouchpoints: readonly ImprovementProposalForbiddenTouchpoint[],
): string[] {
  const flags: string[] = [];
  if (riskLevel === "high") {
    flags.push("High-risk proposal: patch draft is disabled in this record-only phase.");
  }
  if (riskLevel === "forbidden") {
    flags.push("Forbidden proposal: must not produce patch drafts or implementation steps.");
  }
  for (const touchpoint of forbiddenTouchpoints) {
    flags.push(`Touches protected area: ${touchpoint}.`);
  }
  return flags;
}

function recommendationBag(recommendation: LearningRecommendation): string {
  return [
    recommendation.recommendationId,
    recommendation.recommendationType,
    recommendation.topic,
    recommendation.severity,
    recommendation.riskLevel,
    recommendation.recommendation,
    recommendation.proposedChange,
    recommendation.reason,
    ...recommendation.sourceRecordIds,
    ...recommendation.affectedModules,
  ]
    .join(" ")
    .toLowerCase();
}

function recommendationActionBag(recommendation: LearningRecommendation): string {
  return [
    recommendation.topic,
    recommendation.proposedChange,
  ]
    .join(" ")
    .toLowerCase();
}

const HUMAN_READABLE_RECOMMENDATION_TITLES: Record<string, string> = {
  visual_crop_weakness: "Görsel kırpma dayanımı zayıf",
  resize_ecc_support: "Resize sonrası ECC destek sonucu",
  visual_resize_ecc_support: "Resize sonrası ECC destek sonucu",
  video_fast_writeback_drift: "Video Hızlı Mod zaman çizelgesi sapması",
  dashboard_learning_language: "DNA öğrenme dili iyileştirme",
  audio_trim_offset_weakness: "Ses trim/offset dayanımı zayıf",
  text_ocr_copy_paste_weakness: "Metin OCR/copy-paste dayanımı zayıf",
};

function humanizeRecommendationTitle(topic: string): string {
  const trimmed = topic.trim();
  const mapped = HUMAN_READABLE_RECOMMENDATION_TITLES[trimmed];
  if (mapped) return mapped;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function inferAffectedFilesFromRecommendation(recommendation: LearningRecommendation): string[] {
  const bag = recommendationBag(recommendation);
  const actionBag = recommendationActionBag(recommendation);
  const files: string[] = ["artifacts/api-server/src/lib/learningDnaMemory.ts"];

  if (
    recommendation.affectedModules.includes("image") ||
    includesAny(bag, ["visual", "image", "crop", "resize", "jpeg", "webp", "ecc"])
  ) {
    files.push("artifacts/api-server/src/dna/visualLearningAdapter.ts");
  }
  if (
    recommendation.affectedModules.includes("video") ||
    includesAny(bag, ["video", "writeback", "drift", "fast video", "timebase", "fps"])
  ) {
    files.push("artifacts/api-server/src/video/videoFastSafetyFallback.ts");
  }
  if (
    includesAny(bag, [
      "dashboard",
      "report language",
      "rapor dili",
      "learning summary",
      "copy",
    ])
  ) {
    files.push("artifacts/dashboard-ui/src/pages/learning-summary.tsx");
  }
  if (
    hasIdThresholdChangeIntent(actionBag) ||
    hasVaultDecisionChangeIntent(actionBag) ||
    hasAutoApplyChangeIntent(actionBag)
  ) {
    files.push("PROTECTED_DECISION_GATES_NO_FILE_CHANGE_ALLOWED");
  }

  return cleanList(files, 260);
}

function buildTestPlanFromRecommendation(recommendation: LearningRecommendation): string[] {
  const bag = recommendationBag(recommendation);
  const actionBag = recommendationActionBag(recommendation);
  const testPlan: string[] = [...DEFAULT_TEST_PLAN];

  if (recommendation.affectedModules.includes("image") || includesAny(bag, ["visual", "image"])) {
    testPlan.push("Run visual learning adapter validation with wrong-ID and unsealed-source cases.");
  }
  if (recommendation.affectedModules.includes("video") || includesAny(bag, ["video", "writeback"])) {
    testPlan.push("Run isolated video safety validation; keep fast output discarded unless all gates pass.");
  }
  if (includesAny(bag, ["dashboard", "report language", "rapor dili", "learning summary"])) {
    testPlan.push("Verify dashboard/report copy does not imply automatic code changes.");
  }
  if (
    hasIdThresholdChangeIntent(actionBag) ||
    hasVaultDecisionChangeIntent(actionBag) ||
    hasAutoApplyChangeIntent(actionBag)
  ) {
    testPlan.push("Confirm this remains a forbidden safety warning and produces no patch draft.");
  }

  return cleanList(testPlan, 500);
}

function buildRollbackPlanFromRecommendation(recommendation: LearningRecommendation): string[] {
  const bag = recommendationBag(recommendation);
  const actionBag = recommendationActionBag(recommendation);
  const rollbackPlan: string[] = [...DEFAULT_ROLLBACK_PLAN];
  if (includesAny(bag, ["adapter", "logging", "dashboard", "report language"])) {
    rollbackPlan.push("If a later approved patch is created, revert only that adapter/UI change.");
  }
  if (includesAny(bag, ["video", "writeback", "strong mode", "guclu mod", "gÃ¼Ã§lÃ¼ mod"])) {
    rollbackPlan.push("If a later video patch is unsafe, discard fast-path output and keep Strong Mode fallback.");
  }
  if (
    hasIdThresholdChangeIntent(actionBag) ||
    hasVaultDecisionChangeIntent(actionBag) ||
    hasAutoApplyChangeIntent(actionBag)
  ) {
    rollbackPlan.push("No rollback should be needed because forbidden proposals must not produce patches.");
  }
  return cleanList(rollbackPlan, 500);
}

function buildSafetyChecklistFromRecommendation(recommendation: LearningRecommendation): string[] {
  const checklist: string[] = [...DEFAULT_SAFETY_CHECKLIST];
  checklist.push("Proposal is derived from learningDnaMemory and remains record-only.");
  checklist.push("learningDnaMemory remains the single learning center.");
  checklist.push("No DB, route, dashboard, or file-application side effect is performed by this builder.");
  if (recommendation.riskLevel === "high") {
    checklist.push("High-risk recommendations cannot create patch drafts in this phase.");
  }
  return cleanList(checklist, 500);
}

function buildSmallStepFromRecommendation(recommendation: LearningRecommendation): string {
  const bag = recommendationBag(recommendation);
  const actionBag = recommendationActionBag(recommendation);
  if (
    hasIdThresholdChangeIntent(actionBag) ||
    hasVaultDecisionChangeIntent(actionBag) ||
    hasAutoApplyChangeIntent(actionBag)
  ) {
    return "Keep as a forbidden safety warning; do not prepare a patch draft.";
  }
  if (recommendation.riskLevel === "high" || includesAny(bag, ["writeback", "strong mode"])) {
    return "Escalate to human safety review; prepare only a diagnostic note.";
  }
  if (includesAny(bag, ["adapter", "logging", "internal endpoint"])) {
    return "Prepare a record-only adapter/logging note for human review.";
  }
  return "Prepare a human-readable advisory note for review.";
}

export function createHumanApprovedImprovementProposal(
  input: HumanApprovedImprovementProposalInput,
): HumanApprovedImprovementProposal {
  const title = cleanString(input.title, "Learning improvement proposal", 160);
  const createdAt =
    input.createdAt && Number.isFinite(Date.parse(input.createdAt))
      ? input.createdAt
      : new Date().toISOString();
  const proposalKey = cleanString(
    input.proposalKey,
    `${input.source}:${slug(title)}`,
    160,
  );
  const touches = detectTouchFlags(input);
  const forbiddenTouchpoints = detectForbiddenTouchpoints(input, touches);
  const riskLevel = deriveRiskLevel(input, forbiddenTouchpoints);
  const patchDraftAllowed = riskLevel === "low" || riskLevel === "medium";

  return {
    proposalVersion: HUMAN_APPROVED_IMPROVEMENT_PROPOSAL_VERSION,
    id: cleanString(input.id, proposalKey, 160),
    proposalKey,
    source: input.source,
    title,
    summary: cleanString(input.summary, title, 500),
    reason: cleanString(input.reason, "No reason provided.", 1000),
    evidenceRefs: cleanList(input.evidenceRefs),
    affectedModules: Array.from(new Set(input.affectedModules ?? [])),
    affectedFiles: cleanList(input.affectedFiles, 260),
    riskLevel,
    riskExplanation: describeRiskLevel(riskLevel),
    benefit: cleanString(input.benefit, "Advisory learning improvement.", 500),
    proposedChange: cleanString(input.proposedChange, "Record-only advisory proposal.", 1000),
    smallStep: cleanString(input.smallStep, "Prepare a human-reviewed dry-run note only.", 500),
    testPlan: cleanList(input.testPlan?.length ? input.testPlan : [...DEFAULT_TEST_PLAN], 500),
    rollbackPlan: cleanList(
      input.rollbackPlan?.length ? input.rollbackPlan : [...DEFAULT_ROLLBACK_PLAN],
      500,
    ),
    safetyChecklist: cleanList(
      input.safetyChecklist?.length ? input.safetyChecklist : [...DEFAULT_SAFETY_CHECKLIST],
      500,
    ),
    forbiddenTouchpoints,
    requiresHumanApproval: true,
    approvalStatus: input.approvalStatus ?? "pending",
    patchDraftAllowed,
    patchApplied: false,
    commitAllowed: false,
    remotePushAllowed: false,
    autoApply: false,
    touchesSealLogic: touches.touchesSealLogic,
    touchesReadLogic: touches.touchesReadLogic,
    touchesVaultDecision: touches.touchesVaultDecision,
    touchesStrongMode: touches.touchesStrongMode,
    touchesOwnershipBlock: touches.touchesOwnershipBlock,
    createdAt,
    redFlags: buildRedFlags(riskLevel, forbiddenTouchpoints),
    note:
      "Record-only proposal. It never writes code, applies patches, commits, pushes, or changes VAULT/confirmed/final decisions.",
  };
}

export function createProposalFromLearningRecommendation(
  recommendation: LearningRecommendation,
): HumanApprovedImprovementProposal {
  return createHumanApprovedImprovementProposal({
    source: "learningDnaMemory",
    proposalKey: `learningDnaMemory:${recommendation.recommendationId}`,
    title: humanizeRecommendationTitle(recommendation.topic),
    summary: recommendation.recommendation,
    reason: recommendation.reason,
    evidenceRefs: recommendation.sourceRecordIds,
    affectedModules: recommendation.affectedModules,
    affectedFiles: inferAffectedFilesFromRecommendation(recommendation),
    riskLevel: recommendation.riskLevel,
    proposedChange: recommendation.proposedChange,
    smallStep: buildSmallStepFromRecommendation(recommendation),
    testPlan: buildTestPlanFromRecommendation(recommendation),
    rollbackPlan: buildRollbackPlanFromRecommendation(recommendation),
    safetyChecklist: buildSafetyChecklistFromRecommendation(recommendation),
    benefit: recommendation.recommendation,
    approvalStatus: recommendation.approvalStatus,
  });
}

export function createProposalsFromLearningRecommendations(
  recommendations: readonly LearningRecommendation[],
): HumanApprovedImprovementProposal[] {
  return recommendations.map((recommendation) =>
    createProposalFromLearningRecommendation(recommendation),
  );
}

export function validateHumanApprovedImprovementProposal(
  proposal: HumanApprovedImprovementProposal,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (proposal.requiresHumanApproval !== true) violations.push("requiresHumanApproval_not_true");
  if (proposal.patchApplied !== false) violations.push("patchApplied_not_false");
  if (proposal.commitAllowed !== false) violations.push("commitAllowed_not_false");
  if (proposal.remotePushAllowed !== false) violations.push("remotePushAllowed_not_false");
  if (proposal.autoApply !== false) violations.push("autoApply_not_false");
  if (proposal.riskLevel === "high" && proposal.patchDraftAllowed !== false) {
    violations.push("highRisk_patchDraftAllowed_not_false");
  }
  if (proposal.riskLevel === "forbidden" && proposal.patchDraftAllowed !== false) {
    violations.push("forbidden_patchDraftAllowed_not_false");
  }
  if (proposal.touchesVaultDecision && proposal.riskLevel !== "forbidden") {
    violations.push("vaultTouch_not_forbidden");
  }
  if (proposal.forbiddenTouchpoints.includes("auto_apply") && proposal.riskLevel !== "forbidden") {
    violations.push("autoApplyTouch_not_forbidden");
  }
  if (proposal.forbiddenTouchpoints.includes("id_thresholds") && proposal.riskLevel !== "forbidden") {
    violations.push("idThresholdTouch_not_forbidden");
  }
  return {
    ok: violations.length === 0,
    violations,
  };
}

function exampleLearningRecommendation(
  input: Pick<
    LearningRecommendation,
    | "recommendationId"
    | "recommendationType"
    | "topic"
    | "severity"
    | "riskLevel"
    | "sourceRecordIds"
    | "affectedModules"
    | "recommendation"
    | "proposedChange"
    | "reason"
  >,
): LearningRecommendation {
  return {
    ...input,
    approvalStatus: "pending",
    pendingHumanApproval: true,
    approved: false,
    rejected: false,
    approvedBy: null,
    approvedAt: null,
    applied: false,
    autoApplied: false,
    autoApplyEligible: false,
  };
}

export function createLearningRecommendationProposalValidationExamples(): HumanApprovedImprovementProposal[] {
  return createProposalsFromLearningRecommendations([
    exampleLearningRecommendation({
      recommendationId: "lrn-visual-crop-weakness",
      recommendationType: "test_priority",
      topic: "visual_crop_weakness",
      severity: "watch",
      riskLevel: "medium",
      sourceRecordIds: ["visual-crop-loss-01"],
      affectedModules: ["image"],
      recommendation:
        "Crop senaryosunda gizli ID kaybi tekrar ediyor; bunu sadece learning/advisory kaydi olarak izlemeye devam et.",
      proposedChange:
        "Add visual adapter logging context for crop weakness as a learning note.",
      reason: "Crop kaybi karar degisikligi degil, test onceligi ve rapor verisi uretir.",
    }),
    exampleLearningRecommendation({
      recommendationId: "lrn-resize-ecc-support",
      recommendationType: "module_strength",
      topic: "resize_ecc_support",
      severity: "info",
      riskLevel: "medium",
      sourceRecordIds: ["visual-resize-ecc-01"],
      affectedModules: ["image"],
      recommendation:
        "Resize sonrasi ECC destek sinyali faydali gorunuyor; yalniz candidate/support olarak raporlansin.",
      proposedChange:
        "Record ECC support in visual learning records as candidate/support context only.",
      reason: "ECC resize icin destek verisi saglar ama karar verici olmamalidir.",
    }),
    exampleLearningRecommendation({
      recommendationId: "lrn-video-fast-writeback-drift",
      recommendationType: "safety_review",
      topic: "video_fast_writeback_drift",
      severity: "review",
      riskLevel: "high",
      sourceRecordIds: ["video-fast-drift-01"],
      affectedModules: ["video"],
      recommendation:
        "Video fast writeback drift tekrar ediyor; fast output Strong Mode yerine gecmemeli.",
      proposedChange:
        "Investigate video fast writeback drift with diagnostic-only notes; keep Strong Mode fallback.",
      reason: "FPS/timebase drift varsa hizli cikti discard edilmeli.",
    }),
    exampleLearningRecommendation({
      recommendationId: "lrn-dashboard-learning-language",
      recommendationType: "report_language",
      topic: "dashboard_learning_language",
      severity: "info",
      riskLevel: "low",
      sourceRecordIds: ["learning-summary-copy-01"],
      affectedModules: ["secure_room"],
      recommendation:
        "Dashboard ogrenme dili insan onayli ve advisory-only oldugunu daha sade anlatmali.",
      proposedChange:
        "Clarify dashboard/report language only; no behavior, route, or decision change.",
      reason: "Kullanici DNA onerilerinin kendiliginden dosya degistirmedigini net gormeli.",
    }),
    exampleLearningRecommendation({
      recommendationId: "lrn-id-threshold-forbidden",
      recommendationType: "safety_review",
      topic: "id_threshold_change_forbidden",
      severity: "review",
      riskLevel: "high",
      sourceRecordIds: ["forbidden-threshold-01"],
      affectedModules: ["image", "video"],
      recommendation:
        "ID threshold degisikligi onerisi guvenlik nedeniyle forbidden kalmali.",
      proposedChange:
        "Change ID threshold to accept 31/32 partial matches.",
      reason: "ID threshold degisikligi yanlis ID ile VAULT riskini dogurur.",
    }),
  ]);
}

export function createHumanApprovedImprovementProposalValidationExamples(): HumanApprovedImprovementProposal[] {
  return [
    createHumanApprovedImprovementProposal({
      source: "manual",
      title: "Improve dashboard learning language",
      summary: "Make the learning summary copy clearer for non-technical admins.",
      reason: "The dashboard can explain advisory learning without implying automatic changes.",
      affectedModules: ["secure_room"],
      affectedFiles: ["artifacts/dashboard-ui/src/pages/learning-summary.tsx"],
      proposedChange: "Clarify report language only; no behavior change.",
      smallStep: "Draft copy text for human review.",
      benefit: "Lower confusion around advisory learning.",
    }),
    createHumanApprovedImprovementProposal({
      source: "learningRecords",
      title: "Add visual adapter logging field",
      summary: "Record an extra advisory logging field for visual transform notes.",
      reason: "Visual learning records need richer context for future summaries.",
      affectedModules: ["image"],
      affectedFiles: ["artifacts/api-server/src/dna/visualLearningAdapter.ts"],
      proposedChange: "Add an advisory logging-only field to the adapter record.",
      smallStep: "Prepare a tiny helper-only patch draft after human approval.",
      benefit: "Better visual learning traceability.",
    }),
    createHumanApprovedImprovementProposal({
      source: "manual",
      title: "Review video fast writeback drift",
      summary: "Video Fast Mode writeback needs a cautious diagnostic proposal.",
      reason: "Prior tests found FPS/timebase drift risks.",
      affectedModules: ["video"],
      affectedFiles: ["artifacts/api-server/src/video/videoFastSafetyFallback.ts"],
      proposedChange: "Investigate fast video writeback; do not apply patch in this phase.",
      smallStep: "Prepare a diagnostic-only plan for human review.",
      benefit: "May reduce future video processing cost if safety gates hold.",
    }),
    createHumanApprovedImprovementProposal({
      source: "manual",
      title: "Change ID threshold",
      summary: "Attempt to accept partial 31/32 ID matches.",
      reason: "This is intentionally forbidden for validation.",
      affectedModules: ["video", "image"],
      proposedChange: "Change ID threshold and accept 31/32.",
      smallStep: "Do not proceed.",
      benefit: "No acceptable benefit.",
    }),
    createHumanApprovedImprovementProposal({
      source: "manual",
      title: "Change VAULT confirmed final logic",
      summary: "Attempt to let candidate support open VAULT.",
      reason: "This is intentionally forbidden for validation.",
      affectedModules: ["video"],
      proposedChange: "Change VAULT/confirmed/final decision logic.",
      smallStep: "Do not proceed.",
      benefit: "No acceptable benefit.",
    }),
    createHumanApprovedImprovementProposal({
      source: "manual",
      title: "Touch Strong Mode behavior",
      summary: "Review a possible Strong Mode behavior change.",
      reason: "Strong Mode changes are high risk and require separate explicit approval.",
      affectedModules: ["video"],
      proposedChange: "Change Strong Mode behavior.",
      smallStep: "Escalate to human safety review only.",
      benefit: "Potential robustness, not approved here.",
    }),
    createHumanApprovedImprovementProposal({
      source: "manual",
      title: "Enable auto apply",
      summary: "Attempt to enable automatic application of learning proposals.",
      reason: "This is intentionally forbidden for validation.",
      proposedChange: "Turn on auto-apply for low risk changes.",
      smallStep: "Do not proceed.",
      benefit: "No acceptable benefit in this safety model.",
    }),
  ];
}
