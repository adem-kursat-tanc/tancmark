import { DemoEngine } from "./demoEngine";
import {
  loadLiveDemoRuntime,
  runLiveDemoPipeline,
  type LiveDemoResult,
} from "./liveDemoPipeline";

interface ActiveLiveState {
    status: "RUNNING" | "COMPLETED" | "FAILED";
    ownerSessionId: string;
    browserPlaybackVisible: boolean;
    promise: Promise<LiveDemoResult>;
    result?: LiveDemoResult;
    error?: string;
    abortController: AbortController;
}

type LiveState = { status: "IDLE" } | ActiveLiveState;

export class LiveDemoController {
  #state: LiveState = { status: "IDLE" };

  constructor(private readonly engine: DemoEngine) {}

  start(ownerSessionId: string): Record<string, unknown> {
    if (this.#state.status === "RUNNING") throw new LiveDemoConflictError();
    const record = this.engine.registry.createRecord("live");
    const state: ActiveLiveState = {
      status: "RUNNING",
      ownerSessionId,
      browserPlaybackVisible: false,
      promise: Promise.resolve(undefined as never),
      abortController: new AbortController(),
    };
    const promise = runLiveDemoPipeline({
      runtime: loadLiveDemoRuntime(this.engine.paths),
      registry: this.engine.registry,
      record,
      signal: state.abortController.signal,
      observePlayback: async () => {
        const deadline = Date.now() + 15_000;
        while (
          Date.now() < deadline &&
          !state.browserPlaybackVisible &&
          !state.abortController.signal.aborted
        ) await delay(100);
        return {
          hlsManifestReady: true,
          browserPlaybackVisible: state.browserPlaybackVisible,
        };
      },
    });
    state.promise = promise;
    this.#state = state;
    void promise.then(
      (result) => {
        state.status = "COMPLETED";
        state.result = result;
      },
      () => {
        state.status = "FAILED";
        state.error = "LIVE_DEMO_FAILED_SAFELY";
      },
    );
    return {
      status: "LIVE_DEMO_STARTED",
      demoOnly: true,
      playbackManifest: "/demo/live/media/demo_live/index.m3u8",
      productionOwnership: false,
      productionVault: false,
    };
  }

  status(ownerSessionId: string, browserPlaybackObserved: boolean): Record<string, unknown> {
    this.assertOwner(ownerSessionId);
    if (this.#state.status !== "IDLE" && browserPlaybackObserved) {
      this.#state.browserPlaybackVisible = true;
    }
    if (this.#state.status === "IDLE") return { status: "IDLE", demoOnly: true };
    return {
      status: this.#state.status,
      demoOnly: true,
      browserPlaybackVisible: this.#state.browserPlaybackVisible,
      result: this.#state.result,
      error: this.#state.error,
      productionOwnership: false,
      productionVault: false,
    };
  }

  async stop(ownerSessionId: string): Promise<LiveDemoResult> {
    this.assertOwner(ownerSessionId);
    if (this.#state.status === "IDLE") throw new LiveDemoNotFoundError();
    try {
      return await this.#state.promise;
    } finally {
      this.#state = { status: "IDLE" };
    }
  }

  get active(): boolean {
    return this.#state.status === "RUNNING";
  }

  async shutdown(): Promise<void> {
    if (this.#state.status === "IDLE") return;
    const state = this.#state;
    state.abortController.abort();
    try {
      await state.promise;
    } catch {
      // Abort is an expected fail-closed shutdown path.
    } finally {
      this.#state = { status: "IDLE" };
    }
  }

  private assertOwner(ownerSessionId: string): void {
    if (this.#state.status !== "IDLE" && this.#state.ownerSessionId !== ownerSessionId) {
      throw new LiveDemoNotFoundError();
    }
  }
}

export class LiveDemoConflictError extends Error {}
export class LiveDemoNotFoundError extends Error {}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
