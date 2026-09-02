import { noopHealth, noopResult, type PlatformOperationResult } from "./platformTypes";

export type SharedStoreMode = "noop" | "memory" | "pg" | "redis";

export type SharedRateLimitInput = Readonly<{
  key: string;
  windowSeconds: number;
  limit: number;
}>;

export type SharedRateLimitResult = Readonly<{
  key: string;
  count: number | null;
  limited: boolean;
  enforcementApplied: boolean;
  resetAtEpochMs: number | null;
}>;

export type SharedRateLimitStateInput = Readonly<{
  key: string;
  windowSeconds: number;
}>;

export type SharedRateLimitResetInput = Readonly<{
  key: string;
  reason: "manual_admin" | "test_cleanup" | "pilot_fallback" | "unknown";
}>;

export type SharedRateLimitResetResult = Readonly<{
  key: string;
  resetApplied: false;
  persisted: false;
}>;

export type SharedAuditEventInput = Readonly<{
  eventType: string;
  correlationId?: string;
  summary?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type SharedAuditAnomalyCounterInput = Readonly<{
  key: string;
  windowSeconds: number;
  threshold: number;
  timestampEpochMs: number;
}>;

export type SharedAuditAnomalyStateInput = Readonly<{
  key: string;
  windowSeconds: number;
}>;

export type SharedAuditAnomalyResetInput = Readonly<{
  key: string;
  reason: "manual_admin" | "test_cleanup" | "pilot_fallback" | "unknown";
}>;

export type SharedAuditAnomalyResult = Readonly<{
  key: string;
  count: number | null;
  threshold: number | null;
  anomalyDetected: boolean;
  recorded: false;
  persisted: false;
  resetAtEpochMs: number | null;
}>;

export type SharedAuditAnomalyRecordInput = Readonly<{
  key: string;
  reason: "request_burst" | "manual_review" | "unknown";
  summary?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type SharedAuditAnomalyRecordResult = Readonly<{
  recorded: false;
  persisted: false;
  externalServiceCalled: false;
}>;

export type SharedDedupeInput = Readonly<{
  key: string;
  scope: "request" | "beacon" | "audit" | "job" | "unknown";
  ttlSeconds?: number;
}>;

export type SharedDedupeResult = Readonly<{
  key: string;
  duplicate: boolean;
  persisted: boolean;
  resetAtEpochMs: number | null;
}>;

export type SharedBeaconDedupeInput = Readonly<{
  beaconId: string;
  ipHash: string | null;
  windowSeconds: number;
}>;

export type SharedBeaconDedupeStateInput = Readonly<{
  beaconId: string;
  ipHash: string | null;
}>;

export type SharedBeaconDedupeResetInput = Readonly<{
  beaconId: string;
  ipHash?: string | null;
  reason: "manual_admin" | "test_cleanup" | "pilot_fallback" | "unknown";
}>;

export type SharedSignalInput = Readonly<{
  signalType: string;
  key: string;
  summary?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type SharedSignalResult = Readonly<{
  recorded: false;
  persisted: false;
  externalServiceCalled: false;
}>;

export type SharedStoreModeResult = Readonly<{
  mode: SharedStoreMode;
  enabled: boolean;
  productionReady: boolean;
}>;

export interface SharedStoreAdapter {
  incrementRateLimit(input: SharedRateLimitInput): Promise<PlatformOperationResult<SharedRateLimitResult>>;
  getRateLimitState(input: SharedRateLimitStateInput): Promise<PlatformOperationResult<SharedRateLimitResult>>;
  resetRateLimit(input: SharedRateLimitResetInput): Promise<PlatformOperationResult<SharedRateLimitResetResult>>;
  writeAuditEvent(input: SharedAuditEventInput): Promise<PlatformOperationResult<{ written: false; externalServiceCalled: false }>>;
  recordAuditAnomaly(input: SharedAuditAnomalyRecordInput): Promise<PlatformOperationResult<SharedAuditAnomalyRecordResult>>;
  incrementAuditAnomalyCounter(input: SharedAuditAnomalyCounterInput): Promise<PlatformOperationResult<SharedAuditAnomalyResult>>;
  getAuditAnomalyState(input: SharedAuditAnomalyStateInput): Promise<PlatformOperationResult<SharedAuditAnomalyResult>>;
  resetAuditAnomalyState(input: SharedAuditAnomalyResetInput): Promise<PlatformOperationResult<SharedAuditAnomalyResult>>;
  dedupeEvent(input: SharedDedupeInput): Promise<PlatformOperationResult<SharedDedupeResult>>;
  dedupeBeacon(key: string): Promise<PlatformOperationResult<SharedDedupeResult>>;
  dedupeBeaconSignal(input: SharedBeaconDedupeInput): Promise<PlatformOperationResult<SharedDedupeResult>>;
  getBeaconDedupeState(input: SharedBeaconDedupeStateInput): Promise<PlatformOperationResult<SharedDedupeResult>>;
  resetBeaconDedupeState(input: SharedBeaconDedupeResetInput): Promise<PlatformOperationResult<SharedDedupeResult>>;
  recordBeaconSignal(input: SharedSignalInput): Promise<PlatformOperationResult<SharedSignalResult>>;
  recordAnomalySignal(input: SharedSignalInput): Promise<PlatformOperationResult<SharedSignalResult>>;
  getHealth(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>>;
  getMode(): Promise<PlatformOperationResult<SharedStoreModeResult>>;
  healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>>;
}

export class NoopSharedStoreAdapter implements SharedStoreAdapter {
  readonly adapterName = "NoopSharedStoreAdapter";

  async incrementRateLimit(input: SharedRateLimitInput): Promise<PlatformOperationResult<SharedRateLimitResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_rate_limit_change", {
      key: input.key,
      count: null,
      limited: false,
      enforcementApplied: false,
      resetAtEpochMs: null,
    });
  }

  async getRateLimitState(input: SharedRateLimitStateInput): Promise<PlatformOperationResult<SharedRateLimitResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_rate_limit_state", {
      key: input.key,
      count: null,
      limited: false,
      enforcementApplied: false,
      resetAtEpochMs: null,
    });
  }

  async resetRateLimit(input: SharedRateLimitResetInput): Promise<PlatformOperationResult<SharedRateLimitResetResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_rate_limit_reset", {
      key: input.key,
      resetApplied: false,
      persisted: false,
    });
  }

  async writeAuditEvent(_input: SharedAuditEventInput): Promise<PlatformOperationResult<{ written: false; externalServiceCalled: false }>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_audit_write", {
      written: false,
      externalServiceCalled: false,
    });
  }

  async recordAuditAnomaly(_input: SharedAuditAnomalyRecordInput): Promise<PlatformOperationResult<SharedAuditAnomalyRecordResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_audit_anomaly_record", {
      recorded: false,
      persisted: false,
      externalServiceCalled: false,
    });
  }

  async incrementAuditAnomalyCounter(input: SharedAuditAnomalyCounterInput): Promise<PlatformOperationResult<SharedAuditAnomalyResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_audit_anomaly_counter", {
      key: input.key,
      count: null,
      threshold: input.threshold,
      anomalyDetected: false,
      recorded: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async getAuditAnomalyState(input: SharedAuditAnomalyStateInput): Promise<PlatformOperationResult<SharedAuditAnomalyResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_audit_anomaly_state", {
      key: input.key,
      count: null,
      threshold: null,
      anomalyDetected: false,
      recorded: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async resetAuditAnomalyState(input: SharedAuditAnomalyResetInput): Promise<PlatformOperationResult<SharedAuditAnomalyResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_audit_anomaly_reset", {
      key: input.key,
      count: null,
      threshold: null,
      anomalyDetected: false,
      recorded: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async dedupeEvent(input: SharedDedupeInput): Promise<PlatformOperationResult<SharedDedupeResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_dedupe_write", {
      key: input.key,
      duplicate: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async dedupeBeacon(key: string): Promise<PlatformOperationResult<SharedDedupeResult>> {
    return this.dedupeEvent({ key, scope: "beacon" });
  }

  async dedupeBeaconSignal(input: SharedBeaconDedupeInput): Promise<PlatformOperationResult<SharedDedupeResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_beacon_dedupe", {
      key: `${input.beaconId}:${input.ipHash ?? "unknown"}`,
      duplicate: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async getBeaconDedupeState(input: SharedBeaconDedupeStateInput): Promise<PlatformOperationResult<SharedDedupeResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_beacon_dedupe_state", {
      key: `${input.beaconId}:${input.ipHash ?? "unknown"}`,
      duplicate: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async resetBeaconDedupeState(input: SharedBeaconDedupeResetInput): Promise<PlatformOperationResult<SharedDedupeResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_beacon_dedupe_reset", {
      key: `${input.beaconId}:${input.ipHash ?? "all"}`,
      duplicate: false,
      persisted: false,
      resetAtEpochMs: null,
    });
  }

  async recordBeaconSignal(_input: SharedSignalInput): Promise<PlatformOperationResult<SharedSignalResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_beacon_signal_write", {
      recorded: false,
      persisted: false,
      externalServiceCalled: false,
    });
  }

  async recordAnomalySignal(_input: SharedSignalInput): Promise<PlatformOperationResult<SharedSignalResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_anomaly_signal_write", {
      recorded: false,
      persisted: false,
      externalServiceCalled: false,
    });
  }

  async getHealth(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>> {
    return this.healthCheck();
  }

  async getMode(): Promise<PlatformOperationResult<SharedStoreModeResult>> {
    return noopResult(this.adapterName, "shared_store_not_configured_no_runtime_mode_switch", {
      mode: "noop",
      enabled: false,
      productionReady: false,
    });
  }

  async healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>> {
    return noopHealth(this.adapterName);
  }
}

export const noopSharedStoreAdapter = new NoopSharedStoreAdapter();
