import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import {
  LiveLocalCreateSessionBody,
  LiveLocalListSessionsQueryParams,
  LiveLocalGetSessionParams,
  LiveLocalIssueAccessTokenBody,
  LiveLocalIssueAccessToken201Response,
  LiveLocalStatus200Response,
  ProtectTextBody,
} from "../../lib/api-zod/src/generated/api.ts";
import {
  canonicalDnaApplyRequestSchema,
  canonicalDnaOwnerApprovalTokenSchema,
} from "../../lib/api-zod/src/canonicalDna.ts";

// Contract assertions intentionally target observable API values and rejection
// behavior, not Zod's version-specific error wording or internal representation.
assert.deepEqual(LiveLocalCreateSessionBody.parse({}), {
  legalHold: false,
  protectionMode: "PROTECTED_TANCMARK",
});
assert.deepEqual(LiveLocalCreateSessionBody.parse({ legalHold: true, protectionMode: "TRANSPORT_ONLY" }), {
  legalHold: true,
  protectionMode: "TRANSPORT_ONLY",
});
for (const field of ["tenant", "tenantId", "accountId", "rawId", "registry", "signature"]) {
  assert.equal(LiveLocalCreateSessionBody.safeParse({ [field]: "injected" }).success, false, field);
}
assert.equal(LiveLocalCreateSessionBody.safeParse({ legalHold: "false" }).success, false);
assert.equal(LiveLocalCreateSessionBody.safeParse({ protectionMode: "UNPROTECTED" }).success, false);
assert.deepEqual(LiveLocalListSessionsQueryParams.parse({}), { limit: 25 });
assert.deepEqual(LiveLocalListSessionsQueryParams.parse({ limit: "100", cursor: "0" }), { limit: 100, cursor: 0 });
for (const limit of ["0", "101", "NaN", "Infinity"]) {
  assert.equal(LiveLocalListSessionsQueryParams.safeParse({ limit }).success, false, limit);
}
assert.equal(LiveLocalListSessionsQueryParams.safeParse({ cursor: "-1" }).success, false);
const sessionId = "550e8400-e29b-41d4-a716-446655440000";
assert.deepEqual(LiveLocalGetSessionParams.parse({ sessionId }), { sessionId });
assert.equal(LiveLocalGetSessionParams.safeParse({ sessionId: "not-a-uuid" }).success, false);
assert.deepEqual(LiveLocalIssueAccessTokenBody.parse({ viewerSubject: "viewer", ttlSeconds: 300, resourceScopes: ["segment"] }), {
  viewerSubject: "viewer", ttlSeconds: 300, resourceScopes: ["segment"],
});
for (const body of [
  { viewerSubject: "" },
  { viewerSubject: "x", ttlSeconds: 301 },
  { viewerSubject: "x", ttlSeconds: "30" },
  { viewerSubject: "x", resourceScopes: [] },
  { viewerSubject: "x", resourceScopes: ["admin"] },
  { viewerSubject: "x", tenantId: "injected" },
]) assert.equal(LiveLocalIssueAccessTokenBody.safeParse(body).success, false);
const tokenResponse = {
  exchangeToken: "a".repeat(32), kid: "key", expiresAt: "2026-11-09T12:00:00Z",
  exchangeUrl: "/api/tancmark/live/local/v1/access/exchange",
};
assert.equal(LiveLocalIssueAccessToken201Response.parse(tokenResponse).expiresAt.toISOString(), new Date(tokenResponse.expiresAt).toISOString());
assert.equal(LiveLocalIssueAccessToken201Response.safeParse({ ...tokenResponse, expiresAt: "invalid" }).success, false);
assert.deepEqual(LiveLocalStatus200Response.parse({ arbitrary: { nested: true }, count: 1 }), { arbitrary: { nested: true }, count: 1 });
assert.deepEqual(ProtectTextBody.parse({ text: "example", clientId: 42, behavior: { mouseEvents: 0 } }), {
  text: "example", clientId: 42, behavior: { mouseEvents: 0 },
});
assert.equal(ProtectTextBody.safeParse({ text: "example", behavior: { mouseEvents: -1 } }).success, false);
assert.equal(ProtectTextBody.safeParse({ text: "example", behavior: { privileged: true } }).success, false);
assert.equal(ProtectTextBody.safeParse({ text: 42 }).success, false);

const approval = {
  approvalPhrase: "APPROVE_CHIEF_BRAIN_SAFE_ACTION",
  approvalVersion: "tancmark-controlled-apply-v1",
  proposalId: "proposal", proposalVersion: "1", proposalDigest: "a".repeat(64), operationDigest: "b".repeat(64),
  tenantScope: "tenant", approvedOperationTypes: ["record_advisory"],
  approvedAt: "2026-11-09T12:00:00+01:00", expiresAt: "2026-11-09T13:00:00+01:00",
  nonce: "n".repeat(16), approvedByRole: "OWNER_ADEM_KURSAT_TANC",
};
assert.deepEqual(canonicalDnaOwnerApprovalTokenSchema.parse(approval), approval);
for (const invalid of [
  { ...approval, approvedByRole: "admin" },
  { ...approval, proposalDigest: "not-a-digest" },
  { ...approval, nonce: "short" },
  { ...approval, approvedAt: "2026-11-09" },
  { ...approval, approvedOperationTypes: ["delete_all"] },
  { ...approval, bypass: true },
]) assert.equal(canonicalDnaOwnerApprovalTokenSchema.safeParse(invalid).success, false);
const dryRun = { tenantScope: "tenant", operations: [], approval: null, dryRun: true };
assert.deepEqual(canonicalDnaApplyRequestSchema.parse(dryRun), dryRun);
assert.equal(canonicalDnaApplyRequestSchema.safeParse({ ...dryRun, dryRun: "true" }).success, false);
assert.equal(canonicalDnaApplyRequestSchema.safeParse({ ...dryRun, bypass: true }).success, false);
// Drizzle generates schemas with the same Zod4 instance without connecting to a database.
import { insertForensicNoteSchema } from "../../lib/db/src/schema/forensicNotes.ts";
import { insertClientSchema } from "../../lib/db/src/schema/clients.ts";
assert.deepEqual(insertForensicNoteSchema.parse({ content: "reviewed", author: "reviewer", suspectedClientId: "client-A" }), {
  content: "reviewed", author: "reviewer", suspectedClientId: "client-A",
});
for (const note of [{ content: "" }, { content: "x".repeat(8001) }, { content: "ok", suspectedClientId: 42 }]) {
  assert.equal(insertForensicNoteSchema.safeParse(note).success, false);
}
assert.deepEqual(insertClientSchema.parse({ slug: "client-a", name: "Client A", id: 999 }), { slug: "client-a", name: "Client A" });
assert.equal(insertClientSchema.safeParse({ name: "missing slug" }).success, false);
// GHSA-mrhx-c7xc-m3w5: reject an oversized collection before parsing its
// children or running collection refinements. Bound fixtures to 10,000 entries;
// invocation counts are deterministic evidence, not a timing/memory benchmark.
const apiRequire = createRequire(path.resolve("lib/api-zod/package.json"));
const { z } = apiRequire("zod") as typeof import("../../lib/api-zod/node_modules/zod");
let elementTransforms = 0;
let collectionRefinements = 0;
const element = z.number().transform((value) => { elementTransforms++; return value + 1; });
const boundedArray = z.array(element).max(8).refine(() => { collectionRefinements++; return true; });
const boundedSet = z.set(element).max(8).refine(() => { collectionRefinements++; return true; });
const oversized = Array.from({ length: 10_000 }, (_, index) => index);
for (const result of [boundedArray.safeParse(oversized), boundedSet.safeParse(new Set(oversized))]) {
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues.length, 1);
    assert.equal(result.error.issues[0].code, "too_big");
  }
}
assert.equal(elementTransforms, 0, "oversized collections must not transform any element");
assert.equal(collectionRefinements, 0, "oversized collections must not reach refinements");
assert.deepEqual(boundedArray.parse([0, 1]), [1, 2]);
assert.deepEqual([...boundedSet.parse(new Set([2, 3]))], [3, 4]);
assert.equal(elementTransforms, 4, "in-bound collections still transform every element");
assert.equal(collectionRefinements, 2, "in-bound collections still run refinements");
console.log("PASS GHSA-mrhx-c7xc-m3w5: 10,000-entry array/set rejected with zero child transforms/refinements; valid inputs preserved");
console.log("PASS Zod API validation compatibility contract");
