import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalLimiter } from "./middlewares/rateLimit";
import { auditLogger } from "./middlewares/auditLogger";
import { apiKeyLookup } from "./middlewares/apiKeyAuth";
import { securityHeaders } from "./middlewares/securityHeaders";
import { requireC2paTransportBoundary } from "./middlewares/c2paTransportBoundary";
import { publicMultipartUploadError } from "./middlewares/multipartUploadSecurity";

const app: Express = express();
app.set("trust proxy", 1);

function allowedCorsOrigins(): Set<string> {
  return new Set(
    (process.env["AEGIS_ALLOWED_ORIGINS"] ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = allowedCorsOrigins();
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      if (process.env["NODE_ENV"] !== "production" && isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

// The C2PA boundary must run before any credential lookup, audit persistence,
// or rate-limit side effect. A remote plaintext request is rejected solely
// from the connected socket even if it carries spoofed forwarding headers.
app.use("/api/tancmark/c2pa/v1", requireC2paTransportBoundary);
app.use("/api", apiKeyLookup);
app.use("/api", auditLogger);
app.use("/api", generalLimiter);
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

type PublicApiError = {
  status: number;
  error: string;
};

type ExpressError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string;
};

function publicApiError(err: ExpressError): PublicApiError {
  const multipartError = publicMultipartUploadError(err);
  if (multipartError) return multipartError;
  if (err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413) {
    return { status: 413, error: "payload_too_large" };
  }
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return { status: 400, error: "invalid_json" };
  }
  if (
    err.message === "sourcePath_outside_allowed_root" ||
    err.message === "sourcePath_missing" ||
    err.message === "large_file_allowed_root_not_configured" ||
    err.code === "ENOENT"
  ) {
    return { status: 400, error: "invalid_file_path" };
  }
  const status = Number.isFinite(err.status) ? Number(err.status) : Number(err.statusCode);
  if (status >= 400 && status < 500) {
    return { status, error: "bad_request" };
  }
  return { status: 500, error: "internal_error" };
}

const apiErrorHandler: ErrorRequestHandler = (err: ExpressError, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const publicError = publicApiError(err);
  req.log?.warn(
    {
      err,
      publicError,
    },
    "api request failed",
  );
  res.status(publicError.status).json({ error: publicError.error });
};

app.use(apiErrorHandler);

export default app;
