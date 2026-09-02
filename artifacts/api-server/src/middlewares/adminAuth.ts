import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { recordEventFireAndForget, type AuditKind } from "../lib/auditStore";

const AUTH_FAILED_KIND = "auth_failed" as AuditKind;

export type AdminTokenVerification =
  | "valid"
  | "unconfigured"
  | "missing"
  | "invalid";

function secureTokenEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function verifyAdminTokenRequest(
  req: Request,
  environment: NodeJS.ProcessEnv = process.env,
): AdminTokenVerification {
  const expected = environment["ADMIN_TOKEN"];
  if (!expected || expected.length < 16) return "unconfigured";
  const provided = req.header("x-admin-token");
  if (!provided) return "missing";
  return secureTokenEquals(provided, expected) ? "valid" : "invalid";
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const verification = verifyAdminTokenRequest(req);

  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const route = req.originalUrl.split("?")[0] ?? req.originalUrl;

  if (verification === "unconfigured") {
    recordEventFireAndForget({
      ip,
      route,
      kind: AUTH_FAILED_KIND,
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: { scope: "admin", reason: "admin_token_unconfigured" },
    });
    res.status(503).json({ error: "admin_token_unconfigured" });
    return;
  }

  if (verification !== "valid") {
    recordEventFireAndForget({
      ip,
      route,
      kind: AUTH_FAILED_KIND,
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: {
        scope: "admin",
        reason: verification === "missing" ? "admin_token_missing" : "admin_token_invalid",
      },
    });
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
