# Build the verified media runtime

TancMark does not bundle Python, PyAV, NumPy, FFmpeg, or FFmpeg DLLs. The
protected video and Live path fails closed until an operator installs and
explicitly points TancMark at a compatible runtime.

The frozen Windows reference uses Python 3.14.7, NumPy 2.5.2, PyAV 18.0.0,
and FFmpeg 8.1.2. Source archive hashes are recorded in
`config/public-media-runtime-sources.json`. Verify every archive before use.

## FFmpeg

Use an MSYS2 UCRT64 environment with GCC 16.2.0-3, MinGW-w64
14.0.0.r302.gd7f3c5201-1, pkgconf, make, and zlib 1.3.2-2. Extract the signed
FFmpeg 8.1.2 source as `<stage>/build/ffmpeg-source`, then run:

```bash
bash runtime/build/ffmpeg-8.1.2/build_ffmpeg_product_candidate.sh <stage>
```

The script disables GPL, nonfree, network, autodetection, static linking,
libx264, and libx265. It enables shared libraries, Media Foundation, D3D11VA,
native AAC, and zlib. The published product resolver accepts the frozen binary
provenance below. A different build must be independently audited and its
checksums deliberately reviewed in the resolver before product use; passing a
binary name through `PATH` is never sufficient.

## Python, NumPy, and PyAV

Install Python 3.14.7 outside the repository. Install the exact NumPy 2.5.2
wheel or build it from the recorded source. Build the exact PyAV 18.0.0 source
against the FFmpeg 8.1.2 headers and shared import libraries. Do not patch
PyAV or substitute a wheel linked to a different FFmpeg build.

Set explicit absolute paths; do not rely on the system PATH. Product runtime
uses only these variables:

```text
TANCMARK_LIVE_WATERMARK_PYTHON=<external>/python.exe
TANCMARK_FFMPEG_PATH=<external>/ffmpeg.exe
TANCMARK_FFPROBE_PATH=<external>/ffprobe.exe
TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT=<repo>/runtime/live/live_streaming_adapter_worker.py
TANCMARK_LIVE_ADAPTER_C_SCRIPT=<repo>/runtime/product-runtime/unified_pts_watermark_adapter_c.py
```

The frozen Windows product checksums are:

```text
ffmpeg.exe  6b22601b72c358b3b41bdb8480964b178b5a2bfd1849fb24991f460d2f85a946
ffprobe.exe e540d5392a3981ddfa4cfcccba0becf07fb612a53bf0771e4bc61f4840182a68
```

Test tooling uses `TANCMARK_LIVE_TEST_FFMPEG` and
`TANCMARK_LIVE_TEST_FFPROBE`. These aliases are accepted only when
`NODE_ENV=test`; product mode ignores them. The resolver requires an absolute
normal file, rejects reparse/symlink paths, verifies the exact SHA-256 and
FFmpeg 8.1.2 provenance, and never modifies the global `PATH`.

Then run `pnpm run test:media-runtime`. The check rejects a repository-bundled
runtime, wrong versions, GPL/nonfree/network-enabled FFmpeg, libx264/libx265,
missing Media Foundation H.264, missing native AAC, or modified worker and
Adapter C source. It prints hashes and versions, never absolute paths.

FFmpeg is LGPL-licensed in this configuration and dynamically linked. If you
distribute a runtime, provide the corresponding source, notices, build
instructions, and relinking rights required by its licenses.
