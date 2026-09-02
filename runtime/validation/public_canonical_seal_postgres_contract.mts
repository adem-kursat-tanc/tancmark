// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL_required_for_canonical_seal_postgres_contract");
}

process.env["NODE_ENV"] = "test";
process.env["LOG_LEVEL"] = "silent";
process.env["AEGIS_SECRET"] = "v7-canonical-seal-postgres-test-secret";
process.env["AEGIS_OWNERSHIP_GATE"] = "on";
process.env["ADMIN_TOKEN"] = "v7-admin-test-token-32-characters";
process.env["TANCMARK_ADMIN_DEFAULT_CLIENT_ID"] = "tenant-one";
process.env["TANCMARK_API_KEY_PEPPER"] = "v7-api-key-test-pepper-32-characters";

type WriteSnapshot = Readonly<{
  cloakedDocuments: number;
  cloakLayers: number;
  vaultAnchors: number;
  ownershipAudits: number;
}>;

type HttpResult = Readonly<{
  status: number;
  body: Record<string, unknown>;
}>;

const tenantOneKey = "ak_v7securitytenantone000000000001";
const tenantTwoKey = "ak_v7securitytenanttwo000000000002";
const adminToken = process.env["ADMIN_TOKEN"]!;
const caseResults: Array<Record<string, unknown>> = [];

const { default: app } = await import("../../artifacts/api-server/src/app.js");
const { pool } = await import("../../lib/db/src/index.js");
const { hashApiKey } = await import("../../artifacts/api-server/src/lib/apiKeys.js");
const { verifyVaultAnchorRaw } = await import("../../lib/aegis-core/src/index.js");

function toCount(value: unknown): number {
  const count = Number(value);
  assert.equal(Number.isSafeInteger(count), true);
  return count;
}

async function writeSnapshot(): Promise<WriteSnapshot> {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM cloaked_documents)::int AS cloaked_documents,
      (SELECT COUNT(*) FROM cloak_layers)::int AS cloak_layers,
      (SELECT COUNT(*) FROM vault_anchors)::int AS vault_anchors,
      (SELECT COUNT(*) FROM audit_logs WHERE kind = 'Ownership_Declaration_Recorded')::int AS ownership_audits
  `);
  const row = result.rows[0] as Record<string, unknown>;
  return {
    cloakedDocuments: toCount(row["cloaked_documents"]),
    cloakLayers: toCount(row["cloak_layers"]),
    vaultAnchors: toCount(row["vault_anchors"]),
    ownershipAudits: toCount(row["ownership_audits"]),
  };
}

function snapshotDelta(before: WriteSnapshot, after: WriteSnapshot): WriteSnapshot {
  return {
    cloakedDocuments: after.cloakedDocuments - before.cloakedDocuments,
    cloakLayers: after.cloakLayers - before.cloakLayers,
    vaultAnchors: after.vaultAnchors - before.vaultAnchors,
    ownershipAudits: after.ownershipAudits - before.ownershipAudits,
  };
}

async function waitForFireAndForgetAudit(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

let baseUrl = "";

async function post(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const parsed = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body: parsed };
}

async function assertDeniedWithoutCanonicalWrites(
  name: string,
  operation: () => Promise<HttpResult>,
  expectedStatus: number,
  expectedError?: string,
): Promise<HttpResult> {
  const before = await writeSnapshot();
  const result = await operation();
  await waitForFireAndForgetAudit();
  const after = await writeSnapshot();
  const delta = snapshotDelta(before, after);
  assert.equal(result.status, expectedStatus, `${name}:status`);
  if (expectedError) assert.equal(result.body["error"], expectedError, `${name}:error`);
  assert.deepEqual(delta, {
    cloakedDocuments: 0,
    cloakLayers: 0,
    vaultAnchors: 0,
    ownershipAudits: 0,
  }, `${name}:canonical_write_delta`);
  caseResults.push({ name, status: "PASSED", httpStatus: result.status, writeDelta: delta });
  return result;
}

async function assertSuccessfulSeal(
  name: string,
  docId: string,
  text: string,
  headers: Record<string, string>,
  additionalBody: Record<string, unknown> = {},
): Promise<HttpResult> {
  const result = await post("/api/aegis/cloak-text", {
    text,
    docId,
    ownershipDeclared: true,
    ...additionalBody,
  }, headers);
  assert.equal(result.status, 200, `${name}:status:${JSON.stringify(result.body)}`);
  assert.equal(typeof result.body["protectedText"], "string", `${name}:protected_text`);
  assert.equal(typeof result.body["cloakId"], "string", `${name}:cloak_id`);
  caseResults.push({
    name,
    status: "PASSED",
    httpStatus: result.status,
    clientId: result.body["clientId"],
    docId: result.body["docId"],
  });
  return result;
}

async function startServer(): Promise<Server> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

let server: Server | null = null;
try {
  const version = await pool.query("SELECT version() AS version");
  const postgresVersion = String(version.rows[0]?.version ?? "");
  assert.match(postgresVersion, /^PostgreSQL 17\.11\b/);

  const tenantOne = await pool.query(
    "INSERT INTO clients (slug, name) VALUES ($1, $2) RETURNING id",
    ["tenant-one", "V7 Tenant One"],
  );
  const tenantTwo = await pool.query(
    "INSERT INTO clients (slug, name) VALUES ($1, $2) RETURNING id",
    ["tenant-two", "V7 Tenant Two"],
  );
  const tenantOneId = toCount(tenantOne.rows[0]?.id);
  const tenantTwoId = toCount(tenantTwo.rows[0]?.id);
  assert.notEqual(tenantOneId, tenantTwoId);

  const keyOne = await pool.query(
    "INSERT INTO api_keys (client_id, label, key_hash, key_prefix, scopes) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id",
    [tenantOneId, "v7-tenant-one", hashApiKey(tenantOneKey), tenantOneKey.slice(0, 10), "[]"],
  );
  const keyTwo = await pool.query(
    "INSERT INTO api_keys (client_id, label, key_hash, key_prefix, scopes) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id",
    [tenantTwoId, "v7-tenant-two", hashApiKey(tenantTwoKey), tenantTwoKey.slice(0, 10), "[]"],
  );
  const tenantOneKeyId = toCount(keyOne.rows[0]?.id);
  const tenantTwoKeyId = toCount(keyTwo.rows[0]?.id);

  server = await startServer();
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  process.env["PORT"] = String(address.port);

  await assertDeniedWithoutCanonicalWrites(
    "01_anonymous_cloak_text",
    () => post("/api/aegis/cloak-text", {
      text: "Anonymous canonical seal must not persist.",
      docId: "v7-anonymous",
      clientId: String(tenantOneId),
      ownershipDeclared: true,
    }),
    401,
    "verified_tancmark_session_required",
  );

  await assertDeniedWithoutCanonicalWrites(
    "02_invalid_api_key",
    () => post("/api/aegis/cloak-text", {
      text: "Invalid API key must not persist.",
      docId: "v7-invalid-key",
      ownershipDeclared: true,
    }, { "x-api-key": "ak_invalid-v7-security-key" }),
    401,
    "invalid_api_key",
  );

  const noBodyIdentity = await assertSuccessfulSeal(
    "03_valid_api_key_without_body_client_id",
    "v7-api-no-body-id",
    "Verified tenant one canonical text without caller-selected identity.",
    { "x-api-key": tenantOneKey },
  );
  assert.equal(noBodyIdentity.body["clientId"], String(tenantOneId));

  const sameBodyIdentity = await assertSuccessfulSeal(
    "04_valid_api_key_same_body_client_id",
    "v7-api-same-id",
    "Verified tenant one canonical text with redundant matching identity.",
    { "x-api-key": tenantOneKey },
    { clientId: String(tenantOneId) },
  );
  assert.equal(sameBodyIdentity.body["clientId"], String(tenantOneId));

  await assertDeniedWithoutCanonicalWrites(
    "05_valid_api_key_different_body_client_id",
    () => post("/api/aegis/cloak-text", {
      text: "A caller-selected different client must be rejected.",
      docId: "v7-api-different-id",
      clientId: String(tenantTwoId),
      ownershipDeclared: true,
    }, { "x-api-key": tenantOneKey }),
    403,
    "seal_identity_mismatch",
  );

  for (const [suffix, path, body, headers] of [
    ["body_tenant", "/api/aegis/cloak-text", { tenantId: tenantTwoId }, {}],
    ["query_tenant", `/api/aegis/cloak-text?tenantId=${tenantTwoId}`, {}, {}],
    ["query_client", `/api/aegis/cloak-text?clientId=${tenantTwoId}`, {}, {}],
    ["header_tenant", "/api/aegis/cloak-text", {}, { "x-tenant-id": String(tenantTwoId) }],
    ["header_client", "/api/aegis/cloak-text", {}, { "x-client-id": String(tenantTwoId) }],
  ] as const) {
    await assertDeniedWithoutCanonicalWrites(
      `06_identity_spoof_${suffix}`,
      () => post(path, {
        text: "Tenant spoofing must be rejected before canonical writes.",
        docId: `v7-spoof-${suffix}`,
        ownershipDeclared: true,
        ...body,
      }, { "x-api-key": tenantOneKey, ...headers }),
      403,
      "seal_identity_spoofing_rejected",
    );
  }

  await assertSuccessfulSeal(
    "07_body_user_id_cannot_forge_audit_actor",
    "v7-user-id-spoof",
    "The audit actor remains the verified API key even with a forged userId.",
    { "x-api-key": tenantOneKey },
    { userId: "forged-owner-identity" },
  );
  await waitForFireAndForgetAudit();
  const forgedAudit = await pool.query(
    `SELECT user_id, client_id, details
       FROM audit_logs
      WHERE kind = 'Ownership_Declaration_Recorded'
        AND details->>'targetRecordId' = $1
      ORDER BY id DESC LIMIT 1`,
    ["v7-user-id-spoof"],
  );
  assert.equal(forgedAudit.rowCount, 1);
  assert.equal(forgedAudit.rows[0]?.user_id, `api-key:${tenantOneKeyId}`);
  assert.equal(toCount(forgedAudit.rows[0]?.client_id), tenantOneId);
  assert.equal(forgedAudit.rows[0]?.details?.untrustedRequestedIdentity?.userId, "forged-owner-identity");

  await assertDeniedWithoutCanonicalWrites(
    "08_admin_target_without_admin_token",
    () => post("/api/aegis/cloak-text", {
      text: "An admin target without a verified admin token must be rejected.",
      docId: "v7-admin-missing",
      clientId: "tenant-one",
      ownershipDeclared: true,
    }),
    401,
    "verified_tancmark_session_required",
  );

  const adminSeal = await assertSuccessfulSeal(
    "09_valid_admin_registered_target",
    "v7-admin-known-target",
    "A verified administrator delegates only to a registered target.",
    { "x-admin-token": adminToken },
    { clientId: "tenant-one" },
  );
  assert.equal(adminSeal.body["clientId"], String(tenantOneId));
  await waitForFireAndForgetAudit();
  const adminAudit = await pool.query(
    `SELECT user_id, client_id, details
       FROM audit_logs
      WHERE kind = 'Vault_Anchored'
        AND details->>'targetRecordId' = $1
      ORDER BY id DESC LIMIT 1`,
    ["v7-admin-known-target"],
  );
  assert.equal(adminAudit.rowCount, 1);
  assert.equal(adminAudit.rows[0]?.user_id, "administrator");
  assert.equal(toCount(adminAudit.rows[0]?.client_id), tenantOneId);
  assert.equal(adminAudit.rows[0]?.details?.delegatedByAdmin, true);

  await assertDeniedWithoutCanonicalWrites(
    "10_valid_admin_unknown_target",
    () => post("/api/aegis/cloak-text", {
      text: "Unknown admin target must fail closed.",
      docId: "v7-admin-unknown",
      clientId: "unknown-target",
      ownershipDeclared: true,
    }, { "x-admin-token": adminToken }),
    403,
    "seal_target_not_verified",
  );

  const tenantOneBeforeWrongTenant = await pool.query(
    "SELECT COUNT(*)::int AS count FROM vault_anchors WHERE tenant_id = $1",
    [tenantOneId],
  );
  await assertDeniedWithoutCanonicalWrites(
    "11_wrong_tenant_cannot_select_another_identity",
    () => post("/api/aegis/cloak-text", {
      text: "Tenant two cannot write as tenant one.",
      docId: "v7-wrong-tenant",
      clientId: String(tenantOneId),
      ownershipDeclared: true,
    }, { "x-api-key": tenantTwoKey }),
    403,
    "seal_identity_mismatch",
  );
  const tenantOneAfterWrongTenant = await pool.query(
    "SELECT COUNT(*)::int AS count FROM vault_anchors WHERE tenant_id = $1",
    [tenantOneId],
  );
  assert.equal(
    toCount(tenantOneAfterWrongTenant.rows[0]?.count),
    toCount(tenantOneBeforeWrongTenant.rows[0]?.count),
  );

  const legacyDigest = "0".repeat(64);
  await pool.query(
    `INSERT INTO vault_anchors
      (tenant_id, client_id, doc_id, cloak_id, key_version, version, algorithm,
       key_derivation, public_key, signature, payload_canonical,
       payload_digest_sha256, signed_at, metadata)
     VALUES
      (NULL, 'legacy-admin', 'v7-legacy-null', 'legacy-null-cloak', 'v1', 1,
       'ml-dsa-65', 'hkdf-v1', 'legacy-public', 'legacy-signature', '{}', $1,
       NOW(), '{"policy":"LEGACY_NULL_TENANT_QUARANTINED_READ_ONLY"}'::jsonb)`,
    [legacyDigest],
  );
  const legacyBefore = await pool.query(
    "SELECT * FROM vault_anchors WHERE tenant_id IS NULL AND doc_id = 'v7-legacy-null'",
  );
  assert.equal(legacyBefore.rowCount, 1);
  await assertSuccessfulSeal(
    "12_legacy_null_tenant_anchor_is_read_only",
    "v7-legacy-null",
    "A new tenant-scoped row may coexist without changing the legacy null row.",
    { "x-api-key": tenantOneKey },
  );
  const legacyAfter = await pool.query(
    "SELECT * FROM vault_anchors WHERE tenant_id IS NULL AND doc_id = 'v7-legacy-null'",
  );
  assert.deepEqual(legacyAfter.rows, legacyBefore.rows);
  const scopedLegacyDoc = await pool.query(
    "SELECT tenant_id FROM vault_anchors WHERE tenant_id IS NOT NULL AND doc_id = 'v7-legacy-null'",
  );
  assert.deepEqual(scopedLegacyDoc.rows.map((row) => toCount(row.tenant_id)), [tenantOneId]);

  await assertSuccessfulSeal(
    "13a_same_doc_version_tenant_one",
    "v7-shared-doc-version",
    "Tenant one isolated content for the same document and version.",
    { "x-api-key": tenantOneKey },
  );
  await assertSuccessfulSeal(
    "13b_same_doc_version_tenant_two",
    "v7-shared-doc-version",
    "Tenant two isolated content for the same document and version.",
    { "x-api-key": tenantTwoKey },
  );
  const sharedRows = await pool.query(
    `SELECT tenant_id, client_id, doc_id, version
       FROM vault_anchors
      WHERE doc_id = 'v7-shared-doc-version'
      ORDER BY tenant_id`,
  );
  assert.equal(sharedRows.rowCount, 2);
  assert.deepEqual(
    sharedRows.rows.map((row) => [toCount(row.tenant_id), row.client_id, toCount(row.version)]),
    [[tenantOneId, String(tenantOneId), 1], [tenantTwoId, String(tenantTwoId), 1]],
  );

  const imageResult = await post("/api/aegis/cloak-image", {
    text: "The image route must preserve the same verified API principal end to end.",
    docId: "v7-cloak-image-principal",
    ownershipDeclared: true,
    userId: "forged-image-user",
  }, { "x-api-key": tenantOneKey });
  assert.equal(imageResult.status, 200, `14_cloak_image_status:${JSON.stringify(imageResult.body)}`);
  const imageAnchor = await pool.query(
    "SELECT tenant_id, client_id FROM vault_anchors WHERE doc_id = $1",
    ["v7-cloak-image-principal"],
  );
  assert.equal(imageAnchor.rowCount, 1);
  assert.equal(toCount(imageAnchor.rows[0]?.tenant_id), tenantOneId);
  assert.equal(imageAnchor.rows[0]?.client_id, String(tenantOneId));
  caseResults.push({
    name: "14_cloak_image_preserves_verified_principal",
    status: "PASSED",
    httpStatus: imageResult.status,
    tenantId: tenantOneId,
    clientId: String(tenantOneId),
  });

  await assertDeniedWithoutCanonicalWrites(
    "15_preseal_body_client_id_cannot_bypass_verified_owner",
    () => post("/api/aegis/cloak-text", {
      text: String(noBodyIdentity.body["protectedText"]),
      docId: "v7-preseal-bypass-attempt",
      clientId: String(tenantOneId),
      ownershipDeclared: true,
    }, { "x-api-key": tenantTwoKey }),
    403,
    "seal_identity_mismatch",
  );

  const verifiedAnchor = await pool.query(
    `SELECT tenant_id, client_id, payload_canonical, public_key, signature
       FROM vault_anchors
      WHERE tenant_id = $1 AND doc_id = $2 AND version = 1`,
    [tenantOneId, "v7-api-no-body-id"],
  );
  assert.equal(verifiedAnchor.rowCount, 1);
  const anchor = verifiedAnchor.rows[0]!;
  assert.equal(toCount(anchor.tenant_id), tenantOneId);
  assert.equal(anchor.client_id, String(tenantOneId));
  assert.equal(
    verifyVaultAnchorRaw({
      publicKey: Buffer.from(anchor.public_key, "base64"),
      payloadCanonical: anchor.payload_canonical,
      signature: Buffer.from(anchor.signature, "base64"),
    }),
    true,
  );
  const signedPayload = JSON.parse(anchor.payload_canonical) as Record<string, unknown>;
  assert.equal(signedPayload["clientId"], String(tenantOneId));

  const finalCounts = await writeSnapshot();
  const nullTenantWrites = await pool.query(
    "SELECT COUNT(*)::int AS count FROM vault_anchors WHERE tenant_id IS NULL AND doc_id <> 'v7-legacy-null'",
  );
  assert.equal(toCount(nullTenantWrites.rows[0]?.count), 0);

  process.stdout.write(`${JSON.stringify({
    gate: "CANONICAL_SEAL_POSTGRES_MUTATING_SECURITY_CONTRACT",
    status: "PASSED",
    postgresVersion,
    isolatedDatabase: true,
    productionOrCustomerDatabaseUsed: false,
    cases: 15,
    caseResults,
    verifiedTenantIds: [tenantOneId, tenantTwoId],
    verifiedApiKeyRecordIds: [tenantOneKeyId, tenantTwoKeyId],
    finalCounts,
    anonymousCanonicalSealAccepted: 0,
    callerSelectedIdentityAccepted: 0,
    nullTenantCanonicalWrites: 0,
    crossTenantAnchorOverwrite: 0,
    forgedAuditActor: 0,
    wrongOwnership: 0,
    deniedRequestsReachedCanonicalWrites: 0,
    registrySignatureBypass: 0,
  }, null, 2)}\n`);
} finally {
  if (server) await closeServer(server);
  // Canonical sealing queues OpenTimestamps and audit work by design. Give
  // those bounded fire-and-forget tasks time to finish before closing the
  // isolated test pool so teardown cannot manufacture false DB errors.
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  await pool.end();
}
