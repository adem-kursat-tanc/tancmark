import { getLiveAccessPolicy, type LiveAccessMode } from "./liveAccessPolicy";
import { buildLivePlaybackAuthorizationMock, type LivePlaybackAuthorizationScenario } from "./livePlaybackAuthorizationMock";

export const LIVE_ACCESS_DECISION_PREVIEW_ROLE =
  "live_access_decision_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveAccessDecisionPreviewInput {
  liveSessionId: string;
  accessMode?: LiveAccessMode;
  scenario?: LivePlaybackAuthorizationScenario;
}

export function buildLiveAccessDecisionPreview(input: LiveAccessDecisionPreviewInput) {
  const accessPolicy = getLiveAccessPolicy(input.accessMode);
  const authorization = buildLivePlaybackAuthorizationMock(input.scenario);
  return {
    liveSessionId: input.liveSessionId,
    accessPolicy,
    authorization,
    accessWouldBeAllowedPreview: authorization.authorizedPreview,
    realAccessEnforced: false,
    realTokenGenerated: false,
    realSignedUrlGenerated: false,
    drmEnabled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ACCESS_DECISION_PREVIEW_ROLE,
  };
}
