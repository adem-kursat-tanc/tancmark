import type { LiveTargetCatalogType } from "./liveTargetCatalog";

export const LIVE_TARGET_ROUTE_PLAN_DECISION_ROLE =
  "live_target_route_plan_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveTargetRouteEntry {
  targetType: LiveTargetCatalogType;
  routePriority: number;
  activePreview: boolean;
  realPushEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_ROUTE_PLAN_DECISION_ROLE;
}

export interface LiveTargetRoutePlan {
  liveSessionId: string;
  routePlanId: string;
  routeEntries: LiveTargetRouteEntry[];
  realPushEnabled: false;
  realBroadcastStarted: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_TARGET_ROUTE_PLAN_DECISION_ROLE;
}

export function buildLiveTargetRoutePlan(
  liveSessionId: string,
  targetTypes: LiveTargetCatalogType[],
): LiveTargetRoutePlan {
  return {
    liveSessionId,
    routePlanId: `target_route_plan_mock_${liveSessionId}`,
    routeEntries: targetTypes.map((targetType, index) => ({
      targetType,
      routePriority: index + 1,
      activePreview: index < 2,
      realPushEnabled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
      decisionRole: LIVE_TARGET_ROUTE_PLAN_DECISION_ROLE,
    })),
    realPushEnabled: false,
    realBroadcastStarted: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_TARGET_ROUTE_PLAN_DECISION_ROLE,
  };
}
