import { noopHealth, noopResult, type PlatformOperationResult } from "./platformTypes";

export type QueueJobInput = Readonly<{
  jobType: string;
  correlationId?: string;
  payloadRef?: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type QueueJobStatus = Readonly<{
  jobId: string | null;
  state: "not_configured" | "queued" | "running" | "completed" | "failed" | "cancelled";
  jobStarted: false;
  jobExecuted: false;
}>;

export interface QueueAdapter {
  enqueueJob(input: QueueJobInput): Promise<PlatformOperationResult<QueueJobStatus>>;
  getJobStatus(jobId: string): Promise<PlatformOperationResult<QueueJobStatus>>;
  cancelJob(jobId: string): Promise<PlatformOperationResult<QueueJobStatus>>;
  healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>>;
}

export class NoopQueueAdapter implements QueueAdapter {
  readonly adapterName = "NoopQueueAdapter";

  async enqueueJob(_input: QueueJobInput): Promise<PlatformOperationResult<QueueJobStatus>> {
    return noopResult(this.adapterName, "queue_not_configured_no_job_started", {
      jobId: null,
      state: "not_configured",
      jobStarted: false,
      jobExecuted: false,
    });
  }

  async getJobStatus(_jobId: string): Promise<PlatformOperationResult<QueueJobStatus>> {
    return noopResult(this.adapterName, "queue_not_configured_no_job_status", {
      jobId: null,
      state: "not_configured",
      jobStarted: false,
      jobExecuted: false,
    });
  }

  async cancelJob(_jobId: string): Promise<PlatformOperationResult<QueueJobStatus>> {
    return noopResult(this.adapterName, "queue_not_configured_no_job_cancelled", {
      jobId: null,
      state: "not_configured",
      jobStarted: false,
      jobExecuted: false,
    });
  }

  async healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>> {
    return noopHealth(this.adapterName);
  }
}

export const noopQueueAdapter = new NoopQueueAdapter();
