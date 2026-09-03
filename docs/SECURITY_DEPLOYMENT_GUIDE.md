# Security and Deployment Guide

The public source is fail closed. Exact media evidence still requires the unique registry record, tenant/account boundary, and a valid record signature. C2PA, short locators, similarity, maps, DNA, ECC, and transport receipts remain support evidence.

The repository demo is an operator-controlled `EXPERIMENTAL_LOCAL_DEMO` using repository-generated synthetic fixtures. GitHub-hosted Codespaces launch is currently unavailable, no paid prebuild is enabled, and hosted demo availability is not a product release or security gate.

Before production deployment:

1. Put TancMark, registry, Live, provider, and C2PA secrets in an operator-controlled secret manager; never in Git, environment templates, request bodies, logs, or database rows. TancMark core secrets; some environment-variable names retain the legacy AEGIS_ prefix for compatibility.
2. Configure TLS termination, trusted proxies, rate limits, database access, encrypted backups, key rotation, retention, audit export, monitoring, and incident response. C2PA plaintext is loopback-only; a remote client must arrive on an actually encrypted socket, and forwarded headers cannot override that boundary.
3. Pin the verified FFmpeg/PyAV/NumPy and MediaMTX runtimes and verify their hashes and licenses.
4. Keep C2PA remote manifest retrieval disabled. If a future owner-approved implementation adds it, require HTTPS allowlists, DNS rebinding and private-address blocking, redirect/time/size/MIME limits, SSRF tests, and redacted audit logs.
5. Restrict tenant media roots, reject reparse points and multiple-link files, create outputs atomically, and verify cleanup after interruption.
6. Run typecheck, both builds, public tests, media smokes, Live exact verification, C2PA negative tests, SBOM/license scans, source/privacy scans, documentation freshness, immutable workflow pinning, and archive checksum verification.

Production C2PA needs a suitable certificate and private-key lifecycle, possible KMS/HSM integration, revocation handling, and optional Trust List/conformance work. The repository does not claim those operator steps are complete.

Rollback must restore only the reviewed release files. Preserve unrelated work and evidence. Never roll back by lowering thresholds, permitting wrong tenants, trusting body-supplied identity, enabling raw keys, or allowing C2PA to grant ownership.
