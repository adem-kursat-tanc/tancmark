# TancMark Operator Guide

This guide covers source verification, installation, local product startup, secrets, PostgreSQL, media and C2PA runtimes, validation, backup, and shutdown. It does not turn laboratory routes into public product APIs and does not configure external streaming providers for you.

## Deployment boundary

The public repository is a self-hosted Node.js/TypeScript reference application. It is not a packaged desktop, mobile, or browser application. The tested local product is single-node. Production TLS, reverse proxy, shared state, worker topology, monitoring, retention, and disaster recovery are operator decisions.

Run the first installation on an isolated host or development account. Do not use customer media, production keys, or a production database for setup testing.

## Verify the source before installation

Clone `https://github.com/adem-kursat-tanc/tancmark` into a short, empty path or extract the GitHub source ZIP into one.

For a clone, record:

```sh
git rev-parse HEAD
git status --short
git remote -v
```

For a source ZIP, verify every tracked file. Bash:

```bash
sha256sum -c SHA256SUMS
```

PowerShell:

```powershell
$failed = 0
Get-Content .\SHA256SUMS | ForEach-Object {
  if ($_ -notmatch '^([0-9a-f]{64})  (.+)$') { throw "Invalid SHA256SUMS line: $_" }
  $expected = $Matches[1]; $file = $Matches[2]
  $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { $failed++; Write-Error "Checksum mismatch: $file" }
}
if ($failed -ne 0) { throw "$failed checksum failures" }
```

The number of verified entries must equal `fileCount` in `reports/PUBLIC_SOURCE_MANIFEST.json`. Stop if a checksum, manifest entry, ZIP CRC, or announced commit differs. Do not repair an archive by copying files from another checkout.

## Requirements by function

### Basic build and API

- Node.js 24 or newer
- Corepack and pnpm 10.34.5
- PostgreSQL for API startup and database-backed registry/text/audit functions

No general minimum RAM or disk figure is published because a complete minimum was not measured across machines. Measure the selected modules, media size, retention policy, package cache, PostgreSQL data, Live storage, and build outputs on your host.

### Media and Live

The frozen Windows reference uses Python 3.14.7, NumPy 2.5.2, PyAV 18.0.0, and the license-clean FFmpeg 8.1.2 build. MediaMTX is required only by the operator flow that uses it. Binaries are external to the repository. Follow [Build the verified media runtime](BUILD_VERIFIED_MEDIA_RUNTIME.md) and configure absolute paths. Product code rejects an unverified `PATH` substitute.

### C2PA

The source pins `@contentauth/c2pa-node` 0.9.1. The root postinstall verifies the fixed official native archive and its inner binary before installation. Remote manifests stay disabled. Local product signing uses ES256; RSA-PSS is rejected in product mode.

## Install the source

From the verified repository root:

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
```

Do not substitute another package manager version. The install can need network access for npm packages and the fixed C2PA native archive.

For a network-free installation with the verified C2PA native installer, first obtain the exact official archive on a connected staging host and verify it against `reports/C2PA_NATIVE_RELEASE_ASSET_CHECKSUMS.json`. Copy only the verified archive to the target. Then set its absolute path before `pnpm install --frozen-lockfile`.

PowerShell:

```powershell
$env:TANCMARK_C2PA_NATIVE_ARCHIVE = 'D:\verified-input\c2pa-node-archive.zip'
pnpm install --frozen-lockfile
```

Bash:

```bash
export TANCMARK_C2PA_NATIVE_ARCHIVE='/opt/verified-input/c2pa-node-archive.zip'
pnpm install --frozen-lockfile
```

No alternate download URL or checksum is accepted by the installer.

## Configure PostgreSQL

Create a dedicated database and least-privilege application role using your PostgreSQL administration process. Do not reuse the PostgreSQL superuser as the application account. Use TLS when the database is not on the same trusted host.

Set the connection string only in the process secret boundary:

PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://tancmark_app:<PASSWORD>@127.0.0.1:5432/tancmark'
pnpm --filter @workspace/db run push
```

Bash:

```bash
export DATABASE_URL='postgresql://tancmark_app:<PASSWORD>@127.0.0.1:5432/tancmark'
pnpm --filter @workspace/db run push
```

`push` applies the current Drizzle schema. Review schema changes and back up an existing database before applying them. Do not run `push-force` as a routine deployment command.

For a development client and API key, the included script writes one registry client and one HMAC-peppered API key:

```sh
pnpm --filter @workspace/scripts run seed-client -- demo "Demo Client" default
```

Save the printed plaintext key once; the database does not store it. In product mode, configure an operator-generated pepper of at least 16 characters through `TANCMARK_API_KEY_PEPPER` or the legacy-compatible `AEGIS_API_KEY_PEPPER`. Changing the pepper invalidates existing API keys unless you perform a planned migration.

## Configure core secrets

Use a secret manager or an equivalent protected process boundary. Do not commit values to `.env`, a shell script, screenshots, tickets, or logs.

Required or commonly selected values include:

- `PORT`: API listen port; required by the server entry point.
- `DATABASE_URL`: PostgreSQL connection string; required by database imports.
- `ADMIN_TOKEN`: random value of at least 16 characters.
- `AEGIS_SECRET`: TancMark core secret. The environment-variable name retains the legacy `AEGIS_` prefix for compatibility. Production refuses to start with the demo default. The source minimum is 8 characters; use at least 32 random characters in an operator secret manager. For rotation, prefer `AEGIS_SECRET_V1`, `AEGIS_SECRET_V2`, and `ACTIVE_AEGIS_SECRET_VERSION`; never remove a version while records still depend on it.
- `TANCMARK_API_KEY_PEPPER` or `AEGIS_API_KEY_PEPPER`: HMAC pepper for product API keys.
- `AEGIS_ALLOWED_ORIGINS`: comma-separated browser origins; leave unset if no browser origin is required.

Use `.env.example` as the Live and C2PA variable inventory, but note that process-required `PORT`, `DATABASE_URL`, `AEGIS_SECRET` (or its versioned form), and the API-key pepper are operator values and are not currently listed there.

## Configure local protected Live

At minimum, use a dedicated absolute storage directory, a random playback keyring, the verified local tenant, and explicit verified media runtime paths:

```text
TANCMARK_LIVE_STORAGE_ROOT=<dedicated-absolute-storage-directory>
TANCMARK_LIVE_PLAYBACK_KEYRING={"activeKid":"current","keys":{"current":"base64:<at-least-32-random-bytes>"}}
TANCMARK_LIVE_LOCAL_TENANT_ID=<verified-local-tenant-id>
TANCMARK_LIVE_LOCAL_ACCOUNT_ID=<verified-local-account-id>
TANCMARK_LIVE_WATERMARK_PYTHON=<absolute-verified-python>
TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT=<repo>/runtime/live/live_streaming_adapter_worker.py
TANCMARK_LIVE_ADAPTER_C_SCRIPT=<repo>/runtime/product-runtime/unified_pts_watermark_adapter_c.py
TANCMARK_FFMPEG_PATH=<absolute-verified-ffmpeg>
TANCMARK_FFPROBE_PATH=<absolute-verified-ffprobe>
```

The storage directory must not be a drive root, profile root, repository directory, symlink, or junction. Keep enough free space for private ingest, protected fragments, the stopped recording, journals, and retention. Optional conservative limits are documented in `.env.example`.

Use `PROTECTED_TANCMARK` for the normal path. `TRANSPORT_ONLY` disables watermarking and never grants ownership. The server owns identity authority; callers do not send raw expected IDs, registry rows, private maps, or signatures.

External providers are configured outside the local core through `config/live-external-providers.schema.json` and an opaque secret-store reference. Follow [the external provider checklist](LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md). Default tests contact no provider.

## Configure C2PA

Keep each tenant's working-copy root separate and free of links. Configure:

```text
C2PA_REMOTE_MANIFEST_FETCH=false
TANCMARK_C2PA_TENANT_ROOTS_JSON={"verified-tenant-id":"<absolute-dedicated-working-copy-directory>"}
TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON={"verified-tenant-id":"<base64url-secret-at-least-32-bytes>"}
TANCMARK_C2PA_SIGNING_ENABLED=0
```

Enable signing only after providing an ES256 certificate and private key outside the repository:

```text
TANCMARK_C2PA_SIGNING_ENABLED=1
TANCMARK_C2PA_SIGNING_PROFILES_JSON={"verified-tenant-id":{"certificatePath":"<absolute-certificate-path>","privateKeyPath":"<absolute-private-key-path>","algorithm":"es256"}}
```

Test certificates are not production trust. Production certificate lifecycle, KMS/HSM integration, revocation, TSA, public Trust List participation, and C2PA conformance are operator work. See [C2PA Guide](C2PA_GUIDE.md).

## Build and validate

Run the public gates from the repository root:

```sh
pnpm run typecheck
pnpm run build
pnpm run build:product
pnpm test
pnpm run test:documentation
pnpm run test:toolchain-supply-chain
pnpm run sbom
```

`test:toolchain-supply-chain` needs network access for its current advisory and upstream checks. A network-unavailable result is not a pass.

After configuring the verified media runtime, run only the applicable gates:

```sh
pnpm run test:media-runtime
pnpm run test:physical-text-image
pnpm run test:physical-audio
pnpm run test:clean-live
pnpm run test:c2pa
```

The real private-media contracts can require operator-supplied manifests and are not implied by a basic build. Do not lower thresholds or replace fixtures to obtain a pass.

## Start the product bundle

Set the required process values, build, and start:

PowerShell:

```powershell
$env:NODE_ENV = 'production'
$env:PORT = '5000'
$env:DATABASE_URL = 'postgresql://tancmark_app:<PASSWORD>@127.0.0.1:5432/tancmark'
$env:ADMIN_TOKEN = '<AT_LEAST_16_RANDOM_CHARACTERS>'
$env:AEGIS_SECRET = '<AT_LEAST_32_RANDOM_CHARACTERS_RECOMMENDED>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Bash:

```bash
export NODE_ENV=production
export PORT=5000
export DATABASE_URL='postgresql://tancmark_app:<PASSWORD>@127.0.0.1:5432/tancmark'
export ADMIN_TOKEN='<AT_LEAST_16_RANDOM_CHARACTERS>'
export AEGIS_SECRET='<AT_LEAST_32_RANDOM_CHARACTERS_RECOMMENDED>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Health check:

```sh
curl --fail http://127.0.0.1:5000/api/healthz
```

Expected JSON is `{"status":"ok"}`. The API base is `/api`. Use [API Examples](API_EXAMPLES.md) only after creating the appropriate verified client, tenant, storage, and key configuration.

Do not expose plain HTTP remotely. Live and C2PA explicitly accept plain HTTP only over the actual loopback socket; spoofed forwarded headers do not change that decision.

## Product and laboratory routes

The product build intentionally replaces audio/video lab routers with HTTP `410` responders and blocks the direct canonical video reader. This is expected. The canonical video reader exists in `dist-product` only for the server-internal verified Live chain.

The OpenAPI document includes older visual and video laboratory contracts for contract history. Their presence does not make them production ownership APIs. Audio lab and several support routes exist in code but not in OpenAPI. They are recorded as `PUBLIC_API_DOCUMENTATION_MISMATCH` and are not advertised as public APIs in these guides.

## Operations and monitoring

- Monitor process health, PostgreSQL, Live free space, storage limits, worker queue, failed sessions, final verification state, and cleanup journals.
- Treat `PARTIAL`, `MANUAL_REVIEW`, and `NOT_FOUND` as non-ownership results.
- Do not log request secrets, raw expected IDs, registry rows, private maps, certificates, keys, local paths, or customer content.
- Keep the documented LOW log-serializer hardening debt in your deployment review; validate the final logging sink before handling sensitive production data.
- Keep server, database, media runtime, and clock synchronized through operator-controlled maintenance.
- Rate-limit and monitor admin and API-key failures without revealing tenant existence.

## Backup and restore

Back up these classes separately:

- PostgreSQL registry, signatures, audit metadata, and schema version.
- Live session metadata, evidence, journals, and protected media under the dedicated storage root.
- C2PA working copies that retention policy requires.
- Configuration references and key identifiers.
- Keys and secrets through the secret manager's backup mechanism, never inside the source or ordinary data backup.

Encrypt backups, restrict restore authority, and test restoration on an isolated host. Preserve the relationship between a database snapshot, protected files, signatures, and key versions. A restored registry without its matching key version cannot create a valid verification chain.

## Shutdown, cleanup, and retention

Send `SIGINT` or `SIGTERM` and allow the server to close. Verify that no media worker or temporary C2PA file remains. Do not kill the process during a signing or Live finalize operation unless the fault-recovery procedure is being tested.

Live cleanup is two-step: create a managed-media-only plan, review its file count/bytes and confirmation digest, then execute it with the matching revision, idempotency key, and `If-Match` digest. Cleanup retains metadata, evidence, and audit. Legal hold blocks destructive cleanup.

Never recursively delete a storage root, profile, repository, or unresolved link target. Apply retention policy to exact tenant/session targets and keep a reviewed rollback/restore path.

## Security and release checklist

Before any production deployment or owner-approved GitHub publication:

1. Run typecheck, both builds, public tests, documentation tests, applicable real-media gates, Live exact verification, C2PA negatives, SBOM/license inventory, privacy/secret/path/media scans, and archive checksum checks.
2. Confirm wrong ID, no ID, wrong tenant, unsealed media, ambiguous locator, and unauthorized sealing all produce no ownership.
3. Confirm `dist-product` returns `410` for public video/audio lab and direct canonical reader routes.
4. Confirm every production secret comes from the operator boundary and is redacted from logs and evidence.
5. Configure real TLS, backup, monitoring, key rotation, retention, rate limits, and incident response.
6. Confirm the repository URL remains `https://github.com/adem-kursat-tanc/tancmark` and rerun `pnpm run test:documentation`.

Current V13 inventory covers 1,188 dependencies: 677 JavaScript packages and 511 native Rust packages. Unresolved license count is zero. This is not a legal-approval claim.

For security deployment details, use [Security and Deployment Guide](SECURITY_DEPLOYMENT_GUIDE.md). For all documentation, use the [Documentation Index](DOCUMENTATION_INDEX.md).
