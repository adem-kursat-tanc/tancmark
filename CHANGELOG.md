# Changelog

## Experimental local demo release-state reconciliation — 2026-09-03

- Reclassified the previously verified local/Docker demo as `EXPERIMENTAL_LOCAL_DEMO`; GitHub-hosted Codespaces launch is currently unavailable and is not a product release gate.
- Preserved the prior V12 functional evidence as historical evidence, withdrew hosted launch claims, and kept paid prebuild disabled by owner decision.
- Added source-ZIP documentation validation that binds the published GitHub URL to the public export marker without a hidden environment variable.
- Made the public CI checkout retain the complete public commit ancestry so pull-request freshness checks can compare the verified base commit without weakening the gate.
- Changed release metadata, documentation, validation, manifest, and checksums only. Product engines, public API behavior, dependencies, the lockfile, identity, registry, signature, ownership, VAULT, Live, C2PA, DNA, and Chief Brain decisions did not change.

## History-free GitHub remote compatibility — 2026-09-01

- Distinguished a safe, expected GitHub `origin` from Git history while continuing to require one parentless public root commit and a public-export marker with `privateHistoryIncluded = false`.
- Added fail-closed HTTPS GitHub target, credential, unexpected-remote, repository-mismatch, and pre-push placeholder transition checks plus a GitHub Actions checkout simulation.
- Kept the pre-push public archive placeholder intact for the owner step. No product, guide content, API behavior, dependency, lockfile, watermark, identity, registry, signature, ownership, VAULT, Live, or C2PA behavior changed.

## Cross-platform release reproducibility — 2026-09-01

- Replaced host-locale collation in release manifests, checksums, SBOM evidence, and source-class digests with one UTF-8 bytewise path-ordering rule.
- Preserved the prior Turkish-locale `e256584b...` digest as historical evidence; it is no longer current release authority and no product file content changed.
- Added fail-closed Turkish, English, and C locale regression coverage plus a real history-free, one-commit public-repository gate.
- Allowed a verified one-commit public export to validate when the historical base object is intentionally absent, using stored provenance records and exact current product blobs.
- Added lightweight CI preflights for cross-locale release evidence and history-free public repositories. No dependency, lockfile, API, watermark, identity, registry, signature, ownership, VAULT, Live, or C2PA behavior changed.

## Public user and operator documentation completion — 2026-09-01

- Replaced the short public user and operator notes with detailed, source-audited English and Turkish guides, API examples, troubleshooting, result terminology, and a documentation index.
- Added a machine-readable source-of-truth audit that distinguishes public product routes, laboratory contracts, server-internal paths, support-only findings, measured Windows behavior, and explicit OpenAPI/code mismatches.
- Kept standalone image/audio/video limitations explicit: no product endpoint was invented, video/audio laboratory routes remain HTTP 410 in `dist-product`, and the canonical video reader remains internal to verified Live sessions.
- Added documentation checks for real package scripts, pinned tool versions, OpenAPI route references, required bilingual files, the product-disabled route warning, and the GitHub URL placeholder transition.
- Changed documentation, documentation validation, README links, the changelog, and generated manifest/checksum evidence only. Watermark algorithms, thresholds, identities, registry/signature, ownership, VAULT, Live, C2PA behavior, dependencies, and the lockfile were not changed.

## V8 canonical-seal security boundary closure — 2026-09-01

- Bound canonical sealing to a server-verified API client or a registry-resolved administrator target and rejected anonymous, spoofed, cross-tenant, and new null-tenant canonical writes.
- Preserved legacy null-tenant anchors as read-only quarantine records and verified tenant-scoped conflict handling in an isolated PostgreSQL database.
- Disabled local PS256, PS384, and PS512 C2PA signing in product mode before private-key access; ES256 remains the local default.
- Repeated the frozen V7 acceptance plan. The designated security paths and tests changed; watermark algorithms, thresholds, exact-ID, registry/signature, ownership, VAULT, Live, DNA, and Chief Brain decisions did not.
- Kept production log serialization and controlled-apply final symlink checks as non-blocking LOW hardening debt. No push, tag, release, or deploy was performed.

## V6 current release metadata reconciliation — 2026-08-31

- Bound the unchanged V4 product evidence to the current V6 package-manager, archive-reader, SBOM and declared-license evidence without changing product behavior.
- Current clean-install inventory covers 1,115 dependencies: 604 JavaScript packages and 511 native Rust packages. Unresolved license count is zero. This is not a legal-approval claim. The previous 1,188 count included 73 stale JavaScript package directories left by earlier local installs.
- Reclassified the pre-toolchain-V6 dependency counts as historical and added fail-closed V6 evidence-consistency checks.

## V4 final evidence reconciliation — 2026-08-30

- Separated the superseded V3 no-go threat-model, ASVS, and SSDF records into an explicitly non-authoritative history area while preserving their exact bytes and SHA-256 values.
- Added current V4 threat-model, ASVS, and SSDF evidence plus an executable consistency gate that rejects stale no-go language outside the V3 history area.
- Clarified TancMark secret terminology while retaining legacy `AEGIS_` environment-variable names for compatibility.
- This reconciliation changes reports, documentation, and validation only; product behavior, watermark decisions, thresholds, identity rules, registry/signature checks, and VAULT behavior are unchanged.

## 0.1.0-rc.1 — 2026-08-28

- Published as the first owner-designated GitHub pre-release on 2026-09-03, with a deterministic source archive and a separate SHA-256 verification file.
- Added official C2PA 2.4 read, verify, sign, and embedded-manifest support through `@contentauth/c2pa-node` 0.9.1.
- Added tenant-bound C2PA inspect, verify, and sign/embed API routes with no-network defaults, key/path redaction, atomic working-copy output, and fail-closed filesystem checks.
- Added the support-only `com.tancmark.registry.v1` assertion and kept exact TancMark ID, registry, tenant, signature, ownership, and VAULT authority unchanged.
- Added C2PA unit, HTTP, negative, supply-chain, and redacted real-local PNG/JPEG/MP4/MOV evidence.
- Added user, operator, feature, C2PA, deployment-security, public-exclusion, and post-GitHub security documentation.
- Added documentation freshness, immutable Action SHA, CodeQL, dependency review, Dependabot, SBOM/license, and final archive integrity gates.
- Reconciled stale Video, DNA, and Live debt entries against their canonical local commits. External providers, production deployment, and official C2PA trust/conformance remain explicit operator steps.
- Preserved the first two historical frozen clean-clone Live failures, corrected the safe lifecycle defects without changing the canonical Live implementation, and passed the same frozen final exact-verification test 3/3. The historical HTTP 500/409 sub-error details were not retained and are recorded as a non-blocking historical evidence limit.
- Corrected generated C2PA request/response validation so valid ISO timestamps pass, CREATE/EDIT/UPDATE field rules are exact, and forged ownership or VAULT safety values fail validation.
- Corrected the CodeQL v4.36.0 pin to its official dereferenced release commit and added fail-closed Action lock and upstream tag-origin verification.
