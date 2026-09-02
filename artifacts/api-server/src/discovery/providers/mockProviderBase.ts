import { createHash } from "node:crypto";
import type { DiscoveryConfig } from "../config";
import {
  DISCOVERY_DECISION_ROLE,
  type DiscoveryLayer,
  type DiscoveryProviderName,
  type DiscoveryResult,
  type DiscoveryResultType,
} from "../types";
import type {
  DiscoveryProvider,
  DiscoveryProviderExecution,
  DiscoveryProviderInput,
  DiscoveryProviderRequest,
} from "./DiscoveryProvider";

interface ProviderDefinition {
  name: DiscoveryProviderName;
  layer: DiscoveryLayer;
  endpointName: string;
  resultType: DiscoveryResultType;
  platform: string;
  title: string;
  snippet: string;
  confidence: number;
  unitCount(input: DiscoveryProviderInput): number;
  payloadType: DiscoveryProviderRequest["payloadType"];
  matchReason: string;
}

function now(): string {
  return new Date().toISOString();
}

function hashId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
}

function safeConfidence(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function urlFor(def: ProviderDefinition, input: DiscoveryProviderInput): string {
  const suffix = createHash("sha256")
    .update(`${input.job.id}:${def.name}:${input.job.title ?? ""}`)
    .digest("hex")
    .slice(0, 10);
  if (def.name === "apify_telegram") return `https://t.me/mock_channel/${suffix}`;
  if (def.name === "acrcloud") return `https://audio.example.invalid/match/${suffix}`;
  if (def.name === "dataforseo") return `https://visual.example.invalid/match/${suffix}`;
  if (def.name === "exa") return `https://similar.example.invalid/content/${suffix}`;
  return `https://search.example.invalid/result/${suffix}`;
}

function privacyFor(
  payloadType: DiscoveryProviderRequest["payloadType"],
): DiscoveryProviderRequest["privacySummary"] & { sentOriginalContent: false } {
  return {
    sentOriginalContent: false,
    sentHashOnly: payloadType === "hash",
    sentMetadataOnly: payloadType === "metadata" || payloadType === "query",
    sentSignedUrl: payloadType === "signed_url",
    sentFingerprintOnly: payloadType === "fingerprint",
  };
}

export function createMockFirstDiscoveryProvider(def: ProviderDefinition): DiscoveryProvider {
  return {
    name: def.name,
    layer: def.layer,
    endpointName: def.endpointName,
    estimateCost(input, config) {
      return Math.round(def.unitCount(input) * config.providerUnitCostsUsd[def.name] * 1_000_000) / 1_000_000;
    },
    buildRequest(input, _config) {
      const payloadType =
        def.payloadType === "signed_url" &&
        !(input.job.userConfirmedExternalSearch && input.job.allowSignedUrlForVisualSearch)
          ? "hash"
          : def.payloadType;
      const privacySummary = privacyFor(payloadType);
      return {
        provider: def.name,
        endpointName: def.endpointName,
        layer: def.layer,
        payloadType,
        sentOriginalContent: false,
        unitCount: def.unitCount(input),
        privacySummary,
      };
    },
    async execute(input, config) {
      if (input.forceFailure) {
        const request = this.buildRequest(input, config);
        const createdAt = now();
        return {
          apiCall: {
            id: hashId("call", [input.job.id, def.name, "failed"]),
            jobId: input.job.id,
            provider: def.name,
            layer: def.layer,
            endpointName: def.endpointName,
            requestId: hashId("req", [input.job.id, def.name, "failed"]),
            status: "failed",
            realApiEnabled: config.realApiEnabled,
            unitCount: request.unitCount,
            estimatedCostUsd: this.estimateCost(input, config),
            actualCostUsd: 0,
            retryCount: config.providerRetryLimit,
            latencyMs: Math.min(config.providerTimeoutMs, 25),
            externalRequestRef: null,
            externalResultRef: null,
            errorCode: "mock_provider_failure",
            errorMessage: `${def.name} mock failure requested`,
            sentOriginalContent: false,
            sentHashOnly: request.privacySummary.sentHashOnly,
            sentMetadataOnly: request.privacySummary.sentMetadataOnly,
            sentSignedUrl: request.privacySummary.sentSignedUrl,
            sentFingerprintOnly: request.privacySummary.sentFingerprintOnly,
            mocked: false,
            skipped: false,
            createdAt,
            completedAt: now(),
          },
          raw: { ok: false, provider: def.name, error: "mock_provider_failure" },
          results: [],
        };
      }
      return this.executeMock(input, config);
    },
    executeMock(input, config) {
      const request = this.buildRequest(input, config);
      const createdAt = now();
      const apiCallId = hashId("call", [input.job.id, def.name, "mocked"]);
      const raw = {
        ok: true,
        provider: def.name,
        mocked: true,
        externalApiCalled: false,
        url: input.forceNoResult ? null : urlFor(def, input),
        title: def.title,
        snippet: def.snippet,
        confidence: def.confidence,
        noResult: input.forceNoResult === true,
      };
      const execution: DiscoveryProviderExecution = {
        apiCall: {
          id: apiCallId,
          jobId: input.job.id,
          provider: def.name,
          layer: def.layer,
          endpointName: def.endpointName,
          requestId: hashId("req", [input.job.id, def.name, "mocked"]),
          status: "mocked",
          realApiEnabled: config.realApiEnabled && config.credentialsAvailable[def.name],
          unitCount: request.unitCount,
          estimatedCostUsd: this.estimateCost(input, config),
          actualCostUsd: 0,
          retryCount: 0,
          latencyMs: 4,
          externalRequestRef: null,
          externalResultRef: null,
          errorCode: null,
          errorMessage: null,
          sentOriginalContent: false,
          sentHashOnly: request.privacySummary.sentHashOnly,
          sentMetadataOnly: request.privacySummary.sentMetadataOnly,
          sentSignedUrl: request.privacySummary.sentSignedUrl,
          sentFingerprintOnly: request.privacySummary.sentFingerprintOnly,
          mocked: true,
          skipped: false,
          createdAt,
          completedAt: now(),
        },
        raw,
        results: input.forceNoResult ? [] : this.normalizeResult(raw, input, apiCallId),
      };
      return execution;
    },
    normalizeResult(raw, input, apiCallId) {
      const url = typeof raw["url"] === "string" ? raw["url"] : urlFor(def, input);
      const createdAt = now();
      const result: DiscoveryResult = {
        id: hashId("result", [apiCallId, url]),
        jobId: input.job.id,
        provider: def.name,
        layer: def.layer,
        resultType: def.resultType,
        url,
        platform: def.platform,
        title: typeof raw["title"] === "string" ? raw["title"] : def.title,
        snippet: typeof raw["snippet"] === "string" ? raw["snippet"] : def.snippet,
        channelName: def.name === "apify_telegram" ? "mock_channel" : null,
        messageId: def.name === "apify_telegram" ? url.split("/").pop() ?? null : null,
        fileName: null,
        confidence: safeConfidence(
          typeof raw["confidence"] === "number" ? raw["confidence"] : def.confidence,
        ),
        matchReason: def.matchReason,
        supportOnly: true,
        decisionRole: DISCOVERY_DECISION_ROLE,
        canOpenVault: false,
        confirmed: false,
        final: false,
        requiresTancMarkVerification: true,
        normalizedPayloadJson: {
          provider: def.name,
          mocked: true,
          externalApiCalled: false,
          decisionBoundary:
            "candidate_url_requires_local_tancmark_watermark_id_verification",
        },
        createdAt,
      };
      return [result];
    },
    getDecisionRole() {
      return DISCOVERY_DECISION_ROLE;
    },
    getPrivacyPayloadSummary(input, config) {
      return {
        ...this.buildRequest(input, config).privacySummary,
        sentOriginalContent: false,
      };
    },
  };
}
