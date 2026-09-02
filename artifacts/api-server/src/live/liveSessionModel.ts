import type { LiveProviderName } from "./liveProviderAdapter";

export type LiveSessionStatus = "draft" | "ready" | "mock_live" | "stopped" | "failed";
export type LivePreSealStatus = "planned" | "mock_only" | "not_connected";
export type LiveWatermarkMode = "none" | "general_preseal_future_lab";

export const LIVE_SESSION_DECISION_ROLE = "live_mock_session_no_vault_no_confirmed" as const;

export interface TancMarkLiveSessionInput {
  clientId?: string;
  docId?: string;
  ownerUserId?: string;
  engine?: LiveProviderName;
  preSealEnabled?: boolean;
  recordingEnabled?: boolean;
  secureRoomEnabled?: boolean;
}

export interface TancMarkLiveSession {
  sessionId: string;
  clientId: string;
  docId: string;
  ownerUserId: string;
  engine: LiveProviderName;
  mode: "mock";
  status: LiveSessionStatus;
  preSealEnabled: boolean;
  preSealStatus: LivePreSealStatus;
  tancmarkWatermarkMode: LiveWatermarkMode;
  personalizedWatermarkEnabled: false;
  abForensicWatermarkEnabled: false;
  drmEnabled: false;
  recordingEnabled: boolean;
  secureRoomEnabled: boolean;
  realServerProvisioned: false;
  realBroadcastStarted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SESSION_DECISION_ROLE;
  createdAt: string;
  updatedAt: string;
}

const liveSessions = new Map<string, TancMarkLiveSession>();
let liveSessionCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function nextSessionId(): string {
  liveSessionCounter += 1;
  return `live_mock_${String(liveSessionCounter).padStart(4, "0")}`;
}

function parseEngine(engine: unknown): LiveProviderName {
  return engine === "mediamtx" ? "mediamtx" : "srs";
}

export function resetLiveMockStoreForTests(): void {
  liveSessions.clear();
  liveSessionCounter = 0;
}

export function createMockLiveSession(input: TancMarkLiveSessionInput = {}): TancMarkLiveSession {
  const preSealEnabled = input.preSealEnabled ?? true;
  const timestamp = nowIso();
  const session: TancMarkLiveSession = {
    sessionId: nextSessionId(),
    clientId: input.clientId?.trim() || "mock-client",
    docId: input.docId?.trim() || "mock-doc",
    ownerUserId: input.ownerUserId?.trim() || "mock-owner",
    engine: parseEngine(input.engine),
    mode: "mock",
    status: "ready",
    preSealEnabled,
    preSealStatus: preSealEnabled ? "mock_only" : "not_connected",
    tancmarkWatermarkMode: preSealEnabled ? "general_preseal_future_lab" : "none",
    personalizedWatermarkEnabled: false,
    abForensicWatermarkEnabled: false,
    drmEnabled: false,
    recordingEnabled: input.recordingEnabled ?? false,
    secureRoomEnabled: input.secureRoomEnabled ?? true,
    realServerProvisioned: false,
    realBroadcastStarted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SESSION_DECISION_ROLE,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  liveSessions.set(session.sessionId, session);
  return session;
}

export function getMockLiveSession(sessionId: string): TancMarkLiveSession | null {
  return liveSessions.get(sessionId) ?? null;
}

export function startMockLiveSession(sessionId: string): TancMarkLiveSession | null {
  const session = liveSessions.get(sessionId);
  if (!session) return null;
  const updated: TancMarkLiveSession = {
    ...session,
    status: "mock_live",
    realServerProvisioned: false,
    realBroadcastStarted: false,
    updatedAt: nowIso(),
  };
  liveSessions.set(sessionId, updated);
  return updated;
}

export function stopMockLiveSession(sessionId: string): TancMarkLiveSession | null {
  const session = liveSessions.get(sessionId);
  if (!session) return null;
  const updated: TancMarkLiveSession = {
    ...session,
    status: "stopped",
    realServerProvisioned: false,
    realBroadcastStarted: false,
    updatedAt: nowIso(),
  };
  liveSessions.set(sessionId, updated);
  return updated;
}
