import { createHmac, randomBytes } from "node:crypto";

/**
 * AEGIS v4.1 Step 2 — Cryptographic emission token generator.
 *
 *   token = base64(
 *     HMAC-SHA256(
 *       tenantSecret,
 *       "decoy-emission-v1" || clientId || docId || viewerId || timestamp || nonce
 *     )
 *   )
 *
 * 32-byte HMAC-SHA256 digest → 44-char base64 (one '=' pad). Each emission
 * is unique because (timestamp, nonce) varies. The token is stored in
 * `decoy_emissions.emission_token` (UNIQUE) and embedded in deliveryText
 * via the Unicode Tag codec. Analyze-text reconstructs this token from
 * suspect text and joins on the unique index — no DB row, no match.
 */
export interface EmissionTokenInput {
  tenantSecret: string;
  clientId: string;
  docId: string;
  viewerId: string;
  /** Defaults to Date.now() — pass explicitly for deterministic tests. */
  timestamp?: number;
  /** 16-byte random nonce hex; defaults to fresh randomBytes(16). */
  nonce?: string;
}

export interface EmissionTokenOutput {
  token: string;
  timestamp: number;
  nonce: string;
}

const VERSION_TAG = "decoy-emission-v1";

export function generateEmissionToken(
  input: EmissionTokenInput,
): EmissionTokenOutput {
  if (!input.tenantSecret) {
    throw new Error("decoy.emissionToken: tenantSecret required");
  }
  const timestamp = input.timestamp ?? Date.now();
  const nonce = input.nonce ?? randomBytes(16).toString("hex");
  const payload = [
    VERSION_TAG,
    input.clientId,
    input.docId,
    input.viewerId,
    String(timestamp),
    nonce,
  ].join("|");
  const digest = createHmac("sha256", input.tenantSecret)
    .update(payload)
    .digest();
  const token = digest.toString("base64");
  // Sanity — base64(32 bytes) is always 44 chars with one '=' pad.
  if (token.length !== 44) {
    throw new Error(`decoy.emissionToken: digest base64 length ${token.length}`);
  }
  return { token, timestamp, nonce };
}
