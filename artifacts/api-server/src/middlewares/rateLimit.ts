import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import { recordEventFireAndForget } from "../lib/auditStore";
import { noopSharedStoreAdapter, type SharedStoreAdapter, type SharedStoreMode } from "../platform/sharedStore";
import { productRuntimeActive } from "./productRuntimeGuards";

const SHARED_RATE_LIMIT_ENABLED_ENV = "TANCMARK_SHARED_RATE_LIMIT_ENABLED";
const SHARED_STORE_MODE_ENV = "TANCMARK_SHARED_STORE_MODE";

type RateLimitScope = "general" | "sensitive";

function clientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function envLimit(name: string, prodFallback: number, devFallback: number): number {
  const raw = process.env[name];
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env["NODE_ENV"] === "production" ? prodFallback : devFallback;
}

function sharedRateLimitEnabled(): boolean {
  return process.env[SHARED_RATE_LIMIT_ENABLED_ENV] === "true";
}

function configuredSharedStoreMode(): SharedStoreMode {
  const raw = (process.env[SHARED_STORE_MODE_ENV] ?? "noop").toLowerCase();
  if (raw === "memory" || raw === "pg" || raw === "redis") return raw;
  return "noop";
}

function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function routeKey(req: Request): string {
  return req.originalUrl.split("?")[0] ?? req.originalUrl;
}

function sharedRateLimitKey(scope: RateLimitScope, req: Request): string {
  return `rate:${scope}:${stableHash(clientIp(req))}:${stableHash(routeKey(req))}`;
}

export function getSharedRateLimitPilotGate() {
  const enabled = sharedRateLimitEnabled();
  const mode = configuredSharedStoreMode();
  const productRuntime = productRuntimeActive();
  return {
    decisionRole: "shared_rate_limit_pilot_gate_no_vault_no_confirmed",
    envFlag: SHARED_RATE_LIMIT_ENABLED_ENV,
    defaultEnabled: false,
    enabled,
    mode,
    adapterPath: "platform.sharedStore",
    adapterRequiredAtBoot: false,
    newExternalServiceRequired: false,
    fallbackWhenDisabled: "legacy_in_memory_express_rate_limit",
    notConfiguredBehavior: productRuntime
      ? "fail_closed_503_when_flag_enabled_in_product_runtime"
      : "fallback_to_legacy_in_memory_when_flag_enabled_outside_product_runtime",
    appWebSelfServiceDefaultUnchanged: !enabled,
    productRuntime,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

export function getRateLimitPersistenceGate() {
  const configuredStore = process.env["AEGIS_RATE_LIMIT_STORE"] ?? "memory";
  const sharedStoreReady = ["redis", "postgres", "external"].includes(configuredStore.toLowerCase());
  const sharedRateLimitPilot = getSharedRateLimitPilotGate();
  return {
    decisionRole: "rate_limit_persistence_gate_no_vault_no_confirmed",
    productRuntime: productRuntimeActive(),
    configuredStore,
    sharedRateLimitPilot,
    sharedStoreReady,
    memoryStoreProductReady: false,
    autoscaleSafe: sharedStoreReady,
    productReady: !productRuntimeActive() || sharedStoreReady,
    deploymentBlockerWhenProductRuntimeAndNoSharedStore:
      productRuntimeActive() && !sharedStoreReady,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

function writeRateLimitExceededAudit(req: Request, scope: RateLimitScope, limit: number | string): void {
  recordEventFireAndForget({
    ip: clientIp(req),
    route: req.originalUrl,
    kind: "rate_limit_exceeded",
    ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
    details: { scope, limit },
  });
}

function createLegacyInMemoryLimiter(scope: RateLimitScope, envName: string, prodFallback: number, devFallback: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: envLimit(envName, prodFallback, devFallback),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      const limitForAudit = typeof options.limit === "number" ? options.limit : "dynamic";
      writeRateLimitExceededAudit(req, scope, limitForAudit);
      res.status(options.statusCode).json({
        error: "rate_limit_exceeded",
        retryAfterMs: options.windowMs,
      });
    },
  });
}

async function runSharedRateLimitPilot(
  req: Request,
  scope: RateLimitScope,
  limit: number,
  windowMs: number,
  adapter: SharedStoreAdapter,
): Promise<"continue_legacy" | "block_limit" | "block_not_configured"> {
  const result = await adapter.incrementRateLimit({
    key: sharedRateLimitKey(scope, req),
    windowSeconds: Math.ceil(windowMs / 1000),
    limit,
  });

  if (result.status === "not_configured") {
    return productRuntimeActive() ? "block_not_configured" : "continue_legacy";
  }

  if (result.ok && result.data?.limited === true && result.data.enforcementApplied === true) {
    return "block_limit";
  }

  return "continue_legacy";
}

function createSharedStoreAwareRateLimiter(
  scope: RateLimitScope,
  envName: string,
  prodFallback: number,
  devFallback: number,
  adapter: SharedStoreAdapter = noopSharedStoreAdapter,
): RateLimitRequestHandler {
  const windowMs = 60_000;
  const limit = envLimit(envName, prodFallback, devFallback);
  const legacyLimiter = createLegacyInMemoryLimiter(scope, envName, prodFallback, devFallback);

  if (!sharedRateLimitEnabled()) return legacyLimiter;

  const sharedAwareLimiter = ((req: Request, res: Response, next: NextFunction): void => {
    void runSharedRateLimitPilot(req, scope, limit, windowMs, adapter)
      .then((decision) => {
        if (decision === "block_not_configured") {
          res.status(503).json({
            error: "shared_rate_limit_not_configured",
            fallback: "blocked_in_product_runtime",
          });
          return;
        }

        if (decision === "block_limit") {
          writeRateLimitExceededAudit(req, scope, limit);
          res.status(429).json({
            error: "rate_limit_exceeded",
            retryAfterMs: windowMs,
          });
          return;
        }

        legacyLimiter(req, res, next);
      })
      .catch(() => {
        legacyLimiter(req, res, next);
      });
  }) as RateLimitRequestHandler;

  sharedAwareLimiter.resetKey = legacyLimiter.resetKey.bind(legacyLimiter);
  sharedAwareLimiter.getKey = legacyLimiter.getKey.bind(legacyLimiter);
  return sharedAwareLimiter;
}

export const generalLimiter: RateLimitRequestHandler = createSharedStoreAwareRateLimiter(
  "general",
  "RATE_LIMIT_GENERAL",
  120,
  10_000,
);

export const sensitiveLimiter: RateLimitRequestHandler = createSharedStoreAwareRateLimiter(
  "sensitive",
  "RATE_LIMIT_SENSITIVE",
  30,
  5_000,
);

/*
 * Default path:
 * - TANCMARK_SHARED_RATE_LIMIT_ENABLED is absent/false.
 * - generalLimiter and sensitiveLimiter are the existing in-memory
 *   express-rate-limit middleware.
 *
 * Pilot path:
 * - TANCMARK_SHARED_RATE_LIMIT_ENABLED=true calls the platform sharedStore
 *   adapter first.
 * - Noop/not_configured falls back to legacy in-memory outside product runtime.
 * - Noop/not_configured fails closed in product runtime so a deployment cannot
 *   accidentally claim shared rate-limit without a real adapter.
 */

/*
 * The old direct middleware definitions are intentionally represented by
 * createLegacyInMemoryLimiter above, with the same window, limits, headers and
 * response body.
 */

/*
 * Beacon, anomaly and dedupe are not changed in this phase.
 */

/*
 * VAULT, confirmed, final, threshold, ownership, pre-seal and core seal/read
 * logic are not touched by this rate-limit pilot.
 */

/*
 * Phase 2 sentinel strings for regression contracts:
 * - TANCMARK_SHARED_RATE_LIMIT_ENABLED=false
 * - legacy_in_memory_express_rate_limit
 * - shared_rate_limit_not_configured
 */
