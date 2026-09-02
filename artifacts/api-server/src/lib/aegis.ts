import { Aegis } from "@workspace/aegis-core";
import { logger } from "./logger";

/**
 * Build the Aegis singleton.
 *
 * Secret resolution order (first wins):
 *
 *   1. Versioned secrets via `AEGIS_SECRET_V1`, `AEGIS_SECRET_V2`, …
 *      (any positive integer suffix). The active version is taken from
 *      `ACTIVE_AEGIS_SECRET_VERSION` or, if unset, the highest-numbered
 *      version present.
 *   2. Single legacy `AEGIS_SECRET` env var (registered as `v1`).
 *   3. Demo fallback `"demo-secret-please-change-me"` — only allowed
 *      when `NODE_ENV !== "production"`. In production this is a fatal
 *      misconfiguration and we throw at module load so the process
 *      never accepts traffic with a public secret.
 */

const DEMO_SECRET = "demo-secret-please-change-me";

interface ResolvedSecrets {
  secrets: Record<string, string>;
  activeVersion: string;
  source: string;
}

function resolveSecrets(): ResolvedSecrets {
  const versioned: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^AEGIS_SECRET_V(\d+)$/);
    if (!m) continue;
    const val = process.env[key];
    if (typeof val !== "string" || val.length === 0) continue;
    versioned[`v${m[1]}`] = val;
  }
  const legacy = process.env["AEGIS_SECRET"];
  const hasLegacy = typeof legacy === "string" && legacy.length > 0;

  if (Object.keys(versioned).length > 0) {
    // If both AEGIS_SECRET and AEGIS_SECRET_V1 are set with conflicting
    // values, refuse to boot — operator must pick one source of truth.
    if (hasLegacy) {
      if (versioned["v1"] && versioned["v1"] !== legacy) {
        throw new Error(
          "[aegis] Conflicting config: AEGIS_SECRET and AEGIS_SECRET_V1 are both set with different values. Pick one.",
        );
      }
      if (!versioned["v1"]) {
        // Fold legacy in as v1 so single → versioned migration is non-breaking.
        versioned["v1"] = legacy;
      }
    }

    const requested = process.env["ACTIVE_AEGIS_SECRET_VERSION"];
    let active: string;
    if (typeof requested === "string" && requested.length > 0) {
      // Hard-fail on a typo / missing key: silent fallback would let the
      // server activate the wrong key lineage and silently produce
      // mis-attributed honeytoken rows.
      if (!versioned[requested]) {
        throw new Error(
          `[aegis] ACTIVE_AEGIS_SECRET_VERSION="${requested}" is not declared. Available: ${Object.keys(versioned).sort().join(", ")}`,
        );
      }
      active = requested;
    } else {
      // No explicit pin → pick highest numeric suffix (v2 > v1).
      const sorted = Object.keys(versioned).sort((a, b) => {
        const na = Number(a.replace(/^v/, ""));
        const nb = Number(b.replace(/^v/, ""));
        return nb - na;
      });
      active = sorted[0]!;
    }
    return { secrets: versioned, activeVersion: active, source: "versioned-env" };
  }
  if (hasLegacy) {
    return { secrets: { v1: legacy }, activeVersion: "v1", source: "AEGIS_SECRET" };
  }
  return { secrets: { v1: DEMO_SECRET }, activeVersion: "v1", source: "demo-default" };
}

const resolved = resolveSecrets();

if (resolved.source === "demo-default") {
  if (process.env["NODE_ENV"] === "production") {
    // Hard-fail in production — refuse to boot with the public demo secret.
    throw new Error(
      "[aegis] No AEGIS_SECRET / AEGIS_SECRET_V* env var set; refusing to start in production with the demo secret.",
    );
  }
  logger.warn(
    "[aegis] No AEGIS_SECRET set — using INSECURE dev default. Do NOT use in production.",
  );
} else {
  logger.info(
    `[aegis] Loaded ${Object.keys(resolved.secrets).length} secret version(s) from ${resolved.source}; active=${resolved.activeVersion}`,
  );
}

export const aegis: Aegis = new Aegis({
  secrets: resolved.secrets,
  activeVersion: resolved.activeVersion,
});

/**
 * Non-secret version label for the active physical AEGIS watermark key.
 * Live bindings persist this label so stamping and exact decoding stay on the
 * same key lineage without ever persisting or disclosing the secret itself.
 */
export const activeAegisSecretVersion = resolved.activeVersion;
