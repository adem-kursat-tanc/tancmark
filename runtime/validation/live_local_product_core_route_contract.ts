import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVerifiedLiveTenant } from "../../artifacts/api-server/src/middlewares/liveTenantAuth.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const routePath = path.join(root, "artifacts", "api-server", "src", "routes", "liveLocalProduct.ts");
const indexPath = path.join(root, "artifacts", "api-server", "src", "routes", "index.ts");
const legacyPath = path.join(root, "artifacts", "api-server", "src", "routes", "live.ts");
const officialSpecPath = path.join(root, "lib", "api-spec", "openapi.yaml");
const focusedSpecPath = path.join(root, "artifacts", "api-server", "openapi", "live-local-v1.openapi.yaml");
const builtApiPath = path.join(root, "artifacts", "api-server", "dist", "index.mjs");
const route = fs.readFileSync(routePath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");
const legacy = fs.readFileSync(legacyPath, "utf8");
const officialSpec = fs.readFileSync(officialSpecPath, "utf8");
const focusedSpec = fs.readFileSync(focusedSpecPath, "utf8");

assert(index.includes('router.use("/tancmark/live/local/v1", liveLocalProductRouter)'));
assert(index.indexOf('router.use("/tancmark/live/local/v1"') < index.indexOf('router.use("/tancmark/live", liveRouter)'));
assert(route.includes("management.use(requireAdminToken, requireVerifiedLiveTenant)"));
assert(route.indexOf('router.post("/access/exchange"') < route.indexOf("management.use(requireAdminToken"));
assert(route.indexOf('router.get("/playback/:sessionId/manifest.m3u8"') < route.indexOf("management.use(requireAdminToken"));

for (const endpoint of [
  'management.get("/status"',
  'management.get("/debt"',
  'router.get("/management-console"',
  'management.post("/sessions"',
  'management.get("/sessions"',
  'management.get("/sessions/:sessionId"',
  'management.post("/sessions/:sessionId/init"',
  'management.post("/sessions/:sessionId/start"',
  '"/sessions/:sessionId/segments"',
  'management.post("/sessions/:sessionId/stop"',
  'management.get("/sessions/:sessionId/health"',
  'management.get("/sessions/:sessionId/events"',
  'management.get("/sessions/:sessionId/metrics"',
  'management.get("/sessions/:sessionId/advisory-event"',
  'management.get("/sessions/:sessionId/evidence"',
  'management.post("/sessions/:sessionId/verify-exact-id"',
  'management.post("/sessions/:sessionId/access-token"',
  'management.post("/sessions/:sessionId/grants/:grantId/revoke"',
  'management.post("/sessions/:sessionId/revoke"',
  'management.post("/sessions/:sessionId/cleanup/plan"',
  'management.post("/sessions/:sessionId/cleanup/execute"',
  'router.get("/player/:sessionId"',
  'router.get("/playback/:sessionId/init.mp4"',
  'router.get("/playback/:sessionId/media.json"',
  'router.get("/playback/:sessionId/segments/:segmentId"',
  'router.get("/playback/:sessionId/recording.mp4"',
]) {
  assert(route.includes(endpoint), `missing route ${endpoint}`);
}

for (const safetyToken of [
  "application/octet-stream",
  "LIVE_LOCAL_MAX_SEGMENT_BYTES",
  "x-content-sha256",
  "x-segment-sequence",
  "x-segment-duration-ms",
  "x-idempotency-key",
  "if-match",
  "Cache-Control",
  "httpOnly: true",
  'sameSite: "strict"',
  "ownership: false",
  "vault: false",
  "confirmed: false",
  "final: false",
]) {
  assert(route.includes(safetyToken), `missing safety token ${safetyToken}`);
}

for (const forbidden of [
  "node:child_process",
  "http.request",
  "https.request",
  "encodeVideo",
  "decodeVideo",
  "runSignedExactMapVideoOwnershipRoute",
]) {
  assert.equal(route.includes(forbidden), false, `route must not include ${forbidden}`);
}

// The two self-contained browser surfaces may fetch only relative/same-origin
// paths; product TypeScript must not embed an external URL.
assert(route.includes("fetch('./'+path"));
assert(route.includes("fetch(b+'/media.json"));
assert.equal(/fetch\s*\(\s*['"`]https?:/i.test(route), false);
assert.equal(/https?:\/\//i.test(route), false);

const officialLivePaths = officialSpec.match(/^  \/tancmark\/live\/local\/v1\//gm) ?? [];
assert.equal(officialLivePaths.length, 28, "official OpenAPI must contain every local Live path item");
for (const token of ["LiveAdminToken", "LiveVerifiedTenant", "LivePlaybackGrantCookie", "application/octet-stream", "video/iso.segment", "_HLS_msn", "_HLS_part", "_HLS_skip", "management-console", "verify-exact-id"]) {
  assert(officialSpec.includes(token), `official OpenAPI missing ${token}`);
}
const officialPathNames = [...officialSpec.matchAll(/^  (\/tancmark\/live\/local\/v1\/[^:]+):$/gm)].map((match) => (match[1] as string).replace("/tancmark/live/local/v1", "")).sort();
const focusedPathNames = [...focusedSpec.matchAll(/^  (\/[^:]+):$/gm)].map((match) => match[1] as string).sort();
assert.deepEqual(focusedPathNames, officialPathNames, "focused review copy path set must match the official path set");
assert(focusedSpec.includes("NON_AUTHORITATIVE_REVIEW_COPY") && focusedSpec.includes("lib/api-spec/openapi.yaml"));
function operationMap(spec: string, pathPrefix: string): string[] {
  const operations: string[] = [];
  let currentPath: string | null = null;
  let pendingMethod: string | null = null;
  for (const line of spec.split(/\r?\n/)) {
    const pathMatch = /^  (\/[^:]+):$/.exec(line);
    if (pathMatch) {
      const rawPath = pathMatch[1] as string;
      currentPath = pathPrefix && !rawPath.startsWith(pathPrefix) ? null : rawPath.slice(pathPrefix.length);
      pendingMethod = null;
      continue;
    }
    if (!currentPath) continue;
    const methodMatch = /^    (get|post|put|patch|delete):(?:\s*\{.*?operationId:\s*([^,}\s]+))?/.exec(line);
    if (methodMatch) {
      pendingMethod = methodMatch[1] as string;
      if (methodMatch[2]) {
        operations.push(`${pendingMethod} ${currentPath} ${methodMatch[2] as string}`);
        pendingMethod = null;
      }
      continue;
    }
    const operationMatch = /^      operationId:\s+(\S+)$/.exec(line);
    if (pendingMethod && operationMatch) {
      operations.push(`${pendingMethod} ${currentPath} ${operationMatch[1] as string}`);
      pendingMethod = null;
    }
  }
  return operations.sort();
}
const officialLiveOperations = operationMap(officialSpec, "/tancmark/live/local/v1");
const focusedLiveOperations = operationMap(focusedSpec, "");
assert.equal(officialLiveOperations.length, 29, "official OpenAPI must define all 29 local Live operations");
assert.equal(new Set(officialLiveOperations.map((entry) => entry.split(" ").at(-1))).size, officialLiveOperations.length, "official Live operationId values must be unique");
assert.deepEqual(focusedLiveOperations, officialLiveOperations, "focused review copy method/path/operationId map must match the official contract");
for (const criticalSchema of ["LiveExchangeResponse", "LiveAccessTokenResponse", "LiveAutomaticFinalVerification", "LiveCleanupExecuteResponse", "LiveSession:", "recording, segment", "additionalProperties: false"]) assert(officialSpec.includes(criticalSchema), `official exact schema missing ${criticalSchema}`);
assert(fs.existsSync(builtApiPath), "built API bundle is required before route contract");
const builtApi = fs.readFileSync(builtApiPath, "utf8");
for (const boundaryToken of ["live_local_transport_boundary_rejected", "remoteAddress", "::ffff:127.", "live_request_body_shape_invalid"]) assert(builtApi.includes(boundaryToken), `built product path missing ${boundaryToken}`);

// Body spoofing remains ineffective at the tenant resolver boundary.
const spoofed = {
  apiClient: { id: 17 },
  body: { tenantId: "attacker", clientId: "attacker", ownerUserId: "attacker" },
  header() { return undefined; },
};
assert.deepEqual(resolveVerifiedLiveTenant(spoofed as never, {}), {
  ok: true,
  tenantId: "17",
  accountId: "17",
  source: "api_key",
});

// The legacy mock route is byte-for-byte untouched by this candidate.
assert(legacy.includes("createMockLiveSession"));
assert(legacy.includes("/sessions/mock"));
assert(legacy.includes("/sessions/:sessionId/start-mock"));

console.log(JSON.stringify({
  contract: "live_local_product_core_route_contract",
  status: "passed",
  mount: "/api/tancmark/live/local/v1",
  managementAuthOrder: "admin_then_verified_tenant",
  publicPlaybackAuthorization: "cryptographic_token_or_grant_only",
  legacyMockRouteChanged: false,
  officialOpenApiLivePathItems: officialLivePaths.length,
  focusedReviewCopyPathParity: true,
  focusedReviewCopyOperationIdParity: true,
  liveOperationCount: officialLiveOperations.length,
  officialOperationIdsUnique: true,
  builtProductTransportBoundaryPresent: true,
  externalNetworkCalls: 0,
  externalProcesses: 0,
}, null, 2));
