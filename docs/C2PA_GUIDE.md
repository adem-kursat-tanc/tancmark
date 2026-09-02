# C2PA Guide

TancMark provides C2PA read, verify, sign, and embed support with the official `@contentauth/c2pa-node` 0.9.1 package. C2PA is a provenance and asset-integrity layer. It is not an exact TancMark ID, registry match, tenant decision, ownership decision, or VAULT authority.

The generated request contract is intentionally discriminated: `CREATE` requires an allowed `digitalSourceType`, while `EDIT` and `UPDATE` forbid that field. Generated response validation also fixes all support-only, ownership, final, and VAULT safety values to their fail-closed literals.

The current product policy accepts PNG, JPEG, MP4, and MOV because those four formats passed real-local sign/embed/read/verify gates. PDF and WAV are deliberately rejected as unsupported until each receives its own real-local SDK gate; their status is `NOT_MEASURED`, not an implied success.

## API

All endpoints require the admin token and a server-verified tenant.

- `POST /api/tancmark/c2pa/v1/inspect` with `{ "assetName": "copy.png" }`
- `POST /api/tancmark/c2pa/v1/verify` with the same shape
- `POST /api/tancmark/c2pa/v1/sign-embed` with `assetName`, a new `outputName`, explicit `intent`, public registry reference input, record and algorithm versions, and an ISO timestamp. `CREATE` also requires one documented `digitalSourceType`; `EDIT` and `UPDATE` forbid it. The server never guesses provenance intent.

Plain HTTP is accepted only over the actual loopback socket. A remote client must use an actually encrypted TLS socket; forwarded headers cannot make a remote plaintext connection trusted.

Configure a tenant-specific, random, at-least-32-byte base64url HMAC key through `TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON`. It converts a private registry record identifier into a non-enumerable public handle. The public handle is intentionally stable and therefore linkable across assets that refer to the same record; rotating the HMAC key requires an operator-led reference migration.

The upstream dependency postinstall is deliberately disabled. The root installer downloads only the exact pinned official 0.9.1 platform archive and verifies its SHA-256 and exact size before parsing. Its bounded reader requires one ordinary `index.node` entry, rejects traversal, absolute and nested paths, links, directories, encryption, unsafe compression ratios and inconsistent ZIP metadata, then verifies CRC, binary size and SHA-256. It does not expose an entry-controlled output path or call a general extraction API. The verified binary is installed through a fixed-path, fail-closed atomic-link step and the temporary directory is always removed. For a network-free install, set `TANCMARK_C2PA_NATIVE_ARCHIVE` to an absolute local copy whose checksum matches `reports/C2PA_NATIVE_RELEASE_ASSET_CHECKSUMS.json`.

Tenant, client, raw exact ID, registry row, exact map, certificate, private key, trust anchor, TSA URL, and remote-manifest URL fields are forbidden in the request body. Files are resolved only inside the configured tenant root. Inputs must be ordinary files with one link; the output must not exist.

## Results

The public result distinguishes `NO_C2PA`, `VALID_BUT_UNTRUSTED`, `VALID_AND_TRUSTED`, `VALID_AND_TRUSTED_TEST_CONTEXT`, `INVALID_SIGNATURE`, `ASSET_TAMPERED`, `MALFORMED_MANIFEST`, `UNSUPPORTED_FORMAT`, `REMOTE_MANIFEST_BLOCKED`, and `TRUST_STATUS_NOT_MEASURED`.

Cryptographic manifest validity and public certificate trust are separate. Ephemeral local test certificates can be trusted only in an explicit test context; this is not official C2PA public trust.

## Signing and custom assertion

The output is a new working copy: manifest creation, signing, embedding, rereading, and validation happen before the output is accepted. The namespaced `com.tancmark.registry.v1` assertion contains only an opaque public registry reference, record version, algorithm version, creation time, optional HTTPS public verification URL, and `supportOnly=true`. It contains no exact ID, tenant secret, registry row, private media fingerprint, path, key, or customer identity.

Remote manifest retrieval is not implemented and stays disabled. Embedded manifests work without external network access. Production certificates, private-key lifecycle, KMS/HSM, TSA, revocation operations, Trust List participation, and conformance applications are operator responsibilities. Do not describe this project as C2PA certified or officially conformant.

Local RSA-PSS signing is disabled in product mode. Production signing should
use ES256 locally or an external KMS/HSM/subprocess signer. A test-only
RSA-PSS path, if exercised, requires the existing explicit test-signing gate
and is never a product configuration.

Demo availability does not change this C2PA boundary. The real synthetic-fixture C2PA demonstration remains available through the operator-controlled `EXPERIMENTAL_LOCAL_DEMO`; GitHub-hosted Codespaces launch is currently unavailable and is not a product release gate.
