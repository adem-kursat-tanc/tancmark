import { randomBytes, randomUUID } from "node:crypto";
import type { LivePlaybackResourceScope, LivePlaybackTokenV1Claims } from "./livePlaybackTokenV1";
import { LiveProductError, LiveProductStore } from "./liveProductStore";

interface StoredGrant {
  grantId: string;
  tokenHash: string;
  tenantId: string;
  sessionId: string;
  subjectHash: string;
  scopes: LivePlaybackResourceScope[];
  accessRevision: number;
  tokenEpoch: number;
  issuedAtMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
}

interface SessionAccessState {
  schemaVersion: "tancmark-live-access-state-v1";
  consumedJtis: Record<string, number>;
  consumedNonces: Record<string, number>;
  grants: Record<string, StoredGrant>;
}

interface GlobalAccessIndex {
  schemaVersion: "tancmark-live-global-access-index-v1";
  byTokenHash: Record<string, { tenantId: string; sessionId: string; grantId: string }>;
}

export interface LivePlaybackGrantIssueResult {
  grantId: string;
  grantToken: string;
  sessionId: string;
  scopes: LivePlaybackResourceScope[];
  expiresAt: string;
}

export interface LivePlaybackGrantAuthorization {
  grantId: string;
  tenantId: string;
  sessionId: string;
  scopes: LivePlaybackResourceScope[];
  expiresAt: string;
}

function emptySessionState(): SessionAccessState {
  return { schemaVersion: "tancmark-live-access-state-v1", consumedJtis: {}, consumedNonces: {}, grants: {} };
}

function emptyGlobalIndex(): GlobalAccessIndex {
  return { schemaVersion: "tancmark-live-global-access-index-v1", byTokenHash: {} };
}

function prune(state: SessionAccessState, nowMs: number): SessionAccessState {
  for (const [hash, expiry] of Object.entries(state.consumedJtis)) if (expiry < nowMs - 60_000) delete state.consumedJtis[hash];
  for (const [hash, expiry] of Object.entries(state.consumedNonces)) if (expiry < nowMs - 60_000) delete state.consumedNonces[hash];
  return state;
}

export class LivePlaybackGrantStore {
  constructor(private readonly store: LiveProductStore) {}

  consumeExchangeAndCreateGrant(
    claims: LivePlaybackTokenV1Claims,
    nowMs = Date.now(),
  ): LivePlaybackGrantIssueResult {
    const session = this.store.requireSession(claims.tenantId, claims.sessionId);
    if (session.status !== "RUNNING" && session.status !== "STOPPED") throw new LiveProductError("live_playback_session_closed", 409);
    if (session.accessRevision !== claims.accessRevision || session.tokenEpoch !== claims.tokenEpoch) {
      throw new LiveProductError("live_playback_token_stale", 401);
    }
    const expiresAtMs = claims.exp * 1000;
    if (expiresAtMs <= nowMs) throw new LiveProductError("live_playback_token_expired", 401);
    const jtiHash = LiveProductStore.sha256(`jti\0${claims.jti}`);
    const nonceHash = LiveProductStore.sha256(`nonce\0${claims.nonce}`);
    const grantId = randomUUID();
    const grantToken = randomBytes(48).toString("base64url");
    const tokenHash = LiveProductStore.sha256(`grant\0${grantToken}`);
    const stored: StoredGrant = {
      grantId,
      tokenHash,
      tenantId: claims.tenantId,
      sessionId: claims.sessionId,
      subjectHash: LiveProductStore.sha256(`subject\0${claims.sub}`),
      scopes: [...claims.resourceScopes],
      accessRevision: claims.accessRevision,
      tokenEpoch: claims.tokenEpoch,
      issuedAtMs: nowMs,
      expiresAtMs,
      revokedAtMs: null,
    };

    this.store.mutateAuxiliaryJson(claims.tenantId, claims.sessionId, "access.json", emptySessionState(), (current) => {
      const state = prune(current, nowMs);
      if (state.consumedJtis[jtiHash] !== undefined || state.consumedNonces[nonceHash] !== undefined) {
        throw new LiveProductError("live_playback_exchange_replayed", 409);
      }
      state.consumedJtis[jtiHash] = expiresAtMs;
      state.consumedNonces[nonceHash] = expiresAtMs;
      state.grants[grantId] = stored;
      return state;
    });
    this.store.mutateGlobalAccessIndex(emptyGlobalIndex(), (index) => {
      index.byTokenHash[tokenHash] = { tenantId: claims.tenantId, sessionId: claims.sessionId, grantId };
      return index;
    });
    this.store.appendEvent(claims.tenantId, claims.sessionId, "playback.grant.created", {
      grantId,
      scopes: claims.resourceScopes,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
    return { grantId, grantToken, sessionId: claims.sessionId, scopes: [...claims.resourceScopes], expiresAt: new Date(expiresAtMs).toISOString() };
  }

  authorize(
    grantToken: string,
    expectedSessionId: string,
    requiredScope: LivePlaybackResourceScope,
    nowMs = Date.now(),
  ): LivePlaybackGrantAuthorization {
    if (typeof grantToken !== "string" || grantToken.length < 32 || grantToken.length > 256) {
      throw new LiveProductError("live_playback_grant_invalid", 401);
    }
    const tokenHash = LiveProductStore.sha256(`grant\0${grantToken}`);
    const index = this.store.readGlobalAccessIndex<GlobalAccessIndex>();
    const pointer = index?.byTokenHash[tokenHash];
    if (!pointer || pointer.sessionId !== expectedSessionId) throw new LiveProductError("live_playback_grant_invalid", 401);
    const session = this.store.requireSession(pointer.tenantId, pointer.sessionId);
    if (session.status !== "RUNNING" && session.status !== "STOPPED") throw new LiveProductError("live_playback_session_closed", 401);
    const access = this.store.readAuxiliaryJson<SessionAccessState>(pointer.tenantId, pointer.sessionId, "access.json");
    const grant = access?.grants[pointer.grantId];
    if (!grant || grant.tokenHash !== tokenHash || grant.revokedAtMs !== null || grant.expiresAtMs <= nowMs) {
      throw new LiveProductError("live_playback_grant_invalid", 401);
    }
    if (grant.tokenEpoch !== session.tokenEpoch || grant.accessRevision !== session.accessRevision) throw new LiveProductError("live_playback_grant_revoked", 401);
    if (!grant.scopes.includes(requiredScope)) throw new LiveProductError("live_playback_grant_scope_invalid", 401);
    return {
      grantId: grant.grantId,
      tenantId: grant.tenantId,
      sessionId: grant.sessionId,
      scopes: [...grant.scopes],
      expiresAt: new Date(grant.expiresAtMs).toISOString(),
    };
  }

  revokeGrant(tenantId: string, sessionId: string, grantId: string, nowMs = Date.now()): void {
    let tokenHash: string | null = null;
    this.store.mutateAuxiliaryJson(tenantId, sessionId, "access.json", emptySessionState(), (state) => {
      const grant = state.grants[grantId];
      if (!grant) throw new LiveProductError("live_playback_grant_not_found", 404);
      grant.revokedAtMs = grant.revokedAtMs ?? nowMs;
      tokenHash = grant.tokenHash;
      return state;
    });
    if (tokenHash) {
      this.store.mutateGlobalAccessIndex(emptyGlobalIndex(), (index) => {
        delete index.byTokenHash[tokenHash as string];
        return index;
      });
    }
    this.store.appendEvent(tenantId, sessionId, "playback.grant.revoked", { grantId });
  }

  revokeAllForSession(tenantId: string, sessionId: string, nowMs = Date.now()): number {
    const tokenHashes: string[] = [];
    let count = 0;
    this.store.mutateAuxiliaryJson(tenantId, sessionId, "access.json", emptySessionState(), (state) => {
      for (const grant of Object.values(state.grants)) {
        tokenHashes.push(grant.tokenHash);
        if (grant.revokedAtMs === null) {
          grant.revokedAtMs = nowMs;
          count += 1;
        }
      }
      return state;
    });
    this.store.mutateGlobalAccessIndex(emptyGlobalIndex(), (index) => {
      for (const hash of tokenHashes) delete index.byTokenHash[hash];
      return index;
    });
    this.store.appendEvent(tenantId, sessionId, "playback.session.revoked", { revokedGrantCount: count });
    return count;
  }
}
