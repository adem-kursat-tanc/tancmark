import { createHash } from "node:crypto";
import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  type ChiefBrainProposal,
} from "./chiefBrain";

export const CONTROLLED_APPLY_VERSION = "tancmark-controlled-apply-v1" as const;
export const SAFE_AUTOMATIC_LEARNING = true as const;
export const AUTOMATIC_PROPOSAL_GENERATION = true as const;
export const AUTO_APPLY = false as const;
export const AUTO_DEPLOY = false as const;
export const AUTO_PUSH = false as const;
export const AUTO_VAULT_DECISION = false as const;

export type ControlledOperationType =
  | "record_advisory"
  | "update_read_only_label"
  | "patch_docs_external_executor"
  | "patch_helper_external_executor";

export interface ControlledOperation {
  operationId: string;
  type: ControlledOperationType;
  description: string;
  rollback: string;
}

export interface OwnerApprovalToken {
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  approvalVersion: typeof CONTROLLED_APPLY_VERSION;
  proposalId: string;
  proposalVersion: string;
  proposalDigest: string;
  operationDigest: string;
  tenantScope: string;
  approvedOperationTypes: ControlledOperationType[];
  approvedAt: string;
  expiresAt: string;
  nonce: string;
  approvedByRole: "OWNER_ADEM_KURSAT_TANC";
}

export interface ControlledApplyRequest {
  tenantScope: string;
  proposal: ChiefBrainProposal;
  operations: ControlledOperation[];
  approval: OwnerApprovalToken | null;
  dryRun: boolean;
}

export interface ControlledApplyResult {
  status:
    | "DRY_RUN_READY_OWNER_APPROVAL_REQUIRED"
    | "CONTROLLED_APPLY_RECORDED"
    | "CONTROLLED_APPLY_REJECTED";
  applied: boolean;
  autoApplied: false;
  approvalRequired: true;
  reasons: string[];
  operationDigest: string;
  rollbackVerified: boolean;
  filesystemChanged: false;
  productBehaviorChanged: false;
  canOpenVault: false;
}

const FORBIDDEN_TEXT = /(?:vault|confirmed|final decision|threshold|ownership|pre-seal|payload|full id|deploy|push|secret|tenant transfer)/i;
const SAFE_IN_RUNTIME = new Set<ControlledOperationType>(["record_advisory", "update_read_only_label"]);

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function controlledOperationDigest(operations: readonly ControlledOperation[]): string {
  return digest(operations);
}

export class ControlledDnaApplyGate {
  #consumedApprovalNonces = new Set<string>();

  evaluate(request: ControlledApplyRequest, now = new Date()): ControlledApplyResult {
    const reasons: string[] = [];
    const operationDigest = controlledOperationDigest(request.operations);
    if (request.operations.length === 0) reasons.push("EMPTY_OPERATION_LIST");
    if (request.operations.some((operation) => !operation.rollback.trim())) reasons.push("ROLLBACK_REQUIRED");
    if (request.operations.some((operation) => FORBIDDEN_TEXT.test(`${operation.description} ${operation.rollback}`))) {
      reasons.push("FORBIDDEN_OPERATION_CONTENT");
    }
    if (request.proposal.approvalClass === "FORBIDDEN") reasons.push("FORBIDDEN_PROPOSAL");
    if (request.proposal.approvalClass === "HIGH_RISK_MANUAL_ENGINEERING_REVIEW") {
      reasons.push("HIGH_RISK_ENGINEERING_REVIEW_REQUIRED");
    }
    if (request.operations.some((operation) => !SAFE_IN_RUNTIME.has(operation.type))) {
      reasons.push("EXTERNAL_CONTROLLED_EXECUTOR_REQUIRED");
    }
    const approval = request.approval;
    if (!approval) reasons.push("OWNER_APPROVAL_REQUIRED");
    else {
      if (approval.approvalPhrase !== CHIEF_BRAIN_APPROVAL_PHRASE) reasons.push("INVALID_OWNER_APPROVAL_PHRASE");
      if (approval.approvalVersion !== CONTROLLED_APPLY_VERSION) reasons.push("STALE_APPROVAL_VERSION");
      if (approval.approvedByRole !== "OWNER_ADEM_KURSAT_TANC") reasons.push("INVALID_OWNER_APPROVER_ROLE");
      if (approval.proposalId !== request.proposal.proposalId ||
          approval.proposalVersion !== request.proposal.proposalVersion ||
          approval.proposalDigest !== request.proposal.proposalDigest) reasons.push("STALE_OR_MISMATCHED_PROPOSAL_APPROVAL");
      if (approval.operationDigest !== operationDigest) reasons.push("MISMATCHED_OPERATION_APPROVAL_DIGEST");
      if (approval.tenantScope !== request.tenantScope) reasons.push("CROSS_TENANT_APPROVAL_REJECTED");
      const approvedAt = Date.parse(approval.approvedAt);
      const expiresAt = Date.parse(approval.expiresAt);
      if (!Number.isFinite(approvedAt) || !Number.isFinite(expiresAt) ||
          expiresAt <= now.getTime() || approvedAt > now.getTime() || approvedAt >= expiresAt) {
        reasons.push("STALE_APPROVAL_REJECTED");
      }
      if (typeof approval.nonce !== "string" || approval.nonce.length < 16 || approval.nonce.length > 180) {
        reasons.push("INVALID_APPROVAL_NONCE");
      } else if (this.#consumedApprovalNonces.has(approval.nonce)) reasons.push("STALE_APPROVAL_REPLAY_REJECTED");
      if (!Array.isArray(approval.approvedOperationTypes) ||
          request.operations.some((operation) => !approval.approvedOperationTypes.includes(operation.type))) {
        reasons.push("OPERATION_OUTSIDE_APPROVED_SCOPE");
      }
    }

    const blockingReasons = reasons.filter((reason) => reason !== "OWNER_APPROVAL_REQUIRED");
    if (request.dryRun) {
      return {
        status: blockingReasons.length === 0
          ? "DRY_RUN_READY_OWNER_APPROVAL_REQUIRED"
          : "CONTROLLED_APPLY_REJECTED",
        applied: false,
        autoApplied: false,
        approvalRequired: true,
        reasons,
        operationDigest,
        rollbackVerified: !reasons.includes("ROLLBACK_REQUIRED"),
        filesystemChanged: false,
        productBehaviorChanged: false,
        canOpenVault: false,
      };
    }

    if (reasons.length > 0 || !approval) {
      return {
        status: "CONTROLLED_APPLY_REJECTED",
        applied: false,
        autoApplied: false,
        approvalRequired: true,
        reasons,
        operationDigest,
        rollbackVerified: !reasons.includes("ROLLBACK_REQUIRED"),
        filesystemChanged: false,
        productBehaviorChanged: false,
        canOpenVault: false,
      };
    }

    this.#consumedApprovalNonces.add(approval.nonce);
    return {
      status: "CONTROLLED_APPLY_RECORDED",
      applied: true,
      autoApplied: false,
      approvalRequired: true,
      reasons: [],
      operationDigest,
      rollbackVerified: true,
      filesystemChanged: false,
      productBehaviorChanged: false,
      canOpenVault: false,
    };
  }
}
