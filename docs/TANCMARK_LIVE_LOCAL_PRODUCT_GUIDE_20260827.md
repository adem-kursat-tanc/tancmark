# TancMark Live Local Product Core — Operator Guide

> Scope note: this document preserves the 27 August local transport/core behavior. The canonical in-stream watermarking, automatic exact verification and CPU-safe 4-second profile are documented in `TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md`.

This candidate provides a single-node, provider-independent Live core under `/api/tancmark/live/local/v1`. It accepts validated AVC fMP4/CMAF init and media fragments, publishes standard LL-HLS plus a same-origin MediaSource player, assembles a server-owned stopped VOD, and retains support-only integrity evidence.

It does not turn transport or storage evidence into ownership, VAULT access, `confirmed`, or `final`. Those generic fields remain false. The only video identity operation is a separate, STOPPED-only connection to the existing protected signed-exact-map reader/registry/decision chain.

## Required local configuration

- `TANCMARK_LIVE_STORAGE_ROOT`: dedicated absolute storage directory. Drive roots, the user profile, the process working directory, symlinks and junctions are rejected. The service creates and verifies a root marker. A SQLite `BEGIN EXCLUSIVE` operating-system lock provides one live writer per storage root; in-process users share the same lease, and a crashed process cannot leave a trusted PID-only lock behind.
- `TANCMARK_LIVE_PLAYBACK_KEYRING`: exact JSON object with only `activeKid` and `keys`. Each key must use canonical `base64:` or `base64url:` encoding and contain at least 32 bytes.
- `ADMIN_TOKEN`: existing admin middleware secret, at least 16 characters.
- Tenant authority is primarily verified `req.apiClient.id`. The fallback is an exact `x-tancmark-live-tenant-id` match to `TANCMARK_LIVE_LOCAL_TENANT_ID` while the admin token is valid. Body tenant/client/owner fields are never authority.

Optional conservative limits are `TANCMARK_LIVE_MAX_SESSION_BYTES`, `TANCMARK_LIVE_MAX_SESSION_SEGMENTS`, `TANCMARK_LIVE_MAX_SESSION_DURATION_MS`, `TANCMARK_LIVE_MAX_TENANT_BYTES`, `TANCMARK_LIVE_MIN_FREE_BYTES`, and `TANCMARK_LIVE_BLOCK_RELOAD_MS` (bounded to 100–3000 ms).

## Lifecycle

1. Create a session.
2. Upload one `application/octet-stream` init to `/sessions/{id}/init` with `x-content-sha256` and `x-idempotency-key`. The semantic ISO BMFF parser requires the real `trak/mdia/hdlr/minf/stbl/stsd` hierarchy, valid full-box fields and bounds, track IDs and timescales, `trex` bindings, a nonempty bounded AVC configuration with SPS/PPS, and—when present—a valid AAC `mp4a/esds` declaration. Box-name lookalikes and empty fake init files are rejected.
3. Start with `expectedRevision` and an idempotency key.
4. Append CMAF fragments. Each declared init track must bind through `mfhd/traf/tfhd/tfdt/trun` to the matching `trex`; `trun` must declare positive samples whose sizes and data offsets exactly cover nonempty `mdat` bytes. Decode time is monotonic per track. Duration is derived from sample ticks and each track timescale, not trusted from a client header; a conflicting header is rejected. Plain text, empty `mdat`, zero-sample fragments and structural box-name lookalikes are rejected.
5. Stop with `expectedRevision` and an idempotency key. Grants are revoked first; the manifest, bytewise `init + ordered fragments` recording, evidence and receipt are finalized deterministically. Recording assembly is bounded-memory: each validated artifact is appended to a managed partial file, hashed incrementally, fsynced and atomically renamed. A matching full partial/final crash orphan is reused only when exact byte count and SHA-256 match. The recording is an additional disk copy, so its full size must pass the session/tenant quota and `statfs` reserve gate before writing; HTTP 507 leaves init and fragments intact for retry. A new token may then be issued for STOPPED VOD.
6. Cleanup is a two-step plan/execute operation. The plan contains only relative managed-media inventory, file counts, bytes and hashes. Execute requires the confirmation digest, legal hold must be false, and metadata/evidence/audit records remain. The pending attempt persistently binds the plan ID, idempotency-key hash and request digest. If a crash happens after deletion and the plan later expires, only that exact attempt can finish `PURGED`; a changed key or digest fails closed.

Start, stop and cleanup use same-key/same-request replay receipts. Same key with a changed request is HTTP 409. Segment writes use an orphan journal that either completes a committed record or safely rolls back managed orphan bytes.

## LL-HLS and player

Running manifests use version 9, `EXT-X-PART-INF`, `EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES`, `EXT-X-PART` URI entries and `EXT-X-MAP`. `_HLS_msn`, `_HLS_part` and `_HLS_skip` are strictly parsed and bounded; blocking reload is time-capped and the grant is revalidated after waiting. Stopped manifests finalize every part as an `EXTINF` segment and add `EXT-X-ENDLIST`.

The player contains no CDN or third-party library. It checks `MediaSource.isTypeSupported()` with the RFC codec string derived from `avcC` (and `esds` when audio exists), appends init/fragments from same-origin authenticated endpoints, and uses native HLS only as a fallback. Some real VFR/CMAF sources begin at a non-zero media timestamp. After each append, the player checks every buffered range and moves `currentTime` to the first buffered timestamp only when the playhead is outside all buffered ranges. A recent pointer/touch/keyboard seek or non-automatic `seeking` event suppresses alignment for three seconds, so normal user seeks are not overwritten. Visible states distinguish `LOADING`, `READY`, `PLAYING`, `ENDED`, buffering and `FAILED`. Session-specific HttpOnly cookie names prevent concurrent sessions from sharing a grant.

The HTTP contract intentionally does not automate a standalone browser. The selected browser authority is the in-app Browser client. `runtime/validation/live_local_product_browser_harness.ts` locates the unchanged, hash-verified H.264+AAC source, creates and stops a real session on an ephemeral `127.0.0.1` port, and exposes a test-only no-store bootstrap. On each page open, the server creates a fresh token within the unchanged 300-second product security ceiling; a nonce-CSP script performs the normal same-origin exchange, never writes the token to DOM/storage/logs, and redirects to the player after the HttpOnly cookie is set. The harness uses a dedicated temp root and PID metadata, starts no external listener, and on SIGINT/SIGTERM closes the server and removes only that verified test root (a scope-validating post-exit helper handles the Windows SQLite journal lifetime when required).

Two Browser observations are kept distinct. The RUNNING observation aligned from 0 to the non-zero buffered start 2.0 seconds and played real audio/video, then correctly waited at the live edge with `ended=false`; it is not presented as an EOS pass. The STOPPED VOD observation buffered `[2.0, 3.023219]`, reached `currentTime=duration=3.023219`, emitted `ended=true`, paused, retained readyState 4, showed `ENDED`, and had no media error or console warning/error. The displayed 480×848 dimensions reflect the source rotation. The retained measurement summary is redacted; tokens, session IDs, paths, screenshots and raw network transcripts are not published. The user-seek suppression policy is measured independently by the automated core contract.

The product route enforces its transport boundary from the actual socket. Plain HTTP is accepted only from loopback; forwarded headers and `req.ip` cannot expand trust. A directly encrypted socket may be accepted, while an on-box TLS proxy reaches the service over loopback. Session cookies are `HttpOnly`, `SameSite=Strict`, and gain `Secure` only on an actually encrypted socket.

The no-data `/management-console` shell offers status, paginated session listing and session creation controls. It keeps the entered admin token and tenant only in the current page's JavaScript memory and sends them as headers on each same-origin request; it does not place secrets in URLs, cookies, local storage, logs or HTML responses. The legacy authenticated `/console` path redirects to that single functional surface.

## Identity boundary

`/sessions/{id}/verify-exact-id` requires STOPPED state, the session-bound lowercase 64-hex expected ID, account and registry bindings, and server-owned video/work paths. It invokes the existing protected signed-map database registry, key resolver and video decision without modifying them. The response is whitelisted, does not disclose the expected ID or raw decoder object, and names any positive result as a scoped video-image-layer decision. Live transport evidence remains `ownership=false`, `vault=false`, `confirmed=false`, and `final=false`.

Re-sealing or pre-sealing is not performed by this API. It is a separately owner-authorized protected product action, not an external provider debt.

## Verification

Use the fixed local LGPL FFmpeg 8.1.2 build with `--disable-gpl --disable-nonfree --disable-network`, `h264_mf`, and native AAC. Product runtime uses the absolute `TANCMARK_FFMPEG_PATH` and `TANCMARK_FFPROBE_PATH`; frozen validation fixtures use the test-only `TANCMARK_LIVE_TEST_FFMPEG` and `TANCMARK_LIVE_TEST_FFPROBE` aliases under `NODE_ENV=test`. Test binaries generate/read fixtures only. The Live transport, store, LL-HLS and player runtime have no FFmpeg dependency. The optional protected exact-identity connection is a separate capability and may use the existing protected FFmpeg/ffprobe/PyAV runtime; its availability, dependency readiness and last-call telemetry are reported separately.

The core contract covers canonical secrets/tokens, tamper/wrong kid/expiry/duplicate scope/replay/revoke, token survival after a new fragment, semantic fMP4 negatives (including the 44-byte fake init and 72-byte empty-fragment counterexamples), matching start/stop/cleanup crash checkpoints, expired-plan exact cleanup recovery, STOPPED VOD grants, recording duplicate-byte quota/free-space 507 behavior, source preservation, broad-root and junction rejection, legal hold, and a dedicated `recording` scope. The lease contract runs two batches of 101 cross-process contenders and requires exactly one SQLite OS-lock winner per batch. The HTTP contract exercises the exact product router over loopback plus a real non-loopback socket denial; spoofed forwarding headers do not change the decision.

The real audio/video contract locates an unchanged, hash-verified local H.264+AAC corpus, converts a test copy with the fixed clean encoder, validates AVC and AAC track binding in every CMAF fragment, stops the normal lifecycle, and verifies the assembled MP4 with ffprobe. The fixture source is rehashed before and after the run and is never edited.

The authoritative API contract `lib/api-spec/openapi.yaml` contains all 28 `/tancmark/live/local/v1` path items, management/playback security, tenant and binary upload headers, LL-HLS query controls, exact security-critical schemas, response/error semantics and examples. `artifacts/api-server/openapi/live-local-v1.openapi.yaml` is explicitly a non-authoritative review copy; a parity contract compares its path set and operation IDs with the official document. The generated client trees are produced as complete deterministic outputs; no generated file is hand-selected.

## Still external or operator-supplied

Custom external RTMP targets, social/YouTube OAuth and credentials, external webhook destinations, trusted production TLS/hostname, distributed/CDN deployment, DRM, billing, and counsel-approved legal claims remain explicitly `NOT_CONFIGURED`, `DEFERRED`, or `USER_CONFIGURED`. They do not block the local core and are not reported as successes. Their canonical product status is `EXTERNAL_PROVIDER_INTEGRATIONS_USER_CONFIGURED_NOT_PRODUCT_GAP`: the public interface, schema, redaction and operator checklist exist, while each operator supplies and tests their own provider account and secret-store reference.
