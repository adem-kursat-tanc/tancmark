# TancMark Troubleshooting

Start with the first failing gate. Keep the exact command, exit code, public error code, and redacted log. Do not change a watermark threshold, identity rule, fixture, tenant rule, or signature requirement to make a failure disappear.

## Source and checksum problems

### `SHA256SUMS` reports a mismatch

Cause: the ZIP is damaged, line endings or files were changed after extraction, or files from different commits were mixed.

Action:

1. Stop installation.
2. Confirm you extracted into an empty directory.
3. Compare the announced ZIP SHA-256 and commit ID.
4. Delete only the failed extracted copy and download again from the owner-published source.
5. Do not copy a “matching” file from another checkout.

### A Git clone has local changes before setup

Run `git status --short`. A fresh owner-published commit should be clean. Do not reset if the directory may contain your work. Create a new short, empty directory and clone again.

### The canonical repository URL is missing

Use the owner-verified URL `https://github.com/adem-kursat-tanc/tancmark` in both language guides and rerun `pnpm run test:documentation`.

## Node, Corepack, and pnpm

### Node is too old

Run `node --version`. The source requires Node.js 24 or newer. Install a supported Node version outside the repository, reopen the shell, and recheck.

### Wrong pnpm version

Run:

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm --version
```

The final output must be `10.34.5`. Do not regenerate the lockfile with another pnpm version.

### `pnpm install --frozen-lockfile` fails

Check the first error. Common causes are no network, a modified lockfile, an unavailable package registry, insufficient disk space, antivirus locking a native binary, or C2PA native verification failure. Do not use `--no-frozen-lockfile` as a repair.

For offline C2PA native installation, use only the exact archive and checksum documented in `reports/C2PA_NATIVE_RELEASE_ASSET_CHECKSUMS.json`, then set the absolute `TANCMARK_C2PA_NATIVE_ARCHIVE` path.

### Windows path is too long

Use a short empty path such as `C:\tm\tancmark`. The V8 audit recorded a long-path install failure and accepted only the exact same archive after it passed from a short path. This is an environment limit, not a reason to change source files.

## Build and tests

### Typecheck or build fails

Confirm Node 24+, pnpm 10.34.5, a clean source tree, and a frozen install. Run `pnpm run typecheck` before `pnpm run build` and `pnpm run build:product`. Preserve the first compiler error.

### `pnpm test` passes but a media feature does not run

Basic public tests do not install the external media runtime or claim every private real-media gate. Configure the exact absolute Python/FFmpeg paths and run the applicable `test:media-runtime`, physical media, Live, or C2PA gate.

### Supply-chain test says network unavailable

`pnpm run test:toolchain-supply-chain` checks current external advisories and upstream identity. Network unavailable is not a pass. Run it later from an approved connected environment; do not mark it successful.

## PostgreSQL and server startup

### `DATABASE_URL must be set`

Set a valid PostgreSQL connection string in the process secret boundary. The API imports the database package at startup. Do not put the real connection string in Git.

### Database connection is refused

Confirm PostgreSQL is running, the host/port/database are correct, the application role can connect, TLS settings match, and the firewall allows the intended host only. Use PostgreSQL tools to test the same connection outside TancMark.

### A table or column is missing

Back up the database, review the current schema, then run:

```sh
pnpm --filter @workspace/db run push
```

Do not use `push-force` as a shortcut.

### `PORT environment variable is required`

Set `PORT` to a positive numeric port before `start`/`start:product`. If the port is already used, choose an approved free port or stop the known owning service; do not kill an unidentified process.

### `/api/healthz` returns 404

Check that the URL includes `/api`: `http://127.0.0.1:<PORT>/api/healthz`.

## Authentication and tenant errors

### `admin_token_unconfigured` (`503`)

Set `ADMIN_TOKEN` to a random value of at least 16 characters and restart the process. Do not use the placeholder text.

### `invalid_api_key` or `api_key_security_not_configured`

Confirm the key was issued by the current database, the plaintext was copied correctly, and the configured `TANCMARK_API_KEY_PEPPER`/`AEGIS_API_KEY_PEPPER` matches the pepper used when the key was seeded. Product mode refuses an absent or short pepper.

### `seal_identity_spoofing_rejected` or `seal_identity_mismatch`

Remove body/query/header tenant authority. A verified API client seals only as itself. An administrator must resolve an existing registry client; it cannot create identity authority by typing an arbitrary ID.

### Wrong tenant returns `404`

This is intentional anti-enumeration behavior. Confirm the authenticated API client or exact configured `x-tancmark-live-tenant-id`. Do not change the route to reveal whether another tenant's record exists.

## Product route behavior

### Video/audio lab returns HTTP `410`

This is expected in `dist-product`. The lab route is deliberately disabled. Use the published validation programs for laboratory work. The canonical video reader is available only to the verified server-internal Live flow.

### A code route is not in OpenAPI

Treat it as `PUBLIC_API_DOCUMENTATION_MISMATCH`, not as an undocumented public feature. Do not expose it until the route and API contract receive a separate owner-reviewed change.

## Media runtime

### FFmpeg, FFprobe, Python, PyAV, or NumPy is rejected

Run `pnpm run test:media-runtime`. Check that every configured path is absolute, external to the repository, a normal non-link file, and matches the frozen version and checksum. Product mode does not trust a same-named binary found on `PATH`.

### GPL/nonfree/libx264/libx265 rejection

The verified product FFmpeg profile is LGPL-compatible, shared, network-disabled, and excludes those libraries. Rebuild from [the verified media runtime guide](BUILD_VERIFIED_MEDIA_RUNTIME.md); do not weaken the resolver.

### Image or audio physical test is skipped/fails

Confirm the exact runtime paths and inspect the module's robustness document. A public arithmetic/decision smoke is not the same as a codec attack matrix. Report unmeasured work as `NOT_MEASURED`.

## Live

### `live_local_transport_boundary_rejected` (`403`)

Plain HTTP arrived from a non-loopback socket. Use `127.0.0.1` on the same host or terminate real TLS correctly. Forwarded headers cannot override the connected socket.

### Protected session is not ready

Call `GET /api/tancmark/live/local/v1/status` with correct authority. Resolve storage, keyring, tenant, worker, Python, FFmpeg, FFprobe, and identity integration readiness before creating a protected session.

### Init or segment is rejected

The upload must be a real supported CMAF fragment, `Content-Type` must be `application/octet-stream`, and `x-content-sha256` must match exact bytes. Sequence, duration, and idempotency headers are required. The parsed track/timing data is authoritative.

### `409` revision or idempotency conflict

Fetch the current session and use its current `revision`. Reuse an idempotency key only for the exact same request. A changed request under the same key is deliberately rejected.

### `507` storage failure

The configured quota or free-space reserve failed. Stop ingest, preserve the session/journals, and add space or apply the reviewed retention workflow. Do not delete a broad directory manually.

### Watermark worker or final verification fails

The product fails closed and must not publish an unwatermarked fallback. Preserve redacted state and journals. Check runtime hashes, queue, worker exit, protected output validation, final recording, registry/signature binding, and cleanup order. Do not lower the watermark threshold.

### Live external provider is skipped

This is expected until the operator provides an account, accepts provider terms, stores credentials externally, and runs `LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md`. Local protected Live can be complete without a pre-connected provider.

## C2PA

### `c2pa_*` request error

Check the exact public error code. Asset names are simple names inside the tenant root, not paths. Output must be new. Raw keys, certificates, tenant/client IDs, exact IDs, registry rows, maps, trust anchors, TSA URLs, and remote URLs are forbidden in the body.

### `UNSUPPORTED_FORMAT`

The current product accepts only locally tested PNG, JPEG, MP4, and MOV. PDF and WAV are `NOT_MEASURED`; do not rename the file or bypass the policy.

### `VALID_BUT_UNTRUSTED`

The manifest can be cryptographically valid while the certificate is not on a public trust list. A local test certificate commonly produces this result. It is not ownership and not official trust.

### `ASSET_TAMPERED` or `INVALID_SIGNATURE`

Preserve the file as evidence. Do not re-sign it and describe the old signature as valid. Compare its checksum with the expected working copy and investigate the provenance chain.

### Remote manifest is blocked

Remote manifest retrieval is intentionally not implemented and `C2PA_REMOTE_MANIFEST_FETCH=false` must remain. Use embedded manifests.

### Signing fails before key read

Product-local RSA-PSS algorithms are disabled. Use an operator-configured ES256 profile or a separately reviewed external KMS/HSM/subprocess signer. Confirm certificate/private-key paths are outside the repository and accessible only to the service identity.

## Results and evidence

### A locator matched but ownership is false

Correct behavior. A short locator finds a candidate bucket. Full exact physical identity, unique registry record, tenant/account match, and valid signature are still required.

### More than one candidate remains

Return `MANUAL_REVIEW`; do not automatically choose the highest score or first record.

### C2PA/DNA/Discovery result is positive but VAULT is false

Correct behavior. These are provenance, advisory, or discovery support layers. See [Results and terms](RESULTS_AND_TERMS.md).

## Safe shutdown and residue

Use `SIGINT` or `SIGTERM` and allow shutdown to finish. Check for product server processes, watermark workers, C2PA temporary files, and Live journals. Cleanup only exact verified temp/session paths. Never recursively remove a drive root, profile, repository, or unresolved reparse target.

If the problem may expose a vulnerability or secret, follow [SECURITY.md](../SECURITY.md) instead of opening a public issue.
