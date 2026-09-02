# TancMark Documentation Index

The English guides are the primary public documentation. Turkish guides state the same product boundaries in natural Turkish. The API contract remains `lib/api-spec/openapi.yaml`; when a guide and code differ, stop and use `reports/DOCUMENTATION_SOURCE_OF_TRUTH_AUDIT.json` rather than guessing.

## Start here

- [User Guide](USER_GUIDE.md) · [Türkçe Kullanıcı Kılavuzu](USER_GUIDE_TR.md)
- [Operator Guide](OPERATOR_GUIDE.md) · [Türkçe Operatör Kılavuzu](OPERATOR_GUIDE_TR.md)
- [API Examples](API_EXAMPLES.md) · [Türkçe API Örnekleri](API_EXAMPLES_TR.md)
- [Troubleshooting](TROUBLESHOOTING.md) · [Türkçe Sorun Giderme](TROUBLESHOOTING_TR.md)
- [Results and Terms](RESULTS_AND_TERMS.md) · [Türkçe Sonuçlar ve Terimler](RESULTS_AND_TERMS_TR.md)

## Product and security references

- [Feature Status](FEATURE_STATUS.md)
- [C2PA Guide](C2PA_GUIDE.md)
- [Build the verified media runtime](BUILD_VERIFIED_MEDIA_RUNTIME.md)
- [Security and Deployment Guide](SECURITY_DEPLOYMENT_GUIDE.md)
- [Live in-stream product guide](TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md)
- [Live local product guide](TANCMARK_LIVE_LOCAL_PRODUCT_GUIDE_20260827.md)
- [Live external-provider checklist](LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md)
- [GitHub post-creation security checklist](GITHUB_POST_CREATE_SECURITY_CHECKLIST.md)
- [Security reporting](../SECURITY.md)
- [Contribution guide](../CONTRIBUTING.md)
- [Contributor licence agreement](../CLA.md)

## Robustness evidence

- [Text](robustness/text.md)
- [Image](robustness/image.md)
- [Audio](robustness/audio.md)
- [Video](robustness/video.md)
- [Live](robustness/live.md)

Each robustness page states its corpus, read mode, supplied inputs, and negative boundary. A private historical result is not a public claim unless the corresponding redacted evidence and frozen conditions are present.

## Machine-readable documentation evidence

- `reports/DOCUMENTATION_SOURCE_OF_TRUTH_AUDIT.json`: operation-by-operation source, authentication, schema, product/lab status, Windows evidence status, and known API mismatches.
- `reports/PUBLIC_SOURCE_MANIFEST.json`: tracked public file inventory, byte count, and SHA-256.
- `SHA256SUMS`: exact raw-byte checksum list for the public archive.
- `SBOM.spdx.json` and `reports/PUBLIC_LICENSE_SCAN.json`: software inventory and declared-licence resolution; not a legal approval.

## Current platform statement

Windows has real local evidence. Linux is scheduled for GitHub CI after the first owner-approved push. macOS is not tested. The current source is not a desktop, mobile, browser, or WebAssembly distribution.

## Documentation maintenance

Run:

```sh
pnpm run test:documentation
```

The gate checks required guide files, bilingual links, versions, real scripts, OpenAPI route references, product-disabled route warnings, terminology, and the canonical GitHub repository URL `https://github.com/adem-kursat-tanc/tancmark`.

Do not update generated manifest or checksum files until documentation and reports are final. Generate them last from the exact staged commit tree.
