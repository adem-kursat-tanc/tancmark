import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  createAudioLearningAdapterRecord,
  validateAudioLearningAdapterBatch,
  type AudioLearningAdapterInput,
} from "../dna/audioLearningAdapter";
import {
  createTextLearningAdapterRecord,
  validateTextLearningAdapterBatch,
  type TextLearningAdapterInput,
} from "../dna/textLearningAdapter";
import {
  createVisualLearningAdapterRecord,
  validateVisualLearningAdapterBatch,
  type VisualLearningAdapterInput,
} from "../dna/visualLearningAdapter";
import {
  createVideoLearningAdapterRecord,
  validateVideoLearningAdapterBatch,
  type VideoLearningAdapterInput,
} from "../dna/videoLearningAdapter";
import { recordEvent, type AuditKind } from "../lib/auditStore";
import {
  createPersistentLearningRecordInput,
  persistLearningRecord,
} from "../lib/learningRecordStore";
import {
  buildLearningApprovalDecision,
  buildLearningDnaMemory,
  normalizeLearningTestRecord,
  normalizeLearningApprovalInput,
  LEARNING_AUTO_APPLY_ENV,
  type LearningRecommendation,
  type LearningTestRecord,
} from "../lib/learningDnaMemory";
import {
  createProposalsFromLearningRecommendations,
  validateHumanApprovedImprovementProposal,
} from "../lib/humanApprovedImprovementProposal";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  registerLearningModeRoute,
  registerLearningRecordReadOnlyRoutes,
} from "./learning/readOnlyRoutes";
import {
  normalizeAudioLearningInput,
  normalizeTextLearningInput,
  normalizeVideoLearningInput,
  normalizeVisualLearningInput,
} from "./learning/labPreviewHelpers";
import {
  buildFinalSafetyChecklist,
  collectApplyReadinessBlockedReasons,
  inferProposalDecisionRisk,
  normalizeLearningRecommendationPreviewInput,
  normalizeProposalApplyReadinessInput,
  normalizeProposalDecisionInput,
  normalizeProposalPatchPreviewInput,
  type ProposalApplyReadinessInput,
  type ProposalDecisionRisk,
  type ProposalPatchPreviewInput,
} from "./learning/proposalPreviewHelpers";

const router: IRouter = Router();
const LEARNING_MEMORY_AUDIT_KIND = "Learning_Memory" as AuditKind;
const PROPOSAL_APPLY_CONFIRMATION = "APPLY_LOW_MEDIUM_PROPOSAL";

interface ProposalApplyOperation {
  type: "replace_text" | "append_text";
  filePath: string;
  find: string | null;
  replace: string | null;
  text: string | null;
}

interface ProposalApplyInput extends ProposalApplyReadinessInput {
  explicitConfirmation: string | null;
  patchDraftAllowed: boolean;
  patchAppliedBefore: boolean;
  commitAllowedInput: boolean;
  remotePushAllowedInput: boolean;
  autoApplyInput: boolean;
  forbiddenTouchpoints: string[];
  operations: ProposalApplyOperation[];
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
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

function hasProtectedChangeLine(lines: string[], needles: string[]): boolean {
  return lines.some((line) => textIncludesAny(line, needles) && hasChangeIntent(line));
}

function findWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir, "../..");
}

function normalizeRepoPath(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("\0")) return null;
  if (path.isAbsolute(normalized) || normalized.startsWith("/") || normalized.startsWith("../")) {
    return null;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return null;
  return parts.join("/");
}

function isAllowedApplyPath(repoPath: string): boolean {
  return (
    repoPath.startsWith("docs/") ||
    repoPath.startsWith("runtime/validation/") ||
    repoPath.startsWith("runtime/learning-proposal-apply-validation/") ||
    repoPath.startsWith("scripts/validation/") ||
    repoPath === "artifacts/api-server/src/lib/humanApprovedImprovementProposal.ts" ||
    repoPath === "artifacts/api-server/src/lib/learningDnaMemory.ts" ||
    repoPath === "artifacts/api-server/src/dna/visualLearningAdapter.ts" ||
    repoPath === "artifacts/dashboard-ui/src/pages/learning-summary.tsx"
  );
}

function isBlockedApplyPath(repoPath: string): boolean {
  const lowered = repoPath.toLowerCase();
  return [
    "/video/",
    "/audio/",
    "/routes/audiolab",
    "/routes/visuallab",
    "/routes/secure",
    "vault",
    "ownership",
    "preseal",
    "pre-seal",
    "seal",
    "watermark",
    "cloak",
    "analyze",
    "decode",
    "encodevideo",
    "c2pa",
    "ecc",
    "threshold",
    "confirmed",
    "final",
    "strong",
    "decision",
    "canopenvault",
    "vaulteligible",
  ].some((needle) => lowered.includes(needle));
}

function resolveAllowedApplyPath(workspaceRoot: string, repoPath: string): string | null {
  const absolutePath = path.resolve(workspaceRoot, repoPath);
  const relative = path.relative(workspaceRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolutePath;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeProposalApplyOperation(value: unknown): ProposalApplyOperation | null {
  const raw = asRecord(value);
  const typeRaw = cleanString(raw["type"], 40);
  const type =
    typeRaw === "replace_text" || typeRaw === "append_text"
      ? typeRaw
      : null;
  const filePath = normalizeRepoPath(cleanString(raw["filePath"], 260));
  if (!type || !filePath) return null;
  return {
    type,
    filePath,
    find: cleanString(raw["find"], 4000),
    replace: cleanString(raw["replace"], 4000),
    text: cleanString(raw["text"], 4000),
  };
}

function normalizeProposalApplyInput(value: unknown): ProposalApplyInput | null {
  const readinessInput = normalizeProposalApplyReadinessInput(value);
  if (!readinessInput) return null;
  const container = asRecord(value);
  const raw = asRecord(container["proposal"] ?? value);
  const operationsRaw = Array.isArray(raw["operations"])
    ? raw["operations"]
    : Array.isArray(raw["patchOperations"])
      ? raw["patchOperations"]
      : [];
  const operations = operationsRaw
    .map((item) => normalizeProposalApplyOperation(item))
    .filter((item): item is ProposalApplyOperation => item !== null);
  return {
    ...readinessInput,
    explicitConfirmation: cleanString(raw["explicitConfirmation"], 80),
    patchDraftAllowed: raw["patchDraftAllowed"] === true,
    patchAppliedBefore: raw["patchApplied"] === true,
    commitAllowedInput: raw["commitAllowed"] === true,
    remotePushAllowedInput: raw["remotePushAllowed"] === true,
    autoApplyInput: raw["autoApply"] === true,
    forbiddenTouchpoints: cleanStringList(raw["forbiddenTouchpoints"], 120),
    operations,
  };
}

function countOccurrences(value: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = value.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = value.indexOf(needle, index + needle.length);
  }
  return count;
}

function collectApplyInputBlockedReasons(input: ProposalApplyInput): string[] {
  const blockedReasons = new Set(collectApplyReadinessBlockedReasons(input));
  const operationLines = input.operations
    .flatMap((operation) => [
      operation.filePath,
      operation.find ?? "",
      operation.replace ?? "",
      operation.text ?? "",
    ])
    .flatMap((item) => item.split(/\r?\n/u))
    .map((item) => item.toLowerCase());

  if (input.explicitConfirmation !== PROPOSAL_APPLY_CONFIRMATION) {
    blockedReasons.add("explicit_confirmation_required");
  }
  if (input.riskLevel === "high") blockedReasons.add("high_risk_rejected");
  if (input.riskLevel === "forbidden") blockedReasons.add("forbidden_rejected");
  if (!input.patchDraftAllowed) blockedReasons.add("patch_draft_not_allowed");
  if (input.patchAppliedBefore) blockedReasons.add("patch_already_marked_applied");
  if (input.commitAllowedInput) blockedReasons.add("commit_allowed_input_must_be_false");
  if (input.remotePushAllowedInput) blockedReasons.add("remote_push_allowed_input_must_be_false");
  if (input.autoApplyInput) blockedReasons.add("auto_apply_input_must_be_false");
  if (input.forbiddenTouchpoints.length > 0) {
    blockedReasons.add("forbidden_touchpoints_present");
  }
  if (input.operations.length === 0) {
    blockedReasons.add("safe_patch_operations_required");
  }
  if (hasProtectedChangeLine(operationLines, ["strong mode", "strong-mode", "strong_mode", "guclu mod"])) {
    blockedReasons.add("touches_strong_mode");
  }
  if (
    hasProtectedChangeLine(operationLines, [
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
  if (hasProtectedChangeLine(operationLines, ["id threshold", "id esik", "31/32", "31-32", "threshold"])) {
    blockedReasons.add("touches_id_thresholds");
  }
  if (
    hasProtectedChangeLine(operationLines, ["vault", "confirmed", "final decision", "final karar", "canopenvault", "vaulteligible"])
  ) {
    blockedReasons.add("touches_vault_confirmed_final");
  }
  if (
    hasProtectedChangeLine(operationLines, ["ownership block", "pre-seal", "preseal", "sahiplik blok", "tekrar-muhurleme", "tekrar muhurleme"])
  ) {
    blockedReasons.add("touches_ownership_block");
  }
  if (
    operationLines.some((line) => textIncludesAny(line, ["autoapply=true", "auto-apply=true"])) ||
    hasProtectedChangeLine(operationLines, ["auto-apply", "auto apply", "autoapply"])
  ) {
    blockedReasons.add("touches_auto_apply");
  }

  const affectedFiles = new Set(input.affectedFiles.map((item) => normalizeRepoPath(item)).filter(Boolean));
  for (const operation of input.operations) {
    if (!affectedFiles.has(operation.filePath)) {
      blockedReasons.add("operation_file_not_in_affected_files");
    }
    if (!isAllowedApplyPath(operation.filePath)) {
      blockedReasons.add("operation_file_not_allowlisted");
    }
    if (isBlockedApplyPath(operation.filePath)) {
      blockedReasons.add("operation_file_blocklisted");
    }
    if (operation.type === "replace_text" && (!operation.find || operation.replace === null)) {
      blockedReasons.add("replace_text_requires_find_and_replace");
    }
    if (operation.type === "append_text" && !operation.text) {
      blockedReasons.add("append_text_requires_text");
    }
  }

  return Array.from(blockedReasons);
}

async function applySafeProposalOperations(input: ProposalApplyInput): Promise<{
  changedFiles: string[];
  rollbackPlan: string[];
  operationResults: Array<{
    filePath: string;
    operation: ProposalApplyOperation["type"];
    beforeSha256: string;
    afterSha256: string;
    beforeLength: number;
    afterLength: number;
  }>;
}> {
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const prepared = new Map<string, { absolutePath: string; original: string; next: string }>();
  const operationResults: Array<{
    filePath: string;
    operation: ProposalApplyOperation["type"];
    beforeSha256: string;
    afterSha256: string;
    beforeLength: number;
    afterLength: number;
  }> = [];

  for (const operation of input.operations) {
    const absolutePath = resolveAllowedApplyPath(workspaceRoot, operation.filePath);
    if (!absolutePath) {
      throw new Error(`unsafe_path:${operation.filePath}`);
    }
    const current = prepared.get(operation.filePath);
    const original = current?.original ?? await fs.readFile(absolutePath, "utf8");
    let next = current?.next ?? original;

    if (operation.type === "replace_text") {
      if (!operation.find || operation.replace === null) {
        throw new Error(`invalid_replace_operation:${operation.filePath}`);
      }
      const occurrences = countOccurrences(next, operation.find);
      if (occurrences !== 1) {
        throw new Error(`replace_text_requires_single_match:${operation.filePath}:${occurrences}`);
      }
      next = next.replace(operation.find, operation.replace);
    } else {
      if (!operation.text) {
        throw new Error(`invalid_append_operation:${operation.filePath}`);
      }
      next = next.endsWith("\n") ? `${next}${operation.text}` : `${next}\n${operation.text}`;
    }

    prepared.set(operation.filePath, { absolutePath, original, next });
  }

  const written: Array<{ absolutePath: string; original: string }> = [];
  try {
    for (const [filePath, preparedFile] of prepared.entries()) {
      if (preparedFile.original === preparedFile.next) continue;
      await fs.writeFile(preparedFile.absolutePath, preparedFile.next, "utf8");
      written.push({
        absolutePath: preparedFile.absolutePath,
        original: preparedFile.original,
      });
      operationResults.push({
        filePath,
        operation: input.operations.find((operation) => operation.filePath === filePath)?.type ?? "replace_text",
        beforeSha256: sha256Text(preparedFile.original),
        afterSha256: sha256Text(preparedFile.next),
        beforeLength: preparedFile.original.length,
        afterLength: preparedFile.next.length,
      });
    }
  } catch (error) {
    await Promise.all(
      written.map((item) => fs.writeFile(item.absolutePath, item.original, "utf8").catch(() => undefined)),
    );
    throw error;
  }

  const changedFiles = operationResults.map((result) => result.filePath);
  return {
    changedFiles,
    operationResults,
    rollbackPlan: changedFiles.length > 0
      ? [
          `Review changed files: ${changedFiles.join(", ")}`,
          "If rejected, revert only the listed changed files.",
          "Run API typecheck, root typecheck, and git diff --check before any separate checkpoint command.",
        ]
      : ["No file content changed; no rollback is needed."],
  };
}

function summarizeBeforeAfter(input: ProposalPatchPreviewInput): string[] {
  return [
    "Before: Learning proposal exists as an advisory record only.",
    `After preview: A human-readable dry-run plan describes the intended change for ${input.affectedFiles.length || 1} file target(s), without writing files.`,
    "Unchanged: seal encode/read logic, Strong Mode, VAULT/confirmed/final decisions, DB, dashboard wiring, commits, and remote push.",
  ];
}

function buildPatchDraftText(input: ProposalPatchPreviewInput): string {
  const files = input.affectedFiles.length > 0
    ? input.affectedFiles.map((file) => `- ${file}`).join("\n")
    : "- No concrete file target supplied; human must identify the exact file before any later patch command.";
  const tests = input.testPlan.length > 0
    ? input.testPlan.map((item) => `- ${item}`).join("\n")
    : "- Run API typecheck.\n- Run root typecheck.\n- Run git diff --check.";
  const rollback = input.rollbackPlan.length > 0
    ? input.rollbackPlan.map((item) => `- ${item}`).join("\n")
    : "- Do not apply this preview. If a later approved patch is created, revert only that patch.";
  const safety = input.safetyChecklist.length > 0
    ? input.safetyChecklist.map((item) => `- ${item}`).join("\n")
    : "- Auto-apply remains disabled.\n- VAULT/confirmed/final decisions remain unchanged.\n- Human approval is required.";

  return [
    "DRY-RUN / PREVIEW ONLY",
    "This is not an executable patch and was not applied to any file.",
    "",
    `Proposal: ${input.proposalKey}`,
    `Risk: ${input.riskLevel}`,
    "",
    "Affected files:",
    files,
    "",
    "Intended change:",
    input.proposedChange,
    "",
    "Small step:",
    input.smallStep,
    "",
    "Before/after summary:",
    ...summarizeBeforeAfter(input).map((item) => `- ${item}`),
    "",
    "Validation plan:",
    tests,
    "",
    "Rollback plan:",
    rollback,
    "",
    "Safety checklist:",
    safety,
    "",
    "Boundary:",
    "No files were written. No patch was applied. No commit or remote push is allowed by this preview.",
  ].join("\n");
}

function buildDryRunPatchPlan(input: ProposalPatchPreviewInput) {
  const beforeAfterSummary = summarizeBeforeAfter(input);
  return {
    dryRunOnly: true,
    patchDraftText: buildPatchDraftText(input),
    affectedFiles: input.affectedFiles,
    intendedChange: input.proposedChange,
    beforeAfterSummary,
    proposedChange: input.proposedChange,
    smallStep: input.smallStep,
    testPlan: input.testPlan,
    rollbackPlan: input.rollbackPlan,
    safetyChecklist: input.safetyChecklist,
    implementationBoundary:
      "This is a dry-run preview only. It does not generate a code diff, write files, apply patches, commit, push, or change runtime behavior.",
    nextCommandRequired:
      "A separate explicit command is required before any patch draft can be prepared.",
  };
}

router.post(
  "/memory",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawRecords = Array.isArray(body["records"]) ? body["records"] : [body];
    const records = rawRecords
      .map((item, index) => normalizeLearningTestRecord(item, index))
      .filter((item): item is LearningTestRecord => item !== null);

    if (records.length === 0) {
      res.status(400).json({
        error: "records required",
        note:
          "Learning memory needs at least one scenario/fileKind/finalDecision record. It remains advisory-only.",
      });
      return;
    }

    const learningMemory = buildLearningDnaMemory(records);
    const row = await recordEvent({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      kind: LEARNING_MEMORY_AUDIT_KIND,
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: {
        learningMemory,
        recordCount: records.length,
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        idMatched: learningMemory.safety.idMatched,
        recommendationsAutoApplied: learningMemory.safety.recommendationsAutoApplied,
        learningMode: learningMemory.automation.learningMode,
        autoApplyEnvName: LEARNING_AUTO_APPLY_ENV,
        autoApplyEnabled: learningMemory.automation.autoApplyEnabled,
        requiresHumanApproval: learningMemory.automation.requiresHumanApproval,
      },
    });

    res.json({
      ok: true,
      auditId: row.id,
      learningMemory,
    });
  }),
);

registerLearningModeRoute(router);

router.post(
  "/proposals/preview",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawRecords = Array.isArray(body["records"]) ? body["records"] : [];
    const records = rawRecords
      .map((item, index) => normalizeLearningTestRecord(item, index))
      .filter((item): item is LearningTestRecord => item !== null);
    const rawRecommendations = Array.isArray(body["recommendations"]) ? body["recommendations"] : [];
    const inputRecommendations = rawRecommendations
      .map((item, index) => normalizeLearningRecommendationPreviewInput(item, index))
      .filter((item): item is LearningRecommendation => item !== null);

    if (records.length === 0 && inputRecommendations.length === 0) {
      res.status(400).json({
        error: "records or recommendations required",
        note:
          "Proposal preview is internal/admin only. It needs learning records or learning recommendations and returns record-only proposals without DB writes.",
      });
      return;
    }

    const learningMemory = buildLearningDnaMemory(records);
    const sourceRecommendations =
      inputRecommendations.length > 0 ? inputRecommendations : learningMemory.recommendations;
    const proposals = createProposalsFromLearningRecommendations(sourceRecommendations);
    const proposalValidation = proposals.map((proposal) => ({
      proposalKey: proposal.proposalKey,
      riskLevel: proposal.riskLevel,
      patchDraftAllowed: proposal.patchDraftAllowed,
      validation: validateHumanApprovedImprovementProposal(proposal),
    }));

    res.json({
      ok: true,
      previewOnly: true,
      recordOnly: true,
      recordCount: records.length,
      recommendationCount: sourceRecommendations.length,
      learningMemory: {
        status: learningMemory.status,
        memoryVersion: learningMemory.memoryVersion,
        generatedAt: learningMemory.generatedAt,
        recordCount: learningMemory.recordCount,
        lessons: learningMemory.lessons,
        recommendations: learningMemory.recommendations,
        safety: learningMemory.safety,
        automation: learningMemory.automation,
      },
      proposals,
      proposalValidation,
      safety: {
        requiresHumanApproval: true,
        patchApplied: false,
        commitAllowed: false,
        remotePushAllowed: false,
        autoApply: false,
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        note:
          "Preview endpoint never writes DB records, applies patches, commits, pushes, or changes VAULT/confirmed/final decisions.",
      },
    });
  }),
);

router.post(
  "/proposals/decision",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const input = normalizeProposalDecisionInput(req.body);
    if (!input) {
      res.status(400).json({
        error: "invalid proposal decision",
        note: "proposalKey and decision=approved|rejected|request_patch_draft are required.",
      });
      return;
    }

    const inferredRisk = inferProposalDecisionRisk(input.proposalKey);
    const patchDraftRejected =
      input.decision === "request_patch_draft" && inferredRisk === "forbidden";
    const patchDraftRequested =
      input.decision === "request_patch_draft" && !patchDraftRejected;
    const response = {
      ok: !patchDraftRejected,
      recordOnly: true,
      proposalKey: input.proposalKey,
      decision: input.decision,
      reason: input.reason,
      inferredRisk,
      approved: input.decision === "approved",
      rejected: input.decision === "rejected" || patchDraftRejected,
      patchDraftRequested,
      patchDraftRejected,
      patchDraftMessage: patchDraftRequested
        ? "Patch taslagi ayri komutla hazirlanmali; bu endpoint yalniz record-only karar dondurur."
        : null,
      warning:
        input.decision === "request_patch_draft" && inferredRisk === "high"
          ? "HIGH_RISK_PROPOSAL_REQUIRES_SEPARATE_HUMAN_SAFETY_REVIEW"
          : null,
      rejectionReason: patchDraftRejected
        ? "Forbidden proposal cannot request a patch draft."
        : null,
      requiresHumanApproval: true,
      patchApplied: false,
      commitAllowed: false,
      remotePushAllowed: false,
      autoApply: false,
      safety: {
        finalDecisionChanged: false,
        vaultConfirmedFinalChanged: false,
        strongModeChanged: false,
        sealReadWriteChanged: false,
        dbWritten: false,
        dashboardLinked: false,
        note:
          "Proposal decision flow is record-only. It does not apply code, write DB records, commit, push, or change VAULT/confirmed/final decisions.",
      },
    };

    if (patchDraftRejected) {
      res.status(409).json(response);
      return;
    }

    res.json(response);
  }),
);

router.post(
  "/proposals/patch-preview",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const input = normalizeProposalPatchPreviewInput(req.body);
    if (!input) {
      res.status(400).json({
        error: "invalid proposal patch preview request",
        note:
          "proposalKey is required. This endpoint only returns dry-run plans and never writes files.",
      });
      return;
    }

    const baseSafety = {
      requiresHumanApproval: true,
      patchApplied: false,
      commitAllowed: false,
      remotePushAllowed: false,
      autoApply: false,
      finalDecisionChanged: false,
      vaultConfirmedFinalChanged: false,
      strongModeChanged: false,
      sealReadWriteChanged: false,
      dbWritten: false,
      dashboardLinked: false,
      filesWritten: false,
    };

    if (input.riskLevel === "forbidden") {
      res.status(409).json({
        ok: false,
        previewOnly: true,
        dryRunOnly: true,
        proposalKey: input.proposalKey,
        riskLevel: input.riskLevel,
        patchPreviewProduced: false,
        patchDraftText: null,
        affectedFiles: input.affectedFiles,
        intendedChange: input.proposedChange,
        beforeAfterSummary: null,
        testPlan: input.testPlan,
        rollbackPlan: input.rollbackPlan,
        safetyChecklist: input.safetyChecklist,
        dryRunPatchPlan: null,
        warning: "FORBIDDEN_PROPOSAL_PATCH_PREVIEW_REJECTED",
        rejectionReason:
          "Forbidden proposals cannot produce patch previews. ID threshold, VAULT, confirmed, final, and auto-apply changes remain blocked.",
        ...baseSafety,
      });
      return;
    }

    if (input.riskLevel === "high") {
      res.json({
        ok: true,
        previewOnly: true,
        dryRunOnly: true,
        proposalKey: input.proposalKey,
        riskLevel: input.riskLevel,
        patchPreviewProduced: false,
        patchDraftText: null,
        affectedFiles: input.affectedFiles,
        intendedChange: input.proposedChange,
        beforeAfterSummary: null,
        testPlan: input.testPlan,
        rollbackPlan: input.rollbackPlan,
        safetyChecklist: input.safetyChecklist,
        dryRunPatchPlan: null,
        warning: "HIGH_RISK_PROPOSAL_REQUIRES_MANUAL_REVIEW_NO_PATCH_PREVIEW",
        manualReviewRequired: true,
        note:
          "High-risk proposals require separate human safety review. No code or patch preview is produced here.",
        ...baseSafety,
      });
      return;
    }

    res.json({
      ok: true,
      previewOnly: true,
      dryRunOnly: true,
      proposalKey: input.proposalKey,
      riskLevel: input.riskLevel,
      patchPreviewProduced: true,
      patchDraftText: buildPatchDraftText(input),
      affectedFiles: input.affectedFiles,
      intendedChange: input.proposedChange,
      beforeAfterSummary: summarizeBeforeAfter(input),
      testPlan: input.testPlan,
      rollbackPlan: input.rollbackPlan,
      safetyChecklist: input.safetyChecklist,
      dryRunPatchPlan: buildDryRunPatchPlan(input),
      warning: null,
      manualReviewRequired: false,
      ...baseSafety,
    });
  }),
);

router.post(
  "/proposals/apply-readiness",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const input = normalizeProposalApplyReadinessInput(req.body);
    if (!input) {
      res.status(400).json({
        error: "invalid proposal apply readiness request",
        note:
          "proposalKey and patchDraftText are required. This endpoint only checks dry-run readiness and never writes files.",
      });
      return;
    }

    const blockedReasons = collectApplyReadinessBlockedReasons(input);
    const canApply =
      (input.riskLevel === "low" || input.riskLevel === "medium") &&
      blockedReasons.length === 0;

    res.json({
      ok: true,
      previewOnly: true,
      dryRunOnly: true,
      readinessOnly: true,
      proposalKey: input.proposalKey,
      canApply,
      riskLevel: input.riskLevel,
      affectedFiles: input.affectedFiles,
      blockedReasons,
      requiredHumanConfirmation: canApply
        ? "A separate explicit human-approved apply command is still required before any file can change."
        : "Apply readiness is blocked. Human safety review is required and no file can change from this endpoint.",
      testPlan: input.testPlan,
      rollbackPlan: input.rollbackPlan,
      finalSafetyChecklist: buildFinalSafetyChecklist(input, blockedReasons),
      patchApplied: false,
      commitAllowed: false,
      remotePushAllowed: false,
      autoApply: false,
      requiresHumanApproval: true,
      filesWritten: false,
      safety: {
        finalDecisionChanged: false,
        vaultConfirmedFinalChanged: false,
        strongModeChanged: false,
        sealReadWriteChanged: false,
        ownershipBlockChanged: false,
        dbWritten: false,
        dashboardLinked: false,
        note:
          "Apply readiness is a safety gate only. It does not write files, apply patches, commit, push, or change VAULT/confirmed/final decisions.",
      },
    });
  }),
);

router.post(
  "/proposals/apply",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const input = normalizeProposalApplyInput(req.body);
    if (!input) {
      res.status(400).json({
        error: "invalid proposal apply request",
        note:
          "proposalKey, patchDraftText, explicitConfirmation, patchDraftAllowed=true, and safe operations are required.",
        applied: false,
        commitCreated: false,
        remotePushDone: false,
        autoApply: false,
      });
      return;
    }

    const blockedReasons = collectApplyInputBlockedReasons(input);
    if (input.explicitConfirmation !== PROPOSAL_APPLY_CONFIRMATION) {
      res.status(400).json({
        ok: false,
        applied: false,
        canApply: false,
        riskLevel: input.riskLevel,
        proposalKey: input.proposalKey,
        blockedReasons,
        requiredConfirmation: PROPOSAL_APPLY_CONFIRMATION,
        commitCreated: false,
        remotePushDone: false,
        autoApply: false,
        note:
          "Explicit human confirmation is required before this endpoint can write allowlisted files.",
      });
      return;
    }

    if (blockedReasons.length > 0) {
      res.status(409).json({
        ok: false,
        applied: false,
        canApply: false,
        riskLevel: input.riskLevel,
        proposalKey: input.proposalKey,
        affectedFiles: input.affectedFiles,
        blockedReasons,
        commitCreated: false,
        remotePushDone: false,
        autoApply: false,
        note:
          "Apply request was blocked by the final safety gate. No file was written.",
      });
      return;
    }

    try {
      const applyResult = await applySafeProposalOperations(input);
      res.json({
        ok: true,
        applied: true,
        canApply: true,
        riskLevel: input.riskLevel,
        proposalKey: input.proposalKey,
        changedFiles: applyResult.changedFiles,
        operationResults: applyResult.operationResults,
        rollbackPlan: [
          ...applyResult.rollbackPlan,
          ...input.rollbackPlan,
        ],
        requiredTests: input.testPlan.length > 0
          ? input.testPlan
          : ["Run API typecheck.", "Run root typecheck.", "Run git diff --check."],
        finalSafetyChecklist: buildFinalSafetyChecklist(input, []),
        commitCreated: false,
        commitAllowed: false,
        remotePushDone: false,
        remotePushAllowed: false,
        autoApply: false,
        requiresHumanApproval: true,
        safety: {
          explicitConfirmation: input.explicitConfirmation,
          finalDecisionChanged: false,
          vaultConfirmedFinalChanged: false,
          strongModeChanged: false,
          sealReadWriteChanged: false,
          ownershipBlockChanged: false,
          dbWritten: false,
          dashboardLinked: false,
          note:
            "Apply endpoint only wrote allowlisted files after explicit confirmation. It did not commit, push, or change VAULT/confirmed/final decisions.",
        },
      });
    } catch (error) {
      res.status(409).json({
        ok: false,
        applied: false,
        canApply: false,
        riskLevel: input.riskLevel,
        proposalKey: input.proposalKey,
        affectedFiles: input.affectedFiles,
        blockedReasons: ["safe_patch_application_failed"],
        error: error instanceof Error ? error.message : "unknown_apply_error",
        commitCreated: false,
        remotePushDone: false,
        autoApply: false,
        note:
          "Safe patch application failed. Any partially written file was restored when possible.",
      });
    }
  }),
);

router.post(
  "/records/visual/lab-preview",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawRecords = Array.isArray(body["records"]) ? body["records"] : [body];
    const normalized = rawRecords.map((item, index) => ({
      index,
      normalized: normalizeVisualLearningInput(item),
    }));
    const errors = normalized
      .filter((item) => !item.normalized.input)
      .map((item) => ({
        index: item.index,
        error: item.normalized.error ?? "invalid visual learning record",
      }));

    if (errors.length > 0) {
      res.status(400).json({
        error: "invalid visual lab learning records",
        errors,
        note:
          "Visual lab learning records require correct, wrong-ID, and unsealed-source safety results. They remain advisory-only and are not persisted.",
      });
      return;
    }

    const adapterRecords = normalized
      .map((item) => item.normalized.input)
      .filter((item): item is VisualLearningAdapterInput => item !== null)
      .map((input) => createVisualLearningAdapterRecord(input));
    const batchValidation = validateVisualLearningAdapterBatch(adapterRecords);
    if (!batchValidation.ok) {
      res.status(400).json({
        error: "unsafe visual lab learning batch",
        violations: batchValidation.violations,
      });
      return;
    }

    const learningRecords = adapterRecords.map((record) => record.learningRecord);
    const learningMemory = buildLearningDnaMemory(learningRecords);

    res.json({
      ok: true,
      previewOnly: true,
      internalLabOnly: true,
      persisted: false,
      dbWritten: false,
      recordCount: adapterRecords.length,
      adapterVersion: adapterRecords[0]?.adapterVersion ?? null,
      scenarios: adapterRecords.map((record) => ({
        recordId: record.learningRecord.recordId,
        scenario: record.source.scenario,
        finalDecision: record.learningRecord.finalDecision,
        idMatched: record.learningRecord.idMatched,
        eccResult: record.source.eccResult,
        survivedTransform: record.source.survivedTransform,
        wrongIdExactMatch: record.source.wrongIdResult?.exactIdMatch === true,
        unsealedSourceFound: record.source.unsealedSourceResult?.found === true,
      })),
      learningRecords,
      learningMemory,
      safety: {
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        recommendationsAutoApplied: learningMemory.safety.recommendationsAutoApplied,
        autoApply: false,
        mainProductFlowChanged: false,
        dbMigrationRequired: false,
        note:
          "Visual lab preview records feed learningDnaMemory only. They do not persist DB rows, change /cloak-image or /analyze-image, or produce VAULT/confirmed/final decisions.",
      },
    });
  }),
);

router.post(
  "/records/video/lab-preview",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawRecords = Array.isArray(body["records"]) ? body["records"] : [body];
    const normalized = rawRecords.map((item, index) => ({
      index,
      normalized: normalizeVideoLearningInput(item),
    }));
    const errors = normalized
      .filter((item) => !item.normalized.input)
      .map((item) => ({
        index: item.index,
        error: item.normalized.error ?? "invalid video learning record",
      }));

    if (errors.length > 0) {
      res.status(400).json({
        error: "invalid video lab learning records",
        errors,
        note:
          "Video lab learning records require correct, wrong-ID, and unsealed-source safety results. They remain advisory-only and are not persisted.",
      });
      return;
    }

    const adapterRecords = normalized
      .map((item) => item.normalized.input)
      .filter((item): item is VideoLearningAdapterInput => item !== null)
      .map((input) => createVideoLearningAdapterRecord(input));
    const batchValidation = validateVideoLearningAdapterBatch(adapterRecords);
    if (!batchValidation.ok) {
      res.status(400).json({
        error: "unsafe video lab learning batch",
        violations: batchValidation.violations,
      });
      return;
    }

    const learningRecords = adapterRecords.map((record) => record.learningRecord);
    const learningMemory = buildLearningDnaMemory(learningRecords);

    res.json({
      ok: true,
      previewOnly: true,
      internalLabOnly: true,
      persisted: false,
      dbWritten: false,
      recordCount: adapterRecords.length,
      adapterVersion: adapterRecords[0]?.adapterVersion ?? null,
      scenarios: adapterRecords.map((record) => ({
        recordId: record.learningRecord.recordId,
        scenario: record.source.scenario,
        videoDecision: record.source.videoDecision,
        finalDecision: record.learningRecord.finalDecision,
        idMatched: record.learningRecord.idMatched,
        codec: record.source.codec,
        container: record.source.container,
        hasBFrames: record.source.hasBFrames,
        hasPtsDtsReorder: record.source.hasPtsDtsReorder,
        sourceTimeBase: record.source.sourceTimeBase,
        outputTimeBase: record.source.outputTimeBase,
        frameCountDrift: record.source.frameCountDrift,
        durationDriftSec: record.source.durationDriftSec,
        audioPreserved: record.source.audioPreserved,
        wrongIdExactMatch: record.source.wrongIdResult.exactIdMatch === true,
        unsealedSourceFound: record.source.unsealedSourceResult.found === true,
      })),
      learningRecords,
      learningMemory,
      safety: {
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        recommendationsAutoApplied: learningMemory.safety.recommendationsAutoApplied,
        autoApply: false,
        mainVideoFlowChanged: false,
        dbMigrationRequired: false,
        note:
          "Video lab preview records feed learningDnaMemory only. They do not persist DB rows, change video encode/analyze flows, or produce VAULT/confirmed/final decisions.",
      },
    });
  }),
);

router.post(
  "/records/audio/lab-preview",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawRecords = Array.isArray(body["records"]) ? body["records"] : [body];
    const normalized = rawRecords.map((item, index) => ({
      index,
      normalized: normalizeAudioLearningInput(item),
    }));
    const errors = normalized
      .filter((item) => !item.normalized.input)
      .map((item) => ({
        index: item.index,
        error: item.normalized.error ?? "invalid audio learning record",
      }));

    if (errors.length > 0) {
      res.status(400).json({
        error: "invalid audio lab learning records",
        errors,
        note:
          "Audio lab learning records require correct, wrong-ID, and unsealed-source safety results. They remain advisory-only and are not persisted.",
      });
      return;
    }

    const adapterRecords = normalized
      .map((item) => item.normalized.input)
      .filter((item): item is AudioLearningAdapterInput => item !== null)
      .map((input) => createAudioLearningAdapterRecord(input));
    const batchValidation = validateAudioLearningAdapterBatch(adapterRecords);
    if (!batchValidation.ok) {
      res.status(400).json({
        error: "unsafe audio lab learning batch",
        violations: batchValidation.violations,
      });
      return;
    }

    const learningRecords = adapterRecords.map((record) => record.learningRecord);
    const learningMemory = buildLearningDnaMemory(learningRecords);

    res.json({
      ok: true,
      previewOnly: true,
      internalLabOnly: true,
      persisted: false,
      dbWritten: false,
      recordCount: adapterRecords.length,
      adapterVersion: adapterRecords[0]?.adapterVersion ?? null,
      scenarios: adapterRecords.map((record) => ({
        recordId: record.learningRecord.recordId,
        scenario: record.source.scenario,
        audioOutcome: record.source.audioOutcome,
        finalDecision: record.learningRecord.finalDecision,
        idMatched: record.learningRecord.idMatched,
        format: record.source.format,
        codec: record.source.codec,
        sampleRateHz: record.source.sampleRateHz,
        channelCount: record.source.channelCount,
        volumeScale: record.source.volumeScale,
        trimOffsetSec: record.source.trimOffsetSec,
        selectedOffsetSec: record.source.selectedOffsetSec,
        compressionSummary: record.source.compressionSummary,
        transcodeSummary: record.source.transcodeSummary,
        wrongIdExactMatch: record.source.wrongIdResult.exactIdMatch === true,
        unsealedSourceFound: record.source.unsealedSourceResult.found === true,
      })),
      learningRecords,
      learningMemory,
      safety: {
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        recommendationsAutoApplied: learningMemory.safety.recommendationsAutoApplied,
        autoApply: false,
        mainAudioFlowChanged: false,
        mainVideoFlowChanged: false,
        dbMigrationRequired: false,
        note:
          "Audio lab preview records feed learningDnaMemory only. They do not persist DB rows, change audio/video encode/analyze flows, or produce VAULT/confirmed/final decisions.",
      },
    });
  }),
);

router.post(
  "/records/text/lab-preview",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const rawRecords = Array.isArray(body["records"]) ? body["records"] : [body];
    const normalized = rawRecords.map((item, index) => ({
      index,
      normalized: normalizeTextLearningInput(item),
    }));
    const errors = normalized
      .filter((item) => !item.normalized.input)
      .map((item) => ({
        index: item.index,
        error: item.normalized.error ?? "invalid text learning record",
      }));

    if (errors.length > 0) {
      res.status(400).json({
        error: "invalid text lab learning records",
        errors,
        note:
          "Text lab learning records require correct, wrong-ID, and unsealed-source safety results. They remain advisory-only and are not persisted.",
      });
      return;
    }

    const adapterRecords = normalized
      .map((item) => item.normalized.input)
      .filter((item): item is TextLearningAdapterInput => item !== null)
      .map((input) => createTextLearningAdapterRecord(input));
    const batchValidation = validateTextLearningAdapterBatch(adapterRecords);
    if (!batchValidation.ok) {
      res.status(400).json({
        error: "unsafe text lab learning batch",
        violations: batchValidation.violations,
      });
      return;
    }

    const learningRecords = adapterRecords.map((record) => record.learningRecord);
    const learningMemory = buildLearningDnaMemory(learningRecords);

    res.json({
      ok: true,
      previewOnly: true,
      internalLabOnly: true,
      persisted: false,
      dbWritten: false,
      recordCount: adapterRecords.length,
      adapterVersion: adapterRecords[0]?.adapterVersion ?? null,
      scenarios: adapterRecords.map((record) => ({
        recordId: record.learningRecord.recordId,
        scenario: record.source.scenario,
        textOutcome: record.source.textOutcome,
        finalDecision: record.learningRecord.finalDecision,
        idMatched: record.learningRecord.idMatched,
        format: record.source.format,
        sourceTextLength: record.source.sourceTextLength,
        observedTextLength: record.source.observedTextLength,
        retainedRatio: record.source.retainedRatio,
        ocrSupport: record.source.ocrSupport,
        heavyOcrTriggered: record.source.heavyOcrTriggered,
        ocrConfidence: record.source.ocrConfidence,
        wrongIdExactMatch: record.source.wrongIdResult.exactIdMatch === true,
        unsealedSourceFound: record.source.unsealedSourceResult.found === true,
      })),
      learningRecords,
      learningMemory,
      safety: {
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        recommendationsAutoApplied: learningMemory.safety.recommendationsAutoApplied,
        autoApply: false,
        mainTextFlowChanged: false,
        mainImageFlowChanged: false,
        mainVideoFlowChanged: false,
        mainAudioFlowChanged: false,
        dbMigrationRequired: false,
        note:
          "Text lab preview records feed learningDnaMemory only. They do not persist DB rows, change cloak-text/scan-cloak flows, or produce VAULT/confirmed/final decisions.",
      },
    });
  }),
);

router.post(
  "/records/visual",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const normalized = normalizeVisualLearningInput(req.body);
    if (!normalized.input) {
      res.status(400).json({
        error: normalized.error ?? "invalid visual learning record",
        note:
          "Visual learning records require correct, wrong-ID, and unsealed-source safety results. They remain advisory-only.",
      });
      return;
    }

    const adapterRecord = createVisualLearningAdapterRecord(normalized.input);
    if (!adapterRecord.validation.ok) {
      res.status(400).json({
        error: "unsafe visual learning adapter record",
        violations: adapterRecord.validation.violations,
      });
      return;
    }

    const persistentInput = createPersistentLearningRecordInput({
      learningRecord: adapterRecord.learningRecord,
      mediaType: "image",
      clientId: adapterRecord.source.clientIdRef,
      docId: adapterRecord.source.docIdRef,
      sourceRef: normalized.refs.sourceRef,
      dnaRecordId: normalized.refs.dnaRecordId,
      testHistoryId: normalized.refs.testHistoryId,
      expectedId: adapterRecord.source.correctIdResult.expectedIdHex ?? null,
      observedId: adapterRecord.source.correctIdResult.decodedIdHex ?? null,
      wrongIdDetected: adapterRecord.source.wrongIdResult?.found === true,
      unsealedPositive: adapterRecord.source.unsealedSourceResult?.found === true,
      eccStatus: adapterRecord.source.eccResult,
      lessonTags: [
        `visual:${adapterRecord.source.scenario}`,
        `ecc:${adapterRecord.source.eccResult}`,
        adapterRecord.source.survivedTransform ? "transform:survived" : "transform:failed",
      ],
      recommendationTags: adapterRecord.learningRecord.modules
        .filter((module) => module.failed || module.rescued)
        .map((module) => `${module.module}:${module.rescued ? "rescued" : "failed"}`),
      note: adapterRecord.learningRecord.note,
    });

    const row = await persistLearningRecord(persistentInput);
    const learningMemory = buildLearningDnaMemory([adapterRecord.learningRecord]);

    res.json({
      ok: true,
      record: row,
      adapter: {
        adapterVersion: adapterRecord.adapterVersion,
        validation: adapterRecord.validation,
        safety: adapterRecord.safety,
      },
      learningMemory,
      safety: {
        finalDecision: learningMemory.safety.finalDecision,
        canOpenVault: learningMemory.safety.canOpenVault,
        vaultCapable: learningMemory.safety.vaultCapable,
        confirmed: learningMemory.safety.confirmed,
        recommendationsAutoApplied: learningMemory.safety.recommendationsAutoApplied,
      },
    });
  }),
);

registerLearningRecordReadOnlyRoutes(router);

router.post(
  "/approvals",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const approvalInput = normalizeLearningApprovalInput(req.body);
    if (!approvalInput) {
      res.status(400).json({
        error: "invalid approval request",
        note:
          "recommendationId, recommendationType, riskLevel, action and userId are required. Approval remains record-only.",
      });
      return;
    }

    const approval = buildLearningApprovalDecision(approvalInput);
    const row = await recordEvent({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      kind: LEARNING_MEMORY_AUDIT_KIND,
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      userId: approvalInput.userId,
      details: {
        eventType: "learning_recommendation_approval",
        approval,
        recommendationId: approval.recommendationId,
        recommendationType: approval.recommendationType,
        riskLevel: approval.riskLevel,
        approvalStatus: approval.approvalStatus,
        applied: approval.applied,
        appliedScope: approval.appliedScope,
        autoApplyEnabled: approval.autoApplyEnabled,
        autoApplied: approval.autoApplied,
        finalDecision: approval.safety.finalDecision,
        canOpenVault: approval.safety.canOpenVault,
        vaultCapable: approval.safety.vaultCapable,
        confirmed: approval.safety.confirmed,
        idMatched: approval.safety.idMatched,
      },
    });

    res.json({
      ok: true,
      auditId: row.id,
      approval,
    });
  }),
);

export default router;
