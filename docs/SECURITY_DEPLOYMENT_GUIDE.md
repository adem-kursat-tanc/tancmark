# Security and Deployment Guide

## rc.2 source version continuity

The local rc.2 source preparation changes release identity only on top of the November patched graph. Its separate version transition accepts exactly one root package version-field change and binds both byte hashes and Git blobs to the verified patched base. Missing receipts, unrelated changes and mismatched versions fail closed. Historical security receipts remain unchanged. This is not publication, deployment, new Linux validation or a guarantee against undisclosed vulnerabilities.

The public source is fail closed. Exact media evidence still requires the unique registry record, tenant/account boundary, and a valid record signature. C2PA, short locators, similarity, maps, DNA, ECC, and transport receipts remain support evidence.

The repository demo is an operator-controlled `EXPERIMENTAL_LOCAL_DEMO` using repository-generated synthetic fixtures. GitHub-hosted Codespaces launch is currently unavailable, no paid prebuild is enabled, and hosted demo availability is not a product release or security gate.

The demo sharp declaration now matches the already-installed 0.35.5 security patch. The November receipt verifies this exact one-field manifest transition against its historical hash and Git blob, separately from the unchanged seven-file baseline. It rejects unrelated edits, missing evidence and disagreement with the frozen lockfile or workspace override; the historical V13 report and product integrity digest remain unchanged. The dependency regression suite also checks active sharp resolution and image encode/decode/resize behavior.

Before production deployment:

1. Put TancMark, registry, Live, provider, and C2PA secrets in an operator-controlled secret manager; never in Git, environment templates, request bodies, logs, or database rows. TancMark core secrets; some environment-variable names retain the legacy AEGIS_ prefix for compatibility.
2. Configure TLS termination, trusted proxies, rate limits, database access, encrypted backups, key rotation, retention, audit export, monitoring, and incident response. C2PA plaintext is loopback-only; a remote client must arrive on an actually encrypted socket, and forwarded headers cannot override that boundary.
3. Pin the verified FFmpeg/PyAV/NumPy and MediaMTX runtimes and verify their hashes and licenses.
4. Keep C2PA remote manifest retrieval disabled. If a future owner-approved implementation adds it, require HTTPS allowlists, DNS rebinding and private-address blocking, redirect/time/size/MIME limits, SSRF tests, and redacted audit logs.
5. Restrict tenant media roots, reject reparse points and multiple-link files, create outputs atomically, and verify cleanup after interruption.
6. Run typecheck, both builds, public tests, media smokes, Live exact verification, C2PA negative tests, SBOM/license scans, source/privacy scans, documentation freshness, immutable workflow pinning, and archive checksum verification.
7. Install with the pinned pnpm version and frozen lockfile, then run `pnpm audit --audit-level=low` against current advisories. The November maintenance resolves the 33 advisory findings recorded in the baseline scan across 15 packages. Verify the committed patched versions and the current scan rather than relying on a historical zero-open result.

Production C2PA needs a suitable certificate and private-key lifecycle, possible KMS/HSM integration, revocation handling, and optional Trust List/conformance work. The repository does not claim those operator steps are complete.

Rollback must restore only the reviewed release files. Preserve unrelated work and evidence. Never roll back by lowering thresholds, permitting wrong tenants, trusting body-supplied identity, enabling raw keys, or allowing C2PA to grant ownership.

## November 2026 verification

The maintenance receipt binds exact baseline and patched dependency-file hashes, actual successful build/security test outputs, and the current zero-advisory npm scan. Historical reports and protected product-engine hashes remain unchanged. Targeted regressions cover proxy trust subnets, malformed URI schemes, cross-family IP checks, query serialization and bounded Zod collection validation. Review deployment proxy topology separately: the application still uses its existing single-hop trust configuration.
