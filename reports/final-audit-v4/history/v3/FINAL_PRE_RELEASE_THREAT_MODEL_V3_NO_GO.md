# TancMark V3 — Final pre-release threat model

Audit date: 2026-08-29  
Scope: exact public commit `866fff6fd5b8f169ad958d596b8104ebc00b5a50`  
Method: source review, frozen clean build/tests, dependency advisories, archive/privacy/license checks. This is not a certification.

## Protected assets

- Exact TancMark identity and ownership decision.
- Tenant/client separation, registry entries and immutable digests.
- ML-DSA and C2PA private keys, signatures and receipts.
- Source media, sealed output, timing/placement maps and temporary fragments.
- Live grants, cookies, sessions, fragments, final recordings and VAULT decisions.
- Source-release integrity, dependency lockfile, native binaries and CI workflows.

## Trust boundaries

1. Untrusted client to HTTP/API input parsers.
2. Authenticated user/admin to tenant-scoped product operations.
3. Product server to filesystem/temp area and child processes.
4. Live session to worker, media runtime, registry and final exact reader.
5. TancMark physical evidence to registry, tenant and digital-signature verification.
6. Source tree to package manager, lifecycle scripts, native binaries and GitHub Actions.
7. Public source package to private working evidence and owner-only deployment secrets.

## Adversaries and abuse cases

- Anonymous remote caller probing auth, CORS, CSRF, path, SSRF and error boundaries.
- Authenticated or admin caller sending hostile multipart/image/media input to exhaust resources or trigger parser bugs.
- Cross-tenant caller attempting IDOR, registry/signature substitution or grant replay.
- Attacker supplying only a short locator, partial ID, C2PA metadata or DNA advice to obtain ownership.
- Local/process attacker manipulating PATH, runtime binaries, temp paths, symlinks, hardlinks or interrupted writes.
- Supply-chain attacker replacing dependencies, native binaries, GitHub Actions refs or generated manifests.
- Contributor accidentally publishing private evidence, media fingerprints, exact maps, secrets or personal paths.

## Verified controls

- Exact ID is not replaced by a short locator or partial result; wrong ownership remained zero in measured contracts.
- Tenant, registry and signature checks are required for final product decisions.
- C2PA cannot open VAULT and remote-manifest fetch is disabled by default.
- Canonical video reader is guarded to signed Live scope; public lab/direct routes return 410.
- Media/file tests cover zero, truncated, oversized, wrong-tenant, path, symlink, hardlink, overwrite and temp-cleanup cases.
- Child-process review found no `shell:true`; tested FFmpeg runtime is fixed, non-GPL/nonfree and network-disabled.
- Public archive is reproducible from the exact one-commit tree and passes CRC, manifest and 1034/1034 raw checksums.
- Public-source privacy scan found no secrets, private media, private fingerprint, learning data or private path.
- CI external actions are immutable-SHA pinned and 4/4 origins were checked against official upstream tags.

## Unresolved release threats

1. Multer 2.1.1 is directly reachable on authenticated multipart routes and is affected by a high-severity nested-field denial-of-service advisory.
2. Sharp 0.34.5 directly processes uploaded image bytes and is affected by a high-severity inherited libvips advisory.
3. The documented absolute FFmpeg variables do not drive the canonical helper. A clean operator following the guide receives Live finalization HTTP 500 unless the verified FFmpeg directory is also on process PATH.
4. Seven stale TancMark Live temporary roots remain on the machine, so the mandatory zero-residue cleanup gate is not met.
5. Additional current dependency advisories require runtime/build reachability triage; none are silently declared safe.

## Security decision

The exact candidate has strong archive, privacy, ownership and functional evidence, but frozen policy makes any reachable high advisory or public behavior contradiction an automatic NO-GO. Therefore the decision is `TANCMARK_FINAL_PRE_RELEASE_NO_GO` until the narrow fixes are made and the entire frozen gate is rerun.
