import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const LIVE_LOCAL_TENANT_HEADER = "x-tancmark-live-tenant-id" as const;
export const LIVE_LOCAL_TENANT_ENV = "TANCMARK_LIVE_LOCAL_TENANT_ID" as const;
export const LIVE_LOCAL_ACCOUNT_ENV = "TANCMARK_LIVE_LOCAL_ACCOUNT_ID" as const;
export const LIVE_LOCAL_TENANT_LOCALS_KEY = "tancmarkLiveTenantId" as const;
export const LIVE_LOCAL_ACCOUNT_LOCALS_KEY = "tancmarkLiveAccountId" as const;

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function normalizeLiveTenantId(value: unknown): string {
  const normalized = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new Error("invalid_live_tenant_id");
  }
  return normalized;
}

export type LiveTenantResolution =
  | { ok: true; tenantId: string; accountId: string; source: "api_key" | "single_tenant_env" }
  | { ok: false; status: 401 | 404; error: "live_tenant_principal_required" | "live_tenant_not_found" };

/**
 * Resolve the Live tenant without trusting body/query values. A verified API
 * client is authoritative. The header fallback is deliberately restricted to
 * an exact match with the configured single-tenant value; the route must also
 * mount requireAdminToken before this middleware.
 */
export function resolveVerifiedLiveTenant(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): LiveTenantResolution {
  const suppliedHeader = req.header(LIVE_LOCAL_TENANT_HEADER)?.trim();
  if (req.apiClient) {
    const tenantId = normalizeLiveTenantId(req.apiClient.id);
    if (suppliedHeader) {
      let normalizedHeader: string;
      try {
        normalizedHeader = normalizeLiveTenantId(suppliedHeader);
      } catch {
        return { ok: false, status: 404, error: "live_tenant_not_found" };
      }
      if (!safeEqual(normalizedHeader, tenantId)) {
        return { ok: false, status: 404, error: "live_tenant_not_found" };
      }
    }
    return { ok: true, tenantId, accountId: tenantId, source: "api_key" };
  }

  const configured = env[LIVE_LOCAL_TENANT_ENV]?.trim();
  if (!configured || !suppliedHeader) {
    return { ok: false, status: 401, error: "live_tenant_principal_required" };
  }
  let configuredTenant: string;
  let headerTenant: string;
  try {
    configuredTenant = normalizeLiveTenantId(configured);
    headerTenant = normalizeLiveTenantId(suppliedHeader);
  } catch {
    return { ok: false, status: 404, error: "live_tenant_not_found" };
  }
  if (!safeEqual(headerTenant, configuredTenant)) {
    return { ok: false, status: 404, error: "live_tenant_not_found" };
  }
  let accountId: string;
  try { accountId = normalizeLiveTenantId(env[LIVE_LOCAL_ACCOUNT_ENV]?.trim() || configuredTenant); }
  catch { return { ok: false, status: 401, error: "live_tenant_principal_required" }; }
  return { ok: true, tenantId: configuredTenant, accountId, source: "single_tenant_env" };
}

export function requireVerifiedLiveTenant(req: Request, res: Response, next: NextFunction): void {
  const resolution = resolveVerifiedLiveTenant(req);
  if (!resolution.ok) {
    res.status(resolution.status).json({ error: resolution.error });
    return;
  }
  res.locals[LIVE_LOCAL_TENANT_LOCALS_KEY] = resolution.tenantId;
  res.locals[LIVE_LOCAL_ACCOUNT_LOCALS_KEY] = resolution.accountId;
  next();
}

export function verifiedLiveTenantFromResponse(res: Response): string {
  const value = res.locals[LIVE_LOCAL_TENANT_LOCALS_KEY];
  return normalizeLiveTenantId(value);
}

export function verifiedLiveAccountFromResponse(res: Response): string {
  const value = res.locals[LIVE_LOCAL_ACCOUNT_LOCALS_KEY];
  return normalizeLiveTenantId(value);
}
