import { noopHealth, noopResult, type PlatformOperationResult } from "./platformTypes";

export type SecretLookupResult = Readonly<{
  name: string;
  exists: false;
  value: null;
  plaintextReturned: false;
}>;

export interface SecretsAdapter {
  getSecret(name: string): Promise<PlatformOperationResult<SecretLookupResult>>;
  hasSecret(name: string): Promise<PlatformOperationResult<SecretLookupResult>>;
  healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>>;
}

export class NoopSecretsAdapter implements SecretsAdapter {
  readonly adapterName = "NoopSecretsAdapter";

  async getSecret(name: string): Promise<PlatformOperationResult<SecretLookupResult>> {
    return noopResult(this.adapterName, "secrets_not_configured_no_secret_returned", {
      name,
      exists: false,
      value: null,
      plaintextReturned: false,
    });
  }

  async hasSecret(name: string): Promise<PlatformOperationResult<SecretLookupResult>> {
    return noopResult(this.adapterName, "secrets_not_configured_no_secret_presence_check", {
      name,
      exists: false,
      value: null,
      plaintextReturned: false,
    });
  }

  async healthCheck(): Promise<PlatformOperationResult<{ health: "not_configured"; mode: "noop" }>> {
    return noopHealth(this.adapterName);
  }
}

export const noopSecretsAdapter = new NoopSecretsAdapter();
