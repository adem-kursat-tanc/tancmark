# TancMark API Examples

These examples follow `lib/api-spec/openapi.yaml` and the mounted Express middleware. Replace every angle-bracket placeholder locally. Never place real tokens, passwords, private IDs, keys, registry rows, or paths in source control.

The default examples use `http://127.0.0.1:5000/api`. Plain HTTP is suitable only on the same computer. Remote Live or C2PA access requires an actually encrypted TLS socket.

Set a base URL for your shell:

PowerShell:

```powershell
$base = 'http://127.0.0.1:5000/api'
$admin = '<ADMIN_TOKEN>'
$tenant = '<TENANT_ID>'
```

Bash:

```bash
base='http://127.0.0.1:5000/api'
admin='<ADMIN_TOKEN>'
tenant='<TENANT_ID>'
```

## Health

```sh
curl --fail http://127.0.0.1:5000/api/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Text

### Seal a product-safe text working copy

The source route requires a verified sealing principal. Use a valid server-issued `x-api-key`, or use an admin token with an existing registry client selected by `clientId`/`TANCMARK_ADMIN_DEFAULT_CLIENT_ID`. A body-supplied tenant is always rejected.

PowerShell with a verified API client:

```powershell
$headers = @{ 'x-api-key' = '<API_KEY>' }
$body = @{ text = 'A sample document to protect.'; aiTrapMode = 'off' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/aegis/protect-text" -Headers $headers -ContentType 'application/json' -Body $body
```

Bash:

```bash
curl --fail-with-body -X POST "$base/aegis/protect-text" \
  -H 'content-type: application/json' \
  -H 'x-api-key: <API_KEY>' \
  --data '{"text":"A sample document to protect.","aiTrapMode":"off"}'
```

The response contains `protectedText`, `variantHash`, `protectionHash`, `replacementCount`, `replacements`, and layer summaries. Hashes and protected text are deterministic for the authorized client and input; this guide does not publish a fabricated value.

### Recover and analyze a received text

`analyze-text` is administrator-gated. The candidate list bounds attribution work; it is not ownership authority by itself.

PowerShell:

```powershell
$headers = @{ 'x-admin-token' = $admin }
$body = @{
  text = 'Received working-copy text.'
  scanHoneytokens = $true
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/aegis/analyze-text" -Headers $headers -ContentType 'application/json' -Body $body
```

Bash:

```bash
curl --fail-with-body -X POST "$base/aegis/analyze-text" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  --data '{"text":"Received working-copy text.","scanHoneytokens":true}'
```

Read `primarySuspect`, `vaultVerification`, channel scores, and any tiered decision together. Similarity or a candidate alone is not an exact registry/signature verification.

## Image, audio, and standalone video

The current OpenAPI does not provide a public product-grade image seal/recover pair or an audio product pair. The product bundle disables audio/video lab paths. Do not invent an HTTP request for those operations.

Use the published validation programs after installing the verified media runtime:

```sh
pnpm run test:physical-text-image
pnpm run test:physical-audio
pnpm run test:media-runtime
```

Direct video laboratory routes present in OpenAPI are development contracts. In `dist-product`, a request such as `POST /api/aegis/video-lab/encode` returns HTTP `410` with safety fields false. The direct canonical reader is also `410`; only the verified server-internal Live chain can call it.

## Local protected Live

The following sequence uses the single-tenant fallback: `x-admin-token` plus an exact `x-tancmark-live-tenant-id`. An authenticated API client can instead be the tenant authority; a conflicting tenant header is hidden as not found.

All revision values and ID placeholders must come from the immediately preceding response. Before the start and stop commands, assign that numeric value to the Bash `revision` variable. Do not reuse an idempotency key with different content.

### 1. Check readiness

```bash
curl --fail-with-body "$base/tancmark/live/local/v1/status" \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant"
```

PowerShell:

```powershell
$liveHeaders = @{ 'x-admin-token' = $admin; 'x-tancmark-live-tenant-id' = $tenant }
Invoke-RestMethod -Uri "$base/tancmark/live/local/v1/status" -Headers $liveHeaders
```

Resolve every false readiness item before creating a protected session.

### 2. Create a protected session

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{"legalHold":false,"protectionMode":"PROTECTED_TANCMARK"}'
```

The response is `{ "session": ... }`. Save `session.sessionId` and `session.revision`. The server creates identity authority; the body must not contain an expected ID, tenant, registry row, map, or signature.

### 3. Upload the H.264/AAC CMAF initialization segment

Bash:

```bash
session='<SESSION_ID>'
init_sha=$(sha256sum ./init.mp4 | cut -d' ' -f1)
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/init" \
  -H 'content-type: application/octet-stream' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: init-example-0001' \
  -H "x-content-sha256: $init_sha" \
  --data-binary @./init.mp4
```

PowerShell:

```powershell
$session = '<SESSION_ID>'
$initSha = (Get-FileHash .\init.mp4 -Algorithm SHA256).Hash.ToLowerInvariant()
$headers = $liveHeaders.Clone()
$headers['x-idempotency-key'] = 'init-example-0001'
$headers['x-content-sha256'] = $initSha
Invoke-RestMethod -Method Post -Uri "$base/tancmark/live/local/v1/sessions/$session/init" -Headers $headers -ContentType 'application/octet-stream' -InFile .\init.mp4
```

The file must be a real validated AVC fragmented-MP4 initialization segment. Arbitrary bytes are rejected.

### 4. Start the session

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/start" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: start-example-0001' \
  --data "{\"expectedRevision\":${revision:?set revision from the init response}}"
```

### 5. Append each ordered CMAF fragment

Bash example for sequence zero:

```bash
segment_sha=$(sha256sum ./segment-0.m4s | cut -d' ' -f1)
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/segments" \
  -H 'content-type: application/octet-stream' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: segment-example-0000' \
  -H "x-content-sha256: $segment_sha" \
  -H 'x-segment-sequence: 0' \
  -H 'x-segment-duration-ms: 4000' \
  --data-binary @./segment-0.m4s
```

The server parses the fragment and cross-checks duration; the parsed duration is authoritative. Wait for the protected response before publishing it. Never fall back to unwatermarked bytes after a worker or validation failure.

### 6. Stop and finalize

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/stop" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: stop-example-0001' \
  --data "{\"expectedRevision\":${revision:?set revision from the preceding response}}"
```

The response contains the session, stop receipt, support evidence, and redacted final verification. `VIDEO_LAYER_VAULT` is possible only when physical exact recovery, registry, tenant/account, signature, and unique-record checks all pass.

### 7. Read the completed exact decision

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/verify-exact-id" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{}'
```

The endpoint does not accept an expected ID. It returns the final result already produced from the server-owned binding. Before completion it returns `409` rather than guessing.

### 8. Issue browser playback access

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/access-token" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{"viewerSubject":"viewer-001","ttlSeconds":120,"resourceScopes":["player","manifest","init","media-json","segment"]}'
```

Exchange the returned token once on the same origin. The exchange response sets a session-specific `HttpOnly`, `SameSite=Strict` cookie; the cookie value is not returned in JSON.

```bash
curl --fail-with-body -c ./tancmark-cookie.txt -X POST "$base/tancmark/live/local/v1/access/exchange" \
  -H 'content-type: application/json' \
  --data '{"token":"<ACCESS_TOKEN>"}'
```

Use a protected cookie jar and delete it after the session. Do not log the exchange token or cookie.

## C2PA

C2PA requests require the same admin and verified-tenant headers. `assetName` and `outputName` are names inside the configured tenant root, not arbitrary paths.

### Inspect or verify

```bash
curl --fail-with-body -X POST "$base/tancmark/c2pa/v1/inspect" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{"assetName":"working-copy.png"}'
```

Replace `inspect` with `verify` for the verification operation. Both return a redacted C2PA result. Status and certificate trust are separate. `VALID_BUT_UNTRUSTED` can be a cryptographically valid local test manifest without public trust.

### Create and embed a new manifest

```bash
curl --fail-with-body -X POST "$base/tancmark/c2pa/v1/sign-embed" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{
    "assetName":"working-copy.png",
    "outputName":"working-copy-signed.png",
    "intent":"CREATE",
    "digitalSourceType":"http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation",
    "registryRecordId":"record-001",
    "recordVersion":"1",
    "algorithmVersion":"1",
    "createdAt":"2026-09-01T12:00:00.000Z"
  }'
```

Use the real current UTC timestamp. The example timestamp only demonstrates the required ISO shape. `outputName` must not already exist. The input is never overwritten.

For `EDIT` or `UPDATE`, omit `digitalSourceType`; including it is an error. Raw keys, certificates, paths, tenant/client IDs, exact IDs, registry rows, maps, trust anchors, TSA URLs, and remote-manifest URLs are forbidden.

## Error and safety behavior

Common status meanings:

- `400`: body, media shape, hash, or C2PA policy is invalid.
- `401`: admin token, API key, or playback grant is absent or invalid.
- `403`: transport or identity-spoofing boundary rejected the call.
- `404`: route/record is absent, or a wrong tenant is intentionally hidden.
- `409`: state revision, idempotency, readiness, ambiguity, or finalization conflict.
- `410`: laboratory/direct reader route is deliberately disabled in the product bundle.
- `413`: request or media part is too large.
- `503`: required token/key/runtime configuration is unavailable.
- `507`: configured storage or free-space gate failed.

Do not retry a non-idempotent request with new content under the same idempotency key. Do not turn any error into an ownership result. See [Troubleshooting](TROUBLESHOOTING.md).
