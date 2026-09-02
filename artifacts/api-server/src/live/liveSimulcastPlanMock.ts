import { buildLiveCustomRtmpTargetMock } from "./liveCustomRtmpTargetMock";
import { buildLiveFacebookTargetMock } from "./liveFacebookTargetMock";
import {
  parseLiveTargetCatalogType,
  type LiveTargetCatalogType,
  type LiveTargetRiskLevel,
} from "./liveTargetCatalog";
import { buildLiveTargetRoutePlan, type LiveTargetRoutePlan } from "./liveTargetRoutePlan";
import { buildLiveTwitchTargetMock } from "./liveTwitchTargetMock";
import { buildLiveYouTubeTargetMock } from "./liveYouTubeTargetMock";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_SIMULCAST_PLAN_MOCK_DECISION_ROLE =
  "live_simulcast_plan_mock_support_only_no_real_push_no_vault_no_confirmed" as const;

export type LiveSimulcastTargetPreview =
  | ReturnType<typeof buildLiveYouTubeTargetMock>
  | ReturnType<typeof buildLiveFacebookTargetMock>
  | ReturnType<typeof buildLiveTwitchTargetMock>
  | ReturnType<typeof buildLiveCustomRtmpTargetMock>;

export interface LiveSimulcastPlanMock {
  liveSessionId: string;
  simulcastPlanId: string;
  selectedTargetsPreview: LiveSimulcastTargetPreview[];
  primaryTargetPreview: LiveSimulcastTargetPreview | null;
  backupTargetPreview: LiveSimulcastTargetPreview | null;
  routePlanPreview: LiveTargetRoutePlan;
  routeStatus: "mock_ready";
  realPushEnabled: false;
  realBroadcastStarted: false;
  maxTargetsPreview: number;
  targetRiskSummary: {
    highestRisk: LiveTargetRiskLevel;
    customRtmpWarning: boolean;
    futureTargetsExcluded: true;
  };
  costPreview: {
    currency: "USD";
    amountPreview: 0;
    unknownUntilRealLabMeasured: true;
    billingCreditPaymentAdded: false;
  };
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SIMULCAST_PLAN_MOCK_DECISION_ROLE;
}

const plansBySession = new Map<string, LiveSimulcastPlanMock[]>();

export function resetLiveSimulcastPlansForTests(): void {
  plansBySession.clear();
}

export function createLiveSimulcastPlanMock(
  session: TancMarkLiveSession,
  targetTypesInput: unknown[] = ["youtube_mock", "facebook_mock", "twitch_mock"],
): LiveSimulcastPlanMock {
  const targetTypes = normalizeTargetTypes(targetTypesInput);
  const targets = targetTypes.map((targetType) => buildTarget(session.sessionId, targetType));
  const plan: LiveSimulcastPlanMock = {
    liveSessionId: session.sessionId,
    simulcastPlanId: `simulcast_plan_mock_${session.sessionId}_${String((plansBySession.get(session.sessionId)?.length ?? 0) + 1).padStart(3, "0")}`,
    selectedTargetsPreview: targets,
    primaryTargetPreview: targets[0] ?? null,
    backupTargetPreview: targets[1] ?? null,
    routePlanPreview: buildLiveTargetRoutePlan(session.sessionId, targetTypes),
    routeStatus: "mock_ready",
    realPushEnabled: false,
    realBroadcastStarted: false,
    maxTargetsPreview: 4,
    targetRiskSummary: {
      highestRisk: targetTypes.includes("custom_rtmp_mock") ? "high" : "medium",
      customRtmpWarning: targetTypes.includes("custom_rtmp_mock"),
      futureTargetsExcluded: true,
    },
    costPreview: {
      currency: "USD",
      amountPreview: 0,
      unknownUntilRealLabMeasured: true,
      billingCreditPaymentAdded: false,
    },
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SIMULCAST_PLAN_MOCK_DECISION_ROLE,
  };
  const existing = plansBySession.get(session.sessionId) ?? [];
  plansBySession.set(session.sessionId, [...existing, plan]);
  return plan;
}

export function listLiveSimulcastPlanMocks(liveSessionId: string): LiveSimulcastPlanMock[] {
  return plansBySession.get(liveSessionId) ?? [];
}

export function getLatestLiveSimulcastPlanMock(session: TancMarkLiveSession): LiveSimulcastPlanMock {
  return listLiveSimulcastPlanMocks(session.sessionId).at(-1) ?? createLiveSimulcastPlanMock(session);
}

function normalizeTargetTypes(targetTypesInput: unknown[]): LiveTargetCatalogType[] {
  const parsed = targetTypesInput.map(parseLiveTargetCatalogType).filter((targetType) =>
    ["youtube_mock", "facebook_mock", "twitch_mock", "custom_rtmp_mock"].includes(targetType),
  );
  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique.slice(0, 4) : ["youtube_mock", "facebook_mock", "twitch_mock"];
}

function buildTarget(liveSessionId: string, targetType: LiveTargetCatalogType): LiveSimulcastTargetPreview {
  if (targetType === "youtube_mock") return buildLiveYouTubeTargetMock(liveSessionId);
  if (targetType === "facebook_mock") return buildLiveFacebookTargetMock(liveSessionId);
  if (targetType === "twitch_mock") return buildLiveTwitchTargetMock(liveSessionId);
  return buildLiveCustomRtmpTargetMock(liveSessionId);
}
