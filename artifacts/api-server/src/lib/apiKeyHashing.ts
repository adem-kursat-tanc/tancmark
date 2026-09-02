import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const API_KEY_HMAC_HASH_VERSION = "hmac-sha256-pepper-v1";
export const API_KEY_LEGACY_HASH_VERSION = "sha256-legacy";
export const API_KEY_HMAC_HASH_PREFIX = `${API_KEY_HMAC_HASH_VERSION}:`;
export const API_KEY_PEPPER_ENV_NAMES = ["AEGIS_API_KEY_PEPPER", "TANCMARK_API_KEY_PEPPER"] as const;
export const API_KEY_PRODUCT_PEPPER_ERROR = "api_key_pepper_required_in_product";

const MIN_PEPPER_LENGTH = 16;
const DEV_TEST_PEPPER = "tancmark-dev-test-api-key-pepper-not-for-product";

export type ApiKeyPepperState = {
  pepper: string | null;
  configured: boolean;
  productMode: boolean;
  source: "env" | "dev-test-fallback" | "missing";
  safeApiKeyHashVersion: typeof API_KEY_HMAC_HASH_VERSION | "unavailable";
};

export type ApiKeyHashVerification = {
  verified: boolean;
  safeApiKeyHashVersion: typeof API_KEY_HMAC_HASH_VERSION | typeof API_KEY_LEGACY_HASH_VERSION | "unknown";
  shouldMigrateToHmacPepper: boolean;
  migrationHash: string | null;
  legacyKeyRotationRequired: boolean;
  pepperConfigured: boolean;
};

function productRuntimeActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["NODE_ENV"] === "production" || env["AEGIS_PRODUCT_RUNTIME"] === "1";
}

function normalizePepper(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= MIN_PEPPER_LENGTH ? trimmed : null;
}

export function resolveApiKeyPepper(env: NodeJS.ProcessEnv = process.env): ApiKeyPepperState {
  for (const envName of API_KEY_PEPPER_ENV_NAMES) {
    const pepper = normalizePepper(env[envName]);
    if (pepper) {
      return {
        pepper,
        configured: true,
        productMode: productRuntimeActive(env),
        source: "env",
        safeApiKeyHashVersion: API_KEY_HMAC_HASH_VERSION,
      };
    }
  }

  const productMode = productRuntimeActive(env);
  if (productMode) {
    return {
      pepper: null,
      configured: false,
      productMode,
      source: "missing",
      safeApiKeyHashVersion: "unavailable",
    };
  }

  return {
    pepper: DEV_TEST_PEPPER,
    configured: false,
    productMode,
    source: "dev-test-fallback",
    safeApiKeyHashVersion: API_KEY_HMAC_HASH_VERSION,
  };
}

export function assertApiKeyPepperReadyForProduct(env: NodeJS.ProcessEnv = process.env): void {
  const state = resolveApiKeyPepper(env);
  if (state.productMode && !state.configured) {
    throw new Error(API_KEY_PRODUCT_PEPPER_ERROR);
  }
}

export function hashApiKeyHmacPepper(apiKey: string, pepper: string): string {
  // codeql[js/insufficient-password-hash] API keys are high-entropy tokens, not human passwords; storage uses a secret HMAC pepper.
  const digest = createHmac("sha256", pepper).update(apiKey, "utf8").digest("hex");
  return `${API_KEY_HMAC_HASH_PREFIX}${digest}`;
}

export function hashApiKeyLegacySha256(apiKey: string): string {
  // codeql[js/insufficient-password-hash] Legacy high-entropy API-token verification is read-only and immediately requests HMAC migration.
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export function hashApiKeyForStorage(apiKey: string, env: NodeJS.ProcessEnv = process.env): string {
  const state = resolveApiKeyPepper(env);
  if (!state.pepper) {
    throw new Error(API_KEY_PRODUCT_PEPPER_ERROR);
  }
  return hashApiKeyHmacPepper(apiKey, state.pepper);
}

export function isHmacPepperApiKeyHash(storedHash: string): boolean {
  return new RegExp(`^${API_KEY_HMAC_HASH_PREFIX}[a-f0-9]{64}$`).test(storedHash);
}

export function isLegacySha256ApiKeyHash(storedHash: string): boolean {
  return /^[a-f0-9]{64}$/.test(storedHash);
}

function safeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyApiKeyHash(
  apiKey: string,
  storedRecord: string | { keyHash: string },
  pepperState: ApiKeyPepperState = resolveApiKeyPepper(),
): ApiKeyHashVerification {
  const storedHash = typeof storedRecord === "string" ? storedRecord : storedRecord.keyHash;
  const base = {
    verified: false,
    shouldMigrateToHmacPepper: false,
    migrationHash: null,
    legacyKeyRotationRequired: false,
    pepperConfigured: pepperState.configured,
  };

  if (isHmacPepperApiKeyHash(storedHash)) {
    if (!pepperState.pepper) {
      return { ...base, safeApiKeyHashVersion: API_KEY_HMAC_HASH_VERSION };
    }
    const expected = hashApiKeyHmacPepper(apiKey, pepperState.pepper);
    return {
      ...base,
      verified: safeEqualString(expected, storedHash),
      safeApiKeyHashVersion: API_KEY_HMAC_HASH_VERSION,
    };
  }

  if (isLegacySha256ApiKeyHash(storedHash)) {
    const expected = hashApiKeyLegacySha256(apiKey);
    const verified = safeEqualString(expected, storedHash);
    const migrationHash = verified && pepperState.pepper ? hashApiKeyHmacPepper(apiKey, pepperState.pepper) : null;
    return {
      ...base,
      verified,
      safeApiKeyHashVersion: API_KEY_LEGACY_HASH_VERSION,
      shouldMigrateToHmacPepper: Boolean(migrationHash),
      migrationHash,
      legacyKeyRotationRequired: verified && !migrationHash,
    };
  }

  return { ...base, safeApiKeyHashVersion: "unknown" };
}
