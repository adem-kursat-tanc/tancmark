import { createHmac, timingSafeEqual } from "node:crypto";

export const LIVE_PLAYBACK_KEYRING_ENV = "TANCMARK_LIVE_PLAYBACK_KEYRING" as const;
export const LIVE_PLAYBACK_MIN_KEY_BYTES = 32;

export interface LiveLocalSecretProvider {
  readonly activeKid: string;
  readonly kids: readonly string[];
  signExactKid(kid: string, data: string | Buffer): Buffer;
  verifyExactKid(kid: string, data: string | Buffer, signature: Buffer): boolean;
}

function validKid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function decodeCanonicalKey(value: unknown): Buffer {
  if (typeof value !== "string") throw new Error("live_playback_key_invalid");
  const isUrl = value.startsWith("base64url:");
  const isBase64 = value.startsWith("base64:");
  if (!isUrl && !isBase64) throw new Error("live_playback_key_encoding_required");
  const encoded = value.slice(isUrl ? 10 : 7);
  if (!encoded || (isUrl ? !/^[A-Za-z0-9_-]+$/.test(encoded) : !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))) throw new Error("live_playback_key_invalid");
  const bytes = Buffer.from(encoded, isUrl ? "base64url" : "base64");
  if ((isUrl ? bytes.toString("base64url") : bytes.toString("base64")) !== encoded) {
    bytes.fill(0);
    throw new Error("live_playback_key_noncanonical");
  }
  if (bytes.length < LIVE_PLAYBACK_MIN_KEY_BYTES) {
    bytes.fill(0);
    throw new Error("live_playback_key_too_short");
  }
  return bytes;
}

/** Secret bytes remain closed over and can only perform HMAC operations. */
export function loadLiveLocalSecretProvider(env: NodeJS.ProcessEnv = process.env): LiveLocalSecretProvider {
  const raw = env[LIVE_PLAYBACK_KEYRING_ENV];
  if (!raw) throw new Error("live_playback_keyring_not_configured");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("live_playback_keyring_invalid"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("live_playback_keyring_invalid");
  const record = parsed as Record<string, unknown>;
  if (!exactKeys(record, ["activeKid", "keys"]) || !validKid(record["activeKid"]) || !record["keys"] || typeof record["keys"] !== "object" || Array.isArray(record["keys"])) throw new Error("live_playback_keyring_invalid");
  const keys = new Map<string, Buffer>();
  for (const [kid, serialized] of Object.entries(record["keys"] as Record<string, unknown>)) {
    if (!validKid(kid)) throw new Error("live_playback_kid_invalid");
    keys.set(kid, decodeCanonicalKey(serialized));
  }
  const activeKid = record["activeKid"];
  if (!keys.has(activeKid)) throw new Error("live_playback_active_kid_missing");
  const signExactKid = (kid: string, data: string | Buffer): Buffer => {
    if (!validKid(kid) || !keys.has(kid)) throw new Error("live_playback_unknown_kid");
    return createHmac("sha256", keys.get(kid) as Buffer).update(data).digest();
  };
  return Object.freeze({
    activeKid,
    kids: Object.freeze([...keys.keys()].sort()),
    signExactKid,
    verifyExactKid(kid: string, data: string | Buffer, signature: Buffer): boolean {
      const expected = signExactKid(kid, data);
      return signature.length === expected.length && timingSafeEqual(signature, expected);
    },
  });
}

export function getLiveLocalSecretProviderStatus(env: NodeJS.ProcessEnv = process.env): { configured: boolean; activeKid: string | null; keyCount: number; secretValuesExposed: false } {
  try {
    const provider = loadLiveLocalSecretProvider(env);
    return { configured: true, activeKid: provider.activeKid, keyCount: provider.kids.length, secretValuesExposed: false };
  } catch {
    return { configured: false, activeKid: null, keyCount: 0, secretValuesExposed: false };
  }
}
