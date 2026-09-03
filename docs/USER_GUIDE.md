# TancMark User Guide

TancMark is a self-hosted, Node.js/TypeScript source application for deterministic watermarking and provenance work. It can seal and recover signals in text, images, audio, video, and protected local Live streams. It keeps physical signal recovery separate from identity and ownership authority.

Choose the path that matches what you want to do:

- Learn what TancMark does: read [What TancMark is](#what-tancmark-is), [Core concepts](#core-concepts), and [Results](#results).
- Download the source and run basic tests: go to [Source setup](#source-setup).
- Run a local server: go to [Start the server](#start-the-server).
- Work with text, image, audio, or video: go to [Using the media modules](#using-the-media-modules).
- Protect a local Live stream: go to [Live](#live).
- Read or add C2PA provenance: go to [C2PA](#c2pa).
- Understand a result: read [Results](#results) and [Results and terms](RESULTS_AND_TERMS.md).
- Fix an error: use [Troubleshooting](TROUBLESHOOTING.md).

## What TancMark is

TancMark embeds a deterministic identifier or supporting trace into a working copy, reads physical evidence from a received copy, and can verify an exact result against a tenant-bound registry record and digital signature.

It is intended for developers, technical operators, investigators, publishers, and organizations that can run a self-hosted service and protect its registry and keys. A non-technical end user normally uses a TancMark server or interface installed by an operator.

The current public source contains the TypeScript core, API server, dashboard, generated clients, Video Primary, local protected Live, C2PA support, DNA advisory components, validation programs, and redacted test evidence.

## What TancMark is not

This repository is not a ready-to-install desktop or mobile application. It is not a browser/WebAssembly port. It does not prove legal ownership by itself, certify C2PA conformance, or make weak evidence conclusive.

YouTube, Twitch, external RTMP, OAuth, webhooks, CDN, DRM, billing, production TLS, shared stores, and production queues are not pre-connected. An operator who needs them must configure and test them separately.

## Current public status

- Text, image, audio, Video Primary, local protected Live, registry/signature checks, DNA/Chief Brain advisory behavior, and C2PA read/verify/sign/embed have tested local paths.
- Video's frozen advanced physical matrix passed 14 of 16 cells. The two remaining cases fail closed and remain limits.
- Local protected Live passed its frozen Windows real-media and final exact-verification gates.
- C2PA PNG, JPEG, MP4, and MOV paths were tested locally. PDF and WAV C2PA product support are `NOT_MEASURED` and are rejected.
- Windows has real local test evidence. Linux CI is to be verified after the first owner-approved GitHub push. macOS is not tested.

See [Feature Status](FEATURE_STATUS.md) and the module-specific [robustness evidence](DOCUMENTATION_INDEX.md#robustness-evidence) for the exact boundaries.

## Core concepts

The normal flow is:

```text
SEAL -> RECOVER -> MATCH -> VERIFY
```

- **SEAL** embeds a deterministic identifier or trace into a working copy.
- **RECOVER** reads the seal or identity signal from the received copy.
- **MATCH** compares the recovered value with an authorized record or bounded candidate set.
- **VERIFY** checks the unique registry record, tenant/account binding, and digital signature.

### What blind means

Blind means the reader does not need the original unsealed file. It does not always mean “no other input.” Depending on the module, a reader can receive a key, expected identity, candidate set, carrier shape, signed placement map, or geometry hint. Published evidence must state the read mode and supplied inputs. See [Results and terms](RESULTS_AND_TERMS.md#blind-reading-by-module).

### Original and working copy

Keep the original file unchanged. Seal a separate **working copy** and preserve both files with their checksums and registry record. This lets you prove what was supplied to the sealing step and prevents accidental destructive edits. TancMark readers normally inspect the received working copy without receiving the original.

### Ownership authority

Physical evidence alone is not enough. A module-scoped authoritative result requires the complete expected identity, a unique matching registry record, the correct tenant/account binding, and a valid record signature. A short 32-bit locator, partial ID, similarity, DNA, ECC, C2PA, or signed map cannot open ownership or VAULT.

## Results

- `EXACT`: the full physical identity and required authority chain matched.
- `PARTIAL`: useful signal survived, but the evidence is not an exact identity decision.
- `MANUAL_REVIEW`: evidence is ambiguous or more than one record remains.
- `NOT_FOUND`: the required physical evidence was not recovered.
- `FAIL-CLOSED`: the operation stops without guessing when a required safety condition is absent.

Scope matters. An exact audio identity proves the audio layer; it does not automatically prove the image layer of a video. See [Results and terms](RESULTS_AND_TERMS.md) before interpreting an investigation result.

## C2PA and TancMark identity

C2PA records provenance and checks the signed manifest-to-asset relationship. TancMark exact verification checks a physical TancMark identity against its registry, tenant, and signature chain. They complement each other, but C2PA never grants TancMark ownership or opens VAULT.

## DNA, Chief Brain, and Discovery

DNA organizes module evidence and health information. Chief Brain summarizes and proposes; it does not silently change product decisions. `autoApply=false` remains the default. External Discovery results are candidates for investigation, not ownership evidence. They require exact module evidence and the normal registry/signature chain before any authoritative decision.

## Installation choices

Use one of these source paths:

1. Clone the owner-published GitHub repository from `https://github.com/adem-kursat-tanc/tancmark`.
2. Download GitHub's source ZIP for the selected commit, extract it into a short, empty directory, and validate the included checksums.

There is no published release or tag yet. Until the owner creates one, use the owner-designated `main` commit and compare its commit ID with the announcement. Never invent or trust an unofficial download URL.

### Verify a clone

PowerShell:

```powershell
git clone https://github.com/adem-kursat-tanc/tancmark C:\tm\tancmark
Set-Location C:\tm\tancmark
git rev-parse HEAD
git status --short
```

Bash:

```bash
git clone https://github.com/adem-kursat-tanc/tancmark /tmp/tancmark
cd /tmp/tancmark
git rev-parse HEAD
git status --short
```

### Verify a source ZIP

Extract the ZIP into an empty, short path such as `C:\tm\tancmark`. Do not merge it into an older checkout.

PowerShell full-file verification:

```powershell
Set-Location C:\tm\tancmark
$failed = 0
Get-Content .\SHA256SUMS | ForEach-Object {
  if ($_ -notmatch '^([0-9a-f]{64})  (.+)$') { throw "Invalid SHA256SUMS line: $_" }
  $expected = $Matches[1]
  $file = $Matches[2]
  $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { $failed++; Write-Error "Checksum mismatch: $file" }
}
if ($failed -ne 0) { throw "$failed checksum failures" }
```

Bash:

```bash
cd /tmp/tancmark
sha256sum -c SHA256SUMS
```

`reports/PUBLIC_SOURCE_MANIFEST.json` contains the same tracked source inventory, byte counts, and hashes. The final line count must match its `fileCount`. If a checksum, manifest entry, or ZIP CRC fails, delete only that extracted copy and download again from the owner-published source.

## Requirements

Install only what your selected module needs.

### Basic source and build

- Node.js 24 or newer
- Corepack
- pnpm 10.34.5, selected through Corepack
- PostgreSQL for the API server and database-backed text/registry operations

No general minimum disk or RAM figure is claimed in this public source because a complete cross-machine minimum was not measured.

### Media modules

The frozen Windows reference uses Python 3.14.7, NumPy 2.5.2, PyAV 18.0.0, and FFmpeg 8.1.2. MediaMTX is needed only for the operator flow that uses it. These binaries are not embedded in the repository. Configure verified absolute paths; do not rely on the system `PATH`. Follow [Build the verified media runtime](BUILD_VERIFIED_MEDIA_RUNTIME.md).

### C2PA

C2PA uses the pinned `@contentauth/c2pa-node` 0.9.1 package and its checksum-verified native component. Normal installation fetches the fixed official archive. An offline operator supplies the already downloaded exact archive through `TANCMARK_C2PA_NATIVE_ARCHIVE`. Test certificates and production certificates must remain separate. The local product path accepts ES256 and rejects RSA-PSS signing.

## Source setup

From the repository root:

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm run build:product
pnpm test
pnpm run test:documentation
```

These commands are validated by the public source contract. `pnpm install --frozen-lockfile` can require network access for packages and the verified C2PA native archive. See the [Operator Guide](OPERATOR_GUIDE.md) for offline C2PA installation and database setup.

## Start the server

The source server requires `PORT` and `DATABASE_URL`. Production also refuses the public demo key: set an operator-generated `AEGIS_SECRET` (32 or more random characters recommended; the source-enforced minimum is 8). Configure the database and secrets first. Build the product bundle, then start it from the API workspace:

PowerShell:

```powershell
$env:PORT = '5000'
$env:DATABASE_URL = 'postgresql://tancmark_app:<PASSWORD>@127.0.0.1:5432/tancmark'
$env:ADMIN_TOKEN = '<AT_LEAST_16_RANDOM_CHARACTERS>'
$env:AEGIS_SECRET = '<AT_LEAST_32_RANDOM_CHARACTERS_RECOMMENDED>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Bash:

```bash
export PORT=5000
export DATABASE_URL='postgresql://tancmark_app:<PASSWORD>@127.0.0.1:5432/tancmark'
export ADMIN_TOKEN='<AT_LEAST_16_RANDOM_CHARACTERS>'
export AEGIS_SECRET='<AT_LEAST_32_RANDOM_CHARACTERS_RECOMMENDED>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Do not paste a real password or token into Git, documentation, shell history, or screenshots. Use an operator secret manager in production.

### Health check

```sh
curl http://127.0.0.1:5000/api/healthz
```

Expected body:

```json
{"status":"ok"}
```

## Using the media modules

### Text

The documented product route is `POST /api/aegis/protect-text`. It requires a server-verified API client or an administrator resolving an existing registry client. `POST /api/aegis/analyze-text` requires the admin token. Do not treat a request-body identity as authority. Use the tested requests in [API Examples](API_EXAMPLES.md#text).

The product-safe default does not intentionally replace words or alter meaning. Older mutating behavior is a separately gated legacy laboratory mode and is not the public default.

### Image

The public source contains tested image carrier code and an admin visual test arena. It does not currently expose a documented product-grade image seal/recover HTTP pair in OpenAPI. Run `pnpm run test:physical-text-image` after installing the verified media dependencies. Do not describe the visual lab as an ownership API. Current public smoke evidence is limited to the conditions in [Image robustness](robustness/image.md).

### Audio

The standalone audio implementation and decision contract are included. The audio lab route is not a public product route and the product bundle returns `410`. Run `pnpm run test:physical-audio` with the verified media runtime. An audio exact result is scoped to audio only. See [Audio robustness](robustness/audio.md).

### Video

Video Primary is used through the protected Live product path and through published validation programs. Direct video lab encode/decode and the direct canonical reader are not public product endpoints; the product bundle returns `410`. The canonical reader can be called only inside a verified Live session. See [Video robustness](robustness/video.md) and [the Live product guide](TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md).

## Live

Local protected Live uses `/api/tancmark/live/local/v1`. The server creates the exact identity and registry binding. The normal flow is create session, upload a valid H.264/AAC CMAF initialization segment, start, append ordered CMAF fragments, stop, then read the already-completed exact verification.

Management requests require `x-admin-token` and a verified tenant. Plain HTTP is restricted to the same computer; remote use requires a genuinely encrypted TLS socket. External streaming providers are operator-configured and are not contacted by the default product.

Use [Live API examples](API_EXAMPLES.md#local-protected-live), [the Live guide](TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md), and the [external-provider checklist](LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md).

## C2PA

Place an input working copy inside the configured tenant root. Use `POST /api/tancmark/c2pa/v1/inspect` or `/verify` with only `assetName`. Signing also needs a new `outputName`, explicit `intent`, and the documented public registry fields. `CREATE` requires a valid `digitalSourceType`; `EDIT` and `UPDATE` forbid that field.

The server does not accept raw keys, certificates, tenant IDs, exact IDs, registry rows, paths, maps, trust anchors, TSA URLs, or remote-manifest URLs in the body. See [C2PA API examples](API_EXAMPLES.md#c2pa) and the [C2PA Guide](C2PA_GUIDE.md).

## Evidence and Secure Room

Keep evidence redacted and access-controlled. Preserve checksums, module/read mode, supplied inputs, registry/signature outcome, timestamps, and the difference between support evidence and an exact decision. Never export private keys, tokens, raw exact IDs, registry rows, private maps, customer data, local paths, or private media fingerprints.

Secure Room code exists, but its routes are not part of the current OpenAPI public contract. This guide therefore does not present those routes as a supported public API. Use the operator's reviewed internal workflow until the API contract is reconciled.

## Reading and storing results

Record the module, result class, read mode, expected-ID/candidate input, registry result, tenant result, signature result, and whether the record was unique. Keep the original, working copy, received copy, and evidence export separately. Use encryption and least-privilege access for registry backups and keys.

If a result is `PARTIAL`, `MANUAL_REVIEW`, or `NOT_FOUND`, do not relabel it as ownership. If several records share a locator bucket, no record is selected automatically.

## Common mistakes

- Starting the API without `PORT`, `DATABASE_URL`, or a non-demo `AEGIS_SECRET` in production.
- Using a different pnpm version or an unfrozen install.
- Merging a new source ZIP into an old directory.
- Sending a body-supplied tenant or identity and expecting it to become authority.
- Calling lab video/audio routes from `dist-product` and treating `410` as an engine failure.
- Supplying media tools only through the system `PATH` instead of verified absolute paths.
- Overwriting the original or C2PA input instead of creating a working copy.
- Treating a locator, map, DNA, Discovery, or C2PA result as ownership.
- Calling a remote plain-HTTP Live or C2PA endpoint.

See [Troubleshooting](TROUBLESHOOTING.md) for symptoms and checks.

## Known limits

- The repository's real synthetic-fixture demo is available only as an operator-controlled experimental local/Docker demo; GitHub-hosted Codespaces launch is currently unavailable and is not a product release gate.
- No desktop, mobile, browser, or WebAssembly product is included.
- Linux awaits first-push CI verification; macOS is not tested.
- Two frozen advanced Video cells fail closed.
- External provider delivery and production deployment are operator work.
- Public image/audio robustness claims are narrower than the historical private research corpus.
- PDF/WAV C2PA product support is not measured.
- Results are technical evidence, not automatic legal conclusions.

## Security reporting

Follow [SECURITY.md](../SECURITY.md). Do not open a public issue containing a vulnerability, secret, customer file, unredacted evidence, exact private identity, registry content, or local path.

## License and contributions

TancMark is licensed `AGPL-3.0-only`. Contributions require acceptance of [CLA.md](../CLA.md). A pull request can be merged only with explicit approval from the project owner or a maintainer explicitly designated by the project owner.

For all guides, see the [Documentation Index](DOCUMENTATION_INDEX.md).
