import { randomUUID } from "node:crypto";
import type { LiveLocalSecretProvider } from "./liveLocalSecretProvider";

export const LIVE_PLAYBACK_TOKEN_ISSUER = "tancmark-live-local" as const;
export const LIVE_PLAYBACK_TOKEN_AUDIENCE = "tancmark-live-playback" as const;
export const LIVE_PLAYBACK_TOKEN_MAX_TTL_SECONDS = 300;
export type LivePlaybackResourceScope = "player" | "manifest" | "segment" | "recording" | "init" | "media-json";

export interface LivePlaybackTokenV1Claims {
  v: 1; kind: "exchange"; iss: typeof LIVE_PLAYBACK_TOKEN_ISSUER; aud: typeof LIVE_PLAYBACK_TOKEN_AUDIENCE;
  tenantId: string; sub: string; sessionId: string; resourceScopes: LivePlaybackResourceScope[];
  iat: number; nbf: number; exp: number; jti: string; nonce: string; accessRevision: number; tokenEpoch: number;
}
export interface IssueLivePlaybackTokenV1Input {
  tenantId: string; subject: string; sessionId: string; resourceScopes: readonly LivePlaybackResourceScope[];
  ttlSeconds: number; accessRevision: number; tokenEpoch: number; nowMs?: number;
}
export interface VerifyLivePlaybackTokenV1Options { tenantId?: string; sessionId?: string; requiredScope?: LivePlaybackResourceScope; nowMs?: number }

const CLAIM_KEYS = ["accessRevision", "aud", "exp", "iat", "iss", "jti", "kind", "nbf", "nonce", "resourceScopes", "sessionId", "sub", "tenantId", "tokenEpoch", "v"] as const;
const HEADER_KEYS = ["alg", "kid", "typ", "v"] as const;
const SCOPES = new Set<LivePlaybackResourceScope>(["player", "manifest", "segment", "recording", "init", "media-json"]);

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const r = value as Record<string, unknown>;
  return `{${Object.keys(r).sort().map((k) => `${JSON.stringify(k)}:${stableJson(r[k])}`).join(",")}}`;
}
function encode(value: unknown): string { return Buffer.from(stableJson(value), "utf8").toString("base64url"); }
function decode(part: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error("live_playback_token_malformed");
  const bytes = Buffer.from(part, "base64url");
  if (bytes.toString("base64url") !== part) throw new Error("live_playback_token_malformed");
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("live_playback_token_malformed"); }
  if (encode(value) !== part) throw new Error("live_playback_token_noncanonical");
  return value;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"); }
function safeString(value: unknown, max = 160): value is string { return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value); }
function counter(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
function parseScopes(value: unknown): LivePlaybackResourceScope[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > SCOPES.size) throw new Error("live_playback_token_scope_invalid");
  if (new Set(value).size !== value.length || value.some((v) => typeof v !== "string" || !SCOPES.has(v as LivePlaybackResourceScope))) throw new Error("live_playback_token_scope_invalid");
  const scopes = value as LivePlaybackResourceScope[];
  if ([...scopes].sort().join("\0") !== scopes.join("\0")) throw new Error("live_playback_token_scope_noncanonical");
  return [...scopes];
}
function parseClaims(value: unknown): LivePlaybackTokenV1Claims {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("live_playback_token_claims_invalid");
  const c = value as Record<string, unknown>;
  if (!exactKeys(c, CLAIM_KEYS) || c["v"] !== 1 || c["kind"] !== "exchange") throw new Error("live_playback_token_claims_invalid");
  if (c["iss"] !== LIVE_PLAYBACK_TOKEN_ISSUER || c["aud"] !== LIVE_PLAYBACK_TOKEN_AUDIENCE) throw new Error("live_playback_token_authority_invalid");
  for (const k of ["tenantId", "sub", "sessionId", "jti", "nonce"] as const) if (!safeString(c[k])) throw new Error("live_playback_token_claims_invalid");
  for (const k of ["iat", "nbf", "exp", "accessRevision", "tokenEpoch"] as const) if (!counter(c[k])) throw new Error("live_playback_token_claims_invalid");
  parseScopes(c["resourceScopes"]);
  return c as unknown as LivePlaybackTokenV1Claims;
}

export function issueLivePlaybackTokenV1(input: IssueLivePlaybackTokenV1Input, provider: LiveLocalSecretProvider): { token: string; claims: LivePlaybackTokenV1Claims; kid: string } {
  if (!Number.isSafeInteger(input.ttlSeconds) || input.ttlSeconds < 1 || input.ttlSeconds > LIVE_PLAYBACK_TOKEN_MAX_TTL_SECONDS) throw new Error("live_playback_token_ttl_invalid");
  if (!safeString(input.tenantId) || !safeString(input.subject) || !safeString(input.sessionId) || !counter(input.accessRevision) || !counter(input.tokenEpoch)) throw new Error("live_playback_token_input_invalid");
  const resourceScopes = parseScopes([...input.resourceScopes].sort());
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const claims: LivePlaybackTokenV1Claims = { v: 1, kind: "exchange", iss: LIVE_PLAYBACK_TOKEN_ISSUER, aud: LIVE_PLAYBACK_TOKEN_AUDIENCE, tenantId: input.tenantId, sub: input.subject, sessionId: input.sessionId, resourceScopes, iat: now, nbf: now, exp: now + input.ttlSeconds, jti: randomUUID(), nonce: randomUUID(), accessRevision: input.accessRevision, tokenEpoch: input.tokenEpoch };
  const header = { alg: "HS256", kid: provider.activeKid, typ: "TMLIVE", v: 1 } as const;
  const unsigned = `${encode(header)}.${encode(claims)}`;
  return { token: `${unsigned}.${provider.signExactKid(provider.activeKid, unsigned).toString("base64url")}`, claims, kid: provider.activeKid };
}

export function verifyLivePlaybackTokenV1(token: string, provider: LiveLocalSecretProvider, options: VerifyLivePlaybackTokenV1Options = {}): LivePlaybackTokenV1Claims {
  if (typeof token !== "string" || token.length < 32 || token.length > 8192) throw new Error("live_playback_token_malformed");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("live_playback_token_malformed");
  const [h, p, s] = parts as [string, string, string];
  const raw = decode(h);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("live_playback_token_header_invalid");
  const header = raw as Record<string, unknown>;
  if (!exactKeys(header, HEADER_KEYS) || header["alg"] !== "HS256" || header["typ"] !== "TMLIVE" || header["v"] !== 1 || typeof header["kid"] !== "string") throw new Error("live_playback_token_header_invalid");
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("live_playback_token_signature_invalid");
  const signature = Buffer.from(s, "base64url");
  if (signature.toString("base64url") !== s || !provider.verifyExactKid(header["kid"], `${h}.${p}`, signature)) throw new Error("live_playback_token_signature_invalid");
  const claims = parseClaims(decode(p));
  const now = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (claims.iat > now + 30 || claims.nbf < claims.iat || claims.nbf > now || claims.exp <= claims.nbf || claims.exp <= now || claims.exp - claims.iat > LIVE_PLAYBACK_TOKEN_MAX_TTL_SECONDS) throw new Error("live_playback_token_time_invalid");
  if (options.tenantId !== undefined && claims.tenantId !== options.tenantId) throw new Error("live_playback_token_tenant_invalid");
  if (options.sessionId !== undefined && claims.sessionId !== options.sessionId) throw new Error("live_playback_token_session_invalid");
  if (options.requiredScope !== undefined && !claims.resourceScopes.includes(options.requiredScope)) throw new Error("live_playback_token_scope_invalid");
  return claims;
}
