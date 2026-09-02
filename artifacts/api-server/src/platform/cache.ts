import { noopHealth, noopResult, type PlatformOperationResult } from "./platformTypes";

export type CacheEntry<T = unknown> = Readonly<{
  key: string;
  value: T | null;
  hit: boolean;
  stored: false;
}>;

export interface CacheAdapter {
  get<T = unknown>(key: string): Promise<PlatformOperationResult<CacheEntry<T>>>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<PlatformOperationResult<CacheEntry<T>>>;
  delete(key: string): Promise<PlatformOperationResult<{ key: string; deleted: false }>>;
  healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>>;
}

export class NoopCacheAdapter implements CacheAdapter {
  readonly adapterName = "NoopCacheAdapter";

  async get<T = unknown>(key: string): Promise<PlatformOperationResult<CacheEntry<T>>> {
    return noopResult(this.adapterName, "cache_not_configured_no_read", {
      key,
      value: null,
      hit: false,
      stored: false,
    });
  }

  async set<T = unknown>(key: string, _value: T, _ttlSeconds?: number): Promise<PlatformOperationResult<CacheEntry<T>>> {
    return noopResult(this.adapterName, "cache_not_configured_no_write", {
      key,
      value: null,
      hit: false,
      stored: false,
    });
  }

  async delete(key: string): Promise<PlatformOperationResult<{ key: string; deleted: false }>> {
    return noopResult(this.adapterName, "cache_not_configured_no_delete", {
      key,
      deleted: false,
    });
  }

  async healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>> {
    return noopHealth(this.adapterName);
  }
}

export const noopCacheAdapter = new NoopCacheAdapter();
