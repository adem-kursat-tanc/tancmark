import type { DiscoveryConfig } from "../config";
import type {
  DiscoveryApiCall,
  DiscoveryDecisionRole,
  DiscoveryJobRecord,
  DiscoveryLayer,
  DiscoveryMediaAsset,
  DiscoveryProviderName,
  DiscoveryResult,
} from "../types";

export interface DiscoveryProviderInput {
  job: DiscoveryJobRecord;
  assets: DiscoveryMediaAsset[];
  metadataQueries: string[];
  telegramQueries: string[];
  forceFailure?: boolean;
  forceNoResult?: boolean;
}

export interface DiscoveryProviderRequest {
  provider: DiscoveryProviderName;
  endpointName: string;
  layer: DiscoveryLayer;
  payloadType: "hash" | "metadata" | "query" | "signed_url" | "fingerprint";
  sentOriginalContent: false;
  unitCount: number;
  privacySummary: {
    sentHashOnly: boolean;
    sentMetadataOnly: boolean;
    sentSignedUrl: boolean;
    sentFingerprintOnly: boolean;
  };
}

export interface DiscoveryProviderExecution {
  apiCall: DiscoveryApiCall;
  raw: Record<string, unknown>;
  results: DiscoveryResult[];
}

export interface DiscoveryProvider {
  name: DiscoveryProviderName;
  layer: DiscoveryLayer;
  endpointName: string;
  estimateCost(input: DiscoveryProviderInput, config: DiscoveryConfig): number;
  buildRequest(input: DiscoveryProviderInput, config: DiscoveryConfig): DiscoveryProviderRequest;
  execute(input: DiscoveryProviderInput, config: DiscoveryConfig): Promise<DiscoveryProviderExecution>;
  executeMock(input: DiscoveryProviderInput, config: DiscoveryConfig): DiscoveryProviderExecution;
  normalizeResult(
    raw: Record<string, unknown>,
    input: DiscoveryProviderInput,
    apiCallId: string,
  ): DiscoveryResult[];
  getDecisionRole(): DiscoveryDecisionRole;
  getPrivacyPayloadSummary(
    input: DiscoveryProviderInput,
    config: DiscoveryConfig,
  ): DiscoveryProviderRequest["privacySummary"] & { sentOriginalContent: false };
}
