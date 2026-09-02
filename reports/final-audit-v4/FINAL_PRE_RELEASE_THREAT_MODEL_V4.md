# TancMark V4 — Final pre-release threat model

Audit authority: V4 evidence reconciliation, 2026-08-30  
Validated public candidate baseline: `57bc782beedd45c49f1cebd840148774240b263e`  
Validated Kingston integration baseline: `8d6c71ccb85227b5b6c5c765d3e3ae4da688ca5a`  
Method: exact-hash evidence reconciliation plus current lightweight build, test, archive, dependency, privacy, and consistency gates. This is not a certification.

## Protected assets and trust boundaries

- Exact TancMark identity and ownership decisions; tenant, registry, and signature bindings.
- Source media, sealed outputs, maps, temporary fragments, Live grants, sessions, receipts, and VAULT decisions.
- Private signing material, provider credentials, C2PA material, public source integrity, native runtime provenance, lockfile, and immutable CI action pins.
- Untrusted clients remain outside authenticated tenant and internal canonical-reader boundaries. Public video/audio laboratory routes remain disabled; the canonical reader remains limited to signed internal Live exact verification.

## Relevant threats

- Hostile multipart/image/media input causing parser or native-image denial of service.
- Wrong-ID, no-ID, wrong-tenant, partial-ID, short-locator, metadata-only, or signature-substitution attempts opening ownership.
- PATH or runtime replacement, unknown native binaries, temporary-resource leakage, worker/port residue, interrupted cleanup, or state reuse.
- Dependency, lifecycle-script, GitHub Actions, manifest, or archive tampering.
- Accidental publication of secrets, private media, fingerprints, personal paths, maps, registry details, or learning data.

## V4 measured controls

- Multer `2.2.0` is exact-pinned and flat multipart parsing uses `fieldNestingDepth=0`; hostile multipart tests passed without process crash, orphan upload, or secret disclosure.
- Sharp `0.35.4` with libvips `8.18.6` passed image regression and video recovery comparison; exact image regression count is zero.
- FFmpeg/FFprobe are resolved by explicit TancMark variables without mutating or depending on system PATH; the verified media runtime reports FFmpeg `8.1.2`.
- Three of three complete clean Live runs passed exact final verification. Wrong ownership, cross-tenant leakage, remaining TancMark temporary roots, workers, and ports are all zero.
- Reachable critical and high dependency advisories are zero. Unresolved licenses, unknown native provenance, uncontrolled Git dependencies, and lockfile drift are zero.
- The exact public archive passed `1038/1038` raw SHA-256 and source-manifest checks, CRC, JSON/YAML parsing, privacy, secret, path, media, and symlink checks.

## Historical findings closed in V4

The former Multer 2.1.1 blocker, Sharp 0.34.5 blocker, FFmpeg PATH dependency, and the seven previously verified Live test roots are each `CLOSED_AND_VERIFIED_IN_V4`. Their original V3 no-go records remain byte-preserved under `history/v3/`; they are not current release authority.

## Carried-forward evidence

Heavy media and historical robustness evidence was not rerun for this documentation-only reconciliation. It is classified as `CARRIED_FORWARD_BY_EXACT_HASHED_EVIDENCE`; no new measurement claim is made.

## V4 decision

The measured V4 authority is `TANCMARK_FINAL_PRE_RELEASE_AUDIT_PASSED` / `GO_FOR_OWNER_PUSH_REVIEW` with known local release blockers `0`. GitHub-native security activation after first push, production TLS/WAF/secret-manager/shared-store configuration, official C2PA Trust List/conformance, external provider user configuration, and GitHub Sponsors profile setup are each `EXTERNAL_OWNER_OR_OPERATOR_STEP`; none is a local source-release blocker. Push, tag, release, and deploy are not performed by this evidence reconciliation.
