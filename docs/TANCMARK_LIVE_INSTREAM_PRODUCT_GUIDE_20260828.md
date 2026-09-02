# TancMark Live in-stream product guide

This is the canonical operator guide for the provider-independent TancMark Live protected path. The local service accepts validated H.264/AAC CMAF fragments, watermarks video before publication, preserves audio packets and timestamps, publishes only protected fragments, builds the stopped VOD from the same protected bytes, and automatically runs the existing exact-ID/registry/signature decision chain at stop.

## Product modes

`PROTECTED_TANCMARK` is the default. The server owns the full ID and registry binding; callers cannot provide ownership authority. A long-lived, session-scoped worker applies the unchanged Video Primary algorithm. If the worker, queue, output validation or signed rolling receipt fails, the session fails closed and no unwatermarked protected output is published.

`TRANSPORT_ONLY` is an explicit administrator/laboratory mode. It is visibly labelled as watermarking disabled. Ownership, VAULT, confirmed and final remain false.

## Authoritative flow

The protected flow is:

`private ingest → long-lived watermark worker → validated protected CMAF → LL-HLS/player → protected recording/VOD → automatic exact verification`

The server creates `LIVE_SESSION_SEAL_BINDING_V1` from the verified tenant/account, registry record, signature reference and algorithm version. Neither request bodies nor signed timing maps become ownership authority. Rolling maps contain addresses and chained receipts, not the raw full ID. At stop, `VIDEO_LAYER_VAULT` is possible only after physical exact recovery, unique registry match, tenant/account match and valid signature.

## Frozen CPU profile

The accepted local profile uses 4-second atomic CMAF fragments and a bounded queue. The placement policy uses disjoint Channel A and Channel B locations when the source has enough frames. Periodic verification runs on a separate bounded worker and samples known protected Channel A locations; its result is evidence about that sample, not a final decision. Final verification reads the completed protected VOD.

The 7 minute 44 second real-media 1× run processed 116 fragments and ended with backlog 0, frame loss 0, timestamp drift 0 and exact audio-packet preservation. Ingest-to-protected-ready p95 was 4109 ms; watermark processing p95 was 3540 ms. The final decision was `VIDEO_LAYER_VAULT`; wrong ownership was 0. The redacted measurements are in `reports/LIVE_7M44_V3_CPU_SAFE_RESULT_20260828.json`.

The real-media matrix covered ordinary H.264/AAC, rotation metadata, three real unsealed negatives and two simultaneous tenants. Protected positives ended in `VIDEO_LAYER_VAULT`; all unsealed negatives were `NOT_FOUND`; cross-tenant and wrong-ownership counts were 0. See `reports/LIVE_REAL_MEDIA_MATRIX_V3_RESULT_20260828.json`.

## Recovery behavior

Worker exit, Node restart, temporary disk exhaustion, half-written fragment, output/receipt commit gaps, stop interruption and final-verification interruption are recovered by journals and idempotent receipts. A restarted encoder may emit byte-different init metadata; continuation is allowed only when the authoritative track metadata and decoder configuration are compatible. Changed SPS/PPS or audio decoder configuration still fails closed. The eight-case result is recorded in `reports/LIVE_INSTREAM_CRASH_RECOVERY_RESULT_20260828.json`.

## Required local configuration

Use `.env.example` as the variable inventory. Supply a dedicated storage directory, local playback keyring, tenant/admin authority and paths to a locally installed verified Python/PyAV/FFmpeg runtime. Runtime binaries and production secrets are not bundled. Keep storage away from drive roots, profiles, symlinks and junctions.

The Live API remains `/api/tancmark/live/local/v1`. Exact IDs, signing material, decoder internals, private maps, local paths and media fingerprints are not returned. The official OpenAPI document is `lib/api-spec/openapi.yaml`.

## External providers

YouTube, Twitch, Facebook, TikTok, Instagram, custom RTMP, webhook and CDN connections are operator configured. The repository supplies the adapter contract, `config/live-external-providers.schema.json`, redaction behavior and `LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md`. Only `rtmps://` or `https://` endpoints and opaque secret-store references are accepted; credentials in fields, URLs, logs, responses or evidence are rejected.

No external provider is contacted by the default product or its tests. Provider tests remain `SKIPPED_EXTERNAL_CONFIGURATION_REQUIRED` until the operator supplies an account, approves the provider terms and runs the checklist. This is an operational integration boundary, not an incomplete local watermarking engine.

Canonical status: `EXTERNAL_PROVIDER_INTEGRATIONS_USER_CONFIGURED_NOT_PRODUCT_GAP`.

## Verification commands

Run the repository's API typecheck and build, then the Live core, HTTP, media, worker, security, crash/recovery, route parity and external-provider configuration contracts. Real-media contracts require a private manifest supplied through `TANCMARK_LIVE_REAL_MEDIA_MANIFEST`; no real filename, path or fingerprint is embedded in public source.

Do not lower watermark strength, thresholds or decision requirements to pass a test. Transport receipts and partial/sample findings never open ownership or VAULT.
