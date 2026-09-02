# TancMark

**Deterministic blind watermarking for text, images, audio, and video.**

Recover hidden IDs from copies without the original.  
Verify exact matches against signed registry records.

**No AI models in the watermarking core. No GPU required.**

**Seal it. Recover it blindly. Verify the signed record.**

## What is TancMark?

TancMark is an open-source watermarking and provenance toolkit. It embeds deterministic identifiers into text, images, audio, and video.
Readers recover physical evidence and keep it separate from ownership authority. An exact physical match becomes authoritative only after registry, tenant, and signature checks. Weak or ambiguous evidence fails closed.

The repository contains the TypeScript core, API server, web dashboard, generated API clients, registry/evidence models, DNA advisory components,
Video Primary, a provider-independent local Live pipeline, and tenant-bound C2PA provenance support.

## Quick Start

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test
```

Node.js 24 or newer and the pinned pnpm 10.34.5 are required. Do not substitute a different package-manager version when reproducing release checks.
Media integration tests also require a locally installed FFmpeg/PyAV runtime.
Runtime binaries and production secrets are not included.

Build that runtime from [the verified media runtime guide](docs/BUILD_VERIFIED_MEDIA_RUNTIME.md),
set the explicit absolute environment paths, then run:

```sh
pnpm run test:media-runtime
pnpm run test:physical-text-image
pnpm run test:physical-audio
pnpm run test:clean-live
```

## Secure Codespaces demo

The isolated bilingual demo runs real text, image, audio, video, Live, registry/signature, and C2PA operations using only repository-generated synthetic fixtures. It accepts no file uploads, paths, URLs, camera, microphone, production keys, or production registry data. Every result is `DEMO_ONLY`, and forwarded port `4173` must remain private.

The devcontainer is prepared for a GitHub Codespaces prebuild: expensive verified setup runs in `updateContentCommand`; user startup only verifies the snapshot, starts the server, and opens the private preview. The owner must enable the prebuild after the first push. See the [English demo guide](docs/DEMO_GUIDE.md), [Türkçe demo kılavuzu](docs/DEMO_GUIDE_TR.md), and [security boundary](docs/DEMO_SECURITY_AND_PRIVACY.md). [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/adem-kursat-tanc/tancmark?quickstart=1)

## How verification works

```text
SEAL → RECOVER → MATCH → VERIFY
```

- **SEAL** embeds a deterministic identifier using the selected media engine.
- **RECOVER** reads physical signal from the received copy.
- **MATCH** resolves an exact ID or a bounded candidate set.
- **VERIFY** checks the unique registry record, tenant/account binding, and signature.

Transport receipts, short locators, similarity, DNA, ECC, and signed placement maps
can help find or explain evidence. They cannot open ownership or VAULT by themselves.

## What does blind mean?

Blind means the original file is not required. Some modules still use
a key, registry candidate set or signed placement map; each published
result states its read mode.

## Result classes

| Result | Meaning | Ownership |
| --- | --- | --- |
| `EXACT` | Full physical ID plus the required authority chain matched | Eligible for the module's scoped decision |
| `PARTIAL` | Some physical evidence survived, but exact proof did not | No |
| `MANUAL_REVIEW` | More than one record or an ambiguous candidate remains | No automatic decision |
| `NOT_FOUND` | Required physical evidence was not recovered | No |

## Engines

### Text

The text core provides deterministic zero-width fingerprints, canaries,
product-safe protection, multi-channel analysis, and wrong-candidate rejection.
The product-safe profile does not intentionally change words or meaning.

### Images

The visual core uses deterministic spatial and frequency-domain carriers.
Published results identify whether the reader is blind, informed, or geometry-guided.
A short visual locator is candidate support, not ownership.

### Audio

The audio engine places independent traces and reports exact or partial bit recovery.
Only a full authorized ID can produce an audio-scoped exact result.
Audio evidence alone never claims ownership of the video image layer.

### Video

Video Primary preserves frame order, PTS/time base, and audio packets.
Channel A is the decisive keyed physical channel; Channel B is corroboration.
The 32-bit L3 value is a locator and can never open ownership alone.

### Live

Protected Live sessions watermark CMAF fragments before playback and recording.
The server owns the exact ID and registry binding.
The stopped VOD is automatically read through the same exact registry/signature chain.
Worker failure is fail closed: no unwatermarked protected fallback is published.

External YouTube, Twitch, Facebook, TikTok, Instagram, RTMP, webhook, CDN,
OAuth, production TLS, DRM, and billing connections are operator configured.
The public core does not contact them.

## Robustness evidence

Published, redacted evidence is split by module:

- [Text](docs/robustness/text.md)
- [Image](docs/robustness/image.md)
- [Audio](docs/robustness/audio.md)
- [Video](docs/robustness/video.md)
- [Live](docs/robustness/live.md)

The Live 7:44 paced run ended with frame loss 0, drift 0, exact audio-packet
preservation, backlog 0, and wrong ownership 0. The advanced Video matrix
passed 14 of 16 frozen physical cells; the two remaining cells failed closed.

## Local API

The provider-independent Live API is mounted at:

```text
/api/tancmark/live/local/v1
```

The authoritative OpenAPI document is `lib/api-spec/openapi.yaml`.
Generated TypeScript/React and Zod clients are included.
Exact IDs, signing material, private maps, decoder internals, and local paths
are not returned by the product API.

The C2PA API is mounted at `/api/tancmark/c2pa/v1` and provides inspect,
verify, and sign/embed operations on tenant-bound working copies. It uses the
official pinned C2PA Node SDK, keeps remote manifests disabled, rejects raw key
material, and reports certificate trust separately from manifest validity.
C2PA is provenance support only and cannot grant ownership or open VAULT.
Local RSA-PSS signing is disabled in product mode; use ES256 locally or an external KMS/HSM/subprocess signer.
Canonical sealing accepts only a server-verified API client or registry-resolved administrator; body identity and null-tenant writes are rejected.

See the [Documentation Index](docs/DOCUMENTATION_INDEX.md), [User Guide](docs/USER_GUIDE.md) ([Türkçe](docs/USER_GUIDE_TR.md)), and [Operator Guide](docs/OPERATOR_GUIDE.md) ([Türkçe](docs/OPERATOR_GUIDE_TR.md)); [API Examples](docs/API_EXAMPLES.md), [Troubleshooting](docs/TROUBLESHOOTING.md), [Results and Terms](docs/RESULTS_AND_TERMS.md), and [C2PA Guide](docs/C2PA_GUIDE.md) are indexed there.

## Security model

- Request bodies are never tenant or ownership authority.
- Wrong tenant is isolated and does not reveal record existence.
- Replays and changed idempotent requests fail closed.
- Signed maps accelerate addressing but do not grant ownership.
- Multiple records in one short-locator bucket require manual review.
- DNA and Chief Brain remain advisory and `autoApply=false`.
- External credentials must remain in an operator-owned secret store.

Please report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).
Do not open a public issue containing a secret, customer file, or unredacted evidence.

## Limits

- Media behavior depends on codec, transform strength, carrier content, and read mode.
- The CPU-safe Live profile publishes protected fragments on a four-second cadence.
- Final exact reading is intentionally stronger and slower than a transport receipt.
- Two advanced Video cells remain documented fail-closed limits.
- External provider delivery is not configured or claimed by this repository.
- The public media tests require an operator-installed runtime outside the repository.
- A technical verification result does not replace legal analysis.

## License and contributions

AGPL-3.0-only. Contributions require acceptance of [CLA.md](CLA.md).
