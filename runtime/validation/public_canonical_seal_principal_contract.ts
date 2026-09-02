// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextFunction, Request, Response } from "express";
import type { ApiKey, Client } from "@workspace/db";

async function main(): Promise<void> {
process.env["DATABASE_URL"] ??= "postgresql://127.0.0.1:1/tancmark_seal_principal_contract";

const {
  createRequireVerifiedSealPrincipal,
  verifiedSealAuditDetails,
  LEGACY_NULL_TENANT_POLICY,
} = await import("../../artifacts/api-server/src/middlewares/verifiedSealPrincipal.ts");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const adminToken = "v7-security-admin-token-verified";
const environment = { ...process.env, ADMIN_TOKEN: adminToken };
const clients: Client[] = [
  { id: 11, slug: "tenant-a", name: "Tenant A", createdAt: new Date("2026-08-31T00:00:00.000Z") },
  { id: 22, slug: "tenant-b", name: "Tenant B", createdAt: new Date("2026-08-31T00:00:00.000Z") },
];
const findRegistryClient = async (reference: string): Promise<Client | null> =>
  clients.find((client) => String(client.id) === reference || client.slug === reference) ?? null;
const middleware = createRequireVerifiedSealPrincipal({ findRegistryClient, environment });

type RunInput = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  apiClient?: Client;
  apiKey?: ApiKey;
};

async function run(input: RunInput = {}): Promise<{
  status: number;
  json: unknown;
  nextCalls: number;
  downstreamWrites: number;
  request: Request;
}> {
  const headers = new Map(
    Object.entries(input.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const request = {
    body: input.body ?? {},
    query: input.query ?? {},
    apiClient: input.apiClient,
    apiKey: input.apiKey,
    header: (name: string) => headers.get(name.toLowerCase()),
  } as unknown as Request;
  let status = 200;
  let json: unknown = null;
  let nextCalls = 0;
  let downstreamWrites = 0;
  const response = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { json = value; return this; },
  } as unknown as Response;
  const next = (() => {
    nextCalls += 1;
    downstreamWrites += 1;
  }) as NextFunction;
  await middleware(request, response, next);
  return { status, json, nextCalls, downstreamWrites, request };
}

function errorOf(result: { json: unknown }): string | undefined {
  return result.json && typeof result.json === "object"
    ? (result.json as { error?: string }).error
    : undefined;
}

const apiKey: ApiKey = {
  id: 101,
  clientId: clients[0]!.id,
  label: "contract",
  keyHash: "redacted",
  keyPrefix: "ak_redact",
  scopes: [],
  createdAt: new Date("2026-08-31T00:00:00.000Z"),
  revokedAt: null,
  lastUsedAt: null,
};

const anonymous = await run();
assert.equal(anonymous.status, 401);
assert.equal(anonymous.nextCalls, 0);
assert.equal(anonymous.downstreamWrites, 0);

const invalidApiKey = await run({ headers: { "x-api-key": "invalid" } });
assert.equal(invalidApiKey.status, 401);
assert.equal(errorOf(invalidApiKey), "invalid_api_key");
assert.equal(invalidApiKey.downstreamWrites, 0);

const apiNoBodyId = await run({ apiClient: clients[0], apiKey });
assert.equal(apiNoBodyId.nextCalls, 1);
assert.equal(apiNoBodyId.request.verifiedSealPrincipal?.clientId, "11");
assert.equal(apiNoBodyId.request.verifiedSealPrincipal?.tenantId, 11);

const apiSameBodyId = await run({ body: { clientId: "11" }, apiClient: clients[0], apiKey });
assert.equal(apiSameBodyId.nextCalls, 1);
assert.equal(apiSameBodyId.request.verifiedSealPrincipal?.authenticationSource, "verified_api_key");

const apiDifferentBodyId = await run({ body: { clientId: "22" }, apiClient: clients[0], apiKey });
assert.equal(apiDifferentBodyId.status, 403);
assert.equal(errorOf(apiDifferentBodyId), "seal_identity_mismatch");
assert.equal(apiDifferentBodyId.downstreamWrites, 0);

for (const spoof of [
  { body: { tenantId: 22 }, apiClient: clients[0], apiKey },
  { query: { tenantId: "22" }, apiClient: clients[0], apiKey },
  { query: { clientId: "22" }, apiClient: clients[0], apiKey },
  { headers: { "x-tenant-id": "22" }, apiClient: clients[0], apiKey },
  { headers: { "x-client-id": "22" }, apiClient: clients[0], apiKey },
]) {
  const result = await run(spoof);
  assert.equal(result.status, 403);
  assert.equal(errorOf(result), "seal_identity_spoofing_rejected");
  assert.equal(result.downstreamWrites, 0);
}

const spoofedUser = await run({ body: { userId: "forged-actor" }, apiClient: clients[0], apiKey });
assert.equal(spoofedUser.nextCalls, 1);
assert.equal(spoofedUser.request.verifiedSealPrincipal?.actorId, "api-key:101");
const audit = verifiedSealAuditDetails(spoofedUser.request.verifiedSealPrincipal!, {
  untrustedRequestedUserId: "forged-actor",
});
assert.equal(audit["verifiedActorId"], "api-key:101");
assert.deepEqual(audit["untrustedRequestedIdentity"], { userId: "forged-actor" });

const adminMissingTarget = await run({ headers: { "x-admin-token": adminToken } });
assert.equal(adminMissingTarget.status, 403);
assert.equal(adminMissingTarget.downstreamWrites, 0);

const adminUnknownTarget = await run({
  body: { clientId: "unknown" },
  headers: { "x-admin-token": adminToken },
});
assert.equal(adminUnknownTarget.status, 403);
assert.equal(adminUnknownTarget.downstreamWrites, 0);

const adminKnownTarget = await run({
  body: { clientId: "tenant-b" },
  headers: { "x-admin-token": adminToken },
});
assert.equal(adminKnownTarget.nextCalls, 1);
assert.equal(adminKnownTarget.request.verifiedSealPrincipal?.tenantId, 22);
assert.equal(adminKnownTarget.request.verifiedSealPrincipal?.clientId, "22");
assert.equal(adminKnownTarget.request.verifiedSealPrincipal?.actorType, "administrator");
assert.equal(adminKnownTarget.request.verifiedSealPrincipal?.delegatedByAdmin, true);

const tenantA = await run({ apiClient: clients[0], apiKey });
const tenantB = await run({
  apiClient: clients[1],
  apiKey: { ...apiKey, id: 202, clientId: clients[1]!.id },
});
assert.notEqual(
  tenantA.request.verifiedSealPrincipal?.tenantId,
  tenantB.request.verifiedSealPrincipal?.tenantId,
);

const aegisSource = await readFile(
  path.join(root, "artifacts", "api-server", "src", "routes", "aegis.ts"),
  "utf8",
);
const uiSource = await readFile(
  path.join(root, "artifacts", "dashboard-ui", "src", "pages", "user-protect.tsx"),
  "utf8",
);
assert.match(aegisSource, /router\.post\("\/protect-text", requireVerifiedSealPrincipal/);
assert.match(aegisSource, /"\/cloak-text",\s+requireVerifiedSealPrincipal/);
assert.match(aegisSource, /"\/cloak-image",\s+requireVerifiedSealPrincipal/);
const cloakTextStart = aegisSource.indexOf('router.post(\n  "/cloak-text"');
const cloakImageStart = aegisSource.indexOf('router.post(\n  "/cloak-image"');
assert.ok(cloakTextStart >= 0 && cloakImageStart > cloakTextStart);
const cloakTextSource = aegisSource.slice(cloakTextStart, cloakImageStart);
assert.match(cloakTextSource, /const clientIdStr = principal\.clientId/);
assert.match(cloakTextSource, /currentClientId: clientIdStr/);
assert.match(cloakTextSource, /const vaultTenantId = principal\.tenantId/);
assert.match(cloakTextSource, /targetWhere: sql`\$\{vaultAnchorsTable\.tenantId\} IS NOT NULL`/);
assert.doesNotMatch(cloakTextSource, /tenantId:\s*null/);
assert.doesNotMatch(cloakTextSource, /vaultTenantId !== null/);
assert.doesNotMatch(cloakTextSource, /:\s*"admin"/);
const cloakImageSource = aegisSource.slice(cloakImageStart);
assert.match(cloakImageSource, /currentClientId: principal\.clientId/);
assert.match(cloakImageSource, /clientId: principal\.clientId/);
assert.match(cloakImageSource, /eq\(vaultAnchorsTable\.tenantId, principal\.tenantId\)/);
assert.match(cloakImageSource, /cloak_text_principal_mismatch/);
assert.doesNotMatch(uiSource, /clientId:\s*"aegis-user"/);
assert.match(uiSource, /Bu işlem için doğrulanmış TancMark oturumu gerekir\./);
assert.equal(LEGACY_NULL_TENANT_POLICY, "LEGACY_NULL_TENANT_QUARANTINED_READ_ONLY");

const result = {
  status: "PASSED",
  cases: 15,
  anonymousCanonicalSealAccepted: 0,
  callerSelectedIdentityAccepted: 0,
  nullTenantCanonicalWrites: 0,
  crossTenantAnchorOverwrite: 0,
  forgedAuditActor: 0,
  wrongOwnership: 0,
  deniedRequestsReachedDownstreamWrites: 0,
  legacyNullTenantPolicy: LEGACY_NULL_TENANT_POLICY,
};
console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
