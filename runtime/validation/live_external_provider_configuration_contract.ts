import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getUnconfiguredLiveProviderAdapters,
  redactExternalProviderConfiguration,
  validateExternalProviderConfigurationShape,
} from "../../artifacts/api-server/src/live/liveExternalProviderAdapterConfig.ts";
import { getLiveExternalIntegrationDebt } from "../../artifacts/api-server/src/live/liveExternalIntegrationDebt.ts";

const schema = JSON.parse(fs.readFileSync(path.resolve("config/live-external-providers.schema.json"), "utf8")) as Record<string, unknown>;
assert.equal(schema["additionalProperties"], false);
const adapters = getUnconfiguredLiveProviderAdapters();
assert.equal(adapters.length, 8);
assert(adapters.every((adapter) => adapter.enabled === false && adapter.failClosed && adapter.userConfigured && adapter.credentialValuesReturned === false));

const accepted = validateExternalProviderConfigurationShape({ provider: "custom_rtmp", endpoint: "rtmps://example.invalid/live", credentialReference: "vault://live/stream-credential" });
const redacted = redactExternalProviderConfiguration(accepted);
assert.equal(JSON.stringify(redacted).includes("example.invalid"), false);
assert.equal(JSON.stringify(redacted).includes("vault://"), false);
assert.equal(redacted["credentialValuesReturned"], false);

for (const rejected of [
  { provider: "custom_rtmp", endpoint: "rtmp://example.invalid/live", credentialReference: "vault://live/credential" },
  { provider: "custom_rtmp", endpoint: "rtmps://user:password@example.invalid/live", credentialReference: "vault://live/credential" },
  { provider: "custom_rtmp", endpoint: "rtmps://example.invalid/live?streamKey=raw", credentialReference: "vault://live/credential" },
  { provider: "custom_rtmp", endpoint: "rtmps://example.invalid/live", credentialReference: "secret=raw-value" },
  { provider: "custom_rtmp", endpoint: "rtmps://example.invalid/live", credentialReference: "raw-value-without-a-secret-store-scheme" },
  { provider: "youtube", endpoint: "https://example.invalid", credentialReference: "vault://live/credential", oauthToken: "raw" },
  { provider: "unknown", endpoint: "https://example.invalid", credentialReference: "vault://live/credential" },
]) assert.throws(() => validateExternalProviderConfigurationShape(rejected));

const debt = getLiveExternalIntegrationDebt();
assert.equal(debt.overallStatus, "EXTERNAL_PROVIDER_INTEGRATIONS_USER_CONFIGURED_NOT_PRODUCT_GAP");
assert.equal(debt.externalNetworkCallsPerformed, 0);
assert.equal(debt.secretsReturned, false);

process.stdout.write(`${JSON.stringify({ contract: "live_external_provider_configuration_contract", status: "passed", providerCount: adapters.length, rawCredentialsRejected: true, redactionPassed: true, failClosed: true, externalNetworkCalls: 0, canonicalStatus: debt.overallStatus }, null, 2)}\n`);
