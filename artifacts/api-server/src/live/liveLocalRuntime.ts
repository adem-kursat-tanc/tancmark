import path from "node:path";
import { LivePlaybackGrantStore } from "./livePlaybackGrantStore";
import { LiveProductLifecycle } from "./liveProductLifecycle";
import { LIVE_LOCAL_STORAGE_ROOT_ENV, LiveProductError, LiveProductStore, releaseLiveProductProcessLeasesForContractOnly } from "./liveProductStore";
import { LiveWatermarkWorkerManager } from "./liveWatermarkWorker";

export interface LiveLocalRuntime { store: LiveProductStore; grants: LivePlaybackGrantStore; lifecycle: LiveProductLifecycle; watermarkWorkers: LiveWatermarkWorkerManager }
let singleton: { root: string; value: LiveLocalRuntime } | null = null;

/** One file-store/grant coordinator per Node process. */
export function getLiveLocalRuntime(env: NodeJS.ProcessEnv = process.env): LiveLocalRuntime {
  const configured = env[LIVE_LOCAL_STORAGE_ROOT_ENV];
  if (!configured || !path.isAbsolute(configured)) throw new LiveProductError("live_storage_root_not_configured", 503);
  const root = path.resolve(configured);
  if (singleton) {
    if (singleton.root !== root) throw new LiveProductError("live_storage_runtime_root_conflict", 503);
    return singleton.value;
  }
  const store = new LiveProductStore(root);
  const grants = new LivePlaybackGrantStore(store);
  const watermarkWorkers = new LiveWatermarkWorkerManager();
  singleton = { root, value: { store, grants, watermarkWorkers, lifecycle: new LiveProductLifecycle(store, grants, watermarkWorkers) } };
  return singleton.value;
}

export function resetLiveLocalRuntimeForContractOnly(): void {
  void singleton?.value.watermarkWorkers.shutdownAll();
  releaseLiveProductProcessLeasesForContractOnly();
  singleton = null;
}

export async function shutdownLiveLocalRuntime(): Promise<void> {
  await singleton?.value.watermarkWorkers.shutdownAll();
  releaseLiveProductProcessLeasesForContractOnly();
  singleton = null;
}
