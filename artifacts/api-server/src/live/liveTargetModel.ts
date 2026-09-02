export type LiveTargetType =
  | "youtube"
  | "facebook"
  | "twitch"
  | "custom_rtmp"
  | "own_site_hls"
  | "future_tiktok"
  | "future_instagram";

export type LiveTargetStatus = "planned" | "mock_ready" | "mock_active" | "stopped" | "failed";

export const LIVE_TARGET_DECISION_ROLE = "live_mock_target_no_vault_no_confirmed" as const;

export interface LiveTargetInput {
  targetType?: LiveTargetType;
  rtmpUrl?: string;
  rtmpUrlPresent?: boolean;
  streamKey?: string;
  streamKeyPresent?: boolean;
}

export interface LiveTargetModel {
  targetId: string;
  sessionId: string;
  targetType: LiveTargetType;
  targetMode: "mock";
  rtmpUrlPresent: boolean;
  streamKeyPresent: boolean;
  secretValuesHidden: true;
  status: LiveTargetStatus;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_DECISION_ROLE;
}

const targetsBySession = new Map<string, LiveTargetModel[]>();
let targetCounter = 0;

function nextTargetId(): string {
  targetCounter += 1;
  return `live_target_mock_${String(targetCounter).padStart(4, "0")}`;
}

function parseTargetType(value: unknown): LiveTargetType {
  if (
    value === "youtube" ||
    value === "facebook" ||
    value === "twitch" ||
    value === "own_site_hls" ||
    value === "future_tiktok" ||
    value === "future_instagram"
  ) {
    return value;
  }
  return "custom_rtmp";
}

export function resetLiveMockTargetsForTests(): void {
  targetsBySession.clear();
  targetCounter = 0;
}

export function createMockLiveTarget(sessionId: string, input: LiveTargetInput = {}): LiveTargetModel {
  const target: LiveTargetModel = {
    targetId: nextTargetId(),
    sessionId,
    targetType: parseTargetType(input.targetType),
    targetMode: "mock",
    rtmpUrlPresent:
      typeof input.rtmpUrl === "string" ? input.rtmpUrl.trim().length > 0 : input.rtmpUrlPresent ?? false,
    streamKeyPresent:
      typeof input.streamKey === "string" ? input.streamKey.trim().length > 0 : input.streamKeyPresent ?? false,
    secretValuesHidden: true,
    status: "mock_ready",
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_DECISION_ROLE,
  };
  const existing = targetsBySession.get(sessionId) ?? [];
  targetsBySession.set(sessionId, [...existing, target]);
  return target;
}

export function listMockLiveTargets(sessionId: string): LiveTargetModel[] {
  return targetsBySession.get(sessionId) ?? [];
}

export function activateMockLiveTargets(sessionId: string): LiveTargetModel[] {
  const targets = listMockLiveTargets(sessionId).map((target) => ({ ...target, status: "mock_active" as const }));
  targetsBySession.set(sessionId, targets);
  return targets;
}

export function stopMockLiveTargets(sessionId: string): LiveTargetModel[] {
  const targets = listMockLiveTargets(sessionId).map((target) => ({ ...target, status: "stopped" as const }));
  targetsBySession.set(sessionId, targets);
  return targets;
}
