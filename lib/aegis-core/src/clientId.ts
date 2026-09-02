/**
 * clientId normalization & validation.
 *
 * clientId is a CUSTOMER IDENTIFIER, never a mathematical number. It
 * must round-trip as a string everywhere (DB, audit logs, honeytoken
 * rows, analyze-text response, PDF). Number coercion is FORBIDDEN
 * because:
 *
 *   - "0042" and 42 are different identifiers.
 *   - "cust-1000" silently became NaN under integer coercion before the
 *     v3.2 hardening pass, crashing honeytoken inserts with a 500.
 *
 * Accept policy:
 *   - string or finite integer
 *   - trim whitespace
 *   - length 1..64
 *   - charset: a-z, A-Z, 0-9, dot, dash, underscore
 *
 * Reject (throws `InvalidClientIdError`, callers map to HTTP 400):
 *   - null / undefined / empty / whitespace-only
 *   - NaN / Infinity / non-integer numbers
 *   - object / array / boolean
 *   - >64 chars
 *   - any character outside the regex
 */

const CLIENT_ID_RE = /^[a-zA-Z0-9._-]{1,64}$/;

export class InvalidClientIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidClientIdError";
  }
}

export function normalizeClientId(input: unknown): string {
  if (input === null || input === undefined) {
    throw new InvalidClientIdError("clientId is required");
  }
  // Reject booleans, objects, arrays explicitly. (typeof null === "object"
  // is already handled above.)
  if (typeof input === "boolean") {
    throw new InvalidClientIdError("clientId must not be a boolean");
  }
  if (typeof input === "object") {
    throw new InvalidClientIdError("clientId must be a string or integer, not an object/array");
  }
  let s: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new InvalidClientIdError("clientId must be a finite number");
    }
    if (!Number.isInteger(input)) {
      throw new InvalidClientIdError("clientId must be an integer when given as number");
    }
    s = String(input);
  } else if (typeof input === "string") {
    s = input.trim();
  } else {
    throw new InvalidClientIdError(`clientId has unsupported type: ${typeof input}`);
  }
  if (s.length === 0) {
    throw new InvalidClientIdError("clientId must not be empty");
  }
  if (s.length > 64) {
    throw new InvalidClientIdError("clientId exceeds 64 characters");
  }
  if (!CLIENT_ID_RE.test(s)) {
    throw new InvalidClientIdError(
      "clientId contains invalid characters (allowed: a-z, A-Z, 0-9, '.', '-', '_'; max 64)",
    );
  }
  return s;
}

export function isValidClientId(input: unknown): input is string {
  try {
    normalizeClientId(input);
    return true;
  } catch {
    return false;
  }
}

export const CLIENT_ID_PATTERN: string = CLIENT_ID_RE.source;
