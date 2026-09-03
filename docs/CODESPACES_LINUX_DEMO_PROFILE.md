# Codespaces Linux Demo Profile

`CODESPACES_LINUX_DEMO_PROFILE_V1` is a demo-only platform adapter. It connects existing platform-independent TancMark algorithms to pinned Linux I/O, codec, mux, and browser-delivery components.

Current publication status: `EXPERIMENTAL_LOCAL_DEMO`. **GitHub Codespaces hosted demo currently unavailable.** The profile name is retained for historical evidence and code compatibility; it is not a hosted-service availability claim. No Codespaces badge, hosted quickstart, or paid prebuild is published.

> Linux demo profile verified under bounded synthetic demo conditions. The canonical Windows production profile remains separately verified.

> Linux demo profili, sınırlı yapay demo koşullarında doğrulanmıştır. Kanonik Windows ürün profili ayrıca doğrulanmış olarak korunur.

## Separation

The profile may select Linux binary paths, shared-library paths, an open codec, a container format, and a demo-only certificate helper. It does not change watermark mathematics, watermark strength, decision thresholds, exact-ID requirements, registry/tenant checks, signatures, ownership, VAULT, DNA, Chief Brain, or `autoApply=false`.

Linux-only paths activate only when `TANCMARK_MEDIA_RUNTIME_PROFILE=CODESPACES_LINUX_DEMO_PROFILE_V1` and `TANCMARK_DEMO_ONLY=1`. Existing Windows hashes, Media Foundation behavior, PyAV runtime, Adapter C behavior, and product decisions remain the canonical production path.

## Profile decisions

- Base container: official Ubuntu 24.04 amd64 manifest, pinned by SHA-256 digest.
- File audio: PCM S16LE WAV at 44.1 kHz and 48 kHz stereo.
- File video authority: FFV1 + PCM in Matroska.
- File preview: VP9 + Opus in WebM, non-authoritative.
- Live authority: concurrent FFV1 RGB-lossless + PCM Matroska recording.
- Live preview: VP9 + Opus over RTSP → MediaMTX → fragmented-MP4 HLS.
- C2PA: `@contentauth/c2pa-node` 0.9.1 with ephemeral ES256 test signing and remote fetch disabled.

The initial 320×180 Live fixture did not satisfy the existing Channel A physical layout even before encoding. It was rejected rather than weakening the seal or reader. The allowed 640×360 synthetic fixture passed the raw-frame gate and the final lossless recording gate. Lossy VP9 remains presentation-only because measured compression could preserve visual anchors while damaging exact ID bytes.

## Measured limits

The required 2 vCPU / 8 GB class passed the bounded synthetic gate. A 16-second source was consumed at 1×, 384/384 frames were processed, 8 Channel A and 24 Channel B frames were stamped, and final backlog/dropped frames were 0. Final verification occurs after record finalization, so end-to-end wall time may exceed source duration.

This is not a general Linux production certification and does not replace Windows robustness evidence.
