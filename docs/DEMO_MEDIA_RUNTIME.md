# Demo Media Runtime

The repository does not embed platform binaries. The devcontainer downloads official archives over HTTPS, verifies SHA-256 before extraction, and builds the native runtime inside the pinned Ubuntu image.

| Component | Exact version | Source/archive SHA-256 | License/use |
| --- | --- | --- | --- |
| Ubuntu base | 24.04 amd64 | image manifest `1e0a86e57d247923571b75e0aaf48a1449cf8c543d51fb3e07a4a7d7bfa79316` | Canonical official image |
| Node.js | 24.19.0 | `14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647` | MIT |
| pnpm | 10.34.5 | package-manager signature/integrity via Corepack | MIT |
| Python | 3.14.7 | `3b48dac8fb59f62eaa67ac83c1eb12bda1b7a08406dd286e252c11a66be27f81` | PSF-2.0 |
| FFmpeg | 8.1.2 | `464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c` | LGPL profile; GPL/nonfree disabled |
| NumPy | 2.5.2 source | `d482d171c406ae88c5b19cad3b6a1c4c5209f886ab74bc44c2c865c23f52d860` | declared source licenses recorded in SBOM |
| PyAV | 18.0.0 source | `4ef7e72c3d3a872584a1215173b16e0226811037f40dcdbf75992631098df1ba` | BSD-3-Clause |
| MediaMTX | 1.19.1 linux amd64 | `035ee04f91b1c7a0c02e13b2139ca2456e43b6bd6a80e3100e8c228556e07807` | MIT |
| `@contentauth/c2pa-node` | 0.9.1 | pnpm lockfile integrity; native asset separately verified at setup | Apache-2.0/MIT project terms |
| hls.js | 1.7.1 | pnpm lockfile integrity | Apache-2.0 |

## FFmpeg profiles

Authoritative profile:

```text
--disable-gpl --disable-nonfree --disable-autodetect
--enable-shared --disable-static --disable-doc --disable-debug
--disable-network --enable-zlib --enable-libvpx --enable-libopus --enable-pic
--extra-version=tancmark-codespaces-linux-demo-v1
```

Transport-only profile uses the same source and options but enables network and carries `tancmark-codespaces-linux-demo-transport-v1`. It is restricted to fixed loopback RTSP/HLS transport and is never an ownership decision source.

PyAV is built from the exact source archive against the authoritative FFmpeg prefix. The demo launcher supplies absolute executable paths and an explicit shared-library path. It does not depend on a hidden system FFmpeg or system Python.

## Provenance outputs

The image build writes `/opt/tancmark-demo/runtime-provenance.json`, including source hashes and the resulting FFmpeg/MediaMTX binary hashes. Release evidence also captures `ffmpeg -version`, `-buildconf`, encoders, decoders, muxers, demuxers, filters, `ffprobe -version`, and `ldd` results.

No `latest` tag, unverified PPA, personal mirror, `curl | sh`, GPL FFmpeg option, nonfree component, libx264, or libx265 is used.
