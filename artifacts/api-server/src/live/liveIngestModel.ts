export type LiveIngestType = "rtmp" | "srt" | "webrtc" | "custom";
export type LiveIngestStatus = "planned" | "mock_ready" | "failed";

export const LIVE_INGEST_DECISION_ROLE = "live_mock_ingest_no_vault_no_confirmed" as const;

export interface LiveIngestInput {
  ingestType?: LiveIngestType;
  ingestUrlMock?: string;
  streamKey?: string;
  streamKeyPresent?: boolean;
}

export interface LiveIngestModel {
  ingestId: string;
  sessionId: string;
  ingestType: LiveIngestType;
  ingestUrlMock: string;
  streamKeyPresent: boolean;
  secretValuesHidden: true;
  status: LiveIngestStatus;
  realIngestEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_INGEST_DECISION_ROLE;
}

const ingestsBySession = new Map<string, LiveIngestModel[]>();
let ingestCounter = 0;

function nextIngestId(): string {
  ingestCounter += 1;
  return `live_ingest_mock_${String(ingestCounter).padStart(4, "0")}`;
}

function parseIngestType(value: unknown): LiveIngestType {
  if (value === "srt" || value === "webrtc" || value === "custom") return value;
  return "rtmp";
}

export function resetLiveMockIngestsForTests(): void {
  ingestsBySession.clear();
  ingestCounter = 0;
}

export function createMockLiveIngest(sessionId: string, input: LiveIngestInput = {}): LiveIngestModel {
  const ingestType = parseIngestType(input.ingestType);
  const ingest: LiveIngestModel = {
    ingestId: nextIngestId(),
    sessionId,
    ingestType,
    ingestUrlMock:
      input.ingestUrlMock?.trim() || `mock://${ingestType}.tancmark-live.local/${encodeURIComponent(sessionId)}`,
    streamKeyPresent:
      typeof input.streamKey === "string" ? input.streamKey.trim().length > 0 : input.streamKeyPresent ?? false,
    secretValuesHidden: true,
    status: "mock_ready",
    realIngestEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_INGEST_DECISION_ROLE,
  };
  const existing = ingestsBySession.get(sessionId) ?? [];
  ingestsBySession.set(sessionId, [...existing, ingest]);
  return ingest;
}

export function listMockLiveIngests(sessionId: string): LiveIngestModel[] {
  return ingestsBySession.get(sessionId) ?? [];
}
