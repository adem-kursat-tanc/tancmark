# Software bill of materials

`SBOM.spdx.json` is generated from the clean, frozen-lockfile installation used for this release candidate. It records resolved package versions, package URLs, discovered licenses, and lockfile integrity/provenance where available.

Runtime binaries are not bundled. FFmpeg, PyAV, NumPy, PostgreSQL, browsers, codecs, and production secret stores must be installed and licensed by the operator.

Regenerate the deterministic SPDX inventory with `pnpm run sbom`. The release
gate rejects unresolved dependency licenses. Binary media-runtime provenance is
documented separately in `config/public-media-runtime-sources.json`.
