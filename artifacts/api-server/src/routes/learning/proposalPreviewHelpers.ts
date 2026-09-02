import {
  type LearningRecommendation,
  type LearningRecommendationType,
  type LearningRiskLevel,
} from "../../lib/learningDnaMemory";

const LEARNING_RECOMMENDATION_TYPES = new Set<LearningRecommendationType>([
  "report_language",
  "test_priority",
  "module_strength",
  "next_test",
  "heavy_ocr_target",
  "safety_review",
]);
const LEARNING_RISK_LEVELS = new Set<LearningRiskLevel>(["low", "medium", "high"]);
const LEARNING_RECOMMENDATION_SEVERITIES = new Set(["info", "watch", "review"]);
const PROPOSAL_DECISIONS = new Set(["approved", "rejected", "request_patch_draft"]);

type ProposalDecision = "approved" | "rejected" | "request_patch_draft";
export type ProposalDecisionRisk = "low_or_medium" | "high" | "forbidden";
type ProposalPatchPreviewRisk = "low" | "medium" | "high" | "forbidden";

export interface ProposalPatchPreviewInput {
  proposalKey: string;
  riskLevel: ProposalPatchPreviewRisk;
  affectedFiles: string[];
  proposedChange: string;
  smallStep: string;
  testPlan: string[];
  rollbackPlan: string[];
  safetyChecklist: string[];
}

export interface ProposalApplyReadinessInput extends ProposalPatchPreviewInput {
  patchDraftText: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanString(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanStringList(value: unknown, maxLength = 500): string[] {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => cleanString(item, maxLength))
            .filter((item): item is string => item !== null),
        ),
      )
    : [];
}

function textIncludesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function hasChangeIntent(text: string): boolean {
  return [
    /\b(change|alter|modify|update|enable|allow|accept|open|produce|generate|lower|raise|loosen|relax)\b/u,
    /\b(set|turn)\s+(true|on)\b/u,
    /(degistir|izin ver|kabul et|uret|esnet|gevset)/u,
  ].some((pattern) => pattern.test(text));
}

function buildApplyReadinessLines(input: ProposalApplyReadinessInput): string[] {
  return [
    input.proposalKey,
    input.riskLevel,
    input.patchDraftText,
    input.proposedChange,
    input.smallStep,
    ...input.affectedFiles,
    ...input.testPlan,
    ...input.rollbackPlan,
    ...input.safetyChecklist,
  ]
    .flatMap((item) => item.split(/\r?\n/u))
    .map((item) => item.toLowerCase());
}

function hasProtectedChangeLine(lines: string[], needles: string[]): boolean {
  return lines.some((line) => textIncludesAny(line, needles) && hasChangeIntent(line));
}

export function normalizeLearningRecommendationPreviewInput(
  value: unknown,
  index: number,
): LearningRecommendation | null {
  const raw = asRecord(value);
  const recommendationId =
    cleanString(raw["recommendationId"], 120) ??
    `preview-recommendation-${String(index + 1).padStart(2, "0")}`;
  const recommendationTypeRaw = cleanString(raw["recommendationType"], 80);
  const recommendationType =
    recommendationTypeRaw &&
    LEARNING_RECOMMENDATION_TYPES.has(recommendationTypeRaw as LearningRecommendationType)
      ? (recommendationTypeRaw as LearningRecommendationType)
      : null;
  const topic = cleanString(raw["topic"], 160);
  const severityRaw = cleanString(raw["severity"], 40);
  const severity =
    severityRaw && LEARNING_RECOMMENDATION_SEVERITIES.has(severityRaw)
      ? (severityRaw as LearningRecommendation["severity"])
      : null;
  const riskLevelRaw = cleanString(raw["riskLevel"], 40);
  const riskLevel =
    riskLevelRaw && LEARNING_RISK_LEVELS.has(riskLevelRaw as LearningRiskLevel)
      ? (riskLevelRaw as LearningRiskLevel)
      : null;
  const sourceRecordIds = Array.isArray(raw["sourceRecordIds"])
    ? raw["sourceRecordIds"]
        .map((item) => cleanString(item, 120))
        .filter((item): item is string => item !== null)
    : [];
  const affectedModules = Array.isArray(raw["affectedModules"])
    ? raw["affectedModules"]
        .map((item) => (typeof item === "string" ? item : null))
        .filter((item): item is LearningRecommendation["affectedModules"][number] =>
          item !== null &&
          [
            "video",
            "image",
            "audio",
            "text",
            "light_ocr",
            "heavy_ocr",
            "secure_room",
            "zehir",
            "evidence_package",
            "c2pa_draft",
          ].includes(item),
        )
    : [];
  const recommendation = cleanString(raw["recommendation"], 1000);
  const proposedChange = cleanString(raw["proposedChange"], 1000);
  const reason = cleanString(raw["reason"], 1000);

  if (!recommendationType || !topic || !severity || !riskLevel || !recommendation || !proposedChange || !reason) {
    return null;
  }

  return {
    recommendationId,
    recommendationType,
    topic,
    severity,
    riskLevel,
    sourceRecordIds,
    affectedModules,
    recommendation,
    proposedChange,
    reason,
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

export function normalizeProposalDecisionInput(value: unknown): {
  proposalKey: string;
  decision: ProposalDecision;
  reason: string | null;
} | null {
  const raw = asRecord(value);
  const proposalKey = cleanString(raw["proposalKey"], 180);
  const decisionRaw = cleanString(raw["decision"], 40);
  const decision =
    decisionRaw && PROPOSAL_DECISIONS.has(decisionRaw)
      ? (decisionRaw as ProposalDecision)
      : null;
  if (!proposalKey || !decision) return null;
  return {
    proposalKey,
    decision,
    reason: cleanString(raw["reason"], 500),
  };
}

export function inferProposalDecisionRisk(proposalKey: string): ProposalDecisionRisk {
  const key = proposalKey.toLowerCase();
  if (
    [
      "id-threshold",
      "id_threshold",
      "threshold",
      "31-32",
      "31/32",
      "vault",
      "confirmed",
      "final",
      "canopenvault",
      "vaulteligible",
      "auto-apply",
      "auto_apply",
      "autoapply",
    ].some((needle) => key.includes(needle))
  ) {
    return "forbidden";
  }
  if (
    [
      "video-fast",
      "video_fast",
      "writeback",
      "drift",
      "strong-mode",
      "strong_mode",
      "guclu-mod",
      "guclu_mod",
    ].some((needle) => key.includes(needle))
  ) {
    return "high";
  }
  return "low_or_medium";
}

function inferProposalPatchPreviewRisk(
  proposalKey: string,
  value: unknown,
): ProposalPatchPreviewRisk {
  const rawRisk = cleanString(value, 40);
  if (rawRisk && ["low", "medium", "high", "forbidden"].includes(rawRisk)) {
    return rawRisk as ProposalPatchPreviewRisk;
  }
  const inferred = inferProposalDecisionRisk(proposalKey);
  if (inferred === "forbidden") return "forbidden";
  if (inferred === "high") return "high";
  return "medium";
}

export function normalizeProposalPatchPreviewInput(value: unknown): ProposalPatchPreviewInput | null {
  const container = asRecord(value);
  const raw = asRecord(container["proposal"] ?? value);
  const proposalKey = cleanString(raw["proposalKey"], 180);
  if (!proposalKey) return null;
  return {
    proposalKey,
    riskLevel: inferProposalPatchPreviewRisk(proposalKey, raw["riskLevel"]),
    affectedFiles: cleanStringList(raw["affectedFiles"], 260),
    proposedChange:
      cleanString(raw["proposedChange"], 1000) ??
      "No implementation change is produced by this dry-run preview.",
    smallStep:
      cleanString(raw["smallStep"], 500) ??
      "Prepare a separate human-approved patch command if this preview is accepted.",
    testPlan: cleanStringList(raw["testPlan"], 500),
    rollbackPlan: cleanStringList(raw["rollbackPlan"], 500),
    safetyChecklist: cleanStringList(raw["safetyChecklist"], 500),
  };
}

export function normalizeProposalApplyReadinessInput(value: unknown): ProposalApplyReadinessInput | null {
  const previewInput = normalizeProposalPatchPreviewInput(value);
  if (!previewInput) return null;
  const container = asRecord(value);
  const raw = asRecord(container["proposal"] ?? value);
  const dryRunPatchPlan = asRecord(raw["dryRunPatchPlan"]);
  const patchDraftText =
    cleanString(raw["patchDraftText"], 8000) ??
    cleanString(dryRunPatchPlan["patchDraftText"], 8000);
  if (!patchDraftText) return null;
  return {
    ...previewInput,
    patchDraftText,
  };
}

export function collectApplyReadinessBlockedReasons(input: ProposalApplyReadinessInput): string[] {
  const lines = buildApplyReadinessLines(input);
  const blockedReasons = new Set<string>();

  if (input.riskLevel === "high") {
    blockedReasons.add("high_risk_manual_review_required");
  }
  if (input.riskLevel === "forbidden") {
    blockedReasons.add("forbidden_proposal");
  }
  if (
    hasProtectedChangeLine(lines, ["strong mode", "strong-mode", "strong_mode", "guclu mod"])
  ) {
    blockedReasons.add("touches_strong_mode");
  }
  if (
    hasProtectedChangeLine(lines, [
      "seal encode",
      "seal read",
      "seal write",
      "seal search",
      "muhur bas",
      "muhur oku",
      "muhur ar",
      "decodevideo",
      "encodevideo",
    ])
  ) {
    blockedReasons.add("touches_seal_encode_or_read");
  }
  if (
    hasProtectedChangeLine(lines, ["id threshold", "id esik", "31/32", "31-32", "threshold"])
  ) {
    blockedReasons.add("touches_id_thresholds");
  }
  if (
    hasProtectedChangeLine(lines, ["vault", "confirmed", "final decision", "final karar", "canopenvault", "vaulteligible"])
  ) {
    blockedReasons.add("touches_vault_confirmed_final");
  }
  if (
    hasProtectedChangeLine(lines, ["ownership block", "pre-seal", "preseal", "sahiplik blok", "tekrar-muhurleme", "tekrar muhurleme"])
  ) {
    blockedReasons.add("touches_ownership_block");
  }
  if (
    lines.some((line) => textIncludesAny(line, ["autoapply=true", "auto-apply=true"])) ||
    hasProtectedChangeLine(lines, ["auto-apply", "auto apply", "autoapply"])
  ) {
    blockedReasons.add("touches_auto_apply");
  }

  return Array.from(blockedReasons);
}

export function buildFinalSafetyChecklist(input: ProposalApplyReadinessInput, blockedReasons: string[]): string[] {
  return Array.from(
    new Set([
      ...input.safetyChecklist,
      "requiresHumanApproval=true",
      "patchApplied=false",
      "commitAllowed=false",
      "remotePushAllowed=false",
      "autoApply=false",
      "No file write is performed by this readiness endpoint.",
      "No patch is applied by this readiness endpoint.",
      "Strong Mode, seal encode/read, VAULT/confirmed/final, ownership block, and auto-apply changes remain blocked.",
      blockedReasons.length > 0
        ? "Readiness gate is blocked; a separate human safety review is required."
        : "Readiness gate passed for review only; a separate explicit apply command would still be required.",
    ]),
  );
}
