# Third-party notices

TancMark source is licensed under AGPL-3.0-only. Third-party packages retain their own licenses.

The C2PA adapter uses `@contentauth/c2pa-node` 0.9.1 and
`@contentauth/c2pa-types` 0.7.3 from the Content Authenticity Initiative
`contentauth/c2pa-js` project under the package-declared MIT license. The Node
package installs a platform-specific native library; exact package and native
provenance is recorded in `reports/C2PA_SOURCE_PROVENANCE_MANIFEST.json`,
the transitive Rust/Cargo declared-license inventory is recorded in
`reports/C2PA_NATIVE_RUST_DEPENDENCIES.json`, and both are incorporated into
the SBOM. These are declared-license inventories, not legal approval. One
historical transitive package (`buffers@0.1.1`) omits machine-readable license
metadata in its npm tarball; its MIT classification is recorded separately in
`reports/PUBLIC_LICENSE_MANUAL_RESOLUTIONS.json` with source evidence.

The committed `pnpm-lock.yaml` fixes the JavaScript dependency graph. The generated SPDX SBOM records resolved package versions, package URLs, licenses when discoverable, and lockfile integrity/provenance. Important direct dependencies include TypeScript, Express, Drizzle ORM, React, Vite, Zod, Sharp, Noble Post-Quantum, PyAV, NumPy, and FFmpeg interfaces. The isolated browser demo additionally uses exact `hls.js` 1.7.1 under Apache-2.0; the script is served locally and no CDN is used.

FFmpeg, PyAV, NumPy, PostgreSQL, and production media runtimes are not bundled in the source archive. Operators install them separately and must comply with the licenses of the builds they choose. The verified Windows reference runtime used LGPL FFmpeg with GPL, nonfree, and network features disabled; that binary is not part of this public package.

The optional `CODESPACES_LINUX_DEMO_PROFILE_V1` devcontainer builds or installs the following into its container image, not into the source archive: Ubuntu 24.04 by immutable amd64 manifest digest; Node.js 24.19.0 (MIT); pnpm 10.34.5 (MIT); Python 3.14.7 (PSF-2.0); NumPy 2.5.2 (BSD-3-Clause plus its separately declared bundled-component licenses); PyAV 18.0.0 (BSD-3-Clause); FFmpeg 8.1.2 (configured LGPL-2.1-or-later, with GPL and nonfree disabled); libvpx (BSD-3-Clause); libopus (BSD-3-Clause); zlib (Zlib); and MediaMTX 1.19.1 (MIT). Exact download hashes, resulting binary hashes, build configuration, dynamic dependencies, and upstream locations are recorded by `runtime/demo/collect-linux-runtime-provenance.mjs` and the Linux demo evidence. The authoritative FFmpeg build has network support disabled. A separate network-enabled FFmpeg build is restricted to loopback preview transport and cannot decide ownership or open VAULT.

No `nonfree` binary, model weight, private media, or externally licensed production credential is distributed here.
