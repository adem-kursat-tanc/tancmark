# Feature Status

| Feature | Status | Boundary |
| --- | --- | --- |
| Text seal/recover | IMPLEMENTED_AND_TESTED | Product-safe exact/partial decisions |
| Image seal/recover | IMPLEMENTED_AND_TESTED | Read mode is reported; short locator is support only |
| Audio seal/recover | IMPLEMENTED_AND_TESTED | Audio-layer authority only |
| Video Primary | IMPLEMENTED_AND_TESTED | Canonical path preserved; two advanced cells fail closed |
| Local protected Live | IMPLEMENTED_AND_TESTED | Local protected Live and final exact verification passed the frozen clean-clone repeatability gate 3/3. Historical HTTP 500/409 sub-details were not retained and remain a non-blocking historical evidence limit. |
| DNA / Chief Brain | IMPLEMENTED_AND_TESTED | Advisory only; `autoApply=false` |
| Registry and ML-DSA signatures | IMPLEMENTED_AND_TESTED | Exact tenant-bound authority chain |
| Canonical seal authorization | IMPLEMENTED_AND_TESTED | Server-verified API client or registry-resolved administrator; anonymous, spoofed and null-tenant canonical writes rejected |
| Evidence / Secure Room | IMPLEMENTED_AND_TESTED | Redacted support and controlled access |
| C2PA read/verify/sign/embed | IMPLEMENTED_AND_TESTED | Real-local PNG/JPG/MP4/MOV; provenance only; cannot open VAULT; product-local RSA-PSS disabled, ES256 default |
| C2PA PDF/WAV product policy | NOT_MEASURED | Fail-closed as unsupported until a real-local SDK gate exists |
| C2PA public Trust List / conformance | USER_CONFIGURATION_REQUIRED | Operator certificate, trust, and conformance step |
| OpenTimestamps / external providers | USER_CONFIGURATION_REQUIRED | External API and account configuration |
| Sidecar, PDF, ZIP support | IMPLEMENTED_SUPPORT_ONLY | Format-specific documented limits apply |
| Production deploy, TLS, shared store, workers | PRODUCTION_DEPLOYMENT_REQUIRED | Deployment architecture choice |
| CDN, DRM, billing | NOT_IN_CURRENT_SCOPE | Optional commercial infrastructure |
| Browser/WebAssembly and mobile ports | NOT_IN_CURRENT_SCOPE | Node/server reference implementation |

`IMPLEMENTED_AND_TESTED` refers to the published local gates and does not claim legal ownership, official C2PA certification, production deployment, or every possible real-world transformation.

The accepted Live closure does not reopen or change the canonical Live watermark algorithm, thresholds, identities, registry, signature, ownership, or VAULT decisions.

Current V13 inventory covers 1,188 dependencies: 677 JavaScript packages and 511 native Rust packages. Unresolved license count is zero. This is not a legal-approval claim.

V8 closes V7-SEC-001 and V7-SEC-002 without changing watermark algorithms,
thresholds, exact-ID, registry/signature, ownership, VAULT, Live, DNA, or Chief
Brain decisions. V7-SEC-003 and V7-SEC-004 remain documented non-blocking LOW
hardening debt.
