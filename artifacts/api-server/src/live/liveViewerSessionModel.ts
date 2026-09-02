import { parseLiveAccessMode, type LiveAccessMode } from "./liveAccessPolicy";

export type LiveAccessStatusPreview = "allowed" | "denied" | "expired" | "pending" | "mock_only";
export type LiveAccessRiskPreview = "low" | "medium" | "high";

export const LIVE_VIEWER_SESSION_DECISION_ROLE =
  "live_viewer_session_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveViewerSessionInput {
  viewerIdMock?: string;
  clientId?: string;
  accessMode?: LiveAccessMode;
  accessStatusPreview?: LiveAccessStatusPreview;
  tokenPresent?: boolean;
  signedUrlPresent?: boolean;
  ipRiskPreview?: LiveAccessRiskPreview;
  deviceRiskPreview?: LiveAccessRiskPreview;
  referrerRiskPreview?: LiveAccessRiskPreview;
}

export interface LiveViewerSessionModel {
  viewerSessionId: string;
  liveSessionId: string;
  viewerIdMock: string;
  clientId: string;
  accessMode: LiveAccessMode;
  accessStatusPreview: LiveAccessStatusPreview;
  tokenPresent: boolean;
  tokenValueExposed: false;
  signedUrlPresent: boolean;
  signedUrlValueExposed: false;
  expiresAtPreview: string;
  ipRiskPreview: LiveAccessRiskPreview;
  deviceRiskPreview: LiveAccessRiskPreview;
  referrerRiskPreview: LiveAccessRiskPreview;
  realAccessEnforced: false;
  realTokenGenerated: false;
  realSignedUrlGenerated: false;
  drmEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_VIEWER_SESSION_DECISION_ROLE;
  createdAt: string;
}

const viewerSessionsByLiveSession = new Map<string, LiveViewerSessionModel[]>();
let viewerSessionCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function expiresAtPreview(): string {
  return new Date(Date.now() + 15 * 60 * 1000).toISOString();
}

function nextViewerSessionId(): string {
  viewerSessionCounter += 1;
  return `live_viewer_mock_${String(viewerSessionCounter).padStart(4, "0")}`;
}

function parseStatus(value: unknown): LiveAccessStatusPreview {
  if (value === "allowed" || value === "denied" || value === "expired" || value === "pending") return value;
  return "mock_only";
}

function parseRisk(value: unknown): LiveAccessRiskPreview {
  if (value === "medium" || value === "high") return value;
  return "low";
}

export function resetLiveViewerSessionsForTests(): void {
  viewerSessionsByLiveSession.clear();
  viewerSessionCounter = 0;
}

export function createLiveViewerSessionMock(
  liveSessionId: string,
  input: LiveViewerSessionInput = {},
): LiveViewerSessionModel {
  const accessMode = parseLiveAccessMode(input.accessMode);
  const tokenPresent = input.tokenPresent ?? accessMode === "token_required_mock";
  const signedUrlPresent = input.signedUrlPresent ?? accessMode === "signed_url_required_mock";
  const session: LiveViewerSessionModel = {
    viewerSessionId: nextViewerSessionId(),
    liveSessionId,
    viewerIdMock: input.viewerIdMock?.trim() || "mock-viewer",
    clientId: input.clientId?.trim() || "mock-client",
    accessMode,
    accessStatusPreview: parseStatus(input.accessStatusPreview),
    tokenPresent,
    tokenValueExposed: false,
    signedUrlPresent,
    signedUrlValueExposed: false,
    expiresAtPreview: expiresAtPreview(),
    ipRiskPreview: parseRisk(input.ipRiskPreview),
    deviceRiskPreview: parseRisk(input.deviceRiskPreview),
    referrerRiskPreview: parseRisk(input.referrerRiskPreview),
    realAccessEnforced: false,
    realTokenGenerated: false,
    realSignedUrlGenerated: false,
    drmEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_VIEWER_SESSION_DECISION_ROLE,
    createdAt: nowIso(),
  };
  const existing = viewerSessionsByLiveSession.get(liveSessionId) ?? [];
  viewerSessionsByLiveSession.set(liveSessionId, [...existing, session]);
  return session;
}

export function listLiveViewerSessionMocks(liveSessionId: string): LiveViewerSessionModel[] {
  return viewerSessionsByLiveSession.get(liveSessionId) ?? [];
}
