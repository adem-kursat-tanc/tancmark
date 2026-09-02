import type { Request, Response, NextFunction } from "express";
import { recordEventFireAndForget } from "../lib/auditStore";

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export function auditLogger(req: Request, _res: Response, next: NextFunction): void {
  const untrustedUserIdHeaderPresent = typeof req.headers["x-user-id"] === "string";
  recordEventFireAndForget({
    ip: clientIp(req),
    route: req.originalUrl.split("?")[0] ?? req.originalUrl,
    kind: "request",
    ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
    ...(req.apiClient ? { userId: `api-client:${req.apiClient.id}` } : {}),
    details: {
      method: req.method,
      attributionSource: req.apiClient ? "verified_api_key" : "anonymous",
      untrustedUserIdHeaderIgnored: untrustedUserIdHeaderPresent,
    },
  });
  next();
}
