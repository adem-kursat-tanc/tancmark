import { getLiveEngineCompatibilityMatrix } from "./liveEngineCompatibilityMatrix";
import { getLiveEngineConfigPolicy } from "./liveEngineConfigPolicy";
import { buildLiveEngineCostPreview } from "./liveEngineCostPreview";
import { buildLiveEngineConfigDryRun } from "./liveEngineConfigDryRun";
import { getLiveEngineSecurityPolicy } from "./liveEngineSecurityPolicy";
import type { LiveEngineProvider } from "./liveObsIngestPreview";
import { buildLiveHlsOutputPreview } from "./liveHlsOutputPreview";
import { buildLiveObsIngestPreview } from "./liveObsIngestPreview";
import { getLivePortPlan } from "./livePortPlan";
import { getLiveRecordingStoragePolicy } from "./liveRecordingStoragePolicy";
import type { TancMarkLiveSession } from "./liveSessionModel";

export const LIVE_ENGINE_SECURE_ROOM_HANDOFF_DECISION_ROLE =
  "live_engine_config_dryrun_support_only_no_vault_no_confirmed" as const;

export interface LiveEngineSecureRoomHandoff {
  liveSessionId: string;
  engineProvider: LiveEngineProvider;
  configPolicySummary: ReturnType<typeof getLiveEngineConfigPolicy>;
  portPlanSummary: ReturnType<typeof getLivePortPlan>;
  obsIngestPreviewSummary: ReturnType<typeof buildLiveObsIngestPreview>;
  hlsOutputPreviewSummary: ReturnType<typeof buildLiveHlsOutputPreview>;
  recordingStoragePolicySummary: ReturnType<typeof getLiveRecordingStoragePolicy>;
  securityPolicySummary: ReturnType<typeof getLiveEngineSecurityPolicy>;
  compatibilitySummary: ReturnType<typeof getLiveEngineCompatibilityMatrix>["shortDecision"];
  costPreviewSummary: ReturnType<typeof buildLiveEngineCostPreview>;
  dryRunSummary: ReturnType<typeof buildLiveEngineConfigDryRun>;
  realServerStarted: false;
  realConfigWritten: false;
  realPortsOpened: false;
  realBroadcastStarted: false;
  realMediaProcessed: false;
  tancmarkWatermarkApplied: false;
  vaultEligible: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  decisionRole: typeof LIVE_ENGINE_SECURE_ROOM_HANDOFF_DECISION_ROLE;
}

function providerOrDefault(provider: unknown): LiveEngineProvider {
  return provider === "mediamtx" ? "mediamtx" : "srs";
}

export function buildLiveEngineSecureRoomHandoff(
  session: TancMarkLiveSession,
  provider?: unknown,
): LiveEngineSecureRoomHandoff {
  const engineProvider = providerOrDefault(provider ?? session.engine);
  return {
    liveSessionId: session.sessionId,
    engineProvider,
    configPolicySummary: getLiveEngineConfigPolicy(),
    portPlanSummary: getLivePortPlan(),
    obsIngestPreviewSummary: buildLiveObsIngestPreview(engineProvider),
    hlsOutputPreviewSummary: buildLiveHlsOutputPreview(engineProvider, session.sessionId),
    recordingStoragePolicySummary: getLiveRecordingStoragePolicy(),
    securityPolicySummary: getLiveEngineSecurityPolicy(),
    compatibilitySummary: getLiveEngineCompatibilityMatrix().shortDecision,
    costPreviewSummary: buildLiveEngineCostPreview(),
    dryRunSummary: buildLiveEngineConfigDryRun({ provider: engineProvider, sessionId: session.sessionId }),
    realServerStarted: false,
    realConfigWritten: false,
    realPortsOpened: false,
    realBroadcastStarted: false,
    realMediaProcessed: false,
    tancmarkWatermarkApplied: false,
    vaultEligible: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    decisionRole: LIVE_ENGINE_SECURE_ROOM_HANDOFF_DECISION_ROLE,
  };
}
