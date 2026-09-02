# Security policy

Please use GitHub's private security-advisory workflow for vulnerability reports. Do not open a public issue containing exploit details, credentials, private media, full IDs, registry records, or unredacted evidence.

C2PA is provenance support only. Remote manifests are disabled, raw private
keys are rejected by the API, tenant asset roots are isolated, and C2PA cannot
grant ownership or open VAULT. Production signing material belongs in an
operator-controlled secret manager and must never be committed or logged.

Canonical sealing is deny-by-default. The server derives the seal tenant and
client from a verified API key, or from an authenticated administrator action
whose target is resolved in the client registry. Request bodies, query values,
arbitrary headers, UI constants, loopback origin, user IDs, and ownership
declarations are never identity authority. Historical null-tenant anchors are
`LEGACY_NULL_TENANT_QUARANTINED_READ_ONLY` and cannot be updated by canonical
public routes.

Local RSA-PSS signing is disabled in product mode. Production signing should
use ES256 locally or an external KMS/HSM/subprocess signer.

Include the affected commit, module, minimal reproduction, expected fail-closed behavior, and whether ownership, tenant isolation, secret handling, or unwatermarked playback may be affected.

Supported versions are the current release candidate and the latest tagged release after publication. No response-time promise is made before a public security process is formally announced.

## GitHub publication security checklist

The local release candidate has no GitHub remote and these repository-hosted services are not active yet. The repository owner must complete and record this checklist after the public GitHub repository is created and before announcing a release:

- [ ] Use the included CodeQL advanced setup workflow; do not enable default setup at the same time. After the first GitHub push, verify that the advanced workflow is active exactly once and uploads results. Do not create a second or default CodeQL configuration.
- [ ] Enable Dependency Review for pull requests and require its check on the protected release branch.
- [ ] Enable Dependabot security updates and version updates for the pnpm workspace and GitHub Actions; review every proposed update before merging.

These services are defense-in-depth checks. They do not replace the frozen install, build, public tests, generated-code repeatability, license inventory, privacy scan, or `sha256sum -c SHA256SUMS` archive-integrity gate.

GitHub Actions references use full commit SHAs verified against the stated release tags in the official upstream repositories; the committed lock manifest and online origin check must agree before release.
