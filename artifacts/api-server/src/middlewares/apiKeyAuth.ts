import type { Request, Response, NextFunction } from "express";
import { lookupApiKey, touchApiKey } from "../lib/apiKeys";
import { recordEventFireAndForget } from "../lib/auditStore";
import { logger } from "../lib/logger";

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export async function apiKeyLookup(req: Request, res: Response, next: NextFunction): Promise<void> {
  const provided = req.header("x-api-key");
  if (!provided) {
    next();
    return;
  }
  try {
    const found = await lookupApiKey(provided);
    if (found) {
      req.apiClient = found.client;
      req.apiKey = found.apiKey;
      touchApiKey(found.apiKey.id).catch((err) => {
        logger.error({ err }, "[apiKeys] touch failed");
      });
      next();
      return;
    }
  } catch (err) {
    logger.error({ err }, "[apiKeys] lookup failed");
    recordEventFireAndForget({
      ip: clientIp(req),
      route: req.originalUrl.split("?")[0] ?? req.originalUrl,
      kind: "auth_failed",
      details: { scope: "api_key", reason: "api_key_lookup_failed" },
    });
    const errorCode =
      err instanceof Error && err.message === "api_key_pepper_required_in_product"
        ? "api_key_security_not_configured"
        : "api_key_lookup_unavailable";
    res.status(503).json({ error: errorCode });
    return;
  }
  recordEventFireAndForget({
    ip: clientIp(req),
    route: req.originalUrl.split("?")[0] ?? req.originalUrl,
    kind: "auth_failed",
    details: { scope: "api_key", reason: "api_key_invalid" },
  });
  res.status(401).json({ error: "invalid_api_key" });
}
