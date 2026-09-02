import { createHash, randomUUID } from "node:crypto";

export const DISTRIBUTED_LEARNING_RUNTIME_VERSION = "tancmark-distributed-learning-contract-v1" as const;
export const DISTRIBUTED_LEARNING_RUNTIME_STATUS = {
  contract: "DISTRIBUTED_LEARNING_RUNTIME_CONTRACT_READY",
  deployment: "PRODUCTION_DEPLOYMENT_DEFERRED",
  localOnlySchedulerIsFinal: false,
} as const;

export type LearningJobState = "pending" | "leased" | "completed" | "dead_letter";

export interface LearningJobPayload {
  tenantScope: string;
  eventId: string;
  dnaId: string;
  evidenceReference: string;
}

export interface LearningJob {
  jobId: string;
  idempotencyKey: string;
  payload: LearningJobPayload;
  state: LearningJobState;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
  heartbeatAt: number | null;
  attemptCount: number;
  maxAttempts: number;
  retryAfter: number;
  workerId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  failureClass: string | null;
  resultDigest: string | null;
  createdAt: number;
}

export interface LearningQueueSnapshot {
  version: typeof DISTRIBUTED_LEARNING_RUNTIME_VERSION;
  jobs: LearningJob[];
  canonicalResults: Array<{ jobId: string; resultDigest: string }>;
}

export class DistributedLearningQueue {
  readonly leaseDurationMs: number;
  #jobs = new Map<string, LearningJob>();
  #jobByIdempotency = new Map<string, string>();
  #canonicalResults = new Map<string, string>();
  #duplicateSuppressionCount = 0;
  #pendingOrder: string[] = [];
  #pendingCursor = 0;

  constructor(leaseDurationMs = 30_000) {
    if (!Number.isFinite(leaseDurationMs) || leaseDurationMs < 100) {
      throw new Error("leaseDurationMs must be finite and at least 100ms");
    }
    this.leaseDurationMs = leaseDurationMs;
  }

  enqueue(payload: LearningJobPayload, idempotencyKey: string, now = Date.now(), maxAttempts = 3): LearningJob {
    if (!payload.tenantScope || !payload.eventId || !payload.dnaId || !payload.evidenceReference) {
      throw new Error("job payload must be complete");
    }
    if (!idempotencyKey || maxAttempts < 1 || maxAttempts > 10) {
      throw new Error("invalid idempotencyKey or maxAttempts");
    }
    const namespacedKey = `${payload.tenantScope}:${idempotencyKey}`;
    const existingId = this.#jobByIdempotency.get(namespacedKey);
    if (existingId) {
      this.#duplicateSuppressionCount += 1;
      return this.#jobs.get(existingId)!;
    }
    const job: LearningJob = {
      jobId: randomUUID(),
      idempotencyKey,
      payload: { ...payload },
      state: "pending",
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      attemptCount: 0,
      maxAttempts,
      retryAfter: now,
      workerId: null,
      startedAt: null,
      completedAt: null,
      failureClass: null,
      resultDigest: null,
      createdAt: now,
    };
    this.#jobs.set(job.jobId, job);
    this.#jobByIdempotency.set(namespacedKey, job.jobId);
    this.#pendingOrder.push(job.jobId);
    return job;
  }

  leaseNext(workerId: string, now = Date.now()): LearningJob | null {
    if (!workerId) throw new Error("workerId required");
    let job: LearningJob | undefined;
    const pendingScanEnd = this.#pendingOrder.length;
    while (this.#pendingCursor < pendingScanEnd) {
      const candidate = this.#jobs.get(this.#pendingOrder[this.#pendingCursor]!);
      this.#pendingCursor += 1;
      if (candidate?.state === "pending" && candidate.retryAfter <= now) {
        job = candidate;
        break;
      }
      if (candidate?.state === "pending") this.#pendingOrder.push(candidate.jobId);
    }
    if (!job) {
      job = Array.from(this.#jobs.values())
        .filter((candidate) =>
          candidate.state === "leased" && candidate.leaseExpiresAt !== null && candidate.leaseExpiresAt <= now,
        )
        .sort((a, b) => a.createdAt - b.createdAt || a.jobId.localeCompare(b.jobId))[0];
    }
    if (!job) return null;
    if (job.attemptCount >= job.maxAttempts) {
      job.state = "dead_letter";
      job.failureClass = "MAX_ATTEMPTS_EXHAUSTED";
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      return this.leaseNext(workerId, now);
    }
    job.state = "leased";
    job.leaseOwner = workerId;
    job.workerId = workerId;
    job.leaseExpiresAt = now + this.leaseDurationMs;
    job.heartbeatAt = now;
    job.startedAt ??= now;
    job.attemptCount += 1;
    return job;
  }

  heartbeat(jobId: string, workerId: string, now = Date.now()): LearningJob {
    const job = this.#requireLease(jobId, workerId, now);
    job.heartbeatAt = now;
    job.leaseExpiresAt = now + this.leaseDurationMs;
    return job;
  }

  complete(jobId: string, workerId: string, result: unknown, now = Date.now()): LearningJob {
    const existingDigest = this.#canonicalResults.get(jobId);
    if (existingDigest) return this.#jobs.get(jobId)!;
    const job = this.#requireLease(jobId, workerId, now);
    const resultDigest = createHash("sha256").update(JSON.stringify(result), "utf8").digest("hex");
    this.#canonicalResults.set(jobId, resultDigest);
    job.state = "completed";
    job.completedAt = now;
    job.resultDigest = resultDigest;
    job.leaseOwner = null;
    job.leaseExpiresAt = null;
    job.heartbeatAt = null;
    job.failureClass = null;
    return job;
  }

  fail(jobId: string, workerId: string, failureClass: string, now = Date.now(), retryDelayMs = 1_000): LearningJob {
    const job = this.#requireLease(jobId, workerId, now);
    job.failureClass = failureClass.slice(0, 160);
    job.leaseOwner = null;
    job.leaseExpiresAt = null;
    job.heartbeatAt = null;
    if (job.attemptCount >= job.maxAttempts) {
      job.state = "dead_letter";
    } else {
      job.state = "pending";
      job.retryAfter = now + Math.max(0, retryDelayMs);
      this.#pendingOrder.push(job.jobId);
    }
    return job;
  }

  gracefulShutdown(workerId: string, now = Date.now()): number {
    let released = 0;
    for (const job of this.#jobs.values()) {
      if (job.state === "leased" && job.leaseOwner === workerId) {
        job.state = "pending";
        job.retryAfter = now;
        job.leaseOwner = null;
        job.leaseExpiresAt = null;
        job.heartbeatAt = null;
        this.#pendingOrder.push(job.jobId);
        released += 1;
      }
    }
    return released;
  }

  listForTenant(tenantScope: string): LearningJob[] {
    return Array.from(this.#jobs.values()).filter((job) => job.payload.tenantScope === tenantScope);
  }

  health(): { pending: number; leased: number; completed: number; deadLetter: number; duplicateSuppressionCount: number } {
    const jobs = Array.from(this.#jobs.values());
    return {
      pending: jobs.filter((job) => job.state === "pending").length,
      leased: jobs.filter((job) => job.state === "leased").length,
      completed: jobs.filter((job) => job.state === "completed").length,
      deadLetter: jobs.filter((job) => job.state === "dead_letter").length,
      duplicateSuppressionCount: this.#duplicateSuppressionCount,
    };
  }

  snapshot(): LearningQueueSnapshot {
    return {
      version: DISTRIBUTED_LEARNING_RUNTIME_VERSION,
      jobs: Array.from(this.#jobs.values()).map((job) => ({ ...job, payload: { ...job.payload } })),
      canonicalResults: Array.from(this.#canonicalResults, ([jobId, resultDigest]) => ({ jobId, resultDigest })),
    };
  }

  static resume(snapshot: LearningQueueSnapshot, leaseDurationMs = 30_000): DistributedLearningQueue {
    if (snapshot.version !== DISTRIBUTED_LEARNING_RUNTIME_VERSION) throw new Error("unsupported queue snapshot");
    const queue = new DistributedLearningQueue(leaseDurationMs);
    for (const raw of snapshot.jobs) {
      const job = { ...raw, payload: { ...raw.payload } };
      queue.#jobs.set(job.jobId, job);
      queue.#jobByIdempotency.set(`${job.payload.tenantScope}:${job.idempotencyKey}`, job.jobId);
      if (job.state === "pending") queue.#pendingOrder.push(job.jobId);
    }
    for (const result of snapshot.canonicalResults) queue.#canonicalResults.set(result.jobId, result.resultDigest);
    return queue;
  }

  #requireLease(jobId: string, workerId: string, now: number): LearningJob {
    const job = this.#jobs.get(jobId);
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.state !== "leased" || job.leaseOwner !== workerId) throw new Error("LEASE_OWNER_MISMATCH");
    if (job.leaseExpiresAt === null || job.leaseExpiresAt <= now) throw new Error("LEASE_EXPIRED");
    return job;
  }
}
