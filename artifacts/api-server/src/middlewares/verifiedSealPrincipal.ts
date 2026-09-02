// SPDX-License-Identifier: AGPL-3.0-only

import type { NextFunction, Request, Response } from "express";
import { db, clientsTable, type Client } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { InvalidClientIdError, normalizeClientId } from "@workspace/aegis-core";
import { verifyAdminTokenRequest } from "./adminAuth";

export type VerifiedSealPrincipal = Readonly<{
  actorType: "api_client" | "administrator";
  actorId: string;
  tenantId: number;
  clientId: string;
  accountId: string | null;
  authenticationSource: "verified_api_key" | "verified_admin_token";
  delegatedByAdmin: boolean;
  registryClientVerified: true;
}>;

export type SealRegistryLookup = (reference: string) => Promise<Client | null>;

type PrincipalMiddlewareDependencies = Readonly<{
  findRegistryClient?: SealRegistryLookup;
  environment?: NodeJS.ProcessEnv;
}>;

function bodyRecord(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};
}

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function identitySpoofingRequested(req: Request): boolean {
  const body = bodyRecord(req);
  return body["tenantId"] !== undefined
    || firstQueryValue(req.query?.["tenantId"]) !== undefined
    || firstQueryValue(req.query?.["clientId"]) !== undefined
    || req.header("x-tenant-id") !== undefined
    || req.header("x-client-id") !== undefined;
}

function canonicalRegistryReference(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    return normalizeClientId(value);
  } catch (error) {
    if (error instanceof InvalidClientIdError) return null;
    throw error;
  }
}

async function findRegistryClient(reference: string): Promise<Client | null> {
  const numericId = /^[1-9][0-9]*$/.test(reference) ? Number(reference) : null;
  const condition = numericId !== null && Number.isSafeInteger(numericId)
    ? or(eq(clientsTable.id, numericId), eq(clientsTable.slug, reference))
    : eq(clientsTable.slug, reference);
  const rows = await db.select().from(clientsTable).where(condition).limit(1);
  return rows[0] ?? null;
}

function apiPrincipal(req: Request): VerifiedSealPrincipal {
  const client = req.apiClient!;
  return Object.freeze({
    actorType: "api_client",
    actorId: req.apiKey ? `api-key:${req.apiKey.id}` : `api-client:${client.id}`,
    tenantId: client.id,
    clientId: normalizeClientId(client.id),
    accountId: null,
    authenticationSource: "verified_api_key",
    delegatedByAdmin: false,
    registryClientVerified: true,
  });
}

function adminPrincipal(client: Client): VerifiedSealPrincipal {
  return Object.freeze({
    actorType: "administrator",
    actorId: "administrator",
    tenantId: client.id,
    clientId: normalizeClientId(client.id),
    accountId: null,
    authenticationSource: "verified_admin_token",
    delegatedByAdmin: true,
    registryClientVerified: true,
  });
}

function sendDenied(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

export function createRequireVerifiedSealPrincipal(
  dependencies: PrincipalMiddlewareDependencies = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const lookup = dependencies.findRegistryClient ?? findRegistryClient;
  const environment = dependencies.environment ?? process.env;
  return async (req, res, next): Promise<void> => {
    if (identitySpoofingRequested(req)) {
      sendDenied(res, 403, "seal_identity_spoofing_rejected");
      return;
    }

    const body = bodyRecord(req);
    if (req.header("x-api-key") && !req.apiClient) {
      sendDenied(res, 401, "invalid_api_key");
      return;
    }

    if (req.apiClient) {
      const principal = apiPrincipal(req);
      if (body["clientId"] !== undefined && body["clientId"] !== null) {
        const requested = canonicalRegistryReference(body["clientId"]);
        if (requested !== principal.clientId) {
          sendDenied(res, 403, "seal_identity_mismatch");
          return;
        }
      }
      req.verifiedSealPrincipal = principal;
      next();
      return;
    }

    const adminVerification = verifyAdminTokenRequest(req, environment);
    if (adminVerification === "unconfigured") {
      sendDenied(res, 503, "admin_token_unconfigured");
      return;
    }
    if (adminVerification !== "valid") {
      sendDenied(res, 401, "verified_tancmark_session_required");
      return;
    }

    const targetReference = canonicalRegistryReference(
      body["clientId"] ?? environment["TANCMARK_ADMIN_DEFAULT_CLIENT_ID"],
    );
    if (!targetReference) {
      sendDenied(res, 403, "seal_target_not_verified");
      return;
    }
    const target = await lookup(targetReference);
    if (!target) {
      sendDenied(res, 403, "seal_target_not_verified");
      return;
    }
    req.verifiedSealPrincipal = adminPrincipal(target);
    next();
  };
}

export const requireVerifiedSealPrincipal = createRequireVerifiedSealPrincipal();

export function verifiedSealAuditDetails(
  principal: VerifiedSealPrincipal,
  input: {
    targetRecordId?: string | null;
    ownershipDeclarationRecorded?: boolean;
    untrustedRequestedClientId?: unknown;
    untrustedRequestedUserId?: unknown;
  } = {},
): Record<string, unknown> {
  const untrustedRequestedIdentity: Record<string, string> = {};
  if (typeof input.untrustedRequestedClientId === "string") {
    untrustedRequestedIdentity.clientId = input.untrustedRequestedClientId.slice(0, 64);
  }
  if (typeof input.untrustedRequestedUserId === "string") {
    untrustedRequestedIdentity.userId = input.untrustedRequestedUserId.slice(0, 64);
  }
  return {
    verifiedActorType: principal.actorType,
    verifiedActorId: principal.actorId,
    verifiedTenantId: principal.tenantId,
    verifiedClientId: principal.clientId,
    authenticationSource: principal.authenticationSource,
    delegatedByAdmin: principal.delegatedByAdmin,
    registryClientVerified: principal.registryClientVerified,
    targetRecordId: input.targetRecordId ?? null,
    ownershipDeclarationRecorded: input.ownershipDeclarationRecorded === true,
    ...(Object.keys(untrustedRequestedIdentity).length > 0
      ? { untrustedRequestedIdentity }
      : {}),
  };
}

export const LEGACY_NULL_TENANT_POLICY = "LEGACY_NULL_TENANT_QUARANTINED_READ_ONLY" as const;
