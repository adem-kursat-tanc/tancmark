import { noopHealth, noopResult, type PlatformOperationResult } from "./platformTypes";

export type StorageObjectInput = Readonly<{
  key: string;
  contentType?: string;
  sizeBytes?: number;
  sourceRef?: string;
}>;

export type StorageObjectResult = Readonly<{
  key: string;
  stored: false;
  body: Uint8Array | null;
  signedReadUrl: string | null;
  externalServiceCalled: false;
}>;

export interface StorageAdapter {
  putObject(input: StorageObjectInput): Promise<PlatformOperationResult<StorageObjectResult>>;
  getObject(key: string): Promise<PlatformOperationResult<StorageObjectResult>>;
  deleteObject(key: string): Promise<PlatformOperationResult<{ key: string; deleted: false; externalServiceCalled: false }>>;
  getSignedReadUrl(key: string, expiresInSeconds?: number): Promise<PlatformOperationResult<StorageObjectResult>>;
  healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>>;
}

export class NoopStorageAdapter implements StorageAdapter {
  readonly adapterName = "NoopStorageAdapter";

  async putObject(input: StorageObjectInput): Promise<PlatformOperationResult<StorageObjectResult>> {
    return noopResult(this.adapterName, "storage_not_configured_no_object_written", {
      key: input.key,
      stored: false,
      body: null,
      signedReadUrl: null,
      externalServiceCalled: false,
    });
  }

  async getObject(key: string): Promise<PlatformOperationResult<StorageObjectResult>> {
    return noopResult(this.adapterName, "storage_not_configured_no_object_read", {
      key,
      stored: false,
      body: null,
      signedReadUrl: null,
      externalServiceCalled: false,
    });
  }

  async deleteObject(key: string): Promise<PlatformOperationResult<{ key: string; deleted: false; externalServiceCalled: false }>> {
    return noopResult(this.adapterName, "storage_not_configured_no_object_deleted", {
      key,
      deleted: false,
      externalServiceCalled: false,
    });
  }

  async getSignedReadUrl(key: string, _expiresInSeconds?: number): Promise<PlatformOperationResult<StorageObjectResult>> {
    return noopResult(this.adapterName, "storage_not_configured_no_signed_url", {
      key,
      stored: false,
      body: null,
      signedReadUrl: null,
      externalServiceCalled: false,
    });
  }

  async healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>> {
    return noopHealth(this.adapterName);
  }
}

export const noopStorageAdapter = new NoopStorageAdapter();
