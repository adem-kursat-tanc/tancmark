import { z } from "zod";

export const canonicalDnaIdSchema = z.enum([
  "format",
  "image",
  "video",
  "audio",
  "text-document",
  "discovery-search",
  "tanclive",
  "secure-room-zehir",
  "evidence",
  "license-product-gate",
  "security",
  "user-subscription",
  "pricing-cost",
  "saas-operations",
  "product-marketing-legal",
  "codex-development",
]);

export const canonicalDnaHealthSchema = z.object({
  dnaId: canonicalDnaIdSchema,
  name: z.string(),
  health: z.enum(["HEALTHY", "STALE", "PARTIAL", "NOT_MEASURED_REAL_EVIDENCE_UNAVAILABLE"]),
  lastDataAt: z.string().nullable(),
  testStatus: z.enum(["TESTED", "PARTIAL", "NOT_MEASURED"]),
  state: z.string(),
});

export const canonicalDnaControlledOperationTypeSchema = z.enum([
  "record_advisory",
  "update_read_only_label",
  "patch_docs_external_executor",
  "patch_helper_external_executor",
]);

export const canonicalDnaOwnerApprovalTokenSchema = z.object({
  approvalPhrase: z.literal("APPROVE_CHIEF_BRAIN_SAFE_ACTION"),
  approvalVersion: z.literal("tancmark-controlled-apply-v1"),
  proposalId: z.string().min(1).max(180),
  proposalVersion: z.string().min(1).max(180),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/i),
  operationDigest: z.string().regex(/^[a-f0-9]{64}$/i),
  tenantScope: z.string().min(1).max(180),
  approvedOperationTypes: z.array(canonicalDnaControlledOperationTypeSchema).min(1).max(4),
  approvedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  nonce: z.string().min(16).max(180),
  approvedByRole: z.literal("OWNER_ADEM_KURSAT_TANC"),
}).strict();

export const canonicalDnaApplyRequestSchema = z.object({
  tenantScope: z.string().min(1).max(180),
  operations: z.array(z.object({
    operationId: z.string().min(1).max(180),
    type: canonicalDnaControlledOperationTypeSchema,
    description: z.string().min(1).max(800),
    rollback: z.string().min(1).max(800),
  })).max(32),
  approval: canonicalDnaOwnerApprovalTokenSchema.nullable(),
  dryRun: z.boolean(),
}).strict();

export const canonicalDnaRoutes = {
  registry: { method: "GET", path: "/api/aegis/dna/registry", adminOnly: true },
  health: { method: "GET", path: "/api/aegis/dna/health", adminOnly: true },
  summary: { method: "GET", path: "/api/aegis/dna/summary", adminOnly: true },
  proposals: { method: "GET", path: "/api/aegis/dna/proposals", adminOnly: true },
  jobs: { method: "GET", path: "/api/aegis/dna/jobs", adminOnly: true },
  research: { method: "GET", path: "/api/aegis/dna/research", adminOnly: true },
  audit: { method: "GET", path: "/api/aegis/dna/audit", adminOnly: true },
  apply: { method: "POST", path: "/api/aegis/dna/proposals/{proposalId}/apply", adminOnly: true },
} as const;

export type CanonicalDnaId = z.infer<typeof canonicalDnaIdSchema>;
export type CanonicalDnaHealth = z.infer<typeof canonicalDnaHealthSchema>;
export type CanonicalDnaApplyRequest = z.infer<typeof canonicalDnaApplyRequestSchema>;
export type CanonicalDnaOwnerApprovalToken = z.infer<typeof canonicalDnaOwnerApprovalTokenSchema>;
