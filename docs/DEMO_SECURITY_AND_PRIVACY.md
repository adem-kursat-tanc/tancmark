# Demo Security and Privacy

## Trust boundary

The demo is an isolated, ephemeral application with an allowlisted `/demo` interface. It does not mount production databases, production registries, production private keys, customer media, host Docker sockets, host folders, or persistent volumes. It has no production fallback.

The forwarded port is private and must remain private. The container runs as the unprivileged `tancmark` user, drops all Linux capabilities, enables `no-new-privileges`, and applies a process limit. Only port 4173 is forwarded. MediaMTX RTSP, HLS, and management ports are loopback-only inside the container and are not forwarded.

## Accepted input

- a bounded optional text string (2,000 Unicode characters maximum);
- selection of repository-generated public fixtures;
- fixed Run, reset, and Live lifecycle actions.

The server rejects multipart/form-data, uploads, paths, URLs, arbitrary identifiers, tenant authority, registry rows, signatures, codec options, FFmpeg arguments, and shell commands.

## Web controls

- strict same-origin session cookie (`HttpOnly`, `Secure`, `SameSite=Strict`);
- per-session CSRF token and one-use request nonce;
- request body limit;
- separate API and Live-media rate limits;
- one concurrent heavy operation with a bounded queue;
- bounded operation timeouts and child-process count;
- Content Security Policy with self-only scripts/styles/connections/media;
- `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`, and `form-action 'self'`;
- `Cache-Control: no-store`, no analytics, telemetry, CDN, font, or third-party script.

HLS query parameters are restricted to the exact MediaMTX session and low-latency playlist allowlist. The proxy accepts only bounded playlist/fragment paths and media MIME types. User-controlled outbound fetches do not exist.

## Secret isolation

The launcher uses `env -i` and passes only an explicit allowlist to the demo process. `GITHUB_TOKEN`, `GH_TOKEN`, Git credentials, Codespaces secrets, dotfile secrets, and unrelated environment values are not inherited. No environment-dump route exists. Responses and logs do not include private keys, raw registry rows, exact maps, local paths, stack traces, or decoder internals.

## Ephemeral authority

Each server start creates a random demo tenant and an ephemeral ML-DSA test key. C2PA uses an ephemeral ES256 test certificate. Remote C2PA manifest fetch is disabled. Registry data, keys, receipts, and media work files stay in the temporary demo directory and are removed on reset or shutdown.

`DEMO_ONLY` results can never open a production VAULT. Short locators, Channel B support, receipts, previews, maps, and C2PA claims are not ownership authorities.

## Measured negatives

The Linux HTTP matrix rejected upload/multipart, traversal/absolute/symlink paths, oversized and malformed input, user-selected ID/tenant, changed records, wrong signatures, replayed nonces, CSRF, cross-origin requests, environment/token reads, command/shell injection, SSRF, external fetches, and production routes. Queue overflow returned 503, rate overflow returned 429, and active-Live shutdown left 0 child processes, 0 internal ports, and 0 media temp directories.

Evidence: `DEMO_SECURITY_TEST_RESULTS.json` and `evidence/DEMO_LIVE_BROWSER_3X_RESULTS.json`.
