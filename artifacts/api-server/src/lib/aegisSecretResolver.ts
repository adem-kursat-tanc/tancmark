/** Shared AEGIS secret resolution for every sealing surface. */
export const AEGIS_DEMO_SECRET = "demo-secret-please-change-me";
export const MIN_AEGIS_SECRET_LENGTH = 8;
export type AegisSecretEnvironment = Record<string, string | undefined>;

export interface ResolvedAegisSecrets {
  secrets: Record<string, string>;
  activeVersion: string;
  source: "versioned-env" | "AEGIS_SECRET" | "demo-default";
}

function assertSecretLength(name: string, value: string): void {
  if (value.trim().length === 0 || value.length < MIN_AEGIS_SECRET_LENGTH) {
    throw new Error(
      `[aegis] ${name} must be at least ${MIN_AEGIS_SECRET_LENGTH} characters long.`,
    );
  }
}

/** Resolve versioned secrets without silently falling back to another lineage. */
export function resolveAegisSecrets(
  env: AegisSecretEnvironment = process.env,
): ResolvedAegisSecrets {
  const versioned: Record<string, string> = {};
  for (const key of Object.keys(env)) {
    if (!key.startsWith("AEGIS_SECRET_V")) continue;
    const value = env[key];
    // Undefined means the optional variable is absent. An empty variable is a
    // configured-but-invalid rotation input and must never be ignored.
    if (typeof value === "undefined") continue;
    const match = key.match(/^AEGIS_SECRET_V([1-9]\d*)$/);
    if (!match) {
      throw new Error(
        `[aegis] Invalid versioned secret variable ${key}. Use AEGIS_SECRET_V<positive integer>.`,
      );
    }
    assertSecretLength(key, value);
    versioned[`v${match[1]}`] = value;
  }

  const legacy = env.AEGIS_SECRET;
  const hasLegacy = typeof legacy === "string";
  if (hasLegacy) assertSecretLength("AEGIS_SECRET", legacy);

  if (Object.keys(versioned).length > 0) {
    if (hasLegacy) {
      if (versioned.v1 && versioned.v1 !== legacy) {
        throw new Error(
          "[aegis] Conflicting config: AEGIS_SECRET and AEGIS_SECRET_V1 are both set with different values. Pick one.",
        );
      }
      if (!versioned.v1) versioned.v1 = legacy;
    }

    const requested = env.ACTIVE_AEGIS_SECRET_VERSION;
    let activeVersion: string;
    if (typeof requested === "string") {
      if (requested.trim().length === 0) {
        throw new Error(
          "[aegis] ACTIVE_AEGIS_SECRET_VERSION is configured but empty.",
        );
      }
      if (!versioned[requested]) {
        throw new Error(
          `[aegis] ACTIVE_AEGIS_SECRET_VERSION="${requested}" is not declared. Available: ${Object.keys(versioned).sort().join(", ")}`,
        );
      }
      activeVersion = requested;
    } else {
      activeVersion = Object.keys(versioned)
        .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0]!;
    }
    return { secrets: versioned, activeVersion, source: "versioned-env" };
  }

  if (hasLegacy) {
    return { secrets: { v1: legacy }, activeVersion: "v1", source: "AEGIS_SECRET" };
  }
  return {
    secrets: { v1: AEGIS_DEMO_SECRET },
    activeVersion: "v1",
    source: "demo-default",
  };
}

/** Refuse a public/demo secret in production before any caller derives anchors. */
export function assertProductionAegisSecretConfig(
  resolved: ResolvedAegisSecrets,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv === "production" && resolved.source === "demo-default") {
    throw new Error(
      "[aegis] No AEGIS_SECRET / AEGIS_SECRET_V* env var set; refusing to start in production with the demo secret.",
    );
  }
}

/** Return the exact active secret as bytes for video anchor derivation. */
export function resolveActiveAegisSecretBuffer(
  env: AegisSecretEnvironment = process.env,
): Buffer {
  const resolved = resolveAegisSecrets(env);
  assertProductionAegisSecretConfig(resolved, env.NODE_ENV);
  return Buffer.from(resolved.secrets[resolved.activeVersion]!, "utf8");
}

/**
 * Resolve one exact authenticated key lineage for verification.
 * Readers must never substitute the currently active sealing key.
 */
export function resolveAegisSecretVersionBuffer(
  keyVersion: string,
  env: AegisSecretEnvironment = process.env,
): Buffer {
  const resolved = resolveAegisSecrets(env);
  assertProductionAegisSecretConfig(resolved, env.NODE_ENV);
  const secret = resolved.secrets[keyVersion];
  if (!secret) {
    throw new Error(
      `[aegis] Authenticated key version "${keyVersion}" is not configured. Refusing active-key substitution.`,
    );
  }
  return Buffer.from(secret, "utf8");
}
